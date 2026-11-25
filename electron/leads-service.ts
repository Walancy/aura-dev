// Captação: confere um endereço indicado pela IA (WhatsApp na página, nicho e sinais de visual antigo). Roda local, sem IA e sem gastar tokens.
export interface Lead {
  name: string;
  url: string;
  whatsapp: string;
  niche?: string;
  problems: string[];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BLOCKED = /(^|\.)(facebook|instagram|linkedin|youtube|youtu|tiktok|twitter|x|pinterest|wa|whatsapp|google|bing|duckduckgo|mercadolivre|olx|guiamais|apontador|telelistas|doctoralia|tripadvisor|ifood|reclameaqui|wikipedia|jusbrasil|achei|cylex|yelp|foursquare|linktr|linktree|amazon|shopee|magazineluiza|americanas|booking|airbnb|vagalume|medium|github|gov|mp|jus|org|tumblr|godaddy|hotfrog|solutudo|infoplanet|empresite|econodata|casadosdados|cnpj|listamais|yellowpages|hagah|encontra|catalogo|guia)\.[a-z.]+$/i;
const LISTICLE = /(melhores|top \d+|lista de|ranking|encontre|compare|guia de|diretório|\bpreço médio\b)/i;

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const hostOf = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return '';
  }
};

async function getText(url: string, signal: AbortSignal, maxBytes = 700_000, ms = 9000): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const t = AbortSignal.any([signal, AbortSignal.timeout(ms)]);
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', accept: 'text/html,*/*' }, signal: t, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (type && !/html|text/i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { text: buf.subarray(0, maxBytes).toString('utf8'), finalUrl: res.url || url };
  } catch {
    return null;
  }
}

const unHtml = (v: string) => v.replace(/&amp;/g, '&');

const WA_RE = /(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?[^"'\s>]*?phone=|web\.whatsapp\.com\/send\?[^"'\s>]*?phone=|whatsapp:\/\/send\?[^"'\s>]*?phone=)\+?(\d{10,15})/gi;

function findWhatsapp(html: string): string {
  const h = html.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&');
  for (const m of h.matchAll(WA_RE)) {
    let d = m[1];
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    if (/^55\d{10,11}$/.test(d)) return d;
  }
  return '';
}

/** Sinais de site antigo ou mal feito. Cada um soma pontos e vira uma frase curta. */
function oldDesign(html: string, url: string, css = ''): { score: number; problems: string[] } {
  const found: Array<[number, string]> = [];
  const h = html.slice(0, 600_000);
  const lower = h.toLowerCase();
  if (!/<meta[^>]+name=["']viewport["']/i.test(h)) found.push([3, 'não é responsivo no celular']);
  if (/em constru[cç][aã]o|under construction|site em manuten/i.test(h)) found.push([3, 'aviso de site em construção']);
  if (/\.swf\b|<embed[^>]+flash|shockwave/i.test(h)) found.push([3, 'usa Flash']);
  if (/<(font|center|marquee|blink|frameset|frame)\b/i.test(h) || /\sbgcolor=/i.test(h)) found.push([2, 'HTML antigo (tags obsoletas)']);
  if (/<meta[^>]+generator[^>]+(dreamweaver|frontpage|microsoft word|joomla! 1\.|wysiwyg)/i.test(h)) found.push([2, 'feito com ferramenta antiga']);
  const tables = (lower.match(/<table/g) || []).length;
  if (tables >= 4 && (lower.match(/<td/g) || []).length >= 20) found.push([2, 'layout montado com tabelas']);
  const years = [...h.matchAll(/(?:©|&copy;|copyright)[^<]{0,60}?((?:20|199)\d\d)/gi)].map((m) => Number(m[1]));
  if (years.length) {
    const y = Math.max(...years);
    if (y <= 2019) found.push([2, `rodapé parado em ${y}`]);
  }
  if (/jquery[-.]1\.[0-9]\./i.test(h) || /jquery\.min\.js\?ver=1\./i.test(h)) found.push([1, 'bibliotecas antigas (jQuery 1.x)']);
  if ((lower.match(/\.gif\b/g) || []).length >= 6) found.push([1, 'muitas imagens GIF']);
  if (!/<h1[\s>]/i.test(h)) found.push([1, 'sem título principal na página']);
  if ((lower.match(/\sstyle=/g) || []).length > 60) found.push([1, 'estilos soltos misturados ao HTML']);
  if (/^http:\/\//i.test(url)) found.push([1, 'sem HTTPS']);
  const all = `${h}\n${css}`;
  if (css) {
    if (!/@media[^{]*(max|min)-width/i.test(all)) found.push([3, 'sem adaptação a telas menores']);
    const floats = (all.match(/float\s*:\s*(left|right)/gi) || []).length;
    if (floats >= 6 && !/display\s*:\s*(flex|grid)/i.test(all)) found.push([2, 'layout antigo com float, sem flex nem grid']);
  }
  if (!/@font-face|fonts\.googleapis|fonts\.bunny|use\.typekit|fontawesome/i.test(all) && css) found.push([1, 'tipografia padrão do sistema']);
  if (!/property=["']og:(title|image)["']/i.test(h)) found.push([1, 'sem prévia ao compartilhar o link']);
  found.sort((a, b) => b[0] - a[0]);
  return { score: found.reduce((n, f) => n + f[0], 0), problems: found.slice(0, 3).map((f) => f[1]) };
}

const stripTags = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

function businessName(html: string, host: string): string {
  const og = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim();
  const pick = og || (title ? title.split(/\s[-|–—•·:]\s|,\s/)[0] : '') || host;
  return pick.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").slice(0, 60).trim() || host;
}

/** Abre a página inicial do endereço e devolve o lead se ela tem WhatsApp, é do nicho e tem visual antigo; senão, null. */
export async function analyzeLead(url: string, niche: string, signal: AbortSignal): Promise<Lead | null> {
  let origin = '';
  try {
    origin = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).origin;
  } catch {
    return null;
  }
  const host = hostOf(origin);
  if (!host || BLOCKED.test(host)) return null;
  const page = await getText(origin, signal);
  if (!page) return null;
  const finalHost = hostOf(page.finalUrl);
  if (!finalHost || BLOCKED.test(finalHost)) return null;
  const html = page.text;
  const wa = findWhatsapp(html);
  if (!wa) return null;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  if (LISTICLE.test(title)) return null;
  if (niche.trim()) {
    const stem = norm(niche).replace(/[^a-z0-9 ]/g, '').split(' ')[0].slice(0, 5);
    if (stem.length >= 3 && !norm(stripTags(html).slice(0, 30000)).includes(stem)) return null;
  }
  const hrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
    .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
    .filter((x): x is string => !!x && !/fonts\.googleapis|fontawesome|bootstrapcdn|cdnjs|jsdelivr|unpkg/i.test(x))
    .slice(0, 3);
  const sheets = await Promise.all(hrefs.map((x) => getText(new URL(x, page.finalUrl).toString(), signal, 200_000, 6000).then((r) => r?.text || '').catch(() => '')));
  const css = sheets.join('\n') + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const d = oldDesign(html, page.finalUrl, css || ' ');
  if (d.score < 3) return null;
  return { name: businessName(html, finalHost), url: new URL(page.finalUrl).origin, whatsapp: wa, niche: niche.trim() || undefined, problems: d.problems };
}
