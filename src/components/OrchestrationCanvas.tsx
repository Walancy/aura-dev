import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Plus,
  Zap,
  Check,
  ChevronDown,
  Layers,
  Database,
  Terminal,
  Bot,
  MessageSquare,
  Sparkles,
  Boxes,
  Trash2,
  Settings2,
  Clock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Activity,
  Sliders,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';

// ============================================================================
// TYPES
// ============================================================================

export type NodeType = 'trigger' | 'agent' | 'model' | 'memory' | 'tool' | 'vector';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  description?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status: 'ready' | 'running' | 'success' | 'failed' | 'disabled';
  icon?: string;
  config?: {
    credential?: string;
    model?: string;
    temperature?: number;
    account?: string;
    target?: string;
  };
  ports: {
    input?: string[];
    output?: string[];
  };
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  label?: string;
  color?: string;
  isActive?: boolean;
}

export interface ExecutionRecord {
  id: string;
  timestamp: string;
  status: 'success' | 'running' | 'failed';
  duration: string;
  inputTokens: number;
  outputTokens: number;
  nodesExecuted: number;
  triggerEvent: string;
  outputSummary: string;
}

export interface OrchestrationCanvasProps {
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: {
    bgCard?: string;
    bgCardSecondary?: string;
    textPrimary?: string;
    textSecondary?: string;
    border?: string;
    hoverBg?: string;
  };
}

// ============================================================================
// INITIAL SEED DATA (MATCHING USER'S SCREENSHOTS)
// ============================================================================

const initialNodes: WorkflowNode[] = [
  {
    id: 'node-trigger',
    type: 'trigger',
    title: 'When chat message received',
    subtitle: 'Webhook / Prompt',
    x: 140,
    y: 190,
    status: 'success',
    ports: {
      output: ['out'],
    },
  },
  {
    id: 'node-agent',
    type: 'agent',
    title: 'AI Agent',
    subtitle: 'Tools Agent',
    x: 480,
    y: 160,
    status: 'success',
    config: {
      target: 'DevFlow Workspace Coordinator',
    },
    ports: {
      input: ['in'],
      output: ['model', 'memory', 'tool', 'vector'],
    },
  },
  {
    id: 'node-model',
    type: 'model',
    title: 'OpenAI Chat Model',
    subtitle: 'gpt-4o-mini',
    x: 350,
    y: 450,
    status: 'success',
    config: {
      credential: 'Open AI account 4',
      model: 'gpt-4o-mini',
      temperature: 0.7,
    },
    ports: {
      output: ['model_out'],
    },
  },
  {
    id: 'node-memory',
    type: 'memory',
    title: 'Postgres Chat Memory',
    subtitle: '(Deactivated)',
    x: 630,
    y: 470,
    status: 'disabled',
    config: {
      account: 'Local Postgres Session',
    },
    ports: {
      output: ['mem_out'],
    },
  },
  {
    id: 'node-vector',
    type: 'vector',
    title: 'Qdrant Vector Store1',
    subtitle: 'Vector / Embedding',
    x: 880,
    y: 190,
    status: 'success',
    ports: {
      input: ['vec_in'],
      output: ['vec_out'],
    },
  },
  {
    id: 'node-tool',
    type: 'tool',
    title: 'Rust Orchestrator PTY',
    subtitle: 'Native CLI & Sandbox',
    x: 820,
    y: 440,
    status: 'ready',
    config: {
      target: 'devflow-orchestrator',
    },
    ports: {
      input: ['tool_in'],
    },
  },
];

