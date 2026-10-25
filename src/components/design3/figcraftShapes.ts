import type { Shape, FillItem, EffectItem } from '../design2/types';
import type { FigcraftCall } from './figcraftAi';
import { resolveIconName, type IconCatalog } from '../design2/icons';

type Props = Record<string, unknown>;

/** Famílias que o FigCraft embute (as demais caem em Poppins, o padrão do Design). */
const FONTS: Record<string, string> = { poppins: 'Poppins', inter: 'Inter' };
const family = (f?: string) => FONTS[String(f || '').toLowerCase().trim()] || 'Poppins';

const hex8 = (c: string, a = 1): string => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(c || '').trim());
  if (!m) return '#000000';
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const base = h.slice(0, 6);
  const own = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
  const al = Math.round(Math.max(0, Math.min(1, a * own)) * 255);
  return `#${base}${al < 255 ? al.toString(16).padStart(2, '0') : ''}`;
};

function paintOf(f: FillItem): Props | null {
  if (f.visible === false) return null;
  const type = f.type || 'solid';
  if (type === 'solid') return { type: 'solid', color: hex8(f.color), opacity: f.opacity ?? 1 };
  if ((type === 'linear' || type === 'radial' || type === 'angular' || type === 'diamond') && f.gradientStops?.length) {
    const stops = [...f.gradientStops].sort((a, b) => a.position - b.position).map((s) => ({ position: s.position, color: hex8(s.color, s.opacity ?? 1) }));
    if (type === 'linear') {
      // ângulo estilo CSS (90 = da esquerda para a direita) -> alças no quadrado unitário
      const a = ((f.gradientAngle ?? 180) * Math.PI) / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      return { type: 'gradient', kind: 'linear', stops, from: [0.5 - dx / 2, 0.5 - dy / 2], to: [0.5 + dx / 2, 0.5 + dy / 2], width: [-dy * 0.5, dx * 0.5], opacity: f.opacity ?? 1 };
    }
    const c = f.gradientCenter || { x: 0.5, y: 0.5 };
    const r = f.gradientRadius ?? 0.5;
    return { type: 'gradient', kind: type, stops, from: [c.x, c.y], to: [c.x, c.y + r], width: [c.x + r, c.y], opacity: f.opacity ?? 1 };
  }
  return null;
}

function fillsOf(s: Shape): Props[] {
  if (s.fills?.length) {
    // Design lista de cima para baixo; o FigCraft, de baixo para cima
    return [...s.fills].reverse().map(paintOf).filter(Boolean) as Props[];
  }
  if (!s.fill || s.fill === 'none' || s.fill === 'transparent') return [];
  return [{ type: 'solid', color: hex8(s.fill), opacity: 1 }];
}

function strokesOf(s: Shape): { paints: Props[]; weight: number } {
  if (s.strokes?.length) {
    const vis = s.strokes.filter((x) => x.visible !== false);
    return { paints: vis.map((x) => ({ type: 'solid', color: hex8(x.color), opacity: x.opacity ?? 1 })), weight: s.strokeWidth || vis[0]?.width || 1 };
  }
  if (s.stroke && s.stroke !== 'none' && s.strokeWidth > 0) return { paints: [{ type: 'solid', color: hex8(s.stroke), opacity: 1 }], weight: s.strokeWidth };
  return { paints: [], weight: 0 };
}

function effectsOf(list?: EffectItem[], soft = false): Props[] {
  void list;
  void soft;
  // Efeitos de blur/sombra/noise no vello_cpu rasterizam o frame/card em um bitmap intermediario em cache (retained.rs),
  // deixando textos e vetores internos embacados dependendo do nivel de zoom (alem da diretriz de nao usar sombras em cards/componentes).
  return [];
}

/** Auto layout nativo do FigCraft: cada frame com auto layout no Design vira auto layout real (um frame que não reproduz o layout do Design volta às posições dele: ver `verify`). */
const NATIVE_AUTO_LAYOUT = true;

const isSingleLine = (s: Shape) => s.type === 'text' && !String(s.text ?? '').includes('\n') && s.height <= (s.fontSize || 16) * 1.9;

const SUPPORTED = new Set(['frame', 'section', 'group', 'rect', 'ellipse', 'line', 'arrow', 'polygon', 'star', 'text', 'image', 'path', 'pen', 'pencil']);

const lineHeightOf = (v: unknown): unknown => {
  if (typeof v === 'number') return v < 4 ? `${Math.round(v * 100)}%` : v; // multiplicador -> %, senão px
  if (v == null || v === '' || v === 'auto') return undefined;
  if (typeof v === 'string') return v.trim().endsWith('%') ? v.trim() : Number.isFinite(parseFloat(v)) ? lineHeightOf(parseFloat(v)) : undefined;
  return undefined;
};

/** Eixos principal/cruzado do auto layout a partir do alinhamento em 9 posições do Design. */
function alignOf(flow: string | undefined, a: string | undefined): { main: string; cross: string } {
  const v = a === 'top-left' || a === 'top-center' || a === 'top-right' ? 'min' : a === 'bottom-left' || a === 'bottom-center' || a === 'bottom-right' ? 'max' : 'center';
  const h = a === 'top-left' || a === 'left' || a === 'bottom-left' ? 'min' : a === 'top-right' || a === 'right' || a === 'bottom-right' ? 'max' : 'center';
  if (!a) return { main: 'min', cross: 'min' };
  return flow === 'horizontal' ? { main: h, cross: v } : { main: v, cross: h };
}

const TYPE_OF: Record<string, string> = { frame: 'frame', section: 'frame', group: 'frame', rect: 'rectangle', ellipse: 'ellipse', line: 'line', arrow: 'line', polygon: 'polygon', star: 'star', text: 'text', path: 'vector', pen: 'vector', pencil: 'vector', image: 'rectangle' };

/**
 * Espelha shapes do Design no documento do FigCraft: cria o que é novo, ajusta o que mudou, apaga o que sumiu.
 * É por aqui que o gerador de telas do Design (que produz Shape[]) desenha no Design 2.
 */
