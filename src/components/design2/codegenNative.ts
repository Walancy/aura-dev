import type { FillItem, Shape } from './types';
import { componentName, generateCode, type CodeTarget } from './codegen';

const num = (n: number) => Math.round(n * 100) / 100;

const parseHex = (hex?: string): { rgb: string; a: number } | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return { rgb: h.slice(0, 6).toUpperCase(), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
};

const visibleFill = (s: Shape): FillItem | null => {
  const f = (s.fills?.length ? s.fills : [{ id: 'b', color: s.fill, opacity: 1, visible: true } as FillItem]).find((x) => x.visible && x.color && x.color !== 'none' && x.color !== 'transparent');
  return f && parseHex(f.color) ? f : null;
};

const strokeOf = (s: Shape) => {
  const st = s.strokes?.find((x) => x.visible);
  const color = st?.color ?? (s.stroke && s.stroke !== 'none' && s.stroke !== 'transparent' ? s.stroke : undefined);
  const width = st?.width ?? s.strokeWidth ?? 0;
  return color && width > 0 && parseHex(color) ? { color, width, opacity: st?.opacity ?? 1 } : null;
};

const pads = (s: Shape) => ({
  t: s.independentPadding ? s.paddingTop ?? 0 : s.paddingVertical ?? 0,
  r: s.independentPadding ? s.paddingRight ?? 0 : s.paddingHorizontal ?? 0,
  b: s.independentPadding ? s.paddingBottom ?? 0 : s.paddingVertical ?? 0,
  l: s.independentPadding ? s.paddingLeft ?? 0 : s.paddingHorizontal ?? 0,
});

const isFlow = (s: Shape) => !!s.hasAutoLayout && (s.layoutFlow === 'horizontal' || s.layoutFlow === 'vertical');
const kidsOf = (all: Shape[], s: Shape) => all.filter((c) => c.parentId === s.id && c.visible !== false).sort((a, b) => a.zIndex - b.zIndex);
const alignH = (s: Shape): 'start' | 'center' | 'end' => ((s.layoutAlign || 'top-left').includes('right') ? 'end' : (s.layoutAlign || '').includes('center') || s.layoutAlign === 'center' ? 'center' : 'start');
const alignV = (s: Shape): 'start' | 'center' | 'end' => ((s.layoutAlign || 'top-left').startsWith('bottom') ? 'end' : (s.layoutAlign || '').startsWith('top') ? 'start' : 'center');

// ---------------------------------------------------------------------------------------------
// SwiftUI
// ---------------------------------------------------------------------------------------------

const swColor = (hex: string, opacity = 1) => {
  const c = parseHex(hex)!;
  return `Color(hex: "#${c.rgb}")${opacity * c.a < 1 ? `.opacity(${num(opacity * c.a)})` : ''}`;
};
const swWeight = (w?: number | string) => {
  const n = Number(w) || 400;
  return n >= 800 ? '.heavy' : n >= 700 ? '.bold' : n >= 600 ? '.semibold' : n >= 500 ? '.medium' : n <= 300 ? '.light' : '.regular';
};

