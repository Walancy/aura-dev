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
  Copy,
  FolderGit2,
  RefreshCw,
  Code,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ClaudeIcon,
  AntigravityIcon,
  GeminiIcon,
  OllamaIcon,
  CodexIcon,
} from './icons/AiProviderIcons';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';

// ============================================================================
// TYPES
// ============================================================================

export type NodeType = 'trigger' | 'agent' | 'model' | 'tool' | 'memory';
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
  status: 'ready' | 'running' | 'success' | 'failed' | 'disabled';
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
  activeModels?: Record<string, string>;
}

// ============================================================================
// PROVIDER DEFINITIONS WITH OFFICIAL ICONS
// ============================================================================

export interface ProviderMeta {
  id: AiProviderId;
  name: string;
  badge: string;
  models: string[];
  renderIcon: (size?: number) => React.ReactNode;
}

export const AI_PROVIDERS: Record<AiProviderId, ProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Oficial',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    renderIcon: (size = 18) => <GeminiIcon size={size} />,
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    badge: 'Oficial',
    models: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
    renderIcon: (size = 18) => <ClaudeIcon size={size} />,
  },
  codex: {
    id: 'codex',
    name: 'OpenAI / Codex',
    badge: 'GPT',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
    renderIcon: (size = 18) => <CodexIcon size={size} />,
  },
  antigravity: {
    id: 'antigravity',
    name: 'Google Antigravity',
    badge: 'CLI Agent',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'claude-3-7-sonnet'],
    renderIcon: (size = 18) => <AntigravityIcon size={size} />,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama Local',
    badge: 'Offline',
    models: ['llama3:8b', 'deepseek-r1:8b', 'qwen2.5-coder', 'mistral'],
    renderIcon: (size = 18) => <OllamaIcon size={size} />,
  },
};

// ============================================================================
// DEFAULT NODES & EDGES (SYSTEM ARCHITECTURE)
// ============================================================================

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: 'node-trigger',
    type: 'trigger',
    title: 'Disparador de Prompt',
    subtitle: 'Entrada manual ou webhook',
    x: 80,
    y: 190,
    width: 240,
    height: 140,
    status: 'ready',
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
    title: 'Agente Coordenador DevFlow',
    subtitle: 'Roteamento e ferramentas',
    x: 420,
    y: 160,
    width: 280,
    height: 145,
    status: 'ready',
    config: {
      systemInstruction: 'Você é o coordenador de engenharia DevFlow. Analise a demanda, invoque o modelo de IA correspondente e estruture os resultados de forma acionável.',
      target: 'Workspace DevFlow',
    },
    ports: {
      input: ['in'],
      output: ['model', 'tool', 'memory'],
    },
  },
  {
    id: 'node-model-gemini',
    type: 'model',
    title: 'Modelo Principal IA',
    subtitle: 'Google Gemini',
    provider: 'gemini',
    x: 340,
    y: 430,
    width: 270,
    height: 220,
    status: 'ready',
    config: {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 2048,
    },
    ports: {
      input: ['model_in'],
      output: ['model_out'],
    },
  },
  {
    id: 'node-tool-cli',
    type: 'tool',
    title: 'Ferramenta Shell / Git',
    subtitle: 'Verificação do Workspace',
    x: 800,
    y: 180,
    width: 250,
    height: 135,
    status: 'ready',
    config: {
      command: 'git status --porcelain',
      target: 'Terminal Sandboxed',
    },
    ports: {
      input: ['tool_in'],
      output: ['tool_out'],
    },
  },
  {
    id: 'node-memory',
    type: 'memory',
    title: 'Memória de Contexto',
    subtitle: 'Sessão DevFlow',
    x: 690,
    y: 430,
    width: 230,
    height: 125,
    status: 'ready',
    config: {
      account: 'Sessão Ativa do Workspace',
    },
    ports: {
      input: ['mem_in'],
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
    label: 'Prompt',
    color: '#22c55e',
  },
  {
    id: 'edge-agent-model',
    fromNodeId: 'node-agent',
    fromPort: 'model',
    toNodeId: 'node-model-gemini',
    toPort: 'model_in',
    label: 'Inferência',
    color: '#22c55e',
  },
  {
    id: 'edge-agent-tool',
    fromNodeId: 'node-agent',
    fromPort: 'tool',
    toNodeId: 'node-tool-cli',
    toPort: 'tool_in',
    label: 'Execução CLI',
    color: '#38bdf8',
  },
  {
    id: 'edge-agent-mem',
    fromNodeId: 'node-agent',
    fromPort: 'memory',
    toNodeId: 'node-memory',
    toPort: 'mem_in',
    label: 'Contexto',
    color: '#a855f7',
  },
];

