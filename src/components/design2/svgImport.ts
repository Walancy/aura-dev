import type { Shape } from './types';

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  text: string;
}

/** Parser XML mínimo e tolerante para SVG (tags, atributos, texto); ignora comentários, <defs>, <style> e <?xml?>. */
export function parseSvgXml(src: string): Node | null {
  const clean = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const root: Node = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: Node[] = [root];
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.text += m[5];
      continue;
    }
    const [, closing, tag, attrSrc, selfClose] = m;
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of attrSrc.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3] ?? '';
    const node: Node = { tag: tag.toLowerCase(), attrs, children: [], text: '' };
    top.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children.find((c) => c.tag === 'svg') ?? null;
}

const num = (v: string | undefined, def = 0) => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : def;
};

/** Caixa de um caminho: percorre os comandos (M L H V C S Q T A Z, absolutos e relativos); curvas por pontos de controle e extremos. */
export function pathBBox(d: string): { x: number; y: number; w: number; h: number } | null {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return null;
  let i = 0;
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => { xs.push(x); ys.push(y); };
  const read = () => parseFloat(tokens[i++]);
  let cmd = '';
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === 'Z') { cx = sx; cy = sy; continue; }
    if (up === 'M' || up === 'L' || up === 'T') {
      const x = read(), y = read();
      cx = rel ? cx + x : x; cy = rel ? cy + y : y;
      if (up === 'M') { sx = cx; sy = cy; cmd = rel ? 'l' : 'L'; }
      add(cx, cy);
    } else if (up === 'H') { const x = read(); cx = rel ? cx + x : x; add(cx, cy); }
    else if (up === 'V') { const y = read(); cy = rel ? cy + y : y; add(cx, cy); }
    else if (up === 'C') {
      const p = [read(), read(), read(), read(), read(), read()];
      for (let k = 0; k < 6; k += 2) add(rel ? cx + p[k] : p[k], rel ? cy + p[k + 1] : p[k + 1]);
      cx = rel ? cx + p[4] : p[4]; cy = rel ? cy + p[5] : p[5];
    } else if (up === 'S' || up === 'Q') {
      const p = [read(), read(), read(), read()];
      for (let k = 0; k < 4; k += 2) add(rel ? cx + p[k] : p[k], rel ? cy + p[k + 1] : p[k + 1]);
      cx = rel ? cx + p[2] : p[2]; cy = rel ? cy + p[3] : p[3];
    } else if (up === 'A') {
      const rx = read(); const ry = read(); read(); read(); read();
      const x = read(), y = read();
      const nx = rel ? cx + x : x, ny = rel ? cy + y : y;
      // aproximação: o arco cabe numa caixa que inclui os extremos e o raio ao redor do ponto médio
      add((cx + nx) / 2 - Math.abs(rx) / 2, (cy + ny) / 2 - Math.abs(ry) / 2);
      add((cx + nx) / 2 + Math.abs(rx) / 2, (cy + ny) / 2 + Math.abs(ry) / 2);
      cx = nx; cy = ny; add(cx, cy);
    } else i++;
  }
  if (!xs.length) return null;
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Desloca todos os números absolutos de um caminho (usado para levar a origem do desenho para 0,0). */
function translatePath(d: string, dx: number, dy: number): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  const f = (n: number) => String(Math.round(n * 100) / 100);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) { cmd = tokens[i]; out.push(tokens[i++]); continue; }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    // quantidade de números por comando
    const arity = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 }[up] ?? 2;
    const vals = tokens.slice(i, i + arity).map(Number);
    i += arity;
    const shifted = vals.map((v, k) => {
      if (rel) return v;
      if (up === 'H') return v + dx;
      if (up === 'V') return v + dy;
      if (up === 'A') return k === 5 ? v + dx : k === 6 ? v + dy : v;
      return k % 2 === 0 ? v + dx : v + dy;
    });
    out.push(shifted.map(f).join(' '));
    if (up === 'M') cmd = rel ? 'l' : 'L';
  }
  return out.join(' ');
}

const paint = (v: string | undefined, def: string): string => (!v || v === 'none' ? (v === 'none' ? 'none' : def) : v === 'currentColor' ? '#000000' : v.startsWith('url(') ? '#808080' : v);

interface Inherit { fill?: string; stroke?: string; strokeWidth?: number; opacity: number; tx: number; ty: number }

/**
 * Importa um SVG como shapes: um frame com os elementos (retângulo, círculo, elipse, linha, polígono, caminho, texto).
 * `<g>` é achatado, herdando preenchimento/traço/opacidade e `translate`. Gradientes viram cinza e `transform`
 * diferente de translate é ignorado (limites do importador).
 */
