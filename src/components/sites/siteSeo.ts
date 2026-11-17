import type { SiteMeta } from './siteStore';

// Domínio, Google Analytics e Microsoft Clarity do site. As tags só entram no arquivo exportado (finalizeSiteHtml):
// o index.html editado pela IA e o preview ficam limpos, para não contar visita de teste nem brigar com as edições.
export type SiteSettings = Pick<SiteMeta, 'domain' | 'gaId' | 'clarityId'>;

const GA_RE = /^G-[A-Z0-9]{6,14}$/;
const CLARITY_RE = /^[a-z0-9]{8,12}$/;
const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const normalizeDomain = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
export const normalizeGaId = (v: string) => v.trim().toUpperCase();
export const normalizeClarityId = (v: string) => v.trim().toLowerCase();

/** Mensagem de erro por campo (campo vazio é válido: significa "desligado"). */
export function validateSettings(s: { domain?: string; gaId?: string; clarityId?: string }): Partial<Record<'domain' | 'gaId' | 'clarityId', string>> {
  const errors: Partial<Record<'domain' | 'gaId' | 'clarityId', string>> = {};
  if (s.domain && !HOST_RE.test(normalizeDomain(s.domain))) errors.domain = 'Use um domínio como meusite.com.br';
  if (s.gaId && !GA_RE.test(normalizeGaId(s.gaId))) errors.gaId = 'O ID do GA4 começa com G- (ex.: G-ABC123XYZ4)';
  if (s.clarityId && !CLARITY_RE.test(normalizeClarityId(s.clarityId))) errors.clarityId = 'ID do projeto Clarity: 8 a 12 letras/números';
  return errors;
}

const START = '<!-- aura-site-settings -->';
const END = '<!-- /aura-site-settings -->';

/** HTML pronto para publicar: canonical/og:url do domínio e as tags de GA4 e Clarity. */
export function finalizeSiteHtml(html: string, s: SiteSettings): string {
  const domain = s.domain && HOST_RE.test(s.domain) ? s.domain : '';
  const ga = s.gaId && GA_RE.test(s.gaId) ? s.gaId : '';
  const clarity = s.clarityId && CLARITY_RE.test(s.clarityId) ? s.clarityId : '';
  if (!domain && !ga && !clarity) return html;
  let out = html.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g'), '');
  const parts: string[] = [START];
  if (domain) {
    out = out.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '').replace(/<meta[^>]+property=["']og:url["'][^>]*>\s*/gi, '');
    parts.push(`<link rel="canonical" href="https://${domain}/">`, `<meta property="og:url" content="https://${domain}/">`);
  }
  if (ga) {
    parts.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');</script>`,
    );
  }
  if (clarity) {
    parts.push(
      `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");</script>`,
    );
  }
  parts.push(END);
  const block = parts.join('\n');
  return /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${block}\n</head>`) : `${block}\n${out}`;
}
