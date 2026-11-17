// Cenas 3D (Three.js) prontas para a IA de sites: o código foi testado, a IA só marca o canvas com data-attributes e escolhe cores,
// em vez de escrever (e errar) shaders e loops de render a cada criação. Tudo é original: formas procedurais e shaders próprios, sem modelos nem código de terceiros.
export const AURA_3D_ENGINE = String.raw`<script type="module" id="aura-3d-js">
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// cores em hex entram como estão (sem conversão linear), para o shader mostrar exatamente a paleta do site
THREE.ColorManagement.enabled = false;
const NOISE = 'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}vec4 perm(vec4 x){return mod289(((x*34.)+1.)*x);}float noise(vec3 p){vec3 a=floor(p);vec3 d=p-a;d=d*d*(3.-2.*d);vec4 b=a.xxyy+vec4(0.,1.,0.,1.);vec4 k1=perm(b.xyxy);vec4 k2=perm(k1.xyxy+b.zzww);vec4 c=k2+a.zzzz;vec4 k3=perm(c);vec4 k4=perm(c+1.);vec4 o1=fract(k3*(1./41.));vec4 o2=fract(k4*(1./41.));vec4 o3=o2*d.z+o1*(1.-d.z);vec2 o4=o3.yw*d.x+o3.xz*(1.-d.x);return o4.y*d.y+o4.x*(1.-d.y);}';
const lerp = (a, b, t) => a + (b - a) * t;
const hasGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

const PRESETS = {
  // esfera orgânica que respira (deformação por ruído + brilho de borda)
  blob(ctx) {
    const { THREE, scene, colors } = ctx;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(colors[0]) }, uB: { value: new THREE.Color(colors[1]) }, uPx: { value: 0 }, uPy: { value: 0 }, uAmp: { value: 0.32 } },
      vertexShader: NOISE + 'uniform float uTime,uAmp,uPx,uPy;varying vec3 vN;varying float vD;void main(){float n=noise(position*1.6+vec3(uTime*.35,uTime*.2,uPx*.8));float m=noise(position*3.2-uTime*.25+uPy);float d=n*uAmp+m*uAmp*.35;vD=d;vN=normalize(normalMatrix*normal);vec3 p=position+normal*d;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'uniform vec3 uA,uB;varying vec3 vN;varying float vD;void main(){float f=pow(1.-abs(vN.z),2.2);vec3 c=mix(uA,uB,smoothstep(-.1,.45,vD)+f*.4);c+=f*.35;gl_FragColor=vec4(c,1.);}',
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 48), mat);
    scene.add(mesh);
    return (t, s) => { mat.uniforms.uTime.value = t; mat.uniforms.uPx.value = s.px; mat.uniforms.uPy.value = s.py; mesh.rotation.y = t * 0.12 + s.px * 0.5; mesh.rotation.x = s.py * 0.3 + s.scroll * 1.5; mesh.scale.setScalar(1 - s.scroll * 0.35); };
  },

  // campo de partículas que reage ao mouse e gira com o scroll
  particles(ctx) {
    const { THREE, scene, colors, count } = ctx;
    const n = count || 6000;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 1.2 + Math.pow(Math.random(), 0.6) * 2.4, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7; pos[i * 3 + 2] = r * Math.cos(ph); seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(colors[0]) }, uB: { value: new THREE.Color(colors[1]) }, uSize: { value: 15 * Math.min(window.devicePixelRatio || 1, 2) }, uPx: { value: 0 }, uPy: { value: 0 } },
      vertexShader: 'attribute float aSeed;uniform float uTime,uSize,uPx,uPy;varying float vS;void main(){vS=aSeed;vec3 p=position;p.x+=sin(uTime*.4+aSeed*20.)*.06;p.y+=cos(uTime*.35+aSeed*30.)*.06;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uSize*(.35+aSeed)*(1./-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 uA,uB;varying float vS;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=smoothstep(.5,0.,d);gl_FragColor=vec4(mix(uA,uB,vS),a*.85);}',
    });
    const pts = new THREE.Points(g, mat);
    scene.add(pts);
    return (t, s) => { mat.uniforms.uTime.value = t; pts.rotation.y = t * 0.05 + s.px * 0.4 + s.scroll * 2.2; pts.rotation.x = s.py * 0.25 + s.scroll * 0.6; pts.position.z = -s.scroll * 1.2; };
  },

  // superfície ondulada em shader com gradiente e ondulação sob o mouse
  waves(ctx) {
    const { THREE, scene, colors, camera } = ctx;
    camera.position.set(0, 1.5, 4.6); camera.lookAt(0, -0.2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(colors[0]) }, uB: { value: new THREE.Color(colors[1]) }, uPx: { value: 0 }, uScroll: { value: 0 } },
      vertexShader: NOISE + 'uniform float uTime,uPx,uScroll;varying float vH;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;float h=noise(vec3(p.x*.7+uTime*.15,p.y*.7,uTime*.1))*.42+noise(vec3(p.x*2.4,p.y*2.4-uTime*.2,1.))*.1;h+=sin(p.x*2.+uTime*.6+uPx*3.)*.06;vH=h;p.z+=h*(1.+uScroll);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'uniform vec3 uA,uB;varying float vH;varying vec2 vUv;void main(){vec3 c=mix(uA,uB,smoothstep(-.2,.7,vH));c*=.75+vH*.5;float ln=smoothstep(.42,.5,abs(fract(vH*9.)-.5));c=mix(c,vec3(1.),(1.-ln)*.08);float e=smoothstep(0.,.25,vUv.y)*smoothstep(1.,.75,vUv.y);gl_FragColor=vec4(c,e);}',
      transparent: true, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 4, 220, 120), mat);
    mesh.rotation.x = -1.05;
    scene.add(mesh);
    return (t, s) => { mat.uniforms.uTime.value = t; mat.uniforms.uPx.value = s.px; mat.uniforms.uScroll.value = s.scroll * 1.5; mesh.rotation.z = s.px * 0.08; mesh.position.y = -s.scroll * 0.8; };
  },

  // formas geométricas flutuando com luz, em parallax com mouse e scroll
  shapes(ctx) {
    const { THREE, scene, colors, count, camera } = ctx;
    camera.position.set(0, 0, 6.2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(new THREE.Color(colors[1]), 40, 12); rim.position.set(-3, -2, 2); scene.add(rim);
    const geos = [new THREE.IcosahedronGeometry(0.5, 0), new THREE.TorusGeometry(0.42, 0.16, 24, 64), new THREE.OctahedronGeometry(0.52, 0), new THREE.TorusKnotGeometry(0.34, 0.12, 120, 16), new THREE.SphereGeometry(0.4, 48, 32)];
    const items = [];
    const n = count || 14;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geos[i % geos.length], new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[i % 2]), roughness: 0.28, metalness: 0.55 }));
      m.position.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 3 - 0.5);
      m.scale.setScalar(0.6 + Math.random() * 1.1);
      m.userData = { s: Math.random() * 6, d: 0.4 + Math.random() * 0.8, y: m.position.y };
      scene.add(m); items.push(m);
    }
    return (t, s) => { items.forEach((m, i) => { m.rotation.x = t * 0.25 * m.userData.d + m.userData.s; m.rotation.y = t * 0.3 * m.userData.d; m.position.y = m.userData.y + Math.sin(t * 0.6 * m.userData.d + m.userData.s) * 0.18 + s.scroll * (i % 3 - 1) * 1.6; }); scene.rotation.y = s.px * 0.18; scene.rotation.x = -s.py * 0.1; };
  },

  // grade em wireframe com relevo em movimento (terreno retrô/técnico)
  terrain(ctx) {
    const { THREE, scene, colors, camera } = ctx;
    camera.position.set(0, 1.4, 3.2); camera.lookAt(0, 0, -1);
    const mat = new THREE.ShaderMaterial({
      wireframe: true, transparent: true,
      uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(colors[0]) }, uB: { value: new THREE.Color(colors[1]) }, uScroll: { value: 0 } },
      vertexShader: NOISE + 'uniform float uTime,uScroll;varying float vH;varying float vZ;void main(){vec3 p=position;float h=noise(vec3(p.x*.7,p.y*.7+uTime*.35+uScroll*2.,0.))*1.1;h*=smoothstep(0.,1.6,abs(p.x));vH=h;vZ=p.y;p.z+=h;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
      fragmentShader: 'uniform vec3 uA,uB;varying float vH;varying float vZ;void main(){float fade=smoothstep(-5.,1.,vZ);gl_FragColor=vec4(mix(uA,uB,clamp(vH,0.,1.)),fade*.9);}',
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10, 70, 70), mat);
    mesh.rotation.x = -Math.PI / 2.2; mesh.position.z = -2;
    scene.add(mesh);
    return (t, s) => { mat.uniforms.uTime.value = t; mat.uniforms.uScroll.value = s.scroll; camera.position.x = s.px * 0.4; camera.position.y = 1.4 + s.py * 0.2; camera.lookAt(0, 0, -1); };
  },
};

/** Cria uma cena dentro de um <canvas>. Devolve { destroy } e nunca lança: sem WebGL a página continua com o fundo CSS. */
export function auraScene(canvas, opts) {
  opts = opts || {};
  const preset = PRESETS[opts.preset] ? opts.preset : 'blob';
  const colors = (opts.colors && opts.colors.length > 1 ? opts.colors : [(opts.colors && opts.colors[0]) || '#7c6cff', '#ff6a3d']);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!hasGL()) { canvas.classList.add('no-webgl'); return { destroy() {} }; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { canvas.classList.add('no-webgl'); return { destroy() {} }; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);
  const tick = PRESETS[preset]({ THREE, scene, camera, colors, count: opts.count });
  const st = { px: 0, py: 0, tx: 0, ty: 0, scroll: 0 };
  const scope = opts.scope ? document.querySelector(opts.scope) : null;
  let visible = true, raf = 0, t0 = performance.now(), alive = true;
  const resize = () => {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 }); io.observe(canvas);
  const onMove = (e) => { st.tx = (e.clientX / innerWidth) * 2 - 1; st.ty = -((e.clientY / innerHeight) * 2 - 1); };
  addEventListener('pointermove', onMove, { passive: true });
  const progress = () => {
    if (scope) { const r = scope.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight * 0.5))); }
    const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };
  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    st.px = lerp(st.px, st.tx, 0.05); st.py = lerp(st.py, st.ty, 0.05); st.scroll = lerp(st.scroll, progress(), 0.08);
    tick(reduce ? 0 : (now - t0) / 1000, st);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  canvas.dataset.auraReady = '1';
  return { destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onMove); renderer.dispose(); } };
}

// uso declarativo: <canvas data-aura-3d="blob" data-colors="#7c6cff,#ff6a3d" data-scope="#hero"></canvas>
const boot = () => document.querySelectorAll('canvas[data-aura-3d]').forEach((c) => {
  if (c.dataset.auraReady) return;
  auraScene(c, { preset: c.getAttribute('data-aura-3d'), colors: (c.dataset.colors || '').split(',').map((x) => x.trim()).filter(Boolean), scope: c.dataset.scope, count: c.dataset.count ? +c.dataset.count : 0 });
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.auraScene = auraScene;
</script>`;

