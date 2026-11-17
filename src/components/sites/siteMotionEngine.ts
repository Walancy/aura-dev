// Motor de movimento colado pela IA em todo site novo: o código já foi testado (revelações, cenas por scroll, cursor, magnético, tilt...),
// então a IA só marca o HTML com data-attributes em vez de escrever (e errar) a lógica de animação a cada criação.
export const AURA_FX_ENGINE = String.raw`<style id="aura-fx-css">
:root{--ease:cubic-bezier(.16,1,.3,1);--bg:#0b0b0c;--fg:#f5f5f4}
html{scroll-behavior:smooth}
/* scrollbar fina e discreta (use só os pseudo-elementos webkit: scrollbar-width/scrollbar-color deixariam a barra mais grossa) */
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--fg,#888) 28%,transparent);border-radius:9px;transition:background .2s}::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--fg,#888) 55%,transparent)}
body{background:var(--bg);color:var(--fg);transition:background-color .9s var(--ease),color .9s var(--ease)}
/* revelações: só escondem se o motor rodou (html.fx); sem JS tudo fica visível */
html.fx [data-reveal]{opacity:0;transform:translate3d(0,var(--ry,48px),0);transition:opacity 1s var(--ease),transform 1s var(--ease);transition-delay:var(--d,0s)}
html.fx [data-reveal="left"]{transform:translate3d(-60px,0,0)}
html.fx [data-reveal="right"]{transform:translate3d(60px,0,0)}
html.fx [data-reveal="scale"]{transform:scale(.88)}
html.fx [data-reveal="clip"]{opacity:1;transform:none;clip-path:inset(0 0 calc(100% - 2px) 0);transition:clip-path 1.2s var(--ease);transition-delay:var(--d,0s)}
html.fx [data-reveal].in{opacity:1;transform:none;clip-path:inset(0 0 0 0)}
html.fx [data-split]{visibility:hidden}
html.fx [data-split].in,html.fx [data-split].ready{visibility:visible}
.fx-w{display:inline-block;overflow:hidden;vertical-align:top;padding:.24em .06em;margin:-.24em -.06em}
.fx-w>span{display:inline-block;transform:translateY(112%);transition:transform 1.1s var(--ease);transition-delay:calc(var(--i)*55ms + var(--d,0s))}
[data-split].in .fx-w>span{transform:none}
/* transições entre seções, dirigidas pelo scroll (--e = entrada 0..1, --p = passagem 0..1) */
[data-curtain]{--e:1;clip-path:inset(calc((1 - var(--e))*9vh) calc((1 - var(--e))*7vw) 0 round calc((1 - var(--e))*48px));will-change:clip-path}
[data-scale-in]{transform:scale(calc(.9 + var(--e,1)*.1));opacity:calc(.25 + var(--e,1)*.75);will-change:transform}
[data-fade-out]{opacity:calc(1 - var(--x,0)*1.1);transform:translateY(calc(var(--x,0)*-6vh))}
[data-pin]{position:relative;height:var(--pin-h,300vh)}
[data-pin]>.pin-stage{position:sticky;top:0;height:100vh;overflow:hidden}
[data-hscroll]{position:relative}
[data-hscroll]>.pin-stage{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
[data-hscroll] .h-track{display:flex;gap:4vw;padding:0 8vw;will-change:transform}
[data-stack]>*{position:sticky;top:calc(9vh + var(--i,0)*26px);transform:scale(var(--s,1));transform-origin:50% 0;will-change:transform}
[data-progress]{position:fixed;left:0;top:0;height:3px;width:100%;transform-origin:0 50%;transform:scaleX(var(--sp,0));background:currentColor;z-index:9998}
[data-nav]{transition:transform .6s var(--ease),background-color .4s ease}
[data-nav].hide{transform:translateY(-110%)}
[data-magnetic],[data-tilt]{will-change:transform}
[data-tilt]{transform-style:preserve-3d;transition:transform .25s ease-out}
[data-tilt]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.16),transparent 60%)}
[data-tilt]:hover::after{opacity:1}
[data-marquee]{overflow:hidden;white-space:nowrap}
[data-marquee]>.m-track{display:inline-flex;will-change:transform}
[data-loader]{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--fg);transition:clip-path 1s var(--ease);clip-path:inset(0 0 0 0)}
[data-loader].done{clip-path:inset(0 0 100% 0);pointer-events:none}
.fx-cursor,.fx-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:9999;border-radius:50%;opacity:0;transition:opacity .3s}
.fx-cursor{width:8px;height:8px;margin:-4px 0 0 -4px;background:#fff;mix-blend-mode:difference}
.fx-ring{width:38px;height:38px;margin:-19px 0 0 -19px;border:1px solid #fff;mix-blend-mode:difference;display:flex;align-items:center;justify-content:center;font:500 10px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#fff;transition:width .35s var(--ease),height .35s var(--ease),margin .35s var(--ease),opacity .3s}
.fx-ring.big{width:84px;height:84px;margin:-42px 0 0 -42px}
/* cursor nativo some só depois que o customizado está ativo (JS adiciona html.fx-cursor-on); campos de texto mantêm o cursor de texto */
html.fx-cursor-on,html.fx-cursor-on *{cursor:none!important}
html.fx-cursor-on input,html.fx-cursor-on textarea,html.fx-cursor-on select,html.fx-cursor-on [contenteditable]{cursor:text!important}
@media (hover:none),(pointer:coarse){.fx-cursor,.fx-ring{display:none}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
<script id="aura-fx-js">
(function(){
function boot(){
var d=document,root=d.documentElement,$=function(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s))};
var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches,fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))},lerp=function(a,b,t){return a+(b-a)*t};
function safe(fn){try{fn()}catch(e){console.warn('aura-fx',e)}}
if(reduce){return}
root.classList.add('fx');
setTimeout(function(){if(!root.classList.contains('ready'))start()},4000); /* rede de segurança: nada fica escondido */
var started=false;
function start(){if(started)return;started=true;root.classList.add('ready');var l=$('[data-loader]')[0];if(l)l.classList.add('done');reveal()}

/* separa títulos em palavras com máscara: data-split (aceita <em>/<span> dentro) */
function split(){$('[data-split]').forEach(function(el){safe(function(){
  var i=0;function wrap(txt){var f=d.createDocumentFragment();txt.split(/(\s+)/).forEach(function(w){if(!w)return;if(/^\s+$/.test(w)){f.appendChild(d.createTextNode(' '));return}var o=d.createElement('span');o.className='fx-w';var n=d.createElement('span');n.textContent=w;n.style.setProperty('--i',i++);o.appendChild(n);f.appendChild(o)});return f}
  Array.prototype.slice.call(el.childNodes).forEach(function(n){
    if(n.nodeType===3){n.replaceWith(wrap(n.textContent))}
    else if(n.nodeType===1&&n.tagName!=='BR'){var t=n.textContent;n.textContent='';n.appendChild(wrap(t))}
  });el.setAttribute('aria-label',el.textContent.replace(/\s+/g,' ').trim());
})})}
split();

/* revelações ao entrar na tela + contadores */
function count(el){var to=parseFloat(el.getAttribute('data-count')),suf=el.getAttribute('data-suffix')||'',dec=(el.getAttribute('data-count').split('.')[1]||'').length,t0=performance.now(),dur=1600;
  (function f(t){var k=clamp((t-t0)/dur,0,1),e=1-Math.pow(1-k,4);el.textContent=(to*e).toFixed(dec)+suf;if(k<1)requestAnimationFrame(f)})(t0)}
var io,ioClip;
function reveal(){if(io)return;
  io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target;el.classList.add('in');if(el.hasAttribute('data-count'))count(el);io.unobserve(el)})},{threshold:.15,rootMargin:'0px 0px -6% 0px'});
  /* recortes (clip) deixam só uma faixa de 2px visível: com threshold 0 o observador os enxerga quando o topo entra na tela */
  ioClip=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;e.target.classList.add('in');ioClip.unobserve(e.target)})},{threshold:0,rootMargin:'0px 0px -8% 0px'});
  $('[data-reveal],[data-split],[data-count]').forEach(function(el){(el.getAttribute('data-reveal')==='clip'?ioClip:io).observe(el)})}

/* cor da página muda conforme a seção: data-bg="#fff" data-fg="#111" na <section> */
safe(function(){var s=$('[data-bg]');if(!s.length)return;var t=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){root.style.setProperty('--bg',e.target.getAttribute('data-bg'));root.style.setProperty('--fg',e.target.getAttribute('data-fg')||'#fff')}})},{rootMargin:'-45% 0px -45% 0px'});s.forEach(function(x){t.observe(x)})});

/* loader: contador opcional em [data-loader-count] */
safe(function(){var l=$('[data-loader]')[0];if(!l){window.addEventListener('load',function(){setTimeout(start,50)});return}
  var c=$('[data-loader-count]',l)[0],t0=performance.now(),min=1400,loaded=false;window.addEventListener('load',function(){loaded=true});
  (function f(t){var k=clamp((t-t0)/min,0,1);if(c)c.textContent=Math.round((loaded?k:Math.min(k,.9))*100);if(k>=1&&loaded){setTimeout(start,250)}else requestAnimationFrame(f)})(t0)});

/* medidas das cenas fixas (pin) e do scroll horizontal */
var hs=$('[data-hscroll]'),pins=$('[data-pin]'),stacks=$('[data-stack]');
function measure(){hs.forEach(function(s){var tr=$('.h-track',s)[0];if(tr)s.style.height=(tr.scrollWidth-innerWidth+innerHeight)+'px'});
  pins.forEach(function(p){var n=parseFloat(p.getAttribute('data-pin'))||3;p.style.setProperty('--pin-h',(n*100)+'vh')});
  stacks.forEach(function(s){Array.prototype.slice.call(s.children).forEach(function(c,i){c.style.setProperty('--i',i)})})}
measure();addEventListener('resize',measure);addEventListener('load',measure);

/* scroll suave opcional: com <script src=".../lenis.min.js"> o motor usa o Lenis; sem ele, o scroll nativo continua */
var lenis=null;safe(function(){if(window.Lenis){lenis=new Lenis({lerp:.09,smoothWheel:true});d.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var t=d.querySelector(a.getAttribute('href'));if(t){e.preventDefault();lenis.scrollTo(t,{offset:0})}})});root.style.scrollBehavior='auto'}});

/* loop único de scroll: parallax, progresso de seção, pin, horizontal, pilha, marquee, nav, barra */
var par=$('[data-speed]'),scn=$('[data-curtain],[data-scale-in],[data-fade-out],[data-scene]'),mq=$('[data-marquee]'),nav=$('[data-nav]')[0],bar=$('[data-progress]')[0];
mq.forEach(function(m){safe(function(){var kids=Array.prototype.slice.call(m.childNodes),tr=d.createElement('div');tr.className='m-track';kids.forEach(function(k){tr.appendChild(k)});m.appendChild(tr);
  var w=tr.scrollWidth||1,n=Math.max(2,Math.ceil(innerWidth*2/w)+1);for(var i=1;i<n;i++){Array.prototype.slice.call(tr.children).slice(0,kids.length).forEach(function(k){var c=k.cloneNode(true);c.setAttribute('aria-hidden','true');tr.appendChild(c)})}
  m._x=0;m._w=w;m._dir=m.getAttribute('data-marquee')==='right'?1:-1;m._tr=tr})});
/* parallax em camadas: <section data-parallax> com filhos data-depth (profundidade), data-zoom (escala com o scroll) e data-drift (deriva horizontal com o scroll) */
var stg=$('[data-parallax]');
stg.forEach(function(st){st._lay=$('[data-depth]',st);st._px=0;st._py=0;st._tx=0;st._ty=0;
  if(fine){st.addEventListener('pointermove',function(e){var r=st.getBoundingClientRect();st._tx=((e.clientX-r.left)/r.width-.5)*2;st._ty=((e.clientY-r.top)/r.height-.5)*2});st.addEventListener('pointerleave',function(){st._tx=0;st._ty=0})}});
var sy=scrollY,ly=scrollY,vel=0;
function frame(){var y=lenis?lenis.scroll:scrollY;sy=lerp(sy,y,.12);vel=lerp(vel,y-ly,.1);ly=y;var vh=innerHeight;
  par.forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;var c=(r.top+r.height/2-vh/2),sp=parseFloat(el.getAttribute('data-speed'))||.2;el.style.transform='translate3d(0,'+(-c*sp).toFixed(1)+'px,0)'});
  stg.forEach(function(st){var r=st.getBoundingClientRect();if(r.bottom<-120||r.top>vh+120)return;st._px=lerp(st._px,st._tx,.07);st._py=lerp(st._py,st._ty,.07);
    var off=-r.top,mv=parseFloat(st.getAttribute('data-parallax'))||34;
    st._lay.forEach(function(l){var dp=parseFloat(l.getAttribute('data-depth'))||0,z=parseFloat(l.getAttribute('data-zoom'))||0,dr=parseFloat(l.getAttribute('data-drift'))||0;
      var tx=-st._px*dp*mv+off*dr,ty=-st._py*dp*mv*.7+off*dp*.45,sc=1+Math.max(0,off)*z;
      l.style.transform='translate3d('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px,0) scale('+sc.toFixed(4)+')'})});
  scn.forEach(function(el){var r=el.getBoundingClientRect();el.style.setProperty('--e',clamp(1-r.top/vh,0,1).toFixed(3));el.style.setProperty('--p',clamp((vh-r.top)/(vh+r.height),0,1).toFixed(3));el.style.setProperty('--x',clamp(-r.top/Math.max(1,r.height),0,1).toFixed(3))});
  hs.forEach(function(s){var r=s.getBoundingClientRect(),tr=$('.h-track',s)[0];if(!tr)return;var p=clamp(-r.top/Math.max(1,r.height-innerHeight),0,1);tr.style.transform='translate3d('+(-p*(tr.scrollWidth-innerWidth)).toFixed(1)+'px,0,0)';s.style.setProperty('--p',p.toFixed(3))});
  pins.forEach(function(s){var r=s.getBoundingClientRect(),p=clamp(-r.top/Math.max(1,r.height-innerHeight),0,1);s.style.setProperty('--p',p.toFixed(3))});
  stacks.forEach(function(s){var k=Array.prototype.slice.call(s.children);k.forEach(function(c,i){var n=k[i+1];if(!n){c.style.setProperty('--s',1);return}var r=n.getBoundingClientRect(),over=clamp(1-(r.top-(vh*.09+(i+1)*26))/(vh*.6),0,1);c.style.setProperty('--s',(1-over*.06).toFixed(3))})});
  mq.forEach(function(m){if(!m._tr)return;m._x+=m._dir*(.6+Math.abs(vel)*.35);if(m._x<=-m._w)m._x+=m._w;if(m._x>=0&&m._dir>0)m._x-=m._w;m._tr.style.transform='translate3d('+m._x.toFixed(1)+'px,0,0) skewX('+clamp(-vel*.15,-8,8).toFixed(2)+'deg)'});
  if(bar)bar.style.setProperty('--sp',(y/Math.max(1,d.documentElement.scrollHeight-vh)).toFixed(4));
  if(nav){var dy=y-(frame._y||0);if(Math.abs(dy)>6){nav.classList.toggle('hide',dy>0&&y>120);frame._y=y}nav.classList.toggle('scrolled',y>40)}
  requestAnimationFrame(frame)}
requestAnimationFrame(function t(n){if(lenis)lenis.raf(n);if(lenis)requestAnimationFrame(t)});
requestAnimationFrame(frame);

/* interações de ponteiro: botão magnético, tilt 3D com brilho, cursor com rótulo */
if(fine){
  $('[data-magnetic]').forEach(function(el){var s=parseFloat(el.getAttribute('data-magnetic'))||.35;
    el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect();el.style.transition='transform .15s ease-out';el.style.transform='translate3d('+((e.clientX-r.left-r.width/2)*s).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*s).toFixed(1)+'px,0)'});
    el.addEventListener('pointerleave',function(){el.style.transition='transform .7s var(--ease)';el.style.transform=''})});
  $('[data-tilt]').forEach(function(el){var m=parseFloat(el.getAttribute('data-tilt'))||8;if(getComputedStyle(el).position==='static')el.style.position='relative';
    el.addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;el.style.transform='perspective(900px) rotateX('+((.5-y)*m).toFixed(2)+'deg) rotateY('+((x-.5)*m).toFixed(2)+'deg) scale(1.02)';el.style.setProperty('--mx',(x*100)+'%');el.style.setProperty('--my',(y*100)+'%')});
    el.addEventListener('pointerleave',function(){el.style.transform=''})});
  if(d.querySelector('[data-cursor]')||root.hasAttribute('data-fx-cursor'))safe(function(){var dot=d.createElement('div'),ring=d.createElement('div');dot.className='fx-cursor';ring.className='fx-ring';d.body.appendChild(dot);d.body.appendChild(ring);
    var x=-100,y=-100,rx=-100,ry=-100;addEventListener('pointermove',function(e){x=e.clientX;y=e.clientY;root.classList.add('fx-cursor-on');dot.style.opacity=ring.style.opacity=ov?0:1});
    var ov=false;
    d.addEventListener('pointerover',function(e){var tx=e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]');ov=!!tx;dot.style.opacity=ring.style.opacity=ov?0:1;var t=e.target.closest&&e.target.closest('a,button,[data-cursor],[data-magnetic],[data-tilt]');if(!t){ring.classList.remove('big');ring.textContent='';return}ring.classList.add('big');ring.textContent=t.getAttribute('data-cursor')||''});
    d.documentElement.addEventListener('mouseleave',function(){dot.style.opacity=ring.style.opacity=0});
    (function f(){rx=lerp(rx,x,.16);ry=lerp(ry,y,.16);dot.style.transform='translate3d('+x+'px,'+y+'px,0)';ring.style.transform='translate3d('+rx.toFixed(1)+'px,'+ry.toFixed(1)+'px,0)';requestAnimationFrame(f)})()})
}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>`;

