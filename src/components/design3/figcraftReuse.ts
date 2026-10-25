import type { Shape } from '../design2/types';
import type { LibComponent } from '../design2/aiScreenFromLlm';
import { resolveIconName, type IconCatalog } from '../design2/icons';

const CHROME = new Set(['Hora', 'SignalCellularAlt', 'Wifi', 'Battery5Bar', 'Indicador home']);
const NAV = /\b(navbar|nav bar|tab ?bar|bottom ?(nav|bar|tabs)|barra (de )?(navega[cç][aã]o|abas|inferior)|menu inferior)\b/i;
const HEADER = /\b(header|cabe[cç]alho|app ?bar|toolbar|top ?bar|topo)\b/i;
const INPUT = /\b(input|campo|search|busca|pesquisa|text ?field)\b/i;
const GENERIC = /^(frame|group|grupo|ret[aâ]ngulo|rectangle|conte[uú]do|content|container)\b/i;

const hex = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : undefined);
const dim = (mode: unknown, v: number) => (mode === 'fill' ? 'fill' : mode === 'hug' ? 'hug' : Math.round(v));

/** Frame de ícone (um quadro com um vetor) cujo nome é um ícone do catálogo. */
function iconName(s: Shape, kids: Shape[], icons?: IconCatalog): string | null {
  if (!icons || s.type !== 'frame' || kids.length !== 1 || kids[0].type !== 'path' || s.width > 64) return null;
  return resolveIconName(icons, String(s.name || ''));
}

/** Shape (e filhos) como itens da IA, com ids locais; null se algo não dá para reproduzir (foto, vetor que não é ícone conhecido). */
function toItems(root: Shape, kids: Map<string, Shape[]>, icons?: IconCatalog): any[] | null {
  const items: any[] = [];
  let n = 0;
  const walk = (s: Shape, parent: Shape | null, parentId: string | null): boolean => {
    const children = (kids.get(s.id) || []).filter((c) => c.visible !== false).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const id = `c${n++}`;
    const flow = !!parent?.hasAutoLayout && parent.layoutFlow !== 'freeform' && !s.layoutAbsolute;
    const place: Record<string, unknown> = parent && !flow ? { x: Math.round(s.x - parent.x), y: Math.round(s.y - parent.y) } : {};
    const base = { id, ...(parentId ? { parent: parentId } : {}), ...place };
    const ic = iconName(s, children, icons);
    if (ic) {
      items.push({ type: 'icon', ...base, name: ic, size: Math.round(s.width), fill: hex(children[0].fill) || '#0F172A' });
      return true;
    }
    if (s.type === 'text') {
      items.push({
        type: 'text', ...base, text: s.text ?? '', ...(s.name && s.name !== s.text ? { name: s.name } : {}), fontSize: s.fontSize, fontWeight: s.fontWeight, fill: hex(s.fill) || '#0F172A',
        textAlign: s.textAlign === 'center' || s.textAlign === 'right' ? s.textAlign : 'left', width: flow ? (s.widthMode === 'fill' ? 'fill' : 'hug') : Math.round(s.width),
      });
      return true;
    }
    if (s.type === 'frame' || s.type === 'group') {
      const pad = [s.paddingTop ?? 0, s.paddingRight ?? 0, s.paddingBottom ?? 0, s.paddingLeft ?? 0];
      items.push({
        type: 'frame', ...base, name: s.name, ...(s.hasAutoLayout && (s.layoutFlow === 'horizontal' || s.layoutFlow === 'vertical') ? { layout: s.layoutFlow, gap: s.layoutGap ?? 0, padding: pad, align: s.layoutAlign } : {}),
        width: dim(s.widthMode, s.width), height: dim(s.heightMode, s.height), fill: hex(s.fill) || 'transparent', cornerRadius: s.cornerRadius ?? 0,
        ...(hex(s.stroke) && s.strokeWidth ? { stroke: hex(s.stroke), strokeWidth: s.strokeWidth } : {}), ...(s.clipContent ? { clip: true } : {}),
      });
      return children.every((c) => walk(c, s, id));
    }
    if (s.type === 'rect' || s.type === 'ellipse' || s.type === 'line') {
      items.push({ type: s.type, ...base, width: Math.round(s.width), height: Math.round(s.height), fill: hex(s.fill) || (s.type === 'line' ? undefined : 'transparent'), cornerRadius: s.cornerRadius ?? 0, ...(hex(s.stroke) && s.strokeWidth ? { stroke: hex(s.stroke), strokeWidth: s.strokeWidth } : {}) });
      return true;
    }
    return false; // foto, vetor solto, forma especial
  };
  return walk(root, null, null) ? items : null;
}

