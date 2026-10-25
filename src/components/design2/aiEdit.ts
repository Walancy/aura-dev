import type { Shape } from './types';
import { convertAiItem, extractJson, isDarkColor, referenceBlock, tokensBlockFor, wrapText, type AiScreenRequest, type PendingImage } from './aiScreenFromLlm';
import { COMMON_ICON_NAMES, type IconCatalog } from './icons';
import type { DesignTokens } from './designTokens';
import { describeScreenStyle } from './screenStyle';
import { relayoutAll } from './autoLayout';
import { effectsFromItem, styleFromItem, textStyleFromItem } from './aiStyle';

const MAX_CONTEXT = 120;
const MAX_ADD = 100;

/** Propriedades que a IA pode alterar em formas existentes, com o tipo esperado. */
const EDITABLE: Record<string, 'num' | 'color' | 'str'> = {
  x: 'num', y: 'num', width: 'num', height: 'num', rotation: 'num', opacity: 'num', cornerRadius: 'num', strokeWidth: 'num',
  fontSize: 'num', fontWeight: 'num', fill: 'color', stroke: 'color', name: 'str', text: 'str', textAlign: 'str',
};
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|transparent|none)$/;

/** Shape → forma enxuta mostrada à IA. */
function brief(s: Shape): Record<string, unknown> {
  const o: Record<string, unknown> = { id: s.id, type: s.type, name: s.name, parentId: s.parentId, x: Math.round(s.x), y: Math.round(s.y), width: Math.round(s.width), height: Math.round(s.height), fill: s.fill, opacity: s.opacity };
  if (s.stroke && s.stroke !== 'none') { o.stroke = s.stroke; o.strokeWidth = s.strokeWidth; }
  if (s.cornerRadius) o.cornerRadius = s.cornerRadius;
  if (s.type === 'text') { o.text = s.text; o.fontSize = s.fontSize; o.fontWeight = s.fontWeight; o.textAlign = s.textAlign; }
  if (s.iconName) o.icon = s.iconName;
  if (s.widthMode && s.widthMode !== 'fixed') o.w = s.widthMode;
  if (s.heightMode && s.heightMode !== 'fixed') o.h = s.heightMode;
  if (s.type === 'text' && s.fontFamily) o.font = s.fontFamily;
  if (s.hasAutoLayout) o.layout = `${s.layoutFlow} gap${s.layoutGap ?? 0} pad${s.paddingTop ?? 0}/${s.paddingRight ?? 0}/${s.paddingBottom ?? 0}/${s.paddingLeft ?? 0}`;
  // estilo avançado visível para a IA poder alterar/remover (degradês, vidro, sombras, granulado...)
  if (s.fills?.length) o.fills = s.fills.filter((f) => f.visible !== false).map((f) => (f.type && f.type !== 'solid' ? `${f.type}[${(f.gradientStops || []).map((g) => g.color).join(',')}]` : `${f.color}${f.opacity < 1 ? '@' + Math.round(f.opacity * 100) + '%' : ''}`));
  const fx = (s.effects || []).filter((e) => e.visible !== false).map((e) => (e.type === 'drop-shadow' ? 'shadow' : e.type === 'background-blur' ? 'backdrop-blur' : e.type));
  if (fx.length) o.effects = fx;
  return o;
}

/** A seleção + todos os descendentes (o escopo editável). Se a seleção for um elemento folha dentro de um container, inclui o pai direto para permitir adicionar irmãos ou ajustar o bloco. */
export function editScope(all: Shape[], selectedIds: string[]): Shape[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  const ids = new Set(selectedIds);
  for (const id of selectedIds) {
    const s = byId.get(id);
    const hasKids = all.some((c) => c.parentId === id);
    if (s && s.parentId && !hasKids) {
      ids.add(s.parentId);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of all) if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) { ids.add(s.id); grew = true; }
  }
  return all.filter((s) => ids.has(s.id));
}

/** O elemento e todos os seus descendentes (diferente de `editScope`, que numa folha inclui também o pai). */
function subtreeOf(all: Shape[], id: string): Shape[] {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of all) if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) { ids.add(s.id); grew = true; }
  }
  return all.filter((s) => ids.has(s.id));
}