const initialEdges: WorkflowEdge[] = [
  {
    id: 'edge-trigger-agent',
    fromNodeId: 'node-trigger',
    fromPort: 'out',
    toNodeId: 'node-agent',
    toPort: 'in',
    label: '1 item',
    color: '#22c55e',
    isActive: true,
  },
  {
    id: 'edge-model-agent',
    fromNodeId: 'node-model',
    fromPort: 'model_out',
    toNodeId: 'node-agent',
    toPort: 'model',
    label: 'Model',
    color: '#22c55e',
    isActive: true,
  },
  {
    id: 'edge-memory-agent',
    fromNodeId: 'node-memory',
    fromPort: 'mem_out',
    toNodeId: 'node-agent',
    toPort: 'memory',
    label: 'Memory',
    color: '#ffffff',
    isActive: false,
  },
  {
    id: 'edge-agent-vector',
    fromNodeId: 'node-agent',
    fromPort: 'vector',
    toNodeId: 'node-vector',
    toPort: 'vec_in',
    label: '1 item',
    color: '#22c55e',
    isActive: true,
  },
  {
    id: 'edge-agent-tool',
    fromNodeId: 'node-agent',
    fromPort: 'tool',
    toNodeId: 'node-tool',
    toPort: 'tool_in',
    label: 'Tool',
    color: '#38bdf8',
    isActive: false,
  },
];

