import type { EffectItem, FillItem, GradientStop, Page, Shape, StrokeItem } from './types';

/** Resultado da conversão de um arquivo/nó do Figma para o modelo do Design. */
export interface FigmaImportResult {
  pages: Page[];
  shapes: Shape[];
  /** shape.id -> imageRef do Figma (preenchidos depois por applyImageUrls) */
  imageRefs: Record<string, string>;
  warnings: string[];
  stats: { nodes: number; imported: number; skipped: number };
}

export interface FigmaConvertOptions {
  /** Tag única para ids (testes); padrão: aleatório */
  idGen?: () => string;
  /** Quando o JSON é um nó solto (não um arquivo), shapes vão para esta página */
  fallbackPageId?: string;
  /** Posição onde um nó solto é colocado (o canto do conjunto importado) */
  offset?: { x: number; y: number };
}

type FNode = Record<string, any>;

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0').toUpperCase();
export const figmaColor = (c: { r: number; g: number; b: number }): string => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

/** Ângulo CSS (0 = para cima, 90 = esquerda→direita) a partir das alças do gradiente linear, considerando a proporção do nó. */
export function linearAngleFromHandles(handles: Array<{ x: number; y: number }> | undefined, width: number, height: number): number {
  if (!handles || handles.length < 2) return 90;
  const dx = (handles[1].x - handles[0].x) * width;
  const dy = (handles[1].y - handles[0].y) * height;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/** Extrai a chave do arquivo e o node-id de uma URL do Figma (file/design/proto). */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  const m = (url || '').trim().match(/figma\.com\/(?:file|design|proto|board|make)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const node = (url.match(/[?&]node-id=([^&#]+)/) || [])[1];
  // na URL o node-id vem como 12-345; na API é 12:345
  return { fileKey: m[1], nodeId: node ? decodeURIComponent(node).replace(/-/g, ':') : undefined };
}

function paintsToFills(paints: any[] | undefined, w: number, h: number): { fills: FillItem[]; imageRef?: string; imageFit?: Shape['imageFit'] } {
  const fills: FillItem[] = [];
  let imageRef: string | undefined;
  let imageFit: Shape['imageFit'];
  let n = 0;
  for (const p of paints || []) {
    if (p.visible === false) continue;
    const opacity = (p.opacity ?? 1) * (p.type === 'SOLID' ? p.color?.a ?? 1 : 1);
    const id = `f${n++}`;
    if (p.type === 'SOLID' && p.color) {
      fills.push({ id, color: figmaColor(p.color), opacity, visible: true, type: 'solid' });
    } else if (String(p.type).startsWith('GRADIENT_') && Array.isArray(p.gradientStops) && p.gradientStops.length >= 2) {
      const stops: GradientStop[] = p.gradientStops.map((s: any) => ({ position: s.position, color: figmaColor(s.color), opacity: (s.color.a ?? 1) * (p.opacity ?? 1) }));
      const type = p.type === 'GRADIENT_RADIAL' ? 'radial' : p.type === 'GRADIENT_ANGULAR' ? 'angular' : p.type === 'GRADIENT_DIAMOND' ? 'diamond' : 'linear';
      fills.push({
        id,
        color: stops[0].color,
        opacity: 1,
        visible: true,
        type,
        gradientStops: stops,
        ...(type === 'linear' ? { gradientAngle: linearAngleFromHandles(p.gradientHandlePositions, w, h) } : {}),
      });
    } else if (p.type === 'IMAGE' && p.imageRef) {
      imageRef = p.imageRef;
      imageFit = p.scaleMode === 'FIT' ? 'fit' : p.scaleMode === 'STRETCH' ? 'stretch' : 'fill';
    }
  }
  return { fills, imageRef, imageFit };
}

function effectsOf(node: FNode): EffectItem[] {
  const out: EffectItem[] = [];
  let n = 0;
  for (const e of node.effects || []) {
    if (e.visible === false) continue;
    const base = { id: `e${n++}`, color: e.color ? figmaColor(e.color) : '#000000', opacity: e.color?.a ?? 0.25, x: e.offset?.x ?? 0, y: e.offset?.y ?? 0, blur: e.radius ?? 0, spread: e.spread ?? 0, visible: true };
    if (e.type === 'DROP_SHADOW') out.push({ ...base, type: 'drop-shadow' });
    else if (e.type === 'INNER_SHADOW') out.push({ ...base, type: 'inner-shadow' });
    else if (e.type === 'LAYER_BLUR') out.push({ ...base, type: 'layer-blur', blur: e.radius ?? 0 });
    else if (e.type === 'BACKGROUND_BLUR') out.push({ ...base, type: 'background-blur', blur: e.radius ?? 0 });
  }
  return out;
}

const H_CONSTRAINT: Record<string, Shape['constraintH']> = { LEFT: 'start', RIGHT: 'end', CENTER: 'center', LEFT_RIGHT: 'stretch', SCALE: 'scale' };
const V_CONSTRAINT: Record<string, Shape['constraintV']> = { TOP: 'start', BOTTOM: 'end', CENTER: 'center', TOP_BOTTOM: 'stretch', SCALE: 'scale' };

function layoutAlign(primary: string | undefined, counter: string | undefined, horizontal: boolean): Shape['layoutAlign'] {
  const norm = (v?: string) => (v === 'CENTER' ? 'c' : v === 'MAX' ? 'e' : 's'); // SPACE_BETWEEN cai em início
  const main = norm(primary);
  const cross = norm(counter);
  const h = horizontal ? main : cross;
  const v = horizontal ? cross : main;
  const map: Record<string, Shape['layoutAlign']> = {
    ss: 'top-left', cs: 'top-center', es: 'top-right', sc: 'left', cc: 'center', ec: 'right', se: 'bottom-left', ce: 'bottom-center', ee: 'bottom-right',
  };
  return map[`${h}${v}`];
}

const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION']);
const UNSUPPORTED = new Set(['SLICE', 'STICKY', 'SHAPE_WITH_TEXT', 'CONNECTOR', 'TABLE', 'TABLE_CELL', 'WIDGET', 'EMBED', 'LINK_UNFURL', 'STAMP', 'HIGHLIGHT', 'WASHI_TAPE', 'CODE_BLOCK', 'MEDIA']);

/** Quebra o texto por palavras para a largura (o canvas não quebra linha sozinho). */
function wrap(text: string, width: number, fontSize: number): string {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  return text
    .split('\n')
    .map((par) => {
      const lines: string[] = [];
      let line = '';
      for (const word of par.split(/\s+/).filter(Boolean)) {
        if (line && (line + ' ' + word).length > perLine) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
      return lines.join('\n');
    })
    .join('\n');
}

/** Converte um arquivo (GET /v1/files), uma resposta de nós (GET /v1/files/:key/nodes) ou um nó solto para o Design. */
export function convertFigmaDocument(json: any, options: FigmaConvertOptions = {}): FigmaImportResult {
  const idGen = options.idGen || (() => crypto.randomUUID());
  const warnings = new Set<string>();
  const pages: Page[] = [];
  const shapes: Shape[] = [];
  const imageRefs: Record<string, string> = {};
  const idMap = new Map<string, string>(); // id do Figma -> id do Design
  const pendingLinks: Array<{ shapeId: string; targetFigmaId: string }> = [];
  const stats = { nodes: 0, imported: 0, skipped: 0 };
  let z = 1;

  const convertNode = (node: FNode, pageId: string, parentId: string | undefined, parent: FNode | undefined): void => {
    stats.nodes++;
    if (!node || typeof node !== 'object') return;
    if (UNSUPPORTED.has(node.type)) {
      stats.skipped++;
      warnings.add(`Elementos do tipo ${node.type} não são suportados e foram ignorados`);
      return;
    }
    const box = node.absoluteBoundingBox || node.absoluteRenderBounds;
    if (!box && node.type !== 'GROUP') {
      stats.skipped++;
      return;
    }
    const type = node.type as string;
    const id = idGen();
    idMap.set(node.id, id);

    // Tamanho sem rotação: `size` é o tamanho do nó; o centro vem do bbox absoluto (que já inclui a rotação)
    const size = node.size || (box ? { x: box.width, y: box.height } : { x: 0, y: 0 });
    const rotationDeg = node.rotation ? Math.round(((-node.rotation * 180) / Math.PI) * 100) / 100 : 0;
    const cx = box ? box.x + box.width / 2 : 0;
    const cy = box ? box.y + box.height / 2 : 0;
    const w = rotationDeg ? size.x : box?.width ?? size.x;
    const h = rotationDeg ? size.y : box?.height ?? size.y;
    const x = rotationDeg ? cx - w / 2 : box?.x ?? 0;
    const y = rotationDeg ? cy - h / 2 : box?.y ?? 0;

    const { fills, imageRef, imageFit } = paintsToFills(node.fills, w, h);
    const strokes: StrokeItem[] = [];
    for (const [i, s] of (node.strokes || []).entries()) {
      if (s.visible === false || s.type !== 'SOLID' || !s.color) continue;
      strokes.push({ id: `s${i}`, color: figmaColor(s.color), opacity: (s.opacity ?? 1) * (s.color.a ?? 1), visible: true, width: node.strokeWeight ?? 1 });
    }
    const radii: number[] | undefined = node.rectangleCornerRadii;

    const base: any = {
      id,
      name: node.name || type,
      pageId,
      parentId,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: Math.round(w * 100) / 100,
      height: Math.round(h * 100) / 100,
      rotation: rotationDeg,
      opacity: node.opacity ?? 1,
      fill: fills[0]?.color || 'transparent',
      stroke: strokes[0]?.color || 'none',
      strokeWidth: strokes.length ? node.strokeWeight ?? 1 : 0,
      zIndex: z++,
      visible: node.visible !== false,
      locked: node.locked === true || undefined,
      ...(fills.length ? { fills } : {}),
      ...(strokes.length ? { strokes } : {}),
      ...(strokes.length && node.strokeAlign ? { strokePosition: node.strokeAlign === 'OUTSIDE' ? 'outside' : node.strokeAlign === 'CENTER' ? 'center' : 'inside' } : {}),
      ...(strokes.length && node.strokeDashes?.length ? { strokeStyle: 'dashed', strokeDash: node.strokeDashes[0], strokeGap: node.strokeDashes[1] ?? node.strokeDashes[0] } : {}),
      ...(node.cornerRadius ? { cornerRadius: node.cornerRadius } : {}),
      ...(radii && radii.some((r) => r !== radii[0]) ? { independentCorners: true, topLeftRadius: radii[0], topRightRadius: radii[1], bottomRightRadius: radii[2], bottomLeftRadius: radii[3] } : {}),
      ...(node.isMask ? { isMask: true } : {}),
    };
    const fx = effectsOf(node);
    if (fx.length) base.effects = fx;
    if (parent?.layoutMode === 'NONE' || parent?.constraints || node.constraints) {
      const c = node.constraints;
      if (c && parentId) {
        base.constraintH = H_CONSTRAINT[c.horizontal];
        base.constraintV = V_CONSTRAINT[c.vertical];
      }
    }
    // Interações de protótipo: ir para outro frame
    const destination = node.reactions?.find((r: any) => r.action?.destinationId || r.actions?.[0]?.destinationId);
    const destId = destination?.action?.destinationId || destination?.actions?.[0]?.destinationId || node.transitionNodeID;
    if (destId) pendingLinks.push({ shapeId: id, targetFigmaId: destId });

    const pushShape = (s: Record<string, any>) => {
      shapes.push({ ...base, ...s } as Shape);
      stats.imported++;
    };
    const geometryPath = (geoms: any[] | undefined) => (geoms || []).map((g) => g.path).filter(Boolean).join(' ');

    if (type === 'TEXT') {
      const st = node.style || {};
      const fontSize = st.fontSize || 16;
      const raw = String(node.characters ?? '');
      const wrapped = node.style?.textAutoResize === 'WIDTH_AND_HEIGHT' || node.textAutoResize === 'WIDTH_AND_HEIGHT' ? raw : wrap(raw, w, fontSize);
      pushShape({
        type: 'text',
        text: wrapped,
        fontSize,
        fontFamily: st.fontFamily,
        fontWeight: st.fontWeight,
        fontStyle: st.italic ? 'italic' : 'normal',
        letterSpacing: st.letterSpacing ? Math.round(st.letterSpacing * 100) / 100 : undefined,
        lineHeight: st.lineHeightPx ? Math.round(st.lineHeightPx * 100) / 100 : undefined,
        textAlign: st.textAlignHorizontal === 'CENTER' ? 'center' : st.textAlignHorizontal === 'RIGHT' ? 'right' : 'left',
        textAlignVertical: st.textAlignVertical === 'CENTER' ? 'middle' : st.textAlignVertical === 'BOTTOM' ? 'bottom' : 'top',
        textCase: st.textCase === 'UPPER' ? 'uppercase' : st.textCase === 'LOWER' ? 'lowercase' : st.textCase === 'TITLE' ? 'title' : 'none',
        textDecoration: st.textDecoration === 'UNDERLINE' ? 'underline' : st.textDecoration === 'STRIKETHROUGH' ? 'line-through' : 'none',
        fill: fills[0]?.color || '#000000',
        stroke: 'none',
        strokeWidth: 0,
        strokes: undefined,
      });
      if (st.fontFamily) warnings.add(`Fonte usada: ${st.fontFamily} (precisa estar instalada para ficar igual)`);
      return;
    }

    if (FRAME_TYPES.has(type) || type === 'GROUP') {
      const isGroup = type === 'GROUP';
      const auto = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
      const frame: Record<string, any> = {
        type: isGroup ? 'group' : type === 'SECTION' ? 'section' : 'frame',
        ...(type === 'COMPONENT' ? { isComponent: true } : {}),
        ...(node.clipsContent ? { clipContent: true } : {}),
        ...(auto
          ? {
              hasAutoLayout: true,
              layoutFlow: node.layoutMode === 'HORIZONTAL' ? 'horizontal' : 'vertical',
              layoutGap: node.itemSpacing ?? 0,
              independentPadding: true,
              paddingTop: node.paddingTop ?? 0,
              paddingRight: node.paddingRight ?? 0,
              paddingBottom: node.paddingBottom ?? 0,
              paddingLeft: node.paddingLeft ?? 0,
              layoutAlign: layoutAlign(node.primaryAxisAlignItems, node.counterAxisAlignItems, node.layoutMode === 'HORIZONTAL'),
              widthMode: node.layoutSizingHorizontal === 'HUG' ? 'hug' : node.layoutSizingHorizontal === 'FILL' ? 'fill' : 'fixed',
              heightMode: node.layoutSizingVertical === 'HUG' ? 'hug' : node.layoutSizingVertical === 'FILL' ? 'fill' : 'fixed',
            }
          : {}),
      };
      // filhos de um auto layout herdam o modo de dimensionamento (fill/hug) do próprio nó
      if (parent && (parent.layoutMode === 'HORIZONTAL' || parent.layoutMode === 'VERTICAL')) {
        if (node.layoutSizingHorizontal === 'FILL') frame.widthMode = 'fill';
        if (node.layoutSizingVertical === 'FILL') frame.heightMode = 'fill';
      }
      if (type === 'COMPONENT_SET') frame.name = node.name;
      if (isGroup && !box) {
        // grupo sem caixa: usa a união dos filhos (calculada pelo canvas); mantém dimensões zeradas
        frame.width = 0;
        frame.height = 0;
      }
      pushShape(frame);
      // preenchimento de imagem num frame: camada de imagem no fundo
      if (imageRef) {
        const imgId = idGen();
        shapes.push({ ...base, id: imgId, name: 'Imagem de fundo', type: 'image', parentId: id, zIndex: z++, fill: '#333333', fills: undefined, strokes: undefined, stroke: 'none', strokeWidth: 0, effects: undefined, imageFit } as Shape);
        imageRefs[imgId] = imageRef;
      }
      const kids: FNode[] = node.children || [];
      for (const child of kids) {
        convertNode(child, pageId, id, node);
        // variantes de um conjunto de componentes
        if (type === 'COMPONENT_SET' && child.type === 'COMPONENT') {
          const sh = shapes.find((s) => s.id === idMap.get(child.id));
          if (sh) {
            sh.variantGroup = node.name;
            sh.variantName = child.name;
          }
        }
      }
      return;
    }

    if (imageRef && (type === 'RECTANGLE' || type === 'ELLIPSE' || type === 'VECTOR')) {
      pushShape({ type: 'image', imageFit, fill: '#333333', fills: undefined });
      imageRefs[id] = imageRef;
      return;
    }

    if (type === 'RECTANGLE') {
      pushShape({ type: 'rect' });
    } else if (type === 'ELLIPSE' && !node.arcData?.endingAngle) {
      pushShape({ type: 'ellipse' });
    } else if (type === 'LINE') {
      const s = strokes[0];
      pushShape({ type: 'line', height: 0, stroke: s?.color || '#000000', strokeWidth: node.strokeWeight ?? 1, fill: 'transparent', fills: undefined });
    } else {
      // VECTOR, BOOLEAN_OPERATION, STAR, REGULAR_POLYGON, ELLIPSE com arco: usa a geometria do Figma
      const fillPath = geometryPath(node.fillGeometry);
      const strokePath = fillPath ? '' : geometryPath(node.strokeGeometry);
      const d = fillPath || strokePath;
      if (!d) {
        stats.skipped++;
        warnings.add(`Formas vetoriais sem geometria foram ignoradas (importe com geometry=paths)`);
        return;
      }
      pushShape({
        type: 'path',
        pathD: d,
        pathW: Math.max(1, w),
        pathH: Math.max(1, h),
        // contorno sem preenchimento vira preenchimento com a cor do traço
        ...(strokePath && strokes[0] ? { fill: strokes[0].color, fills: [{ id: 'f0', color: strokes[0].color, opacity: strokes[0].opacity, visible: true, type: 'solid' }], stroke: 'none', strokeWidth: 0, strokes: undefined } : {}),
      });
    }
  };

  // --- localizar a(s) página(s) no JSON ---
  const documents: Array<{ canvas: FNode; name: string }> = [];
  const root = json?.document || json;
  if (root?.type === 'DOCUMENT' && Array.isArray(root.children)) {
    for (const c of root.children) if (c.type === 'CANVAS') documents.push({ canvas: c, name: c.name || 'Página' });
  } else if (json?.nodes && typeof json.nodes === 'object') {
    // resposta de /nodes: um conjunto de nós soltos
    const loose = Object.values(json.nodes as Record<string, any>).map((n: any) => n?.document).filter(Boolean);
    documents.push({ canvas: { type: 'CANVAS', name: json.name || 'Importado do Figma', children: loose }, name: json.name || 'Importado do Figma' });
  } else if (root?.type === 'CANVAS') {
    documents.push({ canvas: root, name: root.name || 'Página' });
  } else if (root && typeof root === 'object' && root.type) {
    documents.push({ canvas: { type: 'CANVAS', name: root.name || 'Importado do Figma', children: [root] }, name: root.name || 'Importado do Figma' });
  }
  if (documents.length === 0) {
    warnings.add('JSON não reconhecido como arquivo, nós ou elemento do Figma');
  }

  documents.forEach((d, i) => {
    const pageId = documents.length === 1 && options.fallbackPageId ? options.fallbackPageId : `figma-page-${Date.now().toString(36)}-${i}`;
    if (!(documents.length === 1 && options.fallbackPageId)) pages.push({ id: pageId, name: d.name });
    for (const child of d.canvas.children || []) convertNode(child, pageId, undefined, undefined);
  });

  // ligar protótipos (destino precisa ter sido importado)
  for (const link of pendingLinks) {
    const target = idMap.get(link.targetFigmaId);
    const sh = shapes.find((s) => s.id === link.shapeId);
    if (sh && target) sh.prototypeLink = { targetId: target };
  }

  if (options.offset) {
    for (const s of shapes) {
      s.x += options.offset.x;
      s.y += options.offset.y;
    }
  }
  return { pages, shapes, imageRefs, warnings: [...warnings], stats };
}

/** Preenche imageUrl dos shapes de imagem a partir do mapa imageRef -> URL/data URL. Imagens sem URL ficam como bloco cinza. */
export function applyImageUrls(result: FigmaImportResult, urls: Record<string, string>): { shapes: Shape[]; missing: number } {
  let missing = 0;
  const shapes = result.shapes.map((s) => {
    const ref = result.imageRefs[s.id];
    if (!ref) return s;
    const url = urls[ref];
    if (!url) {
      missing++;
      return s;
    }
    return { ...s, imageUrl: url };
  });
  return { shapes, missing };
}