export class FcSync {
  private map = new Map<string, number>();
  private last = new Map<string, Record<string, string>>();
  private kind = new Map<string, string>();
  /** ícone/vetor: o FigCraft guarda o vetor dentro de um quadro do tamanho do ícone (o vetor tem o tamanho real do desenho, menor que a caixa de 24px) */
  private vecChild = new Map<string, number>();
  /** componentes da biblioteca: nome (minúsculo) -> id do componente (ou do conjunto de variantes) no FigCraft */
  private comps = new Map<string, number>();
  /** shapes que o FigCraft desenha como instância (raiz) ou que viraram o componente principal */
  private opaque = new Set<string>();
  /** camadas que agora vivem dentro do componente principal (não são mais sincronizadas com a tela) */
  private frozen = new Set<string>();
  private libId: number | undefined;
  /** catálogo de ícones (para as variantes de ícone dos componentes) */
  icons?: IconCatalog;
  private busy = false;
  private pending: Shape[] | null = null;
  private waiters: Array<() => void> = [];
  /**
   * Esquece tudo o que sincronizou (cada pedido da IA começa do zero): senão as camadas de pedidos anteriores, que não estão na
   * lista do pedido novo, seriam apagadas como "sumiram".
   */
  reset(): void {
    this.map.clear();
    this.last.clear();
    this.kind.clear();
    this.vecChild.clear();
    this.comps.clear();
    this.opaque.clear();
    this.frozen.clear();
    this.libId = undefined;
    this.adopting = false;
    this.adoptList = [];
    this.pending = null;
  }
  /** id do FigCraft de cada shape (para quem precisar selecionar ou enquadrar) */
  idOf = (shapeId: string) => this.map.get(shapeId);
  /** onde aplicar a cor (preenchimento) de um shape: o vetor dentro do quadro do ícone, ou o próprio nó */
  paintId = (shapeId: string) => this.vecChild.get(shapeId) ?? this.map.get(shapeId);
  constructor(private call: FigcraftCall, private opts: { onError?: (e: unknown) => void } = {}) {}

