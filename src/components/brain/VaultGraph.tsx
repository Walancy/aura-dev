import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, RotateCcw, Settings2, X } from 'lucide-react';
import type { GraphNode, VaultGraph as Graph } from './vault';
import { MiniSwitch } from '../ui/MiniSwitch';
import { DevFlowColorPicker } from '../ui/DevFlowColorPicker';
import { PopupPortal } from '../ui/PopupPortal';
import { hexToRgba, getContrastTextColor } from '../../utils/color';
import { AI_BRAND_COLORS } from '../../constants/ai';
import claudeLogo from '../../assets/logos/claude-color.svg';
import antigravityLogo from '../../assets/logos/google-antigravity-icon.svg';
import codexLogo from '../../assets/logos/codex-color.svg';
import geminiLogo from '../../assets/logos/gemini-icon-seeklogo.svg';
import ollamaLogo from '../../assets/logos/ollama-icon.svg';

// notas sobre uma IA (pelo nome ou tag) são desenhadas com o logo dela em vez de uma bolinha
const AI_LOGOS: Array<[RegExp, string, string]> = [
  [/\bclaude\b/i, claudeLogo, 'claude'],
  [/\b(antigravity|agy)\b/i, antigravityLogo, 'antigravity'],
  [/\bcodex\b/i, codexLogo, 'codex'],
  [/\bgemini\b/i, geminiLogo, 'gemini'],
  [/\bollama\b/i, ollamaLogo, 'ollama'],
];
const logoCache = new Map<string, HTMLImageElement>();
const logoImage = (src: string) => {
  let img = logoCache.get(src);
  if (!img) { img = new Image(); img.src = src; logoCache.set(src, img); }
  return img;
};
// o logo é desenhado de uma cor só (preto ou branco, conforme o contraste com a cor da IA): pinta o desenho sobre um canvas à parte
const tintCache = new Map<string, HTMLCanvasElement>();
const tintedLogo = (src: string, color: string, size: number) => {
  const img = logoImage(src);
  if (!img.complete || !img.naturalWidth) return null;
  const px = Math.max(8, Math.round(size));
  const key = `${src}|${color}|${px}`;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = px; c.height = px;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, px, px);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, px, px);
    tintCache.set(key, c);
  }
  return c;
};
const logoSrcFor = (n: GraphNode): { src: string; brand: string; id: string } | null => {
  if (n.kind !== 'note') return null;
  const hay = `${n.label} ${n.tags.join(' ')}`;
  for (const [re, src, id] of AI_LOGOS) if (re.test(hay)) return { src, brand: AI_BRAND_COLORS[id], id };
  return null;
};

// cores vivas (sem tons pastel) para agrupar nós por tag ou pasta
const NODE_PALETTE = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#14b8a6', '#ef4444', '#6366f1', '#84cc16'];
const hashColor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return NODE_PALETTE[h % NODE_PALETTE.length];
};

export interface GraphGroup { query: string; color: string }

export interface GraphSettings {
  search: string;
  showTags: boolean;
  showAttachments: boolean;
  existingOnly: boolean;
  showOrphans: boolean;
  groups: GraphGroup[];
  arrows: boolean;
  textFade: number;
  nodeSize: number;
  linkThickness: number;
  animate: boolean;
  center: number;
  repel: number;
  link: number;
  distance: number;
  local: boolean;
  depth: number;
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  search: '',
  showTags: false,
  showAttachments: false,
  existingOnly: false,
  showOrphans: true,
  groups: [],
  arrows: false,
  textFade: 0,
  nodeSize: 1,
  linkThickness: 1,
  animate: false,
  center: 0.3,
  repel: 10,
  link: 1,
  distance: 250,
  local: false,
  depth: 1,
};

interface Props {
  graph: VaultGraph;
  settings: GraphSettings;
  onSettings: (s: GraphSettings) => void;
  activeId: string | null;
  onOpen: (node: GraphNode) => void;
  isDark: boolean;
  accentColor: string;
  tokens: { text: string; sub: string; muted: string; divider: string; panel: string; field: string; hover: string };
}

type VaultGraph = Graph;

