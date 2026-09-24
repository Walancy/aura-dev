import React, { useRef, useState, useEffect } from 'react';
import type { Point, Shape, StrokeItem, ToolId } from './types';

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
  onSelect: (id: string | null) => void;
  onSelectMultiple?: (ids: string[]) => void;
  onShapesChange: (shapes: Shape[], commit: boolean) => void;
  onToolUsed: () => void;
  onContextMenuShape?: (shape: Shape, clientX: number, clientY: number) => void;
  onContextMenuCanvas?: (clientX: number, clientY: number) => void;
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
    }
  | { kind: 'resize'; shapeId: string; handle: string; orig: Shape }
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
  onSelect,
  onSelectMultiple,
  onShapesChange,
  onToolUsed,
  onContextMenuShape,
  onContextMenuCanvas,
}: DesignCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 120, y: 80 });
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' });
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
    onSelectMultiple?.(ids);
    onSelect(ids.length > 0 ? ids[0] : null);
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

  const handleShapeDown = (e: React.MouseEvent, shape: Shape) => {
    // Pan do canvas mesmo clicando sobre um shape se for botão do meio ou botão direito
    if (tool === 'hand' || isSpacePressed || e.button === 1 || e.button === 2) {
      handleBackgroundDown(e);
      return;
    }

    if (e.button !== 0) return;
    if (readOnly) return;
    e.stopPropagation();
    if (shape.locked) return;
    if (tool !== 'select' && tool !== 'scale') return;

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
    const shapesToMove = shapes.filter((s) => nextSelectedIds.includes(s.id));
    const childOrigins = shapesToMove.map((c) => ({ id: c.id, x: c.x, y: c.y }));

    setDrag({
      kind: 'move',
      shapeId: shape.id,
      startX: p.x,
      startY: p.y,
      origX: shape.x,
      origY: shape.y,
      childOrigins,
    });
  };

  const handleResizeDown = (e: React.MouseEvent, shape: Shape, handle: string) => {
    if (readOnly) return;
    e.stopPropagation();
    setDrag({ kind: 'resize', shapeId: shape.id, handle, orig: { ...shape } });
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
    if (drag.kind === 'none') return;

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
        const hitIds = shapes
          .filter((s) => {
            if (s.visible === false) return false;
            const sx = s.x;
            const sy = s.y;
            const sw = Math.max(1, s.width);
            const sh = Math.max(1, s.height);
            return sx < selX + selW && sx + sw > selX && sy < selY + selH && sy + sh > selY;
          })
          .map((s) => s.id);

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
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
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
      updateShape(drag.shapeId, { x, y, width, height }, false);
    } else if (drag.kind === 'radius') {
      const delta = Math.sqrt(Math.pow(p.x - drag.startX, 2) + Math.pow(p.y - drag.startY, 2));
      const newRadius = Math.max(0, Math.min(100, Math.round(drag.origRadius + delta / 2)));
      updateShape(drag.shapeId, { cornerRadius: newRadius }, false);
    }
  };

  const handleMouseUp = () => {
    if (drag.kind !== 'none') {
      if (drag.kind === 'marquee') {
        const selW = Math.abs(drag.currentX - drag.startX);
        const selH = Math.abs(drag.currentY - drag.startY);
        if (selW <= 3 && selH <= 3 && !drag.isAdditive) {
          handleSelectIds([]);
        }
      } else if (drag.kind !== 'pan') {
        onShapesChange(shapes, true);
        if (drag.kind === 'create' || drag.kind === 'pen') onToolUsed();
      }
    }
    setDrag({ kind: 'none' });
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
      onShapesChange(
        shapes.filter((s) => !activeSelectedIds.includes(s.id)),
        true
      );
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
        {sorted.map((s) => {
          if (s.visible === false) return null;
          const isSelected = activeSelectedIds.includes(s.id);
          const common = {
            onMouseDown: (e: React.MouseEvent) => handleShapeDown(e, s),
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
            opacity: s.opacity ?? 1,
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
                {isFrame && (
                  <text
                    x={s.x}
                    y={s.y - 6 / zoom}
                    fill="#8f8f8f"
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
                    fill: isSlice ? 'none' : isSection ? accentColor + '0d' : f.color,
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
                    fill: f.color,
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
                    fill: f.color,
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
                    fill: f.color,
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
                {s.imageUrl ? (
                  <image href={s.imageUrl} x={s.x} y={s.y} width={s.width} height={s.height} preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill || '#333333'} rx={s.cornerRadius || 0} />
                )}
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
              <polyline
                {...common}
                points={(s.points || []).map((p) => `${p.x},${p.y}`).join(' ')}
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
              {el}
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
      </g>
    </svg>
  );
}
