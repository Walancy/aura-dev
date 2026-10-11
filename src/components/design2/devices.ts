import type { Shape } from './types';
import type { IconCatalog } from './icons';
import { iconShape } from './icons';

export type DeviceKind = 'iphone-island' | 'iphone-notch' | 'iphone-se' | 'android' | 'ipad' | 'macbook' | 'macbook-notch' | 'plain';
export interface DevicePreset { id: string; name: string; group: 'mobile' | 'tablet' | 'desktop'; width: number; height: number; kind: DeviceKind; radius: number }

/** width/height = tamanho da TELA (o corpo do aparelho é maior). */
export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iphone-15-pro', name: 'iPhone 15 Pro', group: 'mobile', width: 393, height: 852, kind: 'iphone-island', radius: 55 },
  { id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', group: 'mobile', width: 430, height: 932, kind: 'iphone-island', radius: 55 },
  { id: 'iphone-14', name: 'iPhone 14', group: 'mobile', width: 390, height: 844, kind: 'iphone-notch', radius: 47 },
  { id: 'iphone-se', name: 'iPhone SE', group: 'mobile', width: 375, height: 667, kind: 'iphone-se', radius: 0 },
  { id: 'pixel-8', name: 'Android (Pixel 8)', group: 'mobile', width: 412, height: 915, kind: 'android', radius: 40 },
  { id: 'android-compact', name: 'Android compacto', group: 'mobile', width: 360, height: 800, kind: 'android', radius: 32 },
  { id: 'ipad-pro-11', name: 'iPad Pro 11"', group: 'tablet', width: 834, height: 1194, kind: 'ipad', radius: 28 },
  { id: 'ipad-mini', name: 'iPad mini', group: 'tablet', width: 744, height: 1133, kind: 'ipad', radius: 24 },
  { id: 'macbook-pro-14', name: 'MacBook Pro 14"', group: 'desktop', width: 1512, height: 982, kind: 'macbook-notch', radius: 0 },
  { id: 'macbook-air', name: 'MacBook Air 13"', group: 'desktop', width: 1280, height: 832, kind: 'macbook-notch', radius: 0 },
  { id: 'desktop', name: 'Desktop', group: 'desktop', width: 1440, height: 900, kind: 'plain', radius: 0 },
  { id: 'desktop-hd', name: 'Desktop HD', group: 'desktop', width: 1920, height: 1080, kind: 'plain', radius: 0 },
  { id: 'laptop', name: 'Laptop', group: 'desktop', width: 1366, height: 768, kind: 'macbook', radius: 0 },
];

/** Margens seguras de telas com ilha/notch (topo: barra de status; base: indicador home). */
export const MOBILE_SAFE = { top: 56, bottom: 36 };

export interface DeviceOptions {
  idGen: () => string;
  pageId: string;
  x: number;
  y: number;
  z: number;
  isDark: boolean;
  name?: string;
  background?: string;
  icons?: IconCatalog;
}

export interface DeviceBuild {
  shapes: Shape[];
  /** frame externo (corpo do aparelho); igual a screenId em frames simples */
  rootId: string;
  screenId: string;
  /** canto da tela em coordenadas do canvas */
  screenX: number;
  screenY: number;
  rootWidth: number;
  rootHeight: number;
  /** próximo zIndex livre acima da estrutura do aparelho */
  zNext: number;
}

interface Bezel { top: number; side: number; bottom: number; ring: number; light: string; dark: string }
const BEZEL: Record<DeviceKind, Bezel> = {
  'iphone-island': { top: 14, side: 14, bottom: 14, ring: 4, light: '#DAD7D1', dark: '#8A8884' }, // titânio
  'iphone-notch': { top: 15, side: 15, bottom: 15, ring: 3, light: '#E9E9EC', dark: '#A7A8AD' }, // alumínio
  'iphone-se': { top: 96, side: 24, bottom: 96, ring: 3, light: '#4A4A4D', dark: '#1C1C1E' },
  android: { top: 11, side: 11, bottom: 11, ring: 2, light: '#D3D6DB', dark: '#8E9197' },
  ipad: { top: 22, side: 22, bottom: 22, ring: 3, light: '#CBCDD3', dark: '#8F9198' },
  macbook: { top: 16, side: 16, bottom: 26, ring: 2, light: '#DADBE0', dark: '#A0A2A9' },
  'macbook-notch': { top: 16, side: 16, bottom: 26, ring: 2, light: '#DADBE0', dark: '#A0A2A9' },
  plain: { top: 0, side: 0, bottom: 0, ring: 0, light: '#000', dark: '#000' },
};

const gradient = (angle: number, ...cols: string[]): Partial<Shape> => ({
  fill: cols[0],
  fills: [{ id: 'g0', color: cols[0], opacity: 1, visible: true, type: 'linear', gradientAngle: angle, gradientStops: cols.map((c, i) => ({ position: i / (cols.length - 1), color: c, opacity: 1 })) }],
});

/**
 * Aparelho detalhado: corpo (titânio/alumínio) → moldura preta → tela, com botões laterais,
 * ilha/notch, câmera, sensores, barra de status e indicador home. Devolve também ids para o conteúdo.
 */
