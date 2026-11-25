// Tema aproximado de apresentações Beamer: lê \usetheme, \usecolortheme, \setbeamercolor e as opções da classe.
export type BeamerFamily = 'default' | 'bar' | 'metro';

export interface BeamerInfo {
  /** largura x altura em pt (o Beamer 4:3 padrão tem 128 x 96 mm) */
  w: number;
  h: number;
  fontPt: number;
  theme: string;
  family: BeamerFamily;
  /** header com a lista de seções (Berlin, Warsaw, Frankfurt...) */
  headerSections: boolean;
  footer: 'none' | 'infolines' | 'page' | 'nav';
  struct: string;
  pp: string;
  ps: string;
  pt3: string;
  tb: string;
  tf: string;
  bb: string;
  bf: string;
  title: string;
  shortTitle: string;
  author: string;
  shortAuthor: string;
  date: string;
  shortDate: string;
  sections: string[];
  /** barra no título do quadro (tema de barra ou frametitle com fundo definido) */
  titleBar: boolean;
  /** caixa de cor no slide de título */
  titleBox: boolean;
  tib: string;
  tif: string;
  /** fundo e texto do corpo dos blocos */
  bodyBg: string;
  bodyFg: string;
  tocFg: string;
  bullet: string;
  rounded: boolean;
  /** rodapé definido pelo documento (\setbeamertemplate{footline}) */
  footerBoxes?: Array<{ w: number; align: 'left' | 'center' | 'right'; bg: string; fg: string; raw: string }>;
}

const MM = 72 / 25.4;
const ASPECT: Record<string, [number, number]> = {
  '43': [128, 96],
  '169': [160, 90],
  '1610': [160, 100],
  '149': [140, 90],
  '54': [128, 102.4],
  '32': [135, 90],
};

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#00ff00', blue: '#0000ff', cyan: '#00ffff', magenta: '#ff00ff', yellow: '#ffff00',
  gray: '#808080', darkgray: '#404040', lightgray: '#bfbfbf', orange: '#ff8000', purple: '#bf0040', brown: '#bf8040', violet: '#800080', olive: '#808000',
  teal: '#008080', lime: '#bfff00', pink: '#ffbfbf', structure: '',
};

// Cor da estrutura de cada tema de cores
const COLOR_THEMES: Record<string, string> = {
  default: '#3333b2', albatross: '#1a1a66', beaver: '#8b1a1a', beetle: '#555555', crane: '#e0a000', dolphin: '#2b6cb0', dove: '#444444', fly: '#555555',
  lily: '#2f3f9f', orchid: '#8e3aa8', rose: '#c2477a', seagull: '#555555', seahorse: '#5a74c4', whale: '#1f3a93', wolverine: '#c9a800', sidebartab: '#3333b2',
};

// Tema principal -> família de layout e cor padrão
const THEMES: Record<string, { family: BeamerFamily; header?: boolean; footer?: BeamerInfo['footer']; struct?: string }> = {
  default: { family: 'default', footer: 'nav' },
  boxes: { family: 'default', footer: 'nav' },
  bars: { family: 'default', footer: 'nav' },
  classic: { family: 'default', footer: 'nav' },
  lined: { family: 'default', footer: 'nav' },
  plain: { family: 'default', footer: 'none' },
  madrid: { family: 'bar', footer: 'infolines' },
  boadilla: { family: 'bar', footer: 'infolines' },
  cambridgeus: { family: 'bar', footer: 'infolines', struct: '#a30000' },
  warsaw: { family: 'bar', header: true, footer: 'infolines' },
  copenhagen: { family: 'bar', header: true, footer: 'infolines' },
  singapore: { family: 'bar', header: true, footer: 'page' },
  frankfurt: { family: 'bar', header: true, footer: 'page' },
  berlin: { family: 'bar', header: true, footer: 'infolines' },
  antibes: { family: 'bar', header: true, footer: 'nav' },
  szeged: { family: 'bar', header: true, footer: 'infolines' },
  pittsburgh: { family: 'default', footer: 'nav' },
  rochester: { family: 'bar', footer: 'nav' },
  goettingen: { family: 'bar', footer: 'nav' },
  hannover: { family: 'bar', footer: 'nav' },
  ilmenau: { family: 'bar', header: true, footer: 'nav' },
  luebeck: { family: 'bar', header: true, footer: 'nav' },
  malmoe: { family: 'bar', header: true, footer: 'nav' },
  marburg: { family: 'bar', footer: 'nav' },
  montpellier: { family: 'bar', header: true, footer: 'nav' },
  paloalto: { family: 'bar', footer: 'nav' },
  berkeley: { family: 'bar', footer: 'nav' },
  darmstadt: { family: 'bar', header: true, footer: 'nav' },
  dresden: { family: 'bar', header: true, footer: 'nav' },
  juanlespins: { family: 'bar', header: true, footer: 'nav' },
  metropolis: { family: 'metro', footer: 'page', struct: '#eb811b' },
};