const matches = (n: GraphNode, q: string): boolean => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return s.split(/\s+/).every((tok) => {
    if (tok.startsWith('tag:')) return n.tags.includes(tok.slice(4).replace(/^#/, '')) || n.label.toLowerCase() === `#${tok.slice(4).replace(/^#/, '')}`;
    if (tok.startsWith('path:')) return n.rel.toLowerCase().includes(tok.slice(5));
    if (tok.startsWith('file:')) return n.label.toLowerCase().includes(tok.slice(5));
    return n.label.toLowerCase().includes(tok) || n.rel.toLowerCase().includes(tok);
  });
};

/** Grafo no estilo do Obsidian: pontos pequenos, links finos, destaque dos vizinhos ao passar o mouse e painel de ajustes. */
export const VaultGraphView: React.FC<Props> = ({ graph, settings, onSettings, activeId, onOpen, isDark, accentColor, tokens }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const view = useRef({ k: 1, x: 0, y: 0, w: 0, h: 0, dpr: 1 });
  const alpha = useRef(1);
  const hover = useRef<string | null>(null);
  const drag = useRef<{ node: GraphNode | null; pan: boolean; moved: boolean; sx: number; sy: number } | null>(null);
  const raf = useRef(0);
  const fitted = useRef(false);

  // nós e links visíveis conforme os filtros
  const visible = useMemo(() => {
    const deg = new Map<string, number>();
    const adj = new Map<string, Set<string>>();
    for (const l of graph.links) {
      (adj.get(l.source) || adj.set(l.source, new Set()).get(l.source)!).add(l.target);
      (adj.get(l.target) || adj.set(l.target, new Set()).get(l.target)!).add(l.source);
    }
    let allowed: Set<string> | null = null;
    if (settings.local && activeId && graph.nodes.some((n) => n.id === activeId)) {
      allowed = new Set([activeId]);
      let frontier = [activeId];
      for (let d = 0; d < settings.depth; d++) {
        const next: string[] = [];
        for (const id of frontier) for (const o of adj.get(id) || []) if (!allowed.has(o)) { allowed.add(o); next.push(o); }
        frontier = next;
      }
    }
    const ok = (n: GraphNode) => {
      if (allowed && !allowed.has(n.id)) return false;
      if (n.kind === 'tag' && !settings.showTags) return false;
      if (n.kind === 'attachment' && !settings.showAttachments) return false;
      if (n.kind === 'missing' && settings.existingOnly) return false;
      return matches(n, settings.search);
    };
    const nodes = graph.nodes.filter(ok);
    const ids = new Set(nodes.map((n) => n.id));
    const links = graph.links.filter((l) => ids.has(l.source) && ids.has(l.target));
    for (const l of links) { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); }
    const shown = settings.showOrphans ? nodes : nodes.filter((n) => deg.has(n.id));
    const shownIds = new Set(shown.map((n) => n.id));
    const byId = new Map(shown.map((n) => [n.id, n]));
    return { nodes: shown, links: links.filter((l) => shownIds.has(l.source) && shownIds.has(l.target)), byId, adj, deg };
  }, [graph, settings.search, settings.showTags, settings.showAttachments, settings.existingOnly, settings.showOrphans, settings.local, settings.depth, activeId]);

  const groupColor = useCallback(
    (n: GraphNode): string | null => {
      for (const g of settings.groups) if (g.query.trim() && matches(n, g.query)) return g.color;
      return null;
    },
    [settings.groups],
  );

  const reheat = useCallback((a = 0.8) => { alpha.current = Math.max(alpha.current, a); }, []);
  useEffect(() => reheat(1), [visible, settings.center, settings.repel, settings.link, settings.distance, reheat]);

  const radius = useCallback((n: GraphNode) => Math.max(logoSrcFor(n) ? 8 : 0, n.kind === 'tag' ? 3.2 : 2.6 + Math.sqrt(visible.deg.get(n.id) || 0) * 1.5) * settings.nodeSize, [visible, settings.nodeSize]);

  const fit = useCallback(() => {
    const v = view.current;
    const ns = visible.nodes;
    if (!ns.length || !v.w) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of ns) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); }
    const pad = 60;
    const k = Math.min(2, Math.max(0.1, Math.min((v.w - pad * 2) / Math.max(1, maxX - minX), (v.h - pad * 2) / Math.max(1, maxY - minY))));
    v.k = k;
    v.x = v.w / 2 - ((minX + maxX) / 2) * k;
    v.y = v.h / 2 - ((minY + maxY) / 2) * k;
  }, [visible]);

  // simulação + desenho
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      view.current.w = r.width; view.current.h = r.height; view.current.dpr = dpr;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const step = () => {
      const ns = visible.nodes;
      const a = alpha.current;
      if (a < 0.003 && !settings.animate && !drag.current?.node) return false;
      const rep = settings.repel * 35;
      const grav = settings.center * 0.04;
      const spring = settings.link * 0.06;
      const len = settings.distance * 0.35;
      for (let i = 0; i < ns.length; i++) {
        const p = ns[i];
        for (let j = i + 1; j < ns.length; j++) {
          const q = ns[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 90000) continue;
          const f = (rep * a) / d2;
          const d = Math.sqrt(d2);
          p.vx += (dx / d) * f * 6; p.vy += (dy / d) * f * 6;
          q.vx -= (dx / d) * f * 6; q.vy -= (dy / d) * f * 6;
        }
        p.vx -= p.x * grav * a; p.vy -= p.y * grav * a;
      }
      for (const l of visible.links) {
        const s = visible.byId.get(l.source), t = visible.byId.get(l.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - len) * spring * a;
        s.vx += (dx / d) * f; s.vy += (dy / d) * f;
        t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
      }
      // organização: notas do mesmo assunto (primeira tag ou pasta) se agrupam, nós não se sobrepõem e os soltos vão para um anel externo
      const clusters = new Map<string, { x: number; y: number; n: number }>();
      const keyOf = (n: GraphNode) => (n.kind === 'note' ? n.tags[0] || (n.rel.includes('/') ? n.rel.split('/')[0] : '') : '');
      for (const n of ns) {
        const k = keyOf(n);
        if (!k) continue;
        const c = clusters.get(k) || { x: 0, y: 0, n: 0 };
        c.x += n.x; c.y += n.y; c.n++;
        clusters.set(k, c);
      }
      const ring = 130 + Math.sqrt(ns.length) * 26;
      for (let i = 0; i < ns.length; i++) {
        const p = ns[i];
        const k = keyOf(p);
        const c = k ? clusters.get(k) : null;
        if (c && c.n > 2) { p.vx += (c.x / c.n - p.x) * 0.012 * a; p.vy += (c.y / c.n - p.y) * 0.012 * a; }
        if (!(visible.deg.get(p.id) || 0)) {
          const d = Math.sqrt(p.x * p.x + p.y * p.y) || 1;
          p.vx += (p.x / d) * (ring - d) * 0.03 * a; p.vy += (p.y / d) * (ring - d) * 0.03 * a;
        }
        const rp = radius(p);
        for (let j = i + 1; j < ns.length; j++) {
          const q = ns[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const min = rp + radius(q) + 16;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 0.01;
          const push = ((min - d) / d) * 0.12 * Math.max(a, 0.2);
          p.vx += dx * push; p.vy += dy * push;
          q.vx -= dx * push; q.vy -= dy * push;
        }
      }
      const held = drag.current?.node;
      for (const n of ns) {
        if (n === held) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      }
      alpha.current = settings.animate ? Math.max(0.05, a * 0.992) : a * 0.985;
      return true;
    };

    const draw = () => {
      const v = view.current;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.clearRect(0, 0, v.w, v.h);
      // pontinhos do fundo, como no canvas da orquestração: grade de 26px que acompanha pan e zoom
      const gap = 26 * v.k;
      if (gap >= 7) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
        const dr = Math.max(0.6, 1.5 * v.k);
        for (let gx = ((v.x % gap) + gap) % gap; gx < v.w; gx += gap) {
          for (let gy = ((v.y % gap) + gap) % gap; gy < v.h; gy += gap) {
            ctx.beginPath(); ctx.arc(gx, gy, dr, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      const hid = hover.current;
      const near = hid ? visible.adj.get(hid) : null;
      const now = performance.now();
      // cor do nó: grupo definido > tipo (tag, anexo, pendente) > primeira tag da nota > pasta; sem nada, usa a cor de destaque
      const colorOf = (n: GraphNode) =>
        logoSrcFor(n)?.brand ||
        groupColor(n) ||
        (n.kind === 'tag' ? '#22c55e' : n.kind === 'missing' ? (isDark ? '#6b6b6b' : '#b5b5b5') : n.kind === 'attachment' ? '#3b82f6' : n.tags[0] ? hashColor(`t:${n.tags[0]}`) : n.rel.includes('/') ? hashColor(`d:${n.rel.split('/')[0]}`) : accentColor);
      const lw = Math.max(0.35, 0.55 * settings.linkThickness * Math.min(1.5, v.k));
      for (const l of visible.links) {
        const s = visible.byId.get(l.source), t = visible.byId.get(l.target);
        if (!s || !t) continue;
        const sx = s.x * v.k + v.x, sy = s.y * v.k + v.y, tx = t.x * v.k + v.x, ty = t.y * v.k + v.y;
        if ((sx < -50 && tx < -50) || (sy < -50 && ty < -50) || (sx > v.w + 50 && tx > v.w + 50) || (sy > v.h + 50 && ty > v.h + 50)) continue;
        const hot = !!hid && (l.source === hid || l.target === hid);
        const dx = tx - sx, dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // curva suave: o desvio é perpendicular e muda de lado conforme o sentido, para ligações de ida e volta não se sobreporem
        const bend = (l.source < l.target ? 1 : -1) * dist * 0.14;
        const cx = (sx + tx) / 2 - (dy / dist) * bend, cy = (sy + ty) / 2 + (dx / dist) * bend;
        const cs = colorOf(s), ct = colorOf(t);
        const alpha = hot ? 0.95 : hid ? 0.05 : 0.38;
        const grad = ctx.createLinearGradient(sx, sy, tx, ty);
        grad.addColorStop(0, hexToRgba(cs, alpha));
        grad.addColorStop(1, hexToRgba(ct, alpha));
        ctx.strokeStyle = grad;
        ctx.lineWidth = hot ? lw * 1.7 : lw;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, tx, ty); ctx.stroke();
        if (hot) {
          // pontos de luz correndo pela ligação destacada
          for (let k = 0; k < 2; k++) {
            const u = ((now * 0.00035 + k * 0.5) % 1);
            const px = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * tx;
            const py = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ty;
            ctx.fillStyle = hexToRgba(u < 0.5 ? cs : ct, 0.95);
            ctx.beginPath(); ctx.arc(px, py, Math.max(1.4, lw * 1.2), 0, Math.PI * 2); ctx.fill();
          }
        }
        if (settings.arrows) {
          const ang = Math.atan2(ty - cy, tx - cx);
          const r = radius(t) * v.k + 2;
          const ax = tx - Math.cos(ang) * r, ay = ty - Math.sin(ang) * r;
          // ponta aberta (chevron) fina, em vez do triângulo cheio
          const size = Math.max(4, 5 * Math.min(1.4, v.k));
          ctx.strokeStyle = hexToRgba(ct, Math.min(1, alpha + 0.25));
          ctx.lineWidth = Math.max(0.8, lw * 1.3);
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ax - Math.cos(ang - 0.6) * size, ay - Math.sin(ang - 0.6) * size);
          ctx.lineTo(ax, ay);
          ctx.lineTo(ax - Math.cos(ang + 0.6) * size, ay - Math.sin(ang + 0.6) * size);
          ctx.stroke();
        }
      }
      const fadeAt = 1.1 - settings.textFade * 0.3;
      const labelAlpha = Math.min(1, Math.max(0, (v.k - fadeAt) / 0.5));
      ctx.font = '11px Poppins, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      for (const n of visible.nodes) {
        const x = n.x * v.k + v.x, y = n.y * v.k + v.y;
        if (x < -20 || y < -20 || x > v.w + 20 || y > v.h + 20) continue;
        const dim = hid && n.id !== hid && !near?.has(n.id);
        const active = n.id === activeId;
        const focus = active || n.id === hid;
        const col = colorOf(n);
        const r = radius(n) * Math.min(1.8, Math.max(0.6, v.k));
        const hub = (visible.deg.get(n.id) || 0) >= 6;
        ctx.globalAlpha = dim ? 0.16 : 1;
        // brilho suave nos nós em foco e nos mais ligados
        if (!dim && (focus || hub)) {
          const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * (focus ? 3.4 : 2.6));
          halo.addColorStop(0, hexToRgba(col, focus ? 0.5 : 0.32));
          halo.addColorStop(1, hexToRgba(col, 0));
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(x, y, r * (focus ? 3.4 : 2.6), 0, Math.PI * 2); ctx.fill();
        }
        // esfera: gradiente com ponto de luz deslocado
        const fill = col;
        const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        body.addColorStop(0, hexToRgba(fill, 1));
        body.addColorStop(1, hexToRgba(fill, 0.78));
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        const logo = logoSrcFor(n);
        if (logo) {
          // medalhão na cor da IA com o logo em preto ou branco, o que contrastar melhor
          const ink = logo.id === 'claude' ? '#ffffff' : getContrastTextColor(logo.brand);
          const d = r * 1.2;
          const tinted = tintedLogo(logo.src, ink, d * v.dpr);
          if (tinted) ctx.drawImage(tinted, x - d / 2, y - d / 2, d, d);
        }
        if (focus) { ctx.strokeStyle = hexToRgba(col, 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r + 3.5 + Math.sin(now * 0.004) * 1, 0, Math.PI * 2); ctx.stroke(); }
        const showLabel = n.id === hid || (near?.has(n.id) && hid) || (!dim && labelAlpha > 0);
        if (showLabel) {
          ctx.globalAlpha = n.id === hid || near?.has(n.id) ? 1 : labelAlpha * (dim ? 0.3 : 0.9);
          ctx.fillStyle = isDark ? '#e4e4e7' : '#262626';
          ctx.fillText(n.label, x, y + r + 12);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      step();
      draw();
      raf.current = requestAnimationFrame(loop);
    };
    if (!fitted.current && visible.nodes.length) {
      for (let i = 0; i < 160; i++) { alpha.current = 1; step(); }
      alpha.current = 0.3;
      fit();
      fitted.current = true;
    }
    raf.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf.current); ro.disconnect(); };
  }, [visible, settings.animate, settings.repel, settings.center, settings.link, settings.distance, settings.arrows, settings.textFade, settings.linkThickness, activeId, isDark, accentColor, groupColor, radius, fit]);

  // interação
  const toWorld = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = view.current;
    return { sx: e.clientX - r.left, sy: e.clientY - r.top, wx: (e.clientX - r.left - v.x) / v.k, wy: (e.clientY - r.top - v.y) / v.k };
  };
  const pick = (wx: number, wy: number): GraphNode | null => {
    let best: GraphNode | null = null;
    let bd = Infinity;
    const k = view.current.k;
    for (const n of visible.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      const hit = Math.max(6 / k, radius(n) + 2 / k);
      if (d <= hit && d < bd) { best = n; bd = d; }
    }
    return best;
  };

  const onDown = (e: React.MouseEvent) => {
    const p = toWorld(e);
    drag.current = { node: pick(p.wx, p.wy), pan: false, moved: false, sx: p.sx, sy: p.sy };
    if (!drag.current.node) drag.current.pan = true;
  };
  const onMove = (e: React.MouseEvent) => {
    const p = toWorld(e);
    const d = drag.current;
    const v = view.current;
    if (d) {
      if (Math.hypot(p.sx - d.sx, p.sy - d.sy) > 3) d.moved = true;
      if (d.node && d.moved) { d.node.x = p.wx; d.node.y = p.wy; reheat(0.4); }
      else if (d.pan && d.moved) { v.x += p.sx - d.sx; v.y += p.sy - d.sy; d.sx = p.sx; d.sy = p.sy; }
      return;
    }
    const h = pick(p.wx, p.wy);
    hover.current = h?.id || null;
    if (canvasRef.current) canvasRef.current.style.cursor = h ? 'pointer' : 'grab';
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.node && !d.moved) onOpen(d.node);
  };
  const onWheel = (e: React.WheelEvent) => {
    const p = toWorld(e);
    const v = view.current;
    const k = Math.min(6, Math.max(0.08, v.k * Math.exp(-e.deltaY * 0.0015)));
    v.x = p.sx - p.wx * k; v.y = p.sy - p.wy * k; v.k = k;
  };

  const set = (patch: Partial<GraphSettings>) => onSettings({ ...settings, ...patch });

  return (
    <div ref={wrapRef} data-tour="brain-graph-area" style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, background: isDark ? '#000000' : '#f8fafc', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab' }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { drag.current = null; hover.current = null; }} onWheel={onWheel} onDoubleClick={() => fit()} />
      {!visible.nodes.length && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.muted, fontSize: 12, pointerEvents: 'none' }}>
          Nenhuma nota encontrada com esses filtros.
        </div>
      )}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <button
          className="df-pressable"
          title={panelOpen ? 'Fechar ajustes do grafo' : 'Ajustes do grafo'}
          onClick={() => setPanelOpen((o) => !o)}
          style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: tokens.panel, color: panelOpen ? accentColor : tokens.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.15s ease, background 0.15s ease' }}
        >
          {panelOpen ? <X size={14} /> : <Settings2 size={14} />}
        </button>
        {panelOpen && <SettingsPanel settings={settings} set={set} onReset={() => onSettings({ ...DEFAULT_GRAPH_SETTINGS, groups: [] })} onRefit={fit} isDark={isDark} accentColor={accentColor} tokens={tokens} />}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ painel de ajustes */