export function generateSwiftUI(all: Shape[], root: Shape): string {
  const render = (s: Shape, parent: Shape | null, depth: number): string => {
    const pad = '    '.repeat(depth);
    const kids = kidsOf(all, s);
    const fill = visibleFill(s);
    const stroke = strokeOf(s);
    const radius = s.cornerRadius || 0;
    let body: string;
    if (s.type === 'text' || s.type === 'text-path') {
      const align = s.textAlign === 'center' ? '.center' : s.textAlign === 'right' ? '.trailing' : '.leading';
      body = `Text(${JSON.stringify(s.text || '')})\n${pad}    .font(.system(size: ${num(s.fontSize || 16)}, weight: ${swWeight(s.fontWeight)}))\n${pad}    .foregroundColor(${parseHex(s.fill) ? swColor(s.fill) : 'Color.primary'})\n${pad}    .frame(width: ${num(s.width)}, alignment: ${align})`;
    } else if (s.type === 'image') {
      const src = s.imageUrl?.startsWith('data:') ? '' : s.imageUrl || '';
      body = `AsyncImage(url: URL(string: ${JSON.stringify(src)})) { image in image.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.2) }\n${pad}    .frame(width: ${num(s.width)}, height: ${num(s.height)})\n${pad}    .clipped()`;
    } else {
      let content = '';
      if (kids.length) {
        if (isFlow(s)) {
          const p = pads(s);
          const horizontal = s.layoutFlow === 'horizontal';
          const stack = horizontal ? 'HStack' : 'VStack';
          const al = horizontal ? { start: '.top', center: '.center', end: '.bottom' }[alignV(s)] : { start: '.leading', center: '.center', end: '.trailing' }[alignH(s)];
          content = `${stack}(alignment: ${al}, spacing: ${num(s.layoutGap ?? 0)}) {\n${kids.map((k) => render(k, s, depth + 2)).join('\n')}\n${pad}    }\n${pad}    .padding(EdgeInsets(top: ${num(p.t)}, leading: ${num(p.l)}, bottom: ${num(p.b)}, trailing: ${num(p.r)}))`;
        } else {
          content = `ZStack(alignment: .topLeading) {\n${kids.map((k) => render(k, s, depth + 2)).join('\n')}\n${pad}    }`;
        }
      }
      const shape = s.type === 'ellipse' ? 'Ellipse()' : `RoundedRectangle(cornerRadius: ${num(radius)})`;
      const bg = fill ? `${shape}.fill(${swColor(fill.color, fill.opacity)})` : null;
      const border = stroke ? `${shape}.stroke(${swColor(stroke.color, stroke.opacity)}, lineWidth: ${num(stroke.width)})` : null;
      body = `${content || 'Color.clear'}\n${pad}    .frame(width: ${num(s.width)}, height: ${num(s.height)}${isFlow(s) ? ', alignment: .topLeading' : ''})`;
      if (bg) body += `\n${pad}    .background(${bg})`;
      if (border) body += `\n${pad}    .overlay(${border})`;
      if (s.clipContent || radius) body += `\n${pad}    .clipShape(${s.type === 'ellipse' ? 'Ellipse()' : `RoundedRectangle(cornerRadius: ${num(radius)})`})`;
    }
    const shadow = (s.effects || []).find((e) => e.visible && e.type === 'drop-shadow');
    if (shadow && parseHex(shadow.color)) body += `\n${pad}    .shadow(color: ${swColor(shadow.color, shadow.opacity ?? 0.25)}, radius: ${num((shadow.blur ?? 4) / 2)}, x: ${num(shadow.x || 0)}, y: ${num(shadow.y ?? 4)})`;
    if (s.opacity !== undefined && s.opacity < 1) body += `\n${pad}    .opacity(${num(s.opacity)})`;
    if (s.rotation) body += `\n${pad}    .rotationEffect(.degrees(${num(s.rotation)}))`;
    // fora de um fluxo: posição absoluta pelo canto superior esquerdo
    if (parent && !isFlow(parent)) body += `\n${pad}    .offset(x: ${num(s.x - parent.x)}, y: ${num(s.y - parent.y)})`;
    return `${pad}${body}`;
  };
  const name = componentName(root.name || 'Tela');
  return `import SwiftUI\n\nstruct ${name}: View {\n    var body: some View {\n${render(root, null, 2)}\n    }\n}\n\nextension Color {\n    init(hex: String) {\n        let v = UInt64(hex.dropFirst(), radix: 16) ?? 0\n        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)\n    }\n}\n`;
}

// ---------------------------------------------------------------------------------------------
// Jetpack Compose
// ---------------------------------------------------------------------------------------------

