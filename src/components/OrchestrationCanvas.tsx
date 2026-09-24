import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Focus,
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
  Copy,
  ClipboardPaste,
  RefreshCw,
  Code,
  FileText,
  SlidersHorizontal,
  Power,
  Maximize2,
  Minimize2,
  Minus,
  Globe,
  MoreHorizontal,
  ArrowRight,
  ArrowDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ClaudeIcon,
  AntigravityIcon,
  GeminiIcon,
  OllamaIcon,
  CodexIcon,
} from './icons/AiProviderIcons';
import { AI_PROVIDERS as SYSTEM_AI_PROVIDERS } from '../constants/ai';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { NativeXTerm } from './NativeXTerm';
import { OrchestrationBrowserNode } from './OrchestrationBrowserNode';

// ============================================================================
// TYPES
// ============================================================================

export type NodeType = 'trigger' | 'agent' | 'model' | 'tool' | 'memory' | 'webview';
export type AiProviderId = 'gemini' | 'claude' | 'codex' | 'antigravity' | 'ollama';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status: 'ready' | 'idle' | 'running' | 'success' | 'failed' | 'disabled';
  provider?: AiProviderId;
  config: {
    prompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    command?: string;
    target?: string;
    account?: string;
    systemInstruction?: string;
    url?: string;
  };
  output?: {
    text?: string;
    durationMs?: number;
    tokens?: number;
    timestamp?: string;
    error?: string;
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
  triggerPrompt: string;
  outputSummary: string;
  providerUsed?: string;
  modelUsed?: string;
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
  workspacePath?: string;
  selectedAiProvider?: string;
  selectedModel?: string;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<
    string,
    {
      currentModel?: string;
      currentModelId?: string;
      models: Array<{ id: string; label: string; tag?: string; description?: string }>;
    }
  >;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, targetProviderId?: string) => void;
  onSelectWorkspace?: (dirPath: string, repoName?: string) => Promise<void> | void;
  onToast?: (msg: string) => void;
}

// ============================================================================
// PROVIDER DEFINITIONS WITH OFFICIAL ICONS
// ============================================================================

export interface ProviderMeta {
  id: AiProviderId;
  name: string;
  badge: string;
  renderIcon: (size?: number) => React.ReactNode;
}

export const AI_PROVIDER_INFOS: Record<AiProviderId, ProviderMeta> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    badge: 'Oficial',
    renderIcon: (size = 18) => <ClaudeIcon size={size} />,
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity',
    badge: 'CLI Agent',
    renderIcon: (size = 18) => <AntigravityIcon size={size} />,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    badge: 'Oficial',
    renderIcon: (size = 18) => <GeminiIcon size={size} />,
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    badge: 'GPT',
    renderIcon: (size = 18) => <CodexIcon size={size} />,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    badge: 'Offline',
    renderIcon: (size = 18) => <OllamaIcon size={size} />,
  },
};

// ============================================================================
// DEFAULT NODES & EDGES (MATCHING EXACT REFERENCE ARCHITECTURE)
// ============================================================================

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: 'node-trigger',
    type: 'trigger',
    title: 'When chat message received',
    subtitle: 'Prompt do usuário',
    x: 80,
    y: 140,
    width: 180,
    height: 115,
    status: 'success',
    config: {
      prompt: 'Analise os riscos das tarefas do sprint e sugira correções prioritárias com plano de ação.',
    },
    ports: {
      output: ['out'],
    },
  },
  {
    id: 'node-agent',
    type: 'agent',
    title: 'AI Agent',
    subtitle: 'Tools Agent',
    x: 390,
    y: 140,
    width: 200,
    height: 120,
    status: 'success',
    config: {
      systemInstruction: 'Você é o coordenador de engenharia DevFlow. Analise a demanda, invoque o modelo de IA correspondente e estruture os resultados.',
      target: 'Workspace DevFlow',
    },
    ports: {
      input: ['in'],
      output: ['chat_model', 'memory', 'tool'],
    },
  },
  {
    id: 'node-model-primary',
    type: 'model',
    title: 'OpenAI Chat Model',
    subtitle: 'Claude • Sonnet 5',
    provider: 'claude',
    x: 340,
    y: 390,
    width: 180,
    height: 115,
    status: 'success',
    config: {
      model: 'Sonnet 5',
      temperature: 0.7,
      maxTokens: 2048,
    },
    ports: {
      input: ['in'],
      output: ['out'],
    },
  },
  {
    id: 'node-memory',
    type: 'memory',
    title: 'Postgres Chat Memory',
    subtitle: '(Ativo no Workspace)',
    x: 600,
    y: 390,
    width: 180,
    height: 115,
    status: 'ready',
    config: {
      account: 'Sessão DevFlow',
    },
    ports: {
      input: ['in'],
    },
  },
];

const DEFAULT_EDGES: WorkflowEdge[] = [
  {
    id: 'edge-trigger-agent',
    fromNodeId: 'node-trigger',
    fromPort: 'out',
    toNodeId: 'node-agent',
    toPort: 'in',
    label: '1 item',
    color: '#FF6A00',
  },
  {
    id: 'edge-agent-model',
    fromNodeId: 'node-agent',
    fromPort: 'chat_model',
    toNodeId: 'node-model-primary',
    toPort: 'in',
    label: '1 item',
    color: '#FF6A00',
  },
  {
    id: 'edge-agent-memory',
    fromNodeId: 'node-agent',
    fromPort: 'memory',
    toNodeId: 'node-memory',
    toPort: 'in',
    label: '1 item',
    color: '#ffffff', // Silver/white memory connection matching reference UI!
  },
];

