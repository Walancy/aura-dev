// Extração de conteúdo para "recriar o site inteiro": textos, dados e mídias de várias páginas do site de referência.
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';

const MAX_PAGES = 6;
const MAX_MEDIA = 30;
const MAX_MEDIA_BYTES = 4_000_000;
const MAX_TOTAL_BYTES = 40_000_000;

interface PageData {
  path: string;
  url: string;
  title: string;
  description: string;
  lang: string;
  md: string;
  links: string[];
  media: Array<{ url: string; alt: string }>;
  contacts: string[];
  jsonld: string[];
}

/** Roda dentro da página: percorre o DOM na ordem visual e devolve markdown + links internos + mídias. */
const EXTRACT_JS = `(() => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ''; } };
  const out = [];
  const media = [];
  const seen = new Set();
  const addMedia = (url, alt) => { url = abs(url); if (!url || url.startsWith('data:') || seen.has(url)) return url; seen.add(url); media.push({ url, alt: alt || '' }); return url; };
  const visible = (el) => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false; return true; };
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const bg = (el) => { const m = /url\\(["']?([^"')]+)["']?\\)/.exec(getComputedStyle(el).backgroundImage || ''); return m ? m[1] : ''; };
  const bestSrc = (img) => {
    const ss = img.getAttribute('srcset');
    if (ss) {
      const parts = ss.split(',').map((p) => p.trim().split(/\\s+/)).filter((p) => p[0]);
      parts.sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
      if (parts[0]) return parts[0][0];
    }
    return img.currentSrc || img.getAttribute('data-src') || img.src;
  };
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'LINK', 'META']);
  const block = new Set(['SECTION', 'HEADER', 'FOOTER', 'NAV', 'MAIN', 'ASIDE', 'ARTICLE']);
  let last = '';
  const push = (line) => { if (line && line !== last) { out.push(line); last = line; } };
  const walk = (el, depth) => {
    if (skip.has(el.tagName) || !visible(el)) return;
    const tag = el.tagName;
    if (block.has(tag) || (depth <= 3 && tag === 'DIV' && el.children.length > 1 && (el.id || /section|hero|block|wrap/i.test(el.className || '')))) {
      push('');
      push('--- ' + (block.has(tag) ? tag.toLowerCase() : 'bloco') + (el.id ? '#' + el.id : ''));
    }
    const b = bg(el);
    if (b) push('![fundo](' + addMedia(b, '') + ')');
    if (/^H[1-6]$/.test(tag)) { const t = txt(el); if (t) push('#'.repeat(Number(tag[1])) + ' ' + t); return; }
    if (tag === 'P' || tag === 'BLOCKQUOTE' || tag === 'FIGCAPTION' || tag === 'SUMMARY' || tag === 'LABEL') { const t = txt(el); if (t.length > 1) push((tag === 'BLOCKQUOTE' ? '> ' : '') + t); el.querySelectorAll('img').forEach((i) => push('![' + (i.alt || '') + '](' + addMedia(bestSrc(i), i.alt) + ')')); return; }
    if (tag === 'LI') { const t = txt(el); if (t) push('- ' + t); return; }
    if (tag === 'A' || tag === 'BUTTON') {
      const t = txt(el); const href = tag === 'A' ? el.getAttribute('href') : '';
      const imgs = el.querySelectorAll('img');
      imgs.forEach((i) => push('![' + (i.alt || '') + '](' + addMedia(bestSrc(i), i.alt) + ')'));
      if (t) push('[' + t + ']' + (href ? '(' + abs(href) + ')' : '(botão)'));
      else if (!imgs.length) { const s = el.querySelector('svg'); if (s && href) push('[ícone](' + abs(href) + ')'); }
      return;
    }
    if (tag === 'IMG') { const u = bestSrc(el); if (u) push('![' + (el.alt || '') + '](' + addMedia(u, el.alt) + ')'); return; }
    if (tag === 'PICTURE') { const i = el.querySelector('img'); if (i) walk(i, depth + 1); return; }
    if (tag === 'SVG' || tag === 'svg') { return; }
    if (tag === 'VIDEO') { const s = el.currentSrc || el.src || (el.querySelector('source') || {}).src; if (s) push('[vídeo](' + abs(s) + ')'); if (el.poster) push('![poster](' + addMedia(el.poster, 'poster') + ')'); return; }
    if (tag === 'TABLE') { Array.from(el.rows).slice(0, 40).forEach((r) => push('| ' + Array.from(r.cells).map((c) => txt(c)).join(' | ') + ' |')); return; }
    if (tag === 'FORM') { const f = Array.from(el.querySelectorAll('input,select,textarea')).filter((x) => x.type !== 'hidden').map((x) => (x.getAttribute('placeholder') || x.name || x.type) + ' (' + (x.tagName === 'SELECT' ? 'select' : x.type || 'text') + ')'); if (f.length) push('[formulário: ' + f.join(', ') + ']'); return; }
    for (const c of el.children) walk(c, depth + 1);
    if (!el.children.length && !['DIV', 'SPAN'].includes(tag)) { const t = txt(el); if (t) push(t); }
    else if (!el.children.length) { const t = txt(el); if (t.length > 1) push(t); }
  };
  walk(document.body, 0);
  const lead = Array.from(document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"],link[rel~="icon"],link[rel="apple-touch-icon"]')).map((m) => m.content || m.href);
  lead.forEach((u) => addMedia(u, 'meta'));
  const links = Array.from(document.querySelectorAll('a[href]')).map((a) => abs(a.getAttribute('href'))).filter(Boolean);
  const contacts = Array.from(new Set(Array.from(document.querySelectorAll('a[href^="mailto:"],a[href^="tel:"],a[href*="wa.me"],a[href*="instagram.com"],a[href*="linkedin.com"],a[href*="facebook.com"],a[href*="youtube.com"],a[href*="x.com"],a[href*="twitter.com"],a[href*="tiktok.com"],a[href*="github.com"]')).map((a) => a.getAttribute('href'))));
  const jsonld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent || '').filter(Boolean).map((s) => s.slice(0, 4000));
  return {
    title: document.title,
    description: (document.querySelector('meta[name="description"]') || {}).content || '',
    lang: document.documentElement.lang || '',
    md: out.join('\\n').replace(/\\n{3,}/g, '\\n\\n').slice(0, 60000),
    links, media, contacts, jsonld,
  };
})()`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rola a página inteira para disparar imagens preguiçosas e animações de entrada. */
async function warmUp(win: BrowserWindow) {
  const wc = win.webContents;
  const h: number = await wc.executeJavaScript('Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');
  const steps = Math.min(12, Math.ceil(h / 800));
  for (let i = 1; i <= steps; i++) {
    await wc.executeJavaScript(`window.scrollTo(0, ${i * 800})`);
    await wait(180);
  }
  await wc.executeJavaScript('window.scrollTo(0, 0)');
  await wait(300);
}