  private async exec(command: string, params: Props): Promise<any> {
    try {
      return await this.call('engine.execute', { command, params });
    } catch (e: any) {
      // propriedade desconhecida não derruba o design: remove e tenta de novo
      const bad = /unknown properties: ([^(]+)\(known/.exec(String(e?.message))?.[1].split(',').map((x) => x.trim()).filter(Boolean);
      if (bad?.length && params.props) {
        const props = { ...(params.props as Props) };
        for (const k of bad) delete props[k];
        return this.call('engine.execute', { command, params: { ...params, props } });
      }
      throw e;
    }
  }

  /** Sincroniza o estado mais recente; chamadas durante uma sincronização se fundem na seguinte. */
  sync(shapes: Shape[]): Promise<void> {
    this.pending = shapes;
    if (this.busy) return new Promise((r) => this.waiters.push(r));
    this.busy = true;
    return (async () => {
      try {
        while (this.pending) {
          const cur = this.pending;
          this.pending = null;
          await this.run(cur).catch((e) => this.opts.onError?.(e));
          const w = this.waiters.splice(0);
          if (!this.pending) w.forEach((r) => r());
          else this.waiters.push(...w);
        }
      } finally {
        this.busy = false;
        this.waiters.splice(0).forEach((r) => r());
      }
    })();
  }

  /**
   * Texto que o Design mediu em UMA linha mas que a fonte real do FigCraft quebrou em duas ("Debit card" -> "Debit / card"):
   * passa a ajustar a largura ao conteúdo (sem quebrar), e o de caixa fixa é recentrado/realinhado pelo novo tamanho.
   */
  async fixTextWrap(shapes: Shape[]): Promise<number> {
    const d = await this.call('document.inspect', { depth: 20 });
    const page = (d.pages || []).find((p: any) => p.id === d.currentPage) || d.pages?.[0];
    const bounds = new Map<number, { width: number; height: number }>();
    const walk = (n: any) => { if (n.absoluteBounds) bounds.set(n.id, n.absoluteBounds); (n.children || []).forEach(walk); };
    (page?.children || []).forEach(walk);
    const byId = new Map(shapes.map((x) => [x.id, x]));
    let fixed = 0;
    for (const t of shapes) {
      if (t.type !== 'text' || !this.map.has(t.id) || this.frozen.has(t.id) || !isSingleLine(t) || t.textResize === 'auto-width') continue;
      const id = this.map.get(t.id)!;
      const b = bounds.get(id);
      if (!b || b.height < (t.fontSize || 16) * 1.55 * 1.45) continue; // cabe em uma linha
      const parent = t.parentId ? byId.get(t.parentId) : undefined;
      const flow = NATIVE_AUTO_LAYOUT && !!parent && !!parent.hasAutoLayout && parent.layoutFlow !== 'freeform' && !t.layoutAbsolute;
      await this.exec('node.set', { ids: [id], props: { textAutoResize: 'widthAndHeight', ...(flow ? { sizingH: 'hug' } : {}) } }).catch(() => {});
      if (!flow && parent) {
        const nd = await this.call('node.get', { id, depth: 0 }).catch(() => null);
        const w = nd?.width;
        if (w) {
          const k = t.textAlign === 'center' ? 0.5 : t.textAlign === 'right' ? 1 : 0;
          await this.exec('node.set', { ids: [id], props: { x: Math.round(t.x - parent.x + (t.width - w) * k) } }).catch(() => {});
        }
      }
      fixed++;
    }
    return fixed;
  }

  /**
   * Confere se o auto layout do FigCraft reproduziu o layout do Design: o frame cujos filhos ficaram a mais de 8px de onde o
   * Design os pôs perde o auto layout e os filhos voltam às posições e tamanhos do Design. Devolve quantos frames voltaram.
   */
  async verify(shapes: Shape[]): Promise<number> {
    const d = await this.call('document.inspect', { depth: 20 });
    const page = (d.pages || []).find((p: any) => p.id === d.currentPage) || d.pages?.[0];
    const bounds = new Map<number, { x: number; y: number; width: number; height: number }>();
    const walk = (n: any) => { if (n.absoluteBounds) bounds.set(n.id, n.absoluteBounds); (n.children || []).forEach(walk); };
    (page?.children || []).forEach(walk);
    const byId = new Map(shapes.map((s) => [s.id, s]));
    const kids = new Map<string, Shape[]>();
    for (const s of shapes) if (s.parentId) kids.set(s.parentId, [...(kids.get(s.parentId) || []), s]);
    const depth = (s: Shape): number => { let n = 0; let c: Shape | undefined = s; while (c?.parentId && byId.get(c.parentId) && n < 40) { c = byId.get(c.parentId); n++; } return n; };
    const frames = shapes.filter((s) => s.hasAutoLayout && this.map.has(s.id) && !this.opaque.has(s.id) && !this.frozen.has(s.id) && (kids.get(s.id) || []).length).sort((a, b) => depth(a) - depth(b));
    let fixed = 0;
    for (const f of frames) {
      const fcF = this.map.get(f.id)!;
      const fb = bounds.get(fcF);
      let worst = 0;
      for (const c of kids.get(f.id) || []) {
        const id = this.map.get(c.id), b = id !== undefined ? bounds.get(id) : undefined;
        if (!b || c.layoutAbsolute || !SUPPORTED.has(c.type) || c.type === 'path' || c.type === 'pen' || c.type === 'pencil') continue;
        worst = Math.max(worst, Math.abs(b.x - c.x), Math.abs(b.y - c.y), Math.abs(b.width - c.width) * (c.type === 'text' ? 0.3 : 1), Math.abs(b.height - c.height) * (c.type === 'text' ? 0.3 : 1));
      }
      if (fb) worst = Math.max(worst, Math.abs(fb.width - f.width) * 0.5);
      if (worst <= 8) continue;
      // volta às posições do Design
      await this.exec('node.set', { ids: [fcF], props: { layout: 'none', width: Math.round(f.width), height: Math.round(f.height) } }).catch(() => {});
      for (const c of kids.get(f.id) || []) {
        const id = this.map.get(c.id);
        if (id === undefined || !SUPPORTED.has(c.type)) continue;
        const isText = c.type === 'text';
        if (c.type === 'path' || c.type === 'pen' || c.type === 'pencil') { await this.exec('node.set', { ids: [id], props: { sizingH: 'fixed', sizingV: 'fixed', x: Math.round(c.x - f.x), y: Math.round(c.y - f.y) } }).catch(() => {}); continue; }
        const wide = isText && isSingleLine(c) && c.textResize !== 'auto-width';
        const w = wide ? Math.ceil(c.width * 1.12) + 2 : Math.round(c.width);
        const sx = wide ? (c.textAlign === 'center' ? -(w - c.width) / 2 : c.textAlign === 'right' ? -(w - c.width) : 0) : 0;
        await this.exec('node.set', { ids: [id], props: { sizingH: 'fixed', sizingV: 'fixed', ...(isText ? { textAutoResize: 'none' } : {}), x: Math.round(c.x - f.x + sx), y: Math.round(c.y - f.y), width: w, height: Math.round(c.height) } }).catch(() => {});
      }
      fixed++;
    }
    return fixed;
  }


  // ---------------------------------------------------------------- componentes reutilizáveis

  private cmd(command: string, params: Props = {}): Promise<any> {
    return this.call('engine.execute', { command, params });
  }

  /** O quadro "Componentes" (à esquerda das telas) onde ficam os componentes principais. */
  private async libFrame(): Promise<number | undefined> {
    if (this.libId !== undefined) return this.libId;
    const d = await this.call('document.inspect', { depth: 1 }).catch(() => null);
    const page = (d?.pages || []).find((p: any) => p.id === d?.currentPage) || d?.pages?.[0];
    const kids: any[] = page?.children || [];
    const found = kids.find((c) => c.name === 'Componentes' && String(c.type).toLowerCase() === 'frame');
    if (found) return (this.libId = found.id);
    const x = kids.length ? Math.min(...kids.map((c) => Number(c.x) || 0)) - 760 : 0;
    const r = await this.cmd('node.create', { type: 'frame', x, y: 0, width: 200, height: 200, select: false, props: { name: 'Componentes', layout: 'vertical', gap: 40, paddingTop: 40, paddingRight: 40, paddingBottom: 40, paddingLeft: 40, sizingH: 'hug', sizingV: 'hug', fills: [], clip: false } }).catch(() => null);
    return (this.libId = r?.id);
  }

  private descendants(root: Shape, shapes: Shape[]): Shape[] {
    const kids = new Map<string, Shape[]>();
    for (const x of shapes) if (x.parentId) kids.set(x.parentId, [...(kids.get(x.parentId) || []), x]);
    const out: Shape[] = [];
    const walk = (id: string) => { for (const c of kids.get(id) || []) { out.push(c); walk(c.id); } };
    walk(root.id);
    return out;
  }

  /** Id do componente no FigCraft: o que já existe no documento, ou o definidor da tela promovido a componente. */
  private async resolveComponent(name: string, shapes: Shape[]): Promise<number | undefined> {
    const key = name.toLowerCase();
    if (this.comps.has(key)) return this.comps.get(key);
    const list: any[] = (await this.cmd('component.list').catch(() => null)) || [];
    const hit = list.find((c) => String(c.name).toLowerCase() === key && (c.type === 'COMPONENT_SET' || (c.type === 'COMPONENT' && !String(c.name).includes('='))));
    if (hit) { this.comps.set(key, hit.id); return hit.id; }
    const def = shapes.find((x) => x.fcDef?.toLowerCase() === key);
    return def ? this.promote(def, shapes) : undefined;
  }

  /** O definidor (frame já desenhado na tela) vira o componente principal, guardado em "Componentes"; no lugar dele fica uma instância. */
  private async promote(def: Shape, shapes: Shape[]): Promise<number | undefined> {
    const d = this.map.get(def.id);
    if (d === undefined || !def.fcDef) return undefined;
    const kids = this.descendants(def, shapes).filter((x) => SUPPORTED.has(x.type));
    if (kids.some((x) => !this.map.has(x.id))) return undefined; // ainda sendo montado
    const byId = new Map(shapes.map((x) => [x.id, x]));
    let par = def.parentId ? byId.get(def.parentId) : undefined;
    while (par && !SUPPORTED.has(par.type)) par = par.parentId ? byId.get(par.parentId) : undefined;
    const parentFc = par ? this.map.get(par.id) : undefined;
    const nd = await this.call('node.get', { id: d, depth: 0 }).catch(() => null);
    const lib = await this.libFrame();
    if (!nd || lib === undefined) return undefined;
    const sibs = shapes.filter((x) => (x.parentId ? byId.get(x.parentId) : undefined) === par && x.id !== def.id).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = sibs.filter((x) => (x.zIndex ?? 0) < (def.zIndex ?? 0) && this.map.has(x.id)).length;
    const W = Math.round(nd.width), H = Math.round(nd.height);
    const sz = nd.sizing || {};
    try {
      await this.cmd('component.create', { ids: [d] });
      await this.cmd('node.set', { ids: [d], props: { name: def.fcDef, sizingH: 'fixed', sizingV: 'fixed', width: W, height: H } }).catch(() => {});
      await this.cmd('node.reparent', { ids: [d], parent: lib });
      this.comps.set(def.fcDef.toLowerCase(), d);
      if (parentFc !== undefined) {
        const r = await this.cmd('instance.create', { component: d, parent: parentFc });
        const inst = r?.id;
        if (inst !== undefined) {
          await this.cmd('node.reparent', { ids: [inst], parent: parentFc, index: idx }).catch(() => {});
          const set: Props = { name: def.fcDef };
          if (sz.horizontal === 'fill' || sz.horizontal === 'hug') set.sizingH = sz.horizontal; else { set.sizingH = 'fixed'; set.width = W; }
          if (sz.vertical === 'fill' || sz.vertical === 'hug') set.sizingV = sz.vertical; else { set.sizingV = 'fixed'; set.height = H; }
          if (!(par && (par.hasAutoLayout && par.layoutFlow !== 'freeform') && !def.layoutAbsolute)) { set.x = Math.round(nd.x ?? 0); set.y = Math.round(nd.y ?? 0); }
          await this.cmd('node.set', { ids: [inst], props: set }).catch(() => {});
          this.map.set(def.id, inst);
        }
      }
      this.opaque.add(def.id);
      for (const k of kids) this.frozen.add(k.id);
      return d;
    } catch (e) {
      this.opts.onError?.(e);
      return undefined;
    }
  }

  /** Torna reutilizáveis todos os componentes declarados pela IA que ninguém usou ainda (a biblioteca do projeto os oferece nas próximas telas). */
  async promoteAll(shapes: Shape[]): Promise<number> {
    let n = 0;
    for (const def of shapes.filter((x) => x.fcDef && !this.opaque.has(x.id))) {
      if (this.comps.has(def.fcDef!.toLowerCase())) continue;
      if ((await this.resolveComponent(def.fcDef!, shapes).catch(() => undefined)) !== undefined) n++;
    }
    return n;
  }

  /** Quadros de ícone (um quadro com um vetor) do componente, na ordem em que aparecem. */
  private iconFrames(node: any, out: any[] = []): any[] {
    const kids: any[] = node?.children || [];
    if (String(node?.type).toUpperCase() === 'FRAME' && kids.length === 1 && String(kids[0].type).toUpperCase() === 'VECTOR') out.push(node);
    else for (const c of kids) this.iconFrames(c, out);
    return out;
  }

  /**
   * O estado "ícones X" do componente: uma variante da propriedade "Ícone" cujo valor lista o ícone de cada quadro de ícone ("Home+Mail").
   * Devolve o id do conjunto e o valor, ou null se não der (nenhum ícone casa, ícone desconhecido, erro do FigCraft).
   */
  private async iconVariant(compId: number, swaps: Array<[string, string]>): Promise<{ set: number; value: string } | null> {
    const norm = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const want = new Map(swaps.map(([k, v]) => [norm(k), v]));
    // os ícones do componente: lidos da variante padrão (compId pode ser o conjunto, que reúne as variantes todas)
    const props0 = await this.cmd('component.properties', { id: compId }).catch(() => null);
    const tree = await this.call('node.get', { id: props0?.component ?? compId, depth: 8 }).catch(() => null);
    const frames = this.iconFrames(tree);
    const orig = frames.map((f) => String(f.name));
    const target: string[] = [];
    let changed = false;
    for (const n of orig) {
      const raw = want.get(norm(n));
      const to = raw && this.icons ? resolveIconName(this.icons, raw) : null;
      if (raw && !to) return null;
      target.push(to || n);
      if (to && to !== n) changed = true;
    }
    if (!changed) return null;
    const value = target.join('+');
    let setId = compId;
    let props = await this.cmd('component.properties', { id: setId }).catch(() => null);
    if (!props) return null;
    if (!props.set) {
      const r = await this.cmd('component.combineVariants', { ids: [compId] }).catch(() => null);
      if (r?.id === undefined) return null;
      setId = r.id;
      props = await this.cmd('component.properties', { id: setId }).catch(() => null);
      const first = (props?.properties || []).find((p: any) => p.type === 'variant');
      if (!first) return null;
      await this.cmd('component.editProperty', { id: setId, name: first.name, newName: 'Ícone' }).catch(() => {});
      await this.cmd('component.editProperty', { id: setId, name: 'Ícone', value: first.default, newValue: orig.join('+') }).catch(() => {});
      props = await this.cmd('component.properties', { id: setId }).catch(() => null);
    } else setId = props.set;
    const prop = (props?.properties || []).find((p: any) => p.name === 'Ícone' && p.type === 'variant');
    if (!prop || props.component === undefined) return null;
    if (!(prop.options || []).includes(value)) {
      // sempre a partir da variante original (a que tem os ícones do componente), não da última criada
      const setTree = await this.call('node.get', { id: setId, depth: 1 }).catch(() => null);
      const base = (setTree?.children || []).find((c: any) => c.name === `Ícone=${orig.join('+')}`)?.id ?? props.component;
      const nv = await this.cmd('component.addVariant', { id: base, property: 'Ícone', value }).catch(() => null);
      if (nv?.id === undefined) return null;
      const discard = async () => { await this.cmd('edit.delete', { ids: [nv.id] }).catch(() => {}); return null; };
      const vtree = await this.call('node.get', { id: nv.id, depth: 8 }).catch(() => null);
      const vframes = this.iconFrames(vtree);
      if (vframes.length !== frames.length) return discard();
      for (const [i, fr] of vframes.entries()) {
        if (target[i] === orig[i] || !this.icons?.[target[i]]) continue;
        const old = await this.call('node.get', { id: fr.children[0].id, depth: 0 }).catch(() => null);
        const w = Number(fr.width) || 24, h = Number(fr.height) || 24;
        await this.cmd('edit.delete', { ids: [fr.children[0].id] }).catch(() => {});
        const vec = await this.cmd('node.create', { type: 'vector', parent: fr.id, x: 0, y: 0, path: this.icons[target[i]], pathScale: [w / 24, h / 24], closed: true, select: false, props: { name: 'Ícone', fills: old?.fills?.length ? old.fills : [{ type: 'solid', color: '#000000', opacity: 1 }] } }).catch(() => null);
        if (vec?.id === undefined) return discard();
        await this.cmd('node.set', { ids: [fr.id], props: { name: target[i] } }).catch(() => {});
      }
    }
    return { set: setId, value };
  }

  /** Troca os textos de uma instância (a chave é o nome ou o conteúdo original da camada de texto). */
  private async applyTexts(inst: number, texts?: Record<string, string>): Promise<void> {
    const list = Object.entries(texts || {});
    if (!list.length) return;
    const tree = await this.call('node.get', { id: inst, depth: 12 }).catch(() => null);
    const nodes: any[] = [];
    const walk = (n: any) => { if (String(n?.type).toUpperCase() === 'TEXT') nodes.push(n); (n?.children || []).forEach(walk); };
    walk(tree);
    for (const [key, val] of list) {
      for (const n of nodes.filter((x) => x.name === key || x.characters === key)) await this.cmd('node.set', { ids: [n.id], props: { characters: String(val) } }).catch(() => {});
    }
  }

  /** Cria a instância de um componente no lugar do shape raiz (com textos e ícone trocados). Undefined = não deu: o chamador desenha as camadas comuns. */
  private async makeInstance(s: Shape, shapes: Shape[], parentFc: number | undefined, pos: { x: number; y: number } | undefined, props: Props, box: { w: number; h: number }, below: number): Promise<number | undefined> {
    const info = s.fcInst;
    if (!info) return undefined;
    let comp = await this.resolveComponent(info.name, shapes);
    if (comp === undefined) return undefined;
    const swaps = Object.entries(info.icon || {});
    let variant: string | undefined;
    if (swaps.length) {
      const v = await this.iconVariant(comp, swaps);
      if (!v) return undefined;
      comp = v.set;
      this.comps.set(info.name.toLowerCase(), v.set);
      variant = v.value;
    }
    const r = await this.cmd('instance.create', { component: comp, ...(parentFc !== undefined ? { parent: parentFc } : {}), ...(pos ?? {}) }).catch(() => null);
    const id: number | undefined = r?.id;
    if (id === undefined) return undefined;
    const set: Props = { name: props.name };
    for (const k of ['opacity', 'visible', 'absolute']) if (props[k] !== undefined) set[k] = props[k];
    if (props.sizingH === 'fill' || props.sizingH === 'hug') set.sizingH = props.sizingH; else if (box.w > 1) { set.sizingH = 'fixed'; set.width = box.w; }
    if (props.sizingV === 'fill' || props.sizingV === 'hug') set.sizingV = props.sizingV; else if (box.h > 1) { set.sizingV = 'fixed'; set.height = box.h; }
    await this.cmd('node.set', { ids: [id], props: set }).catch(() => {});
    if (variant) await this.cmd('instance.setProperties', { ids: [id], properties: { 'Ícone': variant } }).catch(() => {});
    await this.applyTexts(id, info.text);
    // a instância nasce por cima de tudo: volta ao lugar dela na pilha de camadas
    if (below >= 0) {
      await this.cmd('arrange.back', { ids: [id] }).catch(() => {});
      for (let i = 0; i < below; i++) await this.cmd('arrange.forward', { ids: [id] }).catch(() => {});
    }
    return id;
  }

  private propsOf(s: Shape, parent: Shape | undefined, parentAuto: boolean, selfAuto: boolean, absChild = false): Props {
    const p: Props = { name: s.name || s.type };
    if (s.opacity !== undefined && s.opacity < 1) p.opacity = s.opacity;
    if (s.visible === false) p.visible = false;
    if (s.rotation) p.rotation = s.rotation;
    if (s.blendMode && s.blendMode !== 'normal') p.blend = s.blendMode;
    const isText = s.type === 'text';
    const fills = s.type === 'image' && !s.imageUrl ? [{ type: 'solid', color: '#E5E7EB', opacity: 1 }] : fillsOf(s);
    if (s.type !== 'image' || !s.imageUrl) p.fills = fills;
    if (!isText) {
      const st = strokesOf(s);
      p.strokes = st.paints;
      if (st.paints.length) {
        p.strokeWeight = st.weight;
        p.strokeAlign = s.strokePosition || 'inside';
        if (s.strokeStyle === 'dashed') p.dashes = [s.strokeDash ?? 6, s.strokeGap ?? 4];
      }
    }
    if (s.independentCorners) {
      p.topLeftRadius = s.topLeftRadius ?? 0; p.topRightRadius = s.topRightRadius ?? 0; p.bottomRightRadius = s.bottomRightRadius ?? 0; p.bottomLeftRadius = s.bottomLeftRadius ?? 0;
    } else if (s.cornerRadius !== undefined && s.type !== 'ellipse') p.cornerRadius = s.cornerRadius;
    if (s.type === 'ellipse' && (s.arcStart !== undefined || s.arcEnd !== undefined)) {
      p.arcStart = s.arcStart ?? 0;
      p.arcSweep = (s.arcEnd ?? 360) - (s.arcStart ?? 0);
      p.arcInner = s.arcInner ?? 0;
    }
    const fx = effectsOf(s.effects, (s.fills || []).some((f) => f.visible !== false && !!f.type && f.type !== 'solid' && f.type !== 'image'));
    if (fx.length) p.effects = fx;
    if (s.type === 'frame' || s.type === 'section' || s.type === 'group') {
      p.clip = s.type === 'group' ? false : !!s.clipContent;
      if (s.type === 'group' && !fills.length) p.fills = [];
      if (selfAuto) {
        const flow = s.layoutFlow === 'horizontal' ? 'horizontal' : s.layoutFlow === 'grid' ? 'grid' : 'vertical';
        p.layout = flow;
        p.gap = s.layoutGap ?? 0;
        const pad = (k: 'Top' | 'Right' | 'Bottom' | 'Left') => (s as any)[`padding${k}`] ?? (k === 'Top' || k === 'Bottom' ? s.paddingVertical : s.paddingHorizontal) ?? 0;
        p.paddingTop = pad('Top'); p.paddingRight = pad('Right'); p.paddingBottom = pad('Bottom'); p.paddingLeft = pad('Left');
        const al = alignOf(flow, s.layoutAlign);
        p.mainAlign = s.layoutGapAuto ? 'spaceBetween' : al.main;
        p.crossAlign = al.cross;
        if (flow === 'grid') p.gridColumns = s.gridCols ?? 3;
        if (s.layoutCounterGap !== undefined) p.crossGap = s.layoutCounterGap;
      }
    }
    if (isText) {
      // glifos que as fontes embutidas não têm viram a seta equivalente (senão aparece um quadrado)
      p.characters = (s.text ?? '').replace(/[⇆⇄⇅]/g, '↔');
      p.fontFamily = family(s.fontFamily);
      if (s.fontSize) p.fontSize = s.fontSize;
      p.fontWeight = Math.min(700, Math.max(400, Number(s.fontWeight) || (s.fontWeight === 'bold' ? 700 : 400)));
      const lh = lineHeightOf(s.lineHeight);
      if (lh !== undefined) p.lineHeight = lh;
      if (s.letterSpacing !== undefined && s.letterSpacing !== '') p.letterSpacing = s.letterSpacing;
      p.textAlign = s.textAlign === 'justify' ? 'justified' : s.textAlign || 'left';
      if (s.textAlignVertical) p.textAlignVertical = s.textAlignVertical;
      if (s.textDecoration && s.textDecoration !== 'none') p.textDecoration = s.textDecoration === 'line-through' ? 'strikethrough' : 'underline';
      if (s.textCase && s.textCase !== 'none') p.textCase = s.textCase === 'uppercase' ? 'upper' : s.textCase === 'lowercase' ? 'lower' : s.textCase === 'title' ? 'title' : undefined;
      // caixa fixa, como no Design (a de uma linha ganha folga em create/run para a fonte do FigCraft não quebrar a linha)
      p.textAutoResize = parentAuto
        ? (s.widthMode === 'hug' || s.textResize === 'auto-width' ? 'widthAndHeight' : 'height')
        : (s.textResize === 'auto-width' ? 'widthAndHeight' : 'none');
    }
    // dentro de um auto layout o filho segue o fluxo (sem x/y), salvo se for "absoluto"
    if (parentAuto && !s.layoutAbsolute) {
      const wm = s.widthMode || 'fixed', hm = s.heightMode || 'fixed';
      p.sizingH = isText && p.textAutoResize === 'widthAndHeight' && wm !== 'fill' ? 'hug' : wm;
      p.sizingV = isText ? 'hug' : hm;
    } else if (selfAuto) {
      p.sizingH = s.widthMode || 'fixed'; p.sizingV = s.heightMode || 'fixed';
    }
    if (s.minW !== undefined) p.minWidth = s.minW;
    if (s.maxW !== undefined) p.maxWidth = s.maxW;
    if (s.minH !== undefined) p.minHeight = s.minH;
    if (s.maxH !== undefined) p.maxHeight = s.maxH;
    // selo/etiqueta sobreposto (fica na borda do botão): fora do fluxo do auto layout do pai, na posição x/y
    if (absChild) p.absolute = true;
    if (s.type === 'polygon' && s.polygonSides) p.pointCount = s.polygonSides;
    if (s.type === 'star') { if (s.starPoints) p.pointCount = s.starPoints; if (s.starInnerRatio !== undefined) p.innerRadius = s.starInnerRatio; }
    void parent;
    return p;
  }

  /** Registra shapes que vieram do próprio FigCraft (id `fc:<id>`): daí em diante só o que mudar é enviado. */
  adopt(shapes: Shape[]): void {
    this.adopting = true;
    this.adoptList = shapes;
  }
  private adopting = false;
  private adoptList: Shape[] = [];

  private async run(shapes: Shape[]): Promise<void> {
    if (this.adopting) {
      this.adopting = false;
      const list = this.adoptList;
      this.adoptList = [];
      await this.runInner(list, true);
    }
    return this.runInner(shapes, false);
  }

  private async runInner(shapes: Shape[], adoptOnly: boolean): Promise<void> {
    const byId = new Map(shapes.map((s) => [s.id, s]));
    const depth = (s: Shape): number => { let d = 0; let c: Shape | undefined = s; while (c?.parentId && byId.get(c.parentId) && d < 40) { c = byId.get(c.parentId); d++; } return d; };
    const mappable = shapes.filter((s) => SUPPORTED.has(s.type));
    const ordered = [...mappable].map((s, i) => ({ s, i, d: depth(s) })).sort((a, b) => a.d - b.d || a.i - b.i).map((x) => x.s);
    // pais não suportados: sobe até um suporte
    const parentOf = (s: Shape): Shape | undefined => { let c = s.parentId ? byId.get(s.parentId) : undefined; while (c && !SUPPORTED.has(c.type)) c = c.parentId ? byId.get(c.parentId) : undefined; return c; };
    const isAuto = (s?: Shape) => NATIVE_AUTO_LAYOUT && !!s && (s.type === 'frame' || s.type === 'section' || s.type === 'group') && !!s.hasAutoLayout && s.layoutFlow !== 'freeform';

    // o que sumiu (e o que trocou de tipo, como a foto que chega depois do placeholder)
    const alive = new Set(ordered.map((s) => s.id));
    const gone = adoptOnly ? [] : [...this.map.keys()].filter((id) => !alive.has(id));
    for (const s of ordered) {
      const k = s.type === 'image' && s.imageUrl ? 'image+' : s.type;
      if (this.map.has(s.id) && this.kind.get(s.id) !== k && (this.kind.get(s.id) === 'image' || k === 'image+')) gone.push(s.id);
    }
    // apagar um pai leva os filhos: só apaga a raiz de cada grupo removido
    const goneSet = new Set(gone);
    const roots = gone.filter((id) => { const sh = byId.get(id); const p = sh ? parentOf(sh) : undefined; return !p || !goneSet.has(p.id); });
    const delIds = roots.map((id) => this.map.get(id)!).filter((x) => x !== undefined);
    for (const id of gone) { this.map.delete(id); this.last.delete(id); this.kind.delete(id); }
    if (delIds.length) await this.exec('edit.delete', { ids: delIds }).catch(() => {});

    const kidsOf = new Map<string, Shape[]>();
    for (const x of ordered) { const pp = parentOf(x)?.id ?? ''; kidsOf.set(pp, [...(kidsOf.get(pp) || []), x]); }
    for (const [k, list] of kidsOf) kidsOf.set(k, [...list].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)));
    const doShape = async (s: Shape): Promise<void> => {
      const parent = parentOf(s);
      const parentFc = parent ? this.map.get(parent.id) : undefined;
      if (parent && parentFc === undefined && !(adoptOnly && s.id.startsWith('fc:'))) return; // pai ainda não existe
      const parentAuto = isAuto(parent);
      const props = this.propsOf(s, parent, parentAuto && !s.layoutAbsolute, isAuto(s), parentAuto && !!s.layoutAbsolute);
      const sig: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) sig[k] = JSON.stringify(v);
      const box = { w: Math.max(1, Math.round(s.width)), h: Math.max(1, Math.round(s.height)) };
      let shiftX = 0;
      const flowChild = parentAuto && !s.layoutAbsolute;
      if (!flowChild && isSingleLine(s) && s.textResize !== 'auto-width') {
        const w2 = Math.ceil(box.w * 1.12) + 2;
        shiftX = s.textAlign === 'center' ? -(w2 - box.w) / 2 : s.textAlign === 'right' ? -(w2 - box.w) : 0;
        box.w = w2;
      }
      sig.__w = String(box.w); sig.__h = String(box.h);
      const rx = Math.round(s.x - (parent?.x ?? 0) + shiftX), ry = Math.round(s.y - (parent?.y ?? 0));
      sig.__x = flowChild ? '' : String(rx); sig.__y = flowChild ? '' : String(ry);
      if (adoptOnly) {
        const n = s.id.startsWith('fc:') ? Number(s.id.slice(3)) : undefined;
        if (n !== undefined) { this.map.set(s.id, n); this.last.set(s.id, sig); this.kind.set(s.id, s.type === 'image' && s.imageUrl ? 'image+' : s.type); }
        return;
      }
      const fcId = this.map.get(s.id);
      if (fcId === undefined) {
        if (s.id.startsWith('fc:')) return;
        const sibs = kidsOf.get(parent?.id ?? '') || [];
        const below = sibs.slice(0, sibs.indexOf(s)).filter((x) => this.map.has(x.id)).length;
        const created = await this.create(s, props, parentFc, flowChild ? undefined : { x: rx, y: ry }, box, below);
        if (created === undefined) return;
        this.map.set(s.id, created);
        this.last.set(s.id, sig);
        this.kind.set(s.id, s.type === 'image' && s.imageUrl ? 'image+' : s.type);
        return;
      }
      const prev = this.last.get(s.id) || {};
      const changed: Props = {};
      for (const k of Object.keys(props)) if (prev[k] !== sig[k]) changed[k] = props[k];
      const isVec = this.vecChild.has(s.id);
      if (isVec) {
        // cor do ícone vai para o vetor de dentro; o quadro só cuida do layout
        const paint: Props = {};
        for (const k of ['fills', 'strokes', 'strokeWeight', 'strokeAlign']) if (k in changed) { paint[k] = changed[k]; delete changed[k]; }
        if (Object.keys(paint).length) await this.exec('node.set', { ids: [this.vecChild.get(s.id)!], props: paint }).catch((e) => this.opts.onError?.(e));
      }
      const autoW = props.textAutoResize === 'widthAndHeight' || props.sizingH === 'fill' || props.sizingH === 'hug';
      const autoH = props.textAutoResize === 'widthAndHeight' || props.textAutoResize === 'height' || props.sizingV === 'fill' || props.sizingV === 'hug';
      if (prev.__w !== sig.__w && !autoW) changed.width = box.w;
      if (prev.__h !== sig.__h && !autoH) changed.height = box.h;
      if (isVec) { /* o quadro do ícone muda de tamanho sem esticar o vetor de dentro (ele fica centrado pelo tamanho natural) */ }
      if (!flowChild && (prev.__x !== sig.__x || prev.__y !== sig.__y)) { changed.x = rx; changed.y = ry; }
      if (Object.keys(changed).length) {
        await this.exec('node.set', { ids: [fcId], props: changed }).catch((e) => this.opts.onError?.(e));
      }
      this.last.set(s.id, sig);
    };
    const instPart = (s: Shape) => !!(s.fcInst || s.fcInside) && !this.map.has(s.id);
    const skip = (s: Shape) => this.frozen.has(s.id) || this.opaque.has(s.id) || (!!s.fcInside && this.opaque.has(s.fcInside));
    for (const s of ordered) if (!instPart(s) && !skip(s)) await doShape(s);
    if (adoptOnly) return;
    // instâncias de componentes depois de tudo (o componente principal precisa estar inteiro): instância de verdade, ou, sem componente, as camadas comuns
    for (const s of ordered) {
      if (!instPart(s) || skip(s)) continue;
      if (s.fcInst) {
        if ((await this.resolveComponent(s.fcInst.name, shapes)) === undefined) {
          // o componente não existe mais neste documento (apagado, ou outro arquivo): esta instância é desenhada como camadas e,
          // se não trocou ícones, vira o componente (com os textos de volta ao original; os desta instância ficam como override)
          await doShape(s);
          if (!this.map.has(s.id)) continue; // pai ainda não existe: tenta na próxima rodada
          for (const k of ordered.filter((x) => x.fcInside === s.id)) await doShape(k);
          if (!s.fcInst.icon) {
            const d = await this.promote({ ...s, fcDef: s.fcInst.name }, shapes).catch(() => undefined);
            const inst = this.map.get(s.id);
            if (d !== undefined && inst !== undefined && s.fcInst.text) {
              const tree = await this.call('node.get', { id: d, depth: 12 }).catch(() => null);
              const back: Array<[number, string]> = [];
              const walk = (n: any): void => {
                if (String(n?.type).toUpperCase() === 'TEXT') for (const [key, val] of Object.entries(s.fcInst!.text!)) if (n.characters === String(val)) back.push([n.id, key]);
                (n?.children || []).forEach(walk);
              };
              walk(tree);
              for (const [id, key] of back) await this.cmd('node.set', { ids: [id], props: { characters: key, name: key } }).catch(() => {});
              await this.applyTexts(inst, s.fcInst.text);
            }
          }
          continue;
        }
        const parent = parentOf(s);
        const parentFc = parent ? this.map.get(parent.id) : undefined;
        if (parent && parentFc === undefined) continue; // pai ainda não existe
        const parentAuto = isAuto(parent);
        const flowChild = parentAuto && !s.layoutAbsolute;
        const props = this.propsOf(s, parent, flowChild, isAuto(s), parentAuto && !!s.layoutAbsolute);
        const box = { w: Math.max(1, Math.round(s.width)), h: Math.max(1, Math.round(s.height)) };
        const sibs = kidsOf.get(parent?.id ?? '') || [];
        const below = sibs.slice(0, sibs.indexOf(s)).filter((x) => this.map.has(x.id)).length;
        const id = await this.makeInstance(s, shapes, parentFc, flowChild ? undefined : { x: Math.round(s.x - (parent?.x ?? 0)), y: Math.round(s.y - (parent?.y ?? 0)) }, props, box, below).catch((e) => { this.opts.onError?.(e); return undefined; });
        if (id !== undefined) {
          this.map.set(s.id, id);
          this.kind.set(s.id, s.type);
          this.opaque.add(s.id);
          continue;
        }
      }
      await doShape(s);
    }
  }

  private async create(s: Shape, props: Props, parent: number | undefined, pos: { x: number; y: number } | undefined, box: { w: number; h: number }, below = 0): Promise<number | undefined> {
    try {
      if (s.type === 'image' && s.imageUrl && s.maskPathD) {
        // imagem recortada por uma forma: um quadro do tamanho da foto (entra no fluxo do auto layout como qualquer item) com o
        // caminho (máscara) por baixo e a foto por cima, os dois num grupo de máscara
        const data = s.imageUrl.slice(s.imageUrl.indexOf(',') + 1);
        const wrapProps: Props = { name: props.name, fills: [], strokes: [], clip: false };
        for (const k of ['opacity', 'effects', 'sizingH', 'sizingV', 'absolute']) if (props[k] !== undefined) wrapProps[k] = props[k];
        const wrap = await this.exec('node.create', { type: 'frame', ...(parent !== undefined ? { parent } : {}), ...(pos ?? {}), width: box.w, height: box.h, props: wrapProps, select: false });
        const wid = wrap?.id;
        if (wid === undefined) return undefined;
        const vec = await this.exec('node.create', { type: 'vector', parent: wid, x: 0, y: 0, path: s.maskPathD, pathScale: [box.w / 100, box.h / 100], props: { name: 'Forma da máscara', fills: [{ type: 'solid', color: '#000000', opacity: 1 }] }, select: false });
        const pic = await this.exec('image.place', { data, parent: wid, x: 0, y: 0, width: box.w, height: box.h, mode: 'fill' });
        const vid = vec?.id, pid = pic?.id ?? pic?.ids?.[0];
        if (vid !== undefined && pid !== undefined) {
          await this.exec('node.set', { ids: [pid], props: { width: box.w, height: box.h, x: 0, y: 0 } }).catch(() => {});
          await this.exec('object.mask', { ids: [vid, pid] }).catch(() => {});
        }
        if (below >= 0) {
          await this.exec('arrange.back', { ids: [wid] }).catch(() => {});
          for (let i = 0; i < below; i++) await this.exec('arrange.forward', { ids: [wid] }).catch(() => {});
        }
        return wid;
      }
      if (s.type === 'image' && s.imageUrl) {
        const data = s.imageUrl.slice(s.imageUrl.indexOf(',') + 1);
        const r = await this.exec('image.place', { data, ...(parent !== undefined ? { parent } : {}), ...(pos ?? {}), width: box.w, height: box.h, mode: s.imageFit === 'fit' ? 'fit' : 'fill' });
        if (s.imageTile) {
          // textura: a imagem se repete em mosaico (a imagem tem `imageTile`x o tamanho que aparece: escala 1/imageTile)
          const tid = r?.id ?? r?.ids?.[0];
          const nd = tid !== undefined ? await this.call('node.get', { id: tid, depth: 0 }).catch(() => null) : null;
          const hash = nd?.fills?.find((f: any) => f.type === 'image')?.image;
          if (tid !== undefined && hash) await this.exec('node.set', { ids: [tid], props: { fills: [{ type: 'image', image: hash, scale_mode: 'tile', scale: 1 / s.imageTile, opacity: s.opacity ?? 1 }], name: props.name, width: box.w, height: box.h } }).catch(() => {});
          if (tid !== undefined && props.cornerRadius !== undefined) await this.exec('node.set', { ids: [tid], props: { cornerRadius: props.cornerRadius } }).catch(() => {});
          return tid;
        }
        const id = r?.id ?? r?.ids?.[0];
        if (id === undefined) return undefined;
        const extra: Props = { name: props.name };
        for (const k of ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius', 'opacity', 'effects', 'strokes', 'strokeWeight', 'strokeAlign', 'sizingH', 'sizingV', 'absolute']) if (props[k] !== undefined) extra[k] = props[k];
        await this.exec('node.set', { ids: [id], props: { ...extra, width: box.w, height: box.h } }).catch(() => {});
        // a foto chega depois do espaço reservado e nasce por cima de tudo: volta ao lugar dela na pilha de camadas
        if (below >= 0) {
          await this.exec('arrange.back', { ids: [id] }).catch(() => {});
          for (let i = 0; i < below; i++) await this.exec('arrange.forward', { ids: [id] }).catch(() => {});
        }
        return id;
      }
      const type = TYPE_OF[s.type] || 'rectangle';
      if (type === 'vector' && s.pathD) {
        // quadro do tamanho do ícone (entra no fluxo do auto layout como qualquer item) com o vetor no tamanho NATURAL dentro dele:
        // mexer na largura/altura de um vetor estica o desenho (a seta virava um "chevron" gordo)
        const fp: Props = { name: props.name, fills: [], strokes: [], clip: false };
        for (const k of ['opacity', 'effects', 'sizingH', 'sizingV', 'absolute', 'visible', 'rotation']) if (props[k] !== undefined) fp[k] = props[k];
        const fr = await this.exec('node.create', { type: 'frame', ...(parent !== undefined ? { parent } : {}), ...(pos ?? {}), width: box.w, height: box.h, props: fp, select: false });
        const fid: number | undefined = fr?.id;
        if (fid === undefined) return undefined;
        const vp: Props = { name: 'Ícone' };
        for (const k of ['fills', 'strokes', 'strokeWeight', 'strokeAlign']) if (props[k] !== undefined) vp[k] = props[k];
        const vr = await this.exec('node.create', { type: 'vector', parent: fid, x: 0, y: 0, path: s.pathD, pathScale: [box.w / (s.pathW || 24), box.h / (s.pathH || 24)], closed: s.closed !== false, props: vp, select: false });
        if (vr?.id !== undefined) this.vecChild.set(s.id, vr.id);
        return fid;
      }
      const body: Props = { type, ...(parent !== undefined ? { parent } : {}), ...(pos ?? {}), props, select: false };
      if (s.type === 'text') {
        // o texto nasce com a largura da caixa (textAutoResize cuida do resto)
        if (props.textAutoResize !== 'widthAndHeight') body.width = box.w;
        if (props.textAutoResize === 'none') body.height = box.h;
      } else if (type === 'line') {
        body.width = Math.max(box.w, box.h); body.height = 0;
      } else if (type === 'vector') {
        if (!s.pathD) return undefined;
        body.path = s.pathD;
        body.pathScale = [box.w / (s.pathW || 24), box.h / (s.pathH || 24)];
        body.closed = s.closed !== false;
      } else {
        body.width = box.w; body.height = box.h;
      }
      const r = await this.exec('node.create', body);
      const id: number | undefined = r?.id;
      if (id === undefined) return undefined;
      if (type === 'line' && s.type === 'line' && box.h > box.w * 2) {
        await this.exec('node.set', { ids: [id], props: { rotation: 90 } }).catch(() => {});
      }
      // trechos de texto com estilo próprio (negrito, cor, tamanho)
      if (s.type === 'text' && s.runs?.length) {
        for (const run of s.runs) {
          const rp: Props = { start: run.start, end: run.end };
          if (run.fontWeight) rp.fontWeight = Number(run.fontWeight) || (run.fontWeight === 'bold' ? 700 : 400);
          if (run.fontSize) rp.fontSize = run.fontSize;
          if (run.fill) rp.textFills = [{ type: 'solid', color: hex8(run.fill), opacity: 1 }];
          if (run.textDecoration && run.textDecoration !== 'none') rp.textDecoration = run.textDecoration === 'line-through' ? 'strikethrough' : 'underline';
          if (Object.keys(rp).length > 2) await this.exec('node.set', { ids: [id], props: rp }).catch(() => {});
        }
      }
      return id;
    } catch (e) {
      this.opts.onError?.(e);
      return undefined;
    }
  }
}
