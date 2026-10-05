import type { Shape } from './types';
import { convertAiItem, extractJson, isDarkColor, referenceBlock, wrapText, type AiScreenRequest, type PendingImage } from './aiScreenFromLlm';
import { COMMON_ICON_NAMES, type IconCatalog } from './icons';

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
  return o;
}

/** A seleção + todos os descendentes (o escopo editável). */
export function editScope(all: Shape[], selectedIds: string[]): Shape[] {
  const ids = new Set(selectedIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of all) if (s.parentId && ids.has(s.parentId) && !ids.has(s.id)) { ids.add(s.id); grew = true; }
  }
  return all.filter((s) => ids.has(s.id));
}

export function buildAiEditPrompt(req: Pick<AiScreenRequest, 'prompt' | 'accentColor' | 'isDark' | 'projectContext' | 'referenceImages'>, scope: Shape[], selectedIds: string[]): string {
  const roots = scope.filter((s) => selectedIds.includes(s.id));
  const frame = roots.length === 1 ? roots[0] : null;
  return `Você é um designer de interfaces editando um design existente. Responda SOMENTE com JSON válido (sem markdown). ${req.referenceImages?.length ? 'Não edite arquivos (apenas abra as imagens de referência).' : 'NÃO leia nem edite arquivos.'}

PEDIDO: ${req.prompt}
${referenceBlock(req.referenceImages)}${req.projectContext ? `CONTEXTO DO PROJETO: ${req.projectContext}\n` : ''}PALETA: mantenha a paleta e o tema que já existem nos elementos acima (cores de fill/stroke atuais); só use cores novas se o pedido pedir ou combinarem com elas. Não use a cor do aplicativo onde você roda.
SELECIONADO (raízes): ${roots.map((r) => r.id).join(', ')}
ELEMENTOS (selecionados e descendentes; coordenadas absolutas no canvas):
${JSON.stringify(scope.slice(0, MAX_CONTEXT).map(brief))}

FORMATO:
{"edits":[{"id":"<id existente>","set":{"fill":"#FFFFFF","text":"Novo texto","x":10,"y":20,"width":100,"height":40,"cornerRadius":8,"fontSize":16,"fontWeight":600,"opacity":1,"name":"..."}}],
 "add":[{"type":"rect|ellipse|text|line|icon|image","parentId":"<id de um elemento existente>","name":"...","x":0,"y":0,"width":100,"height":40,"fill":"#...","text":"...","fontSize":16}],
 "remove":["<id>"]}

REGRAS:
- Só altere/remova ids listados acima. Omita campos que não mudam e chaves vazias.
- "set" aceita: ${Object.keys(EDITABLE).join(', ')}. Cores em #RRGGBB.
- Em "add", x e y são RELATIVOS ao canto superior esquerdo do pai (parentId, padrão: ${frame ? frame.id : 'a primeira raiz'}).
- Ícones: {"type":"icon","name":"<MaterialIcon em PascalCase>","size":24,"fill":"#..."}; exemplos: ${COMMON_ICON_NAMES.slice(0, 40).join(', ')}.
- Fotos: {"type":"image","query":"<descrição em inglês>","x":0,"y":0,"width":64,"height":64,"cornerRadius":32}.
- Textos devem caber dentro do card/pai (o app ajusta, mas dimensione com folga).
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
  ctx: { pageId: string; isDark: boolean; accentColor: string; icons?: IconCatalog }
): AiEditResult | null {
  const data = extractJson(raw);
  if (!data || typeof data !== 'object') return null;
  const inScope = new Map(scope.map((s) => [s.id, s]));
  let shapes = all.slice();
  let changed = 0;
  let removed = 0;
  const newShapes: Shape[] = [];
  const pending: PendingImage[] = [];

  for (const e of Array.isArray(data.edits) ? data.edits : []) {
    const target = inScope.get(e?.id);
    if (!target || !e.set || typeof e.set !== 'object') continue;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e.set)) {
      const val = clean(k, v);
      if (val !== undefined) patch[k] = val;
    }
    if (patch.opacity !== undefined) patch.opacity = Math.max(0, Math.min(1, patch.opacity as number));
    if (typeof patch.text === 'string' && target.type === 'text') patch.text = wrapText(patch.text, (patch.width as number) ?? target.width, (patch.fontSize as number) ?? target.fontSize ?? 16);
    // ícone: a cor vem de fill; tamanho mantém a proporção
    if (target.pathD && (patch.width !== undefined || patch.height !== undefined)) {
      const size = (patch.width ?? patch.height) as number;
      patch.width = size;
      patch.height = size;
    }
    if (!Object.keys(patch).length) continue;
    // x/y que vierem na edição movem também os filhos
    const dx = typeof patch.x === 'number' ? patch.x - target.x : 0;
    const dy = typeof patch.y === 'number' ? patch.y - target.y : 0;
    const descendants = new Set<string>();
    if (dx || dy) for (const s of editScope(shapes, [target.id])) if (s.id !== target.id) descendants.add(s.id);
    shapes = shapes.map((s) => (s.id === target.id ? ({ ...s, ...patch } as Shape) : descendants.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s));
    changed++;
  }

  const fallbackParent = scope.find((s) => selectedIds.includes(s.id));
  for (const item of (Array.isArray(data.add) ? data.add : []).slice(0, MAX_ADD)) {
    const found = (item && inScope.get(item.parentId)) || fallbackParent;
    const parent = found && shapes.find((s) => s.id === found.id); // posição já atualizada pelas edições
    if (!parent) continue;
    const z = Math.max(0, ...shapes.map((s) => s.zIndex)) + 1 + newShapes.length;
    const shape = convertAiItem(item, { frameId: parent.id, originX: parent.x, originY: parent.y, width: parent.width, height: parent.height, ...ctx, isDark: isDarkColor(parent.fill), containers: [], pending }, z);
    if (shape) newShapes.push(shape);
  }

  const toRemove = new Set<string>();
  for (const id of Array.isArray(data.remove) ? data.remove : []) {
    // nunca remove as raízes selecionadas; só o que está dentro delas
    if (inScope.has(id) && !selectedIds.includes(id)) for (const s of editScope(shapes, [id])) toRemove.add(s.id);
  }
  if (toRemove.size) {
    shapes = shapes.filter((s) => !toRemove.has(s.id));
    removed = toRemove.size;
  }
  shapes = [...shapes, ...newShapes];
  if (!changed && !newShapes.length && !removed) return null;
  return { shapes, changed, added: newShapes.length, removed, newIds: newShapes.map((s) => s.id), pending };
}
