import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { BrainEdge, BrainNode, BrainNodeType, BrainCategoryFilter } from '../../types/brain';
import { logBrainActivity } from '../../utils/brainService';
import {
  Zap,
  FolderGit2,
  Component,
  Cpu,
  Sliders,
  FileText,
  Globe,
  Sparkles,
  Code2,
  Search,
  X,
  ExternalLink,
  Pin,
  PinOff,
  ZoomIn,
  ZoomOut,
  Focus,
  Download,
  LayoutGrid,
} from 'lucide-react';

interface BrainGraphCanvasProps {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: BrainNode | null) => void;
  onOpenNodeFile?: (path: string) => void;
  onTogglePinNode?: (nodeId: string) => void;
  accentColor: string;
  isEffectiveDark: boolean;
  projectName?: string;
}

// Dimensões das bordas interna e externa das bolinhas
const ROOT_INNER_SIZE = 50;
const ROOT_INNER_RADIUS = 25;
const ROOT_OUTER_SIZE = 70;
const ROOT_OUTER_RADIUS = 35;
const ROOT_MID_RADIUS = (ROOT_INNER_RADIUS + ROOT_OUTER_RADIUS) / 2; // 30px (exatamente no centro entre as duas bordas)

const NODE_INNER_SIZE = 38;
const NODE_INNER_RADIUS = 19;
const NODE_OUTER_SIZE = 54;
const NODE_OUTER_RADIUS = 27;
const NODE_MID_RADIUS = (NODE_INNER_RADIUS + NODE_OUTER_RADIUS) / 2; // 23px (exatamente no centro entre as duas bordas)

const NODE_COLORS: Record<BrainNodeType, string> = {
  entry: '#3b82f6',     // Vibrant Blue
  module: '#8b5cf6',    // Deep Purple
  component: '#06b6d4', // Bright Cyan
  service: '#10b981',   // Emerald Green
  config: '#f59e0b',    // Bright Amber
  doc: '#ec4899',       // Deep Magenta
  domain: '#6366f1',    // Indigo
  custom: '#14b8a6',    // Teal
};

const NODE_LABELS: Record<BrainNodeType, string> = {
  entry: 'Entrada',
  module: 'Módulo',
  component: 'Componente',
  service: 'Serviço',
  config: 'Configuração',
  doc: 'Documentação',
  domain: 'Domínio',
  custom: 'Personalizado',
};

// ============================================================================
// CUBIC BEZIER GEOMETRY UTILITIES
// ============================================================================

export const evaluateCubicBezier = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number; tangentX: number; tangentY: number } => {
  const clampedT = Math.max(0, Math.min(1, t));
  const mt = 1 - clampedT;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = clampedT * clampedT;
  const t3 = t2 * clampedT;

  const x = mt3 * p0.x + 3 * mt2 * clampedT * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
  const y = mt3 * p0.y + 3 * mt2 * clampedT * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;

  const tangentX = 3 * mt2 * (p1.x - p0.x) + 6 * mt * clampedT * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
  const tangentY = 3 * mt2 * (p1.y - p0.y) + 6 * mt * clampedT * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);

  return { x, y, tangentX, tangentY };
};

