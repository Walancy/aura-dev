import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Clock,
  Save,
  Download,
  Trash2,
  Copy,
  Check,
  Wand2,
  Plus,
  Play,
  SquareTerminal,
  Bot,
  MessageSquare,
  Globe,
  Database,
  FolderGit2,
  Terminal,
  FileText,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import type { NodeType, WorkflowNode, WorkflowEdge } from './OrchestrationCanvas';
import { renderAiIcon, AuraDevIcon } from './icons/AiProviderIcons';
import { AI_PROVIDERS, DEFAULT_AI_QUOTAS, formatModelDisplayName } from '../constants/ai';
import { hexToRgba, getContrastTextColor } from '../utils/color';
import {
  parseMaestroActions,
  resolveNodeId,
  calculateMaestroBatchLayout,
  inferMissingConnections,
  type MaestroAction,
} from '../utils/maestroActions';
import avatarImg from '../avatar.png';

export interface OrchestrationMaestroPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Canvas State & Manipulation Callbacks
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onAddNode: (
    type: NodeType,
    provider?: string,
    initialConfig?: any,
    initialTitle?: string,
    position?: { x?: number; y?: number }
  ) => Promise<string>;
  onConnectNodes: (fromNodeId: string, toNodeId: string, fromPort?: string, toPort?: string) => boolean;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode> | { config?: any; title?: string; subtitle?: string }) => void;
  onDeleteNode: (node: WorkflowNode) => void;
  onRunWorkflow: () => void;
  onOpenUrl?: (url: string, browserNodeId?: string) => Promise<string>;
  onOpenProject?: (projectName: string, browserNodeId?: string) => Promise<string>;
  onCancelWorkflow?: () => void;
  isExecutingFlow?: boolean;
  onFocusNode?: (nodeId: string) => void;
  // Project & Git Context
  availableProjects?: any[];
  workspacePath?: string;
  currentUser?: { login: string; avatarUrl?: string } | null;
  // AI Provider & Model Config
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
  // Visual Theme Tokens
  accentColor: string;
  isEffectiveDark: boolean;
  themeTokens?: {
    bgCard?: string;
    bgCardSecondary?: string;
    textPrimary?: string;
    textSecondary?: string;
    border?: string;
    hoverBg?: string;
  };
  onToast?: (msg: string) => void;
}

export interface MaestroChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  text: string;
  providerId?: string;
  timestamp: number;
  executedActions?: MaestroAction[];
}

export interface MaestroChatSession {
  id: string;
  title: string;
  updatedAt: number;
  provider: string;
  history: MaestroChatMessage[];
}

const STORAGE_KEY = 'devflow_maestro_sessions_v1';
const DEFAULT_MAESTRO_WIDTH = 440;
const MIN_MAESTRO_WIDTH = 320;
const MAX_MAESTRO_WIDTH = 1100;
const WIDTH_STORAGE_KEY = 'devflow_maestro_panel_width';

