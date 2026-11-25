// Página, fonte e espaçamento de um documento LaTeX (classe, geometry, setspace, times, titlesec, fancyhdr) e expansão de \newcommand.
export interface Layout {
  pageW: number; // px a 96 dpi
  pageH: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  fontPx: number;
  linePx: number;
  parindentPx: number;
  indentFirst: boolean;
  serif: 'times' | 'cm';
  lang: string;
  numbering: 'bottom' | 'top-right' | 'none';
  /** estilos de \section, \subsection, \subsubsection */
  headings: Array<{ size: number; bold: boolean; upper: boolean }>;
}

const PT = 96 / 72;
const UNIT: Record<string, number> = { cm: 96 / 2.54, mm: 96 / 25.4, in: 96, pt: PT, px: 1, bp: PT, ex: 0, em: 0 };

export function lengthToPx(v: string, em = 16): number | undefined {
  const m = /^\s*(-?[0-9.]+)\s*(cm|mm|in|pt|px|bp|ex|em)\b/.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (m[2] === 'em') return n * em;
  if (m[2] === 'ex') return n * em * 0.43;
  return n * UNIT[m[2]];
}

function braceContent(s: string, from: number): { text: string; end: number } | null {
  let depth = 0;
  for (let k = from; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') k++;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return { text: s.slice(from + 1, k), end: k + 1 };
  }
  return null;
}

