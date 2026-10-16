export type FigcraftCall = (method: string, params?: Record<string, unknown>) => Promise<any>;

type Props = Record<string, unknown>;
interface NewNode { type: string; name?: string; x?: number; y?: number; width?: number; height?: number; text?: string; props?: Props; children?: NewNode[] }
export interface FigcraftOps { create?: NewNode[]; parent?: number; set?: { ids: number[]; props: Props }[]; delete?: number[] }

const RULES = `Você desenha no editor FigCraft. Responda SOMENTE com um objeto JSON (sem markdown, sem texto):
{"parent": <id de frame existente onde criar, opcional>, "create": [<nó>...], "set": [{"ids":[id], "props":{...}}], "delete": [id]}
Nó: {"type":"frame|rectangle|ellipse|text|line|polygon|star", "name":"", "x":0,"y":0,"width":0,"height":0, "text":"(só text)", "props":{...}, "children":[<nó>...]}
x/y são relativos ao frame pai (ou à página no nível raiz); em filhos de frame com layout, omita x/y.
props aceitas: fill ("#RRGGBB"/"#RRGGBBAA"; em text é a cor do texto), stroke, strokeWeight, cornerRadius, opacity, rotation, layout ("horizontal"|"vertical"), gap, padding (número), mainAlign (min|center|max|spaceBetween), crossAlign (min|center|max), sizingH/sizingV (fixed|hug|fill), fontSize, fontStyle (Regular|Medium|SemiBold|Bold), fontFamily ("Inter"), textAlign (left|center|right), lineHeight.
Frames que só agrupam (linhas, colunas, seções) devem ter fill "#00000000" (frames nascem com fundo branco); só dê cor a frames que são superfícies visíveis. Use frames com layout (auto layout) para tudo que for lista/linha/coluna; telas mobile 390x844, desktop 1440x900; textos com fontFamily Inter; cores com bom contraste e hierarquia visual; deixe o conteúdo em PT-BR salvo pedido contrário. Para editar o que já existe use "set" com os ids do documento; não recrie o que não foi pedido.`;

const WEIGHT: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'Bold', 900: 'Bold' };
const ALIAS: Record<string, string> = { strokeWidth: 'strokeWeight', color: 'fill', background: 'fill', borderRadius: 'cornerRadius', radius: 'cornerRadius', spacing: 'gap' };

/** Aceita apelidos comuns que a IA usa e converte para as chaves do motor. */
function norm(props: Props = {}): Props {
  const o: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'fontWeight') o.fontStyle = typeof v === 'number' ? WEIGHT[v] || 'Regular' : v;
    else o[ALIAS[k] || k] = v;
  }
  return o;
}

/** Documento enxuto: só o que a IA precisa para referenciar/editar. */
export function briefDoc(node: any, depth = 0): any {
  if (!node || depth > 5) return undefined;
  const o: any = { id: node.id, type: node.type, name: node.name };
  for (const k of ['x', 'y', 'width', 'height', 'characters', 'cornerRadius']) if (node[k] !== undefined) o[k] = node[k];
  if (node.fills?.[0]?.color) o.fill = node.fills[0].color;
  if (node.layout?.mode && node.layout.mode !== 'none') o.layout = node.layout.mode;
  if (node.children?.length) o.children = node.children.map((c: any) => briefDoc(c, depth + 1)).filter(Boolean);
  return o;
}

export function buildFigcraftPrompt(request: string, doc: any, selection: number[]): string {
  const page = (doc?.pages || []).find((p: any) => p.id === doc.currentPage) || doc?.pages?.[0];
  return `${RULES}\n\nPÁGINA ATUAL: ${JSON.stringify(briefDoc(page)).slice(0, 24000)}\nSELEÇÃO (ids): ${JSON.stringify(selection)}\n\nPEDIDO: ${request}`;
}

export function parseFigcraftOps(text: string): FigcraftOps | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

/** Executa as operações em ordem, capturando os ids novos para criar os filhos. Devolve quantas camadas mudaram. */
export async function applyFigcraftOps(call: FigcraftCall, ops: FigcraftOps): Promise<number> {
  let n = 0;
  // propriedade inventada pela IA não derruba o design: remove as desconhecidas e tenta de novo
  const exec = async (command: string, params: Props): Promise<any> => {
    try {
      return await call('engine.execute', { command, params });
    } catch (e: any) {
      const bad = /unknown properties: ([^(]+)\(known/.exec(String(e?.message))?.[1].split(',').map((x) => x.trim()).filter(Boolean);
      if (!bad?.length || !params.props) throw e;
      const props = { ...(params.props as Props) };
      for (const k of bad) delete props[k];
      return call('engine.execute', { command, params: { ...params, props } });
    }
  };
  const make = async (node: NewNode, parent?: number): Promise<number> => {
    const { children, props, ...rest } = node;
    const p = norm(props);
    if (node.type === 'frame' && p.fill === undefined && p.fills === undefined && parent !== undefined) p.fill = '#00000000';
    const r = await exec('node.create', { ...rest, ...(parent !== undefined ? { parent } : {}), props: p, select: false });
    n++;
    for (const c of children || []) await make(c, r.id);
    return r.id;
  };
  for (const s of ops.set || []) { await exec('node.set', { ids: s.ids, props: norm(s.props) }); n += s.ids.length; }
  if (ops.delete?.length) { await exec('edit.delete', { ids: ops.delete }); n += ops.delete.length; }
  for (const node of ops.create || []) await make(node, ops.parent);
  if (ops.create?.length) await exec('view.zoomFit', {});
  return n;
}