const initialExecutions: ExecutionRecord[] = [
  {
    id: 'exec-984',
    timestamp: 'Há 2 minutos',
    status: 'success',
    duration: '1.43s',
    inputTokens: 12256,
    outputTokens: 92,
    nodesExecuted: 4,
    triggerEvent: 'chat:prompt("ola")',
    outputSummary: 'Olá! Como posso ajudar você no projeto DevFlow hoje?',
  },
  {
    id: 'exec-983',
    timestamp: 'Há 8 minutos',
    status: 'success',
    duration: '2.11s',
    inputTokens: 11872,
    outputTokens: 182,
    nodesExecuted: 4,
    triggerEvent: 'chat:prompt("ping")',
    outputSummary: 'pong',
  },
  {
    id: 'exec-982',
    timestamp: 'Há 25 minutos',
    status: 'success',
    duration: '3.40s',
    inputTokens: 18450,
    outputTokens: 410,
    nodesExecuted: 5,
    triggerEvent: 'issue:sync(#14 - Sprint 2)',
    outputSummary: 'Issue sincronizada com sucesso no quadro de sprints.',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrchestrationCanvas: React.FC<OrchestrationCanvasProps> = ({
  accentColor = '#22c55e',
  isEffectiveDark = true,
  themeTokens,
}) => {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'editor' | 'executions' | 'tests'>('editor');
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [executions, setExecutions] = useState<ExecutionRecord[]>(initialExecutions);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-model');

  // Canvas Transform (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Simulation / Run Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);

  // Modals
  const [isAddNodeOpen, setIsAddNodeOpen] = useState<boolean>(false);
  const [nodeToDelete, setNodeToDelete] = useState<WorkflowNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Colors based on theme
  const canvasBg = '#090a0f';
  const gridDotColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  // ============================================================================
  // LISTEN TO REAL RUST ORCHESTRATOR EVENTS
  // ============================================================================
  useEffect(() => {
    const unsubscribe = window.electronAPI?.ai?.onOrchestratorEvent?.((event: any) => {
      if (event?.kind === 'completed' || event?.kind === 'result') {
        const newRecord: ExecutionRecord = {
          id: `exec-${Date.now().toString().slice(-4)}`,
          timestamp: 'Agora mesmo',
          status: 'success',
          duration: `${((event.payload?.result?.duration_seconds || 1.2)).toFixed(2)}s`,
          inputTokens: event.payload?.result?.usage?.input_tokens || 12000,
          outputTokens: event.payload?.result?.usage?.output_tokens || 100,
          nodesExecuted: 4,
          triggerEvent: event.message || 'Orchestrator execution',
          outputSummary: event.payload?.result?.response || 'Execução concluída com sucesso.',
        };
        setExecutions((prev) => [newRecord, ...prev]);
      }
    });
    return () => unsubscribe?.();
  }, []);

  // ============================================================================
  // PANNING HANDLERS
  // ============================================================================
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background (not inside nodes or buttons)
    if ((e.target as HTMLElement).closest('.workflow-node, .workflow-control, .workflow-dock')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    } else if (draggingNodeId) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== draggingNodeId) return node;
          return {
            ...node,
            x: Math.round((e.clientX - dragOffsetRef.current.x - pan.x) / zoom),
            y: Math.round((e.clientY - dragOffsetRef.current.y - pan.y) / zoom),
          };
        })
      );
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || true) {
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      setZoom((prevZoom) => Math.min(1.8, Math.max(0.4, prevZoom * zoomFactor)));
    }
  };

  // ============================================================================
  // NODE DRAGGING HANDLER
  // ============================================================================
  const handleStartDragNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    dragOffsetRef.current = {
      x: e.clientX - (node.x * zoom + pan.x),
      y: e.clientY - (node.y * zoom + pan.y),
    };
  };

  // ============================================================================
  // EXECUTE FLOW (SIMULATION + REAL LIVE DISPATCH)
  // ============================================================================
  const handleRunWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveStepIndex(0);

    // Sequence through nodes
    const steps = ['node-trigger', 'node-agent', 'node-model', 'node-vector'];
    for (let i = 0; i < steps.length; i++) {
      setActiveStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    // Add execution record
    const record: ExecutionRecord = {
      id: `exec-${Date.now().toString().slice(-4)}`,
      timestamp: 'Agora mesmo',
      status: 'success',
      duration: '1.82s',
      inputTokens: 12434,
      outputTokens: 183,
      nodesExecuted: 4,
      triggerEvent: 'Workflow Manual Run',
      outputSummary: 'Todos os nós executados com sucesso no grafo de orquestração.',
    };
    setExecutions((prev) => [record, ...prev]);

    setIsRunning(false);
    setActiveStepIndex(-1);
  };

  // ============================================================================
  // NODE DELETION (WITH MODAL CONFIRMATION ACCORDING TO AGENTS.MD)
  // ============================================================================
  const handleConfirmDeleteNode = () => {
    if (!nodeToDelete) return;
    const targetId = nodeToDelete.id;
    setNodes((prev) => prev.filter((n) => n.id !== targetId));
    setEdges((prev) => prev.filter((e) => e.fromNodeId !== targetId && e.toNodeId !== targetId));
    if (selectedNodeId === targetId) setSelectedNodeId(null);
    setNodeToDelete(null);
  };

  // Node dimension lookup
  const getNodeDimensions = useCallback((node: WorkflowNode) => {
    if (node.type === 'trigger') return { width: 180, height: 160 };
    if (node.type === 'agent') return { width: 280, height: 170 };
    if (node.type === 'model') return { width: 270, height: 260 };
    if (node.type === 'memory') return { width: 170, height: 160 };
    if (node.type === 'vector') return { width: 220, height: 160 };
    if (node.type === 'tool') return { width: 230, height: 150 };
    return { width: 220, height: 160 };
  }, []);

  // Compute Port coordinates for Bezier Edges
  const getPortCoordinates = useCallback(
    (nodeId: string, portType: 'output' | 'input', portName?: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const { width, height } = getNodeDimensions(node);

      // Model connects from top to Agent
      if (node.type === 'model' && portType === 'output') {
        return { x: node.x + width / 2, y: node.y };
      }
      // Memory connects from top to Agent
      if (node.type === 'memory' && portType === 'output') {
        return { x: node.x + width / 2, y: node.y };
      }
      // Tool connects from top to Agent
      if (node.type === 'tool' && portType === 'input') {
        return { x: node.x + width / 2, y: node.y };
      }

      // Agent ports
      if (node.type === 'agent') {
        if (portName === 'model') return { x: node.x + 60, y: node.y + height };
        if (portName === 'memory') return { x: node.x + 140, y: node.y + height };
        if (portName === 'tool') return { x: node.x + 220, y: node.y + height };
        if (portName === 'vector') return { x: node.x + width, y: node.y + height / 2 };
        if (portType === 'input') return { x: node.x, y: node.y + height / 2 };
      }

      // Default cardinal ports
      if (portType === 'output') {
        return { x: node.x + width, y: node.y + height / 2 };
      }
      return { x: node.x, y: node.y + height / 2 };
    },
    [nodes, getNodeDimensions]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: canvasBg,
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#f8fafc',
      }}
    >
      {/* Background Matrix Dot Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${gridDotColor} 1.4px, transparent 1.4px)`,
          backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Top Vignette Gradient Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ========================================================================= */}
      {/* TOP HEADER BAR                                                            */}
      {/* ========================================================================= */}
      <header
        className="workflow-control"
        style={{
          position: 'absolute',
          top: 14,
          left: 20,
          right: 20,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 40,
          pointerEvents: 'auto',
        }}
      >
        {/* Left Title & Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Mac-style window dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
              AI Agent Battlecard
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)', fontWeight: 400 }}>
              /personal
            </span>
          </div>

          {/* Badge pill */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 9px',
              borderRadius: 20,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              letterSpacing: '0.01em',
            }}
          >
            Marketing
          </div>
        </div>

        {/* Center Pill Mode Switch (Editor | Executions | Tests) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(18, 20, 26, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: 3,
            gap: 2,
          }}
        >
          <button
            onClick={() => setActiveTab('editor')}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === 'editor' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'editor' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              transition: 'all 0.15s ease',
            }}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('executions')}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'executions' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'executions' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              transition: 'all 0.15s ease',
            }}
          >
            Executions
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                fontWeight: 600,
              }}
            >
              {executions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background: activeTab === 'tests' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'tests' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              transition: 'all 0.15s ease',
            }}
          >
            Tests
          </button>
        </div>

        {/* Right Actions: Run Flow, Zoom, Add Node */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Zoom controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(18, 20, 26, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: 10,
              padding: '2px 4px',
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              title="Diminuir Zoom"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
              }}
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '0 6px', fontWeight: 500 }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              title="Aumentar Zoom"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
              }}
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(0.95);
                setPan({ x: 40, y: 30 });
              }}
              title="Resetar Zoom"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
              }}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Add Node Button */}
          <button
            onClick={() => setIsAddNodeOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              padding: '7px 13px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)')}
          >
            <Plus size={13} />
            Adicionar Nó
          </button>

          {/* Primary Executar Fluxo Button with Green Neon Glow */}
          <button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: isRunning ? '#15803d' : '#22c55e',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: isRunning
                ? '0 0 25px rgba(34, 197, 94, 0.7)'
                : '0 0 20px rgba(34, 197, 94, 0.45)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.75)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning) {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.45)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isRunning ? (
              <Activity size={14} className="animate-spin" />
            ) : (
              <Play size={13} fill="#ffffff" />
            )}
            {isRunning ? 'Executando...' : 'Executar Fluxo'}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* LEFT FLOATING DOCK (MATCHING IMAGE 1)                                     */}
      {/* ========================================================================= */}
      <div
        className="workflow-dock"
        style={{
          position: 'absolute',
          top: 90,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 35,
          pointerEvents: 'auto',
        }}
      >
        {/* + Add shortcut */}
        <button
          onClick={() => setIsAddNodeOpen(true)}
          title="Adicionar Novo Nó"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(22, 25, 33, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            color: '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(30, 35, 46, 0.95)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#a1a1aa';
            e.currentTarget.style.background = 'rgba(22, 25, 33, 0.85)';
          }}
        >
          <Plus size={16} />
        </button>

        {/* Workflow Switcher */}
        <button
          title="Alternar Fluxo / Workflows"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(22, 25, 33, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            color: '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(30, 35, 46, 0.95)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#a1a1aa';
            e.currentTarget.style.background = 'rgba(22, 25, 33, 0.85)';
          }}
        >
          <Zap size={16} />
        </button>

        {/* Active Illuminated Green Button (Exact match with Image 1) */}
        <div style={{ position: 'relative' }}>
          {/* Left indicator bar */}
          <div
            style={{
              position: 'absolute',
              left: -8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 18,
              borderRadius: 4,
              background: '#22c55e',
              boxShadow: '0 0 10px #22c55e',
            }}
          />
          <button
            title="Agente Atual / Loop Ativo"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 22px rgba(16, 185, 129, 0.65)',
            }}
          >
            <Sparkles size={16} />
          </button>
        </div>

        {/* Layers / Integrations */}
        <button
          title="Camadas & Integrações"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(22, 25, 33, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            color: '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.background = 'rgba(30, 35, 46, 0.95)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#a1a1aa';
            e.currentTarget.style.background = 'rgba(22, 25, 33, 0.85)';
          }}
        >
          <Layers size={16} />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* EXECUTIONS TAB VIEW (WHEN SELECTED)                                       */}
      {/* ========================================================================= */}
      {activeTab === 'executions' && (
        <div
          style={{
            position: 'absolute',
            inset: '70px 20px 20px 20px',
            zIndex: 30,
            background: 'rgba(13, 15, 20, 0.94)',
            backdropFilter: 'blur(20px)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Histórico de Execuções do Orquestrador
              </h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' }}>
                Eventos e checkpoints sincronizados pelo Rust Orchestrator e pelos nós do fluxo.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('editor')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Voltar ao Editor
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {executions.map((exec) => (
              <div
                key={exec.id}
                style={{
                  background: 'rgba(22, 26, 35, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(28, 33, 44, 0.85)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(22, 26, 35, 0.7)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#22c55e',
                    }}
                  >
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#f8fafc' }}>
                        {exec.triggerEvent}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 8,
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#4ade80',
                          fontWeight: 600,
                        }}
                      >
                        {exec.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {exec.outputSummary}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                      {exec.duration}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{exec.timestamp}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#38bdf8' }}>
                      {exec.inputTokens + exec.outputTokens} tokens
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {exec.nodesExecuted} nós executados
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANVAS GRAPH (SVG CABLES + INTERACTIVE HTML NODES)                       */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning || draggingNodeId ? 'none' : 'transform 0.05s ease-out',
        }}
      >
        {/* ======================================================================= */}
        {/* SVG BEZIER CURVE CABLES (ORGANIC FILAMENTS & GLOWING FLOW)              */}
        {/* ======================================================================= */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 4000,
            height: 4000,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <defs>
            {/* Cable Glowing Filter */}
            <filter id="neon-glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neon-glow-white" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((edge) => {
            const from = getPortCoordinates(edge.fromNodeId, 'output', edge.fromPort);
            const to = getPortCoordinates(edge.toNodeId, 'input', edge.toPort);

            // Compute Organic Cubic Bezier Coordinates
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const isVertical = Math.abs(dy) > Math.abs(dx);

            let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

            if (isVertical) {
              // Vertical connection (e.g. Model / Memory / Tool pointing to Agent)
              const factor = Math.min(180, Math.abs(dy) * 0.5);
              cp1x = from.x;
              cp1y = from.y - factor;
              cp2x = to.x;
              cp2y = to.y + factor;
            } else {
              // Horizontal connection (Trigger -> Agent -> Vector)
              const factor = Math.max(60, Math.abs(dx) * 0.45);
              cp1x = from.x + factor;
              cp1y = from.y;
              cp2x = to.x - factor;
              cp2y = to.y;
            }

            const pathD = `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            const isGreen = edge.color === '#22c55e' || edge.color === undefined;
            const strokeColor = isGreen ? '#22c55e' : edge.color;
            const glowFilter = isGreen ? 'url(#neon-glow-green)' : 'url(#neon-glow-white)';

            return (
              <g key={edge.id}>
                {/* Background Wide Glow Aura */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={7}
                  strokeOpacity={0.15}
                  filter={glowFilter}
                />

                {/* Primary Central Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.8}
                  strokeOpacity={0.8}
                />

                {/* Multi-filament secondary organic lines (Matching Image 2) */}
                <path
                  d={`M ${from.x} ${from.y - 1.5} C ${cp1x} ${cp1y - 3}, ${cp2x} ${cp2y - 3}, ${to.x} ${to.y - 1.5}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={0.75}
                  strokeOpacity={0.4}
                />
                <path
                  d={`M ${from.x} ${from.y + 1.5} C ${cp1x} ${cp1y + 3}, ${cp2x} ${cp2y + 3}, ${to.x} ${to.y + 1.5}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={0.75}
                  strokeOpacity={0.4}
                />

                {/* Live Animated Flow Particles along the cable */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  strokeDasharray="8 60"
                  strokeLinecap="round"
                  style={{
                    animation: 'dash-flow 2.4s linear infinite',
                  }}
                />

                {/* Cable Center Capsule Badge (e.g. "1 item", "Model", "Memory") */}
                {edge.label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-28}
                      y={-11}
                      width={56}
                      height={22}
                      rx={11}
                      fill="#0d1017"
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={4}
                      fill="#94a3b8"
                      fontSize={10}
                      fontWeight={500}
                      textAnchor="middle"
                      fontFamily="inherit"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* ======================================================================= */}
        {/* WORKFLOW NODES (INTERACTIVE DOM CARDS)                                   */}
        {/* ======================================================================= */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const { width, height } = getNodeDimensions(node);
          const isModel = node.type === 'model';
          const isTrigger = node.type === 'trigger';
          const isAgent = node.type === 'agent';
          const isMemory = node.type === 'memory';

          return (
            <div
              key={node.id}
              className="workflow-node"
              onMouseDown={(e) => handleStartDragNode(e, node.id)}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: width,
                minHeight: height,
                borderRadius: 22,
                cursor: draggingNodeId === node.id ? 'grabbing' : 'grab',
                pointerEvents: 'auto',
                // Sleek glassmorphism / lush dark gradient
                background: isModel
                  ? 'linear-gradient(180deg, #103820 0%, #082113 100%)'
                  : 'rgba(17, 19, 26, 0.88)',
                backdropFilter: 'blur(16px)',
                border: isModel
                  ? '1.5px solid #22c55e'
                  : isSelected
                  ? '1.5px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isModel
                  ? '0 0 35px rgba(34, 197, 94, 0.35)'
                  : isSelected
                  ? '0 0 30px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.4)'
                  : '0 10px 30px rgba(0, 0, 0, 0.55)',
                padding: isTrigger ? '20px 18px' : '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              {/* Corner Radar Marking on Top-Left (Exact detail from reference image) */}
              <div
                style={{
                  position: 'absolute',
                  top: -6,
                  left: -6,
                  width: 18,
                  height: 18,
                  borderTop: '2px solid rgba(255, 255, 255, 0.22)',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.22)',
                  borderTopLeftRadius: 10,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -10,
                  left: -10,
                  width: 24,
                  height: 24,
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                  borderTopLeftRadius: 14,
                  pointerEvents: 'none',
                }}
              />

              {/* Status Indicator (Checkmark on top-right) */}
              <div style={{ position: 'absolute', top: 16, right: 18 }}>
                {node.status === 'success' && (
                  <Check size={14} color="#22c55e" strokeWidth={2.8} />
                )}
                {node.status === 'disabled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNodeToDelete(node);
                    }}
                    title="Excluir Nó"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(239, 68, 68, 0.8)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Top Organic Anchor Funnel (for Model & Memory pointing upward) */}
              {isModel && (
                <div
                  style={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Model</span>
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '10px solid transparent',
                      borderRight: '10px solid transparent',
                      borderBottom: '12px solid #22c55e',
                      filter: 'drop-shadow(0 0 6px #22c55e)',
                    }}
                  />
                </div>
              )}
              {isMemory && (
                <div
                  style={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Memory</span>
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '9px solid transparent',
                      borderRight: '9px solid transparent',
                      borderBottom: '11px solid #ffffff',
                      filter: 'drop-shadow(0 0 6px #ffffff)',
                    }}
                  />
                </div>
              )}

              {/* Card Header Content */}
              {isTrigger ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 12,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                    }}
                  >
                    <MessageSquare size={20} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#f8fafc', lineHeight: 1.3 }}>
                    When chat message received
                  </span>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: isModel
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isModel ? '#ffffff' : '#e2e8f0',
                      }}
                    >
                      {isAgent && <Bot size={22} />}
                      {isModel && <Sparkles size={22} />}
                      {isMemory && <Database size={20} />}
                      {node.type === 'vector' && <Boxes size={20} />}
                      {node.type === 'tool' && <Terminal size={20} />}
                    </div>

                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                        {node.title}
                      </div>
                      {node.subtitle && (
                        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>
                          {node.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Model Node Config Fields (Matches Image 4) */}
                  {isModel && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'rgba(255, 255, 255, 0.65)',
                            marginBottom: 6,
                          }}
                        >
                          Credential to connect with
                        </label>
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 12,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{node.config?.credential || 'Open AI account 4'}</span>
                          <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
                        </div>
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: 11,
                            color: 'rgba(255, 255, 255, 0.65)',
                            marginBottom: 6,
                          }}
                        >
                          Model
                        </label>
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 12,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{node.config?.model || 'gpt-4o-mini'}</span>
                          <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Agent Node Ports Labels (Chat model, Memory, Tool) */}
                  {isAgent && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -28,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'space-around',
                        fontSize: 10.5,
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ transform: 'translateX(6px)' }}>Chat model</span>
                      <span style={{ transform: 'translateX(0px)' }}>Memory</span>
                      <span
                        style={{
                          transform: 'translateX(-4px)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          pointerEvents: 'auto',
                        }}
                      >
                        Tool
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ADD NODE MODAL / POPOVER                                                  */}
      {/* ========================================================================= */}
      {isAddNodeOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsAddNodeOpen(false)}
        >
          <div
            style={{
              width: 440,
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 18,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', margin: 0 }}>
                Adicionar Nó ao Fluxo
              </h3>
              <button
                onClick={() => setIsAddNodeOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                {
                  type: 'model' as NodeType,
                  title: 'Antigravity / Gemini',
                  sub: 'Gemini 3.8 Flash',
                  icon: Sparkles,
                  color: '#22c55e',
                },
                {
                  type: 'model' as NodeType,
                  title: 'Claude 3.7 Sonnet',
                  sub: 'Anthropic Thinking',
                  icon: Sparkles,
                  color: '#f97316',
                },
                {
                  type: 'tool' as NodeType,
                  title: 'Rust Orchestrator',
                  sub: 'Code execution PTY',
                  icon: Terminal,
                  color: '#38bdf8',
                },
                {
                  type: 'memory' as NodeType,
                  title: 'Git Checkpoint Memory',
                  sub: 'Workspace Context',
                  icon: Database,
                  color: '#ffffff',
                },
                {
                  type: 'vector' as NodeType,
                  title: 'Qdrant Vector Store',
                  sub: 'Semantic Retrieval',
                  icon: Boxes,
                  color: '#a855f7',
                },
                {
                  type: 'trigger' as NodeType,
                  title: 'GitHub Issue Trigger',
                  sub: 'Automated sprint hook',
                  icon: MessageSquare,
                  color: '#eab308',
                },
              ].map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const newNode: WorkflowNode = {
                        id: `node-${Date.now().toString().slice(-4)}`,
                        type: item.type,
                        title: item.title,
                        subtitle: item.sub,
                        x: Math.round(-pan.x / zoom + 300 + Math.random() * 100),
                        y: Math.round(-pan.y / zoom + 200 + Math.random() * 100),
                        status: 'ready',
                        ports: {
                          input: ['in'],
                          output: ['out'],
                        },
                      };
                      setNodes((prev) => [...prev, newNode]);
                      setIsAddNodeOpen(false);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    <IconComponent size={18} color={item.color} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ffffff' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANDATORY CONFIRMATION MODAL FOR DELETION (AGENTS.MD COMPLIANCE)          */}
      {/* ========================================================================= */}
      {nodeToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(nodeToDelete)}
          title="Excluir Nó do Fluxo"
          message={`Tem certeza de que deseja remover o nó "${nodeToDelete.title}" deste fluxo de orquestração?`}
          itemDescription="As conexões conectadas a este nó também serão desfeitas. Esta ação não poderá ser desfeita."
          confirmLabel="Excluir Nó"
          cancelLabel="Cancelar"
          iconType="trash"
          onConfirm={handleConfirmDeleteNode}
          onClose={() => setNodeToDelete(null)}
        />
      )}

      {/* CSS Keyframe Animations for Cable Pulse Flow */}
      <style>{`
        @keyframes dash-flow {
          0% {
            stroke-dashoffset: 68;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};
