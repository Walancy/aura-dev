import type { FillItem, Shape } from './types';
import { descendantIds } from './constraints';
import { cssGradient, hexWithAlpha, isGradientFill } from './gradient';

type Style = Record<string, string | number>;

interface CodeNode {
  tag: 'div' | 'span' | 'img' | 'svg';
  name: string;
  style: Style;
  text?: string;
  src?: string;
  svg?: string; // conteúdo interno do <svg>
  viewBox?: string;
  children: CodeNode[];
}

const num = (n: number) => Math.round(n * 100) / 100;
const px = (n: number) => `${num(n)}px`;

function fillCss(s: Shape): string | undefined {
  const fills: FillItem[] = (s.fills && s.fills.length > 0 ? s.fills : [{ id: 'b', color: s.fill, opacity: 1, visible: true }]).filter((f) => f.visible && f.color && f.color !== 'none' && f.color !== 'transparent');
  if (fills.length === 0) return undefined;
  // CSS empilha o primeiro background por cima, como o canvas
  return fills.map((f) => (isGradientFill(f) ? cssGradient(f) : f.opacity < 1 ? hexWithAlpha(f.color, f.opacity) : f.color)).join(', ');
}

function effectsCss(s: Shape): Style {
  const style: Style = {};
  const shadows: string[] = [];
  for (const e of s.effects || []) {
    if (!e.visible) continue;
    if (e.type === 'drop-shadow') shadows.push(`${e.x || 0}px ${e.y ?? 4}px ${e.blur ?? 4}px ${e.spread || 0}px ${hexWithAlpha(e.color, e.opacity ?? 0.25)}`);
    else if (e.type === 'inner-shadow') shadows.push(`inset ${e.x || 0}px ${e.y ?? 4}px ${e.blur ?? 4}px ${e.spread || 0}px ${hexWithAlpha(e.color, e.opacity ?? 0.25)}`);
    else if (e.type === 'layer-blur') style.filter = `blur(${e.blur ?? 4}px)`;
    else if (e.type === 'background-blur') style.backdropFilter = `blur(${e.blur ?? 4}px)`;
  }
  if (shadows.length) style.boxShadow = shadows.join(', ');
  return style;
}

function alignCss(frame: Shape): Style {
  const map: Record<string, [string, string]> = {
    'top-left': ['flex-start', 'flex-start'],
    'top-center': ['center', 'flex-start'],
    'top-right': ['flex-end', 'flex-start'],
    left: ['flex-start', 'center'],
    center: ['center', 'center'],
    right: ['flex-end', 'center'],
    'bottom-left': ['flex-start', 'flex-end'],
    'bottom-center': ['center', 'flex-end'],
    'bottom-right': ['flex-end', 'flex-end'],
  };
  const [h, v] = map[frame.layoutAlign || 'top-left'] || map['top-left'];
  const horizontal = frame.layoutFlow === 'horizontal';
  return { justifyContent: horizontal ? h : v, alignItems: horizontal ? v : h };
}