const Section: React.FC<{ title: string; defaultOpen?: boolean; tokens: Props['tokens']; children: React.ReactNode }> = ({ title, defaultOpen = true, tokens, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: tokens.text, fontSize: 12, fontWeight: 500 }}>
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', color: tokens.sub }} />
        {title}
      </div>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
    </div>
  );
};

const Row: React.FC<{ label: string; tokens: Props['tokens']; children: React.ReactNode; column?: boolean }> = ({ label, tokens, children, column }) => (
  <div style={{ display: 'flex', flexDirection: column ? 'column' : 'row', alignItems: column ? 'stretch' : 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: tokens.sub }}>
    <span>{label}</span>
    {children}
  </div>
);

const Slider: React.FC<{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; accentColor: string }> = ({ value, min, max, step, onChange, accentColor }) => (
  <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 110, height: 14, accentColor, cursor: 'pointer' }} />
);

const SettingsPanel: React.FC<{
  settings: GraphSettings;
  set: (p: Partial<GraphSettings>) => void;
  onReset: () => void;
  onRefit: () => void;
  isDark: boolean;
  accentColor: string;
  tokens: Props['tokens'];
}> = ({ settings, set, onReset, onRefit, isDark, accentColor, tokens }) => {
  const [colorIdx, setColorIdx] = useState<number | null>(null);
  const anchors = useRef<(HTMLDivElement | null)[]>([]);
  const sw = (checked: boolean, on: (b: boolean) => void) => <MiniSwitch checked={checked} onChange={() => on(!checked)} accentColor={accentColor} title="" />;
  const input: React.CSSProperties = { height: 30, padding: '0 10px', borderRadius: 6, border: 'none', outline: 'none', background: tokens.field, color: tokens.text, fontSize: 12, fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box', width: '100%' };
  const palette = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6'];

  return (
    <div style={{ width: 270, maxHeight: 'calc(92vh - 140px)', overflowY: 'auto', background: tokens.panel, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="df-pressable" onClick={onReset} title="Restaurar ajustes padrão" style={{ height: 30, width: 30, borderRadius: 6, border: 'none', background: tokens.field, color: tokens.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={13} />
        </button>
        <button className="df-pressable" onClick={onRefit} style={{ height: 30, flex: 1, borderRadius: 6, border: 'none', background: tokens.field, color: tokens.text, cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins, sans-serif' }}>
          Centralizar grafo
        </button>
      </div>

      <Section title="Filtros" tokens={tokens}>
        <input style={input} placeholder="Buscar notas, tag: ou path:" value={settings.search} onChange={(e) => set({ search: e.target.value })} />
        <Row label="Tags" tokens={tokens}>{sw(settings.showTags, (b) => set({ showTags: b }))}</Row>
        <Row label="Anexos" tokens={tokens}>{sw(settings.showAttachments, (b) => set({ showAttachments: b }))}</Row>
        <Row label="Somente existentes" tokens={tokens}>{sw(settings.existingOnly, (b) => set({ existingOnly: b }))}</Row>
        <Row label="Notas órfãs" tokens={tokens}>{sw(settings.showOrphans, (b) => set({ showOrphans: b }))}</Row>
        <Row label="Grafo local" tokens={tokens}>{sw(settings.local, (b) => set({ local: b }))}</Row>
        {settings.local && (
          <Row label={`Profundidade ${settings.depth}`} tokens={tokens}>
            <Slider value={settings.depth} min={1} max={5} step={1} onChange={(v) => set({ depth: v })} accentColor={accentColor} />
          </Row>
        )}
      </Section>

      <Section title="Grupos" tokens={tokens}>
        {settings.groups.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input style={input} placeholder="tag:#nome ou path:pasta" value={g.query} onChange={(e) => set({ groups: settings.groups.map((x, j) => (j === i ? { ...x, query: e.target.value } : x)) })} />
            <div ref={(el) => { anchors.current[i] = el; }} onClick={() => setColorIdx(i)} style={{ width: 30, height: 30, borderRadius: 6, background: g.color, flexShrink: 0, cursor: 'pointer' }} />
            <PopupPortal anchor={anchors.current[i]} open={colorIdx === i} onClose={() => setColorIdx(null)} width={240} align="right" maxHeight={380} isDark={isDark}>
              <DevFlowColorPicker color={g.color} onChange={(c) => set({ groups: settings.groups.map((x, j) => (j === i ? { ...x, color: c } : x)) })} isDark={isDark} />
            </PopupPortal>
            <button className="df-pressable" title="Remover grupo" onClick={() => set({ groups: settings.groups.filter((_, j) => j !== i) })} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: tokens.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="df-pressable" onClick={() => set({ groups: [...settings.groups, { query: '', color: palette[settings.groups.length % palette.length] }] })} style={{ height: 30, borderRadius: 6, border: 'none', background: accentColor, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={13} /> Novo grupo
        </button>
      </Section>

      <Section title="Exibição" tokens={tokens}>
        <Row label="Setas" tokens={tokens}>{sw(settings.arrows, (b) => set({ arrows: b }))}</Row>
        <Row label="Limite do texto" tokens={tokens}><Slider value={settings.textFade} min={-3} max={3} step={0.1} onChange={(v) => set({ textFade: v })} accentColor={accentColor} /></Row>
        <Row label="Tamanho dos nós" tokens={tokens}><Slider value={settings.nodeSize} min={0.4} max={3} step={0.05} onChange={(v) => set({ nodeSize: v })} accentColor={accentColor} /></Row>
        <Row label="Espessura dos links" tokens={tokens}><Slider value={settings.linkThickness} min={0.3} max={3} step={0.05} onChange={(v) => set({ linkThickness: v })} accentColor={accentColor} /></Row>
        <Row label="Animar" tokens={tokens}>{sw(settings.animate, (b) => set({ animate: b }))}</Row>
      </Section>

      <Section title="Forças" tokens={tokens}>
        <Row label="Força central" tokens={tokens}><Slider value={settings.center} min={0} max={1} step={0.01} onChange={(v) => set({ center: v })} accentColor={accentColor} /></Row>
        <Row label="Força de repulsão" tokens={tokens}><Slider value={settings.repel} min={0} max={20} step={0.1} onChange={(v) => set({ repel: v })} accentColor={accentColor} /></Row>
        <Row label="Força dos links" tokens={tokens}><Slider value={settings.link} min={0} max={2} step={0.01} onChange={(v) => set({ link: v })} accentColor={accentColor} /></Row>
        <Row label="Distância dos links" tokens={tokens}><Slider value={settings.distance} min={30} max={500} step={1} onChange={(v) => set({ distance: v })} accentColor={accentColor} /></Row>
      </Section>
    </div>
  );
};