function xcolor(spec: string, defs: Record<string, string>): string {
  const s = spec.trim();
  if (!s) return '';
  const parts = s.split('!');
  const base = (n: string): string => (n.startsWith('#') ? n : defs[n] ?? NAMED[n] ?? '#808080');
  if (parts.length === 1) return base(parts[0]);
  const pct = Number(parts[1]);
  if (!Number.isFinite(pct)) return base(parts[0]);
  const other = parts[2] ? base(parts[2]) : '#ffffff';
  return `color-mix(in srgb, ${base(parts[0])} ${pct}%, ${other})`;
}

const strip = (s: string) => s.replace(/(^|[^\\])%.*$/gm, '$1');

function braceContent(s: string, from: number): string | null {
  let depth = 0;
  for (let k = from; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') k++;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(from + 1, k);
  }
  return null;
}

const BULLETS: Record<string, string> = { circle: '●', square: '■', ball: '●', triangle: '▶', default: '▶' };

export function parseBeamer(source: string, grabOpt: (name: string) => { short?: string; long?: string }): BeamerInfo {
  const src = strip(source);
  const cls = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{beamer\}/.exec(src);
  const opts = cls?.[1] || '';
  const asp = /aspectratio\s*=\s*(\d+)/.exec(opts)?.[1] || '43';
  const [wmm, hmm] = ASPECT[asp] || ASPECT['43'];
  const fontPt = Number(/(\d+)pt/.exec(opts)?.[1]) || 11;

  const theme = (/\\usetheme\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/.exec(src)?.[1] || 'default').trim();
  const key = theme.toLowerCase();
  const t = THEMES[key] || THEMES.default;
  const colorTheme = (/\\usecolortheme\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/.exec(src)?.[1] || '').trim().toLowerCase();

  const defs: Record<string, string> = {};
  for (const m of src.matchAll(/\\definecolor\s*\{([^}]+)\}\s*\{(RGB|rgb|HTML|gray)\}\s*\{([^}]+)\}/g)) {
    const [, name, model, val] = m;
    if (model === 'HTML') defs[name] = `#${val.trim()}`;
    else if (model === 'RGB') {
      const [r, g, b] = val.split(',').map((x) => Number(x.trim()));
      defs[name] = `rgb(${r}, ${g}, ${b})`;
    } else if (model === 'rgb') {
      const [r, g, b] = val.split(',').map((x) => Math.round(Number(x.trim()) * 255));
      defs[name] = `rgb(${r}, ${g}, ${b})`;
    } else defs[name] = `rgb(${Math.round(Number(val) * 255)}, ${Math.round(Number(val) * 255)}, ${Math.round(Number(val) * 255)})`;
  }

  let struct = COLOR_THEMES[colorTheme] || t.struct || COLOR_THEMES.default;
  const set: Record<string, { fg?: string; bg?: string }> = {};
  for (const m of src.matchAll(/\\setbeamercolor\s*\{([^}]+)\}\s*\{([^}]*)\}/g)) {
    const name = m[1].trim();
    const fg = /fg\s*=\s*([^,}]+)/.exec(m[2])?.[1];
    const bg = /bg\s*=\s*([^,}]+)/.exec(m[2])?.[1];
    set[name] = { fg: fg ? xcolor(fg, defs) : undefined, bg: bg ? xcolor(fg ? bg : bg, defs) : undefined };
  }
  if (set.structure?.fg) struct = set.structure.fg;
  const mix = (pct: number, other = '#000000') => `color-mix(in srgb, ${struct} ${pct}%, ${other})`;

  const metro = t.family === 'metro';
  const title = grabOpt('title');
  const author = grabOpt('author');
  const date = grabOpt('date');
  const mixTb = metro ? '#23373b' : t.family === 'bar' ? mix(85) : 'transparent';
  const info: BeamerInfo = {
    w: wmm * MM,
    h: hmm * MM,
    fontPt,
    theme,
    family: t.family,
    headerSections: !!t.header,
    titleBar: t.family !== 'default' || !!set.frametitle?.bg,
    titleBox: t.family === 'bar' || !!set.title?.bg,
    tib: set.title?.bg || (t.family === 'bar' ? mix(85) : 'transparent'),
    tif: set.title?.fg || (t.family === 'default' ? struct : '#ffffff'),
    bodyBg: set['block body']?.bg || '',
    bodyFg: set['block body']?.fg || '#000000',
    tocFg: set['section in toc']?.fg || (t.family === 'default' ? struct : '#000000'),
    bullet: BULLETS[(/\\setbeamertemplate\s*\{items\}\s*\[([^\]]+)\]/.exec(src)?.[1] || 'default').trim()] || '▶',
    rounded: /\\setbeamertemplate\s*\{blocks\}\s*\[rounded\]/.test(src),
    footer: /\\setbeamertemplate\s*\{navigation symbols\}\s*\{\s*\}/.test(src) && (t.footer ?? 'nav') === 'nav' ? 'none' : t.footer ?? 'nav',
    struct: metro && !colorTheme && !set.structure ? '#eb811b' : struct,
    pp: set['palette primary']?.bg || mix(50),
    ps: set['palette secondary']?.bg || mix(70),
    pt3: set['palette tertiary']?.bg || mix(85),
    tb: set.frametitle?.bg || mixTb,
    tf: set.frametitle?.fg || (t.family === 'default' ? struct : '#ffffff'),
    bb: set['block title']?.bg || (metro ? '#23373b' : struct),
    bf: set['block title']?.fg || '#ffffff',
    title: title.long || '',
    shortTitle: title.short || title.long || '',
    author: author.long || '',
    shortAuthor: author.short || author.long || '',
    date: date.long ?? '',
    shortDate: date.short ?? date.long ?? '',
    sections: [],
  };
  // rodapé do documento: caixas coloridas com largura, alinhamento e texto próprios
  const fl = /\\setbeamertemplate\s*\{footline\}\s*\{/.exec(src);
  if (fl) {
    const body = braceContent(src, fl.index + fl[0].length - 1) || '';
    const boxes = [...body.matchAll(/\\begin\{beamercolorbox\}\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}([\s\S]*?)\\end\{beamercolorbox\}/g)];
    if (boxes.length) {
      const widths = boxes.map((m) => {
        const w = /wd\s*=\s*([0-9.]+)\s*\\paperwidth/.exec(m[1] || '');
        return w ? Number(w[1]) * 100 : 100 / boxes.length;
      });
      const fixed: Record<string, string> = { 'palette primary': info.pp, 'palette secondary': info.ps, 'palette tertiary': info.pt3, 'palette quaternary': info.pp };
      const sub = (t: string) =>
        t
          .replace(/\\usebeamerfont\s*\{[^}]*\}/g, '')
          .replace(/\\insertframenumber\s*(\{\})?/g, '@@n@@')
          .replace(/\\inserttotalframenumber\s*(\{\})?/g, '@@N@@')
          .replace(/\\insertshortauthor\s*(\{\})?/g, info.shortAuthor)
          .replace(/\\insertauthor\s*(\{\})?/g, info.author)
          .replace(/\\insertshorttitle\s*(\{\})?/g, info.shortTitle)
          .replace(/\\inserttitle\s*(\{\})?/g, info.title)
          .replace(/\\insertshortdate\s*(\{\})?/g, info.shortDate)
          .replace(/\\insertdate\s*(\{\})?/g, info.date)
          .trim();
      info.footerBoxes = boxes.map((m, i) => {
        const name = m[2].trim();
        const opt = m[1] || '';
        return {
          w: widths[i],
          align: /\bright\b/.test(opt) ? 'right' : /\bcenter\b/.test(opt) ? 'center' : 'left',
          bg: set[name]?.bg || fixed[name] || 'transparent',
          fg: set[name]?.fg || '#ffffff',
          raw: sub(m[3]),
        };
      });
      info.footer = 'infolines';
    }
  }
  return info;
}