export function buildDevice(spec: { name: string; width: number; height: number; kind: DeviceKind; radius: number }, o: DeviceOptions): DeviceBuild {
  const { width: w, height: h, kind } = spec;
  const bz = BEZEL[kind];
  const W = w + bz.side * 2;
  const H = h + bz.top + bz.bottom;
  const screenId = o.idGen();
  const bg = o.background || (o.isDark ? '#141414' : '#FFFFFF');
  const base = (e: Partial<Shape> & { id: string; type: Shape['type']; name: string }): Shape =>
    ({ rotation: 0, fill: '#000000', stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, pageId: o.pageId, ...e }) as Shape;

  if (kind === 'plain') {
    const frame = base({ id: screenId, type: 'frame', name: o.name || spec.name, x: o.x, y: o.y, width: w, height: h, zIndex: o.z, fill: bg, cornerRadius: spec.radius || undefined, clipContent: true }); // sombras, brilhos e blur dos filhos não vazam da tela
    return { shapes: [frame], rootId: screenId, screenId, screenX: o.x, screenY: o.y, rootWidth: w, rootHeight: h, zNext: o.z + 1 };
  }

  const rootId = o.idGen();
  const out: Shape[] = [];
  const outer = kind === 'iphone-se' ? 46 : kind.startsWith('macbook') ? 18 : spec.radius + Math.round(bz.side * 0.9);
  const ink = o.isDark ? '#FFFFFF' : '#000000';
  const sx = o.x + bz.side;
  const sy = o.y + bz.top;

  // estrutura: corpo -> moldura -> tela (botões laterais atrás do corpo)
  out.push(base({ id: rootId, type: 'frame', name: o.name || spec.name, x: o.x, y: o.y, width: W, height: H, zIndex: o.z, cornerRadius: outer, ...gradient(145, bz.light, bz.dark) }));
  const child = (parent: string, z: number, e: Partial<Shape> & { type: Shape['type']; name: string; x: number; y: number; width: number; height: number }, absolute = false) =>
    out.push(base({ id: o.idGen(), parentId: parent, zIndex: z, deviceChrome: true, ...e, x: absolute ? e.x : parent === rootId ? o.x + e.x : sx + e.x, y: absolute ? e.y : parent === rootId ? o.y + e.y : sy + e.y }));

  const btnZ = o.z - 1;
  const btn = (side: 'l' | 'r', y: number, hh: number, name: string) =>
    child(rootId, btnZ, { type: 'rect', name, x: side === 'l' ? -3 : W - 1, y, width: 4, height: hh, cornerRadius: 2, ...gradient(side === 'l' ? 90 : 270, bz.dark, bz.light) });
  if (kind === 'iphone-island' || kind === 'iphone-notch') {
    btn('l', 104, 28, 'Botão de ação');
    btn('l', 160, 54, 'Botão volume +');
    btn('l', 226, 54, 'Botão volume −');
    btn('r', 190, 86, 'Botão lateral');
  } else if (kind === 'android') {
    btn('r', 180, 52, 'Botão liga/desliga');
    btn('r', 260, 92, 'Botão volume');
  } else if (kind === 'iphone-se') {
    btn('l', 130, 30, 'Botão mudo');
    btn('l', 190, 46, 'Botão volume +');
    btn('l', 246, 46, 'Botão volume −');
    btn('r', 200, 60, 'Botão lateral');
  } else if (kind === 'ipad') {
    child(rootId, btnZ, { type: 'rect', name: 'Botão superior', x: W - 130, y: -3, width: 52, height: 4, cornerRadius: 2, ...gradient(180, bz.dark, bz.light) });
  }

  child(rootId, o.z + 1, { type: 'rect', name: 'Moldura (vidro)', x: bz.ring, y: bz.ring, width: W - bz.ring * 2, height: H - bz.ring * 2, cornerRadius: Math.max(0, outer - bz.ring), fill: '#000000' });
  out.push(base({ id: screenId, type: 'frame', name: 'Tela', deviceScreen: true, parentId: rootId, x: sx, y: sy, width: w, height: h, zIndex: o.z + 2, fill: bg, cornerRadius: spec.radius || undefined, clipContent: true }));

  // detalhes sobre a tela (bem acima do conteúdo que vier depois)
  let z = o.z + 4000;
  const onScreen = (e: Parameters<typeof child>[2]) => child(screenId, z++, e);
  const lens = (cx: number, cy: number, d: number, parent: 'screen' | 'root' = 'screen') => {
    const put = parent === 'screen' ? onScreen : (e: Parameters<typeof child>[2]) => child(rootId, z++, e);
    put({ type: 'ellipse', name: 'Câmera frontal', x: cx - d / 2, y: cy - d / 2, width: d, height: d, fill: '#0A0A14', stroke: '#26264A', strokeWidth: 1.5 });
    put({ type: 'ellipse', name: 'Reflexo da lente', x: cx - d * 0.05, y: cy - d * 0.3, width: Math.max(2, d * 0.3), height: Math.max(2, d * 0.3), fill: '#4A5AA8', opacity: 0.85 });
  };
  const phoneLike = kind === 'iphone-island' || kind === 'iphone-notch' || kind === 'android' || kind === 'ipad';

  if (phoneLike) {
    onScreen({ type: 'text', name: 'Hora', x: kind === 'android' ? 28 : kind === 'ipad' ? 28 : 48, y: kind === 'ipad' ? 10 : 17, width: kind === 'ipad' ? 160 : 60, height: 22, text: kind === 'ipad' ? '9:41  ter 4 de out.' : '9:41', fontSize: kind === 'ipad' ? 13 : 16, fontWeight: 600, fontFamily: 'Inter', textAlign: 'left', fill: ink });
    if (o.icons) {
      const iy = kind === 'ipad' ? 9 : 17;
      const ic = (name: string, x: number, size: number) =>
        o.icons![name] && out.push({ ...iconShape(o.icons!, name, { id: o.idGen(), pageId: o.pageId, parentId: screenId, x: sx + x, y: sy + iy, size, fill: ink, zIndex: z++ }), name, deviceChrome: true });
      ic('SignalCellularAlt', w - 92, 20);
      ic('Wifi', w - 68, 20);
      ic('Battery5Bar', w - 44, 22);
    }
  }
  if (kind === 'iphone-island') {
    onScreen({ type: 'rect', name: 'Dynamic Island', x: (w - 126) / 2, y: 11, width: 126, height: 37, cornerRadius: 19, fill: '#000000' });
    lens((w + 126) / 2 - 24, 29.5, 12);
    onScreen({ type: 'ellipse', name: 'Sensor Face ID', x: (w - 126) / 2 + 20, y: 26, width: 7, height: 7, fill: '#15151B' });
  } else if (kind === 'iphone-notch') {
    onScreen({ type: 'rect', name: 'Notch', x: (w - 160) / 2, y: -14, width: 160, height: 44, cornerRadius: 22, fill: '#000000' });
    onScreen({ type: 'rect', name: 'Alto-falante', x: (w - 52) / 2, y: 7, width: 52, height: 5, cornerRadius: 3, fill: '#222226' });
    lens((w) / 2 + 44, 10, 9);
  } else if (kind === 'android') {
    lens(w / 2, 20, 14);
    onScreen({ type: 'ellipse', name: 'Anel da câmera', x: w / 2 - 10, y: 10, width: 20, height: 20, fill: 'none', stroke: '#000000', strokeWidth: 3 });
  } else if (kind === 'ipad') {
    lens(W / 2, bz.top / 2, 8, 'root');
  } else if (kind === 'iphone-se') {
    child(rootId, z++, { type: 'rect', name: 'Alto-falante', x: W / 2 - 30, y: bz.top / 2 - 3, width: 60, height: 7, cornerRadius: 4, fill: '#2A2A2D' });
    lens(W / 2 - 52, bz.top / 2, 10, 'root');
    child(rootId, z++, { type: 'ellipse', name: 'Botão Home', x: W / 2 - 28, y: H - bz.bottom / 2 - 28, width: 56, height: 56, fill: '#000000', stroke: '#3A3A3C', strokeWidth: 2 });
    child(rootId, z++, { type: 'rect', name: 'Ícone Home', x: W / 2 - 10, y: H - bz.bottom / 2 - 10, width: 20, height: 20, cornerRadius: 5, fill: 'none', stroke: '#3A3A3C', strokeWidth: 1.5 });
  } else if (kind === 'macbook' || kind === 'macbook-notch') {
    if (kind === 'macbook-notch') {
      onScreen({ type: 'rect', name: 'Notch', x: (w - 150) / 2, y: -12, width: 150, height: 34, cornerRadius: 10, fill: '#000000' });
      lens(w / 2, 6, 7);
    } else lens(W / 2, bz.top / 2, 6, 'root');
    // base do notebook
    child(rootId, o.z - 1, { type: 'rect', name: 'Base', x: -W * 0.06, y: H - 1, width: W * 1.12, height: 16, cornerRadius: 7, ...gradient(180, '#E3E4E9', '#A9ABB2') });
    child(rootId, o.z - 1, { type: 'rect', name: 'Encaixe do dedo', x: W / 2 - 70, y: H - 1, width: 140, height: 6, cornerRadius: 3, fill: '#8E9097' });
  }
  if (kind === 'iphone-island' || kind === 'iphone-notch' || kind === 'ipad') onScreen({ type: 'rect', name: 'Indicador home', x: (w - 134) / 2, y: h - 13, width: 134, height: 5, cornerRadius: 3, fill: ink });
  if (kind === 'android') onScreen({ type: 'rect', name: 'Barra de gestos', x: (w - 108) / 2, y: h - 12, width: 108, height: 4, cornerRadius: 2, fill: ink });

  return { shapes: out, rootId, screenId, screenX: sx, screenY: sy, rootWidth: W, rootHeight: H, zNext: o.z + 3 };
}

export function buildDevicePreset(p: DevicePreset, o: DeviceOptions): DeviceBuild {
  return buildDevice(p, o);
}