const kColor = (hex: string, opacity = 1) => {
  const c = parseHex(hex)!;
  const a = Math.round(Math.max(0, Math.min(1, opacity * c.a)) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `Color(0x${a}${c.rgb})`;
};
const kWeight = (w?: number | string) => `FontWeight.W${Math.max(100, Math.min(900, Math.round((Number(w) || 400) / 100) * 100))}`;

export function generateCompose(all: Shape[], root: Shape): string {
  const render = (s: Shape, parent: Shape | null, depth: number): string => {
    const pad = '    '.repeat(depth);
    const kids = kidsOf(all, s);
    const fill = visibleFill(s);
    const stroke = strokeOf(s);
    const radius = s.cornerRadius || 0;
    const shape = s.type === 'ellipse' ? 'CircleShape' : `RoundedCornerShape(${num(radius)}.dp)`;
    const mods: string[] = [];
    if (parent && !isFlow(parent)) mods.push(`.offset(x = ${num(s.x - parent.x)}.dp, y = ${num(s.y - parent.y)}.dp)`);
    mods.push(`.size(width = ${num(s.width)}.dp, height = ${num(s.height)}.dp)`);
    const shadow = (s.effects || []).find((e) => e.visible && e.type === 'drop-shadow');
    if (shadow) mods.push(`.shadow(elevation = ${num((shadow.blur ?? 4) / 2)}.dp, shape = ${shape})`);
    if (s.opacity !== undefined && s.opacity < 1) mods.push(`.alpha(${num(s.opacity)}f)`);
    if (s.rotation) mods.push(`.rotate(${num(s.rotation)}f)`);
    if (s.clipContent || radius || s.type === 'ellipse') mods.push(`.clip(${shape})`);
    if (fill) mods.push(`.background(${kColor(fill.color, fill.opacity)}, ${shape})`);
    if (stroke) mods.push(`.border(${num(stroke.width)}.dp, ${kColor(stroke.color, stroke.opacity)}, ${shape})`);
    const modifier = `Modifier\n${mods.map((m) => `${pad}        ${m}`).join('\n')}`;
    if (s.type === 'text' || s.type === 'text-path') {
      const align = s.textAlign === 'center' ? 'TextAlign.Center' : s.textAlign === 'right' ? 'TextAlign.End' : 'TextAlign.Start';
      return `${pad}Text(\n${pad}    text = ${JSON.stringify(s.text || '')},\n${pad}    fontSize = ${num(s.fontSize || 16)}.sp,\n${pad}    fontWeight = ${kWeight(s.fontWeight)},\n${pad}    textAlign = ${align},${parseHex(s.fill) ? `\n${pad}    color = ${kColor(s.fill)},` : ''}\n${pad}    modifier = Modifier${parent && !isFlow(parent) ? `.offset(x = ${num(s.x - parent.x)}.dp, y = ${num(s.y - parent.y)}.dp)` : ''}.width(${num(s.width)}.dp)\n${pad})`;
    }
    if (s.type === 'image') {
      const src = s.imageUrl?.startsWith('data:') ? '' : s.imageUrl || '';
      return `${pad}AsyncImage(\n${pad}    model = ${JSON.stringify(src)},\n${pad}    contentDescription = ${JSON.stringify(s.name || 'imagem')},\n${pad}    contentScale = ContentScale.Crop,\n${pad}    modifier = ${modifier}\n${pad})`;
    }
    if (!kids.length) return `${pad}Box(modifier = ${modifier})`;
    if (isFlow(s)) {
      const p = pads(s);
      const horizontal = s.layoutFlow === 'horizontal';
      const comp = horizontal ? 'Row' : 'Column';
      const arr = horizontal ? 'horizontalArrangement' : 'verticalArrangement';
      const al = horizontal ? `verticalAlignment = Alignment.${{ start: 'Top', center: 'CenterVertically', end: 'Bottom' }[alignV(s)]}` : `horizontalAlignment = Alignment.${{ start: 'Start', center: 'CenterHorizontally', end: 'End' }[alignH(s)]}`;
      return `${pad}${comp}(\n${pad}    modifier = ${modifier}\n${pad}        .padding(start = ${num(p.l)}.dp, top = ${num(p.t)}.dp, end = ${num(p.r)}.dp, bottom = ${num(p.b)}.dp),\n${pad}    ${arr} = Arrangement.spacedBy(${num(s.layoutGap ?? 0)}.dp),\n${pad}    ${al}\n${pad}) {\n${kids.map((k) => render(k, s, depth + 1)).join('\n')}\n${pad}}`;
    }
    return `${pad}Box(modifier = ${modifier}) {\n${kids.map((k) => render(k, s, depth + 1)).join('\n')}\n${pad}}`;
  };
  const name = componentName(root.name || 'Tela');
  return `import androidx.compose.foundation.background\nimport androidx.compose.foundation.border\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.shape.*\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.*\nimport androidx.compose.ui.draw.*\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.text.style.TextAlign\nimport androidx.compose.ui.unit.*\n\n@Composable\nfun ${name}() {\n${render(root, null, 1)}\n}\n`;
}

/** Gera o código para qualquer destino (inclui SwiftUI e Compose). */
export const generateCodeAny = (target: CodeTarget, all: Shape[], root: Shape): string =>
  target === 'swiftui' ? generateSwiftUI(all, root) : target === 'compose' ? generateCompose(all, root) : generateCode(target, all, root);
