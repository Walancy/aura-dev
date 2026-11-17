// Página de exemplo de cada modelo: aparece como miniatura no catálogo, como preview ao escolher o modelo e vira o
// index.html inicial do site (a IA a transforma no site real, mantendo a direção de arte).
import type { SiteTemplate } from './siteTemplates';
import { SQUARED_TEMPLATE_HTML } from './squaredTemplateHtml';
import { ISOMEET_TEMPLATE_HTML } from './isomeetTemplateHtml';
import { VISUVATE_TEMPLATE_HTML } from './visuvateTemplateHtml';
import { MARCUS_TEMPLATE_HTML } from './marcusTemplateHtml';
import { KSTOIMENOV_TEMPLATE_HTML } from './kstoimenovTemplateHtml';
import { AVECANNI_TEMPLATE_HTML } from './avecanniTemplateHtml';
import { OXIGEN_TEMPLATE_HTML } from './oxigenTemplateHtml';
import { BALLANCE_TEMPLATE_HTML } from './ballanceTemplateHtml';
import { WILLIAMS_TEMPLATE_HTML } from './williamsTemplateHtml';
import { GRAINIENT_TEMPLATE_HTML } from './grainientTemplateHtml';
import { CIAOENERGY_TEMPLATE_HTML } from './ciaoenergyTemplateHtml';
import { NEOCONDA_TEMPLATE_HTML } from './neocondaTemplateHtml';
import { TRIONN_TEMPLATE_HTML } from './trionnTemplateHtml';
import { STORIA_TEMPLATE_HTML } from './storiaTemplateHtml';
import { GETBLUE_TEMPLATE_HTML } from './getblueTemplateHtml';
import { COFFEETECH_TEMPLATE_HTML } from './coffeetechTemplateHtml';
import { FLOWTY_TEMPLATE_HTML } from './flowtyTemplateHtml';
import { TRACED_TEMPLATE_HTML } from './tracedTemplateHtml';