export const AURA_FX_GUIDE = `MOTOR DE MOVIMENTO "AURA FX" (caixa de ferramentas para criação livre e site em branco)
Cole o bloco abaixo INTEIRO e SEM alterações no final do <body> (um <style> e um <script>); depois marque o HTML com os atributos. Ele já cuida de scroll, transições entre seções, revelações, cursor, interações e tem rede de segurança (se algo falhar, o conteúdo continua visível). Não reescreva essa lógica: use os atributos. Pode acrescentar CSS/JS próprio por cima e, opcionalmente, GSAP/Three/React Bits.

ATRIBUTOS
- data-loader (div fixa de tela cheia, com <span data-loader-count>0</span> e a marca): loader de entrada; some sozinho e libera as animações. Opcional.
- data-split (em h1/h2/p): títulos revelados palavra por palavra com máscara. Aceita <em>/<span> dentro. Para atrasar, use style="--d:.2s".
- data-reveal (vazio, "left", "right", "scale" ou "clip"): entra ao aparecer na tela; style="--d:.15s" escalona.
- data-count="120" data-suffix="K+": número que conta até o valor.
- data-bg="#f3efe8" data-fg="#111" em <section>: a cor de fundo e de texto da página muda suavemente quando a seção chega ao centro da tela (use com body{background:var(--bg);color:var(--fg)} já incluso; seções sem fundo próprio herdam).
- data-curtain em <section>: a seção entra como uma cortina arredondada que se abre (clip-path) ao subir. data-scale-in: cresce e ganha opacidade ao entrar. data-fade-out: desvanece só DEPOIS de começar a sair da tela (--x = quanto já saiu; em seção que está no topo ele fica 100% visível). Nunca deixe o hero com opacidade menor que 1 ao carregar.
- data-scene (qualquer elemento): expõe --e (entrada 0..1), --p (passagem 0..1) e --x (saída 0..1) para você escrever CSS ligado ao scroll (ex.: transform:translateX(calc(var(--p)*-30vw)), scale, rotate, filter:blur(calc((1 - var(--e))*12px))).
- data-pin="3" na <section> com um filho <div class="pin-stage">: cena fixa que dura 3 telas; --p (0..1) em toda a seção para trocar conteúdo/progresso (use CSS com var(--p) ou leia style.getPropertyValue('--p')).
- data-hscroll na <section> com <div class="pin-stage"><div class="h-track">…itens com flex:0 0 Xvw…</div></div>: o scroll vertical vira horizontal.
- data-stack em um contêiner: filhos empilham como cartas (sticky) e encolhem ao serem cobertos.
- data-speed="0.15" (positivo ou negativo): parallax por elemento.
- PARALLAX EM CAMADAS (efeito de profundidade): <section data-parallax> (position:relative; height:100svh; overflow:hidden) com camadas absolutas empilhadas por z-index, cada uma com data-depth (0 = parada, .05 = fundo distante, .3 a .5 = primeiro plano): ao mover o mouse as camadas se deslocam em sentidos opostos proporcionalmente à profundidade e, ao rolar, descem em velocidades diferentes. data-zoom=".0004" faz a camada crescer com o scroll; data-drift=".15" desloca a camada na horizontal com o scroll. <section data-parallax="50"> aumenta a amplitude do mouse. Nunca use transform próprio nem centralização com translate nas camadas com data-depth (o motor controla o transform): centralize com left/top/inset e margin, ou use um wrapper. Dimensione as camadas com inset:-6% (ou width/height 112%) para as bordas não aparecerem ao mover.
- data-marquee ("left" ou "right"): faixa infinita de texto/logos que acelera e inclina com a velocidade do scroll; coloque 1 ou 2 itens dentro.
- data-magnetic (ou ="0.4"): botão que é atraído pelo ponteiro. data-tilt (ou ="10"): card com inclinação 3D e brilho que segue o mouse (precisa de border-radius para o brilho).
- data-cursor="Ver" em links/cards: o cursor customizado vira um anel grande com esse rótulo. O cursor customizado é criado pelo motor e ESCONDE o cursor nativo automaticamente.
- data-nav no <header>/<nav> fixo: esconde ao descer, volta ao subir, ganha .scrolled. data-progress: barra de progresso de leitura (um <div> vazio).
- Scroll suave: adicione antes do motor <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js"></script>; o motor usa o Lenis se carregar.

RECEITA: TÍTULO ATRÁS DO SUJEITO (parallax de profundidade, como nos sites de arquitetura e moda)
Quatro camadas na mesma <section data-parallax>, todas com a mesma caixa para o recorte alinhar exatamente com o fundo:
1. Fundo: <img class="layer" data-depth=".04" data-photo="consulta precisa do cenário com o sujeito" data-photo-id="hero" width="1600" height="1000" alt="...">
2. Título gigante: <h1 class="giant" data-depth=".12" data-split>NOME</h1> (z-index:1, centralizado, font-size até 24vw, line-height .8, cor de contraste com o fundo)
3. Sujeito recortado POR CIMA do título: <img class="layer subject" data-depth=".24" data-photo-id="hero" data-cutout width="1600" height="1000" alt="" aria-hidden="true"> (z-index:2). Use o mesmo data-photo-id do fundo para o app buscar UMA foto e usá-la nas duas camadas; o app remove o fundo só da camada com data-cutout.
4. Opcional, primeiro plano: elementos soltos (folhas, rochas, grama, nuvens, estrelas) com data-depth maior (.4 a .6), e a interface (nav, textos, cartões) com z-index:4 e SEM data-depth.
CSS base: .stage{position:relative;height:100svh;overflow:hidden}.layer{position:absolute;inset:-6%;width:112%;height:112%;max-width:none;object-fit:cover}.giant{position:absolute;left:0;right:0;top:14%;margin:0;text-align:center;z-index:1}.subject{z-index:2}.layer[data-cutout-failed]{display:none} (se o recorte automático falhar, a camada do sujeito some e o título fica à frente do fundo, sem quebrar). Escureça levemente o fundo (filter: brightness(.7)) para o título claro ter contraste; o sujeito não leva filtro que o apague.
Escolha uma foto em que o sujeito seja um objeto/construção/pessoa nítido e centralizado, com céu ou fundo limpo atrás (consulta com "isolated", "centered", "clear sky" ajuda). Variações: título que cresce com data-zoom ao rolar; título que desliza na horizontal com data-drift; camadas de névoa semitransparentes entre o fundo e o sujeito; legenda em vidro (backdrop-filter) ligada ao sujeito por uma linha e pontos.

REGRAS DE USO
1. O motor é uma caixa de ferramentas inerte: só entra em ação o que você marca com atributos. NÃO é um checklist: use apenas o que o PLANO DE MOVIMENTO E COMPOSIÇÃO sorteado (seção anterior) pede, mais o que o conceito do negócio justificar. Não ligue tudo, não repita o kit de sempre.
2. Cursor customizado do motor: só aparece se existir algum [data-cursor] ou <html data-fx-cursor>; sem isso o cursor nativo permanece. Loader: só se você criar o [data-loader]. Nav, barra de progresso, marquee, magnético, tilt, parallax: só onde você marcar.
3. Nunca duas seções seguidas com a mesma entrada. Cada seção principal usa um layout e uma entrada diferentes.
4. Cursor customizado próprio (se o plano pedir outro): esconda SEMPRE o cursor nativo (cursor:none em html, body, a, button e demais, só com @media (hover:hover) and (pointer:fine), aplicado por uma classe que o JS coloca ao detectar o primeiro movimento do mouse, e mantendo cursor:text em input/textarea). Nunca deixe dois cursores visíveis.
5. Combine com a direção de arte: troque cores, easing e tempos pelo CSS do site, sem remover a lógica.

BLOCO DO MOTOR (cole exatamente):
` + AURA_FX_ENGINE;
