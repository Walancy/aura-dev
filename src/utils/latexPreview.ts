// Prévia rápida de arquivos .tex: converte o subconjunto mais usado de LaTeX em HTML (fórmulas com KaTeX).
// Não substitui o compilador: pacotes e macros próprias não são interpretados (para isso há a aba PDF).
import katex from 'katex';
import { parseBeamer, type BeamerInfo } from './beamerTheme';
import { expandMacros, parseLayout, lengthToPx, type Layout } from './latexLayout';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PH = (n: number) => `${n}`;

/** Posição do `}` que fecha o `{` em `i` (ou -1). */
function closeBrace(s: string, i: number): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') k++;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return k;
  }
  return -1;
}

/** Primeiro argumento entre chaves depois de `from` (ignora espaços e um argumento opcional [..]). */
function arg(s: string, from: number): { text: string; end: number } | null {
  let i = from;
  while (/\s/.test(s[i] || '')) i++;
  if (s[i] === '[') {
    const e = s.indexOf(']', i);
    if (e < 0) return null;
    i = e + 1;
    while (/\s/.test(s[i] || '')) i++;
  }
  if (s[i] !== '{') return null;
  const e = closeBrace(s, i);
  return e < 0 ? null : { text: s.slice(i + 1, e), end: e + 1 };
}

/** Fim do ambiente que abre em `start` (índice de `\begin{env}`), contando ambientes iguais aninhados. */
function envEnd(s: string, env: string, from: number): number {
  const open = `\\begin{${env}}`;
  const close = `\\end{${env}}`;
  let depth = 1;
  let i = from;
  while (depth > 0) {
    const o = s.indexOf(open, i);
    const c = s.indexOf(close, i);
    if (c < 0) return -1;
    if (o >= 0 && o < c) {
      depth++;
      i = o + open.length;
    } else {
      depth--;
      i = c + close.length;
      if (depth === 0) return c;
    }
  }
  return -1;
}

const MATH_ENVS = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'eqnarray', 'eqnarray*', 'displaymath', 'math'];

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false });
  } catch {
    return `<code>${esc(tex)}</code>`;
  }
}

function mathEnv(env: string, body: string): string {
  const b = body.replace(/\\label\{[^}]*\}/g, '').replace(/\\nonumber/g, '');
  const base = env.replace('*', '');
  if (base === 'align' || base === 'eqnarray') return `\\begin{aligned}${b.replace(/&=&/g, '&=')}\\end{aligned}`;
  if (base === 'gather') return `\\begin{gathered}${b}\\end{gathered}`;
  if (base === 'multline') return `\\begin{gathered}${b}\\end{gathered}`;
  return b;
}

interface Doc {
  title?: string;
  author?: string;
  date?: string;
  subtitle?: string;
  institute?: string;
}

const CMD_TEXT: Record<string, string> = {
  LaTeX: 'LaTeX',
  TeX: 'TeX',
  ldots: '…',
  dots: '…',
  textbackslash: '\\',
  today: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
  S: '§',
  P: '¶',
  copyright: '©',
  pounds: '£',
  textendash: '–',
  textemdash: '—',
  par: '\n\n',
  newline: '<br>',
  linebreak: '<br>',
};
const ACCENTS: Record<string, string> = { "'": '́', '`': '̀', '^': '̂', '"': '̈', '~': '̃', c: '̧' };
const WRAP: Record<string, [string, string]> = {
  MakeUppercase: ['<span style="text-transform:uppercase">', '</span>'],
  uppercase: ['<span style="text-transform:uppercase">', '</span>'],
  MakeLowercase: ['<span style="text-transform:lowercase">', '</span>'],
  textbf: ['<strong>', '</strong>'],
  bfseries: ['<strong>', '</strong>'],
  textit: ['<em>', '</em>'],
  emph: ['<em>', '</em>'],
  textsl: ['<em>', '</em>'],
  itshape: ['<em>', '</em>'],
  underline: ['<u>', '</u>'],
  texttt: ['<code>', '</code>'],
  textsc: ['<span style="font-variant:small-caps">', '</span>'],
  textsf: ['<span style="font-family:sans-serif">', '</span>'],
  textsuperscript: ['<sup>', '</sup>'],
  textsubscript: ['<sub>', '</sub>'],
  alert: ['<span class="tex-alert">', '</span>'],
  structure: ['<span class="tex-struct">', '</span>'],
  mbox: ['<span>', '</span>'],
  text: ['<span>', '</span>'],
};
const SECTIONS: Record<string, { tag: string; num: number }> = {
  part: { tag: 'h1', num: 0 },
  chapter: { tag: 'h1', num: 1 },
  section: { tag: 'h2', num: 1 },
  subsection: { tag: 'h3', num: 2 },
  subsubsection: { tag: 'h4', num: 3 },
  paragraph: { tag: 'h5', num: 0 },
  subparagraph: { tag: 'h6', num: 0 },
};
const DROP_WITH_ARG = new Set(['label', 'vspace', 'hspace', 'vspace*', 'hspace*', 'usepackage', 'bibliographystyle', 'bibliography', 'index', 'pagestyle', 'thispagestyle', 'setlength', 'setcounter', 'graphicspath', 'input', 'include', 'cite*', 'noindent', 'centering', 'tableofcontents', 'listoffigures', 'listoftables', 'clearpage', 'newpage', 'pagebreak', 'bigskip', 'medskip', 'smallskip', 'hfill', 'vfill', 'raggedright', 'raggedleft', 'small', 'footnotesize', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'normalsize', 'tiny', 'scriptsize', 'normalfont', 'rmfamily']);