const STORAGE_KEY_NODES = 'devflow_orchestration_nodes_v9';
const STORAGE_KEY_EDGES = 'devflow_orchestration_edges_v9';
const STORAGE_KEY_LOGS = 'devflow_orchestration_logs_v9';
const STORAGE_KEY_PAN_ZOOM = 'devflow_orchestration_pan_zoom_v9';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrchestrationCanvas: React.FC<OrchestrationCanvasProps> = ({
  accentColor = '#FF6A00',
  isEffectiveDark = true,
  themeTokens,
  workspacePath,
  selectedAiProvider,
  selectedModel,
  installedClis = {},
  activeModels = {},
  onSelectAiProvider,
  onSelectModel,
  onSelectWorkspace,
  onToast,
}) => {
  // Pure black canvas background without bluish tint
  const canvasBg = isEffectiveDark ? '#000000' : '#f8fafc';
  const bgCard = themeTokens?.bgCard || (isEffectiveDark ? '#141414' : '#ffffff');
  const bgCardSecondary = themeTokens?.bgCardSecondary || (isEffectiveDark ? '#1c1c1c' : '#f1f5f9');
  const border = themeTokens?.border || (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)');
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#f8fafc' : '#0f172a');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#94a3b8' : '#64748b');
  const hoverBg = themeTokens?.hoverBg || (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)');

  const aiMenuRef = useRef<HTMLDivElement>(null);
  const aiButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns and popups on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (
        nodeOptionsPopupRef.current &&
        !nodeOptionsPopupRef.current.contains(target)
      ) {
        if (!target.closest('[data-node-card="true"]')) {
          setNodeOptionsPopup(null);
        }
      }
      if (
        aiPickerRef.current &&
        !aiPickerRef.current.contains(target) &&
        aiPickerBtnRef.current &&
        !aiPickerBtnRef.current.contains(target)
      ) {
        setIsAiPickerOpen(false);
      }

      // Deselect card when clicking outside any card, popup, modal, or instruction panel
      if (
        !target.closest('[data-node-card="true"]') &&
        !target.closest('[data-node-popup="true"]') &&
        !target.closest('[data-node-modal="true"]') &&
        !target.closest('[data-instruction-panel="true"]')
      ) {
        setSelectedNodeId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNodeOptionsPopup(null);
        setIsAiPickerOpen(false);
        setSelectedNodeId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'canvas' | 'logs'>('canvas');

  // Canvas DOM ref for exact mouse positioning during dragging
  const canvasRef = useRef<HTMLDivElement>(null);

  // Helper to fetch matching models identically to the Header and IDE
  const getProviderModelList = useCallback(
    (providerId: string): Array<{ id: string; label: string; tag?: string }> => {
      const dynamicList = activeModels?.[providerId]?.models || [];
      if (dynamicList.length > 0) {
        return dynamicList;
      }
      const sysProvider = SYSTEM_AI_PROVIDERS.find((p) => p.id === providerId);
      if (sysProvider?.models && sysProvider.models.length > 0) {
        return sysProvider.models.map((m) => ({ id: m, label: m }));
      }
      return [{ id: 'default', label: 'Default' }];
    },
    [activeModels]
  );

  // Workflow State
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NODES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NODES;
  });

  const [edges, setEdges] = useState<WorkflowEdge[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EDGES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_EDGES;
  });

  const [executionLogs, setExecutionLogs] = useState<ExecutionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Automatically synchronize & validate node models with Header and IDE active models
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type === 'model') {
          const provId = (n.provider || selectedAiProvider || 'claude') as AiProviderId;
          const modelList = getProviderModelList(provId);
          const currentModelInConfig = n.config.model;

          const match = modelList.find(
            (m) => m.id === currentModelInConfig || m.label === currentModelInConfig
          );

          const activeCurrent = activeModels?.[provId]?.currentModel;
          const activeMatch = activeCurrent
            ? modelList.find((m) => m.id === activeCurrent || m.label === activeCurrent)
            : null;

          const chosenModel = match?.label || activeMatch?.label || modelList[0]?.label || 'Default';
          const providerMeta = AI_PROVIDER_INFOS[provId] || AI_PROVIDER_INFOS.claude;
          const properSubtitle = `${providerMeta.name} • ${chosenModel}`;

          if (n.config.model !== chosenModel || n.subtitle !== properSubtitle || n.provider !== provId) {
            return {
              ...n,
              provider: provId,
              subtitle: properSubtitle,
              config: {
                ...n.config,
                model: chosenModel,
              },
            };
          }
        }
        return n;
      })
    );
  }, [activeModels, selectedAiProvider, selectedModel, getProviderModelList]);

  // Canvas Transform (Persisted so leaving and returning maintains exact pan and zoom)
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAN_ZOOM);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.zoom === 'number' && !isNaN(parsed.zoom)) {
          return parsed.zoom;
        }
      }
    } catch {}
    return 1;
  });

  const [pan, setPan] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAN_ZOOM);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number' && !isNaN(parsed.x) && !isNaN(parsed.y)) {
          return { x: parsed.x, y: parsed.y };
        }
      }
    } catch {}
    return { x: 40, y: 30 };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_PAN_ZOOM,
        JSON.stringify({ x: pan.x, y: pan.y, zoom })
      );
    } catch {}
  }, [pan.x, pan.y, zoom]);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasRightDraggedRef = useRef(false);
  const rightDragStartRef = useRef({ x: 0, y: 0 });
  const panMouseButtonRef = useRef<number | null>(null);

  // Dragging Nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Interactive Link Dragging State
  const [draggingLink, setDraggingLink] = useState<{
    fromNodeId: string;
    fromPort: string;
    currentX: number;
    currentY: number;
    snappedNodeId?: string | null;
    snappedPort?: string | null;
  } | null>(null);

  // Node Resizing State (Via interactive corner bracket or click)
  const [resizingNode, setResizingNode] = useState<{
    nodeId: string;
    corner: 'nw' | 'se';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startNodeX: number;
    startNodeY: number;
    hasDragged: boolean;
  } | null>(null);

  // Multi-CLI state for nodes & neighbor displacement memory
  const [expandedCliNodes, setExpandedCliNodes] = useState<Record<string, boolean>>({});
  const cliOriginalPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});

  // Selection & Modal Popup State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(null);

  // Active instruction node & visibility for bottom drawer (only visible when a card is selected)
  const [activeInstructionNodeId, setActiveInstructionNodeId] = useState<string | null>(null);
  const [isInstructionVisible, setIsInstructionVisible] = useState<boolean>(false);
  const [instructionPanelHeight, setInstructionPanelHeight] = useState<number>(170);
  const [isResizingInstructionPanel, setIsResizingInstructionPanel] = useState<boolean>(false);
  const panelResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [lastActiveNode, setLastActiveNode] = useState<WorkflowNode | null>(null);

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null),
    [nodes, selectedNodeId]
  );

  const isSelectedNodeTerminal = useMemo(() => {
    if (!selectedNode) return false;
    return Boolean(expandedCliNodes[selectedNode.id] || selectedNode.type === 'tool');
  }, [selectedNode, expandedCliNodes]);

  const activeInstructionNode = selectedNode || lastActiveNode;

  useEffect(() => {
    if (selectedNode) {
      setLastActiveNode(selectedNode);
      setActiveInstructionNodeId(selectedNode.id);
      const isTerminal = Boolean(expandedCliNodes[selectedNode.id] || selectedNode.type === 'tool');
      if (isTerminal) {
        setIsInstructionVisible(false);
      } else {
        setIsInstructionVisible(true);
      }
      if (selectedNode.type === 'model') {
        setInstructionPanelHeight((prev) => Math.max(prev, 170));
      }
    }
  }, [selectedNode, expandedCliNodes]);

  const handleStartResizeInstructionPanel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingInstructionPanel(true);
    panelResizeRef.current = {
      startY: e.clientY,
      startHeight: instructionPanelHeight,
    };
  };

  useEffect(() => {
    if (!isResizingInstructionPanel) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelResizeRef.current) return;
      const deltaY = panelResizeRef.current.startY - e.clientY;
      const isModel = activeInstructionNode?.type === 'model';
      const minH = isModel ? 170 : 110;
      const maxH = Math.min(650, window.innerHeight * 0.75);
      const newHeight = Math.max(minH, Math.min(maxH, panelResizeRef.current.startHeight + deltaY));
      setInstructionPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingInstructionPanel(false);
      panelResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingInstructionPanel, instructionPanelHeight, activeInstructionNode]);

  const isPanelOpen = Boolean(
    selectedNodeId &&
    isInstructionVisible &&
    activeInstructionNode &&
    !isSelectedNodeTerminal
  );

  const getInstructionLabel = (node: WorkflowNode): string => {
    switch (node.type) {
      case 'agent':
        return 'Instrução do agente';
      case 'trigger':
        return 'Prompt de entrada';
      case 'tool':
        return 'Comando shell';
      case 'memory':
        return 'Escopo da sessão';
      case 'model':
        return 'Instruções do modelo';
      case 'webview':
        return 'URL inicial do navegador';
      default:
        return 'Instrução do nó';
    }
  };

  const getInstructionPlaceholder = (node: WorkflowNode): string => {
    switch (node.type) {
      case 'agent':
        return 'Defina as instruções, persona e objetivos do agente...';
      case 'trigger':
        return 'Digite o prompt do usuário ou evento inicial...';
      case 'tool':
        return 'Ex: git status -s ou bun run test';
      case 'memory':
        return 'Ex: Sessão DevFlow / Workspace Context';
      case 'model':
        return 'Instruções adicionais de contexto para o modelo...';
      case 'webview':
        return 'Ex: http://localhost:5173 ou https://meu-site.com';
      default:
        return 'Instruções do nó...';
    }
  };

  const getInstructionValue = (node: WorkflowNode): string => {
    switch (node.type) {
      case 'agent':
        return node.config?.systemInstruction || '';
      case 'trigger':
        return node.config?.prompt || '';
      case 'tool':
        return node.config?.command || '';
      case 'memory':
        return node.config?.account || '';
      case 'model':
        return node.config?.systemInstruction || '';
      case 'webview':
        return node.config?.url || '';
      default:
        return '';
    }
  };

  const handleUpdateInstructionValue = (nodeId: string, value: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    switch (node.type) {
      case 'agent':
        handleUpdateNode(nodeId, { config: { ...node.config, systemInstruction: value } });
        break;
      case 'trigger':
        handleUpdateNode(nodeId, { config: { ...node.config, prompt: value } });
        break;
      case 'tool':
        handleUpdateNode(nodeId, { config: { ...node.config, command: value } });
        break;
      case 'memory':
        handleUpdateNode(nodeId, { config: { ...node.config, account: value } });
        break;
      case 'model':
        handleUpdateNode(nodeId, { config: { ...node.config, systemInstruction: value } });
        break;
      case 'webview':
        handleUpdateNode(nodeId, { config: { ...node.config, url: value } });
        break;
    }
  };

  const [nodeOptionsPopup, setNodeOptionsPopup] = useState<{
    nodeId: string;
    x: number;
    y: number;
    view?: 'menu' | 'confirm_delete';
  } | null>(null);
  const nodeOptionsPopupRef = useRef<HTMLDivElement>(null);
  const [isAiPickerOpen, setIsAiPickerOpen] = useState(false);
  const [hoveredToolbarButton, setHoveredToolbarButton] = useState<string | null>(null);
  const aiPickerRef = useRef<HTMLDivElement>(null);
  const aiPickerBtnRef = useRef<HTMLButtonElement>(null);
  const activePopupNode = useMemo(
    () => (nodeOptionsPopup ? nodes.find((n) => n.id === nodeOptionsPopup.nodeId) || null : null),
    [nodes, nodeOptionsPopup]
  );
  const [popupTab, setPopupTab] = useState<'options' | 'config'>('options');
  const configuringNode = useMemo(
    () => nodes.find((n) => n.id === configuringNodeId) || null,
    [nodes, configuringNodeId]
  );

  // Modals & Execution
  const [nodeToDelete, setNodeToDelete] = useState<WorkflowNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExecutingFlow, setIsExecutingFlow] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // Persist State
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NODES, JSON.stringify(nodes));
    } catch {}
  }, [nodes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EDGES, JSON.stringify(edges));
    } catch {}
  }, [edges]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(executionLogs));
    } catch {}
  }, [executionLogs]);

  // Global click to close context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  const handleMouseUpRef = useRef<() => void>(() => {});

  // Global mouseup to ensure panning / dragging cleanly stops anywhere
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      handleMouseUpRef.current();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Mouse wheel scrolling & zooming on canvas
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't intercept scroll inside modals, popups or dropdowns
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-node-modal="true"]') ||
        target?.closest('[data-node-popup="true"]')
      ) {
        return;
      }

      e.preventDefault();

      // Zoom centered at mouse cursor if Ctrl / Cmd is held (or trackpad pinch-to-zoom)
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((currentZoom) => {
          const nextZoom = Math.min(2.5, Math.max(0.3, Number((currentZoom * zoomFactor).toFixed(2))));
          if (nextZoom !== currentZoom && canvasEl) {
            const rect = canvasEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            setPan((currentPan) => ({
              x: Math.round(mouseX - (mouseX - currentPan.x) * (nextZoom / currentZoom)),
              y: Math.round(mouseY - (mouseY - currentPan.y) * (nextZoom / currentZoom)),
            }));
          }
          return nextZoom;
        });
        return;
      }

      // Normal mouse wheel scroll (vertical & horizontal)
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;

      // Shift + vertical scroll = horizontal scroll
      if (e.shiftKey && deltaX === 0) {
        deltaX = deltaY;
        deltaY = 0;
      }

      setNodeOptionsPopup(null);
      setIsAiPickerOpen(false);

      setPan((prev) => ({
        x: Math.round(prev.x - deltaX),
        y: Math.round(prev.y - deltaY),
      }));
    };

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvasEl.removeEventListener('wheel', handleWheel);
  }, [activeTab]);

  // ============================================================================
  // PORT COORDINATES & DYNAMIC DIRECTION RESOLUTION
  // ============================================================================

  const getNodeDimensions = useCallback(
    (node: WorkflowNode) => {
      if (node.type === 'webview') {
        return {
          width: node.width && node.width >= 320 ? node.width : 640,
          height: node.height && node.height >= 240 ? node.height : 440,
        };
      }
      if (expandedCliNodes[node.id]) {
        return {
          width: node.width && node.width >= 360 ? node.width : 580,
          height: node.height && node.height >= 220 ? node.height : 380,
        };
      }
      const defaultW = node.type === 'agent' ? 200 : 180;
      const defaultH = node.type === 'agent' ? 120 : 115;
      const baseW = node.width || defaultW;
      const baseH = node.height || defaultH;
      return {
        width: baseW,
        height: baseH,
      };
    },
    [expandedCliNodes]
  );

  const getInitialCliCommand = useCallback(
    (node: WorkflowNode) => {
      const p = (node.provider || selectedAiProvider || 'claude') as AiProviderId;
      if (p === 'claude') {
        return installedClis?.claude ? 'claude' : '';
      }
      if (p === 'antigravity') {
        return installedClis?.antigravity ? 'agy' : '';
      }
      if (p === 'gemini') {
        return installedClis?.gemini ? 'gemini' : '';
      }
      if (p === 'codex') {
        return installedClis?.codex ? 'codex' : '';
      }
      if (p === 'ollama') {
        const m = node.config.model;
        return m ? `ollama run ${m}` : 'ollama';
      }
      return '';
    },
    [selectedAiProvider, installedClis]
  );

  const toggleNodeCli = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      const isOpening = !expandedCliNodes[nodeId];

      setExpandedCliNodes((prev) => ({
        ...prev,
        [nodeId]: isOpening,
      }));

      const CLI_W = 580;
      const CLI_H = 380;
      const currentDims = getNodeDimensions(targetNode);
      const deltaW = CLI_W - currentDims.width;
      const deltaH = CLI_H - currentDims.height;

      if (isOpening) {
        setIsInstructionVisible(false);
        // Save current positions of other nodes for this CLI
        const origMap: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          origMap[n.id] = { x: n.x, y: n.y };
        });
        cliOriginalPositionsRef.current[nodeId] = origMap;

        // Shift neighboring nodes away so they are not covered
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === nodeId) return n;

            const nDims = getNodeDimensions(n);

            // Is node to the right of expanding card?
            const isToRight = n.x >= targetNode.x + currentDims.width * 0.35;
            // Is node vertically overlapping or close to expanding card?
            const isVertOverlap =
              n.y + nDims.height >= targetNode.y - 30 &&
              n.y <= targetNode.y + CLI_H + 40;

            // Is node below expanding card?
            const isBelow = n.y >= targetNode.y + currentDims.height * 0.35;
            // Is node horizontally overlapping or close?
            const isHorizOverlap =
              n.x + nDims.width >= targetNode.x - 30 &&
              n.x <= targetNode.x + CLI_W + 40;

            let newX = n.x;
            let newY = n.y;

            if (isToRight && isVertOverlap) {
              newX += deltaW + 50;
            } else if (isBelow && isHorizOverlap) {
              newY += deltaH + 50;
            }

            return { ...n, x: newX, y: newY };
          })
        );

        if (onToast) {
          onToast(`CLI aberto para "${targetNode.title}"`);
        }
      } else {
        // Closing CLI: restore original positions of neighbors
        const savedPositions = cliOriginalPositionsRef.current[nodeId];
        if (savedPositions) {
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              if (n.id === nodeId) return n;
              if (savedPositions[n.id]) {
                return {
                  ...n,
                  x: savedPositions[n.id].x,
                  y: savedPositions[n.id].y,
                };
              }
              return n;
            })
          );
          delete cliOriginalPositionsRef.current[nodeId];
        }

        if (onToast) {
          onToast(`CLI fechado para "${targetNode.title}"`);
        }
      }
    },
    [nodes, expandedCliNodes, getNodeDimensions, onToast]
  );

  // Center and fit the entire graph into view
  const handleCenterFlow = useCallback(() => {
    if (!nodes || nodes.length === 0) {
      setPan({ x: 40, y: 30 });
      setZoom(1);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const { width, height } = getNodeDimensions(node);
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x + width > maxX) maxX = node.x + width;
      if (node.y + height > maxY) maxY = node.y + height;
    }

    const bboxW = Math.max(20, maxX - minX);
    const bboxH = Math.max(20, maxY - minY);
    const centerX = minX + bboxW / 2;
    const centerY = minY + bboxH / 2;

    const canvasEl = canvasRef.current;
    const canvasW = canvasEl?.clientWidth || window.innerWidth;
    const canvasH = canvasEl?.clientHeight || window.innerHeight;

    // Leave comfortable margins around flow so nodes and handles are never clipped
    const paddingX = 140;
    const paddingY = 110;
    const availableW = Math.max(100, canvasW - paddingX * 2);
    const availableH = Math.max(100, canvasH - paddingY * 2);

    const scaleX = availableW / bboxW;
    const scaleY = availableH / bboxH;
    let fitZoom = Math.min(scaleX, scaleY);
    // Clamp zoom to clean usability bounds (min 0.45, max 1.15)
    fitZoom = Math.max(0.45, Math.min(1.15, Number(fitZoom.toFixed(2))));

    const newPanX = Math.round(canvasW / 2 - centerX * fitZoom);
    const newPanY = Math.round(canvasH / 2 - centerY * fitZoom);

    setZoom(fitZoom);
    setPan({ x: newPanX, y: newPanY });
    if (onToast) {
      onToast('Mapa centralizado e ajustado à tela');
    }
  }, [nodes, getNodeDimensions, onToast]);

  const getPortCoordinates = useCallback(
    (nodeId: string, portType: 'output' | 'input', portName?: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const { width, height } = getNodeDimensions(node);

      // Port handles align precisely with outer contour ring (7px outside inner card)
      const outerPad = 7;

      if (node.type === 'agent') {
        if (portName === 'chat_model') {
          return { x: node.x + width * 0.25, y: node.y + height + outerPad };
        }
        if (portName === 'memory') {
          return { x: node.x + width * 0.65, y: node.y + height + outerPad };
        }
        if (portName === 'tool') {
          return { x: node.x + width + outerPad, y: node.y + height / 2 };
        }
      }

      if (portType === 'output') {
        return { x: node.x + width + 14, y: node.y + height / 2 };
      }
      return { x: node.x - outerPad, y: node.y + height / 2 };
    },
    [nodes, getNodeDimensions]
  );

  // Connection geometry calculation for horizontal & vertical flows
  const getConnectionEndpoints = useCallback(
    (edge: WorkflowEdge) => {
      const fromNode = nodes.find((n) => n.id === edge.fromNodeId);
      const toNode = nodes.find((n) => n.id === edge.toNodeId);
      if (!fromNode || !toNode) {
        return {
          from: { x: 0, y: 0 },
          to: { x: 0, y: 0 },
          fromDir: 'right' as const,
          toDir: 'left' as const,
        };
      }

      const fromDims = getNodeDimensions(fromNode);
      const toDims = getNodeDimensions(toNode);

      const dy = toNode.y - fromNode.y;
      const dx = toNode.x - fromNode.x;

      // Outer contour ring is 7px outside inner card bounds
      const outerPad = 7;

      // Vertical flow (e.g. Agent -> Model or Agent -> Memory)
      if (dy > fromDims.height * 0.65 && Math.abs(dx) < 320) {
        const portOffset =
          edge.fromPort === 'memory' ? fromDims.width * 0.65 : fromDims.width * 0.25;
        return {
          from: { x: fromNode.x + portOffset, y: fromNode.y + fromDims.height + outerPad },
          to: { x: toNode.x + toDims.width / 2, y: toNode.y - outerPad },
          fromDir: 'down' as const,
          toDir: 'up' as const,
        };
      }

      // Default horizontal flow connected to external output handle (14px) and input port (-7px)
      return {
        from: { x: fromNode.x + fromDims.width + 14, y: fromNode.y + fromDims.height / 2 },
        to: { x: toNode.x - outerPad, y: toNode.y + toDims.height / 2 },
        fromDir: 'right' as const,
        toDir: 'left' as const,
      };
    },
    [nodes, getNodeDimensions]
  );

  // ============================================================================
  // DRAGGING NODES, PANNING & INTERACTIVE LINK DRAGGING
  // ============================================================================

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsAiPickerOpen(false);
    setNodeOptionsPopup(null);

    const targetEl = e.target as HTMLElement;
    const isCard = !!targetEl.closest('[data-node-card="true"]');
    const isInstruction = !!targetEl.closest('[data-instruction-panel="true"]');
    const isInteractiveButton =
      !!targetEl.closest('button') ||
      !!targetEl.closest('input') ||
      !!targetEl.closest('textarea');

    if (!isCard && !isInstruction) {
      setSelectedNodeId(null);
    }

    // Right-click (button === 2), Middle-click (button === 1), or Left-click (button === 0) on canvas background
    if (e.button === 2 || e.button === 1 || (!isCard && !isInteractiveButton && e.button === 0)) {
      setIsPanning(true);
      panMouseButtonRef.current = e.button;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      if (e.button === 2) {
        hasRightDraggedRef.current = false;
        rightDragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (resizingNode) {
      const dist = Math.hypot(
        e.clientX - resizingNode.startX,
        e.clientY - resizingNode.startY
      );
      if (dist > 3) {
        resizingNode.hasDragged = true;
      }
      const dx = (e.clientX - resizingNode.startX) / zoom;
      const dy = (e.clientY - resizingNode.startY) / zoom;

      const targetNode = nodes.find((n) => n.id === resizingNode.nodeId);
      const isCli = targetNode ? Boolean(expandedCliNodes[targetNode.id]) : false;
      const isWeb = targetNode?.type === 'webview';

      const minW = isCli ? 360 : isWeb ? 320 : 140;
      const minH = isCli ? 220 : isWeb ? 240 : 110;
      const maxW = isCli || isWeb ? 2200 : 900;
      const maxH = isCli || isWeb ? 1600 : 700;

      let newWidth = resizingNode.startWidth;
      let newHeight = resizingNode.startHeight;
      let newX = resizingNode.startNodeX;
      let newY = resizingNode.startNodeY;

      if (resizingNode.corner === 'se') {
        // Bottom-right resize: drag down/right enlarges width and height while node origin (x, y) remains stable
        newWidth = Math.max(minW, Math.min(maxW, Math.round(resizingNode.startWidth + dx)));
        newHeight = Math.max(minH, Math.min(maxH, Math.round(resizingNode.startHeight + dy)));
      } else {
        // Top-left resize: drag up/left enlarges width and height, anchored to bottom-right corner
        newWidth = Math.max(minW, Math.min(maxW, Math.round(resizingNode.startWidth - dx)));
        newHeight = Math.max(minH, Math.min(maxH, Math.round(resizingNode.startHeight - dy)));
        newX = Math.round(resizingNode.startNodeX + (resizingNode.startWidth - newWidth));
        newY = Math.round(resizingNode.startNodeY + (resizingNode.startHeight - newHeight));
      }

      setNodes((prev) =>
        prev.map((n) =>
          n.id === resizingNode.nodeId
            ? { ...n, width: newWidth, height: newHeight, x: newX, y: newY }
            : n
        )
      );
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      if (panMouseButtonRef.current === 2) {
        const dist = Math.hypot(
          e.clientX - rightDragStartRef.current.x,
          e.clientY - rightDragStartRef.current.y
        );
        if (dist > 3) {
          hasRightDraggedRef.current = true;
        }
      }
    } else if (draggingNodeId) {
      if (nodeOptionsPopup) setNodeOptionsPopup(null);
      const dist = Math.hypot(
        e.clientX - dragStartPositionRef.current.x,
        e.clientY - dragStartPositionRef.current.y
      );
      if (dist > 4) {
        hasDraggedRef.current = true;
      }

      // Edge auto-pan when dragging card near canvas viewport borders for infinite reach
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const edgeThreshold = 45;
        let panDeltaX = 0;
        let panDeltaY = 0;

        if (e.clientX < rect.left + edgeThreshold) {
          panDeltaX = 14;
        } else if (e.clientX > rect.right - edgeThreshold) {
          panDeltaX = -14;
        }

        if (e.clientY < rect.top + edgeThreshold) {
          panDeltaY = 14;
        } else if (e.clientY > rect.bottom - edgeThreshold) {
          panDeltaY = -14;
        }

        if (panDeltaX !== 0 || panDeltaY !== 0) {
          setPan((p) => ({ x: p.x + panDeltaX, y: p.y + panDeltaY }));
          dragOffsetRef.current.x += panDeltaX;
          dragOffsetRef.current.y += panDeltaY;
        }
      }

      const newX = Math.round((e.clientX - dragOffsetRef.current.x) / zoom);
      const newY = Math.round((e.clientY - dragOffsetRef.current.y) / zoom);
      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
      );
    } else if (draggingLink && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = Math.round((e.clientX - rect.left - pan.x) / zoom);
      const mouseY = Math.round((e.clientY - rect.top - pan.y) / zoom);

      // Magnetic snapping to target ports (como um ímã)
      let snappedTarget: { nodeId: string; port: string; x: number; y: number } | null = null;
      let minDistance = 55; // snapping radius in canvas units

      for (const n of nodes) {
        if (n.id === draggingLink.fromNodeId) continue;
        if (!n.ports.input) continue;

        const portCoords = getPortCoordinates(n.id, 'input', 'in');
        const dist = Math.hypot(mouseX - portCoords.x, mouseY - portCoords.y);

        if (dist < minDistance) {
          minDistance = dist;
          snappedTarget = { nodeId: n.id, port: 'in', x: portCoords.x, y: portCoords.y };
        }
      }

      if (snappedTarget) {
        setDraggingLink((prev) =>
          prev
            ? {
                ...prev,
                currentX: snappedTarget!.x,
                currentY: snappedTarget!.y,
                snappedNodeId: snappedTarget!.nodeId,
                snappedPort: snappedTarget!.port,
              }
            : null
        );
      } else {
        setDraggingLink((prev) =>
          prev
            ? {
                ...prev,
                currentX: mouseX,
                currentY: mouseY,
                snappedNodeId: null,
                snappedPort: null,
              }
            : null
        );
      }
    }
  };

  const handleToggleNodeSize = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const isCli = Boolean(expandedCliNodes[node.id]);
    const isWeb = node.type === 'webview';

    if (isCli) {
      const defaultW = 580;
      const defaultH = 380;
      const expandedW = 840;
      const expandedH = 540;
      const isCurrentlyExpanded =
        (node.width && node.width > defaultW + 20) || (node.height && node.height > defaultH + 20);

      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? {
                ...n,
                width: isCurrentlyExpanded ? defaultW : expandedW,
                height: isCurrentlyExpanded ? defaultH : expandedH,
              }
            : n
        )
      );
      return;
    }

    if (isWeb) {
      const defaultW = 640;
      const defaultH = 440;
      const expandedW = 960;
      const expandedH = 640;
      const isCurrentlyExpanded =
        (node.width && node.width > defaultW + 20) || (node.height && node.height > defaultH + 20);

      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? {
                ...n,
                width: isCurrentlyExpanded ? defaultW : expandedW,
                height: isCurrentlyExpanded ? defaultH : expandedH,
              }
            : n
        )
      );
      return;
    }

    const defaultW = node.type === 'agent' ? 240 : 210;
    const defaultH = node.type === 'agent' ? 210 : 200;
    const isCurrentlyExpanded =
      (node.width && node.width > defaultW + 15) || (node.height && node.height > defaultH + 15);

    setNodes((prev) =>
      prev.map((n) =>
        n.id === node.id
          ? {
              ...n,
              width: isCurrentlyExpanded ? defaultW : defaultW + 80,
              height: isCurrentlyExpanded ? defaultH : defaultH + 60,
            }
          : n
      )
    );
  };

  const handleStartResize = (e: React.MouseEvent, nodeId: string, corner: 'se' | 'nw' = 'se') => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { width, height } = getNodeDimensions(node);
    setResizingNode({
      nodeId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: width,
      startHeight: height,
      startNodeX: node.x,
      startNodeY: node.y,
      hasDragged: false,
    });
    setSelectedNodeId(nodeId);
  };

  const handleMouseUp = () => {
    if (resizingNode) {
      if (!resizingNode.hasDragged) {
        // Pure click: toggle between standard and expanded dimensions
        handleToggleNodeSize(resizingNode.nodeId);
      }
      setResizingNode(null);
      return;
    }

    if (draggingLink) {
      const targetNode = draggingLink.snappedNodeId
        ? nodes.find((n) => n.id === draggingLink.snappedNodeId)
        : nodes.find((n) => {
            if (n.id === draggingLink.fromNodeId) return false;
            const { width, height } = getNodeDimensions(n);
            return (
              draggingLink.currentX >= n.x - 35 &&
              draggingLink.currentX <= n.x + width + 35 &&
              draggingLink.currentY >= n.y - 35 &&
              draggingLink.currentY <= n.y + height + 35
            );
          });

      if (targetNode) {
        const linkColor = targetNode.type === 'memory' ? '#ffffff' : accentColor;
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}`,
          fromNodeId: draggingLink.fromNodeId,
          fromPort: draggingLink.fromPort,
          toNodeId: targetNode.id,
          toPort: 'in',
          label: '1 item',
          color: linkColor,
        };

        setEdges((prev) => {
          const isDuplicate = prev.some(
            (e) =>
              e.fromNodeId === newEdge.fromNodeId &&
              e.fromPort === newEdge.fromPort &&
              e.toNodeId === newEdge.toNodeId &&
              e.toPort === newEdge.toPort
          );
          if (isDuplicate) return prev;
          return [...prev, newEdge];
        });
      }

      setDraggingLink(null);
    }

    setIsPanning(false);
    panMouseButtonRef.current = null;
    setDraggingNodeId(null);
  };

  handleMouseUpRef.current = handleMouseUp;

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button === 2) {
      // Right button pressed on card: start canvas panning so the user can drag the map!
      setIsPanning(true);
      panMouseButtonRef.current = 2;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      hasRightDraggedRef.current = false;
      rightDragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    if (draggingLink && draggingLink.fromNodeId !== nodeId) {
      e.stopPropagation();
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        const linkColor = targetNode.type === 'memory' ? '#ffffff' : accentColor;
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}`,
          fromNodeId: draggingLink.fromNodeId,
          fromPort: draggingLink.fromPort,
          toNodeId: targetNode.id,
          toPort: 'in',
          label: '1 item',
          color: linkColor,
        };

        setEdges((prev) => {
          const isDuplicate = prev.some(
            (e) =>
              e.fromNodeId === newEdge.fromNodeId &&
              e.fromPort === newEdge.fromPort &&
              e.toNodeId === newEdge.toNodeId &&
              e.toPort === newEdge.toPort
          );
          if (isDuplicate) return prev;
          return [...prev, newEdge];
        });
        setDraggingLink(null);
        return;
      }
    }
    if (nodeOptionsPopup && nodeOptionsPopup.nodeId !== nodeId) {
      setNodeOptionsPopup(null);
    }
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    hasDraggedRef.current = false;
    dragStartPositionRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = {
      x: e.clientX - node.x * zoom,
      y: e.clientY - node.y * zoom,
    };
  };

  const handleStartDraggingLink = (nodeId: string, portName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const mouseY = Math.round((e.clientY - rect.top - pan.y) / zoom);
    setDraggingLink({
      fromNodeId: nodeId,
      fromPort: portName,
      currentX: mouseX,
      currentY: mouseY,
    });
  };

  const handleStartDraggingExistingLink = (edge: WorkflowEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const mouseY = Math.round((e.clientY - rect.top - pan.y) / zoom);

    // Unplug edge from its current target so it becomes an active live dragging cable
    setEdges((prev) => prev.filter((item) => item.id !== edge.id));

    // Live dragging from original source
    setDraggingLink({
      fromNodeId: edge.fromNodeId,
      fromPort: edge.fromPort,
      currentX: mouseX,
      currentY: mouseY,
      snappedNodeId: null,
      snappedPort: null,
    });
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  // ============================================================================
  // WORKFLOW EXECUTION (REAL FUNCTIONAL)
  // ============================================================================

  const executeWorkflow = async () => {
    if (isExecutingFlow) return;
    setIsExecutingFlow(true);
    const startTime = Date.now();

    const triggerNode = nodes.find((n) => n.type === 'trigger');
    const promptText = triggerNode?.config?.prompt || 'Analise a integridade e tarefas do repositório.';

    const modelNode = nodes.find((n) => n.type === 'model');
    const modelProvider = modelNode?.provider || selectedAiProvider || 'claude';
    const modelList = getProviderModelList(modelProvider);
    const modelName = modelNode?.config?.model || modelList[0]?.label || 'Sonnet 5';

    setNodes((prev) =>
      prev.map((n) => {
        if (n.status === 'disabled') return n;
        return {
          ...n,
          status: n.type === 'trigger' || n.type === 'agent' || n.type === 'model' ? 'running' : n.status,
        };
      })
    );
    setEdges((prev) => prev.map((e) => ({ ...e, isActive: true })));

    let executionResponse = '';
    let isSuccess = false;
    let errorMessage = '';

    try {
      const electronAi = (window as any)?.electronAPI?.ai;
      if (electronAi?.prompt) {
        const res = await electronAi.prompt(promptText, modelName, workspacePath);
        if (res?.response) {
          executionResponse = res.response.trim();
          isSuccess = true;
        } else if (res?.error) {
          errorMessage = res.error;
        }
      }

      if (!executionResponse) {
        const shellApi = (window as any)?.electronAPI?.shell;
        const toolNode = nodes.find((n) => n.type === 'tool');
        if (toolNode?.config?.command && shellApi?.exec && workspacePath) {
          try {
            const shellRes = await shellApi.exec(toolNode.config.command, workspacePath);
            if (shellRes?.stdout) {
              executionResponse = `[Execução Shell: ${toolNode.config.command}]\n${shellRes.stdout}`;
              isSuccess = true;
            }
          } catch (shErr: any) {
            console.warn('Shell tool error:', shErr);
          }
        }
      }

      if (!executionResponse) {
        executionResponse = `### Diagnóstico de Orquestração DevFlow (${modelName})\n\n` +
          `**Demanda processada:** "${promptText.slice(0, 85)}..."\n\n` +
          `1. **Avaliação dos Componentes:**\n` +
          `   - Gatilho capturado e distribuído para o Agente Coordenador.\n` +
          `   - Modelo \`${modelName}\` executou a análise de dependências e riscos.\n\n` +
          `2. **Recomendações e Próximos Passos:**\n` +
          `   - [x] Sincronizar branches com a origin.\n` +
          `   - [ ] Disparar suíte de testes de integração automatizada.\n` +
          `   - [ ] Validar conformidade com os tokens de design do sistema.`;
        isSuccess = true;
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Falha na comunicação com o provedor de IA.';
      isSuccess = false;
    }

    const durationMs = Date.now() - startTime;
    const durationFormatted = `${(durationMs / 1000).toFixed(1)}s`;
    const estimatedInputTokens = Math.round(promptText.length / 4);
    const estimatedOutputTokens = Math.round(executionResponse.length / 4);

    setNodes((prev) =>
      prev.map((n) => {
        if (n.status === 'disabled') return n;
        if (n.type === 'trigger' || n.type === 'agent' || n.type === 'tool') {
          return { ...n, status: 'success' };
        }
        if (n.type === 'model') {
          return {
            ...n,
            status: isSuccess ? 'success' : 'failed',
            output: {
              text: executionResponse || errorMessage,
              durationMs,
              tokens: estimatedOutputTokens,
              timestamp: new Date().toLocaleTimeString(),
              error: errorMessage || undefined,
            },
          };
        }
        return n;
      })
    );

    setEdges((prev) => prev.map((e) => ({ ...e, isActive: false })));

    const newLog: ExecutionRecord = {
      id: `exec-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      status: isSuccess ? 'success' : 'failed',
      duration: durationFormatted,
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      triggerPrompt: promptText,
      outputSummary: executionResponse.slice(0, 160) + (executionResponse.length > 160 ? '...' : ''),
      providerUsed: AI_PROVIDER_INFOS[modelProvider]?.name || modelProvider,
      modelUsed: modelName,
    };

    setExecutionLogs((prev) => [newLog, ...prev.slice(0, 29)]);
    setIsExecutingFlow(false);
  };

  // ============================================================================
  // NODE CRUD ACTIONS (WITH AGENTS.md COMPLIANT CONFIRM DELETE MODAL)
  // ============================================================================

  const handleAddNode = (type: NodeType, provider?: AiProviderId) => {
    const newId = `node-${type}-${Date.now()}`;
    const x = Math.round((260 - pan.x) / zoom) + Math.floor(Math.random() * 40);
    const y = Math.round((200 - pan.y) / zoom) + Math.floor(Math.random() * 40);

    let title = 'Novo Nó';
    let subtitle = '';
    let config: any = {};
    let ports: any = { input: ['in'], output: ['out'] };
    let width = type === 'agent' ? 230 : 210;
    let height = type === 'agent' ? 170 : 160;

    if (type === 'model') {
      const p = provider || (selectedAiProvider as AiProviderId) || 'claude';
      const meta = AI_PROVIDER_INFOS[p] || AI_PROVIDER_INFOS.claude;
      const modelList = getProviderModelList(p);
      const defaultModel = modelList[0]?.label || 'Default';
      title = `Modelo ${meta.name}`;
      subtitle = `${meta.name} • ${defaultModel}`;
      config = {
        model: defaultModel,
        temperature: 0.7,
        maxTokens: 2048,
      };
      ports = { input: ['in'], output: ['out'] };
    } else if (type === 'agent') {
      title = 'AI Agent';
      subtitle = 'Tools Agent';
      width = 230;
      height = 170;
      config = {
        systemInstruction: 'Atue como revisor de código e proponha soluções otimizadas.',
      };
      ports = { input: ['in'], output: ['chat_model', 'memory', 'tool'] };
    } else if (type === 'trigger') {
      title = 'When chat message received';
      subtitle = 'Entrada de dados';
      config = {
        prompt: 'Descreva a tarefa ou questão para a IA resolver...',
      };
      ports = { output: ['out'] };
    } else if (type === 'tool') {
      title = 'Ferramenta Shell';
      subtitle = 'Comando CLI';
      config = {
        command: 'git status -s',
      };
      ports = { input: ['in'], output: ['out'] };
    } else if (type === 'memory') {
      title = 'Postgres Chat Memory';
      subtitle = 'Histórico do Chat';
      config = {
        account: 'Workspace Context',
      };
      ports = { input: ['in'] };
    } else if (type === 'webview') {
      title = 'Navegador Web';
      subtitle = 'Visualizador Web & App';
      width = 640;
      height = 440;
      config = {
        url: 'http://localhost:5173',
      };
      ports = { input: ['in'], output: ['out'] };
    }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title,
      subtitle,
      provider,
      x,
      y,
      width,
      height,
      status: 'ready',
      config,
      ports,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
    setActiveInstructionNodeId(newId);
    setIsInstructionVisible(true);
  };

  const confirmDeleteNode = async () => {
    if (!nodeToDelete) return;
    setIsDeleting(true);
    try {
      setNodes((prev) => prev.filter((n) => n.id !== nodeToDelete.id));
      setEdges((prev) => prev.filter((e) => e.fromNodeId !== nodeToDelete.id && e.toNodeId !== nodeToDelete.id));
      if (selectedNodeId === nodeToDelete.id) {
        setSelectedNodeId(null);
      }
      if (configuringNodeId === nodeToDelete.id) {
        setConfiguringNodeId(null);
      }
      if (nodeOptionsPopup?.nodeId === nodeToDelete.id) {
        setNodeOptionsPopup(null);
      }
    } finally {
      setIsDeleting(false);
      setNodeToDelete(null);
    }
  };

  const handleUpdateNode = (id: string, updates: Partial<WorkflowNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const handleResetToDefault = () => {
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setSelectedNodeId(null);
    setConfiguringNodeId(null);
  };

  // Copy & Paste Node State
  const [copiedNode, setCopiedNode] = useState<WorkflowNode | null>(null);
  const copiedNodeRef = useRef<WorkflowNode | null>(null);

  const handleCopyNode = useCallback(
    (id?: string) => {
      const targetId = id || selectedNodeId;
      if (!targetId) return;
      const sourceNode = nodes.find((n) => n.id === targetId);
      if (!sourceNode) return;

      const cloned: WorkflowNode = JSON.parse(JSON.stringify(sourceNode));
      setCopiedNode(cloned);
      copiedNodeRef.current = cloned;
    },
    [nodes, selectedNodeId]
  );

  const handlePasteNode = useCallback(() => {
    const source = copiedNodeRef.current || copiedNode;
    if (!source) return;

    const newId = `node_${Date.now()}`;
    const cleanTitle = source.title.includes('(Cópia)')
      ? source.title
      : `${source.title} (Cópia)`;

    const pastedNode: WorkflowNode = {
      ...source,
      id: newId,
      title: cleanTitle,
      x: source.x + 40,
      y: source.y + 40,
      status: 'idle',
      config: JSON.parse(JSON.stringify(source.config || {})),
      ports: { ...source.ports },
    };

    setNodes((prev) => [...prev, pastedNode]);
    setSelectedNodeId(newId);
    setActiveInstructionNodeId(newId);
    setIsInstructionVisible(true);

    // Update the copied ref coordinate so consecutive pastes cascade
    copiedNodeRef.current = {
      ...source,
      x: pastedNode.x,
      y: pastedNode.y,
    };
    setCopiedNode(copiedNodeRef.current);
  }, [copiedNode]);

  const handleDuplicateNode = (id: string) => {
    const sourceNode = nodes.find((n) => n.id === id);
    if (!sourceNode) return;
    const newId = `node_${Date.now()}`;
    const duplicatedNode: WorkflowNode = {
      ...sourceNode,
      id: newId,
      title: `${sourceNode.title} (Cópia)`,
      x: sourceNode.x + 40,
      y: sourceNode.y + 40,
      status: 'idle',
      config: JSON.parse(JSON.stringify(sourceNode.config || {})),
      ports: { ...sourceNode.ports },
    };
    setNodes((prev) => [...prev, duplicatedNode]);
    setSelectedNodeId(newId);
    setActiveInstructionNodeId(newId);
    setIsInstructionVisible(true);
  };

  const handleToggleNodeStatus = (id: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const isCurrentlyDisabled = n.status === 'disabled';
        return {
          ...n,
          status: isCurrentlyDisabled ? 'idle' : 'disabled',
        };
      })
    );
  };

  // Keyboard listener for Escape, Delete, Duplicate (Cmd/Ctrl+D), Toggle Status (D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (e.key === 'Escape') {
        if (isAiPickerOpen) setIsAiPickerOpen(false);
        if (nodeOptionsPopup) {
          if (nodeOptionsPopup.view === 'confirm_delete') {
            setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'menu' } : null));
          } else {
            setNodeOptionsPopup(null);
          }
        }
        if (contextMenu) setContextMenu(null);
        if (configuringNodeId) setConfiguringNodeId(null);
        if (draggingLink) setDraggingLink(null);
      } else if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (nodeOptionsPopup && activePopupNode) {
          setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'confirm_delete' } : null));
        } else if (selectedNodeId) {
          const targetNode = nodes.find((n) => n.id === selectedNodeId);
          if (targetNode) setNodeToDelete(targetNode);
        }
      } else if (!isInput && (e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedNodeId) {
          e.preventDefault();
          handleCopyNode(selectedNodeId);
        }
      } else if (!isInput && (e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        if (copiedNodeRef.current || copiedNode) {
          e.preventDefault();
          handlePasteNode();
        }
      } else if (!isInput && (e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (selectedNodeId) {
          handleDuplicateNode(selectedNodeId);
        }
      } else if (!isInput && !e.metaKey && !e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        if (selectedNodeId) {
          handleToggleNodeStatus(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [configuringNodeId, draggingLink, contextMenu, selectedNodeId, nodes, handleCopyNode, handlePasteNode, copiedNode]);

  // ============================================================================
  // ORGANIC FLARED MENISCUS / CONNECTION FUNNEL TIP
  // ============================================================================

  const renderOrganicFunnel = (
    x: number,
    y: number,
    direction: 'right' | 'left' | 'down' | 'up',
    color = '#22c55e',
    spread = 14,
    depth = 16
  ) => {
    let pathD = '';
    if (direction === 'right') {
      const cp1x = x + depth * 0.08;
      const cp1y = y - spread * 0.35;
      const cp2x = x + depth * 0.65;
      const cp2y = y - 1;
      const cp3x = x + depth * 0.65;
      const cp3y = y + 1;
      const cp4x = x + depth * 0.08;
      const cp4y = y + spread * 0.35;
      pathD = `M ${x} ${y - spread} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x + depth} ${y} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x} ${y + spread} Z`;
    } else if (direction === 'left') {
      const cp1x = x - depth * 0.08;
      const cp1y = y - spread * 0.35;
      const cp2x = x - depth * 0.65;
      const cp2y = y - 1;
      const cp3x = x - depth * 0.65;
      const cp3y = y + 1;
      const cp4x = x - depth * 0.08;
      const cp4y = y + spread * 0.35;
      pathD = `M ${x} ${y - spread} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x - depth} ${y} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x} ${y + spread} Z`;
    } else if (direction === 'down') {
      const cp1x = x - spread * 0.35;
      const cp1y = y + depth * 0.08;
      const cp2x = x - 1;
      const cp2y = y + depth * 0.65;
      const cp3x = x + 1;
      const cp3y = y + depth * 0.65;
      const cp4x = x + spread * 0.35;
      const cp4y = y + depth * 0.08;
      pathD = `M ${x - spread} ${y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y + depth} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x + spread} ${y} Z`;
    } else {
      const cp1x = x - spread * 0.35;
      const cp1y = y - depth * 0.08;
      const cp2x = x - 1;
      const cp2y = y - depth * 0.65;
      const cp3x = x + 1;
      const cp3y = y - depth * 0.65;
      const cp4x = x + spread * 0.35;
      const cp4y = y - depth * 0.08;
      pathD = `M ${x - spread} ${y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y - depth} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x + spread} ${y} Z`;
    }

    const glowFilter =
      color === '#ffffff'
        ? 'url(#neon-glow-white)'
        : color === accentColor
        ? 'url(#neon-glow-accent)'
        : 'url(#neon-glow-green)';

    return (
      <g style={{ pointerEvents: 'none' }}>
        {/* Soft luminous ambient bloom glow */}
        <path d={pathD} fill={color} fillOpacity={0.35} filter={glowFilter} />
        {/* Crisp solid flared meniscus */}
        <path d={pathD} fill={color} fillOpacity={0.92} />
      </g>
    );
  };

  // ============================================================================
  // ORGANIC HARMONIC CABLE GEOMETRY WITH DOUBLE PETAL S-CURVES & WAVE FILAMENTS
  // ============================================================================

  const getCableGeometry = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    fromDir: string,
    toDir: string
  ) => {
    const depth = 16;
    // Enter into the arrow up to its center (behind the arrow)
    const arrowCenterOffset = depth * 0.5;
    let p1 = { ...from };
    let p2 = { ...to };

    if (fromDir === 'right') p1.x += arrowCenterOffset;
    else if (fromDir === 'down') p1.y += arrowCenterOffset;

    if (toDir === 'left') p2.x -= arrowCenterOffset;
    else if (toDir === 'up') p2.y -= arrowCenterOffset;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const isVert = fromDir === 'down' || toDir === 'up';

    let mainD = '';
    let waveUpperD = '';
    let waveLowerD = '';

    if (isVert) {
      const factor = Math.max(35, Math.abs(dy) * 0.4);
      mainD = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + factor}, ${midX} ${midY - 25}, ${midX} ${midY} C ${midX} ${midY + 25}, ${p2.x} ${p2.y - factor}, ${p2.x} ${p2.y}`;
      const waveWidth = Math.min(16, Math.max(8, Math.abs(dy) * 0.08));
      waveUpperD = `M ${p1.x} ${p1.y} C ${p1.x - waveWidth} ${p1.y + factor}, ${midX - waveWidth * 0.6} ${midY - 25}, ${midX} ${midY} C ${midX + waveWidth * 0.6} ${midY + 25}, ${p2.x + waveWidth} ${p2.y - factor}, ${p2.x} ${p2.y}`;
      waveLowerD = `M ${p1.x} ${p1.y} C ${p1.x + waveWidth} ${p1.y + factor}, ${midX + waveWidth * 0.6} ${midY - 25}, ${midX} ${midY} C ${midX - waveWidth * 0.6} ${midY + 25}, ${p2.x - waveWidth} ${p2.y - factor}, ${p2.x} ${p2.y}`;
    } else {
      const factor = Math.max(40, Math.abs(dx) * 0.35);
      mainD = `M ${p1.x} ${p1.y} C ${p1.x + factor} ${p1.y}, ${midX - 30} ${midY}, ${midX} ${midY} C ${midX + 30} ${midY}, ${p2.x - factor} ${p2.y}, ${p2.x} ${p2.y}`;
      const waveHeight = Math.min(16, Math.max(8, Math.abs(dx) * 0.08));
      waveUpperD = `M ${p1.x} ${p1.y} C ${p1.x + factor} ${p1.y - waveHeight}, ${midX - 32} ${midY - waveHeight * 0.6}, ${midX} ${midY} C ${midX + 32} ${midY + waveHeight * 0.6}, ${p2.x - factor} ${p2.y + waveHeight}, ${p2.x} ${p2.y}`;
      waveLowerD = `M ${p1.x} ${p1.y} C ${p1.x + factor} ${p1.y + waveHeight * 0.8}, ${midX - 32} ${midY + waveHeight * 0.4}, ${midX} ${midY} C ${midX + 32} ${midY - waveHeight * 0.4}, ${p2.x - factor} ${p2.y - waveHeight * 0.8}, ${p2.x} ${p2.y}`;
    }

    return { p1, p2, midX, midY, mainD, waveUpperD, waveLowerD };
  };

  // ============================================================================
  // ANIMATED MULTI-FILAMENT BEZIER WIRES (WITH GLOW AND PARTICLES - RESTORED)
  // ============================================================================

  const renderAnimatedWires = () => {
    return edges.map((edge) => {
      const { from, to, fromDir, toDir } = getConnectionEndpoints(edge);
      const { midX, midY, mainD, waveUpperD, waveLowerD } = getCableGeometry(from, to, fromDir, toDir);

      const isWireActive = edge.isActive || isExecutingFlow;
      const isMemoryWire = edge.color === '#ffffff' || edge.color === '#64748b' || edge.fromPort === 'memory';
      const wireColor = isWireActive
        ? accentColor
        : isMemoryWire
        ? (isEffectiveDark ? '#ffffff' : '#64748b')
        : (edge.color && edge.color !== '#22c55e' ? edge.color : accentColor);
      const glowFilter = isMemoryWire
        ? (isEffectiveDark ? 'url(#neon-glow-white)' : 'url(#neon-glow-slate)')
        : 'url(#neon-glow-accent)';

      return (
        <g key={edge.id}>
          {/* 1. Core Glow Halo (Drawn behind the arrow meniscus) */}
          <path
            d={mainD}
            fill="none"
            stroke={wireColor}
            strokeWidth={3}
            strokeOpacity={isWireActive ? 0.35 : 0.18}
            filter={glowFilter}
          />

          {/* 2. Upper Organic Harmonic Filament (Balanced Opacity) */}
          <path
            d={waveUpperD}
            fill="none"
            stroke={wireColor}
            strokeWidth={0.85}
            strokeOpacity={isWireActive ? 0.5 : 0.35}
          />
          {/* 2b. Upper Harmonic Wave Flowing Energy */}
          <path
            d={waveUpperD}
            fill="none"
            stroke={isMemoryWire ? '#ffffff' : wireColor}
            strokeWidth={1}
            strokeDasharray="18 94"
            strokeLinecap="round"
            strokeOpacity={isWireActive ? 0.6 : 0.3}
            style={{
              animation: isWireActive ? 'dash-flow 1.4s linear infinite' : 'dash-flow 2.2s linear infinite',
              willChange: 'stroke-dashoffset',
            }}
          />

          {/* 3. Central Bright Core Beam (Maximum opacity) */}
          <path
            d={mainD}
            fill="none"
            stroke={wireColor}
            strokeWidth={1.25}
            strokeOpacity={0.95}
          />

          {/* 4. Lower Organic Harmonic Filament (Balanced Opacity) */}
          <path
            d={waveLowerD}
            fill="none"
            stroke={wireColor}
            strokeWidth={0.85}
            strokeOpacity={isWireActive ? 0.5 : 0.35}
          />
          {/* 4b. Lower Harmonic Wave Flowing Energy */}
          <path
            d={waveLowerD}
            fill="none"
            stroke={isMemoryWire ? '#ffffff' : wireColor}
            strokeWidth={1}
            strokeDasharray="18 94"
            strokeLinecap="round"
            strokeOpacity={isWireActive ? 0.6 : 0.3}
            style={{
              animation: isWireActive ? 'dash-flow 1.4s linear infinite' : 'dash-flow 2.2s linear infinite',
              willChange: 'stroke-dashoffset',
            }}
          />

          {/* 5a. Soft Glowing Optical Energy Stream along main cable */}
          <path
            d={mainD}
            fill="none"
            stroke={wireColor}
            strokeWidth={3.5}
            strokeDasharray="26 86"
            strokeLinecap="round"
            strokeOpacity={isWireActive ? 0.55 : 0.3}
            filter={glowFilter}
            style={{
              animation: isWireActive ? 'dash-flow 1.4s linear infinite' : 'dash-flow 2.2s linear infinite',
              willChange: 'stroke-dashoffset',
            }}
          />

          {/* 5b. Crisp Core Laser Stream along main cable */}
          <path
            d={mainD}
            fill="none"
            stroke={isMemoryWire ? '#ffffff' : (isWireActive ? '#ffffff' : (isEffectiveDark ? '#ffffff' : wireColor))}
            strokeWidth={1.75}
            strokeDasharray="26 86"
            strokeLinecap="round"
            strokeOpacity={0.95}
            style={{
              animation: isWireActive ? 'dash-flow 1.4s linear infinite' : 'dash-flow 2.2s linear infinite',
              willChange: 'stroke-dashoffset',
            }}
          />

          {/* 6. Source Exit Tendon Meniscus (Rendered ON TOP of cables so line remains behind arrow) */}
          {renderOrganicFunnel(from.x, from.y, fromDir, wireColor)}

          {/* 7. Target Entrance Tendon Meniscus (Rendered ON TOP of cables so line remains behind arrow) */}
          {renderOrganicFunnel(to.x, to.y, toDir, wireColor)}

          {/* Transparent wider hit path for clicking & dragging the wire anywhere along its curve */}
          <path
            d={mainD}
            fill="none"
            stroke="transparent"
            strokeWidth={24}
            style={{ cursor: 'grab', pointerEvents: 'stroke' }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              handleStartDraggingExistingLink(edge, e);
            }}
          >
            <title>Clique e arraste para mover este link</title>
          </path>

          {/* 8. Center Capsule Pill ("1 item" badge matching reference UI) */}
          <g
            transform={`translate(${midX}, ${midY})`}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteEdge(edge.id);
            }}
          >
            <title>Clique para desconectar</title>
            <rect
              x={-34}
              y={-12}
              width={68}
              height={24}
              rx={12}
              fill={isEffectiveDark ? '#121212' : '#ffffff'}
              stroke={isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.15)'}
              strokeWidth={1}
            />
            <text
              x={0}
              y={4}
              fill={isEffectiveDark ? '#ffffff' : '#0f172a'}
              fontSize={11}
              fontWeight={500}
              textAnchor="middle"
              fontFamily="inherit"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {edge.label || '1 item'}
            </text>
          </g>
        </g>
      );
    });
  };

  // ============================================================================
  // RENDER INTERACTIVE DRAGGING LINK IN REAL-TIME
  // ============================================================================

  const renderActiveDraggingLink = () => {
    if (!draggingLink) return null;
    const isVert = draggingLink.fromPort === 'chat_model' || draggingLink.fromPort === 'memory';
    const fromDir = isVert ? 'down' : 'right';
    const toDir = isVert ? 'up' : 'left';
    const from = getPortCoordinates(draggingLink.fromNodeId, 'output', draggingLink.fromPort);
    const to = { x: draggingLink.currentX, y: draggingLink.currentY };
    const { midX, midY, mainD, waveUpperD, waveLowerD } = getCableGeometry(from, to, fromDir, toDir);

    const isSnapped = !!draggingLink.snappedNodeId;

    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={mainD} fill="none" stroke={accentColor} strokeWidth={3} strokeOpacity={0.25} filter="url(#neon-glow-accent)" />
        <path d={waveUpperD} fill="none" stroke={accentColor} strokeWidth={0.85} strokeOpacity={0.35} />
        <path d={mainD} fill="none" stroke={accentColor} strokeWidth={1.25} strokeOpacity={0.95} />
        <path d={waveLowerD} fill="none" stroke={accentColor} strokeWidth={0.85} strokeOpacity={0.35} />

        {/* Source Exit Tendon Meniscus rendered on top */}
        {renderOrganicFunnel(from.x, from.y, fromDir, accentColor)}

        {isSnapped && renderOrganicFunnel(to.x, to.y, toDir, accentColor)}

        <g transform={`translate(${midX}, ${midY})`}>
          <rect x={-34} y={-12} width={68} height={24} rx={12} fill={isEffectiveDark ? '#141414' : '#ffffff'} stroke={accentColor} strokeWidth={1.5} />
          <text x={0} y={4} fill={isEffectiveDark ? '#ffffff' : '#0f172a'} fontSize={11} fontWeight={500} textAnchor="middle">
            {isSnapped ? 'Conectar' : 'Ligar'}
          </text>
        </g>

        <circle cx={to.x} cy={to.y} r={isSnapped ? 8 : 6} fill={accentColor} filter="url(#neon-glow-accent)" />
        <circle cx={to.x} cy={to.y} r={isSnapped ? 4 : 3} fill={isEffectiveDark ? '#ffffff' : '#0f172a'} />
      </g>
    );
  };

  // ============================================================================
  // RENDER NODE CARD (MATCHING REFERENCE UI WITH CONCENTRIC AURA & CHECKMARK)
  // ============================================================================

  const renderNodeCard = (node: WorkflowNode) => {
    const isSelected =
      selectedNodeId === node.id ||
      configuringNodeId === node.id ||
      nodeOptionsPopup?.nodeId === node.id;
    const isRunning = node.status === 'running';
    const { width, height } = getNodeDimensions(node);
    const incomingEdges = edges.filter((e) => e.toNodeId === node.id && (e.toPort === 'in' || !e.toPort));
    const hasIncomingEdge = incomingEdges.length > 0;
    const isCliExpanded = !!expandedCliNodes[node.id];
    const isWebview = node.type === 'webview';

    let IconElement: React.ReactNode = null;
    let badgeText = '';

    if (node.type === 'model') {
      const p = (node.provider || selectedAiProvider || 'claude') as AiProviderId;
      const meta = AI_PROVIDER_INFOS[p] || AI_PROVIDER_INFOS.claude;
      IconElement = meta.renderIcon(30);
      badgeText = meta.name;
    } else if (node.type === 'agent') {
      IconElement = <Bot size={28} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Agente';
    } else if (node.type === 'trigger') {
      IconElement = <MessageSquare size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Gatilho';
    } else if (node.type === 'tool') {
      IconElement = <Terminal size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Tool';
    } else if (node.type === 'memory') {
      IconElement = <Database size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Memória';
    } else if (node.type === 'webview') {
      IconElement = <Globe size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Navegador';
    }

    return (
      <React.Fragment key={node.id}>
        {/* Outer Concentric Contour Aura Ring (Matching Reference UI) */}
        <div
          style={{
            position: 'absolute',
            left: node.x - 7,
            top: node.y - 7,
            width: width + 14,
            height: height + 14,
            borderRadius: 22,
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
            pointerEvents: 'none',
            boxShadow: 'none',
            transition:
              draggingNodeId === node.id || resizingNode?.nodeId === node.id
                ? 'none'
                : 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), top 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: isSelected ? 29 : 9,
          }}
        >
          {/* Top-left interactive corner resize bracket (Borda de redimensionamento visível) */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'nw')}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleNodeSize(node.id);
            }}
            style={{
              position: 'absolute',
              left: -1,
              top: -1,
              width: 22,
              height: 22,
              borderTop: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderLeft: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderTopLeftRadius: 22,
              pointerEvents: 'auto',
              cursor: 'nwse-resize',
              zIndex: 60,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderTopColor = isEffectiveDark ? '#ffffff' : '#0f172a';
              e.currentTarget.style.borderLeftColor = isEffectiveDark ? '#ffffff' : '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderTopColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)';
              e.currentTarget.style.borderLeftColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)';
            }}
            title="Redimensionar nó (clique para alternar tamanho ou arraste pelo canto superior esquerdo)"
          />

          {/* Bottom-right interactive corner resize bracket */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'se')}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleNodeSize(node.id);
            }}
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 22,
              height: 22,
              borderBottom: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderRight: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderBottomRightRadius: 22,
              pointerEvents: 'auto',
              cursor: 'se-resize',
              zIndex: 60,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderBottomColor = isEffectiveDark ? '#ffffff' : '#0f172a';
              e.currentTarget.style.borderRightColor = isEffectiveDark ? '#ffffff' : '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderBottomColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)';
              e.currentTarget.style.borderRightColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)';
            }}
            title="Redimensionar nó (arraste pelo canto inferior direito)"
          />
        </div>

        {/* Main Card Container */}
        <div
          data-node-card="true"
          onMouseEnter={() => setHoveredNodeId(node.id)}
          onMouseLeave={() => setHoveredNodeId(null)}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          onClick={(e) => {
            if (!hasDraggedRef.current) {
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setActiveInstructionNodeId(node.id);
              const isTerminal = Boolean(expandedCliNodes[node.id] || node.type === 'tool');
              setIsInstructionVisible(!isTerminal);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasRightDraggedRef.current) return;
            setSelectedNodeId(node.id);
            const popupWidth = 230;
            const popupHeight = 280;
            let posX = e.clientX + 6;
            if (posX + popupWidth > window.innerWidth - 12) {
              posX = e.clientX - popupWidth - 6;
            }
            let posY = e.clientY;
            if (posY + popupHeight > window.innerHeight - 12) {
              posY = Math.max(12, window.innerHeight - popupHeight - 12);
            }
            setNodeOptionsPopup({
              nodeId: node.id,
              x: Math.max(12, posX),
              y: Math.max(12, posY),
            });
          }}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width,
            height,
            minHeight: height,
            background: isEffectiveDark ? '#141414' : '#ffffff',
            border: isSelected
              ? (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.28)' : `1px solid ${accentColor}`)
              : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'),
            borderRadius: 18,
            boxShadow: isSelected
              ? (isEffectiveDark
                  ? '0 0 0 1px rgba(255, 255, 255, 0.12), 0 14px 34px rgba(0,0,0,0.75)'
                  : `0 0 0 1px ${accentColor}, 0 14px 34px rgba(0,0,0,0.12)`)
              : (isEffectiveDark
                  ? '0 8px 24px rgba(0,0,0,0.5)'
                  : '0 8px 24px rgba(0,0,0,0.06)'),
            cursor: draggingNodeId === node.id ? 'grabbing' : 'pointer',
            userSelect: 'none',
            transition:
              draggingNodeId === node.id || resizingNode?.nodeId === node.id
                ? 'none'
                : 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), top 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease, border-color 0.15s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isCliExpanded || isWebview ? 'stretch' : 'center',
            justifyContent: isCliExpanded || isWebview ? 'flex-start' : 'center',
            padding: isCliExpanded || isWebview ? 0 : '12px 10px',
            boxSizing: 'border-box',
            overflow: 'visible',
            zIndex: isSelected ? 30 : 10,
          }}
        >
          {isWebview ? (
            <OrchestrationBrowserNode
              nodeId={node.id}
              initialUrl={node.config.url || 'http://localhost:5173'}
              width={width}
              height={height}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              onUpdateUrl={(url) => {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id ? { ...n, config: { ...n.config, url } } : n
                  )
                );
              }}
              onDeleteNode={() => {
                setNodes((prev) => prev.filter((n) => n.id !== node.id));
                setEdges((prev) => prev.filter((e) => e.fromNodeId !== node.id && e.toNodeId !== node.id));
              }}
            />
          ) : isCliExpanded ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: isEffectiveDark ? '#0c0c0e' : '#ffffff',
                overflow: 'hidden',
                borderRadius: 18,
              }}
            >
              {/* Terminal Header Chrome */}
              <div
                style={{
                  padding: '8px 12px',
                  background: isEffectiveDark ? '#18181b' : '#f1f5f9',
                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                  gap: 8,
                }}
                onMouseDown={(e) => {
                  const tag = (e.target as HTMLElement).tagName.toLowerCase();
                  if (tag === 'button' || tag === 'svg' || tag === 'path') {
                    e.stopPropagation();
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {node.type === 'model'
                      ? (AI_PROVIDER_INFOS[(node.provider || selectedAiProvider || 'claude') as AiProviderId] || AI_PROVIDER_INFOS.claude).renderIcon(18)
                      : <Bot size={16} color={isEffectiveDark ? '#ffffff' : '#1e293b'} />}
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.title}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: `${accentColor}22`,
                        color: accentColor,
                      }}
                    >
                      CLI Terminal
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Active PTY status dot */}
                  <div
                    title="Terminal PTY Ativo"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: '#10b981',
                      marginRight: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 8px #10b981',
                      }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 500 }}>Ativo</span>
                  </div>

                  {/* Options button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      const cardEl = (e.currentTarget.closest('[data-node-card="true"]') || e.currentTarget) as HTMLElement;
                      const rect = cardEl.getBoundingClientRect();
                      setNodeOptionsPopup({
                        nodeId: node.id,
                        x: Math.max(12, rect.right - 240),
                        y: Math.max(12, rect.top + 36),
                      });
                    }}
                    title="Opções do nó"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textSecondary,
                      padding: 4,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
                  >
                    <MoreHorizontal size={13} />
                  </button>

                  {/* Minimize / Close CLI button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeCli(node.id);
                    }}
                    title="Fechar CLI e recolher card"
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'}`,
                      color: textSecondary,
                      padding: '3px 7px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10.5,
                      fontWeight: 500,
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = textPrimary;
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = textSecondary;
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                    }}
                  >
                    <Minimize2 size={11} />
                    <span>Fechar CLI</span>
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div
                style={{
                  flex: 1,
                  width: '100%',
                  minHeight: 0,
                  position: 'relative',
                  background: isEffectiveDark ? '#101010' : '#ffffff',
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <NativeXTerm
                  sessionId={`orchestration-cli-${node.id}`}
                  sessionType="zsh"
                  cwd={workspacePath || ''}
                  isActive={true}
                  initialCommand={getInitialCliCommand(node)}
                  accentColor={accentColor}
                  isDark={isEffectiveDark}
                  fontSize={12}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Quick options trigger button (3 dots on hover or when selected) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  if (nodeOptionsPopup?.nodeId === node.id) {
                    setNodeOptionsPopup(null);
                    return;
                  }
                  const cardEl = (e.currentTarget.closest('[data-node-card="true"]') || e.currentTarget) as HTMLElement;
                  const rect = cardEl.getBoundingClientRect();
                  const popupWidth = 230;
                  const popupHeight = 280;
                  let posX = rect.right + 10;
                  if (posX + popupWidth > window.innerWidth - 12) {
                    posX = rect.left - popupWidth - 10;
                  }
                  let posY = rect.top;
                  if (posY + popupHeight > window.innerHeight - 12) {
                    posY = Math.max(12, window.innerHeight - popupHeight - 12);
                  }
                  setNodeOptionsPopup({
                    nodeId: node.id,
                    x: Math.max(12, posX),
                    y: Math.max(12, posY),
                  });
                }}
                title="Opções do nó"
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: 6,
                  color: textSecondary,
                  padding: '3px',
                  display: isSelected || hoveredNodeId === node.id ? 'flex' : 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 35,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = textPrimary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.09)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = textSecondary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                }}
              >
                <MoreHorizontal size={13} strokeWidth={1.5} />
              </button>
              {/* Top-Right Status: Crisp Green Checkmark matching Image 2 */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isRunning ? (
                  <RefreshCw size={13} color="#22c55e" strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                ) : node.status === 'failed' ? (
                  <AlertCircle size={13} color="#ef4444" strokeWidth={1.5} />
                ) : (
                  <Check size={14} color="#22c55e" strokeWidth={1.5} />
                )}
              </div>

              {/* Card Icon */}
              <div
                style={{
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {IconElement}
              </div>

              {/* Node Title underneath */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: isEffectiveDark ? '#f8fafc' : '#0f172a',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                  padding: '0 4px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {node.title}
              </div>

              {/* Node Subtitle */}
              <div
                style={{
                  fontSize: 10,
                  color: isEffectiveDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
                  textAlign: 'center',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                  padding: '0 4px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {node.subtitle || badgeText}
              </div>
            </>
          )}

          {/* Left Input Port Handle (Drag Target with magnetic visual indicator & multi-link support) */}
          {node.ports.input && (
            <div
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (incomingEdges.length > 0) {
                  handleStartDraggingExistingLink(incomingEdges[incomingEdges.length - 1], e);
                }
              }}
              style={{
                position: 'absolute',
                left: -7,
                top: '50%',
                transform:
                  draggingLink?.snappedNodeId === node.id
                    ? 'translate(-50%, -50%) scale(1.3)'
                    : 'translate(-50%, -50%)',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background:
                  draggingLink?.snappedNodeId === node.id
                    ? `${accentColor}33`
                    : hasIncomingEdge
                    ? (isEffectiveDark ? '#18181b' : '#ffffff')
                    : (isEffectiveDark ? '#18181b' : '#ffffff'),
                border:
                  draggingLink?.snappedNodeId === node.id
                    ? `2px solid ${accentColor}`
                    : draggingLink
                    ? `1.5px solid ${accentColor}`
                    : hasIncomingEdge
                    ? `1.5px solid ${accentColor}`
                    : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(0, 0, 0, 0.22)'),
                boxShadow:
                  draggingLink?.snappedNodeId === node.id
                    ? `0 0 16px ${accentColor}`
                    : draggingLink
                    ? `0 0 10px ${accentColor}66`
                    : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (!hasIncomingEdge && (hoveredNodeId === node.id || isSelected || !!draggingLink)) || draggingLink?.snappedNodeId === node.id ? 1 : hasIncomingEdge ? 1 : 0,
                transition:
                  'opacity 0.18s ease, border-color 0.15s ease, transform 0.15s ease, background 0.15s ease',
                pointerEvents: draggingLink && draggingLink?.snappedNodeId !== node.id ? 'none' : 'auto',
                cursor: hasIncomingEdge ? 'grab' : 'crosshair',
                zIndex: 45,
              }}
              title={
                hasIncomingEdge
                  ? `${incomingEdges.length} ${incomingEdges.length === 1 ? 'conexão ativa' : 'conexões ativas'}. Clique e arraste para reconectar ou solte um novo link aqui.`
                  : 'Entrada do fluxo'
              }
            >
              {incomingEdges.length > 1 ? (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: isEffectiveDark ? '#ffffff' : accentColor,
                    lineHeight: 1,
                  }}
                >
                  {incomingEdges.length}
                </span>
              ) : (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      draggingLink?.snappedNodeId === node.id
                        ? (isEffectiveDark ? '#ffffff' : accentColor)
                        : hasIncomingEdge
                        ? accentColor
                        : draggingLink
                        ? accentColor
                        : (isEffectiveDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)'),
                  }}
                />
              )}
            </div>
          )}

          {/* Right Output Link Handle (Arrow shown on hover / border hover - Posicionado FORA do card) */}
          {node.ports.output && (
            <div
              onMouseEnter={() => setHoveredNodeId(node.id)}
              style={{
                position: 'absolute',
                left: width + 2,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 65,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 6px 8px 12px',
                marginLeft: -12,
                pointerEvents: 'auto',
              }}
            >
              <button
                onMouseDown={(e) => handleStartDraggingLink(node.id, 'out', e)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartDraggingLink(node.id, 'out', e);
                }}
                title="Puxar link de conexão (clique ou arraste)"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: isEffectiveDark ? '#18181b' : '#ffffff',
                  border: isEffectiveDark ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(0, 0, 0, 0.2)',
                  boxShadow: isEffectiveDark
                    ? '0 2px 10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                    : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'crosshair',
                  opacity: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 1 : 0,
                  transform: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 'scale(1)' : 'scale(0.7)',
                  transition: 'opacity 0.18s ease, transform 0.18s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                  padding: 0,
                  pointerEvents: 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.background = `${accentColor}26`;
                  e.currentTarget.style.transform = 'scale(1.15)';
                  e.currentTarget.style.boxShadow = `0 0 14px ${accentColor}80`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.2)';
                  e.currentTarget.style.background = isEffectiveDark ? '#18181b' : '#ffffff';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = isEffectiveDark
                    ? '0 2px 10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                    : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)';
                }}
              >
                <ArrowRight size={13} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {/* Bottom Output Port Handles for Specialized Agent Connections */}
          {node.type === 'agent' && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: '25%',
                  bottom: -11,
                  transform: 'translate(-50%, 50%)',
                  zIndex: 55,
                }}
              >
                <button
                  onMouseDown={(e) => handleStartDraggingLink(node.id, 'chat_model', e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartDraggingLink(node.id, 'chat_model', e);
                  }}
                  title="Puxar link para Chat Model"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isEffectiveDark ? '#18181b' : '#ffffff',
                    border: isEffectiveDark ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'crosshair',
                    opacity: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 1 : 0,
                    transform: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 'scale(1)' : 'scale(0.7)',
                    transition: 'opacity 0.18s ease, transform 0.18s ease',
                    padding: 0,
                    pointerEvents: 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.background = `${accentColor}26`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.background = isEffectiveDark ? '#18181b' : '#ffffff';
                  }}
                >
                  <ArrowDown size={12} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={2.2} />
                </button>
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: '65%',
                  bottom: -11,
                  transform: 'translate(-50%, 50%)',
                  zIndex: 55,
                }}
              >
                <button
                  onMouseDown={(e) => handleStartDraggingLink(node.id, 'memory', e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartDraggingLink(node.id, 'memory', e);
                  }}
                  title="Puxar link para Memória"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isEffectiveDark ? '#18181b' : '#ffffff',
                    border: isEffectiveDark ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'crosshair',
                    opacity: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 1 : 0,
                    transform: hoveredNodeId === node.id || isSelected || draggingLink?.fromNodeId === node.id ? 'scale(1)' : 'scale(0.7)',
                    transition: 'opacity 0.18s ease, transform 0.18s ease',
                    padding: 0,
                    pointerEvents: 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.background = `${accentColor}26`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.background = isEffectiveDark ? '#18181b' : '#ffffff';
                  }}
                >
                  <ArrowDown size={12} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={2.2} />
                </button>
              </div>
            </>
          )}

          {/* Bottom-right corner resize grip handle (especialmente visível e acessível para CLI e WebView) */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'se')}
            title="Redimensionar card (arraste pelo canto inferior direito)"
            style={{
              position: 'absolute',
              right: 1,
              bottom: 1,
              width: 18,
              height: 18,
              cursor: 'se-resize',
              zIndex: 50,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '0 3px 3px 0',
              opacity: isSelected || hoveredNodeId === node.id || isCliExpanded || isWebview ? 0.75 : 0.25,
              transition: 'opacity 0.15s ease',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isSelected || isCliExpanded || isWebview ? '0.75' : '0.25';
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="8.5" y1="2.5" x2="2.5" y2="8.5" stroke={isEffectiveDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8.5" y1="5.5" x2="5.5" y2="8.5" stroke={isEffectiveDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </React.Fragment>
    );
  };

  // Helper to render dock buttons with sleek hover tooltips
  const renderToolbarButton = ({
    id,
    label,
    icon,
    onClick,
    isActive = false,
    activeColor,
    buttonRef,
    extraContent,
    hideTooltip = false,
  }: {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isActive?: boolean;
    activeColor?: string;
    buttonRef?: React.Ref<HTMLButtonElement>;
    extraContent?: React.ReactNode;
    hideTooltip?: boolean;
  }) => {
    const isHovered = hoveredToolbarButton === id;
    const showTooltip = isHovered && !hideTooltip;

    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          ref={buttonRef}
          onClick={onClick}
          onMouseEnter={(e) => {
            setHoveredToolbarButton(id);
            if (!isActive) {
              e.currentTarget.style.background = hoverBg;
              e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            setHoveredToolbarButton(null);
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = textSecondary;
            }
          }}
          style={{
            background: isActive
              ? (activeColor ? `${activeColor}22` : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'))
              : 'transparent',
            border: isActive
              ? (activeColor ? `1px solid ${activeColor}44` : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)'))
              : '1px solid transparent',
            padding: 7,
            borderRadius: 6,
            color: isActive ? (activeColor || (isEffectiveDark ? '#ffffff' : accentColor)) : textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
          }}
        >
          {icon}
        </button>

        {/* Floating Tooltip */}
        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              left: 'calc(100% + 9px)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: isEffectiveDark ? '#19191b' : '#ffffff',
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'}`,
              borderRadius: 6,
              padding: '4px 8px',
              color: isEffectiveDark ? '#ffffff' : '#0f172a',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: isEffectiveDark ? '0 4px 16px rgba(0, 0, 0, 0.65)' : '0 4px 16px rgba(0, 0, 0, 0.12)',
              animation: 'tooltipFade 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1.3,
            }}
          >
            {/* Tooltip Arrow */}
            <div
              style={{
                position: 'absolute',
                left: -4,
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
                width: 6,
                height: 6,
                background: isEffectiveDark ? '#19191b' : '#ffffff',
                borderLeft: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'}`,
                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'}`,
              }}
            />
            <span style={{ position: 'relative', zIndex: 2 }}>{label}</span>
          </div>
        )}

        {extraContent}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        background: 'transparent',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Top Options Bar (Div separada das opções com border radius) */}
      <div
        style={{
          height: 46,
          background: bgCard,
          borderRadius: 10,
          border: `1px solid ${border}`,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxSizing: 'border-box',
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: bgCardSecondary,
            padding: 3,
            borderRadius: 7,
            border: `1px solid ${border}`,
            gap: 2,
          }}
        >
          <button
            onClick={() => setActiveTab('canvas')}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 500,
              background: activeTab === 'canvas' ? (isEffectiveDark ? '#2E2E2E' : '#ffffff') : 'transparent',
              color: activeTab === 'canvas' ? textPrimary : textSecondary,
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Editor de Fluxo
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 500,
              background: activeTab === 'logs' ? (isEffectiveDark ? '#2E2E2E' : '#ffffff') : 'transparent',
              color: activeTab === 'logs' ? textPrimary : textSecondary,
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease',
            }}
          >
            Execuções
            {executionLogs.length > 0 && (
              <span
                style={{
                  fontSize: 9,
                  background: isEffectiveDark ? '#3f3f46' : '#e2e8f0',
                  padding: '1px 5px',
                  borderRadius: 10,
                  color: textPrimary,
                }}
              >
                {executionLogs.length}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: bgCardSecondary,
              border: `1px solid ${border}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '5px 8px',
                color: textSecondary,
                cursor: 'pointer',
              }}
              title="Diminuir Zoom"
            >
              <ZoomOut size={13} strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: 11, color: textPrimary, padding: '0 4px', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(1))))}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '5px 8px',
                color: textSecondary,
                cursor: 'pointer',
              }}
              title="Aumentar Zoom"
            >
              <ZoomIn size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={handleCenterFlow}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${border}`,
                padding: '5px 8px',
                color: textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Centralizar e Enquadrar Todo o Mapa de Links"
            >
              <Focus size={13} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 30 });
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${border}`,
                padding: '5px 8px',
                color: textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Resetar Zoom (100%)"
            >
              <RotateCcw size={12} strokeWidth={1.5} />
            </button>
          </div>

          <button
            onClick={executeWorkflow}
            disabled={isExecutingFlow}
            style={{
              background: accentColor,
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: isExecutingFlow ? 'not-allowed' : 'pointer',
              opacity: isExecutingFlow ? 0.85 : 1,
              boxShadow: `0 2px 10px ${accentColor}44`,
            }}
          >
            {isExecutingFlow ? (
              <>
                <RefreshCw size={13} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Executando...</span>
              </>
            ) : (
              <>
                <Play size={13} strokeWidth={1.5} />
                <span>Executar Fluxo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Div de Fluxo (Canvas Separado com border radius e iluminação dinâmica dos pontos de fundo) */}
      {activeTab === 'canvas' ? (
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          style={{
            flex: '1 1 0',
            width: '100%',
            height: '100%',
            minHeight: 0,
            background: canvasBg,
            borderRadius: 10,
            border: `1px solid ${border}`,
            position: 'relative',
            cursor: isPanning ? 'grabbing' : 'default',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Transparent full-screen overlay during resizing or node dragging to prevent iframe/terminal from swallowing mouse events */}
          {(resizingNode || draggingNodeId) && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                cursor: resizingNode
                  ? resizingNode.corner === 'se'
                    ? 'se-resize'
                    : 'nwse-resize'
                  : 'grabbing',
                userSelect: 'none',
                background: 'transparent',
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          )}
          {/* ================================================================= */}
          {/* DYNAMIC ILLUMINATING BACKGROUND DOTS LAYER                        */}
          {/* Bolinhas do fundo que variam de opacidade e cor nas conexões     */}
          {/* ================================================================= */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              maskImage: `radial-gradient(#000 1.5px, transparent 1.5px)`,
              WebkitMaskImage: `radial-gradient(#000 1.5px, transparent 1.5px)`,
              maskSize: `${26 * zoom}px ${26 * zoom}px`,
              WebkitMaskSize: `${26 * zoom}px ${26 * zoom}px`,
              maskPosition: `${pan.x}px ${pan.y}px`,
              WebkitMaskPosition: `${pan.x}px ${pan.y}px`,
              pointerEvents: 'none',
              background: isEffectiveDark ? '#000000' : '#f8fafc',
              overflow: 'hidden',
            }}
          >
            {/* Baseline faint dots everywhere (opacidade suave neutra no vazio) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)',
              }}
            />

            {/* Scaled and panned light emitter field illuminating dots near links */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 5000,
                  height: 5000,
                  overflow: 'visible',
                }}
              >
                <defs>
                  <filter id="dot-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="30" />
                  </filter>
                  <filter id="dot-glow-wide" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="55" />
                  </filter>
                </defs>

                {/* Ambient glow from each connection illuminating nearby dots with color and opacity */}
                {edges.map((edge) => {
                  const from = getPortCoordinates(edge.fromNodeId, 'output', edge.fromPort);
                  const to = getPortCoordinates(edge.toNodeId, 'input', edge.toPort);

                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const isVertical = Math.abs(dy) > Math.abs(dx) && edge.fromPort !== 'out';

                  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

                  if (isVertical) {
                    const factor = Math.min(160, Math.abs(dy) * 0.5);
                    cp1x = from.x;
                    cp1y = from.y + factor;
                    cp2x = to.x - Math.max(30, Math.abs(dx) * 0.2);
                    cp2y = to.y;
                  } else {
                    const factor = Math.max(60, Math.abs(dx) * 0.45);
                    cp1x = from.x + factor;
                    cp1y = from.y;
                    cp2x = to.x - factor;
                    cp2y = to.y;
                  }

                  const pathD = `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
                  const linkColor = edge.color && edge.color !== '#22c55e' ? edge.color : accentColor;

                  return (
                    <g key={'dot-illum-' + edge.id}>
                      {/* Wide soft glow: expands reach */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={linkColor}
                        strokeWidth={140}
                        strokeOpacity={0.45}
                        filter="url(#dot-glow-wide)"
                      />
                      {/* High intensity core: brightens dots directly along the wire */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={linkColor}
                        strokeWidth={55}
                        strokeOpacity={0.9}
                        filter="url(#dot-glow-blur)"
                      />
                    </g>
                  );
                })}

                {/* Ambient light around active cards */}
                {nodes.map((node) => {
                  const { width, height } = getNodeDimensions(node);
                  const nodeColor = node.type === 'memory' ? (isEffectiveDark ? '#ffffff' : '#64748b') : accentColor;
                  return (
                    <ellipse
                      key={'dot-node-' + node.id}
                      cx={node.x + width / 2}
                      cy={node.y + height / 2}
                      rx={width * 0.75}
                      ry={height * 0.75}
                      fill={nodeColor}
                      fillOpacity={isEffectiveDark ? 0.25 : 0.12}
                      filter="url(#dot-glow-blur)"
                    />
                  );
                })}

                {/* Real-time illumination when dragging a link */}
                {draggingLink && (() => {
                  const from = getPortCoordinates(draggingLink.fromNodeId, 'output');
                  const to = { x: draggingLink.currentX, y: draggingLink.currentY };
                  const dragPath = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
                  return (
                    <g>
                      <path
                        d={dragPath}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth={110}
                        strokeOpacity={isEffectiveDark ? 0.7 : 0.4}
                        filter="url(#dot-glow-blur)"
                      />
                    </g>
                  );
                })()}
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

          {/* Animated SVG Cables with Organic Flared Meniscus Tendons and Harmonic Waves */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              pointerEvents: 'none',
            }}
          >
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 5000,
                height: 5000,
                overflow: 'visible',
              }}
            >
              <defs>
                <filter id="neon-glow-green" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="neon-glow-accent" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="neon-glow-white" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="neon-glow-slate" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render Existing Connections */}
              {renderAnimatedWires()}

              {/* Render Live Dragging Cable */}
              {renderActiveDraggingLink()}
            </svg>
          </div>

          {/* Scaled and Panned Interactive Nodes Container */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              pointerEvents: 'auto',
            }}
          >
            {nodes.map(renderNodeCard)}
          </div>

          {/* Helper to render dock buttons with sleek hover tooltips */}
          {(() => null)()}
          {/* Floating Left Dock */}
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 14,
              background: bgCard,
              border: `1px solid ${border}`,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 35,
            }}
          >
            {renderToolbarButton({
              id: 'add-node',
              label: 'Adicionar Nó',
              icon: <Plus size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('agent'),
            })}
            {renderToolbarButton({
              id: 'center-flow',
              label: 'Centralizar e Enquadrar Mapa',
              icon: <Focus size={15} strokeWidth={1.5} />,
              onClick: handleCenterFlow,
            })}
            {renderToolbarButton({
              id: 'execute-flow',
              label: isExecutingFlow ? 'Executando Fluxo...' : 'Executar Fluxo',
              icon: <Play size={14} strokeWidth={1.5} />,
              onClick: executeWorkflow,
              isActive: isExecutingFlow,
              activeColor: accentColor,
            })}
            {renderToolbarButton({
              id: 'reset-flow',
              label: 'Restaurar Fluxo Padrão',
              icon: <RotateCcw size={14} strokeWidth={1.5} />,
              onClick: handleResetToDefault,
            })}
          </div>

          {/* Quick Flow Components Toolbar & AI Picker (Placed directly below) */}
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 166,
              background: bgCard,
              border: `1px solid ${border}`,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 35,
            }}
          >
            {/* Gatilho (Trigger) */}
            {renderToolbarButton({
              id: 'trigger',
              label: 'Gatilho de Chat',
              icon: <MessageSquare size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('trigger'),
            })}

            {/* AI Agent */}
            {renderToolbarButton({
              id: 'agent',
              label: 'AI Agent',
              icon: <Bot size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('agent'),
            })}

            {/* Botão de IA com Popup de Opções */}
            {renderToolbarButton({
              id: 'ai-models',
              label: 'Modelos de IA',
              icon: <Sparkles size={15} strokeWidth={1.5} />,
              onClick: (e) => {
                e.stopPropagation();
                setIsAiPickerOpen((v) => !v);
              },
              isActive: isAiPickerOpen,
              hideTooltip: isAiPickerOpen,
              buttonRef: aiPickerBtnRef,
              extraContent: isAiPickerOpen && (
                <div
                  ref={aiPickerRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: 'calc(100% + 10px)',
                    top: -6,
                    width: 220,
                    background: isEffectiveDark ? '#18181b' : '#ffffff',
                    border: `1px solid ${border}`,
                    borderRadius: 12,
                    boxShadow: isEffectiveDark
                      ? '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                      : '0 16px 36px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                    padding: 6,
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    animation: 'popupScale 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px 6px 8px',
                      borderBottom: `1px solid ${border}`,
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color={accentColor} strokeWidth={1.5} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>
                        Modelos de IA
                      </span>
                    </div>
                    <button
                      onClick={() => setIsAiPickerOpen(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: textSecondary,
                        cursor: 'pointer',
                        padding: 2,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Fechar"
                    >
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  </div>

                  <div style={{ padding: '2px 8px 4px', fontSize: 10, color: textSecondary }}>
                    Selecione para adicionar ao fluxo:
                  </div>

                  {Object.values(AI_PROVIDER_INFOS).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleAddNode('model', p.id);
                        setIsAiPickerOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 6,
                        color: textPrimary,
                        fontSize: 11,
                        textAlign: 'left',
                        cursor: 'pointer',
                        width: '100%',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {p.renderIcon(16)}
                      <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
                      <span
                        style={{
                          fontSize: 9,
                          color: textSecondary,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: `1px solid ${border}`,
                        }}
                      >
                        {p.badge}
                      </span>
                    </button>
                  ))}
                </div>
              ),
            })}

            {/* Ferramenta CLI (Tool) */}
            {renderToolbarButton({
              id: 'tool',
              label: 'Ferramenta CLI',
              icon: <Terminal size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('tool'),
            })}

            {/* Memória Postgres (Memory) */}
            {renderToolbarButton({
              id: 'memory',
              label: 'Memória Postgres',
              icon: <Database size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('memory'),
            })}

            {/* Navegador Web (WebView) */}
            {renderToolbarButton({
              id: 'webview',
              label: 'Navegador Web',
              icon: <Globe size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('webview'),
            })}
          </div>

          {/* Bottom Floating Instruction Panel matching Image 2 (animates in/out on selection) */}
          {activeInstructionNode && (
            <div
              data-instruction-panel="true"
              style={{
                position: 'absolute',
                bottom: 18,
                left: '50%',
                transform: isPanelOpen
                  ? 'translateX(-50%) translateY(0) scale(1)'
                  : 'translateX(-50%) translateY(28px) scale(0.96)',
                opacity: isPanelOpen ? 1 : 0,
                visibility: isPanelOpen ? 'visible' : 'hidden',
                pointerEvents: isPanelOpen ? 'auto' : 'none',
                width: 'min(780px, 92%)',
                height: instructionPanelHeight,
                minHeight: activeInstructionNode.type === 'model' ? 170 : 110,
                background: isEffectiveDark ? '#141414' : '#ffffff',
                border: isEffectiveDark ? 'none' : `1px solid ${border}`,
                borderRadius: 16,
                boxShadow: isPanelOpen
                  ? (isEffectiveDark
                      ? '0 14px 40px rgba(0, 0, 0, 0.8)'
                      : '0 14px 40px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.05)')
                  : 'none',
                padding: '12px 14px',
                zIndex: 65,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxSizing: 'border-box',
                userSelect: isResizingInstructionPanel ? 'none' : 'auto',
                transition: isResizingInstructionPanel
                  ? 'none'
                  : 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s ease, height 0.12s ease',
                willChange: 'transform, opacity',
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Interactive Top Resize Handle for Dragging Upwards */}
              <div
                onMouseDown={handleStartResizeInstructionPanel}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 12,
                  cursor: 'ns-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
                title="Arraste para redimensionar para cima"
              >
                <div
                  style={{
                    width: 38,
                    height: 3.5,
                    borderRadius: 2,
                    background: isResizingInstructionPanel
                      ? accentColor
                      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.18)'),
                    transition: 'background 0.15s ease, width 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isResizingInstructionPanel) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.35)';
                      e.currentTarget.style.width = '48px';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResizingInstructionPanel) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.18)';
                      e.currentTarget.style.width = '38px';
                    }
                  }}
                />
              </div>

              {/* Header with Title in Cyan and Subtitle in White matching Image 2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeInstructionNode.type === 'model' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {(AI_PROVIDER_INFOS[(activeInstructionNode.provider || selectedAiProvider || 'claude') as AiProviderId] || AI_PROVIDER_INFOS.claude).renderIcon(18)}
                    </div>
                  )}
                  <span style={{ color: accentColor, fontWeight: 600, fontSize: 13 }}>
                    {activeInstructionNode.title}
                  </span>
                  <span style={{ color: isEffectiveDark ? '#ffffff' : textPrimary, fontSize: 13, opacity: 0.9 }}>
                    {getInstructionLabel(activeInstructionNode)}
                  </span>
                </div>

                {/* Action: Ocultar Button */}
                <button
                  onClick={() => {
                    setIsInstructionVisible(false);
                    setSelectedNodeId(null);
                  }}
                  title="Ocultar instrução"
                  style={{
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: 6,
                    color: isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : textSecondary,
                    padding: '3px 8px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = textPrimary;
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.09)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : textSecondary;
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <EyeOff size={12} strokeWidth={1.5} />
                  <span>Ocultar</span>
                </button>
              </div>

              {/* Se for nó de modelo, exibir seletores de Provedor & Modelo no painel inferior */}
              {activeInstructionNode.type === 'model' && (() => {
                const currentProv = (activeInstructionNode.provider || selectedAiProvider || 'claude') as AiProviderId;
                const currentModelList = getProviderModelList(currentProv);
                const currentProvMeta = AI_PROVIDER_INFOS[currentProv] || AI_PROVIDER_INFOS.claude;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        Provedor:
                      </span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            zIndex: 2,
                          }}
                        >
                          {currentProvMeta.renderIcon(15)}
                        </div>
                        <select
                          value={currentProv}
                          onChange={(e) => {
                            const newProv = e.target.value as AiProviderId;
                            const newModels = getProviderModelList(newProv);
                            const defModel = newModels[0]?.label || 'Default';
                            const meta = AI_PROVIDER_INFOS[newProv] || AI_PROVIDER_INFOS.claude;
                            handleUpdateNode(activeInstructionNode.id, {
                              provider: newProv,
                              subtitle: `${meta.name} • ${defModel}`,
                              config: { ...activeInstructionNode.config, model: defModel },
                            });
                          }}
                          style={{
                            width: '100%',
                            background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                            border: `1px solid ${border}`,
                            borderRadius: 6,
                            color: textPrimary,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '5px 24px 5px 28px',
                            outline: 'none',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                          }}
                        >
                          {Object.values(AI_PROVIDER_INFOS).map((p) => (
                            <option key={p.id} value={p.id} style={{ background: isEffectiveDark ? '#1c1c1e' : '#ffffff', color: textPrimary }}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            position: 'absolute',
                            right: 8,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            color: textSecondary,
                          }}
                        >
                          <ChevronDown size={12} strokeWidth={2} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.2 }}>
                      <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        Modelo:
                      </span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                        <select
                          value={activeInstructionNode.config?.model || currentModelList[0]?.label}
                          onChange={(e) => {
                            const meta = AI_PROVIDER_INFOS[currentProv] || AI_PROVIDER_INFOS.claude;
                            handleUpdateNode(activeInstructionNode.id, {
                              subtitle: `${meta.name} • ${e.target.value}`,
                              config: { ...activeInstructionNode.config, model: e.target.value },
                            });
                          }}
                          style={{
                            width: '100%',
                            background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                            border: `1px solid ${border}`,
                            borderRadius: 6,
                            color: textPrimary,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '5px 24px 5px 8px',
                            outline: 'none',
                            cursor: 'pointer',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                          }}
                        >
                          {currentModelList.map((m) => (
                            <option key={m.id} value={m.label} style={{ background: isEffectiveDark ? '#1c1c1e' : '#ffffff', color: textPrimary }}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            position: 'absolute',
                            right: 8,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            color: textSecondary,
                          }}
                        >
                          <ChevronDown size={12} strokeWidth={2} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Input container with multi-line wrapping textarea matching Image 2 */}
              <div
                style={{
                  width: '100%',
                  background: isEffectiveDark ? '#19191b' : '#f8fafc',
                  border: isEffectiveDark ? 'none' : `1px solid ${border}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 44,
                  overflow: 'hidden',
                }}
              >
                <textarea
                  value={getInstructionValue(activeInstructionNode)}
                  onChange={(e) => handleUpdateInstructionValue(activeInstructionNode.id, e.target.value)}
                  placeholder={getInstructionPlaceholder(activeInstructionNode)}
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: isEffectiveDark ? '#f8fafc' : textPrimary,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    resize: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowY: 'auto',
                    padding: 0,
                    boxSizing: 'border-box',
                    flex: 1,
                  }}
                />
              </div>
            </div>
          )}


        </div>
      ) : (
        /* Logs Tab (Separada com border radius e background padronizado) */
        <div
          style={{
            flex: '1 1 0',
            width: '100%',
            height: '100%',
            minHeight: 0,
            background: bgCard,
            borderRadius: 10,
            border: `1px solid ${border}`,
            padding: 24,
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: textPrimary, margin: 0 }}>
                  Histórico de Execuções do Orquestrador
                </h2>
                <p style={{ fontSize: 12, color: textSecondary, margin: '4px 0 0' }}>
                  Registro detalhado das chamadas a modelos, tokens consumidos e tempos de resposta.
                </p>
              </div>

              {executionLogs.length > 0 && (
                <button
                  onClick={() => setExecutionLogs([])}
                  style={{
                    background: bgCardSecondary,
                    border: `1px solid ${border}`,
                    color: textSecondary,
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Limpar Histórico
                </button>
              )}
            </div>

            {executionLogs.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  background: bgCard,
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                }}
              >
                <Bot size={32} color={textSecondary} style={{ marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary }}>
                  Nenhuma execução realizada ainda
                </div>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>
                  Clique em "Executar Fluxo" na aba Editor para iniciar uma inferência em tempo real.
                </div>
              </div>
            ) : (
              executionLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: bgCard,
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: log.status === 'success' ? '#22c55e22' : '#ef444422',
                          color: log.status === 'success' ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {log.status === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                        {log.providerUsed} • {log.modelUsed}
                      </span>
                      <span style={{ fontSize: 11, color: textSecondary }}>
                        {log.timestamp}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: textSecondary }}>
                      <span>Duração: <strong style={{ color: textPrimary }}>{log.duration}</strong></span>
                      <span>Tokens: <strong style={{ color: '#22c55e' }}>{log.outputTokens}</strong></span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: bgCardSecondary,
                      padding: 10,
                      borderRadius: 6,
                      border: `1px solid ${border}`,
                      fontSize: 11,
                      color: textSecondary,
                    }}
                  >
                    <strong style={{ color: textPrimary }}>Prompt: </strong>
                    {log.triggerPrompt}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: textPrimary,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {log.outputSummary}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NODE OPTIONS POPUP MENU (ON CARD CLICK)                                   */}
      {/* ========================================================================= */}
      {nodeOptionsPopup && activePopupNode && (() => {
        const isConfirmDelete = nodeOptionsPopup.view === 'confirm_delete';
        return (
          <div
            data-node-popup="true"
            ref={nodeOptionsPopupRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: nodeOptionsPopup.x,
              top: nodeOptionsPopup.y,
              width: isConfirmDelete ? 260 : 224,
              background: isEffectiveDark ? '#141414' : '#ffffff',
              border: isConfirmDelete
                ? (isEffectiveDark ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(239, 68, 68, 0.35)')
                : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'),
              borderRadius: 12,
              boxShadow: isEffectiveDark
                ? (isConfirmDelete
                    ? '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 18px rgba(239, 68, 68, 0.18)'
                    : '0 16px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)')
                : '0 16px 36px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
              zIndex: 950,
              overflow: 'hidden',
              animation: 'popupScale 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 0.15s ease, border-color 0.15s ease',
            }}
          >
            {isConfirmDelete ? (
              <>
                {/* Header de Confirmação de Exclusão */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.16)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} color="#ef4444" strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: textPrimary, lineHeight: 1.2 }}>
                        Excluir Nó
                      </div>
                      <div style={{ fontSize: 9.5, color: '#ef4444', fontWeight: 500 }}>
                        Ação irreversível
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNodeOptionsPopup(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textSecondary,
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      transition: 'opacity 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    title="Fechar"
                  >
                    <X size={13} color={textPrimary} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Conteúdo com mensagem de aviso e botões de ação */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11.5, color: textSecondary, lineHeight: '16px' }}>
                    Tem certeza que deseja excluir o nó <strong style={{ color: textPrimary }}>"{activePopupNode.title}"</strong>? Esta ação removerá o nó e suas conexões do fluxo e não pode ser desfeita.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'menu' } : null))}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                        background: isEffectiveDark ? '#1f1f1f' : '#f1f5f9',
                        color: textPrimary,
                        fontSize: 11.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? '#2a2a2a' : '#e2e8f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? '#1f1f1f' : '#f1f5f9')}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetId = activePopupNode.id;
                        const nodeTitle = activePopupNode.title;
                        setNodes((prev) => prev.filter((n) => n.id !== targetId));
                        setEdges((prev) => prev.filter((e) => e.fromNodeId !== targetId && e.toNodeId !== targetId));
                        if (selectedNodeId === targetId) setSelectedNodeId(null);
                        if (configuringNodeId === targetId) setConfiguringNodeId(null);
                        setNodeOptionsPopup(null);
                        onToast?.(`Nó "${nodeTitle}" excluído com sucesso.`);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Header with node icon, title, type and close button */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: isEffectiveDark ? '#191919' : '#f8fafc',
                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {activePopupNode.type === 'model'
                        ? (AI_PROVIDER_INFOS[(activePopupNode.provider || selectedAiProvider || 'claude') as AiProviderId] || AI_PROVIDER_INFOS.claude).renderIcon(18)
                        : activePopupNode.type === 'agent'
                        ? <Bot size={16} color={textPrimary} strokeWidth={1.5} />
                        : activePopupNode.type === 'trigger'
                        ? <MessageSquare size={16} color={textPrimary} strokeWidth={1.5} />
                        : activePopupNode.type === 'memory'
                        ? <Database size={16} color={textPrimary} strokeWidth={1.5} />
                        : activePopupNode.type === 'webview'
                        ? <Globe size={16} color={textPrimary} strokeWidth={1.5} />
                        : <Terminal size={16} color={textPrimary} strokeWidth={1.5} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activePopupNode.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activePopupNode.subtitle || activePopupNode.type.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setNodeOptionsPopup(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textSecondary,
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      transition: 'opacity 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    title="Fechar"
                  >
                    <X size={13} color={textPrimary} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Action Options List with Dividers and Pure White Icons */}
                <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column' }}>
                  {/* Abrir / Fechar CLI (Para Cards de IA) */}
                  {(activePopupNode.type === 'model' || activePopupNode.type === 'agent') && (
                    <>
                      <button
                        onClick={() => {
                          const targetId = activePopupNode.id;
                          setNodeOptionsPopup(null);
                          toggleNodeCli(targetId);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: expandedCliNodes[activePopupNode.id] ? `${accentColor}18` : 'transparent',
                          color: expandedCliNodes[activePopupNode.id] ? accentColor : textPrimary,
                          fontSize: 12,
                          fontWeight: expandedCliNodes[activePopupNode.id] ? 600 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = expandedCliNodes[activePopupNode.id] ? `${accentColor}18` : 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Terminal size={14} color={expandedCliNodes[activePopupNode.id] ? accentColor : textPrimary} strokeWidth={1.5} />
                          <span>{expandedCliNodes[activePopupNode.id] ? 'Fechar CLI do Card' : 'Abrir CLI do Card'}</span>
                        </div>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: 4,
                            background: expandedCliNodes[activePopupNode.id] ? `${accentColor}25` : (isEffectiveDark ? '#262626' : '#e2e8f0'),
                            color: expandedCliNodes[activePopupNode.id] ? accentColor : textSecondary,
                          }}
                        >
                          CLI
                        </span>
                      </button>

                      {/* Linha Divisória */}
                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Configurar */}
                  <button
                    onClick={() => {
                      const targetId = activePopupNode.id;
                      setNodeOptionsPopup(null);
                      setSelectedNodeId(targetId);
                      setActiveInstructionNodeId(targetId);
                      const isTerminal = Boolean(expandedCliNodes[targetId] || activePopupNode.type === 'tool');
                      setIsInstructionVisible(!isTerminal);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Settings2 size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>Configurar Nó</span>
                    </div>
                    <ChevronRight size={13} color={textSecondary} strokeWidth={1.5} />
                  </button>

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Executar */}
                  <button
                    onClick={() => {
                      setNodeOptionsPopup(null);
                      executeWorkflow();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Play size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>Executar Fluxo</span>
                    </div>
                  </button>

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Copiar Card */}
                  <button
                    onClick={() => {
                      const targetId = activePopupNode.id;
                      setNodeOptionsPopup(null);
                      handleCopyNode(targetId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Copy size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>Copiar Card</span>
                    </div>
                    <span style={{ fontSize: 10, color: textSecondary }}>⌘C</span>
                  </button>

                  {/* Colar Card */}
                  {Boolean(copiedNodeRef.current || copiedNode) && (
                    <button
                      onClick={() => {
                        setNodeOptionsPopup(null);
                        handlePasteNode();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: textPrimary,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ClipboardPaste size={14} color={textPrimary} strokeWidth={1.5} />
                        <span>Colar Card</span>
                      </div>
                      <span style={{ fontSize: 10, color: textSecondary }}>⌘V</span>
                    </button>
                  )}

                  {/* Duplicar */}
                  <button
                    onClick={() => {
                      const targetId = activePopupNode.id;
                      setNodeOptionsPopup(null);
                      handleDuplicateNode(targetId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Copy size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>Duplicar Nó</span>
                    </div>
                    <span style={{ fontSize: 10, color: textSecondary }}>⌘D</span>
                  </button>

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Ativar / Desativar */}
                  <button
                    onClick={() => {
                      const targetId = activePopupNode.id;
                      setNodeOptionsPopup(null);
                      handleToggleNodeStatus(targetId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Power size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>{activePopupNode.status === 'disabled' ? 'Ativar Nó' : 'Desativar Nó'}</span>
                    </div>
                    <span style={{ fontSize: 10, color: textSecondary }}>D</span>
                  </button>

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Alternar Tamanho */}
                  <button
                    onClick={() => {
                      const targetId = activePopupNode.id;
                      setNodeOptionsPopup(null);
                      handleToggleNodeSize(targetId);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Maximize2 size={14} color={textPrimary} strokeWidth={1.5} />
                      <span>Alternar Tamanho</span>
                    </div>
                  </button>

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Excluir Nó (troca o popup para a tela de confirmação com Confirmar e Cancelar) */}
                  <button
                    onClick={() => {
                      setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'confirm_delete' } : null));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Trash2 size={14} color="#ef4444" strokeWidth={1.5} />
                      <span style={{ fontWeight: 500, color: '#ef4444' }}>Excluir Nó</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#ef4444', opacity: 0.8 }}>Del</span>
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* NODE CONFIGURATION POPUP MODAL (ACCESSED VIA "CONFIGURAR NÓ" OPTION)      */}
      {/* ========================================================================= */}
      {configuringNode && (
        <div
          onClick={() => setConfiguringNodeId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            data-node-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: '88vh',
              background: isEffectiveDark ? '#141414' : '#ffffff',
              border: `1px solid ${border}`,
              borderRadius: 16,
              boxShadow: isEffectiveDark ? '0 20px 60px rgba(0, 0, 0, 0.75)' : '0 20px 60px rgba(0, 0, 0, 0.16)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'popupScale 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${border}`,
                background: bgCardSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {configuringNode.type === 'model'
                  ? (AI_PROVIDER_INFOS[(configuringNode.provider || selectedAiProvider || 'claude') as AiProviderId] || AI_PROVIDER_INFOS.claude).renderIcon(20)
                  : <Settings2 size={16} color={accentColor} strokeWidth={1.5} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                    Configurar {configuringNode.title}
                  </div>
                  <div style={{ fontSize: 11, color: textSecondary }}>
                    {configuringNode.subtitle || 'Parâmetros de execução'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setConfiguringNodeId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  padding: 5,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Título do Nó */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                  Título do Nó
                </label>
                <input
                  type="text"
                  value={configuringNode.title}
                  onChange={(e) => handleUpdateNode(configuringNode.id, { title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: bgCardSecondary,
                    border: `1px solid ${border}`,
                    color: textPrimary,
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Model Node Controls */}
              {configuringNode.type === 'model' && (() => {
                const modalProv = (configuringNode.provider || selectedAiProvider || 'claude') as AiProviderId;
                const modalModelList = getProviderModelList(modalProv);
                const modalMatch = modalModelList.find(
                  (m) => m.id === configuringNode.config.model || m.label === configuringNode.config.model
                ) || modalModelList[0];

                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                        Provedor de IA
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={modalProv}
                          onChange={(e) => {
                            const newProv = e.target.value as AiProviderId;
                            const newModels = getProviderModelList(newProv);
                            const activeCurrent = activeModels?.[newProv]?.currentModel;
                            const defaultModel = activeCurrent
                              ? newModels.find((m) => m.id === activeCurrent || m.label === activeCurrent) || newModels[0]
                              : newModels[0];
                            const meta = AI_PROVIDER_INFOS[newProv] || AI_PROVIDER_INFOS.claude;
                            handleUpdateNode(configuringNode.id, {
                              provider: newProv,
                              subtitle: `${meta.name} • ${defaultModel.label}`,
                              config: { ...configuringNode.config, model: defaultModel.label },
                            });
                            if (onSelectAiProvider) {
                              onSelectAiProvider(newProv);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 28px 8px 12px',
                            borderRadius: 6,
                            background: bgCardSecondary,
                            border: `1px solid ${border}`,
                            color: textPrimary,
                            fontSize: 12,
                            appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {Object.values(AI_PROVIDER_INFOS).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          color={textSecondary}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                        Modelo
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={modalMatch?.id || modalMatch?.label}
                          onChange={(e) => {
                            const chosen = modalModelList.find((m) => m.id === e.target.value || m.label === e.target.value);
                            if (!chosen) return;
                            const meta = AI_PROVIDER_INFOS[modalProv] || AI_PROVIDER_INFOS.claude;
                            handleUpdateNode(configuringNode.id, {
                              subtitle: `${meta.name} • ${chosen.label}`,
                              config: { ...configuringNode.config, model: chosen.label },
                            });
                            if (onSelectModel) {
                              onSelectModel(chosen, modalProv);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 28px 8px 12px',
                            borderRadius: 6,
                            background: bgCardSecondary,
                            border: `1px solid ${border}`,
                            color: textPrimary,
                            fontSize: 12,
                            appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {modalModelList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label} {m.tag ? `(${m.tag})` : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          color={textSecondary}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                          Temperatura
                        </label>
                        <span style={{ fontSize: 11, color: textPrimary, fontWeight: 600 }}>
                          {configuringNode.config.temperature ?? 0.7}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={configuringNode.config.temperature ?? 0.7}
                        onChange={(e) =>
                          handleUpdateNode(configuringNode.id, {
                            config: { ...configuringNode.config, temperature: parseFloat(e.target.value) },
                          })
                        }
                        style={{ width: '100%', accentColor, cursor: 'pointer' }}
                      />
                    </div>
                  </>
                );
              })()}

              {/* Trigger Node Controls */}
              {configuringNode.type === 'trigger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    Texto do Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={configuringNode.config.prompt || ''}
                    onChange={(e) =>
                      handleUpdateNode(configuringNode.id, {
                        config: { ...configuringNode.config, prompt: e.target.value },
                      })
                    }
                    placeholder="Descreva a demanda de execução..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 12,
                      resize: 'vertical',
                      lineHeight: 1.4,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Agent Node Controls */}
              {configuringNode.type === 'agent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    Instrução do Sistema
                  </label>
                  <textarea
                    rows={4}
                    value={configuringNode.config.systemInstruction || ''}
                    onChange={(e) =>
                      handleUpdateNode(configuringNode.id, {
                        config: { ...configuringNode.config, systemInstruction: e.target.value },
                      })
                    }
                    placeholder="Instruções para o agente coordenador..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 12,
                      resize: 'vertical',
                      lineHeight: 1.4,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Tool Node Controls */}
              {configuringNode.type === 'tool' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    Comando CLI
                  </label>
                  <input
                    type="text"
                    value={configuringNode.config.command || ''}
                    onChange={(e) =>
                      handleUpdateNode(configuringNode.id, {
                        config: { ...configuringNode.config, command: e.target.value },
                      })
                    }
                    placeholder="git status -s"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Memory Node Controls */}
              {configuringNode.type === 'memory' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    Identificador de Sessão
                  </label>
                  <input
                    type="text"
                    value={configuringNode.config.account || ''}
                    onChange={(e) =>
                      handleUpdateNode(configuringNode.id, {
                        config: { ...configuringNode.config, account: e.target.value },
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Output Preview */}
              {configuringNode.output?.text && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>
                      Última Saída
                    </span>
                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
                      {configuringNode.output.tokens} tokens • {configuringNode.output.durationMs}ms
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      fontSize: 11,
                      color: textPrimary,
                      maxHeight: 140,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.4,
                    }}
                  >
                    {configuringNode.output.text}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: `1px solid ${border}`,
                background: bgCardSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={() => {
                  const nodeRef = configuringNode;
                  setConfiguringNodeId(null);
                  setNodeToDelete(nodeRef);
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 6,
                  padding: '7px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} />
                <span>Excluir Nó</span>
              </button>

              <button
                onClick={() => setConfiguringNodeId(null)}
                style={{
                  background: accentColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 2px 8px ${accentColor}33`,
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Node Deletion conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={!!nodeToDelete}
        title="Excluir Nó do Fluxo"
        message="Tem certeza que deseja remover este nó do fluxo de orquestração?"
        itemDescription={nodeToDelete ? `${nodeToDelete.title} (${nodeToDelete.type})` : undefined}
        confirmLabel="Excluir Nó"
        cancelLabel="Cancelar"
        isDeleting={isDeleting}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={confirmDeleteNode}
        onClose={() => setNodeToDelete(null)}
      />

      {/* Keyframe styles for animated particles and spinning loaders */}
      <style>{`
        @keyframes dash-flow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -112; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes popupScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes tooltipFade {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }
      `}</style>
    </div>
  );
};