export const AURA_3D_GUIDE = `CENAS 3D "AURA 3D" (Three.js testado; use quando o pedido falar de 3D, WebGL, Three.js, partículas, shader ou "experiência imersiva", ou quando a referência for um site 3D)
Cole o bloco abaixo INTEIRO e SEM alterações no final do <body> (é um <script type="module"> que carrega o Three.js 0.160 da CDN). Depois declare as cenas no HTML:
  <canvas data-aura-3d="blob" data-colors="#7c6cff,#ff6a3d" data-scope="#hero" aria-hidden="true"></canvas>
- Presets: "blob" (esfera orgânica com ruído e brilho de borda), "particles" (campo de partículas aditivas, data-count="6000"), "waves" (superfície ondulada em shader), "shapes" (formas geométricas metálicas flutuando, data-count="14"), "terrain" (relevo em wireframe). Escolha pelo conceito do negócio, não pelo gosto: blob para marcas orgânicas/tecnologia, particles para dados/espaço/música, waves para água/fluxo/finanças, shapes para produtos/estúdios criativos, terrain para tecnologia/jogos.
- data-colors: 2 cores da paleta do site (hex). data-scope="#id": o progresso do scroll é medido nessa seção (sem ele, usa a página inteira).
- A cena reage ao mouse (parallax suave) e ao scroll (rotação, profundidade, deslocamento) e pausa quando sai da tela. Sem WebGL, o canvas ganha a classe .no-webgl: deixe um fundo CSS (gradiente) no wrapper para ficar bonito mesmo assim.
- Layout: o canvas fica em position:absolute; inset:0; width:100%; height:100% dentro de um wrapper relativo (hero ou seção), com z-index:0 e o texto acima (position:relative; z-index:1). Canvas transparente: funciona sobre qualquer fundo.
- API: window.auraScene(canvasEl, {preset, colors, count, scope}) devolve {destroy()}. Use no máximo 2 cenas por página (peso) e nunca no mesmo viewport.
- Texto sobre 3D: garanta contraste (títulos grandes, mix-blend-mode:difference só se ficar legível). O 3D é a assinatura do hero, não decoração aleatória: combine com o motor AURA FX (data-split, data-reveal).
- NÃO escreva Three.js do zero nem copie shaders/código/modelos de outros sites: use estes presets ou, se o conceito exigir algo diferente, escreva um shader original curto seguindo o padrão dos presets. Modelos 3D (.glb) só se o usuário fornecer o arquivo.
- Inspiração (se tiver acesso à web): mesh3d.gallery lista experiências Three.js premiadas; use para entender técnicas e composição, nunca para copiar.

${AURA_3D_ENGINE}`;
