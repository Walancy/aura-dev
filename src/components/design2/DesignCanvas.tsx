import React, { useRef, useState, useEffect } from 'react';
import type { Point, Shape, StrokeItem, ToolId } from './types';
import { cssGradient, isGradientFill, isHtmlGradient, linearVector, pathFromPoints, sortStops } from './gradient';
import { svgEffectFilter } from './effectsFilter';
import { computeSnap, unionBox, type Guide } from './snap';
import { guideBoxes, newGuideId, RULER_SIZE, rulerOrigin, rulerTicks, selectionRange, snapGuidePos, type RulerGuide } from './rulers';
import { descendantIds, resizeDescendants } from './constraints';
import { relayoutAll } from './autoLayout';

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
  aiReview?: Array<{ id: string; busy?: boolean }>;
  onAiAccept?: (frameId: string) => void;
  onAiRegenerate?: (frameId: string) => void;
  onSelect: (id: string | null) => void;
  onSelectMultiple?: (ids: string[]) => void;
  onShapesChange: (shapes: Shape[], commit: boolean) => void;
  onToolUsed: () => void;
  onContextMenuShape?: (shape: Shape, clientX: number, clientY: number) => void;
  onContextMenuCanvas?: (clientX: number, clientY: number) => void;
  /** Encaixe nas bordas/centros dos outros shapes (Cmd/Ctrl ao arrastar desativa). Padrão: ligado */
  snapEnabled?: boolean;
  showGrid?: boolean;
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

