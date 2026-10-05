import type { Shape } from './types';
import { normalize, translateTerm } from './iconsPt';

export type IconCatalog = Record<string, string>;

let cache: Promise<IconCatalog> | null = null;
/** Catálogo Material (Outlined) nome -> path 24x24; carregado sob demanda (chunk separado). */
export const loadIcons = (): Promise<IconCatalog> => (cache ||= import('./materialIcons.json').then((m) => m.default as IconCatalog));

/** "AddAPhoto" -> "add a photo" para a busca por palavras. */
const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/** Busca por palavras em inglês (nome do ícone) ou pt-BR/contexto ("viagem" → mala, avião, carro…). Cada palavra digitada precisa casar por si ou por uma tradução. */
export function searchIcons(catalog: IconCatalog, query: string, limit = 120): string[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const names = Object.keys(catalog);
  if (!terms.length) return names.slice(0, limit);
  const alts = terms.map((t) => [t, ...translateTerm(t)]);
  const index = new Map(names.map((n) => [n, words(n)]));
  const flat = (w: string) => w.replace(/ /g, ''); // "add a photo" também casa "addphoto" e "add_a_photo"
  const score = (n: string) => {
    const w = index.get(n)!;
    let best = 99;
    for (const group of alts) {
      let hit = -1;
      group.forEach((alt, i) => {
        const a = alt.replace(/_/g, ' ');
        const whole = w.split(' ').includes(a) || w.split(' ').join('_').includes(a) && a.includes(' ');
        // traduções casam só palavra inteira (evita "car" em "card"); o que o usuário digitou também casa parcial
        const pos = whole || flat(w) === a.replace(/ /g, '') ? 0 : i === 0 && (w.includes(a) || flat(w).includes(a.replace(/ /g, ''))) ? 1 : -1;
        if (pos >= 0 && (hit < 0 || pos + (i ? 0.5 : 0) < hit)) hit = pos + (i ? 0.5 : 0);
      });
      if (hit < 0) return -1;
      best = Math.min(best, hit);
    }
    return best;
  };
  return names
    .map((n) => [n, score(n)] as const)
    .filter(([, sc]) => sc >= 0)
    .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([n]) => n);
}

/** Resolve nome vindo da IA ("home", "Home", "home_outlined", "HomeOutlined") para uma chave do catálogo. */
export function resolveIconName(catalog: IconCatalog, raw: string): string | null {
  const key = String(raw || '').replace(/(Outlined|Rounded|Sharp|Filled)$/i, '').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c || '').toUpperCase());
  if (!key) return null;
  const pascal = key[0].toUpperCase() + key.slice(1);
  if (catalog[pascal]) return pascal;
  const lower = pascal.toLowerCase();
  return Object.keys(catalog).find((n) => n.toLowerCase() === lower) || null;
}

export function iconShape(catalog: IconCatalog, name: string, props: { id: string; pageId: string; x: number; y: number; size: number; fill: string; zIndex: number; parentId?: string }): Shape {
  return {
    id: props.id,
    name,
    type: 'path',
    pageId: props.pageId,
    parentId: props.parentId,
    x: props.x,
    y: props.y,
    width: props.size,
    height: props.size,
    rotation: 0,
    fill: props.fill,
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    zIndex: props.zIndex,
    visible: true,
    pathD: catalog[name],
    pathW: 24,
    pathH: 24,
    iconName: name,
  } as Shape;
}

/** Nomes comuns sugeridos à IA (a lista completa é grande demais para o prompt). */
export const COMMON_ICON_NAMES = 'Home Search Settings Person People Add Remove Close Check Menu MoreVert MoreHoriz ArrowBack ArrowForward ArrowUpward ArrowDownward ExpandMore ExpandLess ChevronLeft ChevronRight Favorite Star Notifications Mail Chat Call Share Download Upload Edit Delete Save Lock LockOpen Visibility VisibilityOff Info Warning Error Help Dashboard Analytics BarChart PieChart ShowChart TrendingUp TrendingDown Calendar CalendarMonth Schedule AccessTime Folder InsertDriveFile Image Photo Camera Videocam Mic Language Public Place Map ShoppingCart ShoppingBag Payment CreditCard AccountBalance AttachMoney Receipt Store Work School Event Bookmark Flag Link Attachment Send Refresh Sync FilterList Sort Tune Cloud Code Terminal BugReport Build Security Shield Verified Bolt Rocket Lightbulb Palette Brush Layers Apps GridView ViewList Logout Login PersonAdd Group Support Phone Smartphone Laptop Wifi Battery Power Timer Update History ThumbUp Comment Forum Article Description Assignment Task ContentCopy Paste Print'.split(' ');
