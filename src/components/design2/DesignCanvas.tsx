import React, { useRef, useState, useEffect } from 'react';
import type { Point, Shape, StrokeItem, ToolId } from './types';
import { cssGradient, isGradientFill, isHtmlGradient, linearVector, pathFromPoints, sortStops } from './gradient';
import { svgEffectFilter } from './effectsFilter';
import { gridBands, gridSnapBoxes } from './layoutGrid';
import { measureBetween } from './measure';
import { duplicateShapes } from './duplicate';
import { dashArrayOf } from './dash';
import { COLOR_BLIND } from './colorBlind';
import { hasAdjust, imageFilterMarkup } from './imageFilter';
import { protoArrows } from './protoArrows';
import { CAP_HEIGHT } from './textFit';
import { pathDOf } from './textOnPath';
import { featureSettings, variationSettings } from './fontCss';
import { adjustRuns, applyRunStyle, lineSegments, normalizeRuns, toggleRunStyle, isFullyStyled, type TextRun } from './richText';
import { patternTile } from './pattern';
import { variableWidthPath } from './widthProfile';
import { roundedPolygonPath } from './roundPoly';
import { ellipseArcPath, hasArc } from './arc';
import { capGeometry, capSize, pathEndDirections } from './caps';
import { flattenVector, bboxOfVector, nearestSegment, pathFromVector, removeNode, setHandle, splitSegment, toggleNodeSmooth } from './vector';
import { angleDeg, rotateShapes, snapAngle } from './rotate';
import { computeSnap, roundBoxToPixels, unionBox, type GapMark, type Guide } from './snap';
import { guideBoxes, newGuideId, RULER_SIZE, rulerOrigin, rulerTicks, selectionRange, snapGuidePos, type RulerGuide } from './rulers';
import { descendantIds, reparentDropped, resizeDescendants } from './constraints';
import { buildExportSvg, collectSubtree, type ExportBounds } from './exportDesign';
import { relayoutAll } from './autoLayout';
import { MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react';

export interface CanvasViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DesignCanvasProps {
  shapes: Shape[];
  selectedId: string | null;
  selectedIds?: string[];
  tool: ToolId;
  readOnly: boolean;
  accentColor?: string;
  bgCanvas?: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  targetCamera?: { x: number; y: number; zoom?: number; timestamp?: number } | null;
  /** Telas geradas pela IA aguardando aceite/regeração (botões acima do frame) */
  aiReview?: Array<{ id: string; busy?: boolean; canUndo?: boolean }>;
  /** Frames em que a IA está trabalhando: contorno pulsando */
  glowIds?: Set<string>;
  onAiAccept?: (frameId: string) => void;
  onAiRegenerate?: (frameId: string) => void;
  /** Volta para a tela de antes da regeração */
  onAiUndo?: (frameId: string) => void;
  /** Menu "⋯" do frame de topo selecionado */
  onFrameRegenerate?: (frameId: string) => void;
  onFrameDelete?: (frameId: string) => void;
  isEffectiveDark?: boolean;
  onSelect: (id: string | null) => void;
  onSelectMultiple?: (ids: string[]) => void;
  onShapesChange: (shapes: Shape[], commit: boolean) => void;
  onToolUsed: () => void;
  onContextMenuShape?: (shape: Shape, clientX: number, clientY: number) => void;
  onContextMenuCanvas?: (clientX: number, clientY: number) => void;
  /** Encaixe nas bordas/centros dos outros shapes (Cmd/Ctrl ao arrastar desativa). Padrão: ligado */
  snapEnabled?: boolean;
  showGrid?: boolean;
  /** posição e tamanho sempre inteiros ao mover/redimensionar */
  pixelSnap?: boolean;
  /** mostra a grade de pixels em zoom alto (≥ 800%) */
  pixelGrid?: boolean;
  /** simulação de daltonismo (chave de `COLOR_BLIND`) aplicada ao canvas todo */
  colorBlind?: string;
  /** só contornos (Cmd/Ctrl+Y): esconde preenchimentos, imagens e efeitos para ver a estrutura */
  outlineMode?: boolean;
  /** mede automaticamente a distância até o elemento sob o mouse (Modo Dev) */
  redlines?: boolean;
  /** esconde grades de layout e demais auxiliares visuais (usado na exportação) */
  hideOverlays?: boolean;
  gridSize?: number;
  showRulers?: boolean;
  /** Guias do usuário (arrastadas das réguas), persistidas por página */
  userGuides?: RulerGuide[];
  onUserGuidesChange?: (guides: RulerGuide[]) => void;
  showUserGuides?: boolean;
  /** Réguas relativas ao frame da seleção (0 no canto do frame) */
  rulerRelative?: boolean;
  /** Posição do ponteiro em coordenadas do canvas (para colaboração) */
  onPointerMove?: (x: number, y: number) => void;
  /** Cursores de outros participantes da sala */
  remoteCursors?: Array<{ id: string; name: string; color: string; x: number; y: number }>;
}

/** Caixa do caminho incluindo o bojo das curvas (alças). */
const bboxOfPath = (s: { points?: Point[]; pathHandles?: Shape['pathHandles']; closed?: boolean; smooth?: boolean }, points = s.points || [], handles = s.pathHandles) =>
  bboxOfVector(points, handles, !!s.closed, !!s.smooth);

function bboxOfPoints(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function computeGroupBounds(shapes: Shape[]): Map<string, { x: number; y: number; width: number; height: number }> {
  const bounds = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const s of shapes) {
    if (s.type !== 'group') continue;
    const children = shapes.filter((c) => c.parentId === s.id);
    if (children.length === 0) continue;
    const minX = Math.min(...children.map((c) => c.x));
    const minY = Math.min(...children.map((c) => c.y));
    const maxX = Math.max(...children.map((c) => c.x + c.width));
    const maxY = Math.max(...children.map((c) => c.y + c.height));
    bounds.set(s.id, { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }
  return bounds;
}

/** Raio limitado à metade do menor lado (raio 999 = pílula; sem isso o SVG desenha elipses). */
const capRadius = (w: number, h: number, r?: number) => Math.max(0, Math.min(r || 0, w / 2, h / 2));

/** Contorno do shape como elemento SVG (para clipPath de máscara e de preenchimentos HTML). */
function outlineGeometry(m: Shape): React.ReactNode {
  if (m.type === 'ellipse') {
    const arc = { start: m.arcStart, end: m.arcEnd, inner: m.arcInner };
    if (hasArc(arc)) return <path d={ellipseArcPath(m.x + m.width / 2, m.y + m.height / 2, m.width / 2, m.height / 2, arc)} fillRule="evenodd" />;
    return <ellipse cx={m.x + m.width / 2} cy={m.y + m.height / 2} rx={m.width / 2} ry={m.height / 2} />;
  }
  if (m.type === 'polygon') {
    const pts = getPolygonPoints(m.x + m.width / 2, m.y + m.height / 2, Math.min(m.width, m.height) / 2, m.polygonSides ?? 3);
    const rd = roundedPolygonPath(pts, m.cornerRadius || 0);
    return rd ? <path d={rd} /> : <polygon points={pts} />;
  }
  if (m.type === 'star') {
    const ro = Math.min(m.width, m.height) / 2;
    const pts = getStarPoints(m.x + m.width / 2, m.y + m.height / 2, ro, ro * (m.starInnerRatio ?? 0.5), m.starPoints ?? 5);
    const rd = roundedPolygonPath(pts, m.cornerRadius || 0);
    return rd ? <path d={rd} /> : <polygon points={pts} />;
  }
  if (m.type === 'path') return <path d={m.pathD} transform={`translate(${m.x}, ${m.y}) scale(${m.width / (m.pathW || 1)}, ${m.height / (m.pathH || 1)})`} />;
  return <rect x={m.x} y={m.y} width={m.width} height={m.height} rx={capRadius(m.width, m.height, m.cornerRadius)} />;
}

function getRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number
): string {
  const maxR = Math.min(w, h) / 2;
  const ctl = Math.max(0, Math.min(maxR, tl));
  const ctr = Math.max(0, Math.min(maxR, tr));
  const cbr = Math.max(0, Math.min(maxR, br));
  const cbl = Math.max(0, Math.min(maxR, bl));

  return `
    M ${x + ctl},${y}
    H ${x + w - ctr}
    A ${ctr},${ctr} 0 0 1 ${x + w},${y + ctr}
    V ${y + h - cbr}
    A ${cbr},${cbr} 0 0 1 ${x + w - cbr},${y + h}
    H ${x + cbl}
    A ${cbl},${cbl} 0 0 1 ${x},${y + h - cbl}
    V ${y + ctl}
    A ${ctl},${ctl} 0 0 1 ${x + ctl},${y}
    Z
  `.trim();
}

function getStarPoints(cx: number, cy: number, rOuter: number, rInner: number, points = 5): string {
  const step = Math.PI / points;
  const pts: string[] = [];
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = i * step - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function makeShape(type: Shape['type'], x: number, y: number, zIndex: number, accentColor: string): Shape {
  const isRect = type === 'rect';
  const isFrame = type === 'frame';
  const isSection = type === 'section';
  const isSlice = type === 'slice';
  const isLine = type === 'line' || type === 'arrow';
  const isPen = type === 'pen' || type === 'pencil';
  const isText = type === 'text' || type === 'text-path';
  const isComment = type === 'comment' || type === 'annotation' || type === 'measurement';

  let name = type as string;
  if (isRect) name = `Rectangle ${Math.floor(100 + Math.random() * 900)}`;
  else if (isFrame) name = `Frame ${Math.floor(100 + Math.random() * 900)}`;
  else if (isSection) name = `Section ${Math.floor(10 + Math.random() * 90)}`;
  else if (isSlice) name = `Slice ${Math.floor(10 + Math.random() * 90)}`;
  else if (type === 'ellipse') name = `Ellipse ${Math.floor(100 + Math.random() * 900)}`;
  else if (type === 'line') name = `Line ${Math.floor(10 + Math.random() * 90)}`;
  else if (type === 'arrow') name = `Arrow ${Math.floor(10 + Math.random() * 90)}`;
  else if (type === 'polygon') name = `Polygon ${Math.floor(10 + Math.random() * 90)}`;
  else if (type === 'star') name = `Star ${Math.floor(10 + Math.random() * 90)}`;
  else if (isText) name = `Text`;
  else if (isPen) name = `Vector`;
  else if (isComment) name = `Comment`;

  let fill = '#D9D9D9';
  let stroke = 'transparent';
  let strokeWidth = 1;

  if (isLine || isPen) {
    fill = 'none';
    stroke = accentColor;
    strokeWidth = 2;
  } else if (isFrame) {
    fill = '#2a2a2a';
    stroke = 'transparent';
  } else if (isSection) {
    fill = 'rgba(255, 255, 255, 0.03)';
    stroke = accentColor;
    strokeWidth = 1;
  } else if (isSlice) {
    fill = 'transparent';
    stroke = '#0d99ff';
    strokeWidth = 1;
  } else if (isText) {
    fill = '#ffffff';
    stroke = 'none';
  } else if (isComment) {
    fill = accentColor;
    stroke = '#ffffff';
    strokeWidth = 1.5;
  }

  return {
    id: crypto.randomUUID(),
    name,
    type,
    x,
    y,
    width: 0,
    height: 0,
    rotation: 0,
    fill,
    stroke,
    strokeWidth,
    opacity: 1,
    cornerRadius: isSection ? 8 : 0,
    text: isText ? 'Texto' : isComment ? 'Novo comentário' : undefined,
    fontSize: isText ? 18 : 12,
    fontFamily: isText ? 'Inter' : undefined,
    fontWeight: isText ? 400 : undefined,
    textAlign: isText ? 'left' : undefined,
    textAlignVertical: isText ? 'top' : undefined,
    lineHeight: isText ? 'Auto' : undefined,
    letterSpacing: isText ? '0%' : undefined,
    points: isPen ? [{ x, y }] : undefined,
    polygonSides: type === 'polygon' ? 3 : undefined,
    starPoints: type === 'star' ? 5 : undefined,
    starInnerRatio: type === 'star' ? 0.5 : undefined,
    zIndex,
    visible: true,
  };
}

function getPolygonPoints(cx: number, cy: number, r: number, sides: number): string {
  const n = Math.max(3, Math.round(sides));
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

type DragMode =
  | { kind: 'none' }
  | { kind: 'pan'; startClientX: number; startClientY: number; origPanX: number; origPanY: number }
  | { kind: 'marquee'; startX: number; startY: number; currentX: number; currentY: number; isAdditive: boolean }
  | { kind: 'create'; shapeId: string; startX: number; startY: number }
  | { kind: 'pen'; shapeId: string }
  | {
      kind: 'move';
      shapeId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      childOrigins: { id: string; x: number; y: number }[];
      /** ids selecionados (os descendentes também se movem, mas não entram no encaixe) */
      rootIds: string[];
    }
  | { kind: 'node'; shapeId: string; index: number }
  | { kind: 'guide'; id: string; axis: 'x' | 'y' }
  | { kind: 'resize'; shapeId: string; handle: string; orig: Shape; descendants: Shape[] }
  | { kind: 'handle'; shapeId: string; index: number; which: 'in' | 'out' }
  | { kind: 'pen-node'; shapeId: string; index: number }
  | { kind: 'rotate'; ids: string[]; pivot: Point; startAngle: number; orig: Shape[]; baseRotation: number; single: boolean }
  | { kind: 'radius'; shapeId: string; startX: number; startY: number; origRadius: number };

export default function DesignCanvas({
  shapes,
  selectedId,
  selectedIds,
  tool,
  readOnly,
  accentColor = '#0d99ff',
  bgCanvas = '#1e1e1e',
  zoom = 0.5,
  onZoomChange,
  onViewportChange,
  targetCamera,
  aiReview,
  glowIds,
  onAiAccept,
  onAiRegenerate,
  onAiUndo,
  onFrameRegenerate,
  onFrameDelete,
  isEffectiveDark = true,
  onSelect,
  onSelectMultiple,
  onShapesChange,
  onToolUsed,
  onContextMenuShape,
  onContextMenuCanvas,
  snapEnabled = true,
  showGrid = false,
  pixelSnap = false,
  pixelGrid = true,
  hideOverlays = false,
  redlines = false,
  outlineMode = false,
  colorBlind,
  gridSize = 10,
  showRulers = false,
  userGuides = [],
  onUserGuidesChange,
  showUserGuides = true,
  rulerRelative = true,
  onPointerMove,
  remoteCursors,
}: DesignCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPanState] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  // Câmera "viva": pan/zoom durante a navegação mudam só o transform do SVG (sem re-renderizar os shapes);
  // o React só é atualizado quando o gesto para (flushNav)
  const camRef = useRef({ x: 120, y: 80, z: zoom });
  const lastPropZoom = useRef(zoom);
  if (lastPropZoom.current !== zoom) {
    lastPropZoom.current = zoom;
    camRef.current.z = zoom;
  }
  const gRef = useRef<SVGGElement>(null);
  const cullRef = useRef<{ x0: number; x1: number; y0: number; y1: number } | null>(null);
  const lodSnapCache = useRef(new Map<string, { sig: string; href: string; b: ExportBounds }>());
  const navTimers = useRef<{ idle?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout> }>({});
  const onZoomRef = useRef(onZoomChange);
  onZoomRef.current = onZoomChange;
  const setPan = (v: { x: number; y: number } | ((p: { x: number; y: number }) => { x: number; y: number })) => {
    const n = typeof v === 'function' ? v(camRef.current) : v;
    camRef.current.x = n.x;
    camRef.current.y = n.y;
    setPanState({ x: n.x, y: n.y });
  };
  const flushNav = () => {
    clearTimeout(navTimers.current.idle);
    clearTimeout(navTimers.current.max);
    navTimers.current = {};
    svgRef.current?.classList.remove('design-navigating');
    const c = camRef.current;
    setPanState({ x: c.x, y: c.y });
    if (c.z !== lastPropZoom.current) onZoomRef.current?.(c.z);
  };
  const navigate = (x: number, y: number, z?: number) => {
    const c = camRef.current;
    c.x = x;
    c.y = y;
    if (z !== undefined) c.z = z;
    gRef.current?.setAttribute('transform', `translate(${c.x}, ${c.y}) scale(${c.z})`);
    svgRef.current?.classList.add('design-navigating'); // sem filtros/blur enquanto navega
    clearTimeout(navTimers.current.idle);
    navTimers.current.idle = setTimeout(flushNav, 120);
    // gesto longo: só re-renderiza (atualiza o recorte) quando a área visível sai do que já está montado
    const box = cullRef.current;
    const el = svgRef.current;
    if (box && el) {
      const vx0 = -c.x / c.z, vx1 = (-c.x + el.clientWidth) / c.z, vy0 = -c.y / c.z, vy1 = (-c.y + el.clientHeight) / c.z;
      if (vx0 < box.x0 || vx1 > box.x1 || vy0 < box.y0 || vy1 > box.y1) {
        if (!navTimers.current.max) navTimers.current.max = setTimeout(flushNav, 0);
      }
    }
  };
  useEffect(() => () => { clearTimeout(navTimers.current.idle); clearTimeout(navTimers.current.max); }, []);
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [gapMarks, setGapMarks] = useState<GapMark[]>([]);
  // Alt: distâncias entre a seleção e o elemento sob o mouse (ou o frame pai)
  const [altDown, setAltDown] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  // Caneta (clique para criar nós): caminho em desenho e posição do cursor para a linha de prévia
  const [penDraftId, setPenDraftId] = useState<string | null>(null);
  const penDraftRef = useRef<string | null>(null);
  const [penCursor, setPenCursor] = useState<Point | null>(null);
  const [selNode, setSelNode] = useState<{ id: string; index: number } | null>(null); // nó selecionado na edição vetorial
  const penFinishedAt = useRef(0); // o duplo clique que termina o caminho não deve alternar o nó (canto/suave)
  const shapesLiveRef = useRef(shapes);
  shapesLiveRef.current = shapes;
  // Posição do ponteiro na tela (marcador nas réguas), atualizada no máximo 1x por frame
  const [pointerScreen, setPointerScreen] = useState<{ x: number; y: number } | null>(null);
  const pointerRaf = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingGuidePos, setDraggingGuidePos] = useState<number | null>(null);
  // Edição de texto direto no canvas (duplo clique em um texto, ou logo após criá-lo)
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // edição de texto com estilo por trecho: o campo é um textarea (texto puro); os trechos ficam à parte e acompanham a digitação
  const editorTaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorBarRef = useRef<HTMLDivElement | null>(null);
  const editorRunsRef = useRef<TextRun[]>([]);
  const editorPrevText = useRef('');
  const [, bumpEditor] = useState(0);
  // Renomear frame direto no rótulo (duplo clique no nome)
  const [editingFrameNameId, setEditingFrameNameId] = useState<string | null>(null);
  // menu "⋯" do frame selecionado
  const [frameMenuFor, setFrameMenuFor] = useState<string | null>(null);
  useEffect(() => {
    if (!frameMenuFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('[data-frame-menu]')) setFrameMenuFor(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [frameMenuFor]);
  const editingIsNew = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const hasAutoCentered = useRef(false);
  const isRightClickPanning = useRef(false);
  const rightClickPanMoved = useRef(false);
  // o menu de contexto só abre no duplo clique direito (um clique direito só seleciona/arrasta o canvas)
  const lastRightClick = useRef({ t: 0, x: 0, y: 0 });
  const isDoubleRightClick = (e: React.MouseEvent) => {
    const l = lastRightClick.current, now = Date.now();
    const dbl = now - l.t < 500 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 8;
    lastRightClick.current = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
    return dbl;
  };

  // Unifica IDs selecionados (múltipla e individual)
  const activeSelectedIds = React.useMemo(() => {
    if (selectedIds && selectedIds.length > 0) return selectedIds;
    if (selectedId) return [selectedId];
    return [];
  }, [selectedIds, selectedId]);

  const handleSelectIds = (ids: string[]) => {
    // onSelect redefiniria a seleção para um único item, então só é usado quando não há onSelectMultiple
    if (onSelectMultiple) onSelectMultiple(ids);
    else onSelect(ids.length > 0 ? ids[0] : null);
  };

  // Programmatically center camera when targetCamera changes
  useEffect(() => {
    if (!targetCamera || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const z = targetCamera.zoom ?? zoom;
    if (targetCamera.zoom && targetCamera.zoom !== zoom) {
      onZoomChange?.(targetCamera.zoom);
    }
    setPan({
      x: Math.round(rect.width / 2 - targetCamera.x * z),
      y: Math.round(rect.height / 2 - targetCamera.y * z),
    });
  }, [targetCamera]);

  // Ao carregar, enquadra TODO o conteúdo na tela (zoom-to-fit), não só um shape.
  useEffect(() => {
    if (hasAutoCentered.current || !svgRef.current || shapes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const minX = Math.min(...shapes.map((s) => s.x));
    const minY = Math.min(...shapes.map((s) => s.y));
    const maxX = Math.max(...shapes.map((s) => s.x + s.width));
    const maxY = Math.max(...shapes.map((s) => s.y + s.height));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const fitZoom = Math.min(3, Math.max(0.02, Math.min(rect.width / contentWidth, rect.height / contentHeight) * 0.85));
    onZoomChange?.(Number(fitZoom.toFixed(3)));
    setPan({
      x: Math.round(rect.width / 2 - centerX * fitZoom),
      y: Math.round(rect.height / 2 - centerY * fitZoom),
    });
    hasAutoCentered.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes]);

  // Reporta o retângulo visível atual (em coordenadas do canvas) pro pai,
  // usado para alinhar/inserir elementos relativos ao que está na tela.
  useEffect(() => {
    if (!onViewportChange || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    onViewportChange({
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
    });
  }, [pan, zoom, onViewportChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }
      if (e.key === 'Alt' && !e.repeat) {
        setAltDown(true);
        setHoverId(hoverRef.current);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'Alt') {
        setAltDown(false);
        setHoverId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  const getCanvasPoint = (e: React.MouseEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      x: (screenX - camRef.current.x) / camRef.current.z,
      y: (screenY - camRef.current.y) / camRef.current.z,
    };
  };

  const updateShape = (id: string, patch: Partial<Shape>, commit: boolean) => {
    onShapesChange(
      shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      commit
    );
  };

  useEffect(() => {
    if (!editingTextId) return;
    const t = shapesLiveRef.current.find((x) => x.id === editingTextId);
    editorRunsRef.current = (t?.runs || []).map((r) => ({ ...r }));
    editorPrevText.current = editingIsNew.current && t?.text === 'Texto' ? '' : t?.text || '';
  }, [editingTextId]);

  // Enter/Esc terminam o caminho da caneta; trocar de ferramenta também
  useEffect(() => {
    if (!penDraftId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        finishPen();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penDraftId]);
  // Delete/Backspace apaga o nó selecionado (o caminho precisa ficar com 2 nós)
  useEffect(() => {
    if (!selNode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const sh = shapesLiveRef.current.find((x) => x.id === selNode.id);
      if (!sh?.points || sh.points.length <= 2) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const rm = removeNode(sh.points, sh.pathHandles, selNode.index);
      onShapesChange(shapesLiveRef.current.map((x) => (x.id === sh.id ? { ...x, points: rm.points, pathHandles: rm.handles, ...bboxOfPath(sh, rm.points, rm.handles) } : x)), true);
      setSelNode(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selNode]);
  useEffect(() => {
    if (selNode && !activeSelectedIds.includes(selNode.id)) setSelNode(null);
  }, [activeSelectedIds, selNode]);
  useEffect(() => {
    if (tool !== 'pen' && penDraftRef.current) finishPen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // Pontas de linha (início/fim): desenhadas na extremidade, orientadas pela tangente
  const renderCaps = (s: Shape, pts: Point[], dirs: { start: Point; end: Point } | null, color: string, width: number) => {
    if (!dirs || pts.length < 2 || (!s.startCap && !s.endCap)) return null;
    const size = capSize(width);
    const mk = (kind: Shape['startCap'], tip: Point, dir: Point, key: string) => {
      const g = kind ? capGeometry(kind, tip, dir, size) : null;
      return g ? <path key={key} d={g.d} fill={g.filled ? color : 'none'} stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" /> : null;
    };
    return (
      <>
        {mk(s.startCap, pts[0], dirs.start, 'cap-start')}
        {mk(s.endCap, pts[pts.length - 1], dirs.end, 'cap-end')}
      </>
    );
  };

  const altMarks: GapMark[] = (() => {
    if (!(altDown || redlines) || readOnly || activeSelectedIds.length === 0 || drag.kind !== 'none') return [];
    const sel = shapes.filter((x) => activeSelectedIds.includes(x.id));
    if (!sel.length) return [];
    const selBox = unionBox(sel.map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height })));
    const target = (hoverId && !activeSelectedIds.includes(hoverId) ? shapes.find((x) => x.id === hoverId) : null) || (sel[0].parentId ? shapes.find((x) => x.id === sel[0].parentId) : null);
    return target ? measureBetween(selBox, { x: target.x, y: target.y, width: target.width, height: target.height }) : [];
  })();

  const renderMarks = (marks: GapMark[], prefix: string) =>
    marks.map((g, i) => {
      const mid = (g.from + g.to) / 2;
      const horiz = g.axis === 'x';
      const label = String(Math.round(g.value * 10) / 10);
      const lw = (label.length * 6 + 8) / zoom;
      const lh = 14 / zoom;
      return (
        <g key={`${prefix}-${i}`} pointerEvents="none">
          <line x1={horiz ? g.from : g.cross} x2={horiz ? g.to : g.cross} y1={horiz ? g.cross : g.from} y2={horiz ? g.cross : g.to} stroke="#f24822" strokeWidth={1 / zoom} />
          <rect x={(horiz ? mid : g.cross) - lw / 2} y={(horiz ? g.cross : mid) - lh / 2} width={lw} height={lh} rx={3 / zoom} fill="#f24822" />
          <text x={horiz ? mid : g.cross} y={(horiz ? g.cross : mid) + 3.5 / zoom} fontSize={10 / zoom} fill="#fff" textAnchor="middle" fontFamily="'Poppins', sans-serif" fontWeight={600}>{label}</text>
        </g>
      );
    });

  // linhas de encaixe das grades dos frames que contêm o centro do que está sendo movido
  const layoutGridBoxesFor = (moving: { x: number; y: number; width: number; height: number }, skip: Set<string>) => {
    const cx = moving.x + moving.width / 2;
    const cy = moving.y + moving.height / 2;
    return shapes
      .filter((f) => f.visible !== false && !skip.has(f.id) && f.layoutGrids?.some((g) => g.visible) && cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height)
      .flatMap((f) => gridSnapBoxes({ x: f.x, y: f.y, width: f.width, height: f.height }, f.layoutGrids!));
  };

  const handleBackgroundDown = (e: React.MouseEvent) => {
    // Pan do canvas (com ferramenta hand, espaço pressionado, botão do meio (1) ou botão direito (2))
    if (tool === 'hand' || isSpacePressed || e.button === 1 || e.button === 2) {
      if (e.button === 2) {
        isRightClickPanning.current = true;
        rightClickPanMoved.current = false;
      }
      setDrag({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: camRef.current.x,
        origPanY: camRef.current.y,
      });
      return;
    }

    if (e.button !== 0) return; // Apenas clique esquerdo para seleção e ferramentas
    if (readOnly) return;
    const p = getCanvasPoint(e);

    if (tool === 'select' || tool === 'scale') {
      // Inicia Marquee Selection (região de seleção que seleciona múltiplos componentes igual Figma)
      if (!e.shiftKey) {
        handleSelectIds([]);
      }
      setDrag({
        kind: 'marquee',
        startX: p.x,
        startY: p.y,
        currentX: p.x,
        currentY: p.y,
        isAdditive: e.shiftKey,
      });
      return;
    }

    // Caneta: cada clique cria um nó (arrastar puxa as alças); clique no primeiro nó fecha; duplo clique/Enter/Esc termina
    if (tool === 'pen') {
      const draft = penDraftRef.current ? shapes.find((x) => x.id === penDraftRef.current) : undefined;
      if (draft?.points) {
        if (e.detail >= 2) {
          finishPen();
          return;
        }
        if (draft.points.length >= 3 && Math.hypot(p.x - draft.points[0].x, p.y - draft.points[0].y) < 8 / zoom) {
          finishPen(true);
          return;
        }
        const points = [...draft.points, p];
        updateShape(draft.id, { points, ...bboxOfPath(draft, points) }, false);
        setDrag({ kind: 'pen-node', shapeId: draft.id, index: points.length - 1 });
        return;
      }
      const zi = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1;
      const created = makeShape('pen', p.x, p.y, zi, accentColor);
      onShapesChange([...shapes, created], false);
      handleSelectIds([created.id]);
      penDraftRef.current = created.id;
      setPenDraftId(created.id);
      setDrag({ kind: 'pen-node', shapeId: created.id, index: 0 });
      return;
    }

    const isPen = tool === 'pencil'; // a caneta ('pen') já foi tratada acima
    const zIndex = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1;
    const shape = makeShape(tool as Shape['type'], p.x, p.y, zIndex, accentColor);
    onShapesChange([...shapes, shape], false);
    handleSelectIds([shape.id]);
    setDrag(isPen ? { kind: 'pen', shapeId: shape.id } : { kind: 'create', shapeId: shape.id, startX: p.x, startY: p.y });
  };

  // Termina o caminho da caneta (fechado ou aberto). Com menos de 2 nós, descarta.
  const finishPen = (closeIt = false) => {
    const id = penDraftRef.current;
    if (!id) return;
    penDraftRef.current = null;
    penFinishedAt.current = Date.now();
    setPenDraftId(null);
    setPenCursor(null);
    const live = shapesLiveRef.current;
    const sh = live.find((x) => x.id === id);
    if (!sh?.points || sh.points.length < 2) {
      onShapesChange(live.filter((x) => x.id !== id), true);
      handleSelectIds([]);
    } else {
      const closed = closeIt || !!sh.closed;
      onShapesChange(live.map((x) => (x.id === id ? { ...x, closed, ...bboxOfPath({ ...sh, closed }) } : x)), true);
    }
    onToolUsed();
  };

  const handleShapeDown = (e: React.MouseEvent, shape: Shape, fromLabel = false) => {
    // Pan do canvas mesmo clicando sobre um shape se for botão do meio ou botão direito
    if (tool === 'hand' || isSpacePressed || e.button === 1 || e.button === 2) {
      handleBackgroundDown(e);
      return;
    }

    if (e.button !== 0) return;
    if (readOnly) return;
    if (shape.locked || shape.deviceChrome) return; // peças do aparelho são fixas (não arrastam nem selecionam pelo canvas)
    if (tool !== 'select' && tool !== 'scale') return;
    // Como no Figma: arrastar sobre o corpo de um frame raiz não selecionado faz seleção por área (o frame é selecionado pelo título/camadas)
    const deepPick = e.ctrlKey || e.metaKey; // Ctrl/Cmd+clique: seleciona só o componente sob o mouse
    if (shape.type === 'frame' && !shape.parentId && !activeSelectedIds.includes(shape.id) && !e.altKey && !fromLabel && !deepPick) {
      handleBackgroundDown(e);
      e.stopPropagation();
      return;
    }
    e.stopPropagation();

    const p = getCanvasPoint(e);
    let nextSelectedIds = [...activeSelectedIds];

    if (deepPick && !e.shiftKey) {
      nextSelectedIds = [shape.id];
      handleSelectIds(nextSelectedIds);
    } else if (e.shiftKey) {
      if (nextSelectedIds.includes(shape.id)) {
        nextSelectedIds = nextSelectedIds.filter((id) => id !== shape.id);
      } else {
        nextSelectedIds.push(shape.id);
      }
      handleSelectIds(nextSelectedIds);
    } else {
      if (!nextSelectedIds.includes(shape.id)) {
        nextSelectedIds = [shape.id];
        handleSelectIds(nextSelectedIds);
      }
    }

    // Alt+arrastar: deixa o original no lugar e arrasta uma cópia (o desfazer remove a cópia de uma vez)
    if (e.altKey && !deepPick && !e.shiftKey && nextSelectedIds.length > 0) {
      const dup = duplicateShapes(shapes, nextSelectedIds, { x: 0, y: 0 });
      if (dup.shapes.length > 0) {
        const copies = dup.shapes.map((c) => ({ ...c, name: (c.name || '').replace(/ \(cópia\)$/, '') }));
        onShapesChange([...shapes, ...copies], false);
        handleSelectIds(dup.newRootIds);
        setDrag({
          kind: 'move',
          shapeId: dup.newRootIds[Math.max(0, nextSelectedIds.indexOf(shape.id))] || dup.newRootIds[0],
          startX: p.x,
          startY: p.y,
          origX: shape.x,
          origY: shape.y,
          childOrigins: copies.map((c) => ({ id: c.id, x: c.x, y: c.y })),
          rootIds: dup.newRootIds,
        });
        return;
      }
    }

    // Se mover, move todos os shapes selecionados juntos (comportamento Figma)
    const moveIds = new Set<string>(nextSelectedIds);
    nextSelectedIds.forEach((id) => descendantIds(shapes, id).forEach((d) => moveIds.add(d)));
    const shapesToMove = shapes.filter((s) => moveIds.has(s.id));
    const childOrigins = shapesToMove.map((c) => ({ id: c.id, x: c.x, y: c.y }));

    setDrag({
      kind: 'move',
      shapeId: shape.id,
      startX: p.x,
      startY: p.y,
      origX: shape.x,
      origY: shape.y,
      childOrigins,
      rootIds: nextSelectedIds,
    });
  };

  const handleResizeDown = (e: React.MouseEvent, shape: Shape, handle: string) => {
    if (readOnly) return;
    e.stopPropagation();
    const ids = new Set(descendantIds(shapes, shape.id));
    setDrag({ kind: 'resize', shapeId: shape.id, handle, orig: { ...shape }, descendants: shapes.filter((x) => ids.has(x.id)).map((x) => ({ ...x })) });
  };

  const handleRotateDown = (e: React.MouseEvent, ids: string[], pivot: Point) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    const p = getCanvasPoint(e);
    const first = shapes.find((x) => x.id === ids[0]);
    setDrag({ kind: 'rotate', ids, pivot, startAngle: angleDeg(pivot, p), orig: shapes.map((x) => ({ ...x })), baseRotation: first?.rotation || 0, single: ids.length === 1 });
  };

  const handleRadiusDown = (e: React.MouseEvent, shape: Shape) => {
    if (readOnly) return;
    e.stopPropagation();
    const p = getCanvasPoint(e);
    setDrag({
      kind: 'radius',
      shapeId: shape.id,
      startX: p.x,
      startY: p.y,
      origRadius: shape.cornerRadius || 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (onPointerMove && svgRef.current) {
      const pt = getCanvasPoint(e);
      onPointerMove(pt.x, pt.y);
    }
    if (svgRef.current) {
      const box = svgRef.current.getBoundingClientRect();
      lastPointerRef.current = { x: e.clientX - box.left, y: e.clientY - box.top };
      if (showRulers && pointerRaf.current === null) {
        pointerRaf.current = requestAnimationFrame(() => {
          pointerRaf.current = null;
          setPointerScreen({ ...lastPointerRef.current });
        });
      }
    }
    if (drag.kind === 'none') return;

    if (drag.kind === 'guide') {
      const pt = getCanvasPoint(e);
      let pos = drag.axis === 'x' ? pt.x : pt.y;
      if (snapEnabled && !(e.metaKey || e.ctrlKey)) {
        pos = snapGuidePos(pos, drag.axis, shapes.filter((x) => x.visible !== false).map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height })), 6 / zoom, showGrid ? gridSize : 0);
      }
      pos = Math.round(pos * 100) / 100;
      setDraggingGuidePos(pos);
      const exists = userGuides.some((g) => g.id === drag.id);
      onUserGuidesChange?.(exists ? userGuides.map((g) => (g.id === drag.id ? { ...g, pos } : g)) : [...userGuides, { id: drag.id, axis: drag.axis, pos }]);
      return;
    }

    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        rightClickPanMoved.current = true;
      }
      navigate(drag.origPanX + dx, drag.origPanY + dy);
      return;
    }

    if (readOnly) return;
    const p = getCanvasPoint(e);

    if (drag.kind === 'marquee') {
      setDrag((prev) => (prev.kind === 'marquee' ? { ...prev, currentX: p.x, currentY: p.y } : prev));

      const selX = Math.min(drag.startX, p.x);
      const selY = Math.min(drag.startY, p.y);
      const selW = Math.abs(p.x - drag.startX);
      const selH = Math.abs(p.y - drag.startY);

      if (selW > 2 || selH > 2) {
        const hits = shapes.filter((s) => {
          if (s.visible === false || s.locked || s.deviceChrome) return false;
          const sw = Math.max(1, s.width);
          const sh = Math.max(1, s.height);
          // Cmd/Ctrl: só o que está inteiro dentro do retângulo; sem a tecla, basta tocar
          if (e.metaKey || e.ctrlKey) {
            if (!(s.x >= selX && s.y >= selY && s.x + sw <= selX + selW && s.y + sh <= selY + selH)) return false;
          } else if (!(s.x < selX + selW && s.x + sw > selX && s.y < selY + selH && s.y + sh > selY)) return false;
          // contêiner que engloba toda a área não é selecionado: o que está dentro dele é
          const isContainer = s.type === 'frame' || s.type === 'group' || s.type === 'section';
          return !(isContainer && s.x <= selX && s.y <= selY && s.x + sw >= selX + selW && s.y + sh >= selY + selH && shapes.some((c) => c.parentId === s.id));
        });
        const hitSet = new Set(hits.map((s) => s.id));
        // só o mais externo: descendentes de algo já selecionado ficam de fora
        const hasHitAncestor = (s: Shape) => {
          let cur = s.parentId ? shapes.find((x) => x.id === s.parentId) : undefined;
          while (cur) {
            if (hitSet.has(cur.id)) return true;
            cur = cur.parentId ? shapes.find((x) => x.id === cur!.parentId) : undefined;
          }
          return false;
        };
        const hitIds = hits.filter((s) => !hasHitAncestor(s)).map((s) => s.id);

        if (drag.isAdditive) {
          const combined = Array.from(new Set([...activeSelectedIds, ...hitIds]));
          handleSelectIds(combined);
        } else {
          handleSelectIds(hitIds);
        }
      }
      return;
    }

    if (drag.kind === 'create') {
      const x = Math.min(p.x, drag.startX);
      const y = Math.min(p.y, drag.startY);
      const width = Math.abs(p.x - drag.startX);
      const height = Math.abs(p.y - drag.startY);
      updateShape(drag.shapeId, { x, y, width, height }, false);
    } else if (drag.kind === 'pen') {
      const shape = shapes.find((s) => s.id === drag.shapeId);
      if (!shape) return;
      const points = [...(shape.points || []), p];
      const bbox = bboxOfPoints(points);
      updateShape(drag.shapeId, { points, ...bbox }, false);
    } else if (drag.kind === 'move') {
      let dx = p.x - drag.startX;
      let dy = p.y - drag.startY;
      // Encaixe: bordas e centros do que está sendo movido contra os demais shapes (Cmd/Ctrl desativa)
      if (snapEnabled && !(e.metaKey || e.ctrlKey)) {
        const moved = new Set(drag.childOrigins.map((c) => c.id));
        const roots = drag.rootIds
          .map((id) => shapes.find((x) => x.id === id))
          .filter((x): x is Shape => Boolean(x))
          .map((x) => {
            const o = drag.childOrigins.find((c) => c.id === x.id)!;
            return { x: o.x + dx, y: o.y + dy, width: x.width, height: x.height };
          });
        if (roots.length > 0) {
          const others = shapes
            .filter((x) => !moved.has(x.id) && x.visible !== false && x.type !== 'comment' && x.type !== 'annotation' && x.type !== 'measurement')
            .map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height }))
            .concat(showUserGuides ? guideBoxes(userGuides) : [])
            .concat(layoutGridBoxesFor(unionBox(roots), moved));
          const snap = computeSnap(unionBox(roots), others, 6 / zoom, showGrid ? gridSize : 0);
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides);
          setGapMarks(snap.gaps || []);
        }
      } else if (guides.length || gapMarks.length) {
        setGuides([]);
        setGapMarks([]);
      }
      if (pixelSnap) {
        const first = drag.childOrigins.find((c) => c.id === drag.rootIds[0]) || drag.childOrigins[0];
        if (first) {
          dx = Math.round(first.x + dx) - first.x;
          dy = Math.round(first.y + dy) - first.y;
        }
      }
      const next = shapes.map((s) => {
        const origin = drag.childOrigins.find((c) => c.id === s.id);
        if (origin) {
          const points = s.points
            ? s.points.map((pt) => ({
                x: pt.x + (origin.x + dx - s.x),
                y: pt.y + (origin.y + dy - s.y),
              }))
            : undefined;
          return {
            ...s,
            x: origin.x + dx,
            y: origin.y + dy,
            ...(points ? { points } : {}),
          };
        }
        return s;
      });
      onShapesChange(next, false);
    } else if (drag.kind === 'node') {
      const shape = shapes.find((x) => x.id === drag.shapeId);
      if (!shape?.points) return;
      const points = shape.points.map((pt, i) => (i === drag.index ? { x: p.x, y: p.y } : pt));
      updateShape(drag.shapeId, { points, ...bboxOfPath(shape, points) }, false);
    } else if (drag.kind === 'handle') {
      const shape = shapes.find((x) => x.id === drag.shapeId);
      const node = shape?.points?.[drag.index];
      if (!shape?.points || !node) return;
      // Alt: alça independente (a oposta não acompanha)
      const handles = setHandle(shape.pathHandles, shape.points.length, drag.index, drag.which, { x: p.x - node.x, y: p.y - node.y }, e.altKey);
      updateShape(drag.shapeId, { pathHandles: handles, ...bboxOfPath(shape, shape.points, handles) }, false);
    } else if (drag.kind === 'pen-node') {
      // Caneta: arrastar logo após clicar puxa as alças do nó recém-criado (espelhadas)
      const shape = shapes.find((x) => x.id === drag.shapeId);
      const node = shape?.points?.[drag.index];
      if (!shape?.points || !node) return;
      if (Math.hypot(p.x - node.x, p.y - node.y) > 3 / zoom) {
        const handles = setHandle(shape.pathHandles, shape.points.length, drag.index, 'out', { x: p.x - node.x, y: p.y - node.y }, e.altKey);
        updateShape(drag.shapeId, { pathHandles: handles, ...bboxOfPath(shape, shape.points, handles) }, false);
      }
    } else if (drag.kind === 'resize') {
      const { orig, handle } = drag;
      let { x, y, width, height } = orig;
      if (handle.includes('e')) width = Math.max(4, p.x - orig.x);
      if (handle.includes('s')) height = Math.max(4, p.y - orig.y);
      if (handle.includes('w')) {
        width = Math.max(4, orig.x + orig.width - p.x);
        x = orig.x + orig.width - width;
      }
      if (handle.includes('n')) {
        height = Math.max(4, orig.y + orig.height - p.y);
        y = orig.y + orig.height - height;
      }
      if (orig.constrainProportions && orig.width > 0 && orig.height > 0) {
        const ratio = orig.height / orig.width;
        height = Math.max(4, width * ratio);
        if (handle.includes('n')) y = orig.y + orig.height - height;
      }
      // Encaixe das bordas arrastadas nos outros shapes
      if (snapEnabled && !(e.metaKey || e.ctrlKey) && !orig.constrainProportions) {
        const skip = new Set([orig.id, ...drag.descendants.map((d) => d.id)]);
        const others = shapes
          .filter((x) => !skip.has(x.id) && x.visible !== false)
          .map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height }))
          .concat(showUserGuides ? guideBoxes(userGuides) : []);
        const th = 6 / zoom;
        const g: Guide[] = [];
        if (handle.includes('e') || handle.includes('w')) {
          const edge = handle.includes('e') ? x + width : x;
          const sn = computeSnap({ x: edge, y, width: 0, height }, others, th, showGrid ? gridSize : 0);
          if (sn.dx) {
            if (handle.includes('e')) width = Math.max(4, width + sn.dx);
            else {
              x += sn.dx;
              width = Math.max(4, width - sn.dx);
            }
          }
          g.push(...sn.guides.filter((q) => q.axis === 'x'));
        }
        if (handle.includes('s') || handle.includes('n')) {
          const edge = handle.includes('s') ? y + height : y;
          const sn = computeSnap({ x, y: edge, width, height: 0 }, others, th, showGrid ? gridSize : 0);
          if (sn.dy) {
            if (handle.includes('s')) height = Math.max(4, height + sn.dy);
            else {
              y += sn.dy;
              height = Math.max(4, height - sn.dy);
            }
          }
          g.push(...sn.guides.filter((q) => q.axis === 'y'));
        }
        setGuides(g);
      }
      if (pixelSnap) {
        ({ x, y, width, height } = roundBoxToPixels({ x, y, width, height }));
      }
      // Filhos acompanham: restrições (padrão) ou escala proporcional (ferramenta Escala)
      const patches = resizeDescendants(
        [orig, ...drag.descendants],
        orig.id,
        { x: orig.x, y: orig.y, width: orig.width, height: orig.height },
        { x, y, width, height },
        tool === 'scale' ? 'scale' : 'constraints'
      );
      // Redimensionar vira tamanho fixo naquele eixo (como no Figma) e o auto layout reflui ao vivo
      const modePatch: Partial<Shape> = {};
      if ((handle.includes('e') || handle.includes('w')) && orig.widthMode !== 'fixed') modePatch.widthMode = 'fixed';
      if ((handle.includes('n') || handle.includes('s')) && orig.heightMode !== 'fixed') modePatch.heightMode = 'fixed';
      const resized = shapes.map((sh) => {
        if (sh.id === drag.shapeId) return { ...sh, x, y, width, height, ...modePatch };
        const patch = patches.get(sh.id);
        return patch ? { ...sh, ...patch } : sh;
      });
      onShapesChange(resized.some((sh) => sh.hasAutoLayout) ? relayoutAll(resized) : resized, false);
    } else if (drag.kind === 'rotate') {
      let delta = angleDeg(drag.pivot, p) - drag.startAngle;
      // Shift: encaixa em múltiplos de 15° (a rotação final se for um shape; o giro se forem vários)
      if (e.shiftKey) delta = drag.single ? snapAngle(drag.baseRotation + delta) - drag.baseRotation : snapAngle(delta);
      onShapesChange(rotateShapes(drag.orig, drag.ids, drag.pivot, delta), false);
    } else if (drag.kind === 'radius') {
      const delta = Math.sqrt(Math.pow(p.x - drag.startX, 2) + Math.pow(p.y - drag.startY, 2));
      const newRadius = Math.max(0, Math.min(100, Math.round(drag.origRadius + delta / 2)));
      updateShape(drag.shapeId, { cornerRadius: newRadius }, false);
    }
  };

  const handleMouseUp = () => {
    if (drag.kind === 'guide') {
      // Soltar de volta sobre a régua remove a guia
      const p = lastPointerRef.current;
      const overRuler = drag.axis === 'y' ? p.y < RULER_SIZE : p.x < RULER_SIZE;
      if (overRuler) onUserGuidesChange?.(userGuides.filter((g) => g.id !== drag.id));
      setDraggingGuidePos(null);
      setDrag({ kind: 'none' });
      return;
    }
    if (drag.kind !== 'none') {
      if (drag.kind === 'marquee') {
        const selW = Math.abs(drag.currentX - drag.startX);
        const selH = Math.abs(drag.currentY - drag.startY);
        if (selW <= 3 && selH <= 3 && !drag.isAdditive) {
          handleSelectIds([]);
        }
      } else if (drag.kind !== 'pan') {
        // soltou/criou: a camada entra no frame mais interno sob o seu centro (ou sai do frame se foi arrastada para fora)
        const moved = drag.kind === 'create' ? [drag.shapeId] : drag.kind === 'move' ? drag.rootIds : [];
        const dropped = moved.length && !readOnly ? reparentDropped(shapes, moved, drag.kind === 'create' ? 'create' : 'move') : shapes;
        // texto criado com um clique (sem arrastar) ganha uma caixa de tamanho útil em vez de 0×1
        onShapesChange(drag.kind === 'create' && tool === 'text' ? dropped.map((x) => (x.id === drag.shapeId ? { ...x, textResize: x.width < 12 ? ('auto-width' as const) : ('auto-height' as const), width: Math.max(x.width, 200), height: Math.max(x.height, Math.round((x.fontSize || 18) * 1.25)) } : x)) : dropped, true);
        if (drag.kind === 'create' && tool === 'text') {
          editingIsNew.current = true;
          setEditingTextId(drag.shapeId);
        }
        if (drag.kind === 'create' || drag.kind === 'pen') onToolUsed();
      }
    }
    setDrag({ kind: 'none' });
    setGuides([]);
    setGapMarks([]);
    isRightClickPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom via Ctrl/Cmd + Wheel, Alt + Wheel ou trackpad pinch
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const cam = camRef.current;
      const nextZoom = Math.min(5, Math.max(0.02, Number((cam.z * zoomFactor).toFixed(3))));
      if (nextZoom === cam.z) return;

      let focusScreenX: number;
      let focusScreenY: number;
      let focusCanvasX: number;
      let focusCanvasY: number;

      const selectedShapes = shapes.filter((s) => activeSelectedIds.includes(s.id));

      if (selectedShapes.length > 0) {
        // Se um objeto estiver selecionado o zoom vai em direção desse objeto
        const minX = Math.min(...selectedShapes.map((s) => s.x));
        const minY = Math.min(...selectedShapes.map((s) => s.y));
        const maxX = Math.max(...selectedShapes.map((s) => s.x + s.width));
        const maxY = Math.max(...selectedShapes.map((s) => s.y + s.height));
        focusCanvasX = (minX + maxX) / 2;
        focusCanvasY = (minY + maxY) / 2;

        const currScreenX = cam.x + focusCanvasX * cam.z;
        const currScreenY = cam.y + focusCanvasY * cam.z;

        // Se estiver muito fora do viewport visível, ancora no centro da tela
        if (currScreenX < 0 || currScreenX > rect.width || currScreenY < 0 || currScreenY > rect.height) {
          focusScreenX = rect.width / 2;
          focusScreenY = rect.height / 2;
        } else {
          focusScreenX = currScreenX;
          focusScreenY = currScreenY;
        }
      } else {
        // Se não estiver selecionado o zoom deve ir em direção ao ponteiro do mouse
        focusScreenX = e.clientX - rect.left;
        focusScreenY = e.clientY - rect.top;
        focusCanvasX = (focusScreenX - cam.x) / cam.z;
        focusCanvasY = (focusScreenY - cam.y) / cam.z;
      }

      const nextPanX = Math.round(focusScreenX - focusCanvasX * nextZoom);
      const nextPanY = Math.round(focusScreenY - focusCanvasY * nextZoom);

      navigate(nextPanX, nextPanY, nextZoom);
    } else {
      navigate(camRef.current.x - e.deltaX, camRef.current.y - e.deltaY);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly || activeSelectedIds.length === 0) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const gone = new Set<string>(activeSelectedIds);
      activeSelectedIds.forEach((id) => descendantIds(shapes, id).forEach((d) => gone.add(d)));
      onShapesChange(shapes.filter((s) => !gone.has(s.id)), true);
      handleSelectIds([]);
    }
  };

  const groupBounds = computeGroupBounds(shapes);
  const displayShapes = shapes.map((s) => {
    const bounds = groupBounds.get(s.id);
    return bounds ? { ...s, ...bounds } : s;
  });
  const displayById = new Map(displayShapes.map((s) => [s.id, s]));
  // peças do aparelho (barra de status, ilha, indicador home…) ficam SEMPRE por cima do conteúdo da tela, mesmo de camadas inseridas depois
  const CHROME_TOP = 1e9;
  // só as peças DENTRO da tela (filhas da "Tela"); moldura e botões são estrutura e ficam abaixo da tela
  const onTop = (s: Shape) => (s.deviceChrome && displayById.get(s.parentId || '')?.deviceScreen ? CHROME_TOP : 0);
  const sorted = [...displayShapes].sort((a, b) => onTop(a) + a.zIndex - (onTop(b) + b.zIndex));
  // área visível (coordenadas do canvas) + uma tela de margem em cada lado; sem svg ainda = não recorta
  // (na primeira renderização o svg ainda não existe: usa a janela como estimativa para não montar tudo de uma vez)
  const vw = svgRef.current?.clientWidth || (typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.7) : 0);
  const vh = svgRef.current?.clientHeight || (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.9) : 0);
  const cullBox = !readOnly && vw && vh && shapes.length > 60
    ? { x0: (-pan.x - vw * 0.6) / zoom, x1: (-pan.x + vw * 1.6) / zoom, y0: (-pan.y - vh * 0.6) / zoom, y1: (-pan.y + vh * 1.6) / zoom }
    : null;
  cullRef.current = cullBox;
  // Nível de detalhe: com zoom bem baixo, telas (frames de topo) com muitos elementos aparecem só como o frame
  // (o conteúdo é minúsculo e custava milhares de elementos SVG para desenhar)
  const lodRoot = new Map<string, string>();
  const lodCount = new Map<string, number>();
  if (!readOnly && shapes.length > 60) {
    const rootOf = (id: string): string => {
      const hit = lodRoot.get(id);
      if (hit) return hit;
      const sh = displayById.get(id);
      const r = sh?.parentId && displayById.has(sh.parentId) ? rootOf(sh.parentId) : id;
      lodRoot.set(id, r);
      return r;
    };
    for (const sh of displayShapes) {
      const r = rootOf(sh.id);
      if (r !== sh.id) lodCount.set(r, (lodCount.get(r) || 0) + 1);
    }
  }
  const lodHidden = (s: Shape): boolean => {
    const r = lodRoot.get(s.id);
    if (!r || r === s.id) return false;
    const root = displayById.get(r);
    return !!root && (lodCount.get(r) || 0) > 25 && root.width * zoom < 64;
  };
  /** Com zoom bem baixo a tela vira uma miniatura (imagem leve do próprio design, em cache) em vez de centenas de elementos */
  const lodSnapshot = (root: Shape): React.ReactNode => {
    if (!((lodCount.get(root.id) || 0) > 25 && root.width * zoom < 64)) return null;
    const sub = collectSubtree(shapes, root);
    let h = sub.length;
    for (const x of sub) {
      h = (h * 31 + Math.round(x.x) * 7 + Math.round(x.y) * 13 + Math.round(x.width) * 17 + Math.round(x.height) * 19 + (x.text?.length || 0) + (x.imageUrl?.length || 0) + (x.visible === false ? 3 : 0)) | 0;
      const f = x.fill || '';
      for (let i = 0; i < f.length; i++) h = (h * 31 + f.charCodeAt(i)) | 0;
    }
    const sig = String(h);
    let hit = lodSnapCache.current.get(root.id);
    if (!hit || hit.sig !== sig) {
      try {
        const { svg, bounds } = buildExportSvg(shapes, root, 0.5);
        hit = { sig, href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), b: bounds };
        lodSnapCache.current.set(root.id, hit);
      } catch {
        return null;
      }
    }
    return <image key={`lod-${root.id}`} href={hit.href} x={hit.b.x} y={hit.b.y} width={hit.b.width} height={hit.b.height} preserveAspectRatio="none" pointerEvents="none" />;
  };

  // Calcula bounds da multi-seleção
  const selectedShapes = shapes.filter((s) => activeSelectedIds.includes(s.id));
  // Origem das réguas: canto do frame da seleção (se "relativo") ou 0,0
  const rulerOriginPoint = rulerRelative ? rulerOrigin(selectedShapes, shapes) : { x: 0, y: 0 };
  const multiBounds =
    selectedShapes.length > 1
      ? {
          x: Math.min(...selectedShapes.map((s) => s.x)),
          y: Math.min(...selectedShapes.map((s) => s.y)),
          width: Math.max(...selectedShapes.map((s) => s.x + s.width)) - Math.min(...selectedShapes.map((s) => s.x)),
          height: Math.max(...selectedShapes.map((s) => s.y + s.height)) - Math.min(...selectedShapes.map((s) => s.y)),
        }
      : null;

  // Cursor dinâmico de acordo com a ação realizada
  let cursorStyle = 'default';
  if (drag.kind === 'pan') {
    cursorStyle = 'grabbing';
  } else if (drag.kind === 'marquee') {
    cursorStyle = 'crosshair';
  } else if (drag.kind === 'move') {
    cursorStyle = 'move';
  } else if (drag.kind === 'resize') {
    const h = drag.handle;
    if (h === 'nw' || h === 'se') cursorStyle = 'nwse-resize';
    else if (h === 'ne' || h === 'sw') cursorStyle = 'nesw-resize';
    else if (h.includes('e') || h.includes('w')) cursorStyle = 'ew-resize';
    else cursorStyle = 'ns-resize';
  } else if (drag.kind === 'radius') {
    cursorStyle = 'pointer';
  } else if (drag.kind === 'create' || drag.kind === 'pen') {
    cursorStyle = 'crosshair';
  } else if (tool === 'hand' || isSpacePressed) {
    cursorStyle = 'grab';
  } else if (readOnly) {
    cursorStyle = 'default';
  } else if (tool === 'select' || tool === 'scale') {
    cursorStyle = 'default';
  } else {
    cursorStyle = 'crosshair';
  }

  return (
    <svg
      className={outlineMode ? 'design-outline' : undefined}
      ref={svgRef}
      tabIndex={0}
      onMouseDown={handleBackgroundDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        if (rightClickPanMoved.current) {
          rightClickPanMoved.current = false;
          return;
        }
        if (isDoubleRightClick(e)) onContextMenuCanvas?.(e.clientX, e.clientY);
      }}
      style={{
        width: '100%',
        height: '100%',
        background: bgCanvas,
        cursor: cursorStyle,
        outline: 'none',
        display: 'block',
        filter: colorBlind && COLOR_BLIND[colorBlind] ? 'url(#design-colorblind)' : undefined,
      }}
    >
      {colorBlind && COLOR_BLIND[colorBlind] && (
        <defs>
          <filter id="design-colorblind" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={COLOR_BLIND[colorBlind].matrix} />
          </filter>
        </defs>
      )}
      {outlineMode && (
        <style>{`.design-outline rect,.design-outline ellipse,.design-outline path,.design-outline polygon,.design-outline line,.design-outline image{fill:none!important;stroke:#8a8a8a!important;stroke-width:1px!important;vector-effect:non-scaling-stroke;opacity:1!important;filter:none!important;mix-blend-mode:normal!important}.design-outline text{fill:#b0b0b0!important}.design-outline foreignObject{display:none}`}</style>
      )}
      <g ref={gRef} transform={`translate(${camRef.current.x}, ${camRef.current.y}) scale(${camRef.current.z})`}>
        {showGrid && zoom >= 0.25 && (
          <g pointerEvents="none">
            <defs>
              <pattern id="design-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={1 / zoom} />
              </pattern>
            </defs>
            <rect
              x={-pan.x / zoom}
              y={-pan.y / zoom}
              width={(svgRef.current?.clientWidth || 2400) / zoom}
              height={(svgRef.current?.clientHeight || 1600) / zoom}
              fill="url(#design-grid)"
            />
          </g>
        )}
        {sorted.map((s) => {
          if (s.visible === false) return null;
          const isSelected = activeSelectedIds.includes(s.id);
          // fora da tela (com margem de uma tela inteira) ou menor que 1px: nem entra no DOM (selecionados sempre ficam)
          if (!isSelected && lodHidden(s)) return null;
          if (cullBox && !isSelected && s.id !== editingTextId) {
            const pad = Math.max(s.width, s.height) * 0.5 + 160;
            if (s.x + s.width + pad < cullBox.x0 || s.x - pad > cullBox.x1 || s.y + s.height + pad < cullBox.y0 || s.y - pad > cullBox.y1) return null;
            if (!s.isMask && s.width * zoom < 1 && s.height * zoom < 1) return null;
          }
          const common = {
            onMouseEnter: () => {
              hoverRef.current = s.id;
              if (altDown || redlines) setHoverId(s.id);
            },
            onMouseLeave: () => {
              if (hoverRef.current === s.id) hoverRef.current = null;
              if (altDown || redlines) setHoverId(null);
            },
            onMouseDown: (e: React.MouseEvent) => handleShapeDown(e, s),
            onDoubleClick: (e: React.MouseEvent) => {
              if (!readOnly && !s.locked && (s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length >= 2) {
                // Duplo clique no traço: adiciona um nó no segmento mais próximo
                e.stopPropagation();
                const pt = getCanvasPoint(e);
                const near = nearestSegment(s.points, s.pathHandles, !!s.closed, pt, !!s.smooth);
                if (!near) return;
                const split = splitSegment(s.points, s.pathHandles, !!s.closed, near.index, near.t, !!s.smooth);
                updateShape(s.id, { points: split.points, pathHandles: split.handles, ...bboxOfPath(s, split.points, split.handles) }, true);
                return;
              }
              if (readOnly || s.locked || (s.type !== 'text' && s.type !== 'text-path')) return;
              e.stopPropagation();
              editingIsNew.current = false;
              setEditingTextId(s.id);
            },
            onContextMenu: (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.ctrlKey && e.button === 0) return; // Ctrl+clique no Mac é seleção, não menu
              if (rightClickPanMoved.current) {
                rightClickPanMoved.current = false;
                return;
              }
              handleSelectIds([s.id]);
              if (isDoubleRightClick(e)) onContextMenuShape?.(s, e.clientX, e.clientY);
            },
            opacity: s.id === editingTextId || (s.isMask && !isSelected) ? 0 : (s.opacity ?? 1),
            style: {
              transform: s.flipX || s.flipY
                ? `scale(${s.flipX ? -1 : 1}, ${s.flipY ? -1 : 1})`
                : undefined,
              transformOrigin: s.flipX || s.flipY
                ? `${s.x + s.width / 2}px ${s.y + s.height / 2}px`
                : undefined,
            } as React.CSSProperties,
          };

          const hasIndependent = s.independentCorners && (
            (s.topLeftRadius ?? 0) > 0 ||
            (s.topRightRadius ?? 0) > 0 ||
            (s.bottomRightRadius ?? 0) > 0 ||
            (s.bottomLeftRadius ?? 0) > 0
          );

          const pathD = hasIndependent && s.type === 'rect'
            ? getRoundedRectPath(
                s.x,
                s.y,
                s.width,
                s.height,
                s.topLeftRadius ?? s.cornerRadius ?? 0,
                s.topRightRadius ?? s.cornerRadius ?? 0,
                s.bottomRightRadius ?? s.cornerRadius ?? 0,
                s.bottomLeftRadius ?? s.cornerRadius ?? 0
              )
            : null;

          const visibleFills = s.fills && s.fills.length > 0
            ? s.fills.filter((f) => f.visible)
            : [{ id: 'base', color: s.fill, opacity: s.opacity ?? 1, visible: true }];

          const visibleStrokes: StrokeItem[] = s.strokes && s.strokes.length > 0
            ? s.strokes.filter((st) => st.visible)
            : (s.stroke && s.stroke !== 'transparent' && s.stroke !== 'none')
              ? [{ id: 'base', color: s.stroke, opacity: 1, visible: true, width: s.strokeWidth ?? 1 }]
              : [];

          // forma (não-imagem) com imagem de fundo: a imagem substitui os preenchimentos de cor
          const imageFillShape = !!s.imageUrl && s.type !== 'image' && ['rect', 'frame', 'section', 'ellipse', 'polygon', 'star', 'path'].includes(s.type);
          const fillsToRender = imageFillShape ? [] : [...visibleFills].reverse();
          // Preenchimentos em gradiente: <defs> por shape e `paintOf` devolve url(#id) ou a cor sólida
          const gradId = (fid: string) => `grad-${s.id}-${fid}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const paintOf = (f: (typeof visibleFills)[number]) => (f.type === 'pattern' ? `url(#${gradId(f.id)})` : isHtmlGradient(f as any) ? 'none' : isGradientFill(f as any) ? `url(#${gradId(f.id)})` : f.color);
          // Angular e diamante: camada HTML (CSS) recortada pelo contorno do shape
          const htmlGradientLayers = fillsToRender
            .filter((f) => isHtmlGradient(f as any) && isGradientFill(f as any))
            .map((f) => {
              const cid = `clipg-${s.id}-${f.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
              return (
                <g key={f.id}>
                  <defs>
                    <clipPath id={cid}>{outlineGeometry(s)}</clipPath>
                  </defs>
                  <g clipPath={`url(#${cid})`} opacity={f.opacity}>
                    <foreignObject x={s.x} y={s.y} width={Math.max(1, s.width)} height={Math.max(1, s.height)}>
                      <div {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)} style={{ width: '100%', height: '100%', background: cssGradient(f as any) }} />
                    </foreignObject>
                  </g>
                </g>
              );
            });
          // Blur de fundo: camada com backdrop-filter recortada pelo contorno, abaixo dos preenchimentos.
          // Só aparece no canvas (a exportação não tem "fundo" para desfocar).
          const bgBlurLayers = (s.effects || [])
            .filter((e) => e.visible && e.type === 'background-blur')
            .map((e, i) => {
              const cid = `clipb-${s.id}-${i}`.replace(/[^a-zA-Z0-9_-]/g, '_');
              const progressive = e.blurMode === 'progressive';
              const mask = progressive
                ? `linear-gradient(to bottom, transparent ${e.blurStart ?? 0}%, black ${e.blurEnd ?? 100}%)`
                : undefined;
              return (
                <g key={cid}>
                  <defs>
                    <clipPath id={cid}>{outlineGeometry(s)}</clipPath>
                  </defs>
                  <g clipPath={`url(#${cid})`}>
                    <foreignObject x={s.x} y={s.y} width={Math.max(1, s.width)} height={Math.max(1, s.height)}>
                      <div
                        {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
                        style={{ width: '100%', height: '100%', backdropFilter: `blur(${e.blur ?? 8}px)`, WebkitBackdropFilter: `blur(${e.blur ?? 8}px)`, ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}) }}
                      />
                    </foreignObject>
                  </g>
                </g>
              );
            });
          const strokesToRender = [...visibleStrokes].reverse();
          // traço com gradiente (linear/radial): usa o mesmo tipo de definição do preenchimento
          const strokeIsGradient = (st: (typeof visibleStrokes)[number]) => (st.type === 'linear' || st.type === 'radial') && isGradientFill(st as any);
          const strokePaintOf = (st: (typeof visibleStrokes)[number]) => (strokeIsGradient(st) ? `url(#${gradId(st.id)})` : st.color);
          const blendOf = (it: { blendMode?: string }): React.CSSProperties | undefined => (it.blendMode && it.blendMode !== 'normal' ? ({ mixBlendMode: it.blendMode } as React.CSSProperties) : undefined);
          const paintItems = [...fillsToRender.filter((f) => isGradientFill(f as any) && !isHtmlGradient(f as any)), ...strokesToRender.filter(strokeIsGradient)] as Array<(typeof fillsToRender)[number]>;
          // Preenchimento por padrão: <pattern> com a peça que se repete (ruído usa um filtro de turbulência)
          const patternItems = fillsToRender.filter((f) => f.type === 'pattern');
          const patternDefs = patternItems.length > 0 ? (
            <defs>
              {patternItems.map((f) => {
                const tile = patternTile(f.patternKind || 'lines', f.patternScale ?? 12, f.color, f.patternBg);
                const nid = `${gradId(f.id)}-noise`;
                return (
                  <pattern key={f.id} id={gradId(f.id)} patternUnits="userSpaceOnUse" width={tile.w} height={tile.h} patternTransform={f.patternAngle ? `rotate(${f.patternAngle})` : undefined}>
                    {tile.items.map((it, i) =>
                      it.tag === 'rect' ? <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} fill={it.fill} /> : it.tag === 'circle' ? <circle key={i} cx={it.cx} cy={it.cy} r={it.r} fill={it.fill} /> : (
                        <g key={i}>
                          <filter id={nid} x="0" y="0" width="100%" height="100%">
                            <feTurbulence type="fractalNoise" baseFrequency={Math.max(0.02, 1 / Math.max(2, f.patternScale ?? 12))} numOctaves={2} seed={3} />
                            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.2" />
                          </filter>
                          {f.patternBg && <rect width={tile.w} height={tile.h} fill={f.patternBg} />}
                          <rect width={tile.w} height={tile.h} fill={f.color} filter={`url(#${nid})`} />
                        </g>
                      )
                    )}
                  </pattern>
                );
              })}
            </defs>
          ) : null;
          const gradientDefs = paintItems.length > 0 ? (
            <defs>
              {paintItems.map((f) => {
                const stops = sortStops((f as any).gradientStops).map((st, k) => (
                  <stop key={k} offset={st.position} stopColor={st.color} stopOpacity={st.opacity} />
                ));
                if ((f as any).type === 'radial') {
                  return (
                    <radialGradient key={f.id} id={gradId(f.id)} cx={(f as any).gradientCenter?.x ?? 0.5} cy={(f as any).gradientCenter?.y ?? 0.5} r={(f as any).gradientRadius ?? 0.5}>
                      {stops}
                    </radialGradient>
                  );
                }
                const v = linearVector((f as any).gradientAngle ?? 90);
                return (
                  <linearGradient key={f.id} id={gradId(f.id)} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
                    {stops}
                  </linearGradient>
                );
              })}
            </defs>
          ) : null;
          const strokePosition = s.strokePosition || 'inside';
          const strokeDash = dashArrayOf(s);
          const strokeJoin = s.strokeJoin || 'miter';

          // Helper to render stroke layers respecting inside / center / outside
          const renderShapeStrokes = (
            renderOutlineFn: (props: any) => React.ReactElement,
            bounds: { x: number; y: number; width: number; height: number },
            prefix: string
          ) => {
            if (visibleStrokes.length === 0) return null;

            if (strokePosition === 'center') {
              return (
                <g>
                  {strokesToRender.map((st, i) => {
                    const sw = st.width !== undefined ? st.width : (s.strokeWidth ?? 1);
                    return renderOutlineFn({
                      key: st.id || i,
                      fill: 'none',
                      stroke: strokePaintOf(st),
                      strokeWidth: sw,
                      strokeOpacity: st.opacity ?? 1,
                      style: blendOf(st),
                      strokeDasharray: strokeDash,
                      strokeLinejoin: strokeJoin,
                    });
                  })}
                </g>
              );
            }

            if (strokePosition === 'inside') {
              const clipId = `clip-inside-${prefix}-${s.id}`;
              return (
                <g>
                  <defs>
                    <clipPath id={clipId}>
                      {renderOutlineFn({ fill: 'white', stroke: 'none' })}
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {strokesToRender.map((st, i) => {
                      const sw = st.width !== undefined ? st.width : (s.strokeWidth ?? 1);
                      return renderOutlineFn({
                        key: st.id || i,
                        fill: 'none',
                        stroke: strokePaintOf(st),
                        strokeWidth: sw * 2,
                        strokeOpacity: st.opacity ?? 1,
                        style: blendOf(st),
                        strokeDasharray: strokeDash,
                        strokeLinejoin: strokeJoin,
                      });
                    })}
                  </g>
                </g>
              );
            }

            if (strokePosition === 'outside') {
              const maskId = `mask-outside-${prefix}-${s.id}`;
              const maxSw = Math.max(...visibleStrokes.map((st) => (st.width !== undefined ? st.width : (s.strokeWidth ?? 1))), 1);
              const pad = maxSw * 2 + 30;
              return (
                <g>
                  <defs>
                    <mask id={maskId}>
                      <rect
                        x={bounds.x - pad}
                        y={bounds.y - pad}
                        width={bounds.width + pad * 2}
                        height={bounds.height + pad * 2}
                        fill="white"
                      />
                      {renderOutlineFn({ fill: 'black', stroke: 'none' })}
                    </mask>
                  </defs>
                  <g mask={`url(#${maskId})`}>
                    {strokesToRender.map((st, i) => {
                      const sw = st.width !== undefined ? st.width : (s.strokeWidth ?? 1);
                      return renderOutlineFn({
                        key: st.id || i,
                        fill: 'none',
                        stroke: strokePaintOf(st),
                        strokeWidth: sw * 2,
                        strokeOpacity: st.opacity ?? 1,
                        style: blendOf(st),
                        strokeDasharray: strokeDash,
                        strokeLinejoin: strokeJoin,
                      });
                    })}
                  </g>
                </g>
              );
            }

            return null;
          };

          // Compute CSS filter from active effects (Drop shadow, Layer blur)
          const filterParts: string[] = [];
          // Sombra interna e ruído: <filter> SVG por shape, aplicado antes das funções CSS (sombra externa/blur)
          const fxId = `fx-${s.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const fxFilterMarkup = svgEffectFilter(fxId, s.effects);
          if (fxFilterMarkup) filterParts.push(`url(#${fxId})`);
          if (s.effects && s.effects.length > 0) {
            for (const eff of s.effects) {
              if (!eff.visible) continue;
              if (eff.type === 'drop-shadow') {
                const alpha = eff.opacity ?? 0.25;
                const hex = eff.color || '#000000';
                const r = parseInt(hex.slice(1, 3) || '00', 16) || 0;
                const g = parseInt(hex.slice(3, 5) || '00', 16) || 0;
                const b = parseInt(hex.slice(5, 7) || '00', 16) || 0;
                filterParts.push(`drop-shadow(${eff.x || 0}px ${eff.y ?? 4}px ${eff.blur ?? 4}px rgba(${r}, ${g}, ${b}, ${alpha}))`);
              } else if (eff.type === 'layer-blur') {
                const blurVal = eff.blur ?? 4;
                filterParts.push(`blur(${blurVal}px)`);
              }
            }
          }
          const canvasFilter = filterParts.length > 0 ? filterParts.join(' ') : undefined;

          let el: React.ReactNode;
          if (s.type === 'rect' || s.type === 'frame' || s.type === 'section' || s.type === 'slice') {
            const isSlice = s.type === 'slice';
            const isSection = s.type === 'section';
            const isFrame = s.type === 'frame';

            const renderOutline = (props: any) =>
              pathD ? (
                <path d={pathD} {...props} />
              ) : (
                <rect
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  rx={capRadius(s.width, s.height, s.cornerRadius || (isSection ? 8 : 0))}
                  ry={capRadius(s.width, s.height, s.cornerRadius || (isSection ? 8 : 0))}
                  {...props}
                />
              );

            el = (
              <g {...common}>
                {isFrame && !s.deviceScreen && !s.parentId && editingFrameNameId !== s.id && (
                  <text
                    x={s.x}
                    y={s.y - 6 / zoom}
                    onMouseDown={(e) => handleShapeDown(e, s, true)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!readOnly && !s.locked) setEditingFrameNameId(s.id);
                    }}
                    style={{ cursor: 'default', userSelect: 'none' }}
                    fill={activeSelectedIds.includes(s.id) ? accentColor : '#8f8f8f'}
                    fontSize={11 / zoom}
                    fontWeight={500}
                    fontFamily="'Poppins', sans-serif"
                  >
                    {s.name || 'Frame'}
                  </text>
                )}
                {/* Render Fills in reverse order (bottom to top so index 0 is on top) */}
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: isSlice ? 'none' : isSection ? accentColor + '0d' : paintOf(f),
                    opacity: f.opacity,
                    style: blendOf(f),
                    stroke: 'none',
                  })
                )}
                {/* Render Strokes */}
                {isSlice ? (
                  renderOutline({
                    fill: 'none',
                    stroke: accentColor,
                    strokeWidth: 1.5,
                    strokeDasharray: '4 4',
                  })
                ) : isSection ? (
                  renderOutline({
                    fill: 'none',
                    stroke: accentColor,
                    strokeWidth: 1.5,
                    strokeDasharray: '6 4',
                  })
                ) : (
                  renderShapeStrokes(renderOutline, { x: s.x, y: s.y, width: s.width, height: s.height }, 'rect')
                )}
                {isSection && (
                  <g pointerEvents="none">
                    <rect x={s.x} y={s.y} width={Math.min(90, s.width)} height={18 / zoom} fill={accentColor + '33'} rx={4} />
                    <text x={s.x + 6} y={s.y + 13 / zoom} fill={accentColor} fontSize={10 / zoom} fontFamily="'Poppins', sans-serif" fontWeight={600}>
                      {s.name || 'Section'}
                    </text>
                  </g>
                )}
              </g>
            );
          } else if (s.type === 'ellipse') {
            const cx = s.x + s.width / 2;
            const cy = s.y + s.height / 2;
            const rx = Math.max(0, s.width / 2);
            const ry = Math.max(0, s.height / 2);
            const arcSpec = { start: s.arcStart, end: s.arcEnd, inner: s.arcInner };
            const renderOutline = (props: any) =>
              hasArc(arcSpec) ? <path d={ellipseArcPath(cx, cy, rx, ry, arcSpec)} fillRule="evenodd" {...props} /> : <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...props} />;

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
                    style: blendOf(f),
                    stroke: 'none',
                  })
                )}
                {renderShapeStrokes(renderOutline, { x: s.x, y: s.y, width: s.width, height: s.height }, 'ellipse')}
              </g>
            );
          } else if (s.type === 'line') {
            const lineColor = strokesToRender[0]?.color || s.stroke;
            const lineW = strokesToRender[0]?.width !== undefined ? strokesToRender[0].width! : (s.strokeWidth ?? 1);
            const lineDirs = pathEndDirections([{ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y + s.height }]);
            el = (
              <g {...common}>
                {renderCaps(s, [{ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y + s.height }], lineDirs, lineColor, lineW)}
                {strokesToRender.map((st, i) => {
                  const sw = st.width !== undefined ? st.width : (s.strokeWidth ?? 1);
                  return (
                    <line
                      key={st.id || i}
                      x1={s.x}
                      y1={s.y}
                      x2={s.x + s.width}
                      y2={s.y + s.height}
                      stroke={st.color}
                      strokeWidth={sw}
                      strokeOpacity={st.opacity ?? 1}
                      strokeDasharray={strokeDash}
                    />
                  );
                })}
              </g>
            );
          } else if (s.type === 'arrow') {
            const x1 = s.x;
            const y1 = s.y;
            const x2 = s.x + s.width;
            const y2 = s.y + s.height;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = 12 / zoom;
            const p1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
            const p1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
            const p2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
            const p2y = y2 - headLen * Math.sin(angle + Math.PI / 6);

            el = (
              <g {...common}>
                {strokesToRender.map((st, i) => {
                  const sw = st.width !== undefined ? st.width : (s.strokeWidth ?? 1);
                  return (
                    <g key={st.id || i}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={st.color} strokeWidth={sw} strokeOpacity={st.opacity ?? 1} strokeDasharray={strokeDash} />
                      <polygon points={`${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`} fill={st.color} opacity={st.opacity ?? 1} />
                    </g>
                  );
                })}
              </g>
            );
          } else if (s.type === 'polygon') {
            const pts = getPolygonPoints(s.x + s.width / 2, s.y + s.height / 2, Math.min(s.width, s.height) / 2, s.polygonSides ?? 3);
            const polyRound = roundedPolygonPath(pts, s.cornerRadius || 0);
            const renderOutline = (props: any) => (polyRound ? <path d={polyRound} {...props} /> : <polygon points={pts} {...props} />);

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
                    style: blendOf(f),
                    stroke: 'none',
                  })
                )}
                {renderShapeStrokes(renderOutline, { x: s.x, y: s.y, width: s.width, height: s.height }, 'polygon')}
              </g>
            );
          } else if (s.type === 'star') {
            const rOuter = Math.min(s.width, s.height) / 2;
            const pts = getStarPoints(
              s.x + s.width / 2,
              s.y + s.height / 2,
              rOuter,
              rOuter * (s.starInnerRatio ?? 0.5),
              s.starPoints ?? 5
            );
            const starRound = roundedPolygonPath(pts, s.cornerRadius || 0);
            const renderOutline = (props: any) => (starRound ? <path d={starRound} {...props} /> : <polygon points={pts} {...props} />);

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
                    style: blendOf(f),
                    stroke: 'none',
                  })
                )}
                {renderShapeStrokes(renderOutline, { x: s.x, y: s.y, width: s.width, height: s.height }, 'star')}
              </g>
            );
          } else if (s.type === 'image') {
            el = (
              <g {...common}>
                {s.imageUrl && s.imageCrop ? (
                  (() => {
                    // Recorte: a imagem é ampliada para que a região recortada preencha o shape
                    const c = s.imageCrop;
                    const cw = Math.max(0.01, c.w);
                    const ch = Math.max(0.01, c.h);
                    const cid = `clipi-${s.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                    return (
                      <>
                        <defs>
                          <clipPath id={cid}>
                            <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={capRadius(s.width, s.height, s.cornerRadius)} />
                          </clipPath>
                          {hasAdjust(s.imageAdjust) && <g dangerouslySetInnerHTML={{ __html: imageFilterMarkup(`${cid}-adj`, s.imageAdjust) }} />}
                        </defs>
                        <g clipPath={`url(#${cid})`}>
                          <image
                            filter={hasAdjust(s.imageAdjust) ? `url(#${cid}-adj)` : undefined}
                            href={s.imageUrl}
                            x={s.x - (c.x / cw) * s.width}
                            y={s.y - (c.y / ch) * s.height}
                            width={s.width / cw}
                            height={s.height / ch}
                            preserveAspectRatio="none"
                          />
                        </g>
                      </>
                    );
                  })()
                ) : s.imageUrl ? (
                  (() => {
                    // sem recorte: ainda respeita o raio da borda e os ajustes de imagem
                    const cid = `clipj-${s.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                    return (
                      <>
                        <defs>
                          <clipPath id={cid}>
                            <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={capRadius(s.width, s.height, s.cornerRadius)} />
                          </clipPath>
                          {hasAdjust(s.imageAdjust) && <g dangerouslySetInnerHTML={{ __html: imageFilterMarkup(`${cid}-adj`, s.imageAdjust) }} />}
                        </defs>
                        <g clipPath={`url(#${cid})`}>
                          <image
                            href={s.imageUrl}
                            x={s.x}
                            y={s.y}
                            width={s.width}
                            height={s.height}
                            preserveAspectRatio={s.imageFit === 'stretch' ? 'none' : s.imageFit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'}
                            filter={hasAdjust(s.imageAdjust) ? `url(#${cid}-adj)` : undefined}
                          />
                        </g>
                      </>
                    );
                  })()
                ) : (
                  <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill || '#333333'} rx={capRadius(s.width, s.height, s.cornerRadius)} />
                )}
              </g>
            );
          } else if (s.type === 'path') {
            const sx = s.width / (s.pathW || 1);
            const sy = s.height / (s.pathH || 1);
            el = (
              <g {...common}>
                <g transform={`translate(${s.x}, ${s.y}) scale(${sx}, ${sy})`}>
                  {fillsToRender.map((f, i) => (
                    <path key={f.id || i} d={s.pathD} fillRule="evenodd" fill={paintOf(f)} opacity={f.opacity} style={blendOf(f)} stroke="none" />
                  ))}
                  {strokesToRender.map((st, i) => (
                    <path
                      key={st.id || i}
                      d={s.pathD}
                      fill="none"
                      stroke={strokePaintOf(st)}
                      style={blendOf(st)}
                      strokeWidth={st.width ?? s.strokeWidth ?? 1}
                      opacity={st.opacity}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin={strokeJoin}
                      strokeDasharray={strokeDash}
                    />
                  ))}
                </g>
              </g>
            );
          } else if (s.type === 'group') {
            // Grupos não têm aparência própria; só uma área clicável invisível
            // do tamanho da união dos filhos (calculada em groupBounds).
            el = <rect {...common} x={s.x} y={s.y} width={s.width} height={s.height} fill="transparent" stroke="none" />;
          } else if (s.type === 'comment' || s.type === 'annotation' || s.type === 'measurement') {
            el = (
              <g {...common}>
                <circle cx={s.x + 14} cy={s.y + 14} r={14} fill={accentColor} />
                <path d="M10 14C10 11.5 11.8 9.5 14 9.5C16.2 9.5 18 11.5 18 14C18 15 17.5 15.8 16.7 16.3L17.2 18.5L15.2 17.3C14.8 17.4 14.4 17.5 14 17.5C11.8 17.5 10 15.5 10 14Z" fill="#ffffff" />
                <text x={s.x + 34} y={s.y + 18} fill="#ffffff" fontSize={12} fontFamily="'Poppins', sans-serif" fontWeight={500}>
                  {s.text || 'Comentário'}
                </text>
              </g>
            );
          } else if (s.type === 'text' || s.type === 'text-path') {
            const fontFamily = s.fontFamily ? (s.fontFamily.includes(' ') ? `'${s.fontFamily}', sans-serif` : `${s.fontFamily}, sans-serif`) : "'Inter', sans-serif";
            const fontWeight = s.fontWeight || 400;
            const fontStyle = s.slant ? `oblique ${s.slant}deg` : (s.fontStyle || 'normal');
            const letterSpacing = s.letterSpacing || undefined;
            const textDecoration = s.textDecoration && s.textDecoration !== 'none' ? s.textDecoration : undefined;

            let textAnchor: 'start' | 'middle' | 'end' = 'start';
            let posX = s.x;
            if (s.textAlign === 'center') {
              textAnchor = 'middle';
              posX = s.x + (s.width > 0 ? s.width / 2 : 0);
            } else if (s.textAlign === 'right') {
              textAnchor = 'end';
              posX = s.x + (s.width > 0 ? s.width : 0);
            }

            let dominantBaseline: 'alphabetic' | 'central' | 'hanging' | 'auto' = 'alphabetic';
            let posY = s.y + (s.fontSize || 18);
            if (s.textAlignVertical === 'middle' && s.height > 0) {
              dominantBaseline = 'central';
              posY = s.y + s.height / 2;
            } else if (s.textAlignVertical === 'bottom' && s.height > 0) {
              dominantBaseline = 'auto';
              posY = s.y + s.height;
            } else if (s.textAlignVertical === 'top') {
              dominantBaseline = 'hanging';
              posY = s.y;
            }

            if (s.textVerticalTrim === 'cap-height' && (!s.textAlignVertical || s.textAlignVertical === 'top')) {
              dominantBaseline = 'alphabetic';
              posY = s.y + CAP_HEIGHT * (s.fontSize || 18);
            }

            let displayText = s.text || 'Texto';
            if (s.textCase === 'uppercase') {
              displayText = displayText.toUpperCase();
            } else if (s.textCase === 'lowercase') {
              displayText = displayText.toLowerCase();
            } else if (s.textCase === 'title') {
              displayText = displayText.replace(/\b\w/g, (c) => c.toUpperCase());
            }

            if (s.listStyle === 'bullet') {
              displayText = displayText.split('\n').map((line) => `• ${line}`).join('\n');
            } else if (s.listStyle === 'numbered') {
              displayText = displayText.split('\n').map((line, idx) => `${idx + 1}. ${line}`).join('\n');
            }

            const lines = displayText.split('\n');
            const lineH = s.fontSize ? s.fontSize * 1.25 : 22;

            if (s.type === 'text-path') {
              // Texto sobre uma curva: arco quadrático da esquerda para a direita; pathCurve > 0 sobe, < 0 desce
              const curve = s.pathCurve ?? 60;
              const baseY = s.y + Math.max(s.height, (s.fontSize || 18) * 1.5);
              const pid = `tp-${s.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
              const w = Math.max(s.width, 120);
              const target = s.pathTargetId ? displayShapes.find((x) => x.id === s.pathTargetId) : undefined;
              const targetD = target ? pathDOf(target) : null;
              el = (
                <g {...common}>
                  <defs>
                    <path id={pid} d={targetD || `M ${s.x} ${baseY} Q ${s.x + w / 2} ${baseY - curve * 2} ${s.x + w} ${baseY}`} />
                  </defs>
                  <text
                    fontSize={s.fontSize || 18}
                    fill={s.fill}
                    fontFamily={fontFamily}
                    fontWeight={fontWeight}
                    fontStyle={fontStyle}
                    letterSpacing={letterSpacing}
                    textDecoration={textDecoration}
                  >
                    <textPath href={`#${pid}`} startOffset={textAnchor === 'middle' ? '50%' : textAnchor === 'end' ? '100%' : '0%'} textAnchor={textAnchor}>
                      {lines.join(' ')}
                    </textPath>
                  </text>
                </g>
              );
            } else
            el = (
              <text
                {...common}
                x={posX}
                y={posY}
                fontSize={s.fontSize || 18}
                fill={s.fill}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                fontStyle={fontStyle}
                letterSpacing={letterSpacing}
                textDecoration={textDecoration}
                textAnchor={textAnchor}
                dominantBaseline={dominantBaseline}
                style={{ fontVariationSettings: variationSettings(s.fontVariations), fontFeatureSettings: featureSettings(s.fontFeatures) } as React.CSSProperties}
              >
                {s.runs?.length && !s.listStyle ? (
                  lineSegments(displayText, s.runs).map((segs, idx) =>
                    segs.map((seg, j) => (
                      <tspan
                        key={`${idx}-${j}`}
                        x={j === 0 ? posX : undefined}
                        dy={j === 0 ? (idx === 0 ? 0 : lineH) : undefined}
                        fontWeight={seg.style.fontWeight}
                        fontStyle={seg.style.fontStyle}
                        fill={seg.style.fill ?? (seg.style.href ? '#2f80ed' : undefined)}
                        fontSize={seg.style.fontSize}
                        textDecoration={seg.style.href && !seg.style.textDecoration ? 'underline' : seg.style.textDecoration}
                      >
                        {seg.text}
                      </tspan>
                    ))
                  )
                ) : lines.length > 1 ? (
                  lines.map((line, idx) => (
                    <tspan key={idx} x={posX} dy={idx === 0 ? 0 : lineH}>
                      {line}
                    </tspan>
                  ))
                ) : (
                  displayText
                )}
              </text>
            );
          } else {
            const penColor = visibleStrokes[0] ? strokePaintOf(visibleStrokes[0]) : s.stroke || accentColor;
            const penWidth = visibleStrokes[0]?.width !== undefined ? visibleStrokes[0].width : (s.strokeWidth ?? 2);
            const hasVector = !!s.closed || !!s.pathHandles?.some(Boolean);
            const d = hasVector ? pathFromVector(s.points || [], s.pathHandles, !!s.closed, !!s.smooth) : pathFromPoints(s.points || [], s.smooth);
            const profilePath = !s.closed && s.widthProfile ? variableWidthPath(flattenVector(s.points || [], s.pathHandles, false, !!s.smooth), penWidth, s.widthProfile) : undefined;
            const penCaps = s.closed || profilePath ? null : renderCaps(s, s.points || [], pathEndDirections(s.points || [], s.pathHandles), penColor, penWidth);
            el = s.closed ? (
              <g {...common}>
                {fillsToRender.map((f, i) => (
                  <path key={f.id || i} d={d} fill={paintOf(f)} opacity={f.opacity} style={blendOf(f)} stroke="none" />
                ))}
                <path d={d} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin={strokeJoin} strokeDasharray={strokeDash} />
              </g>
            ) : profilePath ? (
              <g {...common}>
                <path d={profilePath} fill={penColor} stroke="none" />
                {/* área de clique do traço fino */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(8 / zoom, penWidth)} />
              </g>
            ) : (
              <g {...common}>
                <path d={d} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin={strokeJoin} strokeDasharray={strokeDash} />
                {penCaps}
              </g>
            );
          }

          const showControls = isSelected && s.id !== editingTextId && activeSelectedIds.length === 1 && !readOnly && !s.locked && s.type !== 'pen' && s.type !== 'pencil';
          const canResizeCorners = s.type === 'rect' || s.type === 'frame' || s.type === 'section' || s.type === 'image';

          // Frames com "recortar conteúdo": todos os descendentes ficam dentro da borda (o recorte envolve o elemento
          // INTEIRO, inclusive sombras/efeitos e rotação, para um brilho não vazar para fora da tela do aparelho)
          const clippers: Shape[] = [];
          for (let anc = s.parentId ? displayById.get(s.parentId) : undefined, guard = 0; anc && guard < 50; anc = anc.parentId ? displayById.get(anc.parentId) : undefined, guard++) {
            if (anc.clipContent) clippers.push(anc);
          }
          const node = (
            <g
              transform={s.rotation ? `rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})` : undefined}
              style={{ filter: canvasFilter }}
            >
              {gradientDefs}
              {patternDefs}
              {bgBlurLayers}
              {htmlGradientLayers}
              {fxFilterMarkup && <defs dangerouslySetInnerHTML={{ __html: fxFilterMarkup }} />}
              {(() => {
                const idPart = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
                // Máscara: o shape de máscara mais próximo abaixo (mesmo pai) recorta este shape
                const maskShape = s.isMask
                  ? undefined
                  : displayShapes
                      .filter((m) => m.isMask && m.id !== s.id && (m.parentId || '') === (s.parentId || '') && m.zIndex < s.zIndex)
                      .sort((a, b) => b.zIndex - a.zIndex)[0];
                const maskKinds = ['rect', 'frame', 'section', 'image', 'ellipse', 'polygon', 'star', 'path'];
                const maskGeometry: React.ReactNode = maskShape && maskKinds.includes(maskShape.type) ? outlineGeometry(maskShape) : null;
                // imagem de fundo numa forma: recortada pelo contorno, com recorte/ajuste e filtros da imagem
                if (imageFillShape) {
                  const iid = `imgf-${idPart}`;
                  const c = s.imageCrop;
                  const cw = c ? Math.max(0.01, c.w) : 1;
                  const ch = c ? Math.max(0.01, c.h) : 1;
                  const adj = imageFilterMarkup(`${iid}-adj`, s.imageAdjust);
                  el = (
                    <>
                      <defs>
                        <clipPath id={`${iid}-clip`}>{outlineGeometry(s)}</clipPath>
                        {adj && <g dangerouslySetInnerHTML={{ __html: adj }} />}
                      </defs>
                      <g clipPath={`url(#${iid}-clip)`} opacity={s.fills?.[0]?.opacity ?? 1}>
                        <image
                          href={s.imageUrl}
                          x={c ? s.x - (c.x / cw) * s.width : s.x}
                          y={c ? s.y - (c.y / ch) * s.height : s.y}
                          width={s.width / cw}
                          height={s.height / ch}
                          preserveAspectRatio={c || s.imageFit === 'stretch' ? 'none' : s.imageFit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'}
                          filter={adj ? `url(#${iid}-adj)` : undefined}
                        />
                      </g>
                      {el}
                    </>
                  );
                }
                // vídeo de fundo: <video> em laço, recortado pelo contorno (a exportação estática usa só o preenchimento)
                if (s.videoUrl && !hideOverlays && ['rect', 'frame', 'section', 'ellipse', 'polygon', 'star', 'path', 'image'].includes(s.type)) {
                  const vid = `vid-${idPart}`;
                  el = (
                    <>
                      <defs>
                        <clipPath id={`${vid}-clip`}>{outlineGeometry(s)}</clipPath>
                      </defs>
                      {el}
                      <g clipPath={`url(#${vid}-clip)`} pointerEvents="none">
                        <foreignObject x={s.x} y={s.y} width={Math.max(1, s.width)} height={Math.max(1, s.height)}>
                          <video
                            {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as object)}
                            src={s.videoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: s.imageFit === 'fit' ? 'contain' : s.imageFit === 'stretch' ? 'fill' : 'cover', display: 'block' }}
                          />
                        </foreignObject>
                      </g>
                    </>
                  );
                }
                if (!maskGeometry) return el;
                let out: React.ReactNode = el;
                const defs: React.ReactNode[] = [];
                if (maskGeometry) {
                  const mt = maskShape!.maskType;
                  if (mt === 'alpha' || mt === 'luminance') {
                    // máscara pelo preenchimento: luminance usa a cor (branco mostra, preto esconde); alpha usa só a opacidade
                    const mf = maskShape!.fills?.find((x) => x.visible !== false);
                    const mColor = mt === 'alpha' ? '#ffffff' : mf?.gradientStops?.[0]?.color || mf?.color || maskShape!.fill || '#ffffff';
                    const mOpacity = mf ? mf.opacity : 1;
                    defs.push(
                      <mask key="m" id={`maskm-${idPart}`} maskUnits="userSpaceOnUse" x={-100000} y={-100000} width={200000} height={200000} style={{ maskType: mt === 'alpha' ? 'alpha' : 'luminance' } as React.CSSProperties}>
                        <g fill={mColor} fillOpacity={mOpacity}>{maskGeometry}</g>
                      </mask>
                    );
                    out = <g mask={`url(#maskm-${idPart})`}>{out}</g>;
                  } else {
                    defs.push(<clipPath key="m" id={`clipm-${idPart}`}>{maskGeometry}</clipPath>);
                    out = <g clipPath={`url(#clipm-${idPart})`}>{out}</g>;
                  }
                }
                return (
                  <>
                    <defs>{defs}</defs>
                    {out}
                  </>
                );
              })()}
            </g>
          );
          // borda e alças de seleção ficam FORA do recorte (clipContent dos pais), para continuarem visíveis em formas cortadas
          const selUi = (
            <g transform={s.rotation ? `rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})` : undefined}>
              {isSelected && s.id !== editingTextId && (
                pathD ? (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={1.5 / zoom}
                    pointerEvents="none"
                  />
                ) : (
                  <rect
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    rx={capRadius(s.width, s.height, s.cornerRadius)}
                    ry={capRadius(s.width, s.height, s.cornerRadius)}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={1.5 / zoom}
                    pointerEvents="none"
                  />
                )
              )}

              {/* Nós editáveis do traço (pen/pencil): arraste para mover, Alt+clique remove */}
              {isSelected && activeSelectedIds.length === 1 && !readOnly && !s.locked && (s.type === 'pen' || s.type === 'pencil') && s.points && (
                <g pointerEvents="all">
                  {/* Alças Bézier: linha do nó à alça e um ponto arrastável (Alt = independente) */}
                  {s.points.map((pt, i) =>
                    (['in', 'out'] as const).map((which) => {
                      const h = s.pathHandles?.[i]?.[which];
                      if (!h) return null;
                      const hx = pt.x + h.x;
                      const hy = pt.y + h.y;
                      return (
                        <g key={`h-${i}-${which}`}>
                          <line x1={pt.x} y1={pt.y} x2={hx} y2={hy} stroke={accentColor} strokeWidth={1 / zoom} pointerEvents="none" />
                          <circle
                            cx={hx}
                            cy={hy}
                            r={3 / zoom}
                            fill={accentColor}
                            stroke="#ffffff"
                            strokeWidth={1 / zoom}
                            style={{ cursor: 'crosshair' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDrag({ kind: 'handle', shapeId: s.id, index: i, which });
                            }}
                          />
                        </g>
                      );
                    })
                  )}
                  {s.points.map((pt, i) => (
                    <circle
                      key={`node-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3.5 / zoom}
                      fill={selNode?.id === s.id && selNode.index === i ? accentColor : '#ffffff'}
                      stroke={accentColor}
                      strokeWidth={1.2 / zoom}
                      style={{ cursor: 'move' }}
                      onDoubleClick={(e) => {
                        // duplo clique no nó: alterna entre canto e suave (alças espelhadas)
                        e.stopPropagation();
                        if (Date.now() - penFinishedAt.current < 700) return;
                        const handles = toggleNodeSmooth(s.points!, s.pathHandles, i, !!s.closed);
                        updateShape(s.id, { pathHandles: handles, ...bboxOfPath(s, s.points, handles) }, true);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelNode({ id: s.id, index: i });
                        if (e.altKey) {
                          if ((s.points?.length || 0) <= 2) return;
                          const rm = removeNode(s.points!, s.pathHandles, i);
                          updateShape(s.id, { points: rm.points, pathHandles: rm.handles, ...bboxOfPath(s, rm.points, rm.handles) }, true);
                          return;
                        }
                        setDrag({ kind: 'node', shapeId: s.id, index: i });
                      }}
                    />
                  ))}
                </g>
              )}

              {/* CONTROLES DO ELEMENTO SELECIONADO (dentro da mesma rotação do shape) */}
              {showControls && (
                <g pointerEvents="all">
                  {/* Pílula Flutuante de Dimensões Embaixo */}
                  <g transform={`translate(${s.x + s.width / 2}, ${s.y + s.height + 14 / zoom})`} pointerEvents="none">
                    <rect x={-42 / zoom} y={-8 / zoom} width={84 / zoom} height={16 / zoom} rx={3 / zoom} fill={accentColor} />
                    <text
                      x={0}
                      y={3 / zoom}
                      fill="#ffffff"
                      fontSize={10 / zoom}
                      fontWeight={600}
                      fontFamily="'Poppins', sans-serif"
                      textAnchor="middle"
                    >
                      {`${Math.round(s.width)} × ${Math.round(s.height)}`}
                    </text>
                  </g>

                  {/* 4 Alças de Redimensionamento nos Cantos */}
                  {[
                    { id: 'nw', x: s.x, y: s.y, cursor: 'nwse-resize' },
                    { id: 'ne', x: s.x + s.width, y: s.y, cursor: 'nesw-resize' },
                    { id: 'sw', x: s.x, y: s.y + s.height, cursor: 'nesw-resize' },
                    { id: 'se', x: s.x + s.width, y: s.y + s.height, cursor: 'nwse-resize' },
                  ].map((h) => (
                    <circle
                      key={h.id}
                      cx={h.x}
                      cy={h.y}
                      r={4 / zoom}
                      fill="#ffffff"
                      stroke={accentColor}
                      strokeWidth={1.5 / zoom}
                      style={{ cursor: h.cursor }}
                      onMouseDown={(e) => handleResizeDown(e, s, h.id)}
                    />
                  ))}

                  {/* 4 Alças Internas de Corner Radius */}
                  {canResizeCorners && s.width > 40 && s.height > 40 && (
                    <>
                      {[
                        { cx: s.x + 18 / zoom, cy: s.y + 18 / zoom },
                        { cx: s.x + s.width - 18 / zoom, cy: s.y + 18 / zoom },
                        { cx: s.x + 18 / zoom, cy: s.y + s.height - 18 / zoom },
                        { cx: s.x + s.width - 18 / zoom, cy: s.y + s.height - 18 / zoom },
                      ].map((pos, idx) => (
                        <circle
                          key={`radius-${idx}`}
                          cx={pos.cx}
                          cy={pos.cy}
                          r={3.5 / zoom}
                          fill="#ffffff"
                          stroke={accentColor}
                          strokeWidth={1.2 / zoom}
                          style={{ cursor: 'pointer' }}
                          onMouseDown={(e) => handleRadiusDown(e, s)}
                        />
                      ))}
                    </>
                  )}
                </g>
              )}
            </g>
          );
          const lodImg = lodRoot.get(s.id) === s.id && !isSelected ? lodSnapshot(s) : null;
          const nodeOut = lodImg ? (<>{node}{lodImg}</>) : node;
          if (clippers.length === 0) return <React.Fragment key={s.id}>{nodeOut}{selUi}</React.Fragment>;
          const cid = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
          let wrapped: React.ReactNode = nodeOut;
          clippers.forEach((c, i) => {
            wrapped = <g clipPath={`url(#clipc-${cid}-${i})`}>{wrapped}</g>;
          });
          return (
            <g key={s.id}>
              <defs>
                {clippers.map((c, i) => (
                  <clipPath key={i} id={`clipc-${cid}-${i}`}>
                    <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={capRadius(c.width, c.height, c.cornerRadius)} />
                  </clipPath>
                ))}
              </defs>
              {wrapped}
              {selUi}
            </g>
          );
        })}

        {/* Caixa de Seleção por Área enquanto arrasta (Marquee Selection) */}
        {drag.kind === 'marquee' && (
          <rect
            x={Math.min(drag.startX, drag.currentX)}
            y={Math.min(drag.startY, drag.currentY)}
            width={Math.abs(drag.currentX - drag.startX)}
            height={Math.abs(drag.currentY - drag.startY)}
            fill={accentColor + '18'}
            stroke={accentColor}
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
        )}

        {/* Ligações do protótipo: seta do elemento até o frame de destino (realçada quando o elemento está selecionado) */}
        {!hideOverlays && !readOnly && protoArrows(shapes).map((a) => {
          const hot = activeSelectedIds.includes(a.fromId) || activeSelectedIds.includes(a.toId);
          return (
            <g key={a.key} pointerEvents="none" opacity={hot ? 1 : 0.35}>
              <path d={a.d} fill="none" stroke={accentColor} strokeWidth={(hot ? 2 : 1.2) / zoom} strokeDasharray={a.kind === 'overlay' ? `${6 / zoom} ${4 / zoom}` : undefined} />
              <polygon points={`0,0 ${-9 / zoom},${-4.5 / zoom} ${-9 / zoom},${4.5 / zoom}`} fill={accentColor} transform={`translate(${a.tip.x} ${a.tip.y}) rotate(${a.tip.angle})`} />
            </g>
          );
        })}

        {/* Alça de rotação: acima da seleção; vários elementos giram juntos ao redor do centro do conjunto */}
        {!readOnly && !editingTextId && activeSelectedIds.length > 0 && (() => {
          const sel = shapes.filter((x) => activeSelectedIds.includes(x.id) && x.visible !== false);
          if (!sel.length || sel.some((x) => x.locked || x.type === 'comment' || x.type === 'annotation' || x.type === 'measurement')) return null;
          const single = sel.length === 1 ? sel[0] : null;
          if (single && (single.type === 'pen' || single.type === 'pencil')) return null;
          const box = unionBox(sel.map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height })));
          const pivot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          const r = ((single?.rotation || 0) * Math.PI) / 180;
          const off = box.height / 2 + 26 / zoom;
          const pos = { x: pivot.x + off * Math.sin(r), y: pivot.y - off * Math.cos(r) };
          const edge = { x: pivot.x + (box.height / 2) * Math.sin(r), y: pivot.y - (box.height / 2) * Math.cos(r) };
          const active = drag.kind === 'rotate';
          return (
            <g pointerEvents="all">
              <line x1={edge.x} y1={edge.y} x2={pos.x} y2={pos.y} stroke={accentColor} strokeWidth={1 / zoom} pointerEvents="none" />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={5 / zoom}
                fill={active ? accentColor : '#ffffff'}
                stroke={accentColor}
                strokeWidth={1.5 / zoom}
                style={{ cursor: active ? 'grabbing' : 'grab' }}
                onMouseDown={(e) => handleRotateDown(e, sel.map((x) => x.id), pivot)}
              >
                <title>Girar (Shift = 15°)</title>
              </circle>
              {active && (
                <text x={pos.x + 10 / zoom} y={pos.y + 4 / zoom} fontSize={11 / zoom} fill={accentColor} fontFamily="'Poppins', sans-serif" fontWeight={600} pointerEvents="none">
                  {`${Math.round((single?.rotation ?? 0))}°`}
                </text>
              )}
            </g>
          );
        })()}

        {/* Frame em que a IA está trabalhando: contorno que pulsa */}
        {[...(glowIds || [])].map((gid) => {
          const f = shapes.find((x) => x.id === gid);
          if (!f || f.visible === false) return null;
          const r = Math.max(f.cornerRadius || 0, 12);
          return (
            <g key={`glow-${gid}`} pointerEvents="none" className="ai-glow" style={{ color: accentColor }}>
              <rect x={f.x} y={f.y} width={f.width} height={f.height} rx={r} fill="none" stroke="currentColor" strokeWidth={3 / zoom} />
            </g>
          );
        })}

        {/* Aceitar / regerar telas geradas pela IA: botões acima do frame, em tamanho fixo na tela */}
        {(aiReview || []).map((r) => {
          const f = shapes.find((x) => x.id === r.id);
          if (!f || f.visible === false) return null;
          const W = r.canUndo ? 332 : 214;
          const H = 32;
          const btn: React.CSSProperties = { height: H, border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: r.busy ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: 6 };
          return (
            <foreignObject key={`air-${r.id}`} x={f.x} y={f.y - (H + 14) / zoom} width={W / zoom} height={H / zoom} style={{ overflow: 'visible' }}>
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{ width: W, height: H, transform: `scale(${1 / zoom})`, transformOrigin: 'top left', display: 'flex', gap: 6 }}
              >
                <button type="button" disabled={r.busy} onClick={() => onAiAccept?.(r.id)} style={{ ...btn, background: accentColor, color: '#fff', opacity: r.busy ? 0.5 : 1 }}>✓ Aceitar</button>
                <button type="button" disabled={r.busy} onClick={() => onAiRegenerate?.(r.id)} style={{ ...btn, background: 'rgba(24,24,27,0.92)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', opacity: r.busy ? 0.5 : 1 }}>{r.busy ? 'Gerando…' : '↻ Regerar'}</button>
                {r.canUndo && (
                  <button type="button" disabled={r.busy} title="Voltar para a tela de antes da regeração" onClick={() => onAiUndo?.(r.id)} style={{ ...btn, background: 'rgba(24,24,27,0.92)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', opacity: r.busy ? 0.5 : 1 }}>↶ Desfazer</button>
                )}
              </div>
            </foreignObject>
          );
        })}

        {/* Menu "⋯" do frame de topo selecionado: regerar com IA ou excluir */}
        {!readOnly && activeSelectedIds.length === 1 && (() => {
          const f = shapes.find((x) => x.id === activeSelectedIds[0]);
          if (!f || f.type !== 'frame' || f.parentId || f.visible === false || f.deviceScreen) return null;
          const BW = 26;
          const BH = 22;
          const open = frameMenuFor === f.id;
          // mesmo padrão visual dos menus do sistema (FigmaContextMenu)
          const bgMenu = isEffectiveDark ? '#1a1a1a' : '#ffffff';
          const textPrimary = isEffectiveDark ? '#f1f1f1' : '#1e293b';
          const hoverBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
          const borderCol = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
          const dividerBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';
          const danger = isEffectiveDark ? '#f87171' : '#dc2626';
          const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', height: 27, boxSizing: 'border-box', borderRadius: 5, fontSize: 12, fontWeight: 400, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", color: textPrimary, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', transition: 'background 0.1s ease' };
          return (
            <foreignObject key={`fm-${f.id}`} x={f.x + f.width - 220 / zoom} y={f.y - (BH + 6) / zoom} width={220 / zoom} height={150 / zoom} style={{ overflow: 'visible', pointerEvents: 'none' }}>
              <div data-frame-menu style={{ width: 220, height: 150, transform: `scale(${1 / zoom})`, transformOrigin: 'top left', position: 'relative', pointerEvents: 'none' }}>
                <button
                  type="button"
                  title="Mais opções do frame"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setFrameMenuFor(open ? null : f.id); }}
                  style={{ position: 'absolute', right: 0, top: 0, width: BW, height: BH, borderRadius: 6, border: `1px solid ${open ? accentColor : borderCol}`, background: open ? accentColor : bgMenu, color: open ? '#fff' : textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', padding: 0, transition: 'all 0.12s ease' }}
                >
                  <MoreHorizontal size={14} />
                </button>
                {open && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', right: 0, top: BH + 4, minWidth: 190, background: bgMenu, border: `1px solid ${borderCol}`, borderRadius: 8, boxShadow: isEffectiveDark ? '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)' : '0 10px 25px rgba(0, 0, 0, 0.15)', padding: 4, pointerEvents: 'auto' }}
                  >
                    <div
                      style={row}
                      onClick={(e) => { e.stopPropagation(); setFrameMenuFor(null); onFrameRegenerate?.(f.id); }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <RefreshCw size={13} />
                      <span>Regerar com IA</span>
                    </div>
                    <div style={{ height: 1, background: dividerBg, margin: '4px 6px' }} />
                    <div
                      style={{ ...row, color: danger }}
                      onClick={(e) => { e.stopPropagation(); setFrameMenuFor(null); onFrameDelete?.(f.id); }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(248, 113, 113, 0.12)' : 'rgba(220, 38, 38, 0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Trash2 size={13} />
                      <span>Excluir frame</span>
                    </div>
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })()}

        {/* Bounding Box Multi-Seleção (Estilo Figma) */}
        {multiBounds && (
          <g pointerEvents="none">
            <rect
              x={multiBounds.x}
              y={multiBounds.y}
              width={multiBounds.width}
              height={multiBounds.height}
              fill="none"
              stroke={accentColor}
              strokeWidth={1 / zoom}
              strokeDasharray={`${5 / zoom} ${3 / zoom}`}
            />
            {/* Pílula Flutuante Multi-Seleção */}
            <g transform={`translate(${multiBounds.x + multiBounds.width / 2}, ${multiBounds.y + multiBounds.height + 16 / zoom})`}>
              <rect x={-55 / zoom} y={-9 / zoom} width={110 / zoom} height={18 / zoom} rx={4 / zoom} fill={accentColor} />
              <text
                x={0}
                y={4 / zoom}
                fill="#ffffff"
                fontSize={10 / zoom}
                fontWeight={600}
                fontFamily="'Poppins', sans-serif"
                textAnchor="middle"
              >
                {`${selectedShapes.length} selecionados • ${Math.round(multiBounds.width)} × ${Math.round(multiBounds.height)}`}
              </text>
            </g>
          </g>
        )}
        {/* Editor de texto sobre o canvas */}
        {editingFrameNameId && (() => {
          const f = shapes.find((x) => x.id === editingFrameNameId);
          if (!f) return null;
          const finish = (value: string, cancel = false) => {
            const id = editingFrameNameId;
            setEditingFrameNameId(null);
            const name = value.trim();
            if (cancel || !name || name === f.name) return;
            onShapesChange(shapes.map((x) => (x.id === id ? { ...x, name } : x)), true);
          };
          const W = Math.max(160, Math.min(f.width * zoom, 420));
          return (
            <foreignObject x={f.x} y={f.y - 26 / zoom} width={W / zoom} height={22 / zoom} style={{ overflow: 'visible' }}>
              <input
                autoFocus
                defaultValue={f.name}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => finish(e.currentTarget.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') e.currentTarget.blur();
                  else if (e.key === 'Escape') finish(e.currentTarget.value, true);
                }}
                style={{ width: W, height: 22, transform: `scale(${1 / zoom})`, transformOrigin: 'top left', boxSizing: 'border-box', background: '#1a1a1c', color: '#fff', border: `1px solid ${accentColor}`, borderRadius: 4, outline: 'none', fontSize: 11, fontWeight: 500, fontFamily: "'Poppins', sans-serif", padding: '0 6px' }}
              />
            </foreignObject>
          );
        })()}

        {editingTextId && (() => {
          const t = shapes.find((x) => x.id === editingTextId);
          if (!t) return null;
          const fontSize = t.fontSize || 18;
          const finish = (value: string, cancel = false) => {
            const id = editingTextId;
            setEditingTextId(null);
            if (cancel || (editingIsNew.current && value.trim() === '')) {
              // texto novo e vazio não fica no canvas
              if (editingIsNew.current && value.trim() === '') onShapesChange(shapes.filter((x) => x.id !== id), true);
              return;
            }
            const lines = value.split('\n');
            const longest = Math.max(...lines.map((l) => l.length));
            onShapesChange(
              shapes.map((x) =>
                x.id === id
                  ? { ...x, text: value, runs: normalizeRuns(editorRunsRef.current, value.length).length ? normalizeRuns(editorRunsRef.current, value.length) : undefined, width: Math.max(x.width, Math.round(longest * fontSize * 0.55)), height: Math.max(x.height, Math.round(lines.length * fontSize * 1.25)) }
                  : x
              ),
              true
            );
          };
          return (
            <foreignObject x={t.x} y={t.y - 36 / zoom} width={Math.max(t.width, 220)} height={Math.max(t.height, fontSize * 2) + 36 / zoom} style={{ overflow: 'visible' }}>
              <div>
                {/* barra de formatação do trecho selecionado (sem seleção vale para o texto todo) */}
                <div
                  ref={editorBarRef}
                  onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
                  style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left', display: 'flex', alignItems: 'center', gap: 4, height: 28, marginBottom: 6 / zoom, padding: '0 6px', width: 'fit-content', background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.4)', fontFamily: "'Poppins', sans-serif" }}
                >
                  {(() => {
                    const ta = editorTaRef.current;
                    const a = ta ? Math.min(ta.selectionStart, ta.selectionEnd) : 0;
                    const z = ta ? Math.max(ta.selectionStart, ta.selectionEnd) : 0;
                    const range = z > a ? [a, z] : [0, ta?.value.length ?? 0];
                    const len = ta?.value.length ?? Infinity;
                    const apply = (patch: Partial<Omit<TextRun, 'start' | 'end'>>) => { editorRunsRef.current = applyRunStyle(editorRunsRef.current, range[0], range[1], patch, len); bumpEditor((n) => n + 1); };
                    const toggle = (key: 'fontWeight' | 'fontStyle' | 'textDecoration', on: 700 | 'italic' | 'underline' | 'line-through') => { editorRunsRef.current = toggleRunStyle(editorRunsRef.current, range[0], range[1], key, on, len); bumpEditor((n) => n + 1); };
                    const is = (key: keyof Omit<TextRun, 'start' | 'end'>, v: unknown) => isFullyStyled(editorRunsRef.current, range[0], range[1], key, v);
                    const btn = (label: React.ReactNode, active: boolean, onClick: () => void, title: string, style?: React.CSSProperties) => (
                      <button type="button" title={title} onClick={onClick} style={{ width: 24, height: 22, border: 'none', borderRadius: 4, background: active ? accentColor : 'transparent', color: active ? '#fff' : '#ddd', fontSize: 12, cursor: 'pointer', ...style }}>{label}</button>
                    );
                    return (
                      <>
                        {btn('B', is('fontWeight', 700), () => toggle('fontWeight', 700), 'Negrito', { fontWeight: 700 })}
                        {btn('I', is('fontStyle', 'italic'), () => toggle('fontStyle', 'italic'), 'Itálico', { fontStyle: 'italic' })}
                        {btn('U', is('textDecoration', 'underline'), () => toggle('textDecoration', 'underline'), 'Sublinhado', { textDecoration: 'underline' })}
                        {btn('S', is('textDecoration', 'line-through'), () => toggle('textDecoration', 'line-through'), 'Tachado', { textDecoration: 'line-through' })}
                        <input type="color" title="Cor do trecho" defaultValue={typeof t.fill === 'string' && t.fill.startsWith('#') ? t.fill.slice(0, 7) : '#000000'} onChange={(e) => apply({ fill: e.target.value })} style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                        <input type="number" title="Tamanho do trecho" placeholder={String(fontSize)} min={4} max={400} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => apply({ fontSize: e.target.value ? Number(e.target.value) : undefined })} style={{ width: 44, height: 22, background: '#111', border: '1px solid #333', borderRadius: 4, color: '#ddd', fontSize: 11, padding: '0 4px' }} />
                        <input type="text" title="Link (URL) do trecho" placeholder="link" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => apply({ href: e.target.value.trim() || undefined })} style={{ width: 70, height: 22, background: '#111', border: '1px solid #333', borderRadius: 4, color: '#ddd', fontSize: 11, padding: '0 4px' }} />
                        {btn('✕', false, () => { editorRunsRef.current = applyRunStyle(editorRunsRef.current, range[0], range[1], { fontWeight: undefined, fontStyle: undefined, textDecoration: undefined, fill: undefined, fontSize: undefined, href: undefined }, len); bumpEditor((n) => n + 1); }, 'Limpar formatação')}
                      </>
                    );
                  })()}
                </div>
              <textarea
                ref={editorTaRef}
                autoFocus
                spellCheck
                lang="pt-BR"
                onContextMenu={(e) => e.stopPropagation()}
                defaultValue={editingIsNew.current && t.text === 'Texto' ? '' : t.text || ''}
                onFocus={(e) => e.currentTarget.select()}
                onSelect={() => bumpEditor((n) => n + 1)}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  editorRunsRef.current = adjustRuns(editorRunsRef.current, editorPrevText.current, v);
                  editorPrevText.current = v;
                }}
                onBlur={(e) => {
                  // clicar na barra de formatação (inclusive o seletor de cor) não encerra a edição
                  if (e.relatedTarget && editorBarRef.current?.contains(e.relatedTarget as Node)) return;
                  finish(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') finish(e.currentTarget.value, !editingIsNew.current);
                  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
                }}
                style={{
                  width: Math.max(t.width, 220),
                  height: Math.max(t.height, fontSize * 2),
                  boxSizing: 'border-box',
                  background: 'transparent',
                  color: t.fill,
                  border: `1px solid ${accentColor}`,
                  outline: 'none',
                  resize: 'none',
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  fontSize,
                  lineHeight: 1.25,
                  fontFamily: t.fontFamily ? `'${t.fontFamily}', sans-serif` : "'Inter', sans-serif",
                  fontWeight: (t.fontWeight as any) || 400,
                  textAlign: (t.textAlign as any) || 'left',
                }}
              />
              </div>
            </foreignObject>
          );
        })()}

        {/* Guias do usuário (arrastadas das réguas) */}
        {showUserGuides &&
          userGuides.map((g) => {
            const vertical = g.axis === 'x';
            const common = { x1: vertical ? g.pos : -100000, x2: vertical ? g.pos : 100000, y1: vertical ? -100000 : g.pos, y2: vertical ? 100000 : g.pos };
            return (
              <g key={g.id}>
                <line {...common} stroke="#00b8ff" strokeWidth={1 / zoom} pointerEvents="none" />
                {!readOnly && (
                  <line
                    {...common}
                    stroke="transparent"
                    strokeWidth={8 / zoom}
                    style={{ cursor: vertical ? 'col-resize' : 'row-resize' }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      setDrag({ kind: 'guide', id: g.id, axis: g.axis });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onUserGuidesChange?.(userGuides.filter((x) => x.id !== g.id));
                    }}
                  />
                )}
              </g>
            );
          })}
        {drag.kind === 'guide' && draggingGuidePos !== null && (
          <g transform={`translate(${drag.axis === 'x' ? draggingGuidePos : (-pan.x + 30) / zoom}, ${drag.axis === 'y' ? draggingGuidePos : (-pan.y + 30) / zoom}) scale(${1 / zoom})`} pointerEvents="none">
            <rect x={6} y={-9} width={46} height={16} rx={4} fill="#00b8ff" />
            <text x={29} y={3} fontSize={10} fill="#001018" textAnchor="middle" fontFamily="'Poppins', sans-serif" fontWeight={600}>
              {Math.round((draggingGuidePos - (drag.axis === 'x' ? rulerOriginPoint.x : rulerOriginPoint.y)) * 100) / 100}
            </text>
          </g>
        )}

        {/* Cursores dos outros participantes */}
        {(remoteCursors || []).map((c) => (
          <g key={`cursor-${c.id}`} transform={`translate(${c.x}, ${c.y}) scale(${1 / zoom})`} pointerEvents="none">
            <path d="M0 0 L0 16 L4.5 12 L7.5 19 L10 18 L7 11 L13 11 Z" fill={c.color} stroke="#fff" strokeWidth={1} />
            <rect x={14} y={14} width={Math.max(24, c.name.length * 6.5 + 10)} height={16} rx={8} fill={c.color} />
            <text x={19} y={25.5} fontSize={10} fill="#fff" fontFamily="'Poppins', sans-serif" fontWeight={600}>{c.name}</text>
          </g>
        ))}

        {/* Grades de layout dos frames (colunas, linhas, grade) */}
        {!hideOverlays && shapes.map((f) => {
          if (f.visible === false || !f.layoutGrids?.some((g) => g.visible)) return null;
          return (
            <g key={`lg-${f.id}`} pointerEvents="none">
              {f.layoutGrids.filter((g) => g.visible).map((g) => {
                if (g.kind === 'grid') {
                  const step = Math.max(1, g.size);
                  return (
                    <g key={g.id} stroke={g.color} strokeOpacity={Math.min(1, g.opacity * 2)} strokeWidth={1 / zoom}>
                      {Array.from({ length: Math.floor(f.width / step) + 1 }, (_, i) => <line key={`v${i}`} x1={f.x + i * step} x2={f.x + i * step} y1={f.y} y2={f.y + f.height} />)}
                      {Array.from({ length: Math.floor(f.height / step) + 1 }, (_, i) => <line key={`h${i}`} x1={f.x} x2={f.x + f.width} y1={f.y + i * step} y2={f.y + i * step} />)}
                    </g>
                  );
                }
                const cols = g.kind === 'columns';
                return (
                  <g key={g.id} fill={g.color} fillOpacity={g.opacity}>
                    {gridBands(g, cols ? f.x : f.y, cols ? f.width : f.height).map((b, i) => (
                      <rect key={i} x={cols ? b.start : f.x} y={cols ? f.y : b.start} width={cols ? b.size : f.width} height={cols ? f.height : b.size} />
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Grade de pixels: a partir de 800% de zoom */}
        {pixelGrid && zoom >= 8 && (
          <g pointerEvents="none">
            <defs>
              <pattern id="design-pixel-grid" width={1} height={1} patternUnits="userSpaceOnUse">
                <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(128,128,128,0.35)" strokeWidth={1 / zoom} />
              </pattern>
            </defs>
            <rect
              x={-pan.x / zoom}
              y={-pan.y / zoom}
              width={(svgRef.current?.clientWidth || 2400) / zoom}
              height={(svgRef.current?.clientHeight || 1600) / zoom}
              fill="url(#design-pixel-grid)"
            />
          </g>
        )}

        {/* Guias de encaixe (magenta, como no Figma) */}
        {guides.map((g, i) => (
          <line
            key={`guide-${i}`}
            x1={g.axis === 'x' ? g.pos : g.from}
            x2={g.axis === 'x' ? g.pos : g.to}
            y1={g.axis === 'x' ? g.from : g.pos}
            y2={g.axis === 'x' ? g.to : g.pos}
            stroke="#f24822"
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
        ))}

        {/* Vãos iguais (encaixe por espaçamento) e distâncias medidas com Alt */}
        {renderMarks(gapMarks, 'gap')}
        {renderMarks(altMarks, 'alt')}
      </g>

      {/* Réguas: marcas principais/secundárias, faixa da seleção, marcador do cursor e origem no frame */}
      {showRulers && (() => {
        const w = svgRef.current?.clientWidth || 2000;
        const h = svgRef.current?.clientHeight || 1200;
        const origin = rulerOriginPoint;
        const ticksX = rulerTicks(-pan.x / zoom, (w - pan.x) / zoom, zoom, origin.x);
        const ticksY = rulerTicks(-pan.y / zoom, (h - pan.y) / zoom, zoom, origin.y);
        const selBoxes = selectedShapes.map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height }));
        const rangeX = selectionRange(selBoxes, 'x', origin.x);
        const rangeY = selectionRange(selBoxes, 'y', origin.y);
        const bg = 'rgba(24,24,24,0.96)';
        const startGuide = (axis: 'x' | 'y') => (e: React.MouseEvent) => {
          if (e.button !== 0 || readOnly) return;
          e.stopPropagation();
          e.preventDefault();
          setDrag({ kind: 'guide', id: newGuideId(), axis });
        };
        return (
          <g fontFamily="'Poppins', sans-serif" fontSize={9} fill="#9a9a9a">
            <rect x={RULER_SIZE} y={0} width="100%" height={RULER_SIZE} fill={bg} style={{ cursor: 'row-resize' }} onMouseDown={startGuide('y')} />
            <rect x={0} y={RULER_SIZE} width={RULER_SIZE} height="100%" fill={bg} style={{ cursor: 'col-resize' }} onMouseDown={startGuide('x')} />
            <rect x={0} y={0} width={RULER_SIZE} height={RULER_SIZE} fill={bg} pointerEvents="none" />
            <g pointerEvents="none">
              {rangeX && (
                <g>
                  <rect x={pan.x + rangeX.start * zoom} y={0} width={Math.max(1, (rangeX.end - rangeX.start) * zoom)} height={RULER_SIZE} fill={accentColor} opacity={0.28} />
                  <text x={pan.x + rangeX.start * zoom - 2} y={RULER_SIZE - 5} textAnchor="end" fill={accentColor} fontWeight={600}>{rangeX.startLabel}</text>
                  <text x={pan.x + rangeX.end * zoom + 2} y={RULER_SIZE - 5} fill={accentColor} fontWeight={600}>{rangeX.endLabel}</text>
                </g>
              )}
              {rangeY && (
                <g>
                  <rect x={0} y={pan.y + rangeY.start * zoom} width={RULER_SIZE} height={Math.max(1, (rangeY.end - rangeY.start) * zoom)} fill={accentColor} opacity={0.28} />
                  <text transform={`translate(${RULER_SIZE - 5}, ${pan.y + rangeY.start * zoom - 2}) rotate(-90)`} textAnchor="start" fill={accentColor} fontWeight={600}>{rangeY.startLabel}</text>
                  <text transform={`translate(${RULER_SIZE - 5}, ${pan.y + rangeY.end * zoom + 2}) rotate(-90)`} textAnchor="end" fill={accentColor} fontWeight={600}>{rangeY.endLabel}</text>
                </g>
              )}
              {ticksX.map((t) => {
                const x = pan.x + t.value * zoom;
                if (x < RULER_SIZE) return null;
                return (
                  <g key={`rx-${t.value}`}>
                    <line x1={x} x2={x} y1={t.major ? 7 : 12} y2={RULER_SIZE} stroke="#6a6a6a" />
                    {t.label !== undefined && <text x={x + 3} y={9}>{t.label}</text>}
                  </g>
                );
              })}
              {ticksY.map((t) => {
                const y = pan.y + t.value * zoom;
                if (y < RULER_SIZE) return null;
                return (
                  <g key={`ry-${t.value}`}>
                    <line y1={y} y2={y} x1={t.major ? 7 : 12} x2={RULER_SIZE} stroke="#6a6a6a" />
                    {t.label !== undefined && <text transform={`translate(9, ${y - 3}) rotate(-90)`}>{t.label}</text>}
                  </g>
                );
              })}
              {pointerScreen && (
                <g>
                  <line x1={pointerScreen.x} x2={pointerScreen.x} y1={0} y2={RULER_SIZE} stroke="#f24822" />
                  <line y1={pointerScreen.y} y2={pointerScreen.y} x1={0} x2={RULER_SIZE} stroke="#f24822" />
                </g>
              )}
              {/* guias também aparecem como marcas coloridas nas réguas */}
              {showUserGuides &&
                userGuides.map((g) =>
                  g.axis === 'x' ? (
                    <rect key={`gm-${g.id}`} x={pan.x + g.pos * zoom - 1} y={0} width={2} height={RULER_SIZE} fill="#00b8ff" />
                  ) : (
                    <rect key={`gm-${g.id}`} x={0} y={pan.y + g.pos * zoom - 1} width={RULER_SIZE} height={2} fill="#00b8ff" />
                  )
                )}
            </g>
          </g>
        );
      })()}
    </svg>
  );
}
