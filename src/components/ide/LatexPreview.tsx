import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileText, Loader2, Play, ExternalLink, Download, Code2 } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { texToHtml } from '../../utils/latexPreview';
import type { BeamerInfo } from '../../utils/beamerTheme';
import type { Layout } from '../../utils/latexLayout';

interface Props {
  content: string;
  filePath?: string;
  accentColor: string;
  isDark: boolean;
  tokens: { textPrimary: string; textSecondary: string; textMuted: string; bgCard: string };
  /** esconde o editor e deixa só a prévia (o pai controla o estado) */
  codeHidden?: boolean;
  onToggleCode?: () => void;
}

const SLIDE_W = 1024; // Beamer 16:9
const SLIDE_H = 576;

const STYLE = `
.tex-flow,.tex-body{font-family:var(--ff);font-size:var(--fs);line-height:var(--lh);color:#000;text-align:justify;hyphens:auto;width:var(--bw);box-sizing:border-box}
.tex-flow{position:absolute;left:-99999px;top:0;visibility:hidden}
.tex-sheet{position:relative;width:var(--pw);height:var(--ph);background:#fff;margin:0 auto 16px;box-sizing:border-box;padding:var(--pt0) var(--pr) var(--pb) var(--pl);overflow:hidden;flex-shrink:0}
.tex-sheet .tex-pn{position:absolute;font-family:var(--ff);font-size:var(--fs)}
.tex-sheet .tex-pn.bottom{left:0;right:0;bottom:calc(var(--pb) / 2 - .6em);text-align:center}
.tex-sheet .tex-pn.top-right{right:var(--pr);top:calc(var(--pt0) / 2 - .6em);text-align:right}
.tex-body h1,.tex-body h2,.tex-body h3,.tex-body h4,.tex-body h5,.tex-body h6{font-weight:700;text-align:left;hyphens:none}
.tex-body h2{font-size:var(--h2s);font-weight:var(--h2w);text-transform:var(--h2t);line-height:1.25;margin:1.5em 0 1em}
.tex-body h3{font-size:var(--h3s);font-weight:var(--h3w);text-transform:var(--h3t);line-height:1.25;margin:1.4em 0 .9em}
.tex-body h4{font-size:var(--h4s);font-weight:var(--h4w);text-transform:var(--h4t);line-height:1.25;margin:1.2em 0 .8em}
.tex-body h5,.tex-body h6{font-size:1em;margin:1em 0 0;display:inline}
.tex-body h2 .sn,.tex-body h3 .sn,.tex-body h4 .sn{display:inline-block;min-width:1em;margin-right:1em}
.tex-body p,.tex-body .tex-p{margin:0;text-indent:var(--pi)}
.tex-body h2+p,.tex-body h3+p,.tex-body h4+p,.tex-body h2+.tex-p,.tex-body h3+.tex-p,.tex-body h4+.tex-p{text-indent:var(--pi1)}
.tex-body .tex-eq+p,.tex-body figure+p,.tex-body ul+p,.tex-body ol+p{text-indent:0}
.tex-body .tex-header{text-align:center;margin:0 0 2em}
.tex-body .tex-title{font-size:2.07em;line-height:1.25;margin:1.2em 0 .6em;font-weight:400;text-align:center}
.tex-body .tex-author{font-size:1.2em;line-height:1.3;margin-bottom:.8em}.tex-body .tex-date{font-size:1.2em;line-height:1.3}
.tex-body .tex-eq{position:relative;margin:1em 0;text-align:center;overflow-x:auto;overflow-y:hidden}
.tex-body .tex-eqno{position:absolute;right:0;top:50%;transform:translateY(-50%)}
.tex-body .tex-abstract{margin:0 2em 1.5em;font-size:.9em;line-height:1.3}.tex-body .tex-abstract strong{display:block;text-align:center;font-size:1em;margin:0 0 .6em}
.tex-body .tex-abstract p{text-indent:0}
.tex-body blockquote{margin:.8em 1.5em}
.tex-body ul,.tex-body ol{margin:.6em 0;padding-left:2em}.tex-body li{margin:.3em 0}.tex-body li>p{text-indent:0}
.tex-body ul{list-style:none}.tex-body ul>li::before{content:"\\2022";position:absolute;margin-left:-1.1em}.tex-body ul>li{position:relative}
.tex-body dt{font-weight:700}.tex-body dd{margin:0 0 .4em 1.8em}
.tex-body pre,.tex-body code{font-family:"JetBrains Mono",Menlo,monospace;font-size:.82em;background:transparent}
.tex-body pre{margin:.8em 0;padding:0;line-height:1.3;text-align:left;white-space:pre-wrap}
.tex-body figure{margin:1.2em 0;text-align:center}.tex-body figcaption{font-size:.92em;line-height:1.3;margin-top:.6em;text-align:center}
.tex-body .tex-pic{display:block;margin:0 auto;max-height:var(--bh);object-fit:contain}
.tex-body .tex-img{display:inline-block;padding:2.4em 3em;background:#eceef1;color:#6b7078;font-family:"JetBrains Mono",Menlo,monospace;font-size:.8em}
.tex-body .tex-table{border-collapse:collapse;margin:.6em auto}.tex-body .tex-table td{padding:.2em .8em}.tex-body .tex-table tr.top td{border-top:1px solid #000}.tex-body .tex-table tr:last-child td{border-bottom:1px solid #000}
.tex-body .tex-ref,.tex-body a{color:#000}.tex-body .tex-fn{font-size:.7em}
.tex-body .tex-footnotes{font-size:.85em;line-height:1.25;padding-left:1.4em}.tex-body hr{border:none;border-top:1px solid #000;width:30%;margin:1em 0 .5em}
.tex-body .katex{font-size:1.05em}
.tex-body .tex-vs{display:block}.tex-body .tex-vfill{display:block}
.tex-body .tex-titlepage{height:var(--bh);box-sizing:border-box}
.tex-body .tex-titlepage>.tex-center,.tex-body .tex-titlepage>.tex-vsplit{height:100%}
.tex-body .tex-center>.tex-vsplit{height:100%}
.tex-body .tex-vsplit{display:flex;flex-direction:column;height:100%}.tex-body .tex-vfillbox{flex:1}
.tex-body .tex-minipage{display:inline-block;text-align:left;vertical-align:top}
.tex-body .tex-titlepage p,.tex-body .tex-titlepage .tex-p{text-indent:0}
.tex-body .tex-tocdoc{margin:0 0 1em}.tex-body .tex-toctitle{font-size:1.44em;margin:0 0 1.4em;font-weight:700}
.tex-body .tex-tocdoc .toc{display:flex;align-items:baseline;gap:.5em;margin:.35em 0;text-align:left}
.tex-body .tex-tocdoc .toc.l0{font-weight:400}.tex-body .tex-tocdoc .toc.l1{padding-left:1.5em}.tex-body .tex-tocdoc .toc.l2{padding-left:3.8em}
.tex-body .tex-tocdoc .dots{flex:1;border-bottom:1px dotted #000;transform:translateY(-.3em);min-width:1em}
.tex-slidecard{position:relative;width:${SLIDE_W}px;background:#fff;margin:0 auto 16px;overflow:hidden;flex-shrink:0;box-sizing:border-box;display:flex;flex-direction:column;font-family:KaTeX_SansSerif,"Helvetica Neue",Arial,sans-serif;line-height:1.25;color:#000;text-align:left;hyphens:none}
.tex-slidecard .tex-slidebody{flex:1;min-height:0;width:100%;position:relative}
.tex-slidecard .tex-slide{height:100%;box-sizing:border-box;padding:calc(12*var(--pt)) calc(26*var(--pt)) calc(6*var(--pt));display:flex;flex-direction:column}
.tex-slide .tex-ftitle{font-size:calc(14.4*var(--pt));line-height:1.15;color:var(--tf);margin:0 0 calc(2*var(--pt))}
.tex-slide .tex-fsub{font-size:calc(11*var(--pt));color:var(--tf);opacity:.85;margin:0}
.tex-slide .tex-fbody{flex:1;min-height:0;overflow:hidden;margin-top:calc(10*var(--pt));display:flex;flex-direction:column}
.tex-slide .tex-fin{margin:auto 0;width:100%}.tex-slide.tex-top .tex-fin{margin:0}
.tex-slide p,.tex-slide .tex-p{text-indent:0;margin:0 0 .55em}
.tex-slide h2,.tex-slide h3,.tex-slide h4{font-size:1.2em;line-height:1.2;margin:.4em 0;color:var(--st)}
.tex-slide ul,.tex-slide ol{margin:.15em 0 .45em;padding-left:1.6em}.tex-slide li{margin:.3em 0}
.tex-slide ul>li::before{content:var(--bullet,"\\25B6");color:var(--st);font-size:.55em;position:absolute;margin-left:-2.1em;margin-top:.45em}
.tex-slide ul ul>li::before{font-size:.45em}
.tex-slide .tex-alert{color:#b22222}.tex-slide .tex-struct{color:var(--st)}
.tex-slide .tex-eq{margin:.5em 0;text-align:center}.tex-slide .katex{font-size:1.05em}
.tex-block{margin:.6em 0;background:var(--bbody,color-mix(in srgb,var(--bb) 14%,#fff));color:var(--bbodyfg,inherit)}
.rnd .tex-block{border-radius:.5em;overflow:hidden}
.tex-block .tex-btitle{background:var(--bb);color:var(--bf);padding:.28em .8em;font-size:.95em}.tex-block .tex-bbody{padding:.5em .8em}
.tex-block.alert{background:#f6e3e3}.tex-block.alert .tex-btitle{background:#b22222;color:#fff}
.tex-block.example{background:#e3f1e3}.tex-block.example .tex-btitle{background:#2f8f2f;color:#fff}
.tex-block p{margin:0 0 .35em}
.tex-columns{display:flex;gap:0;align-items:center;justify-content:space-between}.tex-columns.t{align-items:flex-start}.tex-columns.b{align-items:flex-end}.tex-column{min-width:0}
.tex-slide .tex-pic{display:block;margin:0 auto;max-width:100%;max-height:var(--th);object-fit:contain}
.tex-imgrow{display:flex;align-items:center;justify-content:center;gap:0;text-indent:0!important}
.tex-imgrow .tex-pic+.tex-pic{margin-left:.3em}
.tex-imgrow .tex-pic{margin:0;flex:0 1 auto;min-width:0}.tex-hfill{flex:1 1 0;min-width:0}
.tex-slidecard ul,.tex-slidecard ol{list-style:none}.tex-slidecard ol{list-style:decimal}.tex-slidecard li{position:relative}
.tex-slidecard pre,.tex-slidecard code{font-family:"JetBrains Mono",Menlo,monospace;font-size:.75em}.tex-slidecard pre{margin:.5em 0;white-space:pre-wrap;line-height:1.3}
.tex-slidecard .tex-table{border-collapse:collapse;margin:.4em auto}.tex-slidecard .tex-table td{padding:.15em .7em}.tex-slidecard .tex-table tr.top td{border-top:1px solid #000}.tex-slidecard .tex-table tr:last-child td{border-bottom:1px solid #000}
.tex-slidecard figure{margin:.5em 0;text-align:center}.tex-slidecard figcaption{font-size:.8em}
.tex-slidecard .tex-img{display:inline-block;padding:1.4em 2em;background:#eceef1;color:#6b7078;font-family:"JetBrains Mono",Menlo,monospace;font-size:.6em}
/* título do slide por família de tema */
.tbar .tex-slide{padding-left:0;padding-right:0;padding-top:0}
.tbar .tex-slide .tex-ftitle{background:var(--tb);color:var(--tf);padding:calc(4.2*var(--pt)) calc(26*var(--pt)) calc(3.4*var(--pt));margin:0;font-weight:400;line-height:1.05}
.tbar .tex-slide .tex-fsub{background:var(--tb);padding:0 calc(26*var(--pt)) calc(5*var(--pt));margin:0}
.tbar .tex-slide .tex-fbody{padding:0 calc(26*var(--pt))}
.th-metro .tex-slide{padding:0}
.th-metro .tex-slide .tex-ftitle{background:#23373b;color:#fafafa;padding:calc(9*var(--pt)) calc(26*var(--pt)) calc(7*var(--pt));margin:0;font-size:calc(13*var(--pt));font-weight:600}
.th-metro .tex-slide .tex-fsub{display:none}
.th-metro .tex-slide .tex-fbody{padding:0 calc(26*var(--pt));margin-top:calc(14*var(--pt))}
.th-metro .tex-slide .tex-alert{color:#eb811b}
.th-metro{background:#fafafa}
.th-metro .tex-block .tex-btitle{background:#23373b}
/* slide de título */
.tex-titleslide .tex-fbody{display:flex;align-items:center;justify-content:center;margin:0!important;padding:0 calc(26*var(--pt))!important}
.tex-titleslide .tex-header{text-align:center;margin:0;width:100%}
.tex-titleslide .tex-title{font-family:inherit;font-size:calc(17*var(--pt));line-height:1.2;font-weight:700;color:var(--st);margin:0 0 calc(5*var(--pt));text-align:center}
.tex-titleslide .tex-subtitle{font-size:calc(12*var(--pt));color:var(--st);margin-bottom:calc(14*var(--pt))}
.tex-titleslide .tex-author{font-size:calc(11*var(--pt));margin-bottom:calc(4*var(--pt))}.tex-titleslide .tex-institute{font-size:calc(9*var(--pt));margin-bottom:calc(4*var(--pt))}.tex-titleslide .tex-date{font-size:calc(9*var(--pt))}
.tbx .tex-tbox .tex-title{font-weight:400}
.tbx .tex-tbox{background:var(--tib);color:var(--tif);padding:calc(8*var(--pt)) calc(14*var(--pt));margin:0 0 calc(14*var(--pt))}
.tbx .tex-tbox .tex-title,.tbx .tex-tbox .tex-subtitle{color:var(--tif);margin:0 0 calc(3*var(--pt))}
.tbx .tex-tbox .tex-title{margin-bottom:calc(5*var(--pt))}
.tex-slide .tex-toc{list-style:none;margin:0;padding:0 0 0 calc(26*var(--pt))}.tex-slide .tex-toc>li{margin:calc(9*var(--pt)) 0;color:var(--toc)}.tex-slide .tex-toc>li::before{content:none}
.th-metro .tex-titleslide .tex-fbody{justify-content:flex-start}.th-metro .tex-titleslide .tex-header{text-align:left}
.th-metro .tex-titleslide .tex-title{text-align:left;color:#23373b;font-size:calc(19*var(--pt));padding-bottom:calc(6*var(--pt));border-bottom:calc(.7*var(--pt)) solid #23373b;font-weight:500}
.th-metro .tex-titleslide .tex-author,.th-metro .tex-titleslide .tex-date,.th-metro .tex-titleslide .tex-institute{text-align:left}
/* cabeçalho (seções), rodapé e símbolos de navegação */
.tex-bhead{display:flex;gap:calc(14*var(--pt));padding:calc(3*var(--pt)) calc(26*var(--pt));background:var(--pp);color:#fff;font-size:calc(7*var(--pt));flex-shrink:0;white-space:nowrap;overflow:hidden}
.tex-bhead span{opacity:.6}.tex-bhead span.on{opacity:1;font-weight:700}
.tex-bfoot{display:flex;flex-shrink:0;font-size:calc(7*var(--pt));color:#fff;height:calc(13*var(--pt));line-height:calc(13*var(--pt))}
.tex-bfoot.custom{height:calc(8.4*var(--pt));line-height:calc(8.4*var(--pt));font-size:calc(5.8*var(--pt))}
.tex-bfoot.custom>div{padding:0 calc(7*var(--pt));overflow:visible;text-overflow:clip}
.tex-bfoot>div{box-sizing:border-box;padding:0 calc(10*var(--pt));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tex-bfoot:not(.custom)>div:nth-child(1){flex:0 0 28%;background:var(--pp);text-align:center}.tex-bfoot:not(.custom)>div:nth-child(2){flex:1;background:var(--ps);text-align:center}.tex-bfoot:not(.custom)>div:nth-child(3){flex:0 0 28%;background:var(--pt3);display:flex;justify-content:space-between}
.tex-bpage{flex-shrink:0;text-align:right;padding:calc(2*var(--pt)) calc(14*var(--pt)) calc(4*var(--pt));font-size:calc(7*var(--pt));color:#777}
.tex-bnav{flex-shrink:0;text-align:right;padding:0 calc(8*var(--pt)) calc(3*var(--pt));font-size:calc(7*var(--pt));color:#8a8aa8;letter-spacing:.25em}
.th-metro .tex-mprog{position:absolute;left:0;right:0;top:calc(31*var(--pt));z-index:2}
.tex-mprog{height:calc(1.4*var(--pt));background:color-mix(in srgb,#eb811b 25%,#fafafa);flex-shrink:0}.tex-mprog i{display:block;height:100%;background:#eb811b}
.tex-pages,.tex-pages *{user-select:text;-webkit-user-select:text}
.tex-pages .tex-body,.tex-pages .tex-slidebody{cursor:text}
.tex-pages ::selection{background:rgba(51,102,255,.28)}
.tex-pages::-webkit-scrollbar{width:5px;height:5px}.tex-pages::-webkit-scrollbar-track{background:transparent}.tex-pages::-webkit-scrollbar-thumb{background:rgba(128,128,128,.4);border-radius:3px}
`;