/** \newcommand, \renewcommand, \providecommand e \def (com até 9 argumentos): remove as definições e expande os usos. */
export function expandMacros(src: string): string {
  const macros = new Map<string, { n: number; body: string }>();
  let out = '';
  let i = 0;
  const defRe = /\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand)\*?\s*\{?\\([a-zA-Z@]+)\}?\s*(?:\[(\d)\])?\s*(?:\[[^\]]*\])?\s*\{|\\def\\([a-zA-Z@]+)((?:#\d)*)\s*\{/g;
  for (;;) {
    defRe.lastIndex = i;
    const m = defRe.exec(src);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const body = braceContent(src, open);
    if (!body) break;
    out += src.slice(i, m.index);
    const name = m[1] || m[3];
    const n = m[2] ? Number(m[2]) : m[4] ? m[4].length / 2 : 0;
    macros.set(name, { n, body: body.text });
    i = body.end;
  }
  out += src.slice(i);
  if (!macros.size) return out;
  const names = [...macros.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\\\(${names.join('|')})(?![a-zA-Z@])`, 'g');
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    let res = '';
    let last = 0;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(out))) {
      const mac = macros.get(m[1])!;
      let end = m.index + m[0].length;
      const args: string[] = [];
      let ok = true;
      for (let a = 0; a < mac.n; a++) {
        let j = end;
        while (/\s/.test(out[j] || '')) j++;
        if (out[j] === '{') {
          const g = braceContent(out, j);
          if (!g) {
            ok = false;
            break;
          }
          args.push(g.text);
          end = g.end;
        } else {
          args.push(out[j] || '');
          end = j + 1;
        }
      }
      if (!ok) continue;
      // como o TeX, o espaço depois de um comando sem argumento é descartado
      if (mac.n === 0) while (/[ \t]/.test(out[end] || '')) end++;
      res += out.slice(last, m.index) + mac.body.replace(/#(\d)/g, (_x, d) => args[Number(d) - 1] ?? '');
      last = end;
      re.lastIndex = end;
      changed = true;
    }
    res += out.slice(last);
    out = res;
    if (!changed) break;
  }
  return out;
}

export function parseLayout(source: string, preamble: string): Layout {
  const cls = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/.exec(source);
  const opts = cls?.[1] || '';
  const fontPt = Number(/(\d+)pt/.exec(opts)?.[1]) || 10;
  const a4 = /a4paper/.test(opts);
  const a5 = /a5paper/.test(opts);
  let pageW = a4 ? 794 : a5 ? 559 : 816;
  let pageH = a4 ? 1123 : a5 ? 794 : 1056;
  if (/landscape/.test(opts)) [pageW, pageH] = [pageH, pageW];
  const fontPx = fontPt * PT;

  // espaçamento entre linhas (baselineskip x estiramento do setspace)
  const baseline = fontPt <= 10 ? 12 : fontPt === 11 ? 13.6 : fontPt === 12 ? 14.5 : fontPt * 1.2;
  let stretch = 1;
  if (/\\(onehalfspacing)\b/.test(preamble)) stretch = fontPt <= 10 ? 1.25 : fontPt === 11 ? 1.24 : 1.213;
  else if (/\\doublespacing\b/.test(preamble)) stretch = fontPt <= 10 ? 1.667 : fontPt === 11 ? 1.655 : 1.618;
  const ls = /\\(?:linespread|setstretch)\s*\{([0-9.]+)\}/.exec(preamble)?.[1];
  if (ls) stretch = Number(ls);
  const linePx = baseline * stretch * PT;

  // margens: padrão do LaTeX (texto centralizado) ou o pacote geometry
  const tw = (fontPt <= 10 ? 345 : fontPt === 11 ? 360 : 390) * PT;
  const th = (fontPt <= 10 ? 556 : fontPt === 11 ? 602 : 634) * PT;
  let left = (pageW - tw) / 2;
  let right = left;
  let top = Math.max(40, (pageH - th) / 2 - 18);
  let bottom = pageH - top - th;
  const geo = /\\usepackage\s*\[([^\]]*)\]\s*\{geometry\}/.exec(preamble)?.[1] || /\\geometry\s*\{([^}]*)\}/.exec(preamble)?.[1] || '';
  if (geo) {
    const get = (k: string) => {
      const m = new RegExp(`(?:^|[,\\s])${k}\\s*=\\s*([^,]+)`).exec(geo);
      return m ? lengthToPx(m[1], fontPx) : undefined;
    };
    const all = get('margin');
    const h = get('hmargin') ?? all;
    const v = get('vmargin') ?? all;
    left = get('left') ?? get('inner') ?? h ?? left;
    right = get('right') ?? get('outer') ?? h ?? right;
    top = get('top') ?? v ?? top;
    bottom = get('bottom') ?? v ?? bottom;
    if (/a4paper/.test(geo)) [pageW, pageH] = [794, 1123];
    if (/letterpaper/.test(geo)) [pageW, pageH] = [816, 1056];
  }

  const pi = /\\setlength\s*\{\\parindent\}\s*\{([^}]*)\}/.exec(preamble)?.[1];
  const parindentPx = (pi && lengthToPx(pi, fontPx)) ?? (fontPt <= 10 ? 15 * PT : fontPt === 11 ? 17 * PT : 1.5 * fontPx);

  const times = /\\usepackage(?:\[[^\]]*\])?\{(times|mathptmx|newtxtext|tgtermes|txfonts|newtx|libertine|mathpazo)\}/.test(preamble);
  const babel = /\\usepackage\s*\[([^\]]*)\]\s*\{babel\}/.exec(preamble)?.[1] || '';
  const lang = /brazil|portuguese/i.test(babel) ? 'pt-BR' : /spanish/i.test(babel) ? 'es' : /french/i.test(babel) ? 'fr' : /german|ngerman/i.test(babel) ? 'de' : 'en';

  // numeração de página: fancyhdr com número no cabeçalho, \pagestyle{empty} ou padrão (rodapé central)
  let numbering: Layout['numbering'] = 'bottom';
  if (/\\pagestyle\s*\{empty\}/.test(preamble)) numbering = 'none';
  else if (/\\pagestyle\s*\{fancy\}/.test(preamble)) {
    const head = /\\fancyhead\s*\[R[^\]]*\]\s*\{[^}]*\\thepage/.test(preamble) || /\\fancyhead\s*\[[^\]]*R[^\]]*\]\s*\{[^}]*\\thepage/.test(preamble);
    const foot = /\\fancyfoot\s*\[[^\]]*\]\s*\{[^}]*\\thepage/.test(preamble) || /\\cfoot\s*\{[^}]*\\thepage/.test(preamble) || /\\rfoot\s*\{[^}]*\\thepage/.test(preamble);
    numbering = head ? 'top-right' : foot ? 'bottom' : /\\fancyhf\s*\{\s*\}/.test(preamble) ? 'none' : 'bottom';
  }

  // títulos: padrão do LaTeX (\Large\bfseries...) ou \titleformat do titlesec
  const sizeOf = (fmt: string, dflt: number) => (/\\Huge\b/.test(fmt) ? 2.49 : /\\huge\b/.test(fmt) ? 2.07 : /\\LARGE\b/.test(fmt) ? 1.73 : /\\Large\b/.test(fmt) ? 1.44 : /\\large\b/.test(fmt) ? 1.2 : /\\normalsize\b/.test(fmt) ? 1 : /\\small\b/.test(fmt) ? 0.9 : dflt);
  const tf = (name: string, dflt: { size: number; bold: boolean; upper: boolean }) => {
    const m = new RegExp(`\\\\titleformat\\s*\\{\\\\${name}\\}(?:\\[[^\\]]*\\])?\\s*\\{`).exec(preamble);
    if (!m) return dflt;
    const fmt = braceContent(preamble, m.index + m[0].length - 1)?.text || '';
    return { size: sizeOf(fmt, dflt.size), bold: /\\bfseries|\\textbf/.test(fmt) || (!/\\normalfont\s*$/.test(fmt) && dflt.bold && !/\\mdseries/.test(fmt) && /bfseries/.test(fmt)), upper: /\\uppercase|\\MakeUppercase/.test(fmt) };
  };
  const headings = [tf('section', { size: 1.44, bold: true, upper: false }), tf('subsection', { size: 1.2, bold: true, upper: false }), tf('subsubsection', { size: 1, bold: true, upper: false })];
  return { pageW, pageH, top, bottom, left, right, fontPx, linePx, parindentPx, indentFirst: /\\usepackage(?:\[[^\]]*\])?\{indentfirst\}/.test(preamble), serif: times ? 'times' : 'cm', lang, numbering, headings };
}