export const OrchestrationMaestroPanel: React.FC<OrchestrationMaestroPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  onAddNode,
  onConnectNodes,
  onUpdateNode,
  onDeleteNode,
  onRunWorkflow,
  onOpenUrl,
  onOpenProject,
  onCancelWorkflow,
  isExecutingFlow = false,
  onFocusNode,
  availableProjects = [],
  workspacePath = '',
  currentUser,
  selectedAiProvider: propAiProvider,
  selectedModel: propModel,
  installedClis = {},
  activeModels = {},
  onSelectAiProvider,
  onSelectModel,
  accentColor = '#FF6A00',
  isEffectiveDark = true,
  themeTokens,
  onToast,
}) => {
  // Brand & Theme Colors matching IDE
  const chatAccentColor = accentColor;
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#94a3b8' : '#64748b');
  const border = themeTokens?.border || (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');
  const bgCardSecondary = themeTokens?.bgCardSecondary || (isEffectiveDark ? '#181818' : '#f8fafc');

  // Local AI Provider & Model State (synced with props or independent)
  const [activeProvider, setActiveProvider] = useState<string>(propAiProvider || 'claude');
  useEffect(() => {
    if (propAiProvider) setActiveProvider(propAiProvider);
  }, [propAiProvider]);

  const [activeModelName, setActiveModelName] = useState<string>(propModel || 'sonnet');
  useEffect(() => {
    if (propModel) setActiveModelName(propModel);
  }, [propModel]);

  // Dropdown states
  const [providerDropdown, setProviderDropdown] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [chatActionsMenuOpen, setChatActionsMenuOpen] = useState(false);
  const [chatHistoryPopupOpen, setChatHistoryPopupOpen] = useState(false);
  const [quotaTooltipOpen, setQuotaTooltipOpen] = useState(false);
  const [isOrchestratorActive, setIsOrchestratorActive] = useState(true);

  // Chat sessions state
  const [sessions, setSessions] = useState<MaestroChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: `maestro-${Date.now()}`,
        title: 'Nova Orquestração',
        updatedAt: Date.now(),
        provider: 'claude',
        history: [],
      },
    ];
  });

  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const currentSession = sessions[activeSessionIndex] || sessions[0];

  // Prompt and Execution State
  const [promptInput, setPromptInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Horizontal Resizing State (Standard default width: 440px)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_MAESTRO_WIDTH && parsed <= MAX_MAESTRO_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_MAESTRO_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_MAESTRO_WIDTH);

  // Resize handler on the lateral left border
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - moveEvent.clientX;
      const maxWidth = Math.max(MIN_MAESTRO_WIDTH, window.innerWidth - 60);
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_MAESTRO_WIDTH), maxWidth);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setPanelWidth((curr) => {
        try {
          localStorage.setItem(WIDTH_STORAGE_KEY, String(curr));
        } catch {}
        return curr;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  const handleResizeDoubleClick = useCallback(() => {
    setPanelWidth(DEFAULT_MAESTRO_WIDTH);
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(DEFAULT_MAESTRO_WIDTH));
    } catch {}
    onToast?.('Largura do Maestro restaurada para o padrão (440px).');
  }, [onToast]);

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSession?.history?.length, isThinking, isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(target)) {
        setProviderDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setModelDropdown(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(target)) {
        setChatActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Keyboard shortcut: Escape closes dropdowns or panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (providerDropdown || modelDropdown || chatActionsMenuOpen || chatHistoryPopupOpen) {
          setProviderDropdown(false);
          setModelDropdown(false);
          setChatActionsMenuOpen(false);
          setChatHistoryPopupOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, providerDropdown, modelDropdown, chatActionsMenuOpen, chatHistoryPopupOpen]);

  // Session Handlers
  const handleCreateNewSession = () => {
    const newSession: MaestroChatSession = {
      id: `maestro-${Date.now()}`,
      title: `Orquestração #${sessions.length + 1}`,
      updatedAt: Date.now(),
      provider: activeProvider,
      history: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionIndex(0);
    setChatHistoryPopupOpen(false);
    onToast?.('Nova sessão do Maestro iniciada.');
  };

  const handleSelectSession = (idx: number) => {
    setActiveSessionIndex(idx);
    setChatHistoryPopupOpen(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      setSessions([
        {
          id: `maestro-${Date.now()}`,
          title: 'Nova Orquestração',
          updatedAt: Date.now(),
          provider: activeProvider,
          history: [],
        },
      ]);
      setActiveSessionIndex(0);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setActiveSessionIndex(0);
  };

  const handleClearCurrentSession = () => {
    setSessions((prev) =>
      prev.map((s, idx) => (idx === activeSessionIndex ? { ...s, history: [] } : s))
    );
    setChatActionsMenuOpen(false);
    onToast?.('Histórico da sessão limpo.');
  };

  const handleExportMarkdown = () => {
    setChatActionsMenuOpen(false);
    const lines: string[] = [
      `# Histórico do Maestro — ${currentSession?.title || 'Orquestração'}`,
      `Data: ${new Date().toLocaleString()}`,
      `Provedor: ${activeProvider} | Modelo: ${activeModelName}`,
      '',
      '---',
      '',
    ];
    for (const msg of currentSession?.history || []) {
      const sender = msg.type === 'user' ? 'Usuário' : 'Maestro';
      lines.push(`### ${sender} (${new Date(msg.timestamp).toLocaleTimeString()})`);
      lines.push(msg.text);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.('Conversa exportada em Markdown.');
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
    onToast?.('Copiado para a área de transferência.');
  };

  // Real GitHub Issue Fetcher (Dynamically queries active workspace and user projects)
  const fetchLiveGitHubIssues = useCallback(async (targetProjectHint?: string): Promise<any[]> => {
    const issuesList: any[] = [];
    const checkedDirs = new Set<string>();

    // 0. Prioritize explicitly mentioned project if provided
    if (targetProjectHint && availableProjects && availableProjects.length > 0) {
      const hint = targetProjectHint.toLowerCase().trim();
      const matched = availableProjects.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const full = (p.fullName || '').toLowerCase();
        return name === hint || name.includes(hint) || hint.includes(name) ||
               full === hint || full.includes(hint) || hint.includes(full);
      });

      for (const proj of matched) {
        const pDir = proj.localDir || proj.path;
        if (pDir && !checkedDirs.has(pDir) && window.electronAPI?.git?.getIssues) {
          try {
            const list = await window.electronAPI.git.getIssues(pDir);
            if (Array.isArray(list) && list.length > 0) {
              issuesList.push(
                ...list.map((i: any) => ({
                  ...i,
                  sourceProject: proj.name || proj.fullName || targetProjectHint,
                }))
              );
              checkedDirs.add(pDir);
            }
          } catch (err) {
            console.warn('[Maestro] Error querying git:getIssues for targeted project:', pDir, err);
          }
        }
      }
    }

    // 1. Try active workspace if not yet checked
    if (issuesList.length === 0 && workspacePath && !checkedDirs.has(workspacePath) && window.electronAPI?.git?.getIssues) {
      try {
        const list = await window.electronAPI.git.getIssues(workspacePath);
        if (Array.isArray(list) && list.length > 0) {
          issuesList.push(
            ...list.map((i: any) => ({
              ...i,
              sourceProject: workspacePath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace',
            }))
          );
          checkedDirs.add(workspacePath);
        }
      } catch (err) {
        console.warn('[Maestro] Error querying git:getIssues for workspace:', err);
      }
    }

    // 2. Try candidate user projects
    if (issuesList.length === 0 && availableProjects && availableProjects.length > 0) {
      for (const proj of availableProjects.slice(0, 8)) {
        const pDir = proj.localDir || proj.path;
        if (pDir && !checkedDirs.has(pDir) && window.electronAPI?.git?.getIssues) {
          try {
            const list = await window.electronAPI.git.getIssues(pDir);
            if (Array.isArray(list) && list.length > 0) {
              issuesList.push(
                ...list.map((i: any) => ({
                  ...i,
                  sourceProject: proj.name || proj.fullName || 'Projeto',
                }))
              );
              checkedDirs.add(pDir);
              break;
            }
          } catch {}
        }
      }
    }

    // 3. Fallback: try gh CLI directly
    if (issuesList.length === 0 && window.electronAPI?.shell?.exec) {
      try {
        const ghRes = await window.electronAPI.shell.exec(
          'gh issue list --state all --limit 15 --json number,title,state,url,author,labels',
          workspacePath || availableProjects[0]?.localDir
        );
        if (ghRes?.stdout) {
          const parsed = JSON.parse(ghRes.stdout);
          if (Array.isArray(parsed)) {
            issuesList.push(...parsed);
          }
        }
      } catch {}
    }

    return issuesList;
  }, [workspacePath, availableProjects]);

  // Build Contextual Orchestration System Prompt
  const buildOrchestrationContext = useCallback(
    async (userPrompt: string): Promise<string> => {
      const gitUser = currentUser?.login || 'Walancy';

      // Detect if user prompt mentions a specific project
      const lowerPrompt = userPrompt.toLowerCase();
      const matchedProject = availableProjects?.find((p) => {
        const name = (p.name || '').toLowerCase();
        return name.length >= 3 && lowerPrompt.includes(name);
      });

      // Check if user is asking about issues
      let liveIssues: any[] = [];
      const isIssueRelated = /(?:issue|tarefa|bug|card|pend[eê]ncia|github|git|backlog)/i.test(userPrompt);
      if (isIssueRelated) {
        try {
          liveIssues = await fetchLiveGitHubIssues(matchedProject?.name);
        } catch {}
      }

      // Nodes summary
      const nodesSummary = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        subtitle: n.subtitle,
        status: n.status,
        prompt: n.config?.prompt || undefined,
        systemInstruction: n.config?.systemInstruction || undefined,
        command: n.config?.command || undefined,
        model: n.config?.model || undefined,
        devUrl: n.config?.devUrl || undefined,
        projectPath: n.config?.projectPath || undefined,
      }));

      // Edges summary
      const edgesSummary = edges.map((e) => ({
        id: e.id,
        from: e.fromNodeId,
        fromPort: e.fromPort,
        to: e.toNodeId,
        toPort: e.toPort,
      }));

      // Projects summary (prioritizing cloned/local projects)
      const sortedProjects = [...availableProjects].sort((a, b) => {
        if (a.isCloned && !b.isCloned) return -1;
        if (!a.isCloned && b.isCloned) return 1;
        return 0;
      });
      const projectsSummary = sortedProjects.slice(0, 30).map((p) => ({
        name: p.name,
        fullName: p.fullName,
        branch: p.branch || 'main',
        localDir: p.localDir || p.path,
        isCloned: p.isCloned,
        devUrl: p.devUrl,
      }));

      return `
Você é o Maestro, assistente e orquestrador inteligente avançado do DevFlow.
Seu objetivo é planejar, criar, conectar e gerenciar blocos visuais de orquestração, agentes de IA, gatilhos de prompt, ferramentas CLI e projetos do usuário.

ESTADO ATUAL DO CANVAS:
- Nós existentes (${nodesSummary.length}): ${JSON.stringify(nodesSummary, null, 2)}
- Conexões existentes (${edgesSummary.length}): ${JSON.stringify(edgesSummary, null, 2)}
- Projetos disponíveis do usuário: ${JSON.stringify(projectsSummary, null, 2)}
- Usuário logado: ${gitUser}
${liveIssues.length > 0 ? `- ISSUES REAIS DO GITHUB (${liveIssues.length}): ${JSON.stringify(liveIssues, null, 2)}` : ''}

CAPACIDADES DE AÇÃO (Totalmente Funcionais):
Você pode executar comandos no canvas adicionando um bloco JSON no final da resposta com a tag \`\`\`json:actions.
IMPORTANTE: Sempre que criar 2 ou mais nós (como um pipeline, fluxo ou agente com modelo/tool), você DEVE SEMPRE interligá-los usando ações "connect_nodes"!
Use as referências temporárias "$node-0", "$node-1", "$node-2" (na ordem dos nós adicionados).

Formatos aceitos:
1. add_node: Cria um nó novo no canvas.
   Tipos: 'trigger' (card de prompt), 'agent' (agente de IA), 'model' (modelo LLM), 'tool' (ferramenta shell), 'ide' (terminal workspace), 'project' (projeto), 'webview' (navegador).
   Exemplo:
   {
     "action": "add_node",
     "type": "trigger",
     "title": "Prompt da Tarefa",
     "config": { "prompt": "Descreva o prompt detalhadamente aqui..." }
   }
2. connect_nodes: Conecta dois nós através de suas portas.
   - De Trigger para Agente: fromPort "out", toPort "in"
   - De Agente para Modelo: fromPort "chat_model", toPort "in"
   - De Agente para Tool: fromPort "tool", toPort "in"
   - De Tool ou Agente para Webview: fromPort "out", toPort "in"
   Exemplo:
   {
     "action": "connect_nodes",
     "from": "$node-0",
     "to": "$node-1",
     "fromPort": "out",
     "toPort": "in"
   }
3. update_node: Atualiza o título ou configurações de um nó existente.
   Exemplo:
   {
     "action": "update_node",
     "nodeId": "id-do-no",
     "title": "Novo Título",
     "config": { "prompt": "Novo prompt detalhado..." }
   }
4. run_workflow: Inicia a execução do fluxo no canvas.
   Exemplo: { "action": "run_workflow" }
5. open_url: Abre uma URL no componente de Navegador do canvas (cria um navegador se não houver). Aceita localhost.
   Exemplo: { "action": "open_url", "url": "http://localhost:5173" }
6. open_project: Coloca o projeto no canvas (se ainda não estiver), liga ao Navegador e abre a dev URL dele, subindo o servidor se estiver offline. Use o nome de um dos "Projetos disponíveis".
   Exemplo: { "action": "open_project", "projectName": "estancia-bahia-painel-interno" }

Exemplo de pipeline completo conectado:
\`\`\`json:actions
[
  { "action": "add_node", "type": "trigger", "title": "Prompt Inicial", "config": { "prompt": "Análise da demanda" } },
  { "action": "add_node", "type": "agent", "title": "Agente Revisor" },
  { "action": "add_node", "type": "model", "title": "Modelo Sonnet", "provider": "claude" },
  { "action": "connect_nodes", "from": "$node-0", "to": "$node-1", "fromPort": "out", "toPort": "in" },
  { "action": "connect_nodes", "from": "$node-1", "to": "$node-2", "fromPort": "chat_model", "toPort": "in" }
]
\`\`\`

DIRETRIZES:
- Seja proativo, claro e preciso. Explique em português o que você está configurando.
- Se o usuário pedir para resolver uma issue, criar um fluxo ou adicionar agentes, crie os cards E conecte-os com "connect_nodes" no bloco \`\`\`json:actions.
- Não use dados falsos ou mocks. Use as issues reais informadas acima quando o usuário perguntar sobre elas.
- Para abrir uma aplicação ou URL no navegador do canvas use as ações open_project / open_url. Nunca instale dependências (como o portless) sem o usuário pedir.
`.trim();
    },
    [nodes, edges, availableProjects, currentUser, fetchLiveGitHubIssues]
  );

  // Send Prompt Handler
  const handleSendPrompt = async (forcedPrompt?: string) => {
    const promptToSend = (forcedPrompt || promptInput).trim();
    if (!promptToSend || isThinking) return;

    setPromptInput('');
    setIsThinking(true);

    const userMessage: MaestroChatMessage = {
      id: `msg-${Date.now()}-user`,
      type: 'user',
      text: promptToSend,
      timestamp: Date.now(),
    };

    // Append user message immediately
    setSessions((prev) =>
      prev.map((s, idx) =>
        idx === activeSessionIndex
          ? {
              ...s,
              updatedAt: Date.now(),
              title: s.history.length === 0 ? promptToSend.slice(0, 36) : s.title,
              history: [...s.history, userMessage],
            }
          : s
      )
    );

    try {
      // 1. Build contextual prompt with live canvas and GitHub issues
      const systemContext = await buildOrchestrationContext(promptToSend);
      const fullPrompt = `${systemContext}\n\nSOLICITAÇÃO DO USUÁRIO:\n${promptToSend}`;

      // 2. Call real AI CLI / API
      let rawResponse = '';
      const lowerPrompt = promptToSend.toLowerCase();
      const matchedTargetProj = availableProjects?.find((p) => {
        const name = (p.name || '').toLowerCase();
        return name.length >= 3 && lowerPrompt.includes(name);
      });
      const effectiveCwd = matchedTargetProj?.localDir || matchedTargetProj?.path || workspacePath;

      if (window.electronAPI?.ai?.prompt) {
        const res = await window.electronAPI.ai.prompt(
          fullPrompt,
          activeModelName || 'sonnet',
          effectiveCwd,
          activeProvider,
          300000
        );
        if (typeof res === 'string') rawResponse = res;
        else if (res && typeof res.response === 'string') rawResponse = res.response;
        else if (res && typeof (res as any).stdout === 'string') rawResponse = (res as any).stdout;
        else if (res && typeof (res as any).text === 'string') rawResponse = (res as any).text;
        if (!rawResponse && res && res.error) {
          throw new Error(res.error);
        }
      } else if (window.electronAPI?.ai?.runCli) {
        const cliRes = await window.electronAPI.ai.runCli({
          cliCmd: activeProvider,
          prompt: fullPrompt,
          model: activeModelName,
          cwd: workspacePath,
        });
        rawResponse = cliRes?.stdout || '';
        if (!rawResponse && cliRes?.stderr) {
          throw new Error(cliRes.stderr);
        }
      } else {
        throw new Error('Serviço de IA não disponível no desktop.');
      }

      // 3. Parse Maestro actions & infer missing pipeline connections if applicable
      const { cleanText, actions: parsedActions } = parseMaestroActions(rawResponse);
      const actions = inferMissingConnections(parsedActions, promptToSend);
      const executedActions: MaestroAction[] = [];
      const createdNodeIds: string[] = [];

      // 4. Calcular posições organizadas em pipeline para os nós criados neste lote
      const batchLayout = calculateMaestroBatchLayout(actions, nodes);

      // 5. Dynamically execute actions on the canvas
      if (actions.length > 0) {
        let addNodeCounter = 0;
        for (const action of actions) {
          if (action.action === 'add_node') {
            try {
              const layoutPos = batchLayout.get(addNodeCounter);
              const targetPosition =
                action.position?.x !== undefined ? action.position : layoutPos;
              addNodeCounter++;

              const newId = await onAddNode(
                action.type,
                action.provider || activeProvider,
                action.config,
                action.title,
                targetPosition
              );
              createdNodeIds.push(newId);
              executedActions.push(action);
            } catch (err) {
              console.warn('[Maestro] Error executing add_node:', err);
            }
          } else if (action.action === 'connect_nodes') {
            try {
              const fromId = resolveNodeId(action.from, createdNodeIds);
              const toId = resolveNodeId(action.to, createdNodeIds);
              if (fromId && toId) {
                const connected = onConnectNodes(fromId, toId, action.fromPort, action.toPort);
                if (connected) executedActions.push(action);
              }
            } catch (err) {
              console.warn('[Maestro] Error executing connect_nodes:', err);
            }
          } else if (action.action === 'update_node') {
            try {
              const targetId = resolveNodeId(action.nodeId, createdNodeIds);
              if (targetId) {
                onUpdateNode(targetId, {
                  title: action.title,
                  subtitle: action.subtitle,
                  config: action.config,
                });
                executedActions.push(action);
              }
            } catch (err) {
              console.warn('[Maestro] Error executing update_node:', err);
            }
          } else if (action.action === 'delete_node') {
            try {
              const targetNode = nodes.find((n) => n.id === action.nodeId);
              if (targetNode) {
                onDeleteNode(targetNode);
                executedActions.push(action);
              }
            } catch (err) {
              console.warn('[Maestro] Error executing delete_node:', err);
            }
          } else if (action.action === 'open_url') {
            try {
              if (action.url && onOpenUrl) {
                await onOpenUrl(action.url, resolveNodeId(action.nodeId || '', createdNodeIds) || undefined);
                executedActions.push(action);
              }
            } catch (err) {
              console.warn('[Maestro] Error executing open_url:', err);
            }
          } else if (action.action === 'open_project') {
            try {
              if (action.projectName && onOpenProject) {
                await onOpenProject(action.projectName, resolveNodeId(action.nodeId || '', createdNodeIds) || undefined);
                executedActions.push(action);
              }
            } catch (err) {
              console.warn('[Maestro] Error executing open_project:', err);
            }
          } else if (action.action === 'run_workflow') {
            try {
              onRunWorkflow();
              executedActions.push(action);
            } catch (err) {
              console.warn('[Maestro] Error executing run_workflow:', err);
            }
          }
        }
      }

      // 5. Append Assistant Message
      const assistantMessage: MaestroChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        type: 'assistant',
        text: cleanText || rawResponse,
        providerId: activeProvider,
        timestamp: Date.now(),
        executedActions: executedActions.length > 0 ? executedActions : undefined,
      };

      setSessions((prev) =>
        prev.map((s, idx) =>
          idx === activeSessionIndex
            ? {
                ...s,
                updatedAt: Date.now(),
                history: [...s.history, assistantMessage],
              }
            : s
        )
      );

      if (executedActions.length > 0) {
        onToast?.(`Maestro aplicou ${executedActions.length} ações no fluxo.`);
      }
    } catch (err: any) {
      console.error('[Maestro] Send prompt error:', err);
      const errorMessage: MaestroChatMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'error',
        text: `Erro ao consultar o Maestro: ${err?.message || String(err)}`,
        timestamp: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s, idx) =>
          idx === activeSessionIndex
            ? { ...s, history: [...s.history, errorMessage] }
            : s
        )
      );
    } finally {
      setIsThinking(false);
    }
  };

  // Helper to render markdown and code blocks matching IDE
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'text',
        content: match[2].replace(/\n$/, ''),
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, lineHeight: '19px' }}>
        {parts.map((p, pIdx) => {
          if (p.type === 'code') {
            return (
              <pre
                key={pIdx}
                style={{
                  background: isEffectiveDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.05)',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflowX: 'auto',
                  border: `1px solid ${border}`,
                  margin: '4px 0',
                }}
              >
                <code>{p.content}</code>
              </pre>
            );
          }
          return (
            <span key={pIdx} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {p.content}
            </span>
          );
        })}
      </div>
    );
  };

  // Model list for the current provider
  const availableModelsForProvider =
    activeModels[activeProvider]?.models ||
    AI_PROVIDERS.find((p) => p.id === activeProvider)?.models?.map((m) => ({
      id: m.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      label: m,
    })) ||
    [];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 51, // Exact 5px spacing from the 46px header
        right: 5, // Exact 5px spacing from the right border
        bottom: 5, // Exact 5px spacing from the bottom border
        width: panelWidth,
        minWidth: MIN_MAESTRO_WIDTH,
        maxWidth: 'calc(100vw - 60px)',
        backgroundColor: isEffectiveDark ? '#101010' : '#ffffff',
        background: isEffectiveDark
          ? `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.2)} 0%, #101010 100%), #101010`
          : `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.22)} 0%, #ffffff 100%), #ffffff`,
        borderRadius: 10,
        border: 'none',
        outline: 'none',
        boxShadow: isEffectiveDark
          ? '0 16px 40px rgba(0, 0, 0, 0.7)'
          : '0 16px 40px rgba(0, 0, 0, 0.15)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        gap: 10,
        display: 'flex',
        zIndex: 1200,
        transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 20px))',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        visibility: isOpen ? 'visible' : 'hidden',
        transition: isResizing
          ? 'none'
          : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, visibility 0.28s',
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Lateral Horizontal Resize Handle (Left edge) */}
      <div
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={handleResizeDoubleClick}
        onMouseEnter={() => setIsHandleHovered(true)}
        onMouseLeave={() => setIsHandleHovered(false)}
        title="Arraste na lateral para redimensionar (duplo clique para restaurar 440px)"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: isResizing || isHandleHovered ? 3 : 2,
            height: isResizing || isHandleHovered ? '60%' : '30%',
            maxHeight: 120,
            borderRadius: 3,
            background: isResizing
              ? chatAccentColor
              : isHandleHovered
              ? hexToRgba(chatAccentColor, 0.8)
              : 'transparent',
            transition: isResizing ? 'none' : 'all 0.18s ease',
          }}
        />
      </div>

      {/* 1. Header: Stacked Icons + AI Logo + Maestro Title + Model Badge + Action Buttons + Close */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          padding: '2px 4px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Sessions & History Button */}
          <div
            onClick={() => setChatHistoryPopupOpen((prev) => !prev)}
            title="Sessões & Histórico do Maestro"
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '2px 3px',
              borderRadius: 6,
              background: chatHistoryPopupOpen ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={11} color={textSecondary} />
            </div>
          </div>

          {/* Active AI Logo, Name & Model Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AuraDevIcon size={17} />
            <div
              style={{
                color: textPrimary,
                fontSize: 13,
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                letterSpacing: '-0.2px',
              }}
            >
              Maestro
            </div>

            {/* Model Badge */}
            <div
              ref={modelDropdownRef}
              style={{ position: 'relative' }}
            >
              <div
                onClick={() => setModelDropdown((prev) => !prev)}
                title="Modelo ativo do Maestro. Clique para alterar."
                style={{
                  fontSize: 10.5,
                  color: chatAccentColor,
                  background: 'transparent',
                  padding: '1px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <span>{formatModelDisplayName(activeModelName) || activeModelName}</span>
                <ChevronDown size={10} />
              </div>

              {/* Model Dropdown Menu */}
              {modelDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: bgCardSecondary,
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                    padding: 4,
                    minWidth: 150,
                    zIndex: 9999,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {availableModelsForProvider.map((m) => {
                    const isSelected =
                      m.label.toLowerCase() === activeModelName.toLowerCase() ||
                      m.id.toLowerCase() === activeModelName.toLowerCase();
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setActiveModelName(m.label);
                          onSelectModel?.({ id: m.id, label: m.label }, activeProvider);
                          setModelDropdown(false);
                          onToast?.(`Modelo alterado para ${m.label}`);
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 5,
                          fontSize: 11,
                          color: isSelected ? chatAccentColor : textPrimary,
                          background: isSelected
                            ? hexToRgba(chatAccentColor, 0.12)
                            : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{formatModelDisplayName(m.label)}</span>
                        {isSelected && <Check size={11} color={chatAccentColor} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls: Back/Forward Sessions + More Menu + Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Back Session */}
          <button
            onClick={() => setActiveSessionIndex((prev) => Math.min(sessions.length - 1, prev + 1))}
            disabled={activeSessionIndex >= sessions.length - 1}
            title="Conversa anterior"
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: activeSessionIndex >= sessions.length - 1 ? 'default' : 'pointer',
              opacity: activeSessionIndex >= sessions.length - 1 ? 0.35 : 1,
              padding: '4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={13} />
          </button>

          {/* Forward Session */}
          <button
            onClick={() => setActiveSessionIndex((prev) => Math.max(0, prev - 1))}
            disabled={activeSessionIndex <= 0}
            title="Próxima conversa"
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: activeSessionIndex <= 0 ? 'default' : 'pointer',
              opacity: activeSessionIndex <= 0 ? 0.35 : 1,
              padding: '4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowRight size={13} />
          </button>

          {/* More Actions Menu */}
          <div ref={actionsMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setChatActionsMenuOpen((prev) => !prev)}
              title="Mais opções do Maestro"
              style={{
                background: chatActionsMenuOpen ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                color: chatActionsMenuOpen ? textPrimary : textSecondary,
                cursor: 'pointer',
                padding: '4px 5px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MoreHorizontal size={14} />
            </button>

            {chatActionsMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  background: bgCardSecondary,
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  padding: 4,
                  minWidth: 140,
                  zIndex: 10000,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div
                  onClick={() => {
                    setChatActionsMenuOpen(false);
                    setChatHistoryPopupOpen(true);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Clock size={13} color={chatAccentColor} />
                  <span>Ver Histórico</span>
                </div>
                <div
                  onClick={() => {
                    setChatActionsMenuOpen(false);
                    try {
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
                      onToast?.('Conversas do Maestro salvas localmente.');
                    } catch {}
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Save size={13} color={textSecondary} />
                  <span>Salvar</span>
                </div>
                <div
                  onClick={handleExportMarkdown}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: textPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Download size={13} color={textSecondary} />
                  <span>Exportar (.md)</span>
                </div>
                <div
                  onClick={handleClearCurrentSession}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Trash2 size={13} color="#ef4444" />
                  <span>Limpar</span>
                </div>
              </div>
            )}
          </div>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            title="Fechar Maestro"
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              marginLeft: 2,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = textPrimary)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = textSecondary)}
          >
            <X size={15} />
          </button>
        </div>

        {/* Sessions Popup */}
        {chatHistoryPopupOpen && (
          <div
            style={{
              position: 'absolute',
              top: 34,
              left: 0,
              width: 270,
              background: bgCardSecondary,
              borderRadius: 10,
              border: `1px solid ${border}`,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 99999,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textPrimary, fontSize: 12, fontWeight: 500 }}>
                <MessageSquare size={13} color={chatAccentColor} />
                <span>Conversas do Maestro</span>
              </div>
              <button
                type="button"
                onClick={handleCreateNewSession}
                style={{
                  background: chatAccentColor,
                  border: 'none',
                  color: getContrastTextColor(chatAccentColor),
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 10.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Plus size={11} />
                <span>Novo Chat</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 180, overflowY: 'auto' }}>
              {sessions.map((s, idx) => {
                const isActive = idx === activeSessionIndex;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      background: isActive
                        ? hexToRgba(chatAccentColor, 0.15)
                        : isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.03)',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          color: textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {s.title}
                      </span>
                      <span style={{ fontSize: 9.5, color: textSecondary }}>
                        {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {s.history.length} msgs
                      </span>
                    </div>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title="Excluir sessão"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: textSecondary,
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Scrollable Messages History Area with Watermark */}
      <div
        ref={scrollRef}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          background: 'transparent',
          borderRadius: 8,
          padding: '4px 2px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontFamily: 'Poppins, sans-serif',
          fontSize: 12,
          position: 'relative',
        }}
      >
        {/* Background Watermark Icon when conversation has no messages */}
        {(!currentSession?.history || currentSession.history.length === 0) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 0,
              userSelect: 'none',
              gap: 14,
            }}
          >
            <div style={{ opacity: isEffectiveDark ? 0.08 : 0.06 }}>
              <AuraDevIcon size={130} />
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips when conversation is empty */}
        {(!currentSession?.history || currentSession.history.length === 0) && (
          <div
            style={{
              marginTop: 'auto',
              marginBottom: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 2,
            }}
          >
            <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, paddingLeft: 4 }}>
              Sugestões rápidas do Maestro:
            </span>
            <button
              onClick={() =>
                handleSendPrompt('Crie um pipeline completo com um bloco de prompt, um agente revisor de código e o modelo sonnet conectados.')
              }
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: `1px solid ${border}`,
                borderRadius: 6,
                padding: '6px 10px',
                textAlign: 'left',
                color: textPrimary,
                fontSize: 11.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={12} color={chatAccentColor} />
              <span>Criar pipeline com Prompt + Agente + Modelo</span>
            </button>
            <button
              onClick={() => handleSendPrompt('Confira as issues abertas dos meus projetos no GitHub e me dê um resumo.')}
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: `1px solid ${border}`,
                borderRadius: 6,
                padding: '6px 10px',
                textAlign: 'left',
                color: textPrimary,
                fontSize: 11.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FolderGit2 size={12} color="#38bdf8" />
              <span>Conferir issues dos projetos GitHub</span>
            </button>
            <button
              onClick={() => handleSendPrompt('Adicione um bloco de ferramenta CLI para rodar git status e conecte ao agente.')}
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: `1px solid ${border}`,
                borderRadius: 6,
                padding: '6px 10px',
                textAlign: 'left',
                color: textPrimary,
                fontSize: 11.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Terminal size={12} color="#22c55e" />
              <span>Adicionar ferramenta CLI ao fluxo</span>
            </button>
          </div>
        )}

        {/* Message Bubbles */}
        {currentSession?.history?.map((msg, idx) => {
          if (msg.type === 'user') {
            return (
              <div
                key={msg.id || idx}
                style={{
                  alignSelf: 'flex-end',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  maxWidth: '92%',
                }}
              >
                <div
                  style={{
                    background: hexToRgba(chatAccentColor, 0.15),
                    color: textPrimary,
                    padding: '8px 12px',
                    borderRadius: '8px 2px 8px 8px',
                    wordBreak: 'break-word',
                    lineHeight: '18px',
                    fontSize: 12,
                  }}
                >
                  {msg.text}
                </div>
                <img
                  src={currentUser?.avatarUrl || avatarImg}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.dataset.triedFallback) {
                      target.dataset.triedFallback = 'true';
                      target.src = avatarImg;
                    }
                  }}
                  alt={currentUser?.login || 'User'}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    marginTop: 2,
                    objectFit: 'cover',
                  }}
                />
              </div>
            );
          } else if (msg.type === 'error') {
            return (
              <div
                key={msg.id || idx}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '2px solid #ef4444',
                  padding: '8px 10px',
                  borderRadius: '0 6px 6px 0',
                  color: '#ef4444',
                  fontSize: 11.5,
                  lineHeight: '17px',
                }}
              >
                {msg.text}
              </div>
            );
          } else {
            return (
              <div
                key={msg.id || idx}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  maxWidth: '96%',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {renderAiIcon(msg.providerId || activeProvider, 14)}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    flex: '1 1 auto',
                    minWidth: 0,
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {/* Executed Actions Badge Accordion */}
                  {msg.executedActions && msg.executedActions.length > 0 && (
                    <div
                      style={{
                        background: isEffectiveDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                        border: `1px solid ${isEffectiveDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`,
                        borderRadius: 6,
                        padding: '6px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>
                        <Wand2 size={12} />
                        <span>Ações aplicadas no canvas ({msg.executedActions.length}):</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {msg.executedActions.map((act, actIdx) => (
                          <div
                            key={actIdx}
                            style={{
                              fontSize: 10,
                              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.7)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: textPrimary,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{act.action}:</span>
                            {'type' in act && <span>{act.type}</span>}
                            {'title' in act && act.title && <span>"{act.title}"</span>}
                            {'from' in act && (
                              <span>
                                {act.from} ➔ {act.to}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Bubble Content */}
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                      color: textPrimary,
                      padding: '10px 12px',
                      borderRadius: 8,
                      wordBreak: 'break-word',
                      fontSize: 12,
                    }}
                  >
                    {renderMessageContent(msg.text)}
                  </div>

                  {/* Footer: Timestamp & Copy Button */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 10.5,
                      color: textSecondary,
                      paddingLeft: 2,
                    }}
                  >
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <button
                      onClick={() => handleCopyMessage(msg.text, idx)}
                      title="Copiar resposta"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedIdx === idx ? '#22c55e' : textSecondary,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {copiedIdx === idx ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        })}

        {/* AI Thinking Indicator (3 bouncing dots) */}
        {isThinking && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {renderAiIcon(activeProvider, 14)}
            </div>
            <div
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                padding: '7px 11px',
                borderRadius: '2px 8px 8px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 3.5,
              }}
            >
              <span className="thinking-dot" style={{ animationDelay: '0ms', backgroundColor: chatAccentColor }} />
              <span className="thinking-dot" style={{ animationDelay: '180ms', backgroundColor: chatAccentColor }} />
              <span className="thinking-dot" style={{ animationDelay: '360ms', backgroundColor: chatAccentColor }} />
            </div>
          </div>
        )}
      </div>

      {/* 3. Floating Bottom Card: Input & Model Selection (Exact IDE Style) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt();
        }}
        style={{
          alignSelf: 'stretch',
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 10,
          border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          outline: 'none',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          display: 'flex',
          overflow: 'visible',
          position: 'relative',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {/* Typing Area */}
        <div style={{ alignSelf: 'stretch', padding: '10px 12px 6px 12px', display: 'flex', flexDirection: 'column' }}>
          <textarea
            ref={textareaRef}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            placeholder="Comande o Maestro: crie nós, conecte, ajuste prompts, confira issues do git..."
            rows={2}
            disabled={isThinking}
            style={{
              width: '100%',
              minHeight: 44,
              maxHeight: 120,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: textPrimary,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              lineHeight: '18px',
            }}
          />
        </div>

        {/* Bottom Row Controls: Provider Selector + Model Selector + Send Button */}
        <div
          style={{
            alignSelf: 'stretch',
            padding: '6px 10px',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
            justifyContent: 'space-between',
            alignItems: 'center',
            display: 'flex',
            position: 'relative',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            gap: 6,
          }}
        >
          {/* Left Controls: Orchestrator + AI Provider + Model Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0 }}>
            {/* Orchestrator Toggle Button */}
            <div
              onClick={() => setIsOrchestratorActive((prev) => !prev)}
              title={isOrchestratorActive ? 'Orquestrador Ativo' : 'Orquestrador Inativo'}
              style={{
                width: 24,
                height: 24,
                borderRadius: 5,
                background: isOrchestratorActive
                  ? chatAccentColor
                  : isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(0, 0, 0, 0.06)',
                color: isOrchestratorActive ? getContrastTextColor(chatAccentColor) : textSecondary,
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Wand2 size={13} />
            </div>

            {/* AI Provider Dropdown */}
            <div ref={providerDropdownRef} style={{ position: 'relative' }}>
              <div
                onClick={() => setProviderDropdown((prev) => !prev)}
                title="Trocar provedor de IA"
                style={{
                  height: 24,
                  padding: '0 6px',
                  borderRadius: 5,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
              >
                {renderAiIcon(activeProvider, 13)}
                <span style={{ fontSize: 11, color: textPrimary, fontWeight: 500 }}>
                  {AI_PROVIDERS.find((p) => p.id === activeProvider)?.name || activeProvider}
                </span>
                <ChevronDown size={10} color={textSecondary} />
              </div>

              {providerDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: 0,
                    background: bgCardSecondary,
                    border: `1px solid ${border}`,
                    borderRadius: 8,
                    padding: 4,
                    minWidth: 150,
                    zIndex: 99999,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {AI_PROVIDERS.map((p) => {
                    const isSelected = p.id === activeProvider;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveProvider(p.id);
                          onSelectAiProvider?.(p.id);
                          setProviderDropdown(false);
                          const firstModel = p.models?.[0] || 'Default';
                          setActiveModelName(firstModel);
                          onToast?.(`Provedor alterado para ${p.name}`);
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 5,
                          fontSize: 11,
                          color: isSelected ? chatAccentColor : textPrimary,
                          background: isSelected ? hexToRgba(chatAccentColor, 0.12) : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {renderAiIcon(p.id, 13)}
                        <span>{p.name}</span>
                        {isSelected && <Check size={11} style={{ marginLeft: 'auto' }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: AI Quota Badge + Circular Send Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* AI Usage Quota Badge */}
            <div
              onClick={() => setQuotaTooltipOpen((prev) => !prev)}
              title="Quotas de IA (Diário / Semanal)"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                lineHeight: 1.05,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: chatAccentColor }}>D</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: textPrimary }}>100%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: chatAccentColor }}>S</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: textPrimary }}>100%</span>
              </div>
            </div>

            {/* Circular Send / Stop Button */}
            {isThinking ? (
              <button
                type="button"
                onClick={onCancelWorkflow}
                title="Interromper execução"
                style={{
                  width: 24,
                  height: 24,
                  background: '#ef4444',
                  borderRadius: 61,
                  border: 'none',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ffffff' }} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={promptInput.trim().length === 0}
                title="Enviar para o Maestro"
                style={{
                  width: 24,
                  height: 24,
                  background: promptInput.trim().length > 0 ? chatAccentColor : isEffectiveDark ? '#333333' : '#e2e8f0',
                  borderRadius: 61,
                  border: 'none',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: promptInput.trim().length > 0 ? getContrastTextColor(chatAccentColor) : isEffectiveDark ? '#666' : '#94a3b8',
                  cursor: promptInput.trim().length > 0 ? 'pointer' : 'default',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <ArrowRight size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