export interface SampleSpec {
  fonts: [string, string];
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  radius: number;
  hero: 'dashboard' | 'card' | 'editorial' | 'portrait' | 'product' | 'booking' | 'terminal' | 'photo' | 'poster' | 'menu' | 'phone' | 'plain';
  brand: string;
  nav: string[];
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  features: Array<[string, string]>;
  stats: Array<[string, string]>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fontHref = (fonts: [string, string]) => `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&')}&display=swap`;

function heroVisual(s: SampleSpec): string {
  const pic = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
  switch (s.hero) {
    case 'dashboard':
      return `<div class="vis dash"><div class="dash-side">${[1, 2, 3, 4].map((i) => `<i style="opacity:${i === 1 ? 1 : 0.35}"></i>`).join('')}</div><div class="dash-main"><div class="dash-cards">${['R$ 48,2 mil', '1.284', '98,2%'].map((v, i) => `<div><small>${['Receita', 'Clientes', 'Uptime'][i]}</small><b>${v}</b></div>`).join('')}</div><svg viewBox="0 0 320 110" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.accent}" stop-opacity=".5"/><stop offset="1" stop-color="${s.accent}" stop-opacity="0"/></linearGradient></defs><path d="M0 90 C40 70 60 80 90 55 S150 30 190 45 S260 20 320 10 V110 H0Z" fill="url(#g)"/><path d="M0 90 C40 70 60 80 90 55 S150 30 190 45 S260 20 320 10" fill="none" stroke="${s.accent}" stroke-width="2.5"/></svg></div></div>`;
    case 'card':
      return `<div class="vis"><div class="ccard"><span class="chip"></span><b>•••• 4821</b><small>${s.brand.toUpperCase()}</small></div></div>`;
    case 'portrait':
      return `<div class="vis"><img class="portrait" src="${pic('portrait', 520, 520)}" alt=""></div>`;
    case 'product':
      return `<div class="vis"><div class="product"><div class="bottle"></div><div class="swatches"><i style="background:${s.accent}"></i><i style="background:${s.accent2}"></i><i style="background:${s.text}"></i></div></div></div>`;
    case 'booking':
      return `<div class="vis"><form class="booking" onsubmit="return false">${['Check-in', 'Check-out', 'Hóspedes'].map((l) => `<label>${l}<input placeholder="${l === 'Hóspedes' ? '2 adultos' : '12/12/2026'}"></label>`).join('')}<button type="submit">Reservar</button></form></div>`;
    case 'terminal':
      return `<div class="vis"><div class="term"><div class="term-bar"><i></i><i></i><i></i></div><pre>$ curl -X POST api.${s.brand.toLowerCase()}.ai/v1/run \\\n  -d '{"prompt":"classifique este texto"}'\n\n{ "label": "positivo", "score": 0.97 }</pre></div></div>`;
    case 'photo':
      return `<div class="vis"><img class="photo" src="${pic(s.brand.toLowerCase(), 900, 620)}" alt=""></div>`;
    case 'poster':
      return `<div class="vis"><img class="photo duo" src="${pic('athlete', 900, 620)}" alt=""></div>`;
    case 'menu':
      return `<div class="vis"><div class="menu">${[['Espresso', '9'], ['Flat white', '14'], ['Pão de queijo', '8'], ['Cheesecake', '19']].map(([n, p]) => `<div><span>${n}</span><i></i><b>R$ ${p}</b></div>`).join('')}</div></div>`;
    case 'phone':
      return `<div class="vis"><div class="phone"><div class="notch"></div><div class="screen"><b>Bom dia, Ana</b><div class="bar" style="width:70%"></div><div class="bar" style="width:45%"></div><div class="tile"></div><div class="tile" style="opacity:.5"></div></div></div></div>`;
    case 'editorial':
    case 'plain':
    default:
      return '';
  }
}

export function templateSampleHtml(t: SiteTemplate): string {
  if (t.id === 'squared') return SQUARED_TEMPLATE_HTML;
  if (t.id === 'isomeet') return ISOMEET_TEMPLATE_HTML;
  if (t.id === 'visuvate') return VISUVATE_TEMPLATE_HTML;
  if (t.id === 'marcus') return MARCUS_TEMPLATE_HTML;
  if (t.id === 'kstoimenov') return KSTOIMENOV_TEMPLATE_HTML;
  if (t.id === 'avecanni') return AVECANNI_TEMPLATE_HTML;
  if (t.id === 'oxigen') return OXIGEN_TEMPLATE_HTML;
  if (t.id === 'ballance') return BALLANCE_TEMPLATE_HTML;
  if (t.id === 'williams') return WILLIAMS_TEMPLATE_HTML;
  if (t.id === 'grainient') return GRAINIENT_TEMPLATE_HTML;
  if (t.id === 'ciaoenergy') return CIAOENERGY_TEMPLATE_HTML;
  if (t.id === 'neoconda') return NEOCONDA_TEMPLATE_HTML;
  if (t.id === 'trionn') return TRIONN_TEMPLATE_HTML;
  if (t.id === 'storia') return STORIA_TEMPLATE_HTML;
  if (t.id === 'getblue') return GETBLUE_TEMPLATE_HTML;
  if (t.id === 'coffeetech') return COFFEETECH_TEMPLATE_HTML;
  if (t.id === 'flowty') return FLOWTY_TEMPLATE_HTML;
  if (t.id === 'traced') return TRACED_TEMPLATE_HTML;
  const s = t.sample;
  if (!s) return SQUARED_TEMPLATE_HTML;
  const dark = isDark(s.bg);
  const line = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const editorial = s.hero === 'editorial';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${fontHref(s.fonts)}" rel="stylesheet">
<style>
:root{--bg:${s.bg};--surface:${s.surface};--text:${s.text};--muted:${s.muted};--accent:${s.accent};--accent2:${s.accent2};--line:${line};--r:${s.radius}px}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'${s.fonts[1]}',system-ui,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:'${s.fonts[0]}',serif;line-height:1.05;letter-spacing:-.02em;font-weight:${editorial ? 700 : 600}}
a{color:inherit;text-decoration:none}
.wrap{width:min(1180px,calc(100% - 48px));margin:0 auto}
header{position:sticky;top:0;z-index:10;backdrop-filter:blur(14px);background:color-mix(in srgb,var(--bg) 78%,transparent)}
header .wrap{display:flex;align-items:center;gap:28px;height:68px}
.brand{font-family:'${s.fonts[0]}';font-weight:700;font-size:20px}
nav{display:flex;gap:22px;margin-left:auto;font-size:14px;color:var(--muted)}
nav a:hover{color:var(--text)}
.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 22px;border-radius:calc(var(--r)/1.4);background:var(--accent);color:${isDark(s.accent) ? '#fff' : '#111'};font-weight:500;font-size:14px;transition:transform .18s ease,filter .18s ease}
.btn:hover{transform:translateY(-1px);filter:brightness(1.08)}
.btn.ghost{background:transparent;color:var(--text);box-shadow:inset 0 0 0 1px var(--line)}
.hero{padding:${editorial ? '96px 0 48px' : '88px 0 64px'};position:relative;overflow:hidden}
.hero .wrap{display:grid;grid-template-columns:${editorial || s.hero === 'plain' ? '1fr' : '1.05fr .95fr'};gap:56px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:18px}
.eyebrow::before{content:"";width:22px;height:1px;background:var(--accent)}
h1{font-size:clamp(40px,${editorial ? '9vw' : '5.6vw'},${editorial ? '124px' : '76px'});margin-bottom:22px}
.sub{font-size:18px;color:var(--muted);max-width:52ch;margin-bottom:30px}
.actions{display:flex;gap:12px;flex-wrap:wrap}
.glow{position:absolute;inset:auto;width:60vw;height:60vw;max-width:720px;max-height:720px;border-radius:50%;filter:blur(120px);opacity:.35;pointer-events:none;background:radial-gradient(circle,var(--accent),transparent 65%);right:-18vw;top:-20vw}
.vis{display:flex;justify-content:center}
.dash{width:100%;max-width:520px;aspect-ratio:1.3;border-radius:var(--r);background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);display:grid;grid-template-columns:52px 1fr;overflow:hidden;transform:perspective(1200px) rotateY(-8deg) rotateX(4deg)}
.dash-side{border-right:1px solid var(--line);padding:16px 12px;display:grid;gap:10px;align-content:start}
.dash-side i{display:block;height:26px;border-radius:7px;background:var(--accent)}
.dash-main{padding:18px;display:grid;grid-template-rows:auto 1fr;gap:14px}
.dash-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dash-cards div{padding:12px;border-radius:10px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line);display:grid;gap:4px}
.dash-cards small{font-size:11px;color:var(--muted)}.dash-cards b{font-size:15px}
.dash svg{width:100%;height:100%}
.ccard{width:360px;aspect-ratio:1.586;border-radius:18px;padding:24px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 40%,#000));color:#fff;display:grid;align-content:space-between;transform:rotate(-6deg);box-shadow:0 30px 60px -30px rgba(0,0,0,.5)}
.ccard .chip{width:42px;height:30px;border-radius:6px;background:rgba(255,255,255,.35)}.ccard b{font-size:20px;letter-spacing:.14em}.ccard small{font-size:12px;letter-spacing:.2em;opacity:.8}
.portrait{width:min(100%,420px);aspect-ratio:1;border-radius:50%;object-fit:cover;filter:grayscale(.2)}
.product{position:relative;width:320px;height:380px;display:grid;place-items:center}
.bottle{width:150px;height:300px;border-radius:70px 70px 40px 40px;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 85%,#fff),var(--accent) 55%,color-mix(in srgb,var(--accent) 70%,#000));box-shadow:0 40px 60px -30px rgba(0,0,0,.45);transition:transform .4s ease}
.product:hover .bottle{transform:rotate(-4deg) scale(1.03)}
.swatches{position:absolute;bottom:0;display:flex;gap:10px}.swatches i{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--bg)}
.booking{width:100%;max-width:420px;background:var(--surface);border-radius:var(--r);padding:22px;display:grid;gap:12px;box-shadow:0 30px 60px -40px rgba(0,0,0,.6)}
.booking label{display:grid;gap:6px;font-size:12px;color:var(--muted)}.booking input{height:42px;border:0;border-radius:8px;padding:0 12px;background:var(--bg);color:var(--text);font:inherit}
.booking button{height:46px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:500;cursor:pointer}
.term{width:100%;max-width:520px;border-radius:12px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);overflow:hidden;font-family:'JetBrains Mono',ui-monospace,monospace}
.term-bar{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}.term-bar i{width:10px;height:10px;border-radius:50%;background:var(--line)}
.term pre{padding:18px;font-size:13px;line-height:1.6;color:var(--accent);white-space:pre-wrap}
.photo{width:100%;aspect-ratio:1.45;object-fit:cover;border-radius:var(--r)}
.duo{filter:grayscale(1) contrast(1.1);mix-blend-mode:luminosity;opacity:.9}
.menu{width:100%;max-width:440px;background:var(--surface);border-radius:var(--r);padding:26px;display:grid;gap:14px}
.menu div{display:flex;align-items:baseline;gap:10px}.menu i{flex:1;border-bottom:1px dotted var(--muted);opacity:.5}.menu b{font-weight:500}
.phone{width:260px;height:520px;border-radius:40px;background:#0b0b0f;padding:12px;position:relative;transform:perspective(1000px) rotateY(-14deg) rotateX(6deg);box-shadow:0 50px 80px -40px rgba(0,0,0,.7)}
.notch{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:90px;height:24px;border-radius:12px;background:#0b0b0f;z-index:2}
.screen{height:100%;border-radius:30px;background:linear-gradient(180deg,var(--surface),var(--bg));padding:54px 18px 18px;display:grid;gap:12px;align-content:start;color:var(--text)}
.screen .bar{height:10px;border-radius:5px;background:var(--line)}.screen .tile{height:84px;border-radius:14px;background:var(--accent)}
.logos{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0;overflow:hidden}
.logos .wrap{display:flex;gap:48px;justify-content:space-between;flex-wrap:wrap;color:var(--muted);font-size:13px;letter-spacing:.12em;text-transform:uppercase}
section.block{padding:88px 0}
.block h2{font-size:clamp(28px,3.6vw,46px);margin-bottom:14px}
.block .lead{color:var(--muted);max-width:60ch;margin-bottom:40px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.cardx{padding:26px;border-radius:var(--r);background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);transition:transform .2s ease}
.cardx:hover{transform:translateY(-3px)}
.cardx i{display:block;width:34px;height:34px;border-radius:9px;background:var(--accent);opacity:.9;margin-bottom:18px}
.cardx h3{font-size:19px;margin-bottom:8px}.cardx p{color:var(--muted);font-size:14.5px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;padding:40px 0;border-top:1px solid var(--line)}
.stats b{display:block;font-family:'${s.fonts[0]}';font-size:40px;letter-spacing:-.02em}.stats span{color:var(--muted);font-size:14px}
.cta{padding:72px 0}.cta .box{border-radius:var(--r);padding:56px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.cta h2{font-size:clamp(26px,3.2vw,40px)}.cta .btn{background:#fff;color:#111}
footer{padding:48px 0;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}.reveal.in{opacity:1;transform:none}
@media (max-width:900px){.hero .wrap{grid-template-columns:1fr}.grid,.stats{grid-template-columns:1fr 1fr}nav{display:none}}
@media (max-width:560px){.grid,.stats{grid-template-columns:1fr}.wrap{width:calc(100% - 32px)}}
@media (prefers-reduced-motion:reduce){*{transition:none !important}}
</style>
</head>
<body>
<header><div class="wrap"><a class="brand" href="#">${esc(s.brand)}</a><nav>${s.nav.map((n) => `<a href="#${n.toLowerCase()}">${esc(n)}</a>`).join('')}</nav><a class="btn" href="#cta">${esc(s.cta)}</a></div></header>
<main>
<section class="hero" id="hero">${s.hero === 'dashboard' || s.hero === 'terminal' || s.hero === 'phone' ? '<div class="glow"></div>' : ''}<div class="wrap"><div><div class="eyebrow">${esc(s.eyebrow)}</div><h1>${esc(s.headline)}</h1><p class="sub">${esc(s.sub)}</p><div class="actions"><a class="btn" href="#cta">${esc(s.cta)}</a><a class="btn ghost" href="#features">Saiba mais</a></div></div>${heroVisual(s)}</div></section>
<section class="logos" id="clientes"><div class="wrap"><span>Nordlight</span><span>Vetra</span><span>Orbita</span><span>Camada</span><span>Pulso</span><span>Terra Alta</span></div></section>
<section class="block" id="features"><div class="wrap"><h2 class="reveal">${esc(s.features[0][0])}, ${esc(s.features[1][0].toLowerCase())} e ${esc(s.features[2][0].toLowerCase())}</h2><p class="lead reveal">Tudo o que você precisa, sem o que não precisa. Textos de exemplo: descreva o seu negócio no chat e a IA troca por conteúdo real.</p><div class="grid">${s.features.map(([h, p]) => `<article class="cardx reveal"><i></i><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div></div></section>
<section class="block" id="numeros" style="padding-top:0"><div class="wrap"><div class="stats">${s.stats.map(([v, l]) => `<div class="reveal"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div></div></section>
<section class="cta" id="cta"><div class="wrap"><div class="box reveal"><h2>Pronto para começar?</h2><a class="btn" href="#">${esc(s.cta)}</a></div></div></section>
</main>
<footer id="contato"><div class="wrap"><span>${esc(s.brand)} · ${new Date().getFullYear()}</span><span>${s.nav.map(esc).join(' · ')}</span></div></footer>
<script>
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script>
</body>
</html>`;
}

function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