/** Visualizador de arquivos .tex: prévia rápida (fórmulas com KaTeX) e, se houver tectonic/pdflatex, o PDF compilado. */
export const LatexPreview: React.FC<Props> = ({ content, filePath, accentColor, isDark, tokens, codeHidden, onToggleCode }) => {
  const [mode, setMode] = useState<'preview' | 'pdf'>('preview');
  const [engine, setEngine] = useState<string | null | undefined>(undefined);
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const [pages, setPages] = useState<Array<{ blocks: string[]; label: string }>>([]);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fitZoom, setFitZoom] = useState(1);
  const flowRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const api = (window as any).electronAPI;

  // imagens do \includegraphics: lidas da pasta do arquivo (e de \graphicspath), sem extensão também
  const [images, setImages] = useState<Record<string, string>>({});
  const imgKey = useMemo(() => [...content.matchAll(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)].map((m) => m[1].trim()).join('|'), [content]);
  const graphicsPath = useMemo(() => [...(/\\graphicspath\s*\{((?:\{[^}]*\}\s*)+)\}/.exec(content)?.[1] || '').matchAll(/\{([^}]*)\}/g)].map((m) => m[1]).join('|'), [content]);
  useEffect(() => {
    const fsApi = api?.fs;
    if (!filePath || !imgKey || !fsApi?.readFileDataUrl) {
      setImages({});
      return;
    }
    let cancelled = false;
    const base = filePath.split('/').slice(0, -1).join('/');
    const dirs = ['', ...graphicsPath.split('|').filter(Boolean)].map((d) => (d.startsWith('/') ? d : `${base}/${d}`.replace(/\/+$/, '').replace(/\/\.\//g, '/')));
    (async () => {
      const out: Record<string, string> = {};
      for (const p of Array.from(new Set(imgKey.split('|')))) {
        let found = false;
        for (const d of dirs) {
          for (const ext of ['', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']) {
            const full = `${d}/${p}${ext}`.replace(/\/{2,}/g, '/');
            if (ext === '' && !/\.(png|jpe?g|svg|webp|gif)$/i.test(p)) continue;
            const r = await fsApi.readFileDataUrl(full, 6_000_000).catch(() => null);
            if (r?.dataUrl) {
              out[p] = r.dataUrl;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      if (!cancelled) setImages(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [imgKey, graphicsPath, filePath]);

  const conv = useMemo(() => {
    try {
      return texToHtml(content, images);
    } catch (e: any) {
      return { html: `<p>Não consegui montar a prévia: ${String(e?.message || e)}</p>`, doc: {}, slides: undefined as string[] | undefined };
    }
  }, [content, images]);
  const rendered = conv.html;
  const slides = conv.slides;
  const layout = (conv as any).layout as Layout | undefined;
  const PW = layout?.pageW ?? 794;
  const bodyH = layout ? layout.pageH - layout.top - layout.bottom : 741;
  const docVars = useMemo(() => {
    const L: Layout = layout || ({ pageW: 794, pageH: 1123, top: 150, bottom: 232, left: 167, right: 167, fontPx: 13.33, linePx: 16, parindentPx: 20, indentFirst: false, serif: 'cm', lang: 'en', numbering: 'bottom', headings: [{ size: 1.44, bold: true, upper: false }, { size: 1.2, bold: true, upper: false }, { size: 1, bold: true, upper: false }] } as Layout);
    const h = (i: number) => L.headings[i] || { size: 1, bold: true, upper: false };
    return {
      '--pw': `${L.pageW}px`, '--ph': `${L.pageH}px`, '--pt0': `${L.top}px`, '--pb': `${L.bottom}px`, '--pl': `${L.left}px`, '--pr': `${L.right}px`,
      '--bw': `${L.pageW - L.left - L.right}px`, '--bh': `${L.pageH - L.top - L.bottom}px`, '--th': `${L.pageH - L.top - L.bottom}px`, '--fs': `${L.fontPx}px`, '--lh': `${L.linePx}px`,
      '--pi': `${L.parindentPx}px`, '--pi1': L.indentFirst ? `${L.parindentPx}px` : '0',
      '--ff': L.serif === 'times' ? '"Times New Roman", Tinos, "Nimbus Roman", Times, serif' : 'KaTeX_Main, "Latin Modern Roman", "CMU Serif", "Computer Modern", Georgia, serif',
      '--h2s': `${h(0).size}em`, '--h2w': h(0).bold ? 700 : 400, '--h2t': h(0).upper ? 'uppercase' : 'none',
      '--h3s': `${h(1).size}em`, '--h3w': h(1).bold ? 700 : 400, '--h3t': h(1).upper ? 'uppercase' : 'none',
      '--h4s': `${h(2).size}em`, '--h4w': h(2).bold ? 700 : 400, '--h4t': h(2).upper ? 'uppercase' : 'none',
    } as React.CSSProperties;
  }, [layout]);
  const beamerInfo = (conv as any).beamer as BeamerInfo | undefined;

  useEffect(() => {
    api?.latex?.engine?.().then((e: string | null) => setEngine(e)).catch(() => setEngine(null));
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  // paginação: mede cada bloco fora da tela e distribui em folhas A4 (título e seção não ficam sozinhos no fim da folha)
  useEffect(() => {
    if (mode !== 'preview' || slides) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const host = flowRef.current;
      if (!host) return;
      host.innerHTML = rendered;
      try {
        await (document as any).fonts?.ready;
      } catch {}
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      const kids = Array.from(host.children) as HTMLElement[];
      const tops = kids.map((k) => k.offsetTop);
      const heights = kids.map((_, i) => (i + 1 < kids.length ? tops[i + 1] : host.scrollHeight) - tops[i]);
      type Pg = { blocks: string[]; title?: boolean };
      const out: Pg[] = [{ blocks: [] }];
      let used = 0;
      const newPage = () => {
        if (out[out.length - 1].blocks.length) {
          out.push({ blocks: [] });
          used = 0;
        }
      };
      kids.forEach((k, i) => {
        const h = heights[i];
        const cls = String(k.className || '');
        if (cls.includes('tex-pagebreak')) {
          newPage();
          return;
        }
        if (cls.includes('tex-titlepage')) {
          newPage();
          out[out.length - 1].title = true;
          out[out.length - 1].blocks.push(k.outerHTML);
          newPage();
          return;
        }
        let cur = out[out.length - 1];
        if (used + h > bodyH && cur.blocks.length) {
          const prev = kids[i - 1];
          const heading = prev && /^H[1-6]$/.test(prev.tagName) && cur.blocks.length > 1;
          const carried = heading ? [cur.blocks.pop() as string] : [];
          out.push({ blocks: carried });
          cur = out[out.length - 1];
          used = heading ? heights[i - 1] : 0;
        }
        cur.blocks.push(k.outerHTML);
        used += h;
      });
      // numeração: folha de rosto sem número e a contagem recomeça em 1 depois dela (como a classe article)
      let n = 0;
      const numbered = out
        .filter((pg) => pg.blocks.length)
        .map((pg) => {
          if (pg.title) {
            n = 0;
            return { blocks: pg.blocks, label: '' };
          }
          n++;
          return { blocks: pg.blocks, label: String(n) };
        });
      // sumário: números de página de cada título
      const where: Record<string, string> = {};
      numbered.forEach((pg) => {
        for (const m of pg.blocks.join('').matchAll(/id="(tex-s\d+)"/g)) where[m[1]] = pg.label;
      });
      numbered.forEach((pg) => {
        pg.blocks = pg.blocks.map((b) => b.replace(/<span class="pg" data-for="(tex-s\d+)"><\/span>/g, (_m, id) => `<span class="pg">${where[id] ?? ''}</span>`));
      });
      const out2 = numbered;
      setPages(out2);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rendered, mode, slides, bodyH]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setFitZoom(Math.min(1.6, Math.max(0.3, (el.clientWidth - 24) / (slides ? SLIDE_W : PW))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, slides, PW]);

  const z = zoom === 'fit' ? fitZoom : zoom;
  const step = (d: number) => setZoom(Math.min(2.5, Math.max(0.3, Math.round((z + d) * 100) / 100)));

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  /** Baixar PDF: com compilador, o PDF real; sem ele, a própria prévia impressa (folhas A4 ou slides). */
  const downloadPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    const name = (filePath ? filePath.split('/').pop() || 'documento' : 'documento').replace(/\.tex$/i, '');
    try {
      if (engine) {
        const res = await api.latex.compile({ content, filePath });
        if (res?.pdfPath) {
          const saved = await api.latex.savePdf({ pdfPath: res.pdfPath, defaultName: name });
          if (saved?.error) setExportMsg(saved.error);
          return;
        }
        setLog(res?.error || 'Não foi possível compilar.');
        setMode('pdf');
        setExportMsg('A compilação falhou; veja o log na aba PDF. Para baixar a prévia, corrija o erro ou use um arquivo sem pacotes especiais.');
        return;
      }
      if (mode !== 'preview') setMode('preview');
      await new Promise((r) => setTimeout(r, 450));
      const sheets = Array.from(areaRef.current?.querySelectorAll<HTMLElement>('.tex-sheet, .tex-slidecard') || []);
      if (!sheets.length) {
        setExportMsg('Nada para exportar ainda.');
        return;
      }
      const root = document.createElement('div');
      root.id = 'tex-print-root';
      Object.entries(docVars).forEach(([k, v]) => root.style.setProperty(k, String(v)));
      root.className = 'tex-pages';
      sheets.forEach((el) => root.appendChild(el.cloneNode(true)));
      const first = sheets[0];
      const style = document.createElement('style');
      style.textContent = `#tex-print-root{display:none}@media print{body>*:not(#tex-print-root){display:none!important}#tex-print-root{display:block!important}#tex-print-root .tex-sheet,#tex-print-root .tex-slidecard{margin:0!important;break-after:page;page-break-after:always;break-inside:avoid}#tex-print-root>:last-child{break-after:auto;page-break-after:auto}@page{size:${first.offsetWidth}px ${first.offsetHeight}px;margin:0}}`;
      document.head.appendChild(style);
      document.body.appendChild(root);
      try {
        const res = await api.latex.printPdf({ defaultName: name });
        if (res?.error) setExportMsg(res.error);
      } finally {
        root.remove();
        style.remove();
      }
    } catch (e: any) {
      setExportMsg(String(e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const compile = async () => {
    if (compiling) return;
    setCompiling(true);
    setLog(null);
    try {
      const res = await api.latex.compile({ content, filePath });
      if (res?.error || !res?.pdfBase64) {
        setLog(res?.error || 'Não foi possível compilar.');
        setMode('pdf');
        return;
      }
      const bytes = Uint8Array.from(atob(res.pdfBase64), (c) => c.charCodeAt(0));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      urlRef.current = url;
      setPdfUrl(url);
      setPdfPath(res.pdfPath || null);
      setMode('pdf');
    } catch (e: any) {
      setLog(String(e?.message || e));
      setMode('pdf');
    } finally {
      setCompiling(false);
    }
  };

  const seg = (id: 'preview' | 'pdf', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => (id === 'pdf' && !pdfUrl && !log ? compile() : setMode(id))}
      className="df-pressable"
      style={{ height: 20, padding: '0 8px', border: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', background: mode === id ? `${accentColor}26` : 'transparent', color: mode === id ? accentColor : tokens.textSecondary, transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out)' }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: tokens.textSecondary, flexShrink: 0 }}>
        {onToggleCode && (
          <button
            type="button"
            className="df-pressable"
            title={codeHidden ? 'Mostrar o código ao lado' : 'Ocultar o código e ver só a prévia'}
            onClick={onToggleCode}
            style={{ width: 20, height: 20, border: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: codeHidden ? `${accentColor}26` : 'transparent', color: codeHidden ? accentColor : tokens.textSecondary, padding: 0, transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out)' }}
          >
            <Code2 size={12} />
          </button>
        )}
        {seg('preview', 'Prévia', <Eye size={11} />)}
        {engine !== null && seg('pdf', 'PDF', <FileText size={11} />)}
        <span style={{ flex: 1 }} />
        {mode === 'preview' && (
          <>
            <span style={{ fontSize: 11 }}>{slides ? `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'}` : `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}`}</span>
            {([['-', 'Reduzir', () => step(-0.1)], ['+', 'Ampliar', () => step(0.1)]] as Array<[string, string, () => void]>).map(([sym, tip, fn]) => (
              <button key={sym} type="button" className="df-pressable" title={tip} onClick={fn} style={{ width: 20, height: 20, border: 'none', borderRadius: 4, background: 'transparent', color: tokens.textSecondary, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>{sym}</button>
            ))}
            <button type="button" className="df-pressable" title="Ajustar à largura" onClick={() => setZoom('fit')} style={{ height: 20, padding: '0 6px', border: 'none', borderRadius: 4, background: zoom === 'fit' ? `${accentColor}26` : 'transparent', color: zoom === 'fit' ? accentColor : tokens.textSecondary, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', minWidth: 38 }}>{Math.round(z * 100)}%</button>
          </>
        )}
        <button
          type="button"
          className="df-pressable"
          disabled={exporting}
          onClick={downloadPdf}
          title={engine ? `Baixar o PDF compilado com ${engine}` : 'Baixar a prévia como PDF (instale o tectonic para o PDF exato do LaTeX)'}
          style={{ height: 20, padding: '0 8px', border: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: exporting ? 'default' : 'pointer', fontSize: 11, fontFamily: 'inherit', background: 'transparent', color: tokens.textSecondary, transition: 'color 150ms var(--ease-out)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
          onMouseLeave={(e) => (e.currentTarget.style.color = tokens.textSecondary)}
        >
          {exporting ? <Loader2 size={11} className="spin-animate" color={accentColor} /> : <Download size={11} />}
          {exporting ? 'Gerando...' : 'Baixar PDF'}
        </button>
        {engine && (
          <button
            type="button"
            className="df-pressable"
            disabled={compiling}
            onClick={compile}
            title={`Compilar com ${engine}`}
            style={{ height: 20, padding: '0 8px', border: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: compiling ? 'default' : 'pointer', fontSize: 11, fontFamily: 'inherit', background: 'transparent', color: tokens.textSecondary, transition: 'color 150ms var(--ease-out)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.textSecondary)}
          >
            {compiling ? <Loader2 size={11} className="spin-animate" color={accentColor} /> : <Play size={11} />}
            {compiling ? 'Compilando...' : 'Compilar'}
          </button>
        )}
        {mode === 'pdf' && pdfPath && (
          <button type="button" className="df-pressable" title="Abrir o PDF no leitor do sistema" onClick={() => api?.shell?.openExternal?.(`file://${pdfPath}`)} style={{ width: 20, height: 20, border: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', color: tokens.textSecondary, padding: 0 }}>
            <ExternalLink size={11} />
          </button>
        )}
      </div>
      <style>{STYLE}</style>
      {exportMsg && <div style={{ padding: '4px 10px', fontSize: 11, color: '#ef4444', background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)', flexShrink: 0 }}>{exportMsg}</div>}
      {mode === 'preview' ? (
        <div ref={areaRef} className="tex-pages" style={{ ...docVars, flex: '1 1 0', minHeight: 0, overflow: 'auto', padding: 12, background: isDark ? '#2b2c2f' : '#d9dce1' }}>
          <div ref={flowRef} className="tex-flow tex-body" />
          <div style={{ zoom: z, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {slides && beamerInfo && slides.map((h, i) => {
              const isTitle = h.includes('tex-titleslide');
              const sec = Number(/data-sec="(-?\d+)"/.exec(h)?.[1] ?? -1);
              const pt = SLIDE_W / beamerInfo.w;
              const vars = { '--pt': `${pt}px`, '--st': beamerInfo.struct, '--pp': beamerInfo.pp, '--ps': beamerInfo.ps, '--pt3': beamerInfo.pt3, '--tb': beamerInfo.tb, '--tf': beamerInfo.tf, '--bb': beamerInfo.bb, '--bf': beamerInfo.bf, '--th': `${beamerInfo.h * pt * 0.9}px`, '--tib': beamerInfo.tib, '--tif': beamerInfo.tif, '--toc': beamerInfo.tocFg, '--bullet': `"${beamerInfo.bullet}"`, ...(beamerInfo.bodyBg ? { '--bbody': beamerInfo.bodyBg, '--bbodyfg': beamerInfo.bodyFg } : {}), height: beamerInfo.h * pt, fontSize: beamerInfo.fontPt * pt } as React.CSSProperties;
              const html = (t: string) => <span dangerouslySetInnerHTML={{ __html: t }} />;
              return (
                <div key={i} className={`tex-slidecard th-${beamerInfo.family}${beamerInfo.titleBar ? ' tbar' : ''}${beamerInfo.titleBox ? ' tbx' : ''}${beamerInfo.rounded ? ' rnd' : ''}`} style={vars}>
                  {beamerInfo.headerSections && !isTitle && beamerInfo.sections.length > 0 && (
                    <div className="tex-bhead">{beamerInfo.sections.map((t, k) => <span key={k} className={k === sec ? 'on' : ''}>{html(t)}</span>)}</div>
                  )}
                  {beamerInfo.family === 'metro' && !isTitle && <div className="tex-mprog"><i style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>}
                  <div className="tex-slidebody" dangerouslySetInnerHTML={{ __html: h }} />
                  {!isTitle && beamerInfo.footerBoxes && (
                    <div className="tex-bfoot custom">
                      {beamerInfo.footerBoxes.map((b, k) => (
                        <div key={k} style={{ flex: `0 0 ${b.w}%`, background: b.bg, color: b.fg, textAlign: b.align }}>
                          {html(b.raw.replace(/@@n@@/g, String(i + 1)).replace(/@@N@@/g, String(slides.length)))}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isTitle && !beamerInfo.footerBoxes && beamerInfo.footer === 'infolines' && (
                    <div className="tex-bfoot"><div>{html(beamerInfo.shortAuthor)}</div><div>{html(beamerInfo.shortTitle)}</div><div>{html(beamerInfo.shortDate)}<span>{i + 1}/{slides.length}</span></div></div>
                  )}
                  {!isTitle && !beamerInfo.footerBoxes && beamerInfo.footer === 'page' && <div className="tex-bpage">{i + 1}/{slides.length}</div>}
                  {!isTitle && !beamerInfo.footerBoxes && beamerInfo.footer === 'nav' && <div className="tex-bnav">{'◂ ▪ ≡ ▸ ⟲ ⌕'}</div>}
                </div>
              );
            })}
            {!slides && (pages.length ? pages : [{ blocks: [], label: '' }]).map((pg, i) => (
              <div key={i} className="tex-sheet">
                <div className="tex-body" lang={layout?.lang} dangerouslySetInnerHTML={{ __html: pg.blocks.join('') }} />
                {pg.label && layout?.numbering !== 'none' && <div className={`tex-pn ${layout?.numbering === 'top-right' ? 'top-right' : 'bottom'}`}>{pg.label}</div>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: '1 1 0', minHeight: 0, background: tokens.bgCard, display: 'flex', flexDirection: 'column' }}>
          {compiling && !pdfUrl ? (
            <div style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: tokens.textSecondary }}>
              <Loader2 size={14} className="spin-animate" color={accentColor} /> Compilando o documento...
            </div>
          ) : log ? (
            <pre style={{ margin: 0, padding: 12, overflow: 'auto', fontSize: 11, lineHeight: 1.5, color: tokens.textSecondary, fontFamily: 'JetBrains Mono, Menlo, monospace', whiteSpace: 'pre-wrap' }}>{log}</pre>
          ) : pdfUrl ? (
            <iframe title="PDF" src={pdfUrl} style={{ flex: 1, border: 'none', background: '#fff' }} />
          ) : null}
        </div>
      )}
    </div>
  );
};