export const getCableGeometry = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromDir: 'right' | 'down' | 'up' | 'left',
  toDir: 'right' | 'down' | 'up' | 'left',
  ratio: number = 0.5
) => {
  let p1 = { ...from };
  let p2 = { ...to };

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const dist = Math.hypot(dx, dy);
  const factor = Math.max(35, Math.min(180, dist * 0.45));

  let cp1x = p1.x;
  let cp1y = p1.y;
  if (fromDir === 'right') cp1x += factor;
  else if (fromDir === 'left') cp1x -= factor;
  else if (fromDir === 'down') cp1y += factor;
  else if (fromDir === 'up') cp1y -= factor;

  let cp2x = p2.x;
  let cp2y = p2.y;
  if (toDir === 'left') cp2x -= factor;
  else if (toDir === 'right') cp2x += factor;
  else if (toDir === 'up') cp2y -= factor;
  else if (toDir === 'down') cp2y += factor;

  const cp1 = { x: cp1x, y: cp1y };
  const cp2 = { x: cp2x, y: cp2y };

  const clampedRatio = Math.max(0.08, Math.min(0.92, ratio));
  const pt = evaluateCubicBezier(p1, cp1, cp2, p2, clampedRatio);
  const midX = pt.x;
  const midY = pt.y;

  const mainD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;

  let waveUpperD = '';
  let waveLowerD = '';
  if (Math.abs(dx) >= Math.abs(dy)) {
    const waveOffset = Math.min(6, Math.max(2.5, Math.abs(dy) * 0.03 + 2.5));
    waveUpperD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y - waveOffset}, ${cp2x} ${cp2y - waveOffset}, ${p2.x} ${p2.y}`;
    waveLowerD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y + waveOffset}, ${cp2x} ${cp2y + waveOffset}, ${p2.x} ${p2.y}`;
  } else {
    const waveOffset = Math.min(6, Math.max(2.5, Math.abs(dx) * 0.03 + 2.5));
    waveUpperD = `M ${p1.x} ${p1.y} C ${cp1x - waveOffset} ${cp1y}, ${cp2x - waveOffset} ${cp2y}, ${p2.x} ${p2.y}`;
    waveLowerD = `M ${p1.x} ${p1.y} C ${cp1x + waveOffset} ${cp1y}, ${cp2x + waveOffset} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return { p1, p2, cp1, cp2, midX, midY, mainD, waveUpperD, waveLowerD, tangentX: pt.tangentX, tangentY: pt.tangentY };
};

// ============================================================================
// CONSTELLATION CIRCULAR LAYOUT ENGINE
// ============================================================================

function computeDeterministicLayout(nodes: BrainNode[], edges: BrainEdge[] = []): BrainNode[] {
  const rootNode = nodes.find((n) => n.id === 'root-project');
  const configs = nodes.filter((n) => n.type === 'config');
  const docs = nodes.filter((n) => n.type === 'doc');
  const entries = nodes.filter((n) => n.type === 'entry');
  const modules = nodes.filter((n) => n.type === 'module');
  const others = nodes.filter(
    (n) => n.id !== 'root-project' && n.type !== 'config' && n.type !== 'doc' && n.type !== 'entry' && n.type !== 'module'
  );

  const updatedMap = new Map<string, { x: number; y: number }>();

  // 1. Root Project no Centro Absoluto (0, 0)
  if (rootNode) {
    updatedMap.set(rootNode.id, { x: 0, y: 0 });
  }

  // 2. Configurações na esquerda (-240px)
  const configSpacing = Math.max(68, Math.min(84, 520 / Math.max(1, configs.length)));
  const configStartY = -((configs.length - 1) * configSpacing) / 2;
  configs.forEach((n, idx) => {
    if (!n.pinned) {
      updatedMap.set(n.id, { x: -240, y: Math.round(configStartY + idx * configSpacing) });
    }
  });

  // 3. Documentação no quadrante superior-esquerdo (-380px, -110px)
  const docSpacing = Math.max(68, Math.min(84, 460 / Math.max(1, docs.length)));
  const docStartY = -110 - ((docs.length - 1) * docSpacing) / 2;
  docs.forEach((n, idx) => {
    if (!n.pinned) {
      updatedMap.set(n.id, { x: -380, y: Math.round(docStartY + idx * docSpacing) });
    }
  });

  // 4. Arquivos de Entrada no topo (y: -190px)
  const entrySpacing = Math.max(130, Math.min(160, 600 / Math.max(1, entries.length)));
  const entryStartX = -((entries.length - 1) * entrySpacing) / 2;
  entries.forEach((n, idx) => {
    if (!n.pinned) {
      updatedMap.set(n.id, { x: Math.round(entryStartX + idx * entrySpacing), y: -190 });
    }
  });

  // 5. Módulos Principais na primeira coluna direita (+240px)
  const moduleSpacing = Math.max(76, Math.min(94, 600 / Math.max(1, modules.length)));
  const moduleStartY = -((modules.length - 1) * moduleSpacing) / 2;
  modules.forEach((n, idx) => {
    if (!n.pinned) {
      updatedMap.set(n.id, { x: 240, y: Math.round(moduleStartY + idx * moduleSpacing) });
    }
  });

  // 6. Componentes, Serviços, Domínios na coluna externa (+480px e +640px)
  const useTwoColumns = others.length > 7;
  const col1 = useTwoColumns ? others.filter((_, i) => i % 2 === 0) : others;
  const col2 = useTwoColumns ? others.filter((_, i) => i % 2 !== 0) : [];

  const otherSpacing1 = Math.max(68, Math.min(84, 620 / Math.max(1, col1.length)));
  const otherStartY1 = -((col1.length - 1) * otherSpacing1) / 2;
  col1.forEach((n, idx) => {
    if (!n.pinned) {
      updatedMap.set(n.id, { x: 480, y: Math.round(otherStartY1 + idx * otherSpacing1) });
    }
  });

  if (col2.length > 0) {
    const otherSpacing2 = Math.max(68, Math.min(84, 620 / Math.max(1, col2.length)));
    const otherStartY2 = -((col2.length - 1) * otherSpacing2) / 2;
    col2.forEach((n, idx) => {
      if (!n.pinned) {
        updatedMap.set(n.id, { x: 640, y: Math.round(otherStartY2 + idx * otherSpacing2) });
      }
    });
  }

  return nodes.map((n) => {
    if (n.pinned && n.x && n.y) return n;
    const coords = updatedMap.get(n.id);
    return {
      ...n,
      x: coords ? coords.x : n.x || 0,
      y: coords ? coords.y : n.y || 0,
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BrainGraphCanvas: React.FC<BrainGraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onOpenNodeFile,
  onTogglePinNode,
  accentColor,
  isEffectiveDark,
  projectName = 'projeto',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Nós locais inicializados com o auto-layout determinístico por padrão
  const [localNodes, setLocalNodes] = useState<BrainNode[]>(() => {
    return computeDeterministicLayout(nodes, edges);
  });

  // Câmera do Canvas: Pan e Zoom com ajuste responsivo
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 300, y: 260 });
  const [zoom, setZoom] = useState<number>(0.85);

  // Estados de Interação
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<BrainCategoryFilter>('all');

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nodeDragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });
  const hasMovedRef = useRef<boolean>(false);

  // Registra visualização no log do sistema
  useEffect(() => {
    logBrainActivity('render_brain_circular_graph', projectName, {
      nodesCount: nodes.length,
      edgesCount: edges.length,
    });
  }, [projectName, nodes.length, edges.length]);

  // Centraliza e Enquadra todo o Grafo na tela com precisão milimétrica
  const handleCenterFlow = useCallback((nodesToFit?: BrainNode[], targetCategory: BrainCategoryFilter = 'all') => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.width < 100 || rect.height < 100) {
      requestAnimationFrame(() => handleCenterFlow(nodesToFit, targetCategory));
      return;
    }

    const sourceNodes = nodesToFit && nodesToFit.length > 0 ? nodesToFit : localNodes;
    if (sourceNodes.length === 0) return;

    const relevantNodes =
      targetCategory === 'all'
        ? sourceNodes
        : sourceNodes.filter((n) => n.type === targetCategory || n.id === 'root-project');

    const targetNodes = relevantNodes.length > 0 ? relevantNodes : sourceNodes;

    const xs = targetNodes.map((n) => n.x);
    const ys = targetNodes.map((n) => n.y);
    const minX = Math.min(...xs) - 75;
    const maxX = Math.max(...xs) + 75;
    const minY = Math.min(...ys) - 45;
    const maxY = Math.max(...ys) + 65;

    const graphWidth = Math.max(180, maxX - minX);
    const graphHeight = Math.max(140, maxY - minY);

    const padX = 80;
    const padTop = 90;
    const padBottom = 70;
    const availableW = Math.max(200, rect.width - padX * 2);
    const availableH = Math.max(180, rect.height - padTop - padBottom);

    const scaleX = availableW / graphWidth;
    const scaleY = availableH / graphHeight;
    const maxZoomLimit = targetNodes.length <= 3 ? 1.0 : 1.25;
    const fitZoom = Math.min(maxZoomLimit, Math.max(0.35, Math.min(scaleX, scaleY)));

    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    const viewportCenterY = padTop + availableH / 2;

    setZoom(fitZoom);
    setPan({
      x: Math.round(rect.width / 2 - graphCenterX * fitZoom),
      y: Math.round(viewportCenterY - graphCenterY * fitZoom),
    });
  }, [localNodes]);

  // Sincroniza nós quando a prop mudar e auto-ajusta
  useEffect(() => {
    const organized = computeDeterministicLayout(nodes, edges);
    setLocalNodes(organized);
    handleCenterFlow(organized, activeCategory);
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ajuste obrigatório por padrão na montagem e troca de projeto
  useEffect(() => {
    handleCenterFlow();
    const rafId = requestAnimationFrame(() => handleCenterFlow());
    const t1 = setTimeout(() => handleCenterFlow(), 50);
    const t2 = setTimeout(() => handleCenterFlow(), 180);
    const t3 = setTimeout(() => handleCenterFlow(), 350);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [projectName, nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ResizeObserver para manter o enquadramento perfeito em redimensionamentos de janela
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastW = 0;
    let lastH = 0;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 150 && height > 150 && (Math.abs(width - lastW) > 8 || Math.abs(height - lastH) > 8)) {
          lastW = width;
          lastH = height;
          handleCenterFlow();
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [handleCenterFlow]);

  // Reorganizar Layout e Auto-Ajustar
  const handleReorganizeLayout = () => {
    const organized = computeDeterministicLayout(localNodes, edges);
    setLocalNodes(organized);
    logBrainActivity('reorganize_brain_layout', projectName);
    handleCenterFlow(organized, activeCategory);
    setTimeout(() => handleCenterFlow(organized, activeCategory), 60);
  };

  // Alternar Categoria e Auto-Ajustar
  const handleSelectCategory = (cat: BrainCategoryFilter) => {
    setActiveCategory(cat);
    handleCenterFlow(localNodes, cat);
  };

  // Zoom no Ponto do Cursor
  const performZoomAt = useCallback(
    (clientX: number, clientY: number, deltaY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = clientX - rect.left;
      const cursorY = clientY - rect.top;

      const zoomFactor = deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(2.5, Math.max(0.3, zoom * zoomFactor));

      const newPanX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
      const newPanY = cursorY - (cursorY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [pan, zoom]
  );

  // Zoom Wheel nativo
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      performZoomAt(e.clientX, e.clientY, e.deltaY);
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel);
    };
  }, [performZoomAt]);

  // Focar suavemente em um nó específico
  const focusOnNode = useCallback(
    (node: BrainNode) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const targetZoom = 1.1;
      const targetPanX = rect.width / 2 - node.x * targetZoom;
      const targetPanY = rect.height / 2 - node.y * targetZoom;

      setZoom(targetZoom);
      setPan({ x: targetPanX, y: targetPanY });
      onSelectNode(node);
    },
    [onSelectNode]
  );

  // Handlers do Canvas (Pan)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  // Handlers de Nós (Drag)
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const targetNode = localNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    hasMovedRef.current = false;
    setDraggingNodeId(nodeId);
    nodeDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: targetNode.x,
      nodeY: targetNode.y,
    };
  };

  // Mouse Move Global
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStartRef.current.mouseX) / zoom;
      const dy = (e.clientY - nodeDragStartRef.current.mouseY) / zoom;

      if (Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
      }

      setLocalNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: Math.round(nodeDragStartRef.current.nodeX + dx), y: Math.round(nodeDragStartRef.current.nodeY + dy) }
            : n
        )
      );
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Exportar PNG em Alta Resolução
  const handleExportPng = () => {
    try {
      const exportWidth = 2400;
      const exportHeight = 1400;
      const offscreen = document.createElement('canvas');
      offscreen.width = exportWidth;
      offscreen.height = exportHeight;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = isEffectiveDark ? '#101010' : '#f8fafc';
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      const xs = localNodes.map((n) => n.x);
      const ys = localNodes.map((n) => n.y);
      const minX = Math.min(...xs, 0) - 100;
      const maxX = Math.max(...xs, 0) + 100;
      const minY = Math.min(...ys, 0) - 100;
      const maxY = Math.max(...ys, 0) + 100;
      const contentW = maxX - minX || 800;
      const contentH = maxY - minY || 600;

      const scale = Math.min(exportWidth / contentW, exportHeight / contentH) * 0.88;
      const offsetX = (exportWidth - contentW * scale) / 2 - minX * scale;
      const offsetY = (exportHeight - contentH * scale) / 2 - minY * scale;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // 1. Desenha bordas externas e cor de fundo entre as bordas
      localNodes.forEach((node) => {
        const isRoot = node.id === 'root-project';
        const outerR = isRoot ? ROOT_OUTER_RADIUS : NODE_OUTER_RADIUS;
        const col = isRoot ? accentColor : NODE_COLORS[node.type] || '#3b82f6';

        ctx.fillStyle = col + '20';
        ctx.strokeStyle = isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 2. Cabos estáticos terminando em MID_RADIUS
      edges.forEach((edge) => {
        const fromNode = localNodes.find((n) => n.id === edge.source);
        const toNode = localNodes.find((n) => n.id === edge.target);
        if (!fromNode || !toNode) return;
        const { from, to, fromDir, toDir } = getConnectionEndpoints(fromNode, toNode);
        const { mainD } = getCableGeometry(from, to, fromDir, toDir);
        const p = new Path2D(mainD);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.8;
        ctx.stroke(p);
      });

      // 3. Bolinhas internas por cima das conexões
      localNodes.forEach((node) => {
        const isRoot = node.id === 'root-project';
        const innerR = isRoot ? ROOT_INNER_RADIUS : NODE_INNER_RADIUS;
        const col = isRoot ? accentColor : NODE_COLORS[node.type] || '#3b82f6';

        ctx.fillStyle = isEffectiveDark ? '#141414' : '#ffffff';
        ctx.strokeStyle = isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, innerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = col + '22';
        ctx.beginPath();
        ctx.arc(node.x, node.y, innerR - 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isEffectiveDark ? '#f4f4f5' : '#0f172a';
        ctx.font = 'normal 11px "Poppins", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.slice(0, 18), node.x, node.y + (isRoot ? ROOT_OUTER_RADIUS : NODE_OUTER_RADIUS) + 14);
      });

      ctx.restore();

      const dataUrl = offscreen.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `devflow-brain-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      logBrainActivity('export_brain_graph_image', projectName);
    } catch (err) {
      console.warn('[BrainGraphCanvas] Erro ao exportar:', err);
    }
  };

  // Cálculo de Pontos de Conexão: EXATAMENTE NO CENTRO ENTRE BORDA INTERNA E EXTERNA (MID_RADIUS)
  const getConnectionEndpoints = (fromNode: BrainNode, toNode: BrainNode) => {
    const fromRadius = fromNode.id === 'root-project' ? ROOT_MID_RADIUS : NODE_MID_RADIUS;
    const toRadius = toNode.id === 'root-project' ? ROOT_MID_RADIUS : NODE_MID_RADIUS;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;

    let from: { x: number; y: number };
    let to: { x: number; y: number };
    let fromDir: 'right' | 'left' | 'down' | 'up' = 'right';
    let toDir: 'left' | 'right' | 'down' | 'up' = 'left';

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) {
        from = { x: fromNode.x + fromRadius, y: fromNode.y };
        to = { x: toNode.x - toRadius, y: toNode.y };
        fromDir = 'right';
        toDir = 'left';
      } else {
        from = { x: fromNode.x - fromRadius, y: fromNode.y };
        to = { x: toNode.x + toRadius, y: toNode.y };
        fromDir = 'left';
        toDir = 'right';
      }
    } else {
      if (dy >= 0) {
        from = { x: fromNode.x, y: fromNode.y + fromRadius };
        to = { x: toNode.x, y: toNode.y - toRadius };
        fromDir = 'down';
        toDir = 'up';
      } else {
        from = { x: fromNode.x, y: fromNode.y - fromRadius };
        to = { x: toNode.x, y: toNode.y + toRadius };
        fromDir = 'up';
        toDir = 'down';
      }
    }

    return { from, to, fromDir, toDir };
  };

  // Seta da conexão: posicionada exatamente no centro entre as duas bordas (to.x, to.y),
  // apontando para o centro da bolinha e ficando ATRÁS da bolinha interna
  const renderConnectionArrow = (
    x: number,
    y: number,
    toDir: 'left' | 'right' | 'down' | 'up',
    color: string
  ) => {
    const halfW = 4.5;
    let pathD = '';

    if (toDir === 'left') {
      // Entra pela esquerda da bolinha, aponta para a direita (+x) em direção ao centro
      const tipX = x + 3.8;
      const backX = x - 5.5;
      pathD = `M ${tipX} ${y} L ${backX} ${y - halfW} L ${backX + 2.2} ${y} L ${backX} ${y + halfW} Z`;
    } else if (toDir === 'right') {
      // Entra pela direita da bolinha, aponta para a esquerda (-x) em direção ao centro
      const tipX = x - 3.8;
      const backX = x + 5.5;
      pathD = `M ${tipX} ${y} L ${backX} ${y - halfW} L ${backX - 2.2} ${y} L ${backX} ${y + halfW} Z`;
    } else if (toDir === 'up') {
      // Entra pelo topo da bolinha, aponta para baixo (+y) em direção ao centro
      const tipY = y + 3.8;
      const backY = y - 5.5;
      pathD = `M ${x} ${tipY} L ${x - halfW} ${backY} L ${x} ${backY + 2.2} L ${x + halfW} ${backY} Z`;
    } else {
      // Entra pela base da bolinha, aponta para cima (-y) em direção ao centro
      const tipY = y - 3.8;
      const backY = y + 5.5;
      pathD = `M ${x} ${tipY} L ${x - halfW} ${backY} L ${x} ${backY - 2.2} L ${x + halfW} ${backY} Z`;
    }

    return (
      <path
        d={pathD}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin="round"
        opacity={0.95}
      />
    );
  };

  // Ícones de categoria
  const renderCategoryIcon = (type: BrainNodeType, color: string, isRoot: boolean) => {
    if (isRoot) {
      return <Code2 size={24} color={color} strokeWidth={1.5} />;
    }
    switch (type) {
      case 'entry':
        return <Zap size={18} color={color} strokeWidth={1.5} />;
      case 'module':
        return <FolderGit2 size={18} color={color} strokeWidth={1.5} />;
      case 'component':
        return <Component size={18} color={color} strokeWidth={1.5} />;
      case 'service':
        return <Cpu size={18} color={color} strokeWidth={1.5} />;
      case 'config':
        return <Sliders size={18} color={color} strokeWidth={1.5} />;
      case 'doc':
        return <FileText size={18} color={color} strokeWidth={1.5} />;
      case 'domain':
        return <Globe size={18} color={color} strokeWidth={1.5} />;
      case 'custom':
        return <Sparkles size={18} color={color} strokeWidth={1.5} />;
      default:
        return <Code2 size={18} color={color} strokeWidth={1.5} />;
    }
  };

  // Filtragem de Nós
  const query = searchQuery.trim().toLowerCase();
  const filteredNodes = useMemo(() => {
    return localNodes.filter((n) => {
      const matchCat = activeCategory === 'all' || n.type === activeCategory;
      const matchSearch =
        !query ||
        n.label.toLowerCase().includes(query) ||
        n.description.toLowerCase().includes(query) ||
        n.path.toLowerCase().includes(query) ||
        n.tags.some((t) => t.toLowerCase().includes(query));
      return matchCat && matchSearch;
    });
  }, [localNodes, activeCategory, query]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Nós conectados ao nó ativo
  const activeFocusId = hoveredNodeId || selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (activeFocusId) {
      set.add(activeFocusId);
      edges.forEach((e) => {
        if (e.source === activeFocusId) set.add(e.target);
        if (e.target === activeFocusId) set.add(e.source);
      });
    }
    return set;
  }, [activeFocusId, edges]);

  // Cores e Tokens
  const floatingBg = isEffectiveDark ? '#141414' : '#ffffff';
  const textPrimary = isEffectiveDark ? '#f4f4f5' : '#0f172a';
  const textSecondary = isEffectiveDark ? '#a1a1aa' : '#64748b';
  const dividerColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // Nó Selecionado para o mini painel
  const selectedNode = useMemo(() => {
    return selectedNodeId ? localNodes.find((n) => n.id === selectedNodeId) || null : null;
  }, [selectedNodeId, localNodes]);

  const selectedNodeNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const neighborId = e.source === selectedNode.id ? e.target : e.source;
        return {
          node: localNodes.find((n) => n.id === neighborId),
          relation: e.relation,
        };
      })
      .filter((item): item is { node: BrainNode; relation: string } => Boolean(item.node));
  }, [selectedNode, edges, localNodes]);

  const categories: BrainCategoryFilter[] = ['all', 'module', 'component', 'service', 'config', 'doc'];

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: isEffectiveDark ? '#0d0d0d' : '#f8fafc',
        fontFamily: "'Poppins', -apple-system, sans-serif",
        cursor: isPanning ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      {/* ================================================================= */}
      {/* 1. DYNAMIC ILLUMINATING BACKGROUND DOTS LAYER                     */}
      {/* ================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          maskImage: 'radial-gradient(#000 1.5px, transparent 1.5px)',
          WebkitMaskImage: 'radial-gradient(#000 1.5px, transparent 1.5px)',
          maskSize: `${26 * zoom}px ${26 * zoom}px`,
          WebkitMaskSize: `${26 * zoom}px ${26 * zoom}px`,
          maskPosition: `${pan.x}px ${pan.y}px`,
          WebkitMaskPosition: `${pan.x}px ${pan.y}px`,
          pointerEvents: 'none',
          background: isEffectiveDark ? '#0d0d0d' : '#f8fafc',
          overflow: 'hidden',
        }}
      >
        {/* Baseline faint dots */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)',
          }}
        />

        {/* Scaled and panned light emitter field illuminating dots near cables */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg style={{ position: 'absolute', top: 0, left: 0, width: 8000, height: 8000, overflow: 'visible' }}>
            <defs>
              <filter id="brain-dot-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="30" />
              </filter>
              <filter id="brain-dot-glow-wide" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="55" />
              </filter>
            </defs>
            <g>
              {edges.map((edge) => {
                const fromNode = localNodes.find((n) => n.id === edge.source);
                const toNode = localNodes.find((n) => n.id === edge.target);
                if (!fromNode || !toNode) return null;
                const { from, to, fromDir, toDir } = getConnectionEndpoints(fromNode, toNode);
                const { mainD } = getCableGeometry(from, to, fromDir, toDir);
                const isEdgeActive = activeFocusId ? edge.source === activeFocusId || edge.target === activeFocusId : true;
                if (!isEdgeActive) return null;

                return (
                  <g key={'illum-' + edge.id}>
                    <path
                      d={mainD}
                      fill="none"
                      stroke={accentColor}
                      strokeWidth={80}
                      strokeOpacity={isEffectiveDark ? 0.3 : 0.16}
                      filter="url(#brain-dot-glow-wide)"
                    />
                    <path
                      d={mainD}
                      fill="none"
                      stroke={accentColor}
                      strokeWidth={36}
                      strokeOpacity={isEffectiveDark ? 0.6 : 0.35}
                      filter="url(#brain-dot-glow-blur)"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Vignette Gradient Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isEffectiveDark
            ? 'radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(0,0,0,0.85) 100%)'
            : 'radial-gradient(ellipse at 50% 40%, transparent 70%, rgba(0,0,0,0.04) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ================================================================= */}
      {/* 2. CAMADA DA BORDA EXTERNA + COR DE FUNDO ENTRE AS DUAS BORDAS    */}
      {/*    (Renderizada atrás dos cabos, com zIndex: 4)                   */}
      {/* ================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      >
        {localNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const isRoot = node.id === 'root-project';
          const outerSize = isRoot ? ROOT_OUTER_SIZE : NODE_OUTER_SIZE;
          const nodeColor = isRoot ? accentColor : NODE_COLORS[node.type] || '#3b82f6';
          const isFilteredOut = !filteredNodeIds.has(node.id);
          const isConnected = activeFocusId ? connectedNodeIds.has(node.id) : true;
          const opacity = isFilteredOut ? 0.14 : activeFocusId && !isConnected ? 0.28 : 1;

          return (
            <div
              key={'outer-ring-' + node.id}
              style={{
                position: 'absolute',
                left: node.x - outerSize / 2,
                top: node.y - outerSize / 2,
                width: outerSize,
                height: outerSize,
                borderRadius: '50%',
                // Cor de fundo entre a borda externa e interna
                background: isSelected
                  ? `${accentColor}28`
                  : isHovered
                  ? `${nodeColor}22`
                  : `${nodeColor}14`,
                // Borda externa da bolinha
                border: isSelected
                  ? `1.5px solid ${accentColor}`
                  : isEffectiveDark
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(0, 0, 0, 0.09)',
                boxShadow: 'none',
                opacity,
                transition: 'opacity 0.2s ease, border-color 0.15s ease, background 0.15s ease',
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* 3. SVG CABOS E SETAS DE CONEXÃO (zIndex: 6)                       */}
      {/*    A seta fica exatamente no centro entre as duas bordas e        */}
      {/*    fica atrás da bolinha interna (que fica no zIndex: 10)         */}
      {/* ================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 8000, height: 8000, overflow: 'visible' }}>
          <defs>
            <filter id="brain-neon-glow-accent" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge) => {
            const fromNode = localNodes.find((n) => n.id === edge.source);
            const toNode = localNodes.find((n) => n.id === edge.target);
            if (!fromNode || !toNode) return null;

            const isFiltered = !filteredNodeIds.has(fromNode.id) && !filteredNodeIds.has(toNode.id);
            const isWireActive = activeFocusId ? edge.source === activeFocusId || edge.target === activeFocusId : true;

            const { from, to, fromDir, toDir } = getConnectionEndpoints(fromNode, toNode);
            const { midX, midY, mainD, waveUpperD, waveLowerD } = getCableGeometry(from, to, fromDir, toDir, 0.5);

            const baseColor = NODE_COLORS[fromNode.type] || accentColor;
            const wireColor = isWireActive ? (fromNode.id === 'root-project' ? accentColor : baseColor) : isEffectiveDark ? '#3f3f46' : '#cbd5e1';
            const opacity = isFiltered ? 0.12 : isWireActive ? 1 : 0.35;

            return (
              <g key={edge.id} style={{ opacity, transition: 'opacity 0.2s ease' }}>
                {isWireActive ? (
                  <>
                    {/* Core Glow Halo Estático */}
                    <path d={mainD} fill="none" stroke={wireColor} strokeWidth={2.8} strokeOpacity={0.25} filter="url(#brain-neon-glow-accent)" />

                    {/* Filamento harmônico superior */}
                    <path d={waveUpperD} fill="none" stroke={wireColor} strokeWidth={0.8} strokeOpacity={0.4} />

                    {/* Feixe central estático */}
                    <path d={mainD} fill="none" stroke={wireColor} strokeWidth={1.4} strokeOpacity={0.9} />

                    {/* Filamento harmônico inferior */}
                    <path d={waveLowerD} fill="none" stroke={wireColor} strokeWidth={0.8} strokeOpacity={0.4} />
                  </>
                ) : (
                  <>
                    <path d={waveUpperD} fill="none" stroke={wireColor} strokeWidth={0.7} strokeOpacity={0.2} />
                    <path d={mainD} fill="none" stroke={wireColor} strokeWidth={1} strokeOpacity={0.45} />
                    <path d={waveLowerD} fill="none" stroke={wireColor} strokeWidth={0.7} strokeOpacity={0.2} />
                  </>
                )}

                {/* Âncora circular discreta no ponto de partida da conexão */}
                <circle cx={from.x} cy={from.y} r={2} fill={wireColor} opacity={0.85} />

                {/* Seta da conexão posicionada exatamente no centro entre as duas bordas (to.x, to.y),
                    apontando para o centro da bolinha e ficando atrás da bolinha interna */}
                {renderConnectionArrow(to.x, to.y, toDir, wireColor)}

                {/* Tag da Relação em Cápsula Central */}
                {Boolean(edge.relation) && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    style={{
                      pointerEvents: 'all',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(toNode);
                    }}
                  >
                    <rect
                      x={-Math.max(46, edge.relation.length * 6 + 14) / 2}
                      y={-9}
                      width={Math.max(46, edge.relation.length * 6 + 14)}
                      height={18}
                      rx={9}
                      fill={isEffectiveDark ? '#141414' : '#ffffff'}
                      stroke={isWireActive ? wireColor : isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                      strokeWidth={1}
                      strokeOpacity={isWireActive ? 0.7 : 0.3}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill={isWireActive ? (isEffectiveDark ? '#f4f4f5' : '#0f172a') : textSecondary}
                      fontSize={9}
                      fontWeight={400}
                      fontFamily="'Poppins', sans-serif"
                    >
                      {edge.relation}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ================================================================= */}
      {/* 4. CAMADA INTERNA DA BOLINHA COM ÍCONE (zIndex: 10)               */}
      {/*    A bolinha tem fundo sólido e cobre a ponta da seta que vem     */}
      {/*    de trás, garantindo que a seta fique ATRÁS da bolinha         */}
      {/* ================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {localNodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const isDragging = draggingNodeId === node.id;
          const isRoot = node.id === 'root-project';
          const innerSize = isRoot ? ROOT_INNER_SIZE : NODE_INNER_SIZE;
          const outerSize = isRoot ? ROOT_OUTER_SIZE : NODE_OUTER_SIZE;
          const nodeColor = isRoot ? accentColor : NODE_COLORS[node.type] || '#3b82f6';

          const isFilteredOut = !filteredNodeIds.has(node.id);
          const isConnected = activeFocusId ? connectedNodeIds.has(node.id) : true;
          const opacity = isFilteredOut ? 0.14 : activeFocusId && !isConnected ? 0.28 : 1;

          return (
            <div
              key={'node-inner-' + node.id}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                pointerEvents: 'none',
                opacity,
                transition: isDragging ? 'none' : 'opacity 0.2s ease',
              }}
            >
              {/* Bolinha Interna com Ícone e Borda Interna */}
              <div
                data-node-circle="true"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasMovedRef.current) {
                    onSelectNode(node);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (onOpenNodeFile && node.path) {
                    onOpenNodeFile(node.path);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: -innerSize / 2,
                  top: -innerSize / 2,
                  width: innerSize,
                  height: innerSize,
                  borderRadius: '50%',
                  // Fundo sólido cobrindo a ponta da seta atrás
                  background: isEffectiveDark ? '#141414' : '#ffffff',
                  // Borda interna da bolinha
                  border: isSelected
                    ? `1.5px solid ${accentColor}`
                    : isEffectiveDark
                    ? '1px solid rgba(255, 255, 255, 0.12)'
                    : '1px solid rgba(0, 0, 0, 0.12)',
                  boxShadow: 'none',
                  cursor: isDragging ? 'grabbing' : 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'auto',
                  transition: isDragging ? 'none' : 'transform 0.15s ease, border-color 0.15s ease',
                  transform: isHovered && !isDragging ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {/* Preenchimento sutil da cor temática */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 3,
                    borderRadius: '50%',
                    background: `${nodeColor}16`,
                    pointerEvents: 'none',
                  }}
                />

                {/* Ícone Centralizado */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderCategoryIcon(node.type, nodeColor, isRoot)}
                </div>

                {/* Pin indicador */}
                {node.pinned && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 3,
                    }}
                  >
                    <Pin size={8} color="#ffffff" />
                  </div>
                )}
              </div>

              {/* Rótulo do Nó Abaixo da Bolinha */}
              <div
                style={{
                  position: 'absolute',
                  top: outerSize / 2 + 5,
                  left: 0,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  pointerEvents: 'none',
                  width: 130,
                  textAlign: 'center',
                }}
              >
                <span
                  title={node.label}
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: isSelected ? accentColor : textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 130,
                    lineHeight: 1.2,
                  }}
                >
                  {node.label}
                </span>

                {(isHovered || isSelected) && node.path && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 400,
                      color: textSecondary,
                      fontFamily: "'JetBrains Mono', monospace",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 130,
                      lineHeight: 1.1,
                    }}
                  >
                    {node.path.split(/[/\\]/).slice(-1)[0]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* 5. TOP CONTROLS & SEARCH BAR (zIndex: 40)                         */}
      {/* ================================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          pointerEvents: 'none',
          zIndex: 40,
        }}
      >
        {/* Search Input with Instant Node Jump */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            background: floatingBg,
            borderRadius: 6,
            width: 250,
            border: 'none',
            boxShadow: 'none',
            pointerEvents: 'auto',
          }}
        >
          <Search size={14} color={textSecondary} />
          <input
            type="text"
            placeholder="Buscar nó no brain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = filteredNodes[0];
                if (target) focusOnNode(target);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
              color: textPrimary,
              fontSize: 12,
              fontWeight: 400,
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Pills & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 6,
              background: floatingBg,
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            {categories.map((cat) => {
              const isCatActive = activeCategory === cat;
              const label = cat === 'all' ? 'Todos' : NODE_LABELS[cat] || cat;
              const catColor = cat === 'all' ? accentColor : NODE_COLORS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 6,
                    borderRadius: 4,
                    border: 'none',
                    boxShadow: 'none',
                    background: isCatActive
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)'
                      : 'transparent',
                    color: isCatActive ? textPrimary : textSecondary,
                    fontSize: 11,
                    fontWeight: 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {cat !== 'all' && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: catColor,
                        display: 'inline-block',
                      }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Action Tools (Center, Organize, Export, Zoom) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 6,
              background: floatingBg,
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <button
              onClick={() => performZoomAt(window.innerWidth / 2, window.innerHeight / 2, -100)}
              title="Aumentar Zoom (+)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ZoomIn size={14} />
            </button>

            <button
              onClick={() => performZoomAt(window.innerWidth / 2, window.innerHeight / 2, 100)}
              title="Diminuir Zoom (-)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ZoomOut size={14} />
            </button>

            <span
              style={{
                fontSize: 10.5,
                fontWeight: 400,
                color: textSecondary,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '0 4px',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>

            <div style={{ width: 1, height: 16, background: dividerColor }} />

            <button
              onClick={() => handleCenterFlow(localNodes, activeCategory)}
              title="Centralizar e Enquadrar Todo o Grafo"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <Focus size={14} />
            </button>

            <button
              onClick={handleReorganizeLayout}
              title="Reorganizar Layout dos Módulos"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <LayoutGrid size={14} />
            </button>

            <button
              onClick={handleExportPng}
              title="Exportar Imagem PNG do Grafo"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                background: 'transparent',
                color: textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 6. BOTTOM INSPECTOR (QUANDO UM NÓ ESTÁ SELECIONADO) (zIndex: 45)   */}
      {/* ================================================================= */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            width: 320,
            background: floatingBg,
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            border: 'none',
            boxShadow: 'none',
            zIndex: 45,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: selectedNode.id === 'root-project' ? accentColor : NODE_COLORS[selectedNode.type] || accentColor,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary }}>
                {selectedNode.label}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  color: selectedNode.id === 'root-project' ? accentColor : NODE_COLORS[selectedNode.type],
                  background: `${selectedNode.id === 'root-project' ? accentColor : NODE_COLORS[selectedNode.type]}18`,
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {selectedNode.id === 'root-project' ? 'Raiz' : NODE_LABELS[selectedNode.type]}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {onTogglePinNode && (
                <button
                  onClick={() => onTogglePinNode(selectedNode.id)}
                  title={selectedNode.pinned ? 'Desafixar nó' : 'Fixar nó'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: selectedNode.pinned ? accentColor : textSecondary,
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {selectedNode.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
              )}

              <button
                onClick={() => onSelectNode(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <span
            style={{
              fontSize: 10.5,
              color: textSecondary,
              fontFamily: "'JetBrains Mono', Menlo, monospace",
              wordBreak: 'break-all',
            }}
          >
            {selectedNode.path}
          </span>

          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: textSecondary,
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            {selectedNode.description}
          </p>

          {selectedNodeNeighbors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>
                Conexões Diretas ({selectedNodeNeighbors.length}):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 72, overflowY: 'auto' }}>
                {selectedNodeNeighbors.map(({ node: n, relation }) => (
                  <button
                    key={n.id}
                    onClick={() => focusOnNode(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 4,
                      borderRadius: 4,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      border: 'none',
                      color: textPrimary,
                      fontSize: 10,
                      fontWeight: 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: n.id === 'root-project' ? accentColor : NODE_COLORS[n.type] || accentColor,
                      }}
                    />
                    <span>{n.label}</span>
                    <span style={{ fontSize: 9, color: textSecondary }}>({relation})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onOpenNodeFile && selectedNode.path && (
            <button
              onClick={() => onOpenNodeFile(selectedNode.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 6,
                borderRadius: 4,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                color: textPrimary,
                fontSize: 11,
                fontWeight: 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
              }}
            >
              <ExternalLink size={11} />
              <span>Abrir Arquivo no Editor</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
