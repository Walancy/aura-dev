import { readSiteHtml, writeSiteHtml } from './siteStore';
import { fetchStockImage, getPexelsKey, getUnsplashKey } from '../design2/stockImage';

// A IA não escolhe URLs de foto (ela inventa ids que não existem) nem desenha objetos em SVG/CSS (sai bizarro): ela só descreve a foto em
// <img data-photo="white leather sneaker, studio plain background">. Aqui o app busca a foto pelo mesmo serviço do Design
// (Unsplash/Pexels com chave, Wikimedia sem chave), embute como data URL e remove o atributo.
const IMG_RE = /<img\b[^>]*\bdata-photo(?:-id)?\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/gi;
const attrOf = (tag: string, name: string) => { const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? (m[1] ?? m[2] ?? '').trim() : ''; };
const num = (v?: string) => { const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : 0; };
const stripAttrs = (tag: string) => tag.replace(/\s+data-photo(?:-id)?\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');

export interface PhotoResult { ok: number; fail: number; hasKey: boolean }

export async function applyPhotos(siteId: string): Promise<PhotoResult> {
  const hasKey = !!(getUnsplashKey() || getPexelsKey());
  const html = await readSiteHtml(siteId);
  if (!html || !/\bdata-photo(?:-id)?\s*=/i.test(html)) return { ok: 0, fail: 0, hasKey };
  const tags = Array.from(new Set(html.match(IMG_RE) || []));
  // data-photo-id="hero": várias <img> com o mesmo id usam a MESMA foto (fundo + recorte do sujeito em camadas de parallax)
  const byId = new Map<string, string>();
  const replaced = new Map<string, string>();
  let ok = 0;
  let fail = 0;
  const fetchFor = async (tag: string, query: string) => {
    const w = num(attrOf(tag, 'width')) || 1200;
    const h = num(attrOf(tag, 'height')) || Math.round(w * 0.66);
    return query ? (await fetchStockImage(query, Math.min(w, 1600), Math.min(h, 1600), { maxSide: 2400 }).catch(() => null))?.dataUrl || '' : '';
  };
  for (const tag of tags) {
    const id = attrOf(tag, 'data-photo-id');
    const query = attrOf(tag, 'data-photo');
    if (id && query && !byId.has(id)) byId.set(id, await fetchFor(tag, query));
  }
  for (const tag of tags) {
    const id = attrOf(tag, 'data-photo-id');
    const query = attrOf(tag, 'data-photo');
    const dataUrl = id && byId.has(id) ? byId.get(id)! : await fetchFor(tag, query);
    let next = stripAttrs(tag);
    if (dataUrl) {
      next = /\bsrc\s*=/i.test(next) ? next.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*')/i, `src="${dataUrl}"`) : next.replace(/<img\b/i, `<img src="${dataUrl}"`);
      ok++;
    } else {
      fail++;
    }
    replaced.set(tag, next);
  }
  let out = html;
  replaced.forEach((next, tag) => { out = out.split(tag).join(next); });
  if (out !== html) await writeSiteHtml(siteId, out);
  return { ok, fail, hasKey };
}