const slugOf = (p: string) => (p === '/' || !p ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'pagina');

/** Páginas internas mais prováveis de serem do menu: links curtos, sem arquivos, sem repetir. */
function pickInternal(home: URL, links: string[]): URL[] {
  const found = new Map<string, URL>();
  for (const l of links) {
    try {
      const u = new URL(l);
      if (u.host !== home.host || !/^https?:$/.test(u.protocol)) continue;
      const p = u.pathname.replace(/\/$/, '') || '/';
      if (p === '/' || p === (home.pathname.replace(/\/$/, '') || '/')) continue;
      if (/\.(pdf|zip|png|jpe?g|webp|gif|svg|mp4|xml|json|txt|docx?|xlsx?)$/i.test(p)) continue;
      if (/(login|signin|signup|cart|checkout|account|wp-admin|privacy|privacidade|terms|termos|cookie)/i.test(p)) continue;
      if (p.split('/').length > 3) continue;
      if (!found.has(p)) found.set(p, new URL(p, home.origin));
    } catch {}
  }
  return [...found.values()].slice(0, MAX_PAGES - 1);
}

const EXT_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg' };

async function downloadMedia(refDir: string, list: Array<{ url: string; alt: string; page: string }>) {
  const saved: Array<{ name: string; url: string; alt: string; page: string; kb: number }> = [];
  let total = 0;
  for (const m of list) {
    if (saved.length >= MAX_MEDIA || total >= MAX_TOTAL_BYTES) break;
    try {
      const res = await fetch(m.url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 AuraDev' } });
      if (!res.ok) continue;
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = EXT_BY_TYPE[type];
      if (!ext) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_MEDIA_BYTES || buf.length < 600) continue;
      const name = `media-${saved.length + 1}.${ext}`;
      fs.writeFileSync(path.join(refDir, name), buf);
      total += buf.length;
      saved.push({ name, url: m.url, alt: m.alt, page: m.page, kb: Math.round(buf.length / 1024) });
    } catch {}
  }
  return saved;
}