export function texToHtml(source: string, images: Record<string, string> = {}): { html: string; doc: Doc; slides?: string[]; beamer?: BeamerInfo; layout?: Layout } {
  const beamer = /\\documentclass\s*(\[[^\]]*\])?\s*\{beamer\}/.test(source);
  const slides: string[] = [];
  // comentários (% sem barra antes)
  let src = source.replace(/(^|[^\\])%.*$/gm, '$1');
  const rawBody = /\\begin\{document\}/.exec(src);
  const layout = beamer ? undefined : parseLayout(src, rawBody ? src.slice(0, rawBody.index) : src);
  src = expandMacros(src);
  const doc: Doc = {};
  const body0 = /\\begin\{document\}([\s\S]*?)(\\end\{document\}|$)/.exec(src);
  const preamble = body0 ? src.slice(0, body0.index) : '';
  const grab = (name: string, from = preamble) => {
    const m = new RegExp(`\\\\${name}\\s*(?:\\[[^\\]]*\\])?\\s*\\{`).exec(from);
    if (!m) return undefined;
    const open = m.index + m[0].length - 1;
    const e = closeBrace(from, open);
    return e < 0 ? undefined : from.slice(open + 1, e);
  };
  const grabOpt = (name: string) => {
    const m = new RegExp(`\\\\${name}\\s*(?:\\[([^\\]]*)\\])?\\s*\\{`).exec(preamble);
    if (!m) return {} as { short?: string; long?: string };
    const open = m.index + m[0].length - 1;
    const e = closeBrace(preamble, open);
    return { short: m[1], long: e < 0 ? undefined : preamble.slice(open + 1, e) } as { short?: string; long?: string };
  };
  const sectionList: string[] = [];
  const tocSections: string[] = [];
  const tocAll: Array<{ level: number; num: string; text: string; id: string }> = [];
  let headIdx = 0;
  let curSection = -1;
  doc.title = grab('title');
  doc.author = grab('author');
  doc.date = grab('date');
  doc.subtitle = grab('subtitle');
  doc.institute = grab('institute');
  src = body0 ? body0[1] : src;
  // sem \begin{document}: remove linhas de preâmbulo soltas
  if (!body0) src = src.replace(/\\(documentclass|usepackage)(\[[^\]]*\])?\{[^}]*\}/g, '');

  for (const m of src.matchAll(/\\section\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)) tocSections.push(m[1]);
  {
    const c = [0, 0, 0];
    for (const m of src.matchAll(/\\(section|subsection|subsubsection)(\*?)\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)) {
      if (m[2]) continue;
      const lvl = m[1] === 'section' ? 0 : m[1] === 'subsection' ? 1 : 2;
      c[lvl]++;
      for (let k = lvl + 1; k < 3; k++) c[k] = 0;
      tocAll.push({ level: lvl, num: c.slice(0, lvl + 1).join('.'), text: m[3], id: `tex-s${tocAll.length}` });
    }
  }
  const store: string[] = [];
  const keep = (h: string) => {
    store.push(h);
    return PH(store.length - 1);
  };

  // 1) blocos que não podem ser processados como texto: verbatim e matemática
  src = src.replace(/\\begin\{(verbatim\*?|lstlisting|minted)\}(?:\[[^\]]*\])?(?:\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g, (_m, _e, code) => keep(`<pre>${esc(code.replace(/^\n/, ''))}</pre>`));
  const labels: Record<string, string> = {};
  let eqN = 0;
  const envNames = MATH_ENVS.map((e) => e.replace('*', '\\*')).join('|');
  src = src.replace(new RegExp(`\\\\begin\\{(${envNames})\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, 'g'), (_m, env: string, b: string) => {
    const numbered = !env.endsWith('*') && env !== 'displaymath' && env !== 'math';
    let tag = '';
    if (numbered) {
      eqN++;
      for (const lab of b.matchAll(/\\label\{([^}]*)\}/g)) labels[lab[1]] = String(eqN);
      tag = `<span class="tex-eqno">(${eqN})</span>`;
    }
    return keep(`<div class="tex-eq">${renderMath(mathEnv(env, b), true)}${tag}</div>`);
  });
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, b) => keep(`<div class="tex-eq">${renderMath(b, true)}</div>`));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_m, b) => keep(`<div class="tex-eq">${renderMath(b, true)}</div>`));
  src = src.replace(/\\\(([\s\S]+?)\\\)/g, (_m, b) => keep(renderMath(b, false)));
  src = src.replace(/(^|[^\\$])\$([^$\n]+(?:\n[^$\n]+)*)\$/g, (_m, pre, b) => pre + keep(renderMath(b, false)));

  const footnotes: string[] = [];
  const counters = [0, 0, 0, 0];
  const caps = { figure: 0, table: 0 };

  // ---------- texto corrido (comandos inline) ----------
  const inline = (s: string): string => {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        const m = /^\\([a-zA-Z]+\*?|.)/.exec(s.slice(i));
        if (!m) {
          i++;
          continue;
        }
        const name = m[1];
        i += m[0].length;
        // especificação de overlay do Beamer (\only<2>{..}, \alert<1->{..}): a prévia mostra tudo
        if (/^[a-zA-Z]/.test(name) && s[i] === '<' && /^<[0-9a-z,\-+|:\s]*>/i.test(s.slice(i))) i += /^<[^>]*>/.exec(s.slice(i))![0].length;
        if (name === '\\') {
          out += '<br>';
          const o = /^\s*\[([^\]]*)\]/.exec(s.slice(i));
          if (o) {
            i += o[0].length;
            const px = lengthToPx(o[1]);
            if (px && px > 0) out += `<span class="tex-vs" style="height:${px.toFixed(1)}px"></span>`;
          }
          continue;
        }
        if (name === 'vspace' || name === 'vspace*') {
          const a = arg(s, i);
          if (a) {
            const px = lengthToPx(a.text);
            if (px && px > 0) out += `<span class="tex-vs" style="height:${px.toFixed(1)}px"></span>`;
            i = a.end;
          }
          continue;
        }
        if (name === 'bigskip' || name === 'medskip' || name === 'smallskip') {
          out += `<span class="tex-vs" style="height:${name === 'bigskip' ? 16 : name === 'medskip' ? 8 : 4}px"></span>`;
          continue;
        }
        if (name === 'hfill') {
          out += '<span class="tex-hfill"></span>';
          continue;
        }
        if (name === 'vfill') {
          out += '<span class="tex-vfill"></span>';
          continue;
        }
        if ('%&_#${}'.includes(name) && name.length === 1) {
          out += esc(name);
          continue;
        }
        if (name === ',' || name === ';' || name === ':' || name === ' ' || name === '!' || name === '/') {
          out += name === '!' || name === '/' ? '' : '&nbsp;';
          continue;
        }
        if (ACCENTS[name] && name.length === 1) {
          const rest = /^\{?([a-zA-Z])\}?/.exec(s.slice(i));
          if (rest) {
            out += esc(rest[1] + ACCENTS[name]).normalize('NFC');
            i += rest[0].length;
          }
          continue;
        }
        if (name in CMD_TEXT) {
          out += CMD_TEXT[name];
          if (s[i] === '{' && s[i + 1] === '}') i += 2;
          continue;
        }
        if (name in WRAP) {
          const a = arg(s, i);
          if (a) {
            out += WRAP[name][0] + inline(a.text) + WRAP[name][1];
            i = a.end;
          } else if (name === 'bfseries' || name === 'itshape') {
            out += WRAP[name][0];
          }
          continue;
        }
        if (name === 'footnote' || name === 'thanks') {
          const a = arg(s, i);
          if (a) {
            footnotes.push(inline(a.text));
            out += `<sup class="tex-fn">${footnotes.length}</sup>`;
            i = a.end;
          }
          continue;
        }
        if (name === 'cite' || name === 'citep' || name === 'citet' || name === 'nocite') {
          const a = arg(s, i);
          if (a) {
            if (name !== 'nocite') out += `<span class="tex-ref">[${esc(a.text)}]</span>`;
            i = a.end;
          }
          continue;
        }
        if (name === 'ref' || name === 'eqref' || name === 'autoref' || name === 'pageref') {
          const a = arg(s, i);
          if (a) {
            const t = labels[a.text] || '?';
            out += `<span class="tex-ref">${name === 'eqref' ? `(${t})` : t}</span>`;
            i = a.end;
          }
          continue;
        }
        if (name === 'url') {
          const a = arg(s, i);
          if (a) {
            out += `<a href="${esc(a.text)}">${esc(a.text)}</a>`;
            i = a.end;
          }
          continue;
        }
        if (name === 'href') {
          const a = arg(s, i);
          const b = a && arg(s, a.end);
          if (a && b) {
            out += `<a href="${esc(a.text)}">${inline(b.text)}</a>`;
            i = b.end;
          }
          continue;
        }
        if (name === 'textcolor' || name === 'colorbox') {
          const a = arg(s, i);
          const b = a && arg(s, a.end);
          if (a && b) {
            out += inline(b.text);
            i = b.end;
          }
          continue;
        }
        if (name === 'includegraphics') {
          const opt = /^\s*\[([^\]]*)\]/.exec(s.slice(i))?.[1] || '';
          const a = arg(s, i);
          if (a) {
            const src = images[a.text.trim()];
            if (src) {
              const rel = (key: string) => {
                const m = new RegExp(`${key}\\s*=\\s*([0-9.]+)\\s*\\\\(textwidth|linewidth|columnwidth|textheight|paperheight|paperwidth)`).exec(opt);
                if (!m) return '';
                const v = /height/.test(m[2]) ? 'var(--th, 600px)' : '100%';
                return /height/.test(m[2]) ? `${key}:calc(${Number(m[1])} * ${v})` : `${key}:${Math.round(Number(m[1]) * 100)}%`;
              };
              const absLen = (key: string) => {
                const m = new RegExp(`${key}\\s*=\\s*([0-9.]+)\\s*(cm|mm|in|pt|px)`).exec(opt);
                if (!m) return '';
                const k = ({ cm: 28.35, mm: 2.835, in: 72, pt: 1, px: 0.75 } as Record<string, number>)[m[2]];
                return `${key}:calc(${(Number(m[1]) * k).toFixed(1)} * var(--pt, 1.333px))`;
              };
              const sc = /scale\s*=\s*([0-9.]+)/.exec(opt);
              const css = [rel('width') || absLen('width'), rel('height') || absLen('height'), !rel('width') && !absLen('width') && sc ? `width:${Math.round(Number(sc[1]) * 100)}%` : ''].filter(Boolean).join(';');
              out += `<img class="tex-pic" src="${src}" alt="${esc(a.text)}" style="max-width:100%;${css}${/height\s*=/.test(opt) && !/width\s*=/.test(opt) ? ';width:auto' : ''}">`;
            } else {
              out += `<span class="tex-img">${esc(a.text.split('/').pop() || a.text)}</span>`;
            }
            i = a.end;
          }
          continue;
        }
        if (s[i] === '<' && /^<[0-9a-z,\-+|:\s]*>/i.test(s.slice(i))) i += /^<[^>]*>/.exec(s.slice(i))![0].length;
        if (name === 'tableofcontents') {
          if (s[i] === '[') i = s.indexOf(']', i) + 1;
          if (beamer || !tocAll.length) out += keep(`<ul class="tex-toc">${tocSections.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
          else
            out += keep(
              `<div class="tex-tocdoc"><h2 class="tex-toctitle">${layout?.lang === 'pt-BR' ? 'Sumário' : 'Contents'}</h2>${tocAll
                .map((e) => `<div class="toc l${e.level}"><span>${e.num} ${inline(e.text)}</span><span class="dots"></span><span class="pg" data-for="${e.id}"></span></div>`)
                .join('')}</div>`,
            );
          continue;
        }
        if (name === 'maketitle' || name === 'titlepage' || name === 'pause') continue;
        if (name === 'item') continue;
        if (DROP_WITH_ARG.has(name)) {
          if (name === 'label') {
            const a = arg(s, i);
            if (a) i = a.end;
          } else if (['vspace', 'hspace', 'vspace*', 'hspace*', 'usepackage', 'bibliographystyle', 'bibliography', 'pagestyle', 'thispagestyle', 'setlength', 'setcounter', 'graphicspath', 'input', 'include', 'index', 'cite*'].includes(name)) {
            const a = arg(s, i);
            if (a) i = a.end;
            if (name === 'setlength' || name === 'setcounter') {
              const b = arg(s, i);
              if (b) i = b.end;
            }
          }
          continue;
        }
        // comando desconhecido: mantém o conteúdo das chaves, sem o nome
        continue;
      }
      if (c === '{' || c === '}') {
        i++;
        continue;
      }
      if (c === '~') {
        out += '&nbsp;';
        i++;
        continue;
      }
      if (c === '-' && s[i + 1] === '-') {
        const three = s[i + 2] === '-';
        out += three ? '—' : '–';
        i += three ? 3 : 2;
        continue;
      }
      if (c === '`' && s[i + 1] === '`') {
        out += '“';
        i += 2;
        continue;
      }
      if (c === "'" && s[i + 1] === "'") {
        out += '”';
        i += 2;
        continue;
      }
      if (c === '<' || c === '>' || c === '&') {
        out += esc(c);
        i++;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  };

  // ---------- estrutura (ambientes, seções, parágrafos) ----------
  const table = (spec: string, content: string): string => {
    const rows = content
      .split(/\\\\(?:\[[^\]]*\])?/)
      .map((r) => r.trim())
      .filter((r) => r && r !== '\\hline');
    const colDefs: Array<{ a: string; w?: string }> = [];
    for (const m of spec.matchAll(/([lcr])|[pmb]\{([0-9.]+)\s*(cm|mm|pt|in)\}|[pmbX]/g)) {
      if (m[1]) colDefs.push({ a: m[1] });
      else {
        const k = ({ cm: 28.35, mm: 2.835, pt: 1, in: 72 } as Record<string, number>)[m[3]] || 0;
        colDefs.push({ a: 'l', w: m[2] && k ? `calc(${(Number(m[2]) * k).toFixed(1)} * var(--pt, 1.333px))` : undefined });
      }
    }
    const aligns = colDefs.map((c) => c.a);
    const html = rows
      .map((r) => {
        const top = /^\\(hline|toprule|midrule)/.test(r);
        const clean = r.replace(/\\hline|\\toprule|\\midrule|\\bottomrule|\\cline\{[^}]*\}/g, '').trim();
        if (!clean) return '';
        const cells = clean.split(/(?<!\\)&/).map((cell, ci) => `<td style="text-align:${aligns[ci] === 'c' ? 'center' : aligns[ci] === 'r' ? 'right' : 'left'}${colDefs[ci]?.w ? `;width:${colDefs[ci].w};vertical-align:top` : ''}">${inline(cell.trim())}</td>`);
        return `<tr${top ? ' class="top"' : ''}>${cells.join('')}</tr>`;
      })
      .join('');
    return `<table class="tex-table">${html}</table>`;
  };

  const lines = (s: string): string => {
    const paras = s.split(/\n\s*\n/);
    return paras
      .map((p) => {
        const t = p.trim();
        if (!t) return '';
        const al = /^\\(centering|raggedright|raggedleft)\b\s*/.exec(t);
        const h = inline(al ? t.slice(al[0].length) : t);
        if (!h.includes('<img') && !h.replace(/<[^>]*>|&nbsp;|\s/g, '')) return '';
        const pure = h.split('\ue000').length > 1 && h.replace(/\ue000\d+\ue001|\s/g, '') === '';
        if (pure && !al) return h;
        const style = al ? ` style="text-align:${al[1] === 'centering' ? 'center' : al[1] === 'raggedleft' ? 'right' : 'left'};text-indent:0"` : '';
        if (h.includes('<img')) return `<div class="tex-p tex-imgrow"${style}>${h}</div>`;
        return h.includes('\ue000') ? `<div class="tex-p"${style}>${h}</div>` : `<p${style}>${h}</p>`;
      })
      .join('\n');
  };

  const block = (s: string): string => {
    let out = '';
    let i = 0;
    let buf = '';
    const flush = () => {
      if (buf.trim()) out += lines(buf);
      buf = '';
    };
    while (i < s.length) {
      if (s.startsWith('\\begin{', i)) {
        const e1 = s.indexOf('}', i + 7);
        const env = s.slice(i + 7, e1);
        const end = envEnd(s, env, e1 + 1);
        if (e1 > 0 && end > 0) {
          flush();
          const inner = s.slice(e1 + 1, end);
          out += environment(env, inner);
          i = end + `\\end{${env}}`.length;
          continue;
        }
      }
      const sec = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)/.exec(s.slice(i));
      if (sec) {
        const a = arg(s, i + sec[0].length);
        if (a) {
          flush();
          const info = SECTIONS[sec[1]];
          let numTxt = '';
          if (!sec[2] && info.num > 0) {
            counters[info.num - 1]++;
            for (let k = info.num; k < counters.length; k++) counters[k] = 0;
            numTxt = `${counters.slice(0, info.num).join('.')} `;
          }
          const lab = /^\s*\\label\{([^}]*)\}/.exec(s.slice(a.end));
          if (lab) labels[lab[1]] = numTxt.trim();
          if (beamer && sec[1] === 'section') {
            sectionList.push(inline(a.text));
            curSection = sectionList.length - 1;
          }
          const hid = !sec[2] && info.num > 0 && info.num <= 3 && tocAll[headIdx] ? tocAll[headIdx++].id : '';
          out += `<${info.tag}${hid ? ` id="${hid}"` : ''}>${numTxt ? `<span class="sn">${numTxt.trim()}</span>` : ''}${inline(a.text)}</${info.tag}>`;
          i = a.end;
          continue;
        }
      }
      if (s.startsWith('\\titlepage', i)) {
        flush();
        out += titleBlock();
        i += '\\titlepage'.length;
        continue;
      }
      if (s.startsWith('\\maketitle', i)) {
        flush();
        out += titleBlock();
        i += '\\maketitle'.length;
        continue;
      }
      if (/^\\(newpage|clearpage|pagebreak)/.test(s.slice(i))) {
        flush();
        out += '<div class="tex-pagebreak"></div>';
        i += /^\\(newpage|clearpage|pagebreak)/.exec(s.slice(i))![0].length;
        continue;
      }
      buf += s[i];
      i++;
    }
    flush();
    return out;
  };

  /** \vfill no nível do ambiente: reparte o conteúdo e empurra as partes para as pontas da página. */
  const splitV = (inner: string): string => {
    const parts: string[] = [];
    let depth = 0;
    let last = 0;
    for (let k = 0; k < inner.length; k++) {
      if (inner.startsWith('\\begin{', k)) depth++;
      else if (inner.startsWith('\\end{', k)) depth--;
      else if (depth === 0 && inner.startsWith('\\vfill', k) && !/[a-zA-Z]/.test(inner[k + 6] || '')) {
        parts.push(inner.slice(last, k));
        last = k + 6;
      }
    }
    if (!parts.length) return block(inner);
    parts.push(inner.slice(last));
    return `<div class="tex-vsplit">${parts.map((p) => `<div>${block(p)}</div>`).join('<div class="tex-vfillbox"></div>')}</div>`;
  };

  const environment = (env: string, inner: string): string => {
    switch (env) {
      case 'itemize':
      case 'enumerate': {
        const parts = splitItems(inner);
        const tag = env === 'itemize' ? 'ul' : 'ol';
        return `<${tag}>${parts.map((p) => `<li>${block(p.text) || ''}</li>`).join('')}</${tag}>`;
      }
      case 'description': {
        const parts = splitItems(inner);
        return `<dl>${parts.map((p) => `<dt>${inline(p.label || '')}</dt><dd>${block(p.text)}</dd>`).join('')}</dl>`;
      }
      case 'abstract':
        return `<div class="tex-abstract"><strong>Resumo</strong>${block(inner)}</div>`;
      case 'quote':
      case 'quotation':
        return `<blockquote>${block(inner)}</blockquote>`;
      case 'center':
        return `<div class="tex-center" style="text-align:center">${splitV(inner)}</div>`;
      case 'flushright':
        return `<div style="text-align:right">${splitV(inner)}</div>`;
      case 'flushleft':
        return `<div style="text-align:left">${splitV(inner)}</div>`;
      case 'titlepage':
        return `<div class="tex-titlepage">${splitV(inner)}</div>`;
      case 'minipage': {
        const a = arg(inner, 0);
        const w = a ? lengthToPx(a.text.replace(/\\(textwidth|linewidth)/, 'em')) : undefined;
        const rel = a ? /([0-9.]+)\s*\\(?:textwidth|linewidth|columnwidth)/.exec(a.text) : null;
        return `<div class="tex-minipage" style="width:${rel ? `${Number(rel[1]) * 100}%` : w ? `${w.toFixed(0)}px` : 'auto'}">${block(a ? inner.slice(a.end) : inner)}</div>`;
      }
      case 'figure':
      case 'figure*':
      case 'table':
      case 'table*': {
        const isFig = env.startsWith('figure');
        const cap = /\\caption\s*(?:\[[^\]]*\])?\s*\{/.exec(inner);
        let capHtml = '';
        let rest = inner;
        if (cap) {
          const open = cap.index + cap[0].length - 1;
          const e = closeBrace(inner, open);
          if (e > 0) {
            caps[isFig ? 'figure' : 'table']++;
            const lab = /\\label\{([^}]*)\}/.exec(inner.slice(e));
            if (lab) labels[lab[1]] = String(caps[isFig ? 'figure' : 'table']);
            capHtml = `<figcaption>${isFig ? 'Figura' : 'Tabela'} ${caps[isFig ? 'figure' : 'table']}: ${inline(inner.slice(open + 1, e))}</figcaption>`;
            rest = inner.slice(0, cap.index) + inner.slice(e + 1);
          }
        }
        return `<figure>${block(rest)}${capHtml}</figure>`;
      }
      case 'tabular':
      case 'tabular*':
      case 'tabularx': {
        const a = arg(inner, 0);
        const spec = a ? a.text : '';
        return table(spec, a ? inner.slice(a.end) : inner);
      }
      case 'thebibliography':
        return `<h2>Referências</h2><ol class="tex-bib">${splitBib(inner)
          .map((b) => `<li>${inline(b)}</li>`)
          .join('')}</ol>`;
      case 'frame': {
        const fOpt = /^\s*\[([^\]]*)\]/.exec(inner)?.[1] || '';
        let rest = inner.replace(/^\s*\[[^\]]*\]/, '');
        let title = '';
        let sub = '';
        const a1 = arg(rest, 0);
        if (a1 && /^\s*\{/.test(rest)) {
          title = a1.text;
          rest = rest.slice(a1.end);
          const a2 = /^\s*\{/.test(rest) ? arg(rest, 0) : null;
          if (a2) {
            sub = a2.text;
            rest = rest.slice(a2.end);
          }
        }
        const ft = /\\frametitle\s*(?:<[^>]*>)?\s*\{/.exec(rest);
        if (ft) {
          const o = ft.index + ft[0].length - 1;
          const e = closeBrace(rest, o);
          if (e > 0) {
            title = rest.slice(o + 1, e);
            rest = rest.slice(0, ft.index) + rest.slice(e + 1);
          }
        }
        const fs2 = /\\framesubtitle\s*(?:<[^>]*>)?\s*\{/.exec(rest);
        if (fs2) {
          const o = fs2.index + fs2[0].length - 1;
          const e = closeBrace(rest, o);
          if (e > 0) {
            sub = rest.slice(o + 1, e);
            rest = rest.slice(0, fs2.index) + rest.slice(e + 1);
          }
        }
        const isTitle = /\\(titlepage|maketitle)\b/.test(rest) && !title;
        const html = `<section class="tex-slide${isTitle ? ' tex-titleslide' : ''}${/(^|,)\s*[tT]\s*(,|$)/.test(fOpt) ? ' tex-top' : ''}" data-sec="${curSection}">${title ? `<div class="tex-ftitle">${inline(title)}</div>` : ''}${sub ? `<div class="tex-fsub">${inline(sub)}</div>` : ''}<div class="tex-fbody"><div class="tex-fin">${block(rest)}</div></div></section>`;
        slides.push(html);
        return html;
      }
      case 'block':
      case 'alertblock':
      case 'exampleblock': {
        const a = arg(inner, 0);
        const t = a ? a.text : '';
        const kind = env === 'block' ? '' : env === 'alertblock' ? ' alert' : ' example';
        return `<div class="tex-block${kind}"><div class="tex-btitle">${inline(t)}</div><div class="tex-bbody">${block(a ? inner.slice(a.end) : inner)}</div></div>`;
      }
      case 'columns': {
        const co = /^\s*\[([^\]]*)\]/.exec(inner)?.[1] || '';
        return `<div class="tex-columns${/(^|,)\s*[tT]\s*(,|$)/.test(co) ? ' t' : /(^|,)\s*b\s*(,|$)/.test(co) ? ' b' : ''}">${block(inner.replace(/^\s*\[[^\]]*\]/, ''))}</div>`;
      }
      case 'column': {
        const a = arg(inner, 0);
        const w = a ? /([0-9.]+)\s*\\(?:textwidth|linewidth|columnwidth)/.exec(a.text) : null;
        return `<div class="tex-column" style="${w ? `flex:0 0 ${Math.round(Number(w[1]) * 100)}%` : 'flex:1 1 0'}">${block(a ? inner.slice(a.end) : inner)}</div>`;
      }
      case 'document':
        return block(inner);
      default:
        return block(inner);
    }
  };

  function splitItems(s: string): Array<{ label?: string; text: string }> {
    const out: Array<{ label?: string; text: string }> = [];
    let depth = 0;
    let start = -1;
    let label: string | undefined;
    const push = (end: number) => {
      if (start >= 0) out.push({ label, text: s.slice(start, end) });
    };
    for (let i = 0; i < s.length; i++) {
      if (s.startsWith('\\begin{', i)) depth++;
      else if (s.startsWith('\\end{', i)) depth--;
      else if (depth === 0 && s.startsWith('\\item', i) && !/[a-zA-Z]/.test(s[i + 5] || '')) {
        push(i);
        i += 5;
        const ov = /^<[^>]*>/.exec(s.slice(i));
        if (ov) i += ov[0].length;
        let lab: string | undefined;
        if (s[i] === '[') {
          const e = s.indexOf(']', i);
          if (e > 0) {
            lab = s.slice(i + 1, e);
            i = e + 1;
          }
        }
        label = lab;
        start = i;
        i--;
      }
    }
    push(s.length);
    return out;
  }

  function splitBib(s: string): string[] {
    return s
      .replace(/^\s*\{[^}]*\}/, '')
      .split(/\\bibitem(?:\[[^\]]*\])?\{[^}]*\}/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const titleBlock = () => {
    const parts: string[] = [];
    const box: string[] = [];
    if (doc.title) box.push(`<h1 class="tex-title">${inline(doc.title)}</h1>`);
    if (doc.subtitle) box.push(`<div class="tex-subtitle">${inline(doc.subtitle)}</div>`);
    if (box.length) parts.push(beamer ? `<div class="tex-tbox">${box.join('')}</div>` : box.join(''));
    if (doc.author) parts.push(`<div class="tex-author">${inline(doc.author.replace(/\\and/g, '·'))}</div>`);
    if (doc.institute) parts.push(`<div class="tex-institute">${inline(doc.institute)}</div>`);
    const d = doc.date === undefined ? CMD_TEXT.today : doc.date;
    if (d) parts.push(`<div class="tex-date">${inline(d)}</div>`);
    return `<header class="tex-header">${parts.join('')}</header>`;
  };

  let html = block(src);
  if (footnotes.length) html += `<hr class="tex-fnsep"><ol class="tex-footnotes">${footnotes.map((f) => `<li>${f}</li>`).join('')}</ol>`;
  // devolve matemática e verbatim guardados
  for (let n = 0; n < 4; n++) html = html.replace(/(\d+)/g, (_m, k) => store[Number(k)] ?? '');
  if (beamer) {
    const back = (h: string) => {
      for (let n = 0; n < 4; n++) h = h.replace(/\uE000(\d+)\uE001/g, (_m, k) => store[Number(k)] ?? '');
      return h;
    };
    const done = slides.map(back);
    const bi = parseBeamer(source, grabOpt);
    for (const k of ['title', 'shortTitle', 'author', 'shortAuthor', 'date', 'shortDate'] as const) bi[k] = back(inline(bi[k] || (k === 'date' || k === 'shortDate' ? '' : '')));
    if (!/\\date\s*(\[[^\]]*\])?\s*\{/.test(preamble)) bi.date = bi.shortDate = CMD_TEXT.today;
    bi.sections = sectionList.map(back);
    if (bi.footerBoxes) bi.footerBoxes = bi.footerBoxes.map((b) => ({ ...b, raw: back(inline(b.raw)) }));
    return { html: done.join(''), doc, slides: done, beamer: bi };
  }
  return { html, doc, layout };
}