function toNode(all: Shape[], s: Shape, parent: Shape | null): CodeNode {
  const autoParent = Boolean(parent?.hasAutoLayout && (parent.layoutFlow === 'horizontal' || parent.layoutFlow === 'vertical'));
  const style: Style = {};
  if (autoParent) {
    style.flexShrink = 0;
    if ((parent!.layoutFlow === 'horizontal' ? s.widthMode : s.heightMode) === 'fill') style.flex = 1;
  } else {
    style.position = 'absolute';
    style.left = px(s.x - (parent?.x ?? 0));
    style.top = px(s.y - (parent?.y ?? 0));
  }
  style.width = px(s.width);
  style.height = px(s.height);
  if (s.opacity !== undefined && s.opacity < 1) style.opacity = num(s.opacity);
  if (s.rotation) style.transform = `rotate(${num(s.rotation)}deg)`;
  Object.assign(style, effectsCss(s));

  const kids = all.filter((c) => c.parentId === s.id && c.visible !== false).sort((a, b) => a.zIndex - b.zIndex);
  const strokes = (s.strokes && s.strokes.length > 0 ? s.strokes.filter((st) => st.visible) : s.stroke && s.stroke !== 'none' && s.stroke !== 'transparent' ? [{ color: s.stroke, width: s.strokeWidth }] : []) as Array<{ color: string; width?: number }>;
  if (strokes[0] && s.type !== 'line' && s.type !== 'arrow') style.border = `${px(strokes[0].width ?? s.strokeWidth ?? 1)} solid ${strokes[0].color}`;

  switch (s.type) {
    case 'text':
    case 'text-path': {
      const node: CodeNode = { tag: 'div', name: s.name || 'Texto', style, text: s.text || '', children: [] };
      node.style = {
        ...style,
        color: s.fill,
        fontSize: px(s.fontSize || 16),
        fontFamily: s.fontFamily ? `'${s.fontFamily}', sans-serif` : 'Inter, sans-serif',
        fontWeight: (s.fontWeight as any) || 400,
        textAlign: s.textAlign || 'left',
        lineHeight: 1.25,
        whiteSpace: 'pre-wrap',
      };
      if (s.letterSpacing) node.style.letterSpacing = typeof s.letterSpacing === 'number' ? px(s.letterSpacing) : String(s.letterSpacing);
      delete node.style.height;
      delete node.style.border;
      return node;
    }
    case 'ellipse':
      style.borderRadius = '50%';
      break;
    case 'line':
    case 'arrow': {
      const color = strokes[0]?.color || s.stroke || '#000';
      return { tag: 'div', name: s.name || 'Linha', style: { ...style, height: px(Math.max(1, strokes[0]?.width ?? s.strokeWidth ?? 1)), background: color }, children: [] };
    }
    case 'image':
      return { tag: 'img', name: s.name || 'Imagem', style: { ...style, objectFit: 'cover', ...(s.cornerRadius ? { borderRadius: px(s.cornerRadius) } : {}) }, src: s.imageUrl?.startsWith('data:') ? `/assets/${(s.name || 'imagem').replace(/\s+/g, '-')}.png` : s.imageUrl || '', children: [] };
    case 'polygon':
    case 'star':
    case 'path': {
      const fill = (s.fills && s.fills.find((f) => f.visible)?.color) || s.fill || '#000';
      let inner = '';
      let viewBox = `0 0 ${num(s.width)} ${num(s.height)}`;
      if (s.type === 'path') {
        viewBox = `0 0 ${num(s.pathW || s.width)} ${num(s.pathH || s.height)}`;
        inner = `<path d="${s.pathD}" fill="${fill}" fill-rule="evenodd"/>`;
      } else if (s.type === 'polygon') {
        const n = Math.max(3, Math.round(s.polygonSides ?? 3));
        const r = Math.min(s.width, s.height) / 2;
        const pts = Array.from({ length: n }, (_, i) => {
          const a = (i * 2 * Math.PI) / n - Math.PI / 2;
          return `${num(s.width / 2 + r * Math.cos(a))},${num(s.height / 2 + r * Math.sin(a))}`;
        });
        inner = `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
      } else {
        const n = s.starPoints ?? 5;
        const ro = Math.min(s.width, s.height) / 2;
        const ri = ro * (s.starInnerRatio ?? 0.5);
        const pts = Array.from({ length: 2 * n }, (_, i) => {
          const r = i % 2 === 0 ? ro : ri;
          const a = (i * Math.PI) / n - Math.PI / 2;
          return `${num(s.width / 2 + r * Math.cos(a))},${num(s.height / 2 + r * Math.sin(a))}`;
        });
        inner = `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
      }
      return { tag: 'svg', name: s.name || 'Forma', style, svg: inner, viewBox, children: [] };
    }
    default:
      if (s.cornerRadius) style.borderRadius = px(s.cornerRadius);
  }

  const bg = fillCss(s);
  if (bg && s.type !== 'group') style.background = bg;
  if (s.hasAutoLayout && (s.layoutFlow === 'horizontal' || s.layoutFlow === 'vertical')) {
    Object.assign(style, { display: 'flex', flexDirection: s.layoutFlow === 'horizontal' ? 'row' : 'column', gap: px(s.layoutGap ?? 0), boxSizing: 'border-box', ...alignCss(s) });
    const pt = s.independentPadding ? s.paddingTop ?? 0 : s.paddingVertical ?? 0;
    const pr = s.independentPadding ? s.paddingRight ?? 0 : s.paddingHorizontal ?? 0;
    const pb = s.independentPadding ? s.paddingBottom ?? 0 : s.paddingVertical ?? 0;
    const pl = s.independentPadding ? s.paddingLeft ?? 0 : s.paddingHorizontal ?? 0;
    style.padding = `${px(pt)} ${px(pr)} ${px(pb)} ${px(pl)}`;
    if (s.widthMode === 'hug') delete style.width;
    if (s.heightMode === 'hug') delete style.height;
  } else if (kids.length > 0) {
    style.position = autoParent ? 'relative' : 'absolute';
  }
  if (s.clipContent) style.overflow = 'hidden';
  return { tag: 'div', name: s.name || s.type, style, children: kids.map((k) => toNode(all, k, s)) };
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsx = (t: string) => t.replace(/[{}<>]/g, (c) => `{'${c}'}`);

function treeFor(all: Shape[], root: Shape): CodeNode {
  const parent = root.parentId ? all.find((s) => s.id === root.parentId) || null : null;
  const node = toNode(all, root, parent);
  // a raiz não precisa de posição absoluta no documento
  delete node.style.left;
  delete node.style.top;
  if (node.style.position === 'absolute') node.style.position = 'relative';
  return node;
}

export const componentName = (name: string) => {
  const cleaned = (name || 'Tela').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const pascal = cleaned.split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  return /^[A-Za-z]/.test(pascal) ? pascal : `Tela${pascal}`;
};

export function generateReact(all: Shape[], root: Shape): string {
  const render = (n: CodeNode, depth: number): string => {
    const pad = '  '.repeat(depth);
    const style = `{{ ${Object.entries(n.style).map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(v)}`).join(', ')} }}`;
    if (n.tag === 'img') return `${pad}<img src=${JSON.stringify(n.src)} alt=${JSON.stringify(n.name)} style=${style} />`;
    if (n.tag === 'svg') return `${pad}<svg viewBox="${n.viewBox}" style=${style} dangerouslySetInnerHTML={{ __html: ${JSON.stringify(n.svg)} }} />`;
    if (n.text !== undefined) return `${pad}<div style=${style}>${jsx(n.text).split('\n').join('<br />')}</div>`;
    if (n.children.length === 0) return `${pad}<div style=${style} />`;
    return `${pad}<div style=${style}>\n${n.children.map((c) => render(c, depth + 1)).join('\n')}\n${pad}</div>`;
  };
  return `export function ${componentName(root.name || 'Tela')}() {\n  return (\n${render(treeFor(all, root), 2)}\n  );\n}\n`;
}

export function generateHtml(all: Shape[], root: Shape): string {
  const render = (n: CodeNode, depth: number): string => {
    const pad = '  '.repeat(depth);
    const style = Object.entries(n.style).map(([k, v]) => `${kebab(k)}: ${v}`).join('; ');
    if (n.tag === 'img') return `${pad}<img src="${esc(n.src || '')}" alt="${esc(n.name)}" style="${style}">`;
    if (n.tag === 'svg') return `${pad}<svg viewBox="${n.viewBox}" style="${style}">${n.svg}</svg>`;
    if (n.text !== undefined) return `${pad}<div style="${style}">${esc(n.text).split('\n').join('<br>')}</div>`;
    if (n.children.length === 0) return `${pad}<div style="${style}"></div>`;
    return `${pad}<div style="${style}">\n${n.children.map((c) => render(c, depth + 1)).join('\n')}\n${pad}</div>`;
  };
  return `<!-- ${root.name || 'Tela'} -->\n${render(treeFor(all, root), 0)}\n`;
}

// ---------------------------------------------------------------------------------------------
// Flutter
// ---------------------------------------------------------------------------------------------

const dartColor = (hex: string, opacity = 1) => {
  const c = (hex || '#000000').replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c.padEnd(6, '0').slice(0, 6);
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `Color(0x${a}${full.toUpperCase()})`;
};

function dartDecoration(s: Shape, indent: string): string {
  const parts: string[] = [];
  const fills = (s.fills && s.fills.length > 0 ? s.fills : [{ id: 'b', color: s.fill, opacity: 1, visible: true } as FillItem]).filter((f) => f.visible && f.color && f.color !== 'none' && f.color !== 'transparent');
  const first = fills[0];
  if (first) {
    if (isGradientFill(first)) {
      const stops = first.gradientStops!;
      const colors = stops.map((st) => dartColor(st.color, st.opacity)).join(', ');
      const pos = stops.map((st) => num(st.position)).join(', ');
      parts.push(
        first.type === 'radial'
          ? `gradient: RadialGradient(colors: [${colors}], stops: [${pos}])`
          : `gradient: LinearGradient(colors: [${colors}], stops: [${pos}], begin: Alignment.centerLeft, end: Alignment.centerRight)`
      );
    } else parts.push(`color: ${dartColor(first.color, first.opacity)}`);
  }
  const stroke = (s.strokes && s.strokes.find((st) => st.visible)) || (s.stroke && s.stroke !== 'none' && s.stroke !== 'transparent' ? { color: s.stroke, opacity: 1, width: s.strokeWidth } : null);
  if (stroke) parts.push(`border: Border.all(color: ${dartColor(stroke.color, (stroke as any).opacity ?? 1)}, width: ${num((stroke as any).width ?? s.strokeWidth ?? 1)})`);
  if (s.type === 'ellipse') parts.push('shape: BoxShape.circle');
  else if (s.cornerRadius) parts.push(`borderRadius: BorderRadius.circular(${num(s.cornerRadius)})`);
  const shadows = (s.effects || []).filter((e) => e.visible && e.type === 'drop-shadow');
  if (shadows.length) {
    parts.push(
      `boxShadow: [${shadows.map((e) => `BoxShadow(color: ${dartColor(e.color, e.opacity ?? 0.25)}, offset: Offset(${num(e.x || 0)}, ${num(e.y ?? 4)}), blurRadius: ${num(e.blur ?? 4)}, spreadRadius: ${num(e.spread || 0)})`).join(', ')}]`
    );
  }
  return parts.length ? `${indent}decoration: BoxDecoration(${parts.join(', ')}),\n` : '';
}

export function generateFlutter(all: Shape[], root: Shape): string {
  const render = (s: Shape, parent: Shape | null, depth: number): string => {
    const pad = '  '.repeat(depth);
    const kids = all.filter((c) => c.parentId === s.id && c.visible !== false).sort((a, b) => a.zIndex - b.zIndex);
    const auto = Boolean(s.hasAutoLayout && (s.layoutFlow === 'horizontal' || s.layoutFlow === 'vertical'));
    const autoParent = Boolean(parent?.hasAutoLayout && (parent.layoutFlow === 'horizontal' || parent.layoutFlow === 'vertical'));
    let body: string;
    if (s.type === 'text' || s.type === 'text-path') {
      const weight = Number(s.fontWeight) >= 100 ? `FontWeight.w${Math.round(Number(s.fontWeight) / 100) * 100}` : 'FontWeight.w400';
      body = `Text(${JSON.stringify(s.text || '').replace(/\$/g, '\\$')}, textAlign: TextAlign.${s.textAlign === 'center' ? 'center' : s.textAlign === 'right' ? 'right' : 'left'}, style: TextStyle(color: ${dartColor(s.fill)}, fontSize: ${num(s.fontSize || 16)}, fontWeight: ${weight}${s.fontFamily ? `, fontFamily: '${s.fontFamily}'` : ''}))`;
    } else if (s.type === 'image') {
      body = `Image.network(${JSON.stringify(s.imageUrl?.startsWith('data:') ? `assets/${(s.name || 'imagem').replace(/\s+/g, '-')}.png` : s.imageUrl || '')}, width: ${num(s.width)}, height: ${num(s.height)}, fit: BoxFit.cover)`;
    } else {
      let child = '';
      if (kids.length > 0) {
        if (auto) {
          const dir = s.layoutFlow === 'horizontal' ? 'Row' : 'Column';
          const gap = num(s.layoutGap ?? 0);
          const items = kids.map((k) => render(k, s, depth + 2));
          const spaced = gap ? items.flatMap((it, i) => (i === 0 ? [it] : [`${pad}      SizedBox(${s.layoutFlow === 'horizontal' ? 'width' : 'height'}: ${gap}),`, it])) : items;
          const pt = s.independentPadding ? s.paddingTop ?? 0 : s.paddingVertical ?? 0;
          const pr = s.independentPadding ? s.paddingRight ?? 0 : s.paddingHorizontal ?? 0;
          const pb = s.independentPadding ? s.paddingBottom ?? 0 : s.paddingVertical ?? 0;
          const pl = s.independentPadding ? s.paddingLeft ?? 0 : s.paddingHorizontal ?? 0;
          child = `${pad}  child: Padding(\n${pad}    padding: EdgeInsets.fromLTRB(${num(pl)}, ${num(pt)}, ${num(pr)}, ${num(pb)}),\n${pad}    child: ${dir}(\n${pad}      children: [\n${spaced.join('\n')}\n${pad}      ],\n${pad}    ),\n${pad}  ),\n`;
        } else {
          child = `${pad}  child: Stack(\n${pad}    clipBehavior: Clip.${s.clipContent ? 'hardEdge' : 'none'},\n${pad}    children: [\n${kids.map((k) => render(k, s, depth + 3)).join('\n')}\n${pad}    ],\n${pad}  ),\n`;
        }
      }
      body = `Container(\n${pad}  width: ${num(s.width)},\n${pad}  height: ${num(s.height)},\n${dartDecoration(s, `${pad}  `)}${child}${pad})`;
    }
    if (s.opacity !== undefined && s.opacity < 1) body = `Opacity(opacity: ${num(s.opacity)}, child: ${body})`;
    if (s.rotation) body = `Transform.rotate(angle: ${num((s.rotation * Math.PI) / 180)}, child: ${body})`;
    if (!autoParent && parent) return `${pad}Positioned(left: ${num(s.x - parent.x)}, top: ${num(s.y - parent.y)}, child: ${body}),`;
    return `${pad}${body}${parent ? ',' : ''}`;
  };
  return `import 'package:flutter/material.dart';\n\nclass ${componentName(root.name || 'Tela')} extends StatelessWidget {\n  const ${componentName(root.name || 'Tela')}({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return ${render(root, null, 2).trimStart()};\n  }\n}\n`;
}

export type CodeTarget = 'react' | 'html' | 'flutter';
export const generateCode = (target: CodeTarget, all: Shape[], root: Shape) => (target === 'react' ? generateReact(all, root) : target === 'html' ? generateHtml(all, root) : generateFlutter(all, root));
export { descendantIds };
