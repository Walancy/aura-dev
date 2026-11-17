// Inspetor do preview: um script injetado no HTML do site (iframe com srcdoc, mesma origem do app) que destaca
// seções/elementos sob o mouse e devolve ao app o que o usuário clicou, para o pedido ao chat levar esse contexto.
export interface SiteSelection {
  /** seletor CSS único do elemento */
  path: string;
  /** "section#hero", "button.cta"... */
  label: string;
  tag: string;
  text: string;
  html: string;
}

export interface InspectorState {
  enabled: boolean;
  mode: 'section' | 'element';
  accent: string;
  selected: string[];
}

const SECTION_SELECTOR = 'section, header, footer, nav, main, article, aside, form, [data-section]';

const INSPECTOR_SCRIPT = `
(function () {
  if (window.__auraInspector) return;
  var st = { enabled: false, mode: 'section', accent: '#7c6cff', selected: [] };
  var SEC = ${JSON.stringify(SECTION_SELECTOR)};
  var style = document.createElement('style');
  style.id = 'aura-inspector-style';
  document.head.appendChild(style);
  var hover = document.createElement('div');
  hover.id = 'aura-hover';
  hover.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;display:none;border-radius:4px;transition:all 80ms ease;';
  var tag = document.createElement('div');
  tag.style.cssText = 'position:absolute;left:0;top:-22px;height:20px;padding:0 7px;border-radius:4px;font:11px/20px Inter,system-ui,sans-serif;color:#fff;white-space:nowrap;';
  hover.appendChild(tag);
  document.body.appendChild(hover);
  var hoverEl = null;

  function css() {
    style.textContent = '.aura-selected{outline:2px solid ' + st.accent + ' !important;outline-offset:-2px !important;}' +
      (st.enabled ? 'html,body,html *,html.fx-cursor-on,html.fx-cursor-on *{cursor:crosshair !important;} .fx-cursor,.fx-ring{display:none !important;}' : '');
    hover.style.boxShadow = 'inset 0 0 0 2px ' + st.accent;
    hover.style.background = st.accent + '14';
    tag.style.background = st.accent;
  }
  function pathOf(el) {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && parts.length < 8) {
      var t = cur.tagName.toLowerCase();
      if (cur.id && document.querySelectorAll('#' + CSS.escape(cur.id)).length === 1) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      var sib = cur.parentElement ? Array.prototype.filter.call(cur.parentElement.children, function (c) { return c.tagName === cur.tagName; }) : [];
      parts.unshift(sib.length > 1 ? t + ':nth-of-type(' + (sib.indexOf(cur) + 1) + ')' : t);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function labelOf(el) {
    var t = el.tagName.toLowerCase();
    if (el.id) return t + '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(function (c) { return c && c !== 'aura-selected'; })[0];
    if (cls) return t + '.' + cls;
    var txt = (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 24);
    return txt ? t + ' "' + txt + '"' : t;
  }
  function target(raw) {
    if (!raw || raw === document.documentElement || raw === document.body || hover.contains(raw)) return null;
    if (st.mode === 'section') {
      var s = raw.closest(SEC);
      return s && s !== document.body ? s : null;
    }
    return raw;
  }
  function place(el) {
    if (!el) { hover.style.display = 'none'; hoverEl = null; return; }
    hoverEl = el;
    var r = el.getBoundingClientRect();
    hover.style.display = 'block';
    hover.style.left = r.left + 'px'; hover.style.top = r.top + 'px';
    hover.style.width = r.width + 'px'; hover.style.height = r.height + 'px';
    tag.textContent = labelOf(el);
    tag.style.top = r.top < 24 ? '2px' : '-22px';
  }
  function applySelected() {
    document.querySelectorAll('.aura-selected').forEach(function (n) { n.classList.remove('aura-selected'); });
    st.selected.forEach(function (p) { try { var n = document.querySelector(p); if (n) n.classList.add('aura-selected'); } catch (e) {} });
  }
  function item(el) {
    var clone = el.cloneNode(true);
    clone.classList.remove('aura-selected');
    if (!clone.getAttribute('class')) clone.removeAttribute('class');
    var html = clone.outerHTML;
    return { path: pathOf(el), label: labelOf(el), tag: el.tagName.toLowerCase(), text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 300), html: html.length > 3000 ? html.slice(0, 3000) + '\\n<!-- ... -->' : html };
  }
  function send() {
    var items = [];
    st.selected.forEach(function (p) { try { var n = document.querySelector(p); if (n) items.push(item(n)); } catch (e) {} });
    window.parent.postMessage({ type: 'aura-select', items: items }, '*');
  }
  // Navegação presa ao preview: sem isso, um link "#", "/" ou externo carrega o app (ou outra página) dentro do iframe.
  document.addEventListener('click', function (e) {
    if (st.enabled || e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.hasAttribute('download')) return;
    e.preventDefault();
    if (href.charAt(0) === '#') {
      var id = decodeURIComponent(href.slice(1));
      var t = id ? document.getElementById(id) : null;
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (!id) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, false);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  window.open = function () { return null; };
  document.addEventListener('mousemove', function (e) { if (!st.enabled) return; place(target(e.target)); }, true);
  document.addEventListener('mouseleave', function () { place(null); }, true);
  window.addEventListener('scroll', function () { if (hoverEl) place(hoverEl); }, true);
  window.addEventListener('resize', function () { if (hoverEl) place(hoverEl); });
  document.addEventListener('click', function (e) {
    if (!st.enabled) return;
    e.preventDefault(); e.stopPropagation();
    var el = target(e.target);
    if (!el) return;
    var p = pathOf(el);
    var i = st.selected.indexOf(p);
    if (e.shiftKey || e.metaKey) { if (i >= 0) st.selected.splice(i, 1); else st.selected.push(p); }
    else st.selected = i >= 0 && st.selected.length === 1 ? [] : [p];
    applySelected(); send();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.selected.length) { st.selected = []; applySelected(); send(); } });
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type !== 'aura-set') return;
    st.enabled = !!d.enabled; st.mode = d.mode === 'element' ? 'element' : 'section'; st.accent = d.accent || st.accent;
    if (Array.isArray(d.selected)) st.selected = d.selected.slice();
    css(); applySelected(); if (!st.enabled) place(null);
  });
  css();
  window.__auraInspector = true;
  window.parent.postMessage({ type: 'aura-ready' }, '*');
})();
`;

// Scrollbar fina e escura (dark mode) do preview; entra antes do CSS do site, então o que o site definir por conta própria prevalece.
const PREVIEW_SCROLLBAR = '<style id="aura-scrollbar">::-webkit-scrollbar{width:5px;height:5px;background:#121212}::-webkit-scrollbar-track{background:#121212}::-webkit-scrollbar-thumb{background:#4a4a4a;border-radius:9px}::-webkit-scrollbar-thumb:hover{background:#6b6b6b}::-webkit-scrollbar-corner{background:#121212}</style>';

/** HTML do site pronto para o iframe: <base> para os caminhos relativos e o inspetor no fim do body. */
export function wrapForPreview(html: string, baseHref?: string): string {
  let out = html;
  const base = (baseHref ? `<base href="${baseHref}">` : '') + PREVIEW_SCROLLBAR;
  const script = `<script>${INSPECTOR_SCRIPT}</script>`;
  if (base) {
    out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${out}`;
  }
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${script}</body>`) : `${out}${script}`;
  return out;
}

export function postInspectorState(frame: HTMLIFrameElement | null, state: InspectorState): void {
  frame?.contentWindow?.postMessage({ type: 'aura-set', ...state }, '*');
}