/** Contorno do shape como elemento SVG (para clipPath de máscara e de preenchimentos HTML). */
function outlineGeometry(m: Shape): React.ReactNode {
  if (m.type === 'ellipse') return <ellipse cx={m.x + m.width / 2} cy={m.y + m.height / 2} rx={m.width / 2} ry={m.height / 2} />;
  if (m.type === 'polygon') return <polygon points={getPolygonPoints(m.x + m.width / 2, m.y + m.height / 2, Math.min(m.width, m.height) / 2, m.polygonSides ?? 3)} />;
  if (m.type === 'star') {
    const ro = Math.min(m.width, m.height) / 2;
    return <polygon points={getStarPoints(m.x + m.width / 2, m.y + m.height / 2, ro, ro * (m.starInnerRatio ?? 0.5), m.starPoints ?? 5)} />;
  }
  if (m.type === 'path') return <path d={m.pathD} transform={`translate(${m.x}, ${m.y}) scale(${m.width / (m.pathW || 1)}, ${m.height / (m.pathH || 1)})`} />;
  return <rect x={m.x} y={m.y} width={m.width} height={m.height} rx={m.cornerRadius || 0} />;
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
  onAiAccept,
  onAiRegenerate,
  onSelect,
  onSelectMultiple,
  onShapesChange,
  onToolUsed,
  onContextMenuShape,
  onContextMenuCanvas,
  snapEnabled = true,
  showGrid = false,
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
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' });
  const [guides, setGuides] = useState<Guide[]>([]);
  // Posição do ponteiro na tela (marcador nas réguas), atualizada no máximo 1x por frame
  const [pointerScreen, setPointerScreen] = useState<{ x: number; y: number } | null>(null);
  const pointerRaf = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingGuidePos, setDraggingGuidePos] = useState<number | null>(null);
  // Edição de texto direto no canvas (duplo clique em um texto, ou logo após criá-lo)
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // Renomear frame direto no rótulo (duplo clique no nome)
  const [editingFrameNameId, setEditingFrameNameId] = useState<string | null>(null);
  const editingIsNew = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const hasAutoCentered = useRef(false);
  const isRightClickPanning = useRef(false);
  const rightClickPanMoved = useRef(false);

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
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
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
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    };
  };

  const updateShape = (id: string, patch: Partial<Shape>, commit: boolean) => {
    onShapesChange(
      shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      commit
    );
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
        origPanX: pan.x,
        origPanY: pan.y,
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

    const isPen = tool === 'pen' || tool === 'pencil';
    const zIndex = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1;
    const shape = makeShape(tool as Shape['type'], p.x, p.y, zIndex, accentColor);
    onShapesChange([...shapes, shape], false);
    handleSelectIds([shape.id]);
    setDrag(isPen ? { kind: 'pen', shapeId: shape.id } : { kind: 'create', shapeId: shape.id, startX: p.x, startY: p.y });
  };

  const handleShapeDown = (e: React.MouseEvent, shape: Shape, fromLabel = false) => {
    // Pan do canvas mesmo clicando sobre um shape se for botão do meio ou botão direito
    if (tool === 'hand' || isSpacePressed || e.button === 1 || e.button === 2) {
      handleBackgroundDown(e);
      return;
    }

    if (e.button !== 0) return;
    if (readOnly) return;
    if (shape.locked) return;
    if (tool !== 'select' && tool !== 'scale') return;
    // Como no Figma: arrastar sobre o corpo de um frame raiz não selecionado faz seleção por área (o frame é selecionado pelo título/camadas)
    if (shape.type === 'frame' && !shape.parentId && !activeSelectedIds.includes(shape.id) && !e.altKey && !fromLabel) {
      handleBackgroundDown(e);
      e.stopPropagation();
      return;
    }
    e.stopPropagation();

    const p = getCanvasPoint(e);
    let nextSelectedIds = [...activeSelectedIds];

    if (e.shiftKey) {
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
      setPan({ x: drag.origPanX + dx, y: drag.origPanY + dy });
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
          if (s.visible === false || s.locked) return false;
          const sw = Math.max(1, s.width);
          const sh = Math.max(1, s.height);
          if (!(s.x < selX + selW && s.x + sw > selX && s.y < selY + selH && s.y + sh > selY)) return false;
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
            .concat(showUserGuides ? guideBoxes(userGuides) : []);
          const snap = computeSnap(unionBox(roots), others, 6 / zoom, showGrid ? gridSize : 0);
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides);
        }
      } else if (guides.length) {
        setGuides([]);
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
      updateShape(drag.shapeId, { points, ...bboxOfPoints(points) }, false);
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
      if ((handle.includes('e') || handle.includes('w')) && orig.widthMode && orig.widthMode !== 'fixed') modePatch.widthMode = 'fixed';
      if ((handle.includes('n') || handle.includes('s')) && orig.heightMode && orig.heightMode !== 'fixed') modePatch.heightMode = 'fixed';
      const resized = shapes.map((sh) => {
        if (sh.id === drag.shapeId) return { ...sh, x, y, width, height, ...modePatch };
        const patch = patches.get(sh.id);
        return patch ? { ...sh, ...patch } : sh;
      });
      onShapesChange(resized.some((sh) => sh.hasAutoLayout) ? relayoutAll(resized) : resized, false);
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
        onShapesChange(shapes, true);
        if (drag.kind === 'create' && tool === 'text') {
          editingIsNew.current = true;
          setEditingTextId(drag.shapeId);
        }
        if (drag.kind === 'create' || drag.kind === 'pen') onToolUsed();
      }
    }
    setDrag({ kind: 'none' });
    setGuides([]);
    isRightClickPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom via Ctrl/Cmd + Wheel, Alt + Wheel ou trackpad pinch
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const nextZoom = Math.min(5, Math.max(0.02, Number((zoom * zoomFactor).toFixed(3))));
      if (nextZoom === zoom) return;

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

        const currScreenX = pan.x + focusCanvasX * zoom;
        const currScreenY = pan.y + focusCanvasY * zoom;

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
        focusCanvasX = (focusScreenX - pan.x) / zoom;
        focusCanvasY = (focusScreenY - pan.y) / zoom;
      }

      const nextPanX = Math.round(focusScreenX - focusCanvasX * nextZoom);
      const nextPanY = Math.round(focusScreenY - focusCanvasY * nextZoom);

      setPan({ x: nextPanX, y: nextPanY });
      onZoomChange?.(nextZoom);
    } else {
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
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
  const sorted = [...displayShapes].sort((a, b) => a.zIndex - b.zIndex);

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
        onContextMenuCanvas?.(e.clientX, e.clientY);
      }}
      style={{
        width: '100%',
        height: '100%',
        background: bgCanvas,
        cursor: cursorStyle,
        outline: 'none',
        display: 'block',
      }}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
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
          const common = {
            onMouseDown: (e: React.MouseEvent) => handleShapeDown(e, s),
            onDoubleClick: (e: React.MouseEvent) => {
              if (!readOnly && !s.locked && (s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length >= 2) {
                // Duplo clique no traço: adiciona um nó no segmento mais próximo
                e.stopPropagation();
                const pt = getCanvasPoint(e);
                let best = 0;
                let bestDist = Infinity;
                for (let i = 0; i < s.points.length - 1; i++) {
                  const a = s.points[i];
                  const b = s.points[i + 1];
                  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
                  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * (b.x - a.x) + (pt.y - a.y) * (b.y - a.y)) / len2));
                  const d = Math.hypot(pt.x - (a.x + t * (b.x - a.x)), pt.y - (a.y + t * (b.y - a.y)));
                  if (d < bestDist) {
                    bestDist = d;
                    best = i;
                  }
                }
                const points = [...s.points.slice(0, best + 1), pt, ...s.points.slice(best + 1)];
                updateShape(s.id, { points, ...bboxOfPoints(points) }, true);
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
              if (rightClickPanMoved.current) {
                rightClickPanMoved.current = false;
                return;
              }
              handleSelectIds([s.id]);
              onContextMenuShape?.(s, e.clientX, e.clientY);
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

          const fillsToRender = [...visibleFills].reverse();
          // Preenchimentos em gradiente: <defs> por shape e `paintOf` devolve url(#id) ou a cor sólida
          const gradId = (fid: string) => `grad-${s.id}-${fid}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const paintOf = (f: (typeof visibleFills)[number]) => (isHtmlGradient(f as any) ? 'none' : isGradientFill(f as any) ? `url(#${gradId(f.id)})` : f.color);
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
          const gradientDefs = fillsToRender.some((f) => isGradientFill(f as any) && !isHtmlGradient(f as any)) ? (
            <defs>
              {fillsToRender.filter((f) => isGradientFill(f as any) && !isHtmlGradient(f as any)).map((f) => {
                const stops = sortStops((f as any).gradientStops).map((st, k) => (
                  <stop key={k} offset={st.position} stopColor={st.color} stopOpacity={st.opacity} />
                ));
                if ((f as any).type === 'radial') {
                  return (
                    <radialGradient key={f.id} id={gradId(f.id)} cx="0.5" cy="0.5" r="0.5">
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
          const strokesToRender = [...visibleStrokes].reverse();
          const strokePosition = s.strokePosition || 'inside';
          const strokeDash = s.strokeStyle === 'dashed' ? `${s.strokeDash || 6},${s.strokeGap || 6}` : undefined;
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
                      stroke: st.color,
                      strokeWidth: sw,
                      strokeOpacity: st.opacity ?? 1,
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
                        stroke: st.color,
                        strokeWidth: sw * 2,
                        strokeOpacity: st.opacity ?? 1,
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
                        stroke: st.color,
                        strokeWidth: sw * 2,
                        strokeOpacity: st.opacity ?? 1,
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
                  rx={s.cornerRadius || (isSection ? 8 : 0)}
                  ry={s.cornerRadius || (isSection ? 8 : 0)}
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
            const renderOutline = (props: any) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...props} />;

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
                    stroke: 'none',
                  })
                )}
                {renderShapeStrokes(renderOutline, { x: s.x, y: s.y, width: s.width, height: s.height }, 'ellipse')}
              </g>
            );
          } else if (s.type === 'line') {
            el = (
              <g {...common}>
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
            const renderOutline = (props: any) => <polygon points={pts} {...props} />;

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
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
            const renderOutline = (props: any) => <polygon points={pts} {...props} />;

            el = (
              <g {...common}>
                {fillsToRender.map((f, i) =>
                  renderOutline({
                    key: f.id || i,
                    fill: paintOf(f),
                    opacity: f.opacity,
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
                            <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={s.cornerRadius || 0} />
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#${cid})`}>
                          <image
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
                  <image
                    href={s.imageUrl}
                    x={s.x}
                    y={s.y}
                    width={s.width}
                    height={s.height}
                    preserveAspectRatio={s.imageFit === 'stretch' ? 'none' : s.imageFit === 'fit' ? 'xMidYMid meet' : 'xMidYMid slice'}
                  />
                ) : (
                  <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill || '#333333'} rx={s.cornerRadius || 0} />
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
                    <path key={f.id || i} d={s.pathD} fillRule="evenodd" fill={paintOf(f)} opacity={f.opacity} stroke="none" />
                  ))}
                  {strokesToRender.map((st, i) => (
                    <path
                      key={st.id || i}
                      d={s.pathD}
                      fill="none"
                      stroke={st.color}
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
              el = (
                <g {...common}>
                  <defs>
                    <path id={pid} d={`M ${s.x} ${baseY} Q ${s.x + w / 2} ${baseY - curve * 2} ${s.x + w} ${baseY}`} />
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
              >
                {lines.length > 1 ? (
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
            const penColor = visibleStrokes[0]?.color || s.stroke || accentColor;
            const penWidth = visibleStrokes[0]?.width !== undefined ? visibleStrokes[0].width : (s.strokeWidth ?? 2);
            el = (
              <path
                {...common}
                d={pathFromPoints(s.points || [], s.smooth)}
                fill="none"
                stroke={penColor}
                strokeWidth={penWidth}
                strokeLinecap="round"
                strokeLinejoin={strokeJoin}
                strokeDasharray={strokeDash}
              />
            );
          }

          const showControls = isSelected && activeSelectedIds.length === 1 && !readOnly && !s.locked && s.type !== 'pen' && s.type !== 'pencil';
          const canResizeCorners = s.type === 'rect' || s.type === 'frame' || s.type === 'section' || s.type === 'image';

          return (
            <g
              key={s.id}
              transform={s.rotation ? `rotate(${s.rotation} ${s.x + s.width / 2} ${s.y + s.height / 2})` : undefined}
              style={{ filter: canvasFilter }}
            >
              {gradientDefs}
              {bgBlurLayers}
              {htmlGradientLayers}
              {fxFilterMarkup && <defs dangerouslySetInnerHTML={{ __html: fxFilterMarkup }} />}
              {(() => {
                // Frame com "recortar conteúdo": filhos não passam da borda do pai
                const parent = s.parentId ? displayShapes.find((x) => x.id === s.parentId) : undefined;
                const idPart = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
                // Máscara: o shape de máscara mais próximo abaixo (mesmo pai) recorta este shape
                const maskShape = s.isMask
                  ? undefined
                  : displayShapes
                      .filter((m) => m.isMask && m.id !== s.id && (m.parentId || '') === (s.parentId || '') && m.zIndex < s.zIndex)
                      .sort((a, b) => b.zIndex - a.zIndex)[0];
                const maskKinds = ['rect', 'frame', 'section', 'image', 'ellipse', 'polygon', 'star', 'path'];
                const maskGeometry: React.ReactNode = maskShape && maskKinds.includes(maskShape.type) ? outlineGeometry(maskShape) : null;
                if (!parent?.clipContent && !maskGeometry) return el;
                let out: React.ReactNode = el;
                const defs: React.ReactNode[] = [];
                if (maskGeometry) {
                  defs.push(<clipPath key="m" id={`clipm-${idPart}`}>{maskGeometry}</clipPath>);
                  out = <g clipPath={`url(#clipm-${idPart})`}>{out}</g>;
                }
                if (parent?.clipContent) {
                  defs.push(
                    <clipPath key="c" id={`clipc-${idPart}`}>
                      <rect x={parent.x} y={parent.y} width={parent.width} height={parent.height} rx={parent.cornerRadius || 0} />
                    </clipPath>
                  );
                  out = <g clipPath={`url(#clipc-${idPart})`}>{out}</g>;
                }
                return (
                  <>
                    <defs>{defs}</defs>
                    {out}
                  </>
                );
              })()}
              {/* Borda de seleção quando selecionado */}
              {isSelected && (
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
                    rx={s.cornerRadius || 0}
                    ry={s.cornerRadius || 0}
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
                  {s.points.map((pt, i) => (
                    <circle
                      key={`node-${i}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={3.5 / zoom}
                      fill="#ffffff"
                      stroke={accentColor}
                      strokeWidth={1.2 / zoom}
                      style={{ cursor: 'move' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (e.altKey) {
                          if ((s.points?.length || 0) <= 2) return;
                          const points = s.points!.filter((_, k) => k !== i);
                          updateShape(s.id, { points, ...bboxOfPoints(points) }, true);
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

        {/* Aceitar / regerar telas geradas pela IA: botões acima do frame, em tamanho fixo na tela */}
        {(aiReview || []).map((r) => {
          const f = shapes.find((x) => x.id === r.id);
          if (!f || f.visible === false) return null;
          const W = 214;
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
              </div>
            </foreignObject>
          );
        })}

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
                  ? { ...x, text: value, width: Math.max(x.width, Math.round(longest * fontSize * 0.55)), height: Math.max(x.height, Math.round(lines.length * fontSize * 1.25)) }
                  : x
              ),
              true
            );
          };
          return (
            <foreignObject x={t.x} y={t.y} width={Math.max(t.width, 220)} height={Math.max(t.height, fontSize * 2)}>
              <textarea
                autoFocus
                defaultValue={editingIsNew.current && t.text === 'Texto' ? '' : t.text || ''}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => finish(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') finish(e.currentTarget.value, !editingIsNew.current);
                  else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
                }}
                style={{
                  width: '100%',
                  height: '100%',
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