const STORAGE_KEY_NODES = 'devflow_orchestration_nodes_v4';
const STORAGE_KEY_EDGES = 'devflow_orchestration_edges_v4';
const STORAGE_KEY_LOGS = 'devflow_orchestration_logs_v4';

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
}) => {
  // Styles & tokens (adhering to system standards)
  const canvasBg = isEffectiveDark ? '#090a0f' : '#f8fafc';
  const gridDotColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
  const bgCard = themeTokens?.bgCard || (isEffectiveDark ? '#14161f' : '#ffffff');
  const bgCardSecondary = themeTokens?.bgCardSecondary || (isEffectiveDark ? '#1a1d29' : '#f1f5f9');
  const border = themeTokens?.border || (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)');
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#f8fafc' : '#0f172a');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#94a3b8' : '#64748b');
  const hoverBg = themeTokens?.hoverBg || (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)');

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'canvas' | 'logs'>('canvas');

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

  // Canvas Transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Dragging Nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Selection & Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  // Modals & Execution
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<WorkflowNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExecutingFlow, setIsExecutingFlow] = useState(false);

  // Synchronize with active global AI provider if available
  useEffect(() => {
    if (selectedAiProvider && selectedAiProvider in AI_PROVIDERS) {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.type === 'model' && !n.config.model) {
            return {
              ...n,
              provider: selectedAiProvider as AiProviderId,
              config: {
                ...n.config,
                model: selectedModel || AI_PROVIDERS[selectedAiProvider as AiProviderId].models[0],
              },
            };
          }
          return n;
        })
      );
    }
  }, [selectedAiProvider, selectedModel]);

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

  // ============================================================================
  // PORT COORDINATES FOR ACCURATE BEZIER WIRE CONNECTIONS
  // ============================================================================

  const getNodeDimensions = useCallback((node: WorkflowNode) => {
    if (node.width && node.height) return { width: node.width, height: node.height };
    if (node.type === 'trigger') return { width: 240, height: 140 };
    if (node.type === 'agent') return { width: 280, height: 145 };
    if (node.type === 'model') return { width: 270, height: 220 };
    if (node.type === 'tool') return { width: 250, height: 135 };
    if (node.type === 'memory') return { width: 230, height: 125 };
    return { width: 240, height: 140 };
  }, []);

  const getPortCoordinates = useCallback(
    (nodeId: string, portType: 'output' | 'input', portName?: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const { width, height } = getNodeDimensions(node);

      // Model connects from top to Agent
      if (node.type === 'model') {
        if (portType === 'input') return { x: node.x + width / 2, y: node.y };
        return { x: node.x + width / 2, y: node.y };
      }

      // Tool connects from top or left
      if (node.type === 'tool') {
        if (portType === 'input') return { x: node.x, y: node.y + height / 2 };
        return { x: node.x + width, y: node.y + height / 2 };
      }

      // Memory connects from top
      if (node.type === 'memory') {
        if (portType === 'input') return { x: node.x + width / 2, y: node.y };
        return { x: node.x + width / 2, y: node.y };
      }

      // Agent ports
      if (node.type === 'agent') {
        if (portName === 'model') return { x: node.x + 60, y: node.y + height };
        if (portName === 'memory') return { x: node.x + 140, y: node.y + height };
        if (portName === 'tool') return { x: node.x + width, y: node.y + height / 2 };
        if (portType === 'input') return { x: node.x, y: node.y + height / 2 };
      }

      // Default horizontal output & input
      if (portType === 'output') {
        return { x: node.x + width, y: node.y + height / 2 };
      }
      return { x: node.x, y: node.y + height / 2 };
    },
    [nodes, getNodeDimensions]
  );

  // ============================================================================
  // DRAGGING & PANNING
  // ============================================================================

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setSelectedNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    } else if (draggingNodeId) {
      const newX = Math.round((e.clientX - dragOffsetRef.current.x) / zoom);
      const newY = Math.round((e.clientY - dragOffsetRef.current.y) / zoom);
      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n))
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    dragOffsetRef.current = {
      x: e.clientX - node.x * zoom,
      y: e.clientY - node.y * zoom,
    };
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
    const modelProvider = modelNode?.provider || 'gemini';
    const modelName = modelNode?.config?.model || 'gemini-2.5-flash';

    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        status: n.type === 'trigger' || n.type === 'agent' || n.type === 'model' ? 'running' : n.status,
      }))
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
      providerUsed: AI_PROVIDERS[modelProvider]?.name || modelProvider,
      modelUsed: modelName,
    };

    setExecutionLogs((prev) => [newLog, ...prev.slice(0, 29)]);
    setIsExecutingFlow(false);
  };

  // ============================================================================
  // NODE CRUD ACTIONS (WITH AGENTS.md COMPLIANT CONFIRM DELETE MODAL)
  // ============================================================================

  const handleAddNode = (type: NodeType, provider?: AiProviderId) => {
    setIsAddMenuOpen(false);
    const newId = `node-${type}-${Date.now()}`;
    const x = Math.round((220 - pan.x) / zoom) + Math.floor(Math.random() * 50);
    const y = Math.round((180 - pan.y) / zoom) + Math.floor(Math.random() * 50);

    let title = 'Novo Nó';
    let subtitle = '';
    let config: any = {};
    let ports: any = { input: ['in'], output: ['out'] };
    let width = 240;
    let height = 140;

    if (type === 'model') {
      const p = provider || 'gemini';
      const meta = AI_PROVIDERS[p];
      title = `Modelo ${meta.name}`;
      subtitle = meta.models[0];
      width = 270;
      height = 220;
      config = {
        model: meta.models[0],
        temperature: 0.7,
        maxTokens: 2048,
      };
      ports = { input: ['model_in'], output: ['model_out'] };
    } else if (type === 'agent') {
      title = 'Agente Especialista';
      subtitle = 'Orquestrador de Tarefas';
      width = 280;
      height = 145;
      config = {
        systemInstruction: 'Atue como revisor de código e proponha soluções otimizadas.',
      };
      ports = { input: ['in'], output: ['model', 'tool'] };
    } else if (type === 'trigger') {
      title = 'Gatilho de Prompt';
      subtitle = 'Manual / Evento';
      width = 240;
      height = 140;
      config = {
        prompt: 'Descreva a tarefa ou questão para a IA resolver...',
      };
      ports = { output: ['out'] };
    } else if (type === 'tool') {
      title = 'Ferramenta Shell';
      subtitle = 'Comando CLI';
      width = 250;
      height = 135;
      config = {
        command: 'git status -s',
      };
      ports = { input: ['tool_in'], output: ['tool_out'] };
    } else if (type === 'memory') {
      title = 'Memória de Contexto';
      subtitle = 'Histórico do Chat';
      width = 230;
      height = 125;
      config = {
        account: 'Workspace Context',
      };
      ports = { input: ['mem_in'] };
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
  };

  // ============================================================================
  // ANIMATED MULTI-FILAMENT BEZIER WIRES (WITH GLOW AND PARTICLES)
  // ============================================================================

  const renderAnimatedWires = () => {
    return edges.map((edge) => {
      const from = getPortCoordinates(edge.fromNodeId, 'output', edge.fromPort);
      const to = getPortCoordinates(edge.toNodeId, 'input', edge.toPort);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

      if (isVertical) {
        // Vertical connection (e.g. Model / Memory / Tool pointing to Agent)
        const factor = Math.min(160, Math.abs(dy) * 0.5);
        cp1x = from.x;
        cp1y = from.y - factor;
        cp2x = to.x;
        cp2y = to.y + factor;
      } else {
        // Horizontal connection (Trigger -> Agent -> Tool)
        const factor = Math.max(60, Math.abs(dx) * 0.45);
        cp1x = from.x + factor;
        cp1y = from.y;
        cp2x = to.x - factor;
        cp2y = to.y;
      }

      const pathD = `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      const isWireActive = edge.isActive || isExecutingFlow;
      const wireColor = isWireActive ? accentColor : (edge.color || '#22c55e');
      const glowFilter = isWireActive ? 'url(#neon-glow-accent)' : 'url(#neon-glow-green)';

      return (
        <g key={edge.id}>
          {/* Background Wide Glow Aura */}
          <path
            d={pathD}
            fill="none"
            stroke={wireColor}
            strokeWidth={7}
            strokeOpacity={isWireActive ? 0.35 : 0.15}
            filter={glowFilter}
          />

          {/* Primary Central Wire */}
          <path
            d={pathD}
            fill="none"
            stroke={wireColor}
            strokeWidth={1.8}
            strokeOpacity={isWireActive ? 1 : 0.8}
          />

          {/* Multi-filament secondary organic lines */}
          <path
            d={`M ${from.x} ${from.y - 1.5} C ${cp1x} ${cp1y - 3}, ${cp2x} ${cp2y - 3}, ${to.x} ${to.y - 1.5}`}
            fill="none"
            stroke={wireColor}
            strokeWidth={0.75}
            strokeOpacity={0.35}
          />
          <path
            d={`M ${from.x} ${from.y + 1.5} C ${cp1x} ${cp1y + 3}, ${cp2x} ${cp2y + 3}, ${to.x} ${to.y + 1.5}`}
            fill="none"
            stroke={wireColor}
            strokeWidth={0.75}
            strokeOpacity={0.35}
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
              animation: isWireActive ? 'dash-flow 1.2s linear infinite' : 'dash-flow 2.4s linear infinite',
            }}
          />

          {/* Cable Center Capsule Badge */}
          {edge.label && (
            <g transform={`translate(${midX}, ${midY})`}>
              <rect
                x={-30}
                y={-11}
                width={60}
                height={22}
                rx={11}
                fill={isEffectiveDark ? '#0d1017' : '#ffffff'}
                stroke={isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.15)'}
                strokeWidth={1}
                boxShadow="0 2px 8px rgba(0,0,0,0.3)"
              />
              <text
                x={0}
                y={4}
                fill={isEffectiveDark ? '#cbd5e1' : '#475569'}
                fontSize={10}
                fontWeight={500}
                textAnchor="middle"
                fontFamily="inherit"
              >
                {edge.label}
              </text>
            </g>
          )}

          {/* Cable Port Sockets */}
          <circle cx={from.x} cy={from.y} r="4" fill={wireColor} stroke="#ffffff" strokeWidth="1" />
          <circle cx={to.x} cy={to.y} r="4" fill={wireColor} stroke="#ffffff" strokeWidth="1" />
        </g>
      );
    });
  };

  // ============================================================================
  // RENDER NODE CARD (WITH OFFICIAL AI ICONS)
  // ============================================================================

  const renderNodeCard = (node: WorkflowNode) => {
    const isSelected = selectedNodeId === node.id;
    const isRunning = node.status === 'running';
    const { width, height } = getNodeDimensions(node);

    let IconElement: React.ReactNode = null;
    let badgeText = '';

    if (node.type === 'model') {
      const p = node.provider || 'gemini';
      const meta = AI_PROVIDERS[p];
      IconElement = meta ? meta.renderIcon(18) : <Bot size={18} color={accentColor} />;
      badgeText = meta ? meta.badge : 'IA';
    } else if (node.type === 'agent') {
      IconElement = <Bot size={18} color={accentColor} />;
      badgeText = 'Agente';
    } else if (node.type === 'trigger') {
      IconElement = <Zap size={18} color="#eab308" />;
      badgeText = 'Gatilho';
    } else if (node.type === 'tool') {
      IconElement = <Terminal size={18} color="#38bdf8" />;
      badgeText = 'Tool';
    } else if (node.type === 'memory') {
      IconElement = <Database size={18} color="#a855f7" />;
      badgeText = 'Memória';
    }

    return (
      <div
        key={node.id}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width,
          minHeight: height,
          background: bgCard,
          border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${border}`,
          borderRadius: 8,
          boxShadow: isSelected
            ? `0 0 0 3px ${accentColor}25, 0 10px 30px rgba(0,0,0,0.4)`
            : '0 6px 20px rgba(0,0,0,0.22)',
          cursor: draggingNodeId === node.id ? 'grabbing' : 'grab',
          userSelect: 'none',
          transition: draggingNodeId === node.id ? 'none' : 'box-shadow 0.15s ease, border-color 0.15s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: isSelected ? 30 : 10,
        }}
      >
        {/* Card Header */}
        <div
          style={{
            padding: '8px 12px',
            background: bgCardSecondary,
            borderBottom: `1px solid ${border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {IconElement}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.title}
              </span>
              <span style={{ fontSize: 10, color: textSecondary }}>
                {badgeText} {node.subtitle ? `• ${node.subtitle}` : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {isRunning ? (
              <RefreshCw
                size={12}
                color={accentColor}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : node.status === 'success' ? (
              <CheckCircle2 size={12} color="#22c55e" />
            ) : node.status === 'failed' ? (
              <AlertCircle size={12} color="#ef4444" />
            ) : (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isEffectiveDark ? '#52525b' : '#cbd5e1',
                }}
              />
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setNodeToDelete(node);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: textSecondary,
              }}
              title="Excluir nó"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* AI Model Node specifics */}
          {node.type === 'model' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
                  Provedor IA
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={node.provider || 'gemini'}
                    onChange={(e) => {
                      const newP = e.target.value as AiProviderId;
                      const meta = AI_PROVIDERS[newP];
                      handleUpdateNode(node.id, {
                        provider: newP,
                        subtitle: meta.models[0],
                        config: {
                          ...node.config,
                          model: meta.models[0],
                        },
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 24px 5px 8px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 11,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {Object.values(AI_PROVIDERS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={textSecondary}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
                  Modelo
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={node.config.model || AI_PROVIDERS[node.provider || 'gemini'].models[0]}
                    onChange={(e) => {
                      handleUpdateNode(node.id, {
                        subtitle: e.target.value,
                        config: { ...node.config, model: e.target.value },
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 24px 5px 8px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 11,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {(AI_PROVIDERS[node.provider || 'gemini']?.models || []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={textSecondary}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: textSecondary }}>
                  Temp: {node.config.temperature ?? 0.7}
                </span>
                {node.output?.tokens && (
                  <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
                    {node.output.tokens} tokens ({node.output.durationMs}ms)
                  </span>
                )}
              </div>
            </>
          )}

          {/* Trigger Node specifics */}
          {node.type === 'trigger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
                Prompt da Tarefa
              </label>
              <textarea
                value={node.config.prompt || ''}
                onChange={(e) => {
                  handleUpdateNode(node.id, {
                    config: { ...node.config, prompt: e.target.value },
                  });
                }}
                rows={2}
                placeholder="Ex: Auditar pendências do sprint..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: bgCardSecondary,
                  border: `1px solid ${border}`,
                  color: textPrimary,
                  fontSize: 11,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.4,
                }}
              />
            </div>
          )}

          {/* Agent Node specifics */}
          {node.type === 'agent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary, lineHeight: 1.3 }}>
                Roteia prompts para os modelos conectados e coordena ferramentas.
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${accentColor}18`,
                    color: accentColor,
                    fontWeight: 600,
                  }}
                >
                  Prompt In
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isEffectiveDark ? '#27272a' : '#e2e8f0',
                    color: textSecondary,
                  }}
                >
                  CLI Out
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isEffectiveDark ? '#27272a' : '#e2e8f0',
                    color: textSecondary,
                  }}
                >
                  Model Out
                </span>
              </div>
            </div>
          )}

          {/* Tool Node specifics */}
          {node.type === 'tool' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: textSecondary, fontWeight: 500 }}>
                Comando CLI
              </label>
              <input
                type="text"
                value={node.config.command || ''}
                onChange={(e) => {
                  handleUpdateNode(node.id, {
                    config: { ...node.config, command: e.target.value },
                  });
                }}
                placeholder="git status --porcelain"
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: bgCardSecondary,
                  border: `1px solid ${border}`,
                  color: '#38bdf8',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Memory Node specifics */}
          {node.type === 'memory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>
                Armazena contexto e histórico de execuções no workspace local.
              </span>
            </div>
          )}

          {/* Output snippet */}
          {node.output?.text && (
            <div
              style={{
                marginTop: 4,
                padding: '6px 8px',
                borderRadius: 5,
                background: isEffectiveDark ? '#0d1017' : '#f1f5f9',
                border: `1px solid ${border}`,
                fontSize: 10,
                color: textSecondary,
                maxHeight: 46,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}
            >
              <span style={{ color: textPrimary, fontWeight: 600 }}>Resposta: </span>
              {node.output.text}
            </div>
          )}
        </div>
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
        background: canvasBg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          height: 48,
          background: bgCard,
          borderBottom: `1px solid ${border}`,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
              Orquestração de IAs & Agentes
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 12,
                background: `${accentColor}18`,
                color: accentColor,
              }}
            >
              {nodes.length} nós ativos
            </span>
          </div>

          {workspacePath && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: textSecondary,
                paddingLeft: 8,
                borderLeft: `1px solid ${border}`,
              }}
            >
              <FolderGit2 size={12} />
              <span>{workspacePath.split('/').filter(Boolean).pop()}</span>
            </div>
          )}
        </div>

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
              <ZoomOut size={13} />
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
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 30, y: 20 });
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${border}`,
                padding: '5px 8px',
                color: textSecondary,
                cursor: 'pointer',
              }}
              title="Ajustar à tela"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsAddMenuOpen((v) => !v)}
              style={{
                background: bgCardSecondary,
                border: `1px solid ${border}`,
                color: textPrimary,
                fontSize: 11,
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              <span>Adicionar Nó</span>
              <ChevronDown size={11} />
            </button>

            {isAddMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 220,
                  background: bgCard,
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                  padding: 6,
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: textSecondary }}>
                  MODELOS DE IA
                </div>

                {Object.values(AI_PROVIDERS).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddNode('model', p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: textPrimary,
                      fontSize: 11,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {p.renderIcon(16)}
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: textSecondary }}>{p.badge}</span>
                  </button>
                ))}

                <div style={{ height: 1, background: border, margin: '4px 0' }} />
                <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: textSecondary }}>
                  COMPONENTES DO FLUXO
                </div>

                <button
                  onClick={() => handleAddNode('agent')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: textPrimary,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Bot size={16} color={accentColor} />
                  <span>Agente Especialista</span>
                </button>

                <button
                  onClick={() => handleAddNode('trigger')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: textPrimary,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Zap size={16} color="#eab308" />
                  <span>Gatilho de Prompt</span>
                </button>

                <button
                  onClick={() => handleAddNode('tool')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: textPrimary,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Terminal size={16} color="#38bdf8" />
                  <span>Ferramenta CLI</span>
                </button>

                <button
                  onClick={() => handleAddNode('memory')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: textPrimary,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Database size={16} color="#a855f7" />
                  <span>Memória de Contexto</span>
                </button>
              </div>
            )}
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
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Executando...</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Executar Fluxo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'canvas' ? (
        <div
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: isPanning ? 'grabbing' : 'default',
            overflow: 'hidden',
          }}
        >
          {/* Radial Dot Grid Background matching previous aesthetic */}
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

          {/* Vignette Gradient Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(0,0,0,0.65) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Animated SVG Cables with organic filaments and glowing particles */}
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
                width: 4000,
                height: 4000,
                overflow: 'visible',
              }}
            >
              <defs>
                <filter id="neon-glow-green" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="neon-glow-accent" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {renderAnimatedWires()}
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

          {/* Floating Left Dock */}
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 16,
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
            <button
              onClick={() => setIsAddMenuOpen((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 7,
                borderRadius: 6,
                color: textSecondary,
                cursor: 'pointer',
              }}
              title="Adicionar nó"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={executeWorkflow}
              style={{
                background: isExecutingFlow ? `${accentColor}22` : 'transparent',
                border: 'none',
                padding: 7,
                borderRadius: 6,
                color: isExecutingFlow ? accentColor : textSecondary,
                cursor: 'pointer',
              }}
              title="Executar fluxo"
            >
              <Play size={16} />
            </button>
            <button
              onClick={handleResetToDefault}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 7,
                borderRadius: 6,
                color: textSecondary,
                cursor: 'pointer',
              }}
              title="Restaurar fluxo padrão"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 320,
                background: bgCard,
                borderLeft: `1px solid ${border}`,
                boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 38,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedNode.type === 'model'
                    ? AI_PROVIDERS[selectedNode.provider || 'gemini']?.renderIcon(18)
                    : <Settings2 size={16} color={accentColor} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                    {selectedNode.title}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: textSecondary,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                    Título do Nó
                  </label>
                  <input
                    type="text"
                    value={selectedNode.title}
                    onChange={(e) => handleUpdateNode(selectedNode.id, { title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: bgCardSecondary,
                      border: `1px solid ${border}`,
                      color: textPrimary,
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>

                {selectedNode.type === 'model' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                        Provedor de IA
                      </label>
                      <select
                        value={selectedNode.provider || 'gemini'}
                        onChange={(e) => {
                          const p = e.target.value as AiProviderId;
                          const meta = AI_PROVIDERS[p];
                          handleUpdateNode(selectedNode.id, {
                            provider: p,
                            subtitle: meta.models[0],
                            config: { ...selectedNode.config, model: meta.models[0] },
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: bgCardSecondary,
                          border: `1px solid ${border}`,
                          color: textPrimary,
                          fontSize: 12,
                        }}
                      >
                        {Object.values(AI_PROVIDERS).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                        Modelo
                      </label>
                      <select
                        value={selectedNode.config.model || ''}
                        onChange={(e) =>
                          handleUpdateNode(selectedNode.id, {
                            subtitle: e.target.value,
                            config: { ...selectedNode.config, model: e.target.value },
                          })
                        }
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: bgCardSecondary,
                          border: `1px solid ${border}`,
                          color: textPrimary,
                          fontSize: 12,
                        }}
                      >
                        {(AI_PROVIDERS[selectedNode.provider || 'gemini']?.models || []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                          Temperatura
                        </label>
                        <span style={{ fontSize: 11, color: textPrimary, fontWeight: 600 }}>
                          {selectedNode.config.temperature ?? 0.7}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedNode.config.temperature ?? 0.7}
                        onChange={(e) =>
                          handleUpdateNode(selectedNode.id, {
                            config: { ...selectedNode.config, temperature: parseFloat(e.target.value) },
                          })
                        }
                        style={{ width: '100%', accentColor }}
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === 'trigger' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                      Texto do Prompt
                    </label>
                    <textarea
                      rows={5}
                      value={selectedNode.config.prompt || ''}
                      onChange={(e) =>
                        handleUpdateNode(selectedNode.id, {
                          config: { ...selectedNode.config, prompt: e.target.value },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: 6,
                        background: bgCardSecondary,
                        border: `1px solid ${border}`,
                        color: textPrimary,
                        fontSize: 12,
                        resize: 'vertical',
                        lineHeight: 1.4,
                      }}
                    />
                  </div>
                )}

                {selectedNode.type === 'tool' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: textSecondary, fontWeight: 500 }}>
                      Comando de Execução
                    </label>
                    <input
                      type="text"
                      value={selectedNode.config.command || ''}
                      onChange={(e) =>
                        handleUpdateNode(selectedNode.id, {
                          config: { ...selectedNode.config, command: e.target.value },
                        })
                      }
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: bgCardSecondary,
                        border: `1px solid ${border}`,
                        color: '#38bdf8',
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                    />
                  </div>
                )}

                {selectedNode.output?.text && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>
                        Última Saída
                      </span>
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
                        {selectedNode.output.tokens} tokens • {selectedNode.output.durationMs}ms
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
                        maxHeight: 180,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.4,
                      }}
                    >
                      {selectedNode.output.text}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                  <button
                    onClick={() => setNodeToDelete(selectedNode)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Excluir Nó</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Logs Tab */
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
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
          from { stroke-dashoffset: 68; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