const STOP = new Set('para com sem uma um uns umas the and que por mais menos mude muda troque trocar altere alterar coloque colocar deixe deixar crie criar faça fazer remova remover ajuste ajustar tela telas componente componentes elemento elementos botao botão cor cores texto textos dentro fora esse essa isso este esta nesse nessa todo toda todos todas como quando onde para'.split(' '));
const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Só o que importa para o pedido: elementos cujo nome/texto/ícone cita palavras do pedido, mais o bloco que os contém
 * (o pai direto, se for pequeno) e a cadeia de pais. Prompt menor = a IA entende e responde bem mais rápido.
 * Sem nenhuma correspondência, devolve tudo (limitado).
 */
export function relevantScope(scope: Shape[], selectedIds: string[], prompt: string, max = MAX_CONTEXT): Shape[] {
  if (scope.length <= 40) return scope;
  const words = [...new Set(norm(prompt).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
  if (!words.length) return scope.slice(0, max);
  const byId = new Map(scope.map((s) => [s.id, s]));
  const kids = new Map<string, Shape[]>();
  for (const s of scope) if (s.parentId) kids.set(s.parentId, [...(kids.get(s.parentId) || []), s]);
  const subtree = (id: string, out: Set<string>) => { out.add(id); for (const k of kids.get(id) || []) subtree(k.id, out); };
  const scored = scope
    .filter((s) => !selectedIds.includes(s.id))
    .map((s) => {
      const hay = norm(`${s.name || ''} ${s.text || ''} ${s.iconName || ''}`);
      return { s, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  if (!scored.length) return scope.slice(0, max);
  const keep = new Set<string>();
  for (const { s } of scored) {
    const parent = s.parentId ? byId.get(s.parentId) : undefined;
    const block = new Set<string>();
    if (parent && !selectedIds.includes(parent.id)) subtree(parent.id, block);
    if (block.size > 0 && block.size <= 40) block.forEach((id) => keep.add(id));
    else subtree(s.id, keep);
    // cadeia de pais (contexto de estrutura)
    for (let cur = s.parentId ? byId.get(s.parentId) : undefined, g = 0; cur && g < 8; cur = cur.parentId ? byId.get(cur.parentId) : undefined, g++) keep.add(cur.id);
  }
  selectedIds.forEach((id) => keep.add(id));
  const out = scope.filter((s) => keep.has(s.id));
  return out.length > max ? out.slice(0, max) : out;
}

export function buildAiEditPrompt(req: Pick<AiScreenRequest, 'prompt' | 'accentColor' | 'isDark' | 'projectContext' | 'referenceImages' | 'referenceSpec' | 'tokens'>, scope: Shape[], selectedIds: string[], allShapes?: Shape[]): string {
  const roots = scope.filter((s) => selectedIds.includes(s.id));
  const frame = roots.length === 1 ? roots[0] : scope[0] || null;
  const shown = relevantScope(scope, selectedIds, req.prompt);
  const fullList = allShapes && allShapes.length ? allShapes : scope;
  const byId = new Map(fullList.map((s) => [s.id, s]));
  let topRoot = roots[0] || scope[0];
  while (topRoot?.parentId && byId.get(topRoot.parentId)) topRoot = byId.get(topRoot.parentId)!;
  const styleGuide = topRoot ? describeScreenStyle(fullList, topRoot) : '';
  const hasRefImgs = Boolean(req.referenceImages?.length || req.referenceSpec);
  return `Você é um designer de interfaces editando um design existente no canvas. Responda SOMENTE com JSON válido (sem markdown). ${req.referenceImages?.length && !req.referenceSpec ? 'Não edite arquivos (apenas abra as imagens de referência).' : 'NÃO leia nem edite arquivos.'}

PEDIDO: ${req.prompt}
${tokensBlockFor(req)}${referenceBlock(req.referenceImages, req.referenceSpec)}${hasRefImgs ? `USO DA IMAGEM DE REFERÊNCIA NA EDIÇÃO: o usuário selecionou/anexou imagem(ns) de referência junto com a tela a ser editada. Analise a(s) imagem(ns) de referência e aplique na tela selecionada exatamente o que o pedido solicita (seja extrair a paleta/estilo da imagem para a tela, adicionar um componente/seção inspirado ou copiado da imagem dentro da tela selecionada, ou alinhar o visual da tela à referência).\n` : ''}${req.projectContext ? `CONTEXTO DO PROJETO: ${req.projectContext}\n` : ''}ESTILO ATUAL DESTA TELA (siga ao pé da letra em tudo que criar ou alterar, exceto o que o pedido mandar mudar com base na referência):
${styleGuide}
PALETA: mantenha a paleta e o tema que já existem nos elementos acima (cores de fill/stroke atuais); só use cores novas se o pedido pedir ou vierem da imagem de referência selecionada. Não use a cor do aplicativo onde você roda.
SELECIONADO PELO USUÁRIO (foco do pedido): ${roots.map((r) => `${r.id} ("${r.name || r.type}")`).join(', ')}
${scopeStats(scope)}ELEMENTOS (selecionados e contexto editável; coordenadas absolutas no canvas):
${JSON.stringify(shown.slice(0, MAX_CONTEXT).map(brief))}${shown.length < scope.length ? `\n(Mostrando só os ${shown.length} elementos relevantes ao pedido, de ${scope.length} na seleção; os demais não precisam mudar.)` : ''}

FORMATO:
{"bulk":[{"where":{"type":"frame|rect|text|...","name":"parte do nome","hasStroke":true,"hasRadius":true,"hasEffects":true,"hasAutoLayout":true,"minChildren":2,"minRadius":4,"under":"<id>"},"set":{"stroke":"none","cornerRadius":0,"gap":12,"padding":16}}],
 "edits":[{"id":"<id existente>","set":{"fill":"#FFFFFF","text":"Novo texto","x":10,"y":20,"width":100,"height":40,"cornerRadius":8,"fontSize":16,"fontWeight":600,"opacity":1,"name":"..."}}],
 "add":[{"type":"frame|rect|ellipse|text|line|icon|image","id":"<id novo, se tiver filhos>","parent":"<id existente ou id novo declarado ANTES>","name":"...","layout":"horizontal|vertical","gap":8,"padding":12,"align":"left","width":"fill|hug|100","height":"hug|40","fill":"#...","cornerRadius":12,"text":"...","fontSize":16}],
 "remove":["<id>"]}

REGRAS:
- MUDANÇA EM VÁRIOS ELEMENTOS (remover bordas/raio/sombra de todos os componentes, padronizar espaçamentos, trocar uma cor em toda a tela): use "bulk" — o app aplica o "set" a TODOS os elementos da seleção que casam com o "where" (todos os campos do "where" são opcionais e se combinam; omitido = qualquer). NÃO liste um por um. Exemplos: "remova a borda dos componentes" = {"where":{"hasStroke":true},"set":{"stroke":"none"}}; "tire o raio dos cards" = {"where":{"type":"frame","hasRadius":true,"minChildren":2},"set":{"cornerRadius":0}} (card = frame com fundo, raio e filhos; botões e chips pequenos NÃO são cards: se o pedido fala só dos cards, mire neles pelo tamanho/nome); "ajuste os espaçamentos" = veja o RESUMO e os "layout" dos elementos e padronize os gaps e paddings dos auto layouts (múltiplos de 4/8, hierarquia coerente: entre seções maior, dentro de cards menor) com bulk por tipo de bloco e/ou "edits" nos casos específicos. Use "edits" (por id) só para ajustes pontuais.
- Só altere/remova ids listados acima. Omita campos que não mudam e chaves vazias.
- "set" aceita: ${Object.keys(EDITABLE).join(', ')}; em frames com auto layout também "gap" (espaço entre filhos), "padding" (número ou [topo,direita,base,esquerda]), "paddingX", "paddingY", "align" (top-left|top-center|…|center), e "widthMode"/"heightMode" ("fill"|"hug"|"fixed"). "stroke":"none" remove a borda; "cornerRadius":0 tira o arredondamento. Cores em #RRGGBB (ou #RRGGBBAA com transparência).
- ESTILO em "set" (mesma sintaxe da criação): "fills":[camadas de baixo p/ cima: "#RRGGBBAA" ou {"gradient":{...}}], "gradient":{...}, "glass":true, "effects":[{"type":"shadow|inner-shadow|blur|backdrop-blur|noise",...}] — "effects" SUBSTITUI todos os efeitos do elemento: "effects":[] remove todos (sombras, blur, granulado/noise...); para remover só um, repita os outros que ficam (veja a lista "effects" de cada elemento acima). Também "radii":[4 raios], "letterSpacing", "textCase", "fontFamily". Efeitos de fundo da tela (granulado etc.) ficam no elemento da própria tela.
- TEXTURA: xadrez/quadriculado/grade/pontos/linhas entram como camada em "fills" (acima da cor): {"pattern":"checker|grid|dots|lines|noise","color":"#RRGGBB","background":"#RRGGBB (2º tom do xadrez, opcional)","opacity":0.1,"size":16}. Xadrez = "checker" (size é o lado de 2 quadrados: 16 dá quadrados de 8px); para um xadrez bem visível use opacity 1 com as duas cores.
- AUTO LAYOUT (obrigatório em componentes novos): todo bloco novo com filhos (header, navbar, card, linha, lista) é UM frame com "layout" ("horizontal"/"vertical"), "gap" e "padding"; os filhos declaram "parent" com o id desse frame e NÃO levam x/y; larguras "fill" (ocupa o espaço) ou "hug" (ajusta ao conteúdo). Se o pai existente já tem auto layout (veja "layout" nos elementos), o item novo entra no fluxo dele sem x/y. Só use x/y em itens soltos sem pai com layout.
- Em "add" sem layout, x e y são RELATIVOS ao canto superior esquerdo do pai (parentId, padrão: ${frame ? frame.id : 'a primeira raiz'}).
- Ícones: {"type":"icon","name":"<MaterialIcon em PascalCase>","size":24,"fill":"#..."}; exemplos: ${COMMON_ICON_NAMES.slice(0, 40).join(', ')}.
- Fotos: {"type":"image","query":"<descrição em inglês>","x":0,"y":0,"width":64,"height":64,"cornerRadius":32}.
- Textos devem caber dentro do card/pai (o app ajusta, mas dimensione com folga).
- ESTILO: elementos novos ou alterados usam EXATAMENTE as cores, raios, fontes, pesos e espaçamentos dos elementos vizinhos listados (copie de um irmão parecido; use as cores do ESTILO ATUAL, nunca cores novas); com referência visual anexada/selecionada, siga fielmente a referência para o que foi pedido.
- FAÇA EXATAMENTE O PEDIDO, nem mais nem menos, sem perder o contexto: entenda ONDE na tela o pedido se aplica (o elemento citado, a seção, o topo/rodapé) e use o conteúdo da própria tela (nomes, textos, marca, idioma). Não invente seções, textos genéricos ("Lorem", "Título") nem elementos que não foram pedidos.
- COMPONENTE NOVO = IRMÃO DE UM EXISTENTE: antes de criar, ache na lista um elemento parecido (outro card, botão, cabeçalho, chip, item de lista) e COPIE a estrutura, o fill, o raio, a borda, a sombra, a fonte, o peso, os paddings e o gap dele; sem parecido, derive tudo do ESTILO ATUAL. Use só cores, raios e espaçamentos que já aparecem na tela (múltiplos de 4/8), contraste legível com o fundo, e largura "fill" para ocupar a coluna do pai.
- POSIÇÃO: um item novo entra no pai e na ordem em que faria sentido (header no topo do fluxo, navbar na base, card junto aos outros cards); nunca sobreposto a conteúdo existente nem fora dos limites do pai; se o pai tem auto layout, o item entra no fluxo (sem x/y).
- RAPIDEZ: responda só com o JSON mínimo (nada de comentários); altere só o que o pedido exige.
- Faça somente o que foi pedido, preservando o resto do design. Textos em português do Brasil.`;
}

function clean(key: string, v: unknown): string | number | undefined {
  const kind = EDITABLE[key];
  if (kind === 'num') {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  }
  if (kind === 'color') return typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : undefined;
  if (key === 'textAlign') return ['left', 'center', 'right'].includes(String(v)) ? String(v) : undefined;
  return typeof v === 'string' ? v.slice(0, 300) : undefined;
}


const ALIGNS = new Set(['top-left', 'top-center', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom-center', 'bottom-right']);
const px = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
};

/** "set" da IA -> campos do shape. Mantém em dia as listas `fills`/`strokes` e o raio individual (o FigCraft desenha por elas, não por `fill`/`stroke`/`cornerRadius`). */
function buildPatch(target: Shape, set: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(set)) {
    const val = clean(k, v);
    if (val !== undefined) patch[k] = val;
  }
  // estilo avançado: fills/gradient/glass/radii e efeitos (array vazio remove todos)
  if (['fills', 'gradient', 'glass', 'radii'].some((k) => set[k] != null)) {
    const { effects: _fx, ...st } = styleFromItem({ ...set, effects: undefined, shadow: undefined, blur: undefined, backdropBlur: undefined, noise: undefined });
    Object.assign(patch, st);
  }
  if (['effects', 'shadow', 'blur', 'backdropBlur', 'noise', 'glass'].some((k) => set[k] != null)) {
    patch.effects = Array.isArray(set.effects) ? effectsFromItem({ effects: set.effects, shadow: set.shadow, blur: set.blur, backdropBlur: set.backdropBlur, noise: set.noise }) : styleFromItem(set).effects || [];
  }
  if (target.type === 'text') Object.assign(patch, textStyleFromItem(set));
  if (patch.opacity !== undefined) patch.opacity = Math.max(0, Math.min(1, patch.opacity as number));
  if (typeof patch.text === 'string' && target.type === 'text') patch.text = wrapText(patch.text, (patch.width as number) ?? target.width, (patch.fontSize as number) ?? target.fontSize ?? 16);
  // ícone: a cor vem de fill; tamanho mantém a proporção
  if (target.pathD && (patch.width !== undefined || patch.height !== undefined)) {
    const size = (patch.width ?? patch.height) as number;
    patch.width = size;
    patch.height = size;
  }
  // cor: a camada de cima do preenchimento passa a ser a cor pedida
  if (typeof patch.fill === 'string' && set.fills == null && set.gradient == null && set.glass == null) {
    const c = patch.fill as string;
    patch.fills = c === 'none' || c === 'transparent' ? [] : [{ id: 'f0', color: c, opacity: 1, visible: true, type: 'solid' }];
  }
  // borda: sem borda = nenhuma camada de contorno
  if (patch.stroke !== undefined || patch.strokeWidth !== undefined) {
    const sw = (patch.strokeWidth as number | undefined) ?? target.strokeWidth ?? 0;
    const sc = (patch.stroke as string | undefined) ?? target.stroke ?? 'none';
    if (sc === 'none' || sc === 'transparent' || sw <= 0) Object.assign(patch, { strokes: [], stroke: 'none', strokeWidth: 0 });
    else Object.assign(patch, { strokes: [{ id: 's0', color: sc, opacity: 1, visible: true, width: sw }], stroke: sc, strokeWidth: sw });
  }
  // raio: um valor único vale para os quatro cantos
  if (patch.cornerRadius !== undefined || Array.isArray(set.radii)) {
    if (patch.cornerRadius !== undefined && !Array.isArray(set.radii)) Object.assign(patch, { independentCorners: false, topLeftRadius: undefined, topRightRadius: undefined, bottomRightRadius: undefined, bottomLeftRadius: undefined });
  }
  // espaçamento do auto layout
  if (target.hasAutoLayout) {
    const gap = px(set.gap);
    if (gap !== undefined) patch.layoutGap = gap;
    const pd = set.padding;
    const arr = Array.isArray(pd) ? pd.map(px) : pd != null ? [px(pd)] : [];
    let [t, r, b, l]: Array<number | undefined> = arr.length === 4 ? arr : arr.length === 2 ? [arr[0], arr[1], arr[0], arr[1]] : arr.length === 1 ? [arr[0], arr[0], arr[0], arr[0]] : [undefined, undefined, undefined, undefined];
    if (set.paddingX != null) { l = px(set.paddingX) ?? l; r = l; }
    if (set.paddingY != null) { t = px(set.paddingY) ?? t; b = t; }
    t = px(set.paddingTop) ?? t; r = px(set.paddingRight) ?? r; b = px(set.paddingBottom) ?? b; l = px(set.paddingLeft) ?? l;
    if ([t, r, b, l].some((x) => x !== undefined)) {
      Object.assign(patch, { independentPadding: true, paddingTop: t ?? target.paddingTop ?? 0, paddingRight: r ?? target.paddingRight ?? 0, paddingBottom: b ?? target.paddingBottom ?? 0, paddingLeft: l ?? target.paddingLeft ?? 0 });
    }
    if (typeof set.align === 'string' && ALIGNS.has(set.align)) patch.layoutAlign = set.align;
  }
  for (const k of ['widthMode', 'heightMode'] as const) if (['fill', 'hug', 'fixed'].includes(set[k])) patch[k] = set[k];
  return patch;
}

/** Filtro de uma operação em massa: tipo, nome, com/sem borda, raio, efeitos, auto layout, nº de filhos, dentro de um elemento. */
function bulkMatcher(where: any, all: Shape[], scope: Shape[]): (s: Shape) => boolean {
  const w = where && typeof where === 'object' ? where : {};
  const types = w.type == null || w.type === 'any' ? null : new Set(([] as string[]).concat(w.type).map(String));
  const name = typeof w.name === 'string' && w.name ? norm(w.name) : '';
  const kids = new Map<string, number>();
  for (const s of all) if (s.parentId) kids.set(s.parentId, (kids.get(s.parentId) || 0) + 1);
  const under = new Set<string>();
  if (typeof w.under === 'string') for (const s of subtreeOf(scope, w.under)) under.add(s.id);
  return (s) => {
    if (types && !types.has(s.type)) return false;
    if (name && !norm(`${s.name || ''}`).includes(name)) return false;
    if (typeof w.hasStroke === 'boolean' && (!!(s.strokes?.length) || (!!s.stroke && s.stroke !== 'none' && (s.strokeWidth || 0) > 0)) !== w.hasStroke) return false;
    if (typeof w.hasRadius === 'boolean' && (!!s.cornerRadius || !!s.independentCorners) !== w.hasRadius) return false;
    if (typeof w.hasEffects === 'boolean' && !!(s.effects || []).some((e) => e.visible !== false) !== w.hasEffects) return false;
    if (typeof w.hasAutoLayout === 'boolean' && !!s.hasAutoLayout !== w.hasAutoLayout) return false;
    if (typeof w.minChildren === 'number' && (kids.get(s.id) || 0) < w.minChildren) return false;
    if (typeof w.minRadius === 'number' && (s.cornerRadius || 0) < w.minRadius) return false;
    if (under.size && !under.has(s.id)) return false;
    return true;
  };
}

/** Valores de borda, raio e espaçamento em uso (com contagem): a IA vê o que existe e consegue padronizar. */
function scopeStats(scope: Shape[]): string {
  const tally = (vals: number[]) => [...vals.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map<number, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => `${v}px×${n}`).join(', ') || 'nenhum';
  const frames = scope.filter((s) => s.hasAutoLayout);
  return `RESUMO DA SELEÇÃO (${scope.length} elementos): com borda ${scope.filter((s) => s.strokes?.length || (s.stroke && s.stroke !== 'none' && s.strokeWidth)).length}; com raio ${scope.filter((s) => s.cornerRadius || s.independentCorners).length} (raios: ${tally(scope.map((s) => Math.round(s.cornerRadius || 0)).filter(Boolean))}); com sombra/efeito ${scope.filter((s) => (s.effects || []).some((e) => e.visible !== false)).length}; auto layouts ${frames.length} (gaps: ${tally(frames.map((s) => s.layoutGap ?? 0))}; paddings: ${tally(frames.flatMap((s) => [s.paddingTop ?? 0, s.paddingLeft ?? 0]).filter(Boolean))}).
`;
}

export interface AiEditResult {
  shapes: Shape[];
  changed: number;
  added: number;
  removed: number;
  /** ids que devem ficar selecionados depois (os novos, se houver) */
  newIds: string[];
  /** imagens adicionadas que ainda precisam de foto */
  pending: PendingImage[];
}

/** Aplica o JSON de edição sobre `all`, limitado ao escopo da seleção. Null se nada utilizável. */
export function applyAiEdits(
  raw: string,
  all: Shape[],
  scope: Shape[],
  selectedIds: string[],
  ctx: { pageId: string; isDark: boolean; accentColor: string; icons?: IconCatalog; tokens?: DesignTokens | null }
): AiEditResult | null {
  const data = extractJson(raw);
  if (!data || typeof data !== 'object') return null;
  const inScope = new Map(scope.map((s) => [s.id, s]));
  let shapes = all.slice();
  let changed = 0;
  let removed = 0;
  const newShapes: Shape[] = [];
  const pending: PendingImage[] = [];

  // operações em massa ("bulk"): o mesmo ajuste em TODOS os elementos do escopo que casam com o filtro (aplicadas antes das edições individuais)
  const bulkHit = new Set<string>();
  for (const op of (Array.isArray(data.bulk) ? data.bulk : []).slice(0, 12)) {
    if (!op || typeof op.set !== 'object' || !op.set) continue;
    const match = bulkMatcher(op.where, shapes, scope);
    for (const t of scope) {
      const cur = shapes.find((x) => x.id === t.id);
      if (!cur || (cur.parentId === undefined && op.where?.includeRoot !== true) || cur.deviceChrome || !match(cur)) continue; // a tela em si (raiz) fica de fora
      const patch = buildPatch(cur, op.set);
      if (!Object.keys(patch).length) continue;
      shapes = shapes.map((s) => (s.id === cur.id ? ({ ...s, ...patch } as Shape) : s));
      bulkHit.add(cur.id);
    }
  }
  changed += bulkHit.size;

  for (const e of Array.isArray(data.edits) ? data.edits : []) {
    const target = inScope.get(e?.id);
    if (!target || !e.set || typeof e.set !== 'object') continue;
    const patch = buildPatch(target, e.set);
    if (!Object.keys(patch).length) continue;
    // x/y que vierem na edição movem também os filhos
    const dx = typeof patch.x === 'number' ? patch.x - target.x : 0;
    const dy = typeof patch.y === 'number' ? patch.y - target.y : 0;
    const descendants = new Set<string>();
    if (dx || dy) for (const s of subtreeOf(shapes, target.id)) if (s.id !== target.id) descendants.add(s.id);
    shapes = shapes.map((s) => (s.id === target.id ? ({ ...s, ...patch } as Shape) : descendants.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s));
    changed++;
  }

  const fallbackParent = scope.find((s) => selectedIds.includes(s.id));
  // ids que a IA dá aos itens novos ("id") para os filhos apontarem ("parent"); também aceita ids existentes
  const aiIds = new Map<string, string>();
  const find = (aiId: string) => {
    const id = aiIds.get(aiId) ?? (inScope.has(aiId) ? aiId : undefined);
    return id ? newShapes.find((s) => s.id === id) ?? shapes.find((s) => s.id === id) : undefined;
  };
  for (const raw0 of (Array.isArray(data.add) ? data.add : []).slice(0, MAX_ADD)) {
    if (!raw0 || typeof raw0 !== 'object') continue;
    const item = { ...raw0, parent: raw0.parent ?? raw0.parentId };
    const found = (typeof item.parent === 'string' && find(item.parent)) || fallbackParent;
    const parent = found && (newShapes.find((s) => s.id === found.id) ?? shapes.find((s) => s.id === found.id)); // posição já atualizada pelas edições
    if (!parent) continue;
    const z = Math.max(0, ...shapes.map((s) => s.zIndex)) + 1 + newShapes.length;
    const shape = convertAiItem(item, { frameId: parent.id, originX: parent.x, originY: parent.y, width: parent.width, height: parent.height, ...ctx, isDark: isDarkColor(parent.fill), containers: [], pending, lookup: find }, z);
    if (shape) {
      newShapes.push(shape);
      if (typeof item.id === 'string') aiIds.set(item.id, shape.id);
    }
  }

  const toRemove = new Set<string>();
  for (const id of Array.isArray(data.remove) ? data.remove : []) {
    // nunca remove as raízes selecionadas; só o que está dentro delas
    if (inScope.has(id) && !selectedIds.includes(id)) for (const s of subtreeOf(shapes, id)) toRemove.add(s.id);
  }
  if (toRemove.size) {
    shapes = shapes.filter((s) => !toRemove.has(s.id));
    removed = toRemove.size;
  }
  shapes = [...shapes, ...newShapes];
  // itens novos com auto layout (ou dentro de um): calcula posições/tamanhos (hug/fill/gap)
  if (newShapes.some((n) => n.hasAutoLayout || shapes.find((p) => p.id === n.parentId)?.hasAutoLayout)) shapes = relayoutAll(shapes);
  if (!changed && !newShapes.length && !removed) return null;
  return { shapes, changed, added: newShapes.length, removed, newIds: newShapes.map((s) => s.id), pending };
}