export function importSvg(src: string, name: string, at: { x: number; y: number }, idGen: () => string, pageId?: string): Shape[] | null {
  const svg = parseSvgXml(src);
  if (!svg) return null;
  const vb = (svg.attrs.viewBox || '').split(/[\s,]+/).map(Number);
  const vbx = vb.length === 4 ? vb[0] : 0;
  const vby = vb.length === 4 ? vb[1] : 0;
  const width = vb.length === 4 ? vb[2] : num(svg.attrs.width, 100);
  const height = vb.length === 4 ? vb[3] : num(svg.attrs.height, 100);
  const frameId = idGen();
  const out: Shape[] = [];
  let z = 1;
  const base = (type: Shape['type'], label: string, x: number, y: number, w: number, h: number, inh: Inherit, extra: Partial<Shape> = {}): Shape => ({
    id: idGen(), name: label, type, parentId: frameId, pageId, x: at.x + x + inh.tx - vbx, y: at.y + y + inh.ty - vby, width: w, height: h, rotation: 0,
    fill: inh.fill ?? '#000000', stroke: inh.stroke ?? 'none', strokeWidth: inh.stroke && inh.stroke !== 'none' ? inh.strokeWidth ?? 1 : 0, opacity: inh.opacity, zIndex: ++z, visible: true,
    ...extra,
  } as Shape);
  const walk = (node: Node, inh: Inherit) => {
    for (const el of node.children) {
      if (['defs', 'style', 'title', 'desc', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'symbol', 'metadata'].includes(el.tag)) continue;
      const a = el.attrs;
      const t = /translate\(\s*(-?[\d.]+)[\s,]*(-?[\d.]+)?\s*\)/.exec(a.transform || '');
      const next: Inherit = {
        fill: a.fill !== undefined ? paint(a.fill, '#000000') : inh.fill,
        stroke: a.stroke !== undefined ? paint(a.stroke, 'none') : inh.stroke,
        strokeWidth: a['stroke-width'] !== undefined ? num(a['stroke-width'], 1) : inh.strokeWidth,
        opacity: inh.opacity * (a.opacity !== undefined ? num(a.opacity, 1) : 1),
        tx: inh.tx + (t ? num(t[1]) : 0),
        ty: inh.ty + (t ? num(t[2]) : 0),
      };
      if (el.tag === 'g' || el.tag === 'a') walk(el, next);
      else if (el.tag === 'rect') out.push(base('rect', 'Retângulo', num(a.x), num(a.y), num(a.width), num(a.height), next, { cornerRadius: num(a.rx ?? a.ry) }));
      else if (el.tag === 'circle') { const r = num(a.r); out.push(base('ellipse', 'Círculo', num(a.cx) - r, num(a.cy) - r, r * 2, r * 2, next)); }
      else if (el.tag === 'ellipse') { const rx = num(a.rx), ry = num(a.ry); out.push(base('ellipse', 'Elipse', num(a.cx) - rx, num(a.cy) - ry, rx * 2, ry * 2, next)); }
      else if (el.tag === 'line') out.push(base('line', 'Linha', Math.min(num(a.x1), num(a.x2)), Math.min(num(a.y1), num(a.y2)), num(a.x2) - num(a.x1), num(a.y2) - num(a.y1), { ...next, stroke: next.stroke && next.stroke !== 'none' ? next.stroke : '#000000', strokeWidth: next.strokeWidth ?? 1 }));
      else if (el.tag === 'polygon' || el.tag === 'polyline' || el.tag === 'path') {
        const d = el.tag === 'path' ? a.d || '' : `M ${(a.points || '').trim().split(/[\s,]+/).reduce<string[]>((acc, v, k, all) => (k % 2 === 0 ? [...acc, `${v} ${all[k + 1] ?? 0}`] : acc), []).join(' L ')}${el.tag === 'polygon' ? ' Z' : ''}`;
        const box = pathBBox(d);
        if (box && box.w + box.h > 0) {
          const w = Math.max(1, box.w), h = Math.max(1, box.h);
          out.push(base('path', el.tag === 'path' ? 'Caminho' : 'Polígono', box.x, box.y, w, h, next, { pathD: translatePath(d, -box.x, -box.y), pathW: w, pathH: h }));
        }
      } else if (el.tag === 'text') {
        const text = (el.text + el.children.map((c) => c.text).join('')).replace(/\s+/g, ' ').trim();
        if (text) {
          const size = num(a['font-size'], 16);
          out.push(base('text', text.slice(0, 24), num(a.x), num(a.y) - size, Math.max(10, text.length * size * 0.55), size * 1.25, next, { text, fontSize: size, fontFamily: (a['font-family'] || '').split(',')[0].replace(/['"]/g, '').trim() || undefined, fontWeight: num(a['font-weight'], 400), textAlign: a['text-anchor'] === 'middle' ? 'center' : a['text-anchor'] === 'end' ? 'right' : 'left' }));
        }
      }
    }
  };
  walk(svg, { opacity: 1, tx: 0, ty: 0 });
  const frame: Shape = { id: frameId, name, type: 'frame', pageId, x: at.x, y: at.y, width, height, rotation: 0, fill: 'transparent', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, clipContent: true } as Shape;
  return [frame, ...out];
}