export interface RebuildResult {
  pages: Array<{ path: string; title: string; shot?: string }>;
  media: number;
}

/** Percorre a home e as páginas internas do menu, grava `_reference/content.md` e baixa as mídias para `_reference/media-N.ext`. */
export async function extractSiteForRebuild(win: BrowserWindow, home: URL, refDir: string): Promise<RebuildResult> {
  const wc = win.webContents;
  const pages: PageData[] = [];
  const grab = async (u: URL, pagePath: string) => {
    await warmUp(win);
    const d: Omit<PageData, 'path' | 'url'> = await wc.executeJavaScript(EXTRACT_JS);
    pages.push({ ...d, path: pagePath, url: u.toString() });
  };

  await grab(home, '/');
  const shots: Record<string, string> = {};
  const internal = pickInternal(home, pages[0].links);
  for (const u of internal) {
    try {
      await Promise.race([win.loadURL(u.toString()), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
      await wait(1800);
      const p = u.pathname.replace(/\/$/, '') || '/';
      await grab(u, p);
      const name = `page-${slugOf(p)}.png`;
      fs.writeFileSync(path.join(refDir, name), (await wc.capturePage()).toPNG());
      shots[p] = name;
    } catch {}
  }

  const all: Array<{ url: string; alt: string; page: string }> = [];
  const dedupe = new Set<string>();
  for (const p of pages) for (const m of p.media) if (!dedupe.has(m.url)) { dedupe.add(m.url); all.push({ ...m, page: p.path }); }
  // fotos e logos primeiro, ícones da aba e imagens de metadados por último
  all.sort((a, b) => Number(a.alt === 'meta') - Number(b.alt === 'meta'));
  const saved = await downloadMedia(refDir, all);
  const local = new Map(saved.map((s) => [s.url, s.name]));

  const md: string[] = [
    `# Conteúdo extraído de ${home.host}`,
    '',
    'Este arquivo traz o conteúdo REAL do site de referência, página por página, na ordem em que aparece. Use os textos, dados, links e nomes daqui. As mídias baixadas estão em _reference/media-N.ext (veja a lista no fim); as demais ficam com o endereço original.',
    '',
  ];
  for (const p of pages) {
    md.push(`## Página ${p.path}  (${p.url})`, `Título: ${p.title}`, p.description ? `Descrição (SEO): ${p.description}` : '', p.lang ? `Idioma: ${p.lang}` : '', shots[p.path] ? `Captura: ${shots[p.path]}` : '', '');
    let body = p.md;
    for (const [u, n] of local) body = body.split(`(${u})`).join(`(${n})`);
    md.push(body, '');
    if (p.contacts.length) md.push('Contatos e redes: ' + p.contacts.join(', '), '');
    if (p.jsonld.length) md.push('Dados estruturados (JSON-LD, úteis para endereço, horários, avaliações, produtos):', ...p.jsonld.map((j) => '```json\n' + j + '\n```'), '');
  }
  md.push('## Mídias baixadas (use com <img data-asset="media-N.ext"> ou url(\'asset:media-N.ext\'))', '');
  for (const s of saved) md.push(`- ${s.name} (${s.kb} KB) alt: "${s.alt === 'meta' ? 'ícone/compartilhamento' : s.alt}" · página ${s.page} · original ${s.url}`);
  const notSaved = all.filter((m) => !local.has(m.url));
  if (notSaved.length) md.push('', 'Mídias não baixadas (grandes demais, formato não suportado ou falha); se precisar, use o endereço original:', ...notSaved.slice(0, 40).map((m) => `- ${m.url}${m.alt ? ` (alt: ${m.alt})` : ''}`));
  fs.writeFileSync(path.join(refDir, 'content.md'), md.filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n'));

  return { pages: pages.map((p) => ({ path: p.path, title: p.title, shot: shots[p.path] })), media: saved.length };
}