/** Nome do componente: o da camada, ou um nome pelo papel da peça quando a camada é genérica ("Frame 12"). */
function nameOf(s: Shape, role: string): string {
  const raw = String(s.name || '').trim().replace(/[\s_-]*\d+$/, ''); // "Card 1" -> "Card"
  return (raw && !GENERIC.test(raw) ? raw : role).slice(0, 40);
}

const sig = (s: Shape, kids: Map<string, Shape[]>): string =>
  `${s.type}:${Math.round(s.height / 8)}:${(kids.get(s.id) || []).filter((c) => c.visible !== false).map((c) => `${c.type}${c.type === 'text' ? '' : Math.round(c.width / 16)}`).join(',')}`;

/**
 * Peças reutilizáveis das telas selecionadas: barra de navegação, cabeçalho, itens repetidos (cards/linhas de lista), botões, campos.
 * Viram componentes da biblioteca, para a IA criar as telas novas com instâncias em vez de redesenhar do zero.
 */
export function extractReusable(shapes: Shape[], roots: Shape[], icons?: IconCatalog, max = 12): LibComponent[] {
  const kids = new Map<string, Shape[]>();
  for (const s of shapes) if (s.parentId && s.visible !== false && !s.deviceChrome && !CHROME.has(String(s.name))) kids.set(s.parentId, [...(kids.get(s.parentId) || []), s]);
  const count = (s: Shape): number => 1 + (kids.get(s.id) || []).reduce((a, c) => a + count(c), 0);
  const out: LibComponent[] = [];
  const taken = new Set<string>();
  const add = (s: Shape, role: string) => {
    if (out.length >= max) return false;
    const name = nameOf(s, role);
    if (taken.has(name.toLowerCase())) return false;
    const items = toItems(s, kids, icons);
    if (!items || items.length < 2) return false;
    taken.add(name.toLowerCase());
    out.push({ name, items, width: s.width, height: s.height });
    return true;
  };
  for (const root of roots) {
    const area = root.width * root.height;
    const visit = (s: Shape, depth: number) => {
      const list = (kids.get(s.id) || []).filter((c) => c.type === 'frame');
      // itens repetidos entre irmãos (cards, linhas de lista): um componente para o grupo
      const groups = new Map<string, Shape[]>();
      for (const c of list) groups.set(sig(c, kids), [...(groups.get(sig(c, kids)) || []), c]);
      const repeated = new Set<string>();
      for (const g of groups.values()) {
        if (g.length >= 2 && g[0].width * g[0].height < area * 0.4 && count(g[0]) <= 30 && add(g[0], g[0].height > 80 ? 'Card' : 'Item de lista')) g.forEach((c) => repeated.add(c.id));
      }
      for (const c of list) {
        if (repeated.has(c.id)) continue;
        const nm = String(c.name || '');
        const small = c.width * c.height < area * 0.55 && count(c) <= 30;
        const role = NAV.test(nm) ? 'Barra de navegação' : HEADER.test(nm) ? 'Cabeçalho' : INPUT.test(nm) && c.height <= 72 ? 'Campo' : '';
        const button = !role && !!c.cornerRadius && c.height >= 32 && c.height <= 64 && hex(c.fill) && count(c) <= 4 && (kids.get(c.id) || []).some((k) => k.type === 'text');
        if (small && (role || button) && add(c, role || 'Botão')) continue;
        if (depth < 4) visit(c, depth + 1);
      }
    };
    visit(root, 0);
  }
  return out;
}

/** O que uma tela mostra: os textos principais, de cima para baixo (dá ao planejamento das outras telas o assunto do app). */
export function screenDigest(shapes: Shape[], root: Shape): string {
  const kids = new Map<string, Shape[]>();
  for (const s of shapes) if (s.parentId) kids.set(s.parentId, [...(kids.get(s.parentId) || []), s]);
  const texts: Shape[] = [];
  const walk = (id: string) => { for (const c of kids.get(id) || []) { if (c.visible === false || CHROME.has(String(c.name))) continue; if (c.type === 'text' && String(c.text || '').trim()) texts.push(c); walk(c.id); } };
  walk(root.id);
  const seen = new Set<string>();
  const list = texts.sort((a, b) => a.y - b.y || a.x - b.x).map((t) => String(t.text).replace(/\s+/g, ' ').trim().slice(0, 40)).filter((t) => t.length > 1 && !/^\d{1,2}:\d{2}$/.test(t) && !seen.has(t) && seen.add(t));
  return `${Math.round(root.width)}x${Math.round(root.height)}; textos: ${list.slice(0, 36).join(' | ')}`.slice(0, 600);
}
