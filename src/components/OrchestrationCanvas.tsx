import { extractAgentOpenUrl, withScheme } from '../utils/agentUrl';
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
  Pause,
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
  ChevronLeft,
  Tag,
  FolderCode,
  FolderGit2,
  Code2,
  DownloadCloud,
} from 'lucide-react';
import {
  ClaudeIcon,
  AntigravityIcon,
  GeminiIcon,
  OllamaIcon,
  CodexIcon,
  AuraDevIcon,
} from './icons/AiProviderIcons';
import { AI_PROVIDERS as SYSTEM_AI_PROVIDERS } from '../constants/ai';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { NativeXTerm } from './NativeXTerm';
import { OrchestrationCommandPalette, type OrchestrationPaletteItem } from './OrchestrationCommandPalette';
import { OrchestrationMaestroPanel } from './OrchestrationMaestroPanel';
import { OrchestrationSimulatorPanel } from './OrchestrationSimulatorPanel';
import { OrchestrationBrowserNode, type BrowserTab } from './OrchestrationBrowserNode';
import { OrchestrationProjectNode } from './OrchestrationProjectNode';
import { fetchAllGitProjects, cloneGitRepository, type GitProjectItem } from '../utils/gitProjects';
import { topologicalSortWorkflow, wouldCreateCycle } from '../utils/orchestration-graph';
import {
  allocateUniqueDevUrl,
  detectProjectPort,
  deduplicateProjectNodesDevUrls,
  scanSystemOccupiedPorts,
  extractPortFromUrl,
} from '../utils/projectDevUrl';
import {
  findProjectsInText,
  isProjectOpenIntent,
  resolveTargetProjectsForNode,
  type ProjectCandidate,
} from '../utils/projectMatcher';

// Module constant for PTY session names scoped by floor
export const ORCHESTRATION_CLI_SESSION_PREFIX = 'orch-cli-';

export const getOrchestrationCliSessionId = (floorId: string, nodeId: string): string => {
  return `${ORCHESTRATION_CLI_SESSION_PREFIX}${floorId}-${nodeId}`;
};

export const parseOrchestrationCliSessionId = (
  sessionId: string
): { floorId: string; nodeId: string } | null => {
  if (!sessionId.startsWith(ORCHESTRATION_CLI_SESSION_PREFIX)) return null;
  const rest = sessionId.slice(ORCHESTRATION_CLI_SESSION_PREFIX.length);
  const dashIdx = rest.indexOf('-');
  if (dashIdx === -1) {
    return { floorId: '', nodeId: rest };
  }
  return {
    floorId: rest.slice(0, dashIdx),
    nodeId: rest.slice(dashIdx + 1),
  };
};

// ============================================================================
// TYPES
// ============================================================================

export type NodeType = 'trigger' | 'agent' | 'model' | 'tool' | 'memory' | 'webview' | 'ide' | 'project';
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
  status: 'ready' | 'idle' | 'running' | 'success' | 'failed' | 'disabled' | 'cancelled';
  provider?: AiProviderId;
  needsAttention?: boolean;
  roleId?: string;
  isMaestro?: boolean;
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
    tabs?: BrowserTab[];
    activeTabId?: string;
    projectName?: string;
    projectPath?: string;
    gitBranch?: string;
    devUrl?: string;
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

export interface AgentRole {
  id: string;
  name: string;
  color: string;
  instructions: string;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  fromSide?: 'right' | 'bottom' | 'top';
  fromRatio?: number;
  toNodeId: string;
  toPort: string;
  toSide?: 'left' | 'top' | 'bottom' | 'right';
  toRatio?: number;
  label?: string;
  labelRatio?: number;
  color?: string;
  isActive?: boolean;
  autoRelay?: boolean;
}

// Helper: Encontra todos os nós de navegador ('webview') conectados a um determinado nó (bidirecional)
export const getConnectedBrowserNodes = (
  nodeId: string,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[]
): WorkflowNode[] => {
  const connectedNodeIds = new Set<string>();
  allEdges.forEach((e) => {
    if (e.fromNodeId === nodeId) {
      connectedNodeIds.add(e.toNodeId);
    } else if (e.toNodeId === nodeId) {
      connectedNodeIds.add(e.fromNodeId);
    }
  });
  return allNodes.filter((n) => n.type === 'webview' && connectedNodeIds.has(n.id));
};

// Helper: Encontra todos os nós de projeto ('project') conectados a um determinado nó (bidirecional)
export const getConnectedProjectNodes = (
  nodeId: string,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[]
): WorkflowNode[] => {
  const connectedNodeIds = new Set<string>();
  allEdges.forEach((e) => {
    if (e.fromNodeId === nodeId) {
      connectedNodeIds.add(e.toNodeId);
    } else if (e.toNodeId === nodeId) {
      connectedNodeIds.add(e.fromNodeId);
    }
  });
  return allNodes.filter((n) => n.type === 'project' && connectedNodeIds.has(n.id));
};

// Helper: Extrai a ação/atividade legível em tempo real a partir de dados brutos do stream CLI da IA
// Glifos de spinner/TUI (braille, ⋮, ✻, ●...) que as CLIs desenham antes do texto; não fazem parte da atividade
const ACTIVITY_GLYPHS = /^[\s*•\->#`⠀-⣿⋮⁝⁞✻✽✶✢✳·●○◐◓◑◒⏺⎿▪▸►→]+/;
// "Reading" sozinho (fragmento de redesenho do TUI) não informa nada
const isGenericActivity = (t: string): boolean =>
  t.replace(/[.…]+$/, '').trim().split(/\s+/).length < 2 && !/[(\/]/.test(t);
// Chave estável para comparar atividades: ignora números, tempos e pontuação
export const activityKey = (t: string): string =>
  t.replace(/\(\d+s[^)]*\)|\d+|[.…]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const extractAiActivityText = (rawChunk: string): string | null => {
  if (!rawChunk || typeof rawChunk !== 'string') return null;

  // 1. Remove códigos de escape ANSI
  const plain = rawChunk
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/[\r\x00-\x08\x0B-\x1C\x7F]/g, '');

  if (!plain.trim()) return null;

  const rawLines = plain.split('\n');

  // Filtra banners, cabeçalhos, linhas de prompt e caracteres de caixas
  const cleanLines = rawLines
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.length < 2) return false;
      if (line.includes('DevFlow IA CLI') || line.includes('Prompt:') || line.includes('cd "')) return false;
      if (/^[╭╰│─━┌┐└┘├┤┬┴┼═║╔╗╚╝\s\-_=]+$/.test(line)) return false;
      if (/^[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+\s+.*[%$#]\s*$/.test(line)) return false;
      if (line === '%' || line === '$' || line === '#') return false;
      return true;
    });

  if (cleanLines.length === 0) return null;

  // 1ª prioridade: busca verbos de ação/status nas linhas mais recentes
  for (let i = cleanLines.length - 1; i >= 0; i--) {
    let line = cleanLines[i];
    line = line.replace(ACTIVITY_GLYPHS, '').trim();
    if (line.length < 3) continue;

    const actionMatch = line.match(
      /^(analisando|lendo|editando|executando|criando|buscando|verificando|pensando|gerando|processando|resolvendo|consultando|organizando|escrevendo|planejando|thinking|reading|editing|running|creating|searching|writing|updating|fetching|calling|tool|action|step)\b/i
    );
    if (actionMatch) {
      let cleaned = line.replace(/^[\s:–—-]+/, '').trim();
      if (cleaned.length > 95) cleaned = cleaned.slice(0, 92) + '...';
      if (isGenericActivity(cleaned)) continue;
      return cleaned;
    }
  }

  // 2ª prioridade: linhas contendo palavras-chave de ação
  for (let i = cleanLines.length - 1; i >= 0; i--) {
    let line = cleanLines[i];
    line = line.replace(ACTIVITY_GLYPHS, '').trim();
    if (line.length < 4) continue;

    if (
      /(analisando|lendo|editando|executando|criando|buscando|verificando|pensando|gerando|thinking|reading|editing|running|searching|writing)/i.test(
        line
      )
    ) {
      let cleaned = line.replace(/^[\s:–—-]+/, '').trim();
      if (cleaned.length > 95) cleaned = cleaned.slice(0, 92) + '...';
      if (isGenericActivity(cleaned)) continue;
      return cleaned;
    }
  }

  // 3ª prioridade: última linha informativa significativa
  for (let i = cleanLines.length - 1; i >= 0; i--) {
    let line = cleanLines[i];
    line = line.replace(ACTIVITY_GLYPHS, '').trim();
    if (line.length < 4) continue;
    if (/^[{}();]+$/.test(line)) continue;
    let cleaned = line.replace(/^[\s:–—-]+/, '').trim();
    if (cleaned.length > 95) cleaned = cleaned.slice(0, 92) + '...';
    if (isGenericActivity(cleaned)) continue;
    return cleaned;
  }

  return null;
};

// Helper: Determina o lado ótimo para o tooltip do card (lado com menos links conectados)
export const getOptimalTooltipSide = (
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
  getNodeDims: (node: WorkflowNode) => { width: number; height: number }
): 'top' | 'bottom' | 'left' | 'right' => {
  const { width, height } = getNodeDims(node);
  const sideCounts: Record<'top' | 'bottom' | 'left' | 'right', number> = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };

  const nodeMap = new Map<string, WorkflowNode>(allNodes.map((n) => [n.id, n]));

  allEdges.forEach((edge) => {
    // 1. Link saindo deste nó
    if (edge.fromNodeId === node.id) {
      if (edge.fromSide === 'top') {
        sideCounts.top++;
      } else if (edge.fromSide === 'bottom') {
        sideCounts.bottom++;
      } else if (edge.fromSide === 'left') {
        sideCounts.left++;
      } else if (edge.fromSide === 'right') {
        sideCounts.right++;
      } else {
        const targetNode = nodeMap.get(edge.toNodeId);
        if (targetNode) {
          const dy = targetNode.y - node.y;
          const dx = targetNode.x - node.x;
          if (dy > height * 0.65 && Math.abs(dx) < 320) {
            sideCounts.bottom++;
          } else if (dy < -height * 0.65 && Math.abs(dx) < 320) {
            sideCounts.top++;
          } else if (dx < -width * 0.5) {
            sideCounts.left++;
          } else {
            sideCounts.right++;
          }
        } else {
          sideCounts.right++;
        }
      }
    }

    // 2. Link chegando neste nó
    if (edge.toNodeId === node.id) {
      if (edge.toSide === 'top') {
        sideCounts.top++;
      } else if (edge.toSide === 'bottom') {
        sideCounts.bottom++;
      } else if (edge.toSide === 'right') {
        sideCounts.right++;
      } else if (edge.toSide === 'left') {
        sideCounts.left++;
      } else {
        const sourceNode = nodeMap.get(edge.fromNodeId);
        if (sourceNode) {
          const dy = sourceNode.y - node.y;
          const dx = sourceNode.x - node.x;
          if (dy < -height * 0.65 && Math.abs(dx) < 320) {
            sideCounts.top++;
          } else if (dy > height * 0.65 && Math.abs(dx) < 320) {
            sideCounts.bottom++;
          } else if (dx > width * 0.5) {
            sideCounts.right++;
          } else {
            sideCounts.left++;
          }
        } else {
          sideCounts.left++;
        }
      }
    }
  });

  // Encontra a quantidade mínima de conexões em cada lado
  const minCount = Math.min(
    sideCounts.top,
    sideCounts.bottom,
    sideCounts.left,
    sideCounts.right
  );

  const sidesWithMin = (['top', 'bottom', 'left', 'right'] as const).filter(
    (side) => sideCounts[side] === minCount
  );

  // Evita topo se muito próximo da borda superior do canvas (< 80px)
  if (sidesWithMin.includes('top') && node.y < 80 && sidesWithMin.includes('bottom')) {
    return 'bottom';
  }

  // Evita esquerda se muito colado à margem esquerda (< 140px)
  if (sidesWithMin.includes('left') && node.x < 140) {
    if (sidesWithMin.includes('top') && node.y >= 80) return 'top';
    if (sidesWithMin.includes('bottom')) return 'bottom';
    if (sidesWithMin.includes('right')) return 'right';
  }

  // Ordem de preferência: top > bottom > right > left
  for (const preferred of ['top', 'bottom', 'right', 'left'] as const) {
    if (sidesWithMin.includes(preferred)) {
      return preferred;
    }
  }

  return 'top';
};

// Dicionário de serviços e plataformas conhecidas na web
export const KNOWN_SERVICES: Record<
  string,
  { home: string; search?: (q: string) => string }
> = {
  youtube: {
    home: 'https://www.youtube.com',
    search: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  github: {
    home: 'https://www.github.com',
    search: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
  },
  google: {
    home: 'https://www.google.com',
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  twitter: {
    home: 'https://x.com',
    search: (q) => `https://x.com/search?q=${encodeURIComponent(q)}`,
  },
  x: {
    home: 'https://x.com',
    search: (q) => `https://x.com/search?q=${encodeURIComponent(q)}`,
  },
  linkedin: {
    home: 'https://www.linkedin.com',
    search: (q) => `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(q)}`,
  },
  instagram: {
    home: 'https://www.instagram.com',
  },
  reddit: {
    home: 'https://www.reddit.com',
    search: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  },
  wikipedia: {
    home: 'https://www.wikipedia.org',
    search: (q) => `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
  twitch: {
    home: 'https://www.twitch.tv',
  },
  netflix: {
    home: 'https://www.netflix.com',
  },
  spotify: {
    home: 'https://open.spotify.com',
    search: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  },
  chatgpt: {
    home: 'https://chatgpt.com',
  },
  claude: {
    home: 'https://claude.ai',
  },
  amazon: {
    home: 'https://www.amazon.com',
    search: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  },
  'mercado livre': {
    home: 'https://www.mercadolivre.com.br',
    search: (q) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`,
  },
  mercadolivre: {
    home: 'https://www.mercadolivre.com.br',
    search: (q) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`,
  },
  figma: {
    home: 'https://www.figma.com',
  },
  g1: {
    home: 'https://g1.globo.com',
    search: (q) => `https://g1.globo.com/busca/?q=${encodeURIComponent(q)}`,
  },
  globo: {
    home: 'https://www.globo.com',
  },
  uol: {
    home: 'https://www.uol.com.br',
  },
  apple: {
    home: 'https://www.apple.com',
  },
  microsoft: {
    home: 'https://www.microsoft.com',
  },
  vercel: {
    home: 'https://vercel.com',
  },
  maps: {
    home: 'https://maps.google.com',
    search: (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`,
  },
  tradutor: {
    home: 'https://translate.google.com',
    search: (q) => `https://translate.google.com/?text=${encodeURIComponent(q)}`,
  },
  noticias: {
    home: 'https://news.google.com',
    search: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  },
};

// Helper: Extrai ou resolve a URL destinada ao componente de navegador interno
export function resolveBrowserUrlFromInput(
  upstreamInput?: string,
  nodeConfigUrl?: string,
  candidateProjects: ProjectCandidate[] = []
): string {
  let targetUrl = '';
  if (upstreamInput) {
    const rawInput = upstreamInput
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .trim();

    // 1. URL explícita (http://, https://, www.)
    const urlMatch = rawInput.match(/(?:https?:\/\/|www\.)[^\s"'<>\x00-\x1F\x7F]+/i);
    if (urlMatch) {
      targetUrl = urlMatch[0]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      if (targetUrl.startsWith('www.')) targetUrl = `https://${targetUrl}`;
      return targetUrl;
    }

    // 2. Localhost ou domínio .localhost (Portless) com ou sem porta (ex: localhost:3000, 127.0.0.1:5173, myapp.localhost:1355, app.localhost)
    const localhostMatch = rawInput.match(/\b(?:(?:[a-zA-Z0-9_-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s"'<>\x00-\x1F\x7F]*)?\b/i);
    if (localhostMatch) {
      const cleanLocal = localhostMatch[0]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      return `http://${cleanLocal}`;
    }

    // 3. Domínio explícito no texto (ex: vitejs.dev, apple.com, g1.globo.com, devflow.org/docs)
    const domainMatch = rawInput.match(
      /\b([a-zA-Z0-9-]+\.(?:com\.br|gov\.br|org\.br|edu\.br|com|org|net|io|dev|app|ai|me|tv|co|uk|de|fr|xyz|tech)(?:\/[^\s"'<>\x00-\x1F\x7F]*)?)\b/i
    );
    if (domainMatch) {
      const cleanDom = domainMatch[1]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      return `https://${cleanDom}`;
    }

    // 4. Busca direcionada a um serviço específico (ex: "pesquisar x no youtube", "buscar repo no github")
    const serviceSearchMatch = rawInput.match(
      /(?:pesquisar|buscar|procurar)(?:\s+(?:por|sobre))?\s+([^]+?)\s+(?:no|em|na)\s+([a-zA-Z0-9\s]+?)(?:\s+no\s+navegador|\.|$)/i
    );
    if (serviceSearchMatch) {
      const q = serviceSearchMatch[1].trim();
      const sName = serviceSearchMatch[2].trim().toLowerCase();
      const svc = KNOWN_SERVICES[sName];
      if (svc?.search && q) {
        return svc.search(q);
      }
    }

    // 5. Menção a serviço conhecido (ex: "Abra o youtube no navegador.", "Acesse o github", "abrir google")
    for (const [key, svc] of Object.entries(KNOWN_SERVICES)) {
      const svcRegex = new RegExp(`\\b${key}\\b`, 'i');
      if (svcRegex.test(rawInput)) {
        // Verifica se há pedido de busca associado na frase (ex: "abra o youtube e busque rock")
        const associatedSearch = rawInput.match(
          /(?:pesquisar|buscar|procurar)(?:\s+(?:por|sobre))?\s+[:"']?([^"'\n\r]+)/i
        );
        if (associatedSearch && associatedSearch[1]?.trim() && svc.search) {
          const cleanQ = associatedSearch[1]
            .trim()
            .replace(new RegExp(`\\s+(?:no|em|na)\\s+${key}`, 'i'), '')
            .replace(/\s+no\s+navegador/i, '')
            .trim();
          if (cleanQ && !new RegExp(`^${key}$`, 'i').test(cleanQ)) {
            return svc.search(cleanQ);
          }
        }
        return svc.home;
      }
    }

    // 6. Resolução de Projeto Solicitado & Dev URL
    // Se o texto mencionar um projeto ou expressar intenção de abrir projeto / dev server:
    if (candidateProjects && candidateProjects.length > 0) {
      const matched = findProjectsInText(rawInput, candidateProjects);
      if (matched.length > 0 && matched[0].devUrl) {
        return matched[0].devUrl;
      }
      if (isProjectOpenIntent(rawInput)) {
        const fallback = candidateProjects.find((p) => p.devUrl) || candidateProjects[0];
        if (fallback?.devUrl) {
          return fallback.devUrl;
        }
      }
    }

    // 7. "Abra o site [nome]" (ex: "abra o site da apple", "acesse o site da vercel")
    const siteMatch = rawInput.match(
      /(?:abrir|abra|acesse|acessar|navegar\s+para)\s+(?:o\s+)?site\s+(?:da\s+|do\s+|de\s+)?([a-zA-Z0-9-]+)/i
    );
    if (siteMatch && siteMatch[1]) {
      const name = siteMatch[1].trim().toLowerCase();
      if (KNOWN_SERVICES[name]) {
        return KNOWN_SERVICES[name].home;
      }
      return `https://www.${name}.com`;
    }

    // 8. Busca geral por intenção (pesquisar / buscar / procurar / saber / ver)
    const generalSearchMatch = rawInput.match(
      /(?:pesquisar|buscar|procurar|encontrar|como|qual\s+é|o\s+que\s+é)(?:\s+(?:por|sobre))?\s+[:"']?([^"'\n\r]+)/i
    );
    if (generalSearchMatch && generalSearchMatch[1]?.trim()) {
      const cleanQ = generalSearchMatch[1]
        .trim()
        .replace(/\s+no\s+navegador\.?$/i, '')
        .replace(/\s+(?:na web|na internet)$/i, '')
        .trim();
      if (cleanQ) {
        return `https://www.google.com/search?q=${encodeURIComponent(cleanQ)}`;
      }
    }

    // 9. Se há texto e parece comando de abrir algo (e NÃO for intenção de abrir projeto):
    const openVerbMatch = rawInput.match(
      /(?:abrir|abra|acesse|acessar|visitar|navegue\s+até)\s+(.+)/i
    );
    if (openVerbMatch && openVerbMatch[1]?.trim() && !isProjectOpenIntent(rawInput)) {
      const target = openVerbMatch[1].trim().replace(/\s+no\s+navegador\.?$/i, '').trim();
      if (target) {
        return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }

    // 10. Se for qualquer texto não vazio (e não for comando de projeto):
    if (rawInput.length > 0 && !isProjectOpenIntent(rawInput)) {
      return `https://www.google.com/search?q=${encodeURIComponent(rawInput)}`;
    }
  }

  // 11. Configuração pré-existente do nó de navegador
  if (!targetUrl && nodeConfigUrl && nodeConfigUrl !== 'about:blank') {
    targetUrl = nodeConfigUrl;
  }

  if (!targetUrl) {
    targetUrl = 'about:blank';
  }

  if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('about:')) {
    targetUrl = `https://${targetUrl}`;
  }

  return targetUrl;
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
  currentUser?: { login: string; avatarUrl?: string } | null;
  /** Se a aba de Orquestração está ativa/visível no app (o container fica montado mas com
   * display:none quando o usuário está em outra aba) — usado para refazer o fit/resize/focus
   * dos terminais reais assim que o usuário volta pra esta aba. */
  isTabActive?: boolean;
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
// DEFAULT NODES & EDGES (PT-BR MINIMAL ARCHITECTURE)
// ============================================================================

const DEFAULT_NODES: WorkflowNode[] = [
  {
    id: 'node-trigger',
    type: 'trigger',
    title: 'Prompt',
    subtitle: 'Entrada do usuário',
    x: 80,
    y: 140,
    width: 180,
    height: 115,
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
    title: 'Agente',
    subtitle: 'Coordenador',
    x: 390,
    y: 140,
    width: 200,
    height: 120,
    status: 'ready',
    config: {
      systemInstruction: 'Você é o coordenador de engenharia Aura Dev. Analise a demanda, invoque o modelo de IA correspondente e estruture os resultados. Antes de abrir ou recomendar abrir qualquer aplicação no navegador, verifique se o projeto possui o portless da Vercel; se não possuir, instale no projeto (ex: bun add -d portless ou npm i -D portless) e execute com portless para gerar URLs .localhost estáveis.',
      target: 'Workspace Aura Dev',
    },
    ports: {
      input: ['in'],
      output: ['chat_model', 'tool'],
    },
  },
  {
    id: 'node-model-primary',
    type: 'model',
    title: 'Claude',
    subtitle: 'Sonnet 3.7',
    provider: 'claude',
    x: 390,
    y: 360,
    width: 200,
    height: 115,
    status: 'ready',
    config: {
      model: 'Sonnet 3.7',
      temperature: 0.7,
      maxTokens: 2048,
    },
    ports: {
      input: ['in'],
      output: ['out'],
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
  },
  {
    id: 'edge-agent-model',
    fromNodeId: 'node-agent',
    fromPort: 'chat_model',
    toNodeId: 'node-model-primary',
    toPort: 'in',
  },
];

export const normalizeLoadedNodes = (raw: any): WorkflowNode[] => {
  if (!Array.isArray(raw)) return deduplicateProjectNodesDevUrls(DEFAULT_NODES).nodes;
  const mapped = raw.map((n) => ({
    ...n,
    status: n.status === 'running' ? 'ready' : (n.status || 'ready'),
    needsAttention: false,
    config: n.config || {},
    ports: n.ports || { input: [], output: [] },
  }));
  return deduplicateProjectNodesDevUrls(mapped).nodes;
};

export const normalizeLoadedEdges = (raw: any): WorkflowEdge[] => {
  if (!Array.isArray(raw)) return DEFAULT_EDGES;
  return raw.map((e) => {
    // If edge had legacy hardcoded orange color, remove it so it adapts to the system accentColor
    const isLegacyOrange =
      e.color &&
      typeof e.color === 'string' &&
      e.color.toLowerCase() === '#ff6a00';
    return {
      ...e,
      color: isLegacyOrange ? undefined : e.color,
      isActive: false,
    };
  });
};

const STORAGE_KEY_NODES = 'devflow_orchestration_nodes_v9';
const STORAGE_KEY_EDGES = 'devflow_orchestration_edges_v9';
const STORAGE_KEY_LOGS = 'devflow_orchestration_logs_v9';
const STORAGE_KEY_PAN_ZOOM = 'devflow_orchestration_pan_zoom_v9';
const STORAGE_KEY_FLOORS = 'devflow_orchestration_floors_v1';
const STORAGE_KEY_ACTIVE_FLOOR = 'devflow_orchestration_active_floor_v1';
const GROUND_FLOOR_ID = 'ground';

export interface OrchestrationFloor {
  id: string;
  name: string;
  branch: string;
  worktreePath: string;
}

const floorStorageKey = (base: string, floorId: string) =>
  floorId === GROUND_FLOOR_ID ? base : `${base}::floor::${floorId}`;

// ============================================================================
// CUBIC BEZIER GEOMETRY UTILITIES (ALINHAMENTO EXATO E ARRASTE DE TAG AO LONGO DO LINK)
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

export const findClosestTOnCubicBezier = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  target: { x: number; y: number },
  minT = 0.08,
  maxT = 0.92,
  steps = 45
): number => {
  let bestT = 0.5;
  let minDistanceSq = Infinity;

  for (let i = 0; i <= steps; i++) {
    const t = minT + (i / steps) * (maxT - minT);
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
    const distSq = (pt.x - target.x) ** 2 + (pt.y - target.y) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestT = t;
    }
  }

  // Refinamento de 10 passos ao redor da melhor aproximação
  const span = (maxT - minT) / steps;
  const refineMin = Math.max(minT, bestT - span);
  const refineMax = Math.min(maxT, bestT + span);
  for (let i = 0; i <= 10; i++) {
    const t = refineMin + (i / 10) * (refineMax - refineMin);
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
    const distSq = (pt.x - target.x) ** 2 + (pt.y - target.y) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      bestT = t;
    }
  }

  return bestT;
};

export const getCableGeometry = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromDir: string,
  toDir: string,
  ratio: number = 0.5
) => {
  const depth = 16;
  // Enter into the arrow up to its center (behind the arrow)
  const arrowCenterOffset = depth * 0.5;
  let p1 = { ...from };
  let p2 = { ...to };

  if (fromDir === 'right') p1.x += arrowCenterOffset;
  else if (fromDir === 'down') p1.y += arrowCenterOffset;
  else if (fromDir === 'up') p1.y -= arrowCenterOffset;
  else if (fromDir === 'left') p1.x -= arrowCenterOffset;

  if (toDir === 'left') p2.x -= arrowCenterOffset;
  else if (toDir === 'up') p2.y -= arrowCenterOffset;
  else if (toDir === 'down') p2.y += arrowCenterOffset;
  else if (toDir === 'right') p2.x += arrowCenterOffset;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const dist = Math.hypot(dx, dy);
  const factor = Math.max(45, Math.min(220, dist * 0.45));

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

  // Posicionamento exato na curva Bezier
  const clampedRatio = Math.max(0.08, Math.min(0.92, typeof ratio === 'number' && !isNaN(ratio) ? ratio : 0.5));
  const pt = evaluateCubicBezier(p1, cp1, cp2, p2, clampedRatio);
  const midX = pt.x;
  const midY = pt.y;

  const mainD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;

  let waveUpperD = '';
  let waveLowerD = '';
  if (Math.abs(dx) >= Math.abs(dy)) {
    const waveOffset = Math.min(8, Math.max(3.5, Math.abs(dy) * 0.035 + 3.5));
    waveUpperD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y - waveOffset}, ${cp2x} ${cp2y - waveOffset}, ${p2.x} ${p2.y}`;
    waveLowerD = `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y + waveOffset}, ${cp2x} ${cp2y + waveOffset}, ${p2.x} ${p2.y}`;
  } else {
    const waveOffset = Math.min(8, Math.max(3.5, Math.abs(dx) * 0.035 + 3.5));
    waveUpperD = `M ${p1.x} ${p1.y} C ${cp1x - waveOffset} ${cp1y}, ${cp2x - waveOffset} ${cp2y}, ${p2.x} ${p2.y}`;
    waveLowerD = `M ${p1.x} ${p1.y} C ${cp1x + waveOffset} ${cp1y}, ${cp2x + waveOffset} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return { p1, p2, cp1, cp2, midX, midY, mainD, waveUpperD, waveLowerD, tangentX: pt.tangentX, tangentY: pt.tangentY };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrchestrationCanvas: React.FC<OrchestrationCanvasProps> = ({
  accentColor = '#FF6A00',
  isEffectiveDark = true,
  themeTokens,
  workspacePath,
  currentUser,
  selectedAiProvider,
  selectedModel,
  installedClis = {},
  activeModels = {},
  onSelectAiProvider,
  onSelectModel,
  onSelectWorkspace,
  onToast,
  isTabActive = true,
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

  // Andares: workspaces isolados por branch (git worktree)
  const [floors, setFloors] = useState<OrchestrationFloor[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLOORS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_FLOOR) || GROUND_FLOOR_ID;
    } catch {
      return GROUND_FLOOR_ID;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FLOORS, JSON.stringify(floors));
    } catch {}
  }, [floors]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_FLOOR, activeFloorId);
    } catch {}
  }, [activeFloorId]);
  const activeFloorIdRef = useRef(activeFloorId);
  useEffect(() => {
    activeFloorIdRef.current = activeFloorId;
  }, [activeFloorId]);
  const activeFloor = useMemo(() => floors.find((f) => f.id === activeFloorId) || null, [floors, activeFloorId]);
  const effectiveWorkspacePath = activeFloor ? activeFloor.worktreePath : workspacePath || '';

  // Destructive Actions Modals State (AGENTS.md & Item 63 compliance)
  const [nodeToDelete, setNodeToDelete] = useState<WorkflowNode | null>(null);
  const [floorToDelete, setFloorToDelete] = useState<OrchestrationFloor | null>(null);
  const [floorToLand, setFloorToLand] = useState<OrchestrationFloor | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isClearLogsConfirmOpen, setIsClearLogsConfirmOpen] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const cancelWorkflowRef = useRef(false);
  const runningWorkflowRunIdRef = useRef<string | null>(null);
  // Execuções em andamento: cada gatilho/fluxo roda de forma independente (cancelamento e nós próprios)
  const activeRunsRef = useRef<Map<string, { nodeIds: Set<string>; ctl: { cancelled: boolean }; runIds: Set<string> }>>(new Map());
  const resizingHasDraggedRef = useRef(false);
  const edgePulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cliShiftedPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});

  // Workflow State (persistido e normalizado por andar)
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => {
    try {
      const saved = localStorage.getItem(floorStorageKey(STORAGE_KEY_NODES, activeFloorId));
      if (saved) return normalizeLoadedNodes(JSON.parse(saved));
    } catch {}
    return DEFAULT_NODES;
  });

  const nodesRef = useRef<WorkflowNode[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Limpa estados residuais de execução em nós ou links ao carregar o floor
  useEffect(() => {
    setNodes((prev) => {
      const res = deduplicateProjectNodesDevUrls(prev);
      const list = res.hasChanges ? res.nodes : prev;
      return list.map((n) => (n.status === 'running' ? { ...n, status: 'ready' as const } : n));
    });
    setEdges((prev) => prev.map((e) => (e.isActive ? { ...e, isActive: false } : e)));
  }, [activeFloorId]);

  const [edges, setEdges] = useState<WorkflowEdge[]>(() => {
    try {
      const saved = localStorage.getItem(floorStorageKey(STORAGE_KEY_EDGES, activeFloorId));
      if (saved) return normalizeLoadedEdges(JSON.parse(saved));
    } catch {}
    return DEFAULT_EDGES;
  });

  const edgesRef = useRef<WorkflowEdge[]>(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Links "em uso ativo": apenas links onde dados ou chamadas reais estão ocorrendo no momento
  const [activeDynamicEdgeIds, setActiveDynamicEdgeIds] = useState<Set<string>>(() => new Set());
  const activeEdgeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const activateEdgeById = useCallback((edgeId: string, durationMs = 3000) => {
    setActiveDynamicEdgeIds((prev) => {
      if (prev.has(edgeId)) return prev;
      const next = new Set(prev);
      next.add(edgeId);
      return next;
    });

    const existingTimer = activeEdgeTimersRef.current.get(edgeId);
    if (existingTimer) clearTimeout(existingTimer);

    if (durationMs > 0) {
      const timer = setTimeout(() => {
        activeEdgeTimersRef.current.delete(edgeId);
        setActiveDynamicEdgeIds((prev) => {
          if (!prev.has(edgeId)) return prev;
          const next = new Set(prev);
          next.delete(edgeId);
          return next;
        });
      }, durationMs);
      activeEdgeTimersRef.current.set(edgeId, timer);
    }
  }, []);

  const deactivateEdgeById = useCallback((edgeId: string) => {
    const existingTimer = activeEdgeTimersRef.current.get(edgeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      activeEdgeTimersRef.current.delete(edgeId);
    }
    setActiveDynamicEdgeIds((prev) => {
      if (!prev.has(edgeId)) return prev;
      const next = new Set(prev);
      next.delete(edgeId);
      return next;
    });
  }, []);

  const activateEdgeBetweenNodes = useCallback((nodeAId: string, nodeBId: string, durationMs = 3000) => {
    const matchingEdges = edgesRef.current.filter(
      (e) => (e.fromNodeId === nodeAId && e.toNodeId === nodeBId) ||
             (e.toNodeId === nodeAId && e.fromNodeId === nodeBId)
    );
    matchingEdges.forEach((e) => activateEdgeById(e.id, durationMs));
  }, [activateEdgeById]);

  const deactivateEdgeBetweenNodes = useCallback((nodeAId: string, nodeBId: string) => {
    const matchingEdges = edgesRef.current.filter(
      (e) => (e.fromNodeId === nodeAId && e.toNodeId === nodeBId) ||
             (e.toNodeId === nodeAId && e.fromNodeId === nodeBId)
    );
    matchingEdges.forEach((e) => deactivateEdgeById(e.id));
  }, [deactivateEdgeById]);

  const [executionLogs, setExecutionLogs] = useState<ExecutionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(floorStorageKey(STORAGE_KEY_LOGS, activeFloorId));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Função única e segura para encerramento de processos PTY vinculados a nós (Item 20)
  const killNodeSessions = useCallback(
    (nodeIds: string[], floorId: string = activeFloorId) => {
      if (!window.electronAPI?.pty?.kill) return;
      nodeIds.forEach((id) => {
        try {
          window.electronAPI.pty.kill(getOrchestrationCliSessionId(floorId, id));
        } catch (e) {
          console.warn(`[Orchestration] Failed to kill session for node ${id}:`, e);
        }
      });
    },
    [activeFloorId]
  );

  // Limpeza de timers no unmount (Item 73)
  useEffect(() => {
    return () => {
      if (edgePulseTimeoutRef.current) {
        clearTimeout(edgePulseTimeoutRef.current);
      }
    };
  }, []);

  // Roteamento de URLs entre IDEs/terminais e navegadores na tela
  const [nodeIncomingUrls, setNodeIncomingUrls] = useState<
    Record<
      string,
      {
        url: string;
        timestamp: number;
        openInNewTab?: boolean;
        fromNodeTitle?: string;
      }
    >
  >({});

  // Abre uma URL enviada por um nó (IDE, agente, terminal ou comando) direcionando-a ao navegador conectado
  // Sobe o servidor de dev do projeto em segundo plano quando a porta da URL está offline
  const ensureDevServer = (projectNode: WorkflowNode | null | undefined, url: string) => {
    if (!window.electronAPI?.pty || !projectNode?.config?.projectPath) return;
    const tPort = extractPortFromUrl(url);
    const pPath = projectNode.config.projectPath;
    const pName = projectNode.config.projectName || projectNode.title || 'projeto';
    scanSystemOccupiedPorts().then((sysPorts) => {
      if (tPort && !sysPorts.includes(tPort)) {
        const cleanName = pName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const sessionId = `dev-server-${cleanName}`;
        window.electronAPI.pty.create(sessionId, 'zsh', pPath, 100, 24, accentColor).then(() => {
          window.electronAPI.pty.write(sessionId, 'bun run dev 2>/dev/null || pnpm dev 2>/dev/null || npm run dev\n');
          onToast?.(`🚀 Iniciando servidor de "${pName}" em segundo plano...`, 'info');
        }).catch(() => {});
      }
    });
  };

  const handleOpenUrlFromNode = useCallback(
    (
      sourceNodeId: string,
      url: string,
      opts?: {
        fromServerDetection?: boolean;
        targetBrowserId?: string;
        openInNewTab?: boolean;
        fromNodeTitle?: string;
      }
    ) => {
      if (!url) return;
      const openInNewTab = Boolean(opts?.openInNewTab);
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      const title = opts?.fromNodeTitle || sourceNode?.title || 'Projeto';

      // Se a URL for localhost e vier de um nó com projeto local ou houver projeto conectado:
      // Inicia automaticamente o servidor de desenvolvimento em segundo plano se a porta estiver offline
      if (url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        const projectNode =
          (sourceNode?.type === 'project' ? sourceNode : null) ||
          getConnectedProjectNodes(sourceNodeId, nodes, edges)[0] ||
          nodes.find((n) => n.type === 'project' && n.config?.projectPath);
        ensureDevServer(projectNode, url);
      }

      // 1. Se foi especificado um targetBrowserId exato
      if (opts?.targetBrowserId) {
        const specificBrowser = nodes.find((n) => n.id === opts.targetBrowserId && n.type === 'webview');
        if (specificBrowser) {
          setNodeIncomingUrls((prev) => ({
            ...prev,
            [specificBrowser.id]: {
              url,
              timestamp: Date.now(),
              openInNewTab,
              fromNodeTitle: title,
            },
          }));
          onToast?.(`🌐 Aberto no Navegador (${specificBrowser.title}): ${url}`);
          return;
        }
      }

      const connectedBrowsers = getConnectedBrowserNodes(sourceNodeId, nodes, edges);
      if (connectedBrowsers.length > 0) {
        const targetBrowser = connectedBrowsers[0];

        // Ativa especificamente o link conectando ao navegador de destino
        activateEdgeBetweenNodes(sourceNodeId, targetBrowser.id, 3500);

        setNodeIncomingUrls((prev) => ({
          ...prev,
          [targetBrowser.id]: {
            url,
            timestamp: Date.now(),
            openInNewTab,
            fromNodeTitle: title,
          },
        }));

        onToast?.(`🌐 Aberto no Navegador conectado (${targetBrowser.title}): ${url}`);
        return;
      }

      // Se o nó não possui conexão direta a um navegador, mas existe um navegador na tela, roteia para ele
      const canvasBrowsers = nodes.filter((n) => n.type === 'webview');
      if (canvasBrowsers.length > 0) {
        const targetBrowser = canvasBrowsers[0];
        activateEdgeBetweenNodes(sourceNodeId, targetBrowser.id, 3500);
        setNodeIncomingUrls((prev) => ({
          ...prev,
          [targetBrowser.id]: {
            url,
            timestamp: Date.now(),
            openInNewTab,
            fromNodeTitle: title,
          },
        }));
        onToast?.(`🌐 Aberto no Navegador da tela (${targetBrowser.title}): ${url}`);
        return;
      }

      // A orquestração NUNCA deve abrir o navegador do dispositivo.
      // Se qualquer ação exigir abrir o navegador e não houver um componente de Navegador no fluxo, exibe erro.
      if (opts?.fromServerDetection) return;
      onToast?.(
        'Ação bloqueada: a orquestração opera apenas com o componente de navegador. Adicione um nó de Navegador ao fluxo para abrir URLs.',
        'error'
      );
    },
    [nodes, edges, onToast]
  );

  const handleSwitchFloor = useCallback(
    (newFloorId: string) => {
      if (newFloorId === activeFloorId) return;
      let loadedNodes: WorkflowNode[] = DEFAULT_NODES;
      let loadedEdges: WorkflowEdge[] = DEFAULT_EDGES;
      let loadedLogs: ExecutionRecord[] = [];
      try {
        const rawNodes = localStorage.getItem(floorStorageKey(STORAGE_KEY_NODES, newFloorId));
        if (rawNodes) loadedNodes = normalizeLoadedNodes(JSON.parse(rawNodes));
        const rawEdges = localStorage.getItem(floorStorageKey(STORAGE_KEY_EDGES, newFloorId));
        if (rawEdges) loadedEdges = normalizeLoadedEdges(JSON.parse(rawEdges));
        const rawLogs = localStorage.getItem(floorStorageKey(STORAGE_KEY_LOGS, newFloorId));
        if (rawLogs) loadedLogs = JSON.parse(rawLogs);
      } catch {}

      // Limpeza de posições originais e timers ao trocar de andar (Itens 26 e 73)
      cliOriginalPositionsRef.current = {};
      cliShiftedPositionsRef.current = {};
      if (edgePulseTimeoutRef.current) {
        clearTimeout(edgePulseTimeoutRef.current);
        edgePulseTimeoutRef.current = null;
      }

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setExecutionLogs(loadedLogs);
      setActiveFloorId(newFloorId);
      setSelectedNodeId(null);
      setExpandedCliNodes({});
    },
    [activeFloorId]
  );

  const [isFloorsMenuOpen, setIsFloorsMenuOpen] = useState(false);
  const floorsMenuRef = useRef<HTMLDivElement>(null);
  const [floorDraft, setFloorDraft] = useState({ name: '', branch: '', duplicate: true });
  const [isFloorBusy, setIsFloorBusy] = useState(false);

  useEffect(() => {
    if (!isFloorsMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (floorsMenuRef.current && !floorsMenuRef.current.contains(e.target as Node)) {
        setIsFloorsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside, true);
    return () => document.removeEventListener('mousedown', handleOutside, true);
  }, [isFloorsMenuOpen]);

  const handleCreateFloor = useCallback(async () => {
    const name = floorDraft.name.trim();
    const branch = floorDraft.branch.trim();
    if (!name || !branch || !workspacePath) return;

    setIsFloorBusy(true);
    try {
      const safeSlug = branch.replace(/[^a-zA-Z0-9._-]/g, '-');
      const lastSlash = workspacePath.lastIndexOf('/');
      const parentDir = lastSlash > 0 ? workspacePath.slice(0, lastSlash) : workspacePath;
      const repoFolderName = lastSlash >= 0 ? workspacePath.slice(lastSlash + 1) : workspacePath;
      const targetDir = `${parentDir}/${repoFolderName}-floor-${safeSlug}`;

      const result = await window.electronAPI?.git?.worktreeCreate?.(workspacePath, branch, targetDir);
      if (!result?.success || !result.worktreePath) {
        onToast?.(`Não foi possível criar o andar: ${result?.error || 'erro desconhecido'}`);
        return;
      }

      const newFloorId = `floor-${Date.now()}`;
      if (floorDraft.duplicate) {
        try {
          localStorage.setItem(floorStorageKey(STORAGE_KEY_NODES, newFloorId), JSON.stringify(nodes));
          localStorage.setItem(floorStorageKey(STORAGE_KEY_EDGES, newFloorId), JSON.stringify(edges));
        } catch {}
      }

      setFloors((prev) => [...prev, { id: newFloorId, name, branch, worktreePath: result.worktreePath! }]);
      handleSwitchFloor(newFloorId);
      setFloorDraft({ name: '', branch: '', duplicate: true });
      setIsFloorsMenuOpen(false);
      onToast?.(`Andar "${name}" criado na branch "${branch}".`);
    } finally {
      setIsFloorBusy(false);
    }
  }, [floorDraft, workspacePath, nodes, edges, handleSwitchFloor, onToast]);

  const handleLandFloor = useCallback(
    async (floor: OrchestrationFloor) => {
      if (!workspacePath) return;
      setIsFloorBusy(true);
      try {
        const groundInfo = await window.electronAPI?.git?.getWorkspaceGitInfo?.(workspacePath);
        const baseBranch = groundInfo?.branch || 'main';
        const result = await window.electronAPI?.git?.worktreeLand?.(workspacePath, floor.branch, baseBranch);
        if (result?.success) {
          onToast?.(`Andar "${floor.name}" mesclado em "${baseBranch}".`);
        } else {
          onToast?.(`Falha ao aterrissar: ${result?.error || 'erro desconhecido'}`);
        }
      } finally {
        setIsFloorBusy(false);
      }
    },
    [workspacePath, onToast]
  );

  const handleDeleteFloor = useCallback(
    async (floor: OrchestrationFloor) => {
      if (!workspacePath) return;
      setIsFloorBusy(true);
      try {
        // Encerra todos os terminais PTY associados a este andar antes de excluir o worktree (Itens 20 e 25)
        let floorNodeIds: string[] = [];
        try {
          const raw = localStorage.getItem(floorStorageKey(STORAGE_KEY_NODES, floor.id));
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) floorNodeIds = parsed.map((n: any) => n.id);
          }
        } catch {}
        if (floor.id === activeFloorId) {
          floorNodeIds = Array.from(new Set([...floorNodeIds, ...nodes.map((n) => n.id)]));
        }
        killNodeSessions(floorNodeIds, floor.id);

        const result = await window.electronAPI?.git?.worktreeRemove?.(workspacePath, floor.worktreePath);
        if (!result?.success) {
          onToast?.(`Falha ao excluir andar: ${result?.error || 'erro desconhecido'}`);
          return;
        }
        try {
          localStorage.removeItem(floorStorageKey(STORAGE_KEY_NODES, floor.id));
          localStorage.removeItem(floorStorageKey(STORAGE_KEY_EDGES, floor.id));
          localStorage.removeItem(floorStorageKey(STORAGE_KEY_LOGS, floor.id));
        } catch {}
        setFloors((prev) => prev.filter((f) => f.id !== floor.id));
        if (activeFloorId === floor.id) {
          handleSwitchFloor(GROUND_FLOOR_ID);
        }
        onToast?.(`Andar "${floor.name}" excluído.`);
      } finally {
        setIsFloorBusy(false);
      }
    },
    [workspacePath, activeFloorId, handleSwitchFloor, onToast, nodes, killNodeSessions]
  );

  // Automatically synchronize & validate node models with Header and IDE active models
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type === 'model') {
          const provId = (n.provider || selectedAiProvider || 'claude') as AiProviderId;
          // Item 70: Não sobrescrever caso activeModels do provedor ainda não tenha carregado
          if (!activeModels?.[provId]) return n;

          const modelList = getProviderModelList(provId);
          const currentModelInConfig = n.config.model;

          const match = modelList.find(
            (m) => m.id === currentModelInConfig || m.label === currentModelInConfig
          );

          const activeCurrent = activeModels[provId]?.currentModel;
          const activeMatch = activeCurrent
            ? modelList.find((m) => m.id === activeCurrent || m.label === activeCurrent)
            : null;

          const chosenModel = match?.label || activeMatch?.label || currentModelInConfig || modelList[0]?.label || 'Default';
          const providerMeta = AI_PROVIDER_INFOS[provId] || AI_PROVIDER_INFOS.claude;
          const properTitle = providerMeta.name;
          const properSubtitle = chosenModel;

          const needsTitleFix = n.title?.startsWith('Modelo ') || !n.title;
          const needsSubtitleFix = n.subtitle?.includes('•') || n.subtitle !== properSubtitle;

          if (needsTitleFix || needsSubtitleFix || n.config.model !== chosenModel || n.provider !== provId) {
            return {
              ...n,
              title: needsTitleFix ? properTitle : n.title,
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
  }, [activeModels, selectedAiProvider, getProviderModelList]);

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
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const isSpacePressedRef = useRef(false);

  // Dragging Nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Interactive Link Dragging State
  const [draggingLink, setDraggingLink] = useState<{
    fromNodeId: string;
    fromPort: string;
    fromDir?: 'right' | 'down' | 'up';
    fromSide?: 'right' | 'bottom' | 'top';
    fromRatio?: number;
    fromX?: number;
    fromY?: number;
    currentX: number;
    currentY: number;
    snappedNodeId?: string | null;
    snappedPort?: string | null;
    snappedSide?: 'left' | 'top' | 'bottom' | 'right';
    snappedRatio?: number;
  } | null>(null);

  // Interactive Link Tag Dragging State (Deslocar tagzinha de chars ao longo do cabo bezier)
  const [draggingTagEdgeId, setDraggingTagEdgeId] = useState<string | null>(null);
  const draggingTagRef = useRef<{
    edgeId: string;
    hasMoved: boolean;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const handleStartDraggingTag = useCallback(
    (edgeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      draggingTagRef.current = {
        edgeId,
        hasMoved: false,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      setDraggingTagEdgeId(edgeId);
    },
    []
  );

  // Dynamic output handle positions on node borders (accompany mouse cursor)
  const [nodeHandlePositions, setNodeHandlePositions] = useState<
    Record<string, { side: 'right' | 'bottom' | 'top'; ratio: number; x: number; y: number }>
  >({});
  const nodeHandlePositionsRef = useRef<
    Record<string, { side: 'right' | 'bottom' | 'top'; ratio: number; x: number; y: number }>
  >({});

  const computeHandlePosition = useCallback(
    (
      relX: number,
      relY: number,
      width: number,
      height: number
    ): { side: 'right' | 'bottom' | 'top'; ratio: number; x: number; y: number } => {
      // Limite de segurança de 5px em relação à região de redimensionamento no canto inferior direito
      // (Suporte de redimensionamento em width-21 / height-21, raio do botão 12px -> 21 + 12 + 5 = 38px)
      const resizePad = 38;
      const minPadX = 24;
      const maxPadX = width - resizePad;
      const minPadY = 24;
      const maxPadY = height - resizePad;

      // Normalizing distances to perimeter edges (slight bias to right edge as primary flow)
      const normDistRight = (Math.max(0, width - relX) / (width * 0.5)) * 0.85;
      const normDistTop = Math.max(0, relY) / (height * 0.5);
      const normDistBottom = Math.max(0, height - relY) / (height * 0.5);

      let side: 'right' | 'bottom' | 'top' = 'right';
      if (normDistTop < normDistRight && normDistTop <= normDistBottom && relY < height * 0.42) {
        side = 'top';
      } else if (normDistBottom < normDistRight && normDistBottom < normDistTop && relY > height * 0.58) {
        side = 'bottom';
      } else {
        side = 'right';
      }

      if (side === 'top') {
        const clampedX = Math.max(minPadX, Math.min(width - 24, relX));
        return {
          side: 'top',
          ratio: clampedX / width,
          x: clampedX,
          y: 0,
        };
      }

      if (side === 'bottom') {
        const clampedX = Math.max(minPadX, Math.min(maxPadX, relX));
        return {
          side: 'bottom',
          ratio: clampedX / width,
          x: clampedX,
          y: height,
        };
      }

      // side === 'right'
      const clampedY = Math.max(minPadY, Math.min(maxPadY, relY));
      return {
        side: 'right',
        ratio: clampedY / height,
        x: width,
        y: clampedY,
      };
    },
    []
  );

  const updateNodeHandlePosition = useCallback(
    (nodeId: string, pos: { side: 'right' | 'bottom' | 'top'; ratio: number; x: number; y: number }) => {
      nodeHandlePositionsRef.current[nodeId] = pos;
      setNodeHandlePositions((prev) => {
        const cur = prev[nodeId];
        if (
          cur &&
          cur.side === pos.side &&
          Math.abs(cur.x - pos.x) < 0.5 &&
          Math.abs(cur.y - pos.y) < 0.5
        ) {
          return prev;
        }
        return { ...prev, [nodeId]: pos };
      });
    },
    []
  );

  // Dynamic input handle positions on target node borders (accompany mouse cursor)
  const [nodeInputHandlePositions, setNodeInputHandlePositions] = useState<
    Record<string, { side: 'left' | 'top' | 'bottom' | 'right'; ratio: number; x: number; y: number }>
  >({});
  const nodeInputHandlePositionsRef = useRef<
    Record<string, { side: 'left' | 'top' | 'bottom' | 'right'; ratio: number; x: number; y: number }>
  >({});

  const computeInputHandlePosition = useCallback(
    (
      relX: number,
      relY: number,
      width: number,
      height: number
    ): { side: 'left' | 'top' | 'bottom' | 'right'; ratio: number; x: number; y: number } => {
      // Limite de segurança para o canto inferior direito com região de redimensionamento
      const resizePad = 38;
      const minPadX = 24;
      const maxPadX = width - resizePad;
      const minPadY = 24;
      const maxPadY = height - resizePad;

      // Normalizing distances to perimeter edges (slight bias to left edge as primary input flow)
      const normDistLeft = (Math.max(0, relX) / (width * 0.5)) * 0.85;
      const normDistTop = Math.max(0, relY) / (height * 0.5);
      const normDistBottom = Math.max(0, height - relY) / (height * 0.5);
      const normDistRight = Math.max(0, width - relX) / (width * 0.5);

      let side: 'left' | 'top' | 'bottom' | 'right' = 'left';
      if (normDistTop < normDistLeft && normDistTop <= normDistBottom && normDistTop <= normDistRight && relY < height * 0.42) {
        side = 'top';
      } else if (normDistBottom < normDistLeft && normDistBottom < normDistTop && normDistBottom <= normDistRight && relY > height * 0.58) {
        side = 'bottom';
      } else if (normDistRight < normDistLeft && normDistRight < normDistTop && normDistRight < normDistBottom && relX > width * 0.75) {
        side = 'right';
      } else {
        side = 'left';
      }

      if (side === 'top') {
        const clampedX = Math.max(minPadX, Math.min(width - 24, relX));
        return {
          side: 'top',
          ratio: clampedX / width,
          x: clampedX,
          y: 0,
        };
      }

      if (side === 'bottom') {
        const clampedX = Math.max(minPadX, Math.min(maxPadX, relX));
        return {
          side: 'bottom',
          ratio: clampedX / width,
          x: clampedX,
          y: height,
        };
      }

      if (side === 'right') {
        const clampedY = Math.max(minPadY, Math.min(maxPadY, relY));
        return {
          side: 'right',
          ratio: clampedY / height,
          x: width,
          y: clampedY,
        };
      }

      // side === 'left'
      const clampedY = Math.max(minPadY, Math.min(height - 24, relY));
      return {
        side: 'left',
        ratio: clampedY / height,
        x: 0,
        y: clampedY,
      };
    },
    []
  );

  const updateNodeInputHandlePosition = useCallback(
    (nodeId: string, pos: { side: 'left' | 'top' | 'bottom' | 'right'; ratio: number; x: number; y: number }) => {
      nodeInputHandlePositionsRef.current[nodeId] = pos;
      setNodeInputHandlePositions((prev) => {
        const cur = prev[nodeId];
        if (
          cur &&
          cur.side === pos.side &&
          Math.abs(cur.x - pos.x) < 0.5 &&
          Math.abs(cur.y - pos.y) < 0.5
        ) {
          return prev;
        }
        return { ...prev, [nodeId]: pos };
      });
    },
    []
  );

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
  const expandedCliNodesRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    expandedCliNodesRef.current = expandedCliNodes;
  }, [expandedCliNodes]);
  const [openedCliNodeIds, setOpenedCliNodeIds] = useState<Set<string>>(() => new Set());
  const cliOriginalPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});

  // Expanded Project nodes state
  const [expandedProjectNodes, setExpandedProjectNodes] = useState<Record<string, boolean>>({});
  const expandedProjectNodesRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    expandedProjectNodesRef.current = expandedProjectNodes;
  }, [expandedProjectNodes]);
  const projectOriginalPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});
  const projectShiftedPositionsRef = useRef<Record<string, Record<string, { x: number; y: number }>>>({});

  // Available projects for Project nodes (Unified with Git & GitHub)
  const [availableProjects, setAvailableProjects] = useState<GitProjectItem[]>([]);
  const [isCloningProject, setIsCloningProject] = useState(false);
  const [cloningNodeId, setCloningNodeId] = useState<string | null>(null);

  const loadCanvasProjects = useCallback(async () => {
    try {
      const list = await fetchAllGitProjects(effectiveWorkspacePath);
      setAvailableProjects(list);
    } catch (err) {
      console.warn('[OrchestrationCanvas] Erro ao carregar projetos do Git:', err);
    }
  }, [effectiveWorkspacePath]);

  useEffect(() => {
    loadCanvasProjects();
  }, [loadCanvasProjects]);

  const handleCloneProjectNode = useCallback(
    async (nodeId: string, customProject?: GitProjectItem) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      const pConfig = targetNode.config || {};
      const projItem: GitProjectItem =
        customProject ||
        availableProjects.find(
          (p) =>
            (pConfig.fullName && p.fullName.toLowerCase() === pConfig.fullName.toLowerCase()) ||
            p.name.toLowerCase() === (pConfig.projectName || targetNode.title).toLowerCase()
        ) || {
          id: 'temp',
          name: pConfig.projectName || targetNode.title || 'Projeto',
          fullName: pConfig.fullName || pConfig.projectName || targetNode.title || 'Projeto',
          cloneUrl: pConfig.cloneUrl || pConfig.htmlUrl,
          htmlUrl: pConfig.htmlUrl,
          isCloned: false,
        };

      setIsCloningProject(true);
      setCloningNodeId(nodeId);
      if (onToast) onToast(`Iniciando clone do repositório "${projItem.name}"...`);

      try {
        const res = await cloneGitRepository(projItem);
        if (res.success && res.repoPath) {
          let detectedPort: number | null = null;
          try {
            detectedPort = await detectProjectPort(newPath);
          } catch {}
          const existingUrls = nodes
            .filter((n) => n.type === 'project' && n.id !== nodeId)
            .map((n) => n.config?.devUrl)
            .filter(Boolean) as string[];
          const uniqueDevUrl = allocateUniqueDevUrl(existingUrls, detectedPort);

          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    title: projItem.name,
                    subtitle: `${newBranch} • Projeto`,
                    config: {
                      ...n.config,
                      projectName: projItem.name,
                      fullName: projItem.fullName,
                      projectPath: newPath,
                      gitBranch: newBranch,
                      devUrl: uniqueDevUrl,
                      isCloned: true,
                    },
                  }
                : n
            )
          );

          if (onToast) onToast(`🎉 Repositório "${projItem.name}" clonado com sucesso!`);
          await loadCanvasProjects();
        } else if (res.error && res.error !== 'Operação cancelada pelo usuário') {
          if (onToast) onToast(`Erro ao clonar: ${res.error}`);
        }
      } catch (err: any) {
        if (onToast) onToast(`Erro ao clonar: ${err?.message || 'Falha no clone'}`);
      } finally {
        setIsCloningProject(false);
        setCloningNodeId(null);
      }
    },
    [nodes, availableProjects, loadCanvasProjects, onToast]
  );

  // Papéis (roles) reutilizáveis para os agentes
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [newRoleDraft, setNewRoleDraft] = useState<{ name: string; color: string; instructions: string }>({
    name: '',
    color: '#6366f1',
    instructions: '',
  });
  const refreshRoles = useCallback(async () => {
    const list = await window.electronAPI?.roles?.list?.();
    if (list) setRoles(list);
  }, []);
  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);
  const assignRoleToNode = useCallback((nodeId: string, roleId: string | undefined) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, roleId } : n)));
  }, []);

  // Conexões funcionais: retransmitir mensagens entre agentes conectados (Item 6: apenas para IAs, nunca para shells)
  const [relayDraft, setRelayDraft] = useState('');
  const getConnectedAgentTargets = useCallback(
    (nodeId: string) =>
      edges
        .filter((e) => e.fromNodeId === nodeId || e.toNodeId === nodeId)
        .map((e) => {
          const targetId = e.fromNodeId === nodeId ? e.toNodeId : e.fromNodeId;
          return { edge: e, target: nodes.find((n) => n.id === targetId) };
        })
        .filter(
          (item): item is { edge: WorkflowEdge; target: WorkflowNode } =>
            !!item.target && item.target.id !== nodeId && (item.target.type === 'model' || item.target.type === 'agent')
        ),
    [edges, nodes]
  );
  const sendRelayMessage = useCallback(
    async (targetNodeId: string, text: string, sourceNodeId?: string) => {
      if (!text.trim()) return;
      const targetNode = nodesRef.current.find((n) => n.id === targetNodeId);
      if (!targetNode) return;

      if (sourceNodeId) {
        activateEdgeBetweenNodes(sourceNodeId, targetNodeId, 4000);
      }

      // Se o destino for um Card de IA / Modelo ou Agente
      if (targetNode.type === 'model' || targetNode.type === 'agent') {
        const prov = (targetNode.provider || 'claude') as AiProviderId;
        const modelName = targetNode.config?.model || 'Sonnet 5';
        const relaySessionId = getOrchestrationCliSessionId(activeFloorId, targetNodeId);
        window.electronAPI?.pty?.create?.(relaySessionId, 'zsh', effectiveWorkspacePath);

        setNodes((prev) =>
          prev.map((n) => (n.id === targetNodeId ? { ...n, status: 'running' } : n))
        );
        onToast?.(`🤖 Enviando para ${targetNode.title}...`, 'info');

        try {
          if (window.electronAPI?.ai?.prompt) {
            const res = await (window.electronAPI.ai.prompt as any)(
              text,
              modelName,
              effectiveWorkspacePath,
              prov,
              undefined,
              undefined,
              [relaySessionId]
            );
            if (res?.response) {
              const reply = res.response.trim();
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === targetNodeId
                    ? {
                        ...n,
                        status: 'success',
                        output: {
                          text: reply,
                          timestamp: new Date().toLocaleTimeString(),
                        },
                      }
                    : n
                )
              );
              onToast?.(`✨ Resposta de ${targetNode.title} recebida!`, 'success');

              const url = resolveBrowserUrlFromInput(reply, undefined, []);
              if (url && url !== 'about:blank' && !url.includes('google.com/search')) {
                handleOpenUrlFromNode(targetNodeId, url);
              }
            } else if (res?.error) {
              onToast?.(`Erro em ${targetNode.title}: ${res.error}`, 'error');
              setNodes((prev) =>
                prev.map((n) => (n.id === targetNodeId ? { ...n, status: 'failed' } : n))
              );
            }
          }
        } catch (err: any) {
          onToast?.(`Falha na comunicação: ${err?.message || err}`, 'error');
          setNodes((prev) =>
            prev.map((n) => (n.id === targetNodeId ? { ...n, status: 'failed' } : n))
          );
        }
        return;
      }

      // Se o destino tiver um terminal CLI aberto
      const sessionId = getOrchestrationCliSessionId(activeFloorId, targetNodeId);
      window.electronAPI?.pty?.write?.(sessionId, `${text}\r`);
      onToast?.('Mensagem enviada ao terminal do agente conectado.');
    },
    [onToast, activeFloorId, effectiveWorkspacePath, activateEdgeBetweenNodes, handleOpenUrlFromNode]
  );
  const toggleEdgeAutoRelay = useCallback((edgeId: string) => {
    setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, autoRelay: !e.autoRelay } : e)));
  }, []);


  // Selection & Modal Popup State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeIdsRef = useRef<string[]>(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectionInitialIdsRef = useRef<string[]>([]);
  const dragStartNodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [nodesToDelete, setNodesToDelete] = useState<WorkflowNode[] | null>(null);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredResizeNodeId, setHoveredResizeNodeId] = useState<string | null>(null);
  const [centerHoveredNodeId, setCenterHoveredNodeId] = useState<string | null>(null);

  const handleCardMouseMove = useCallback(
    (
      nodeId: string,
      width: number,
      height: number,
      e: React.MouseEvent<HTMLDivElement>
    ) => {
      if (draggingNodeId || draggingLink || isPanning || resizingNode) return;
      if (isSelectingRef.current) return;

      const cardEl = e.currentTarget;
      const rect = cardEl.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / zoom;
      const relY = (e.clientY - rect.top) / zoom;

      // Detecta se o mouse está sobre a região de redimensionamento dos cantos (inferior direito ou superior esquerdo)
      const isOverResize =
        (relX >= width - 30 && relY >= height - 30) ||
        (relX <= 26 && relY <= 26);
      setHoveredResizeNodeId((cur) => (isOverResize ? nodeId : cur === nodeId ? null : cur));

      // Detecta se o mouse está sobre a região mais central do card (afastado das bordas)
      // Limite reduzido para que a seta de link apareça apenas bem rente à borda externa
      const edgeThresholdX = Math.min(16, width * 0.08);
      const edgeThresholdY = Math.min(14, height * 0.08);
      const isCentral =
        relX > edgeThresholdX &&
        relX < width - edgeThresholdX &&
        relY > edgeThresholdY &&
        relY < height - edgeThresholdY;
      setCenterHoveredNodeId((cur) => (isCentral ? nodeId : cur === nodeId ? null : cur));

      if (!isCentral) {
        const node = nodes.find((n) => n.id === nodeId);

        if (node?.ports?.output) {
          const outPos = computeHandlePosition(relX, relY, width, height);
          updateNodeHandlePosition(nodeId, outPos);
        }

        if (node?.ports?.input) {
          const inPos = computeInputHandlePosition(relX, relY, width, height);
          updateNodeInputHandlePosition(nodeId, inPos);
        }
      }
    },
    [
      draggingNodeId,
      draggingLink,
      isPanning,
      resizingNode,
      zoom,
      nodes,
      computeHandlePosition,
      updateNodeHandlePosition,
      computeInputHandlePosition,
      updateNodeInputHandlePosition,
      setHoveredResizeNodeId,
      setCenterHoveredNodeId,
    ]
  );

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

  const activeInstructionNode = useMemo(() => {
    if (selectedNode && selectedNode.type !== 'webview') {
      return selectedNode;
    }
    if (lastActiveNode && lastActiveNode.type !== 'webview') {
      return lastActiveNode;
    }
    return null;
  }, [selectedNode, lastActiveNode]);

  useEffect(() => {
    if (selectedNode) {
      if (selectedNode.type !== 'webview') {
        setLastActiveNode(selectedNode);
        setActiveInstructionNodeId(selectedNode.id);
      }
      const isTerminal = Boolean(expandedCliNodes[selectedNode.id] || selectedNode.type === 'tool');
      if (isTerminal || selectedNode.type === 'webview') {
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
    selectedNodeIds.length <= 1 &&
    selectedNodeId &&
    isInstructionVisible &&
    activeInstructionNode &&
    activeInstructionNode.type !== 'webview' &&
    selectedNode?.type !== 'webview' &&
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
      case 'ide':
        return 'Comando inicial da IDE';
      case 'memory':
        return 'Escopo da sessão';
      case 'model':
        return 'Instruções do modelo';
      case 'webview':
        return 'URL inicial do navegador';
      case 'project':
        return 'Detalhes e Configurações do Projeto';
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
      case 'ide':
        return 'Ex: npm run dev ou claude';
      case 'memory':
        return 'Ex: Sessão Aura Dev / Workspace Context';
      case 'model':
        return 'Instruções adicionais de contexto para o modelo...';
      case 'webview':
        return 'Ex: http://localhost:5173 ou https://meu-site.com';
      case 'project':
        return 'Diretrizes ou escopo de arquivos para a IA neste projeto (ex: criar componentes em src/, rodar testes)...';
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
      case 'ide':
        return node.config?.command || '';
      case 'memory':
        return node.config?.account || '';
      case 'model':
        return node.config?.systemInstruction || '';
      case 'webview':
        return node.config?.url || '';
      case 'project':
        return node.config?.systemInstruction || '';
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
      case 'ide':
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
      case 'project':
        handleUpdateNode(nodeId, { config: { ...node.config, systemInstruction: value } });
        break;
    }
  };

  const [nodeOptionsPopup, setNodeOptionsPopup] = useState<{
    nodeId: string;
    x: number;
    y: number;
    view?: 'menu' | 'confirm_delete' | 'roles' | 'roles_create' | 'relay';
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
  const handleCreateRole = useCallback(async () => {
    if (!newRoleDraft.name.trim()) return;
    const created = await window.electronAPI?.roles?.create?.(newRoleDraft);
    if (created) {
      setRoles((prev) => [...prev, created]);
      setNewRoleDraft({ name: '', color: '#6366f1', instructions: '' });
      if (nodeOptionsPopup) {
        assignRoleToNode(nodeOptionsPopup.nodeId, created.id);
        setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'roles' } : null));
      }
    }
  }, [newRoleDraft, nodeOptionsPopup, assignRoleToNode]);
  const [popupTab, setPopupTab] = useState<'options' | 'config'>('options');
  const configuringNode = useMemo(
    () => nodes.find((n) => n.id === configuringNodeId) || null,
    [nodes, configuringNodeId]
  );

  // Fast O(1) lookup map of nodes for edge and cable rendering (Item 69)
  const nodesMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  // Modals & Execution
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExecutingFlow, setIsExecutingFlow] = useState(false);

  // Persist State com debounce de 300ms para evitar travamento em arrastes contínuos (Item 69)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(floorStorageKey(STORAGE_KEY_NODES, activeFloorId), JSON.stringify(nodes));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [nodes, activeFloorId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(floorStorageKey(STORAGE_KEY_EDGES, activeFloorId), JSON.stringify(edges));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [edges, activeFloorId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(floorStorageKey(STORAGE_KEY_LOGS, activeFloorId), JSON.stringify(executionLogs));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [executionLogs, activeFloorId]);

  const handleMouseUpRef = useRef<(e?: React.MouseEvent | MouseEvent) => void>(() => {});

  // Global mouseup to ensure panning / dragging cleanly stops anywhere
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      handleMouseUpRef.current(e);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Zoom centered at mouse cursor
  const performZoomAt = useCallback((clientX: number, clientY: number, deltaY: number) => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const zoomFactor = deltaY < 0 ? 1.08 : 0.92;
    setZoom((currentZoom) => {
      const nextZoom = Math.min(2.5, Math.max(0.3, Number((currentZoom * zoomFactor).toFixed(2))));
      if (nextZoom !== currentZoom) {
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        setPan((currentPan) => ({
          x: Math.round(mouseX - (mouseX - currentPan.x) * (nextZoom / currentZoom)),
          y: Math.round(mouseY - (mouseY - currentPan.y) * (nextZoom / currentZoom)),
        }));
      }
      return nextZoom;
    });
  }, []);

  // Track global Ctrl/Cmd modifier state (used to disable pointer-events on iframes during zoom)
  const [isCtrlOrMetaPressed, setIsCtrlOrMetaPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.ctrlKey || e.metaKey) {
        setIsCtrlOrMetaPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlOrMetaPressed(false);
      }
    };
    const handleBlur = () => {
      setIsCtrlOrMetaPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Listen for forwarded zoom events from child frames (e.g. webview iframe, xterm)
  useEffect(() => {
    const handleCustomZoom = (e: Event) => {
      const custom = e as CustomEvent<{ clientX: number; clientY: number; deltaY: number }>;
      if (!custom.detail) return;
      performZoomAt(custom.detail.clientX, custom.detail.clientY, custom.detail.deltaY);
    };

    window.addEventListener('orchestration-zoom', handleCustomZoom);
    return () => window.removeEventListener('orchestration-zoom', handleCustomZoom);
  }, [performZoomAt]);

  // Mouse wheel scrolling & zooming on canvas (capture phase ensures it intercepts over cards, terminals & controls)
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Zoom centered at mouse cursor if Ctrl / Cmd is held (or trackpad pinch-to-zoom)
      // Must take absolute priority even if mouse is over any card, button, terminal or modal
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        performZoomAt(e.clientX, e.clientY, e.deltaY);
        return;
      }

      // Don't intercept normal scroll inside modals, popups or dropdowns
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-node-modal="true"]') ||
        target?.closest('[data-node-popup="true"]')
      ) {
        return;
      }

      // If scrolling inside an element with internal scroll (e.g. terminal, textarea, scrollable list), let child scroll
      const isScrollableChild = target?.closest('.xterm, textarea, [data-scrollable="true"], input, select');
      if (isScrollableChild) {
        return;
      }

      e.preventDefault();

      // Normal mouse wheel scroll (vertical & horizontal) - pan canvas
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

    canvasEl.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => canvasEl.removeEventListener('wheel', handleWheel, { capture: true } as any);
  }, [activeTab, performZoomAt]);

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
      if (node.type === 'project') {
        const isExp = expandedProjectNodes[node.id];
        if (isExp) {
          return {
            width: node.width && node.width >= 600 ? node.width : 740,
            height: node.height && node.height >= 380 ? node.height : 480,
          };
        }
        return {
          width: node.width && node.width <= 260 ? node.width : 200,
          height: node.height && node.height <= 160 ? node.height : 120,
        };
      }
      if (expandedCliNodes[node.id] || node.type === 'ide') {
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
    [expandedCliNodes, expandedProjectNodes]
  );

  // Modo Maestro: um node "gerente" recruta/dispensa outros agentes via prompt natural
  const [maestroDrafts, setMaestroDrafts] = useState<Record<string, string>>({});
  const [maestroBusy, setMaestroBusy] = useState<Record<string, boolean>>({});
  const [maestroRawError, setMaestroRawError] = useState<Record<string, string>>({});

  const toggleNodeMaestro = useCallback((nodeId: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, isMaestro: !n.isMaestro } : n)));
  }, []);

  const parseMaestroPlan = (raw: string): { recruits: { name: string; role?: string; instructions?: string; connectTo?: string[] }[]; dismiss: string[] } => {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = (fenced ? fenced[1] : raw).trim();
    const parsed = JSON.parse(jsonText);
    return {
      recruits: Array.isArray(parsed.recruits) ? parsed.recruits : [],
      dismiss: Array.isArray(parsed.dismiss) ? parsed.dismiss : [],
    };
  };

  const handleMaestroRecruit = useCallback(
    async (maestroNodeId: string) => {
      const draft = (maestroDrafts[maestroNodeId] || '').trim();
      if (!draft) return;
      const maestroNode = nodes.find((n) => n.id === maestroNodeId);
      if (!maestroNode) return;

      setMaestroBusy((prev) => ({ ...prev, [maestroNodeId]: true }));
      setMaestroRawError((prev) => ({ ...prev, [maestroNodeId]: '' }));

      const systemPrompt = `Você é um orquestrador de agentes de IA. Dado o pedido do usuário, responda ESTRITAMENTE com um JSON (sem texto adicional, sem markdown) no formato:
{"recruits": [{"name": "string curto", "role": "string curto (ex: Desenvolvedor, Revisor, Testador)", "instructions": "instruções detalhadas do que esse agente deve fazer", "connectTo": ["título de nota/memória existente, opcional"]}], "dismiss": ["id de node a remover, opcional"]}

Pedido do usuário: ${draft}`;

      let rawResponse = '';
      try {
        const result = await window.electronAPI?.ai?.prompt?.(systemPrompt, 'claude-headless', effectiveWorkspacePath);
        rawResponse = result?.response || '';
        const plan = parseMaestroPlan(rawResponse);

        const { width: mW, height: mH } = getNodeDimensions(maestroNode);
        const RECRUIT_W = 210;
        const RECRUIT_H = 160;
        const GAP = 40;
        const totalWidth = plan.recruits.length * RECRUIT_W + (plan.recruits.length - 1) * GAP;
        const startX = maestroNode.x + mW / 2 - totalWidth / 2;
        const startY = maestroNode.y + mH + 90;

        const newNodes: WorkflowNode[] = [];
        const newEdges: WorkflowEdge[] = [];
        const rolesSnapshot = [...roles];

        for (let i = 0; i < plan.recruits.length; i++) {
          const recruit = plan.recruits[i];
          const recruitProvider = maestroNode.provider || (selectedAiProvider as AiProviderId) || 'claude';
          const newId = `node-model-${Date.now()}-${i}`;
          let roleId: string | undefined;
          if (recruit.role && recruit.instructions) {
            const existing = rolesSnapshot.find((r) => r.name.toLowerCase() === recruit.role!.toLowerCase());
            if (existing) {
              roleId = existing.id;
            } else {
              const created = await window.electronAPI?.roles?.create?.({
                name: recruit.role,
                color: accentColor,
                instructions: recruit.instructions,
              });
              if (created) {
                roleId = created.id;
                rolesSnapshot.push(created);
              }
            }
          }

          // Item 5: Recrutados são nós de modelo com provider (nunca nós 'tool' shell)
          newNodes.push({
            id: newId,
            type: 'model',
            title: recruit.name || recruit.role || 'Agente recrutado',
            subtitle: 'Sonnet 3.7',
            provider: recruitProvider,
            x: Math.round(startX + i * (RECRUIT_W + GAP)),
            y: Math.round(startY),
            width: RECRUIT_W,
            height: RECRUIT_H,
            status: 'ready',
            roleId,
            config: {
              model: 'Sonnet 3.7',
              temperature: 0.7,
              maxTokens: 2048,
            },
            ports: { input: ['in'], output: ['out'] },
          });

          if (recruit.connectTo?.length) {
            for (const targetTitle of recruit.connectTo) {
              const targetNode = nodes.find(
                (n) => n.title.toLowerCase() === targetTitle.toLowerCase()
              );
              if (targetNode) {
                newEdges.push({
                  id: `edge-${Date.now()}-${i}-${targetNode.id}`,
                  fromNodeId: targetNode.id,
                  fromPort: 'out',
                  toNodeId: newId,
                  toPort: 'in',
                  color: accentColor,
                });
              }
            }
          }
        }

        if (rolesSnapshot.length !== roles.length) setRoles(rolesSnapshot);

        const dismissIds = new Set(plan.dismiss.filter((id) => nodes.some((n) => n.id === id)));
        if (dismissIds.size > 0) {
          // Encerra PTYs de nós dispensados pelo Maestro (Item 20)
          killNodeSessions(Array.from(dismissIds), activeFloorId);
        }

        setNodes((prev) => [...prev.filter((n) => !dismissIds.has(n.id)), ...newNodes]);
        if (dismissIds.size > 0 || newEdges.length > 0) {
          setEdges((prev) => [
            ...prev.filter((e) => !dismissIds.has(e.fromNodeId) && !dismissIds.has(e.toNodeId)),
            ...newEdges,
          ]);
        }

        setMaestroDrafts((prev) => ({ ...prev, [maestroNodeId]: '' }));
        onToast?.(
          `Maestro: ${newNodes.length} agente(s) recrutado(s)${dismissIds.size ? `, ${dismissIds.size} dispensado(s)` : ''}.`
        );
      } catch (err) {
        setMaestroRawError((prev) => ({
          ...prev,
          [maestroNodeId]: rawResponse
            ? `A resposta da IA não veio em JSON válido. Resposta bruta:\n\n${rawResponse}`
            : `Erro ao consultar a IA: ${err instanceof Error ? err.message : String(err)}`,
        }));
      } finally {
        setMaestroBusy((prev) => ({ ...prev, [maestroNodeId]: false }));
      }
    },
    [maestroDrafts, nodes, roles, effectiveWorkspacePath, accentColor, getNodeDimensions, onToast]
  );

  // Ombro: responde perguntas sobre o estado dos agentes com base nos resumos coletados
  const askOmbro = useCallback(
    async (question: string, context: string): Promise<string> => {
      const prompt = `Você é um assistente que observa agentes de IA rodando num canvas de orquestração. Responda de forma curta e direta (2-4 frases), em português, com base no contexto abaixo. Não invente informação que não está no contexto.

Contexto dos agentes:
${context || 'Nenhum agente com atividade registrada ainda.'}

Pergunta do usuário: ${question}`;
      try {
        const result = await window.electronAPI?.ai?.prompt?.(prompt, 'claude-headless', effectiveWorkspacePath);
        return result?.response?.trim() || 'Sem resposta.';
      } catch (err) {
        return `Erro ao consultar: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
    [effectiveWorkspacePath]
  );

  // Flags das skills ativas do DevFlow para os CLIs abertos no terminal (ex.: --plugin-dir do Claude)
  const [skillFlags, setSkillFlags] = useState<{ claude: string; agy: string }>({ claude: '', agy: '' });
  useEffect(() => {
    const load = async () => {
      try {
        const api = window.electronAPI?.skills;
        if (!api) return;
        const [claude, agy] = await Promise.all([api.call('cliArgsString', { cmd: 'claude' }), api.call('cliArgsString', { cmd: 'agy' })]);
        setSkillFlags({ claude: claude?.data || '', agy: agy?.data || '' });
      } catch (err) {
        console.warn('[Orchestration] Failed to load skill flags:', err);
      }
    };
    load();
    return window.electronAPI?.skills?.onChanged?.(load);
  }, []);

  const getInitialCliCommand = useCallback(
    (node: WorkflowNode) => {
      // Para nós de agente e modelo de IA, NÃO inicia a IA automaticamente ao abrir o CLI.
      // O card minimizado ou aberto apenas exibe o que está acontecendo/aconteceu na execução.
      if (node.type === 'agent' || node.type === 'model') {
        return '';
      }

      if (node.type === 'ide' || node.type === 'tool') {
        return node.config.command || '';
      }

      return '';
    },
    []
  );

  const getNodeCliSessionType = useCallback(
    (targetNode: WorkflowNode): string => {
      if (targetNode.type === 'agent' || targetNode.type === 'model') {
        const connectedModelNode = edges
          .filter((e) => e.fromNodeId === targetNode.id || e.toNodeId === targetNode.id)
          .map((e) => nodes.find((n) => n.id === (e.fromNodeId === targetNode.id ? e.toNodeId : e.fromNodeId) && n.type === 'model'))
          .find(Boolean);
        const resolvedNode = targetNode.type === 'model' ? targetNode : (connectedModelNode || targetNode);
        const rawProv = (resolvedNode.provider || targetNode.provider || selectedAiProvider || 'antigravity').toLowerCase();
        if (rawProv.includes('antigravity') || rawProv.includes('agy')) return 'agy';
        if (rawProv.includes('claude')) return 'claude';
        if (rawProv.includes('gemini')) return 'gemini';
        if (rawProv.includes('codex') || rawProv.includes('openai')) return 'codex';
        if (rawProv.includes('ollama')) return 'ollama';
        return 'agy';
      }
      return 'zsh';
    },
    [nodes, edges, selectedAiProvider]
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
        setOpenedCliNodeIds((prev) => new Set([...prev, nodeId]));
        setIsInstructionVisible(false);

        // Save current positions of other nodes for this CLI
        const origMap: Record<string, { x: number; y: number }> = {};
        const shiftedMap: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          origMap[n.id] = { x: n.x, y: n.y };
        });
        cliOriginalPositionsRef.current[nodeId] = origMap;

        // Shift neighboring nodes away so they are not covered
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === nodeId) return n.needsAttention ? { ...n, needsAttention: false } : n;

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

            if (newX !== n.x || newY !== n.y) {
              shiftedMap[n.id] = { x: newX, y: newY };
            }

            return { ...n, x: newX, y: newY };
          })
        );
        cliShiftedPositionsRef.current[nodeId] = shiftedMap;

        if (onToast) {
          onToast(`CLI aberto para "${targetNode.title}"`);
        }
      } else {
        // Closing CLI: restore original positions of neighbors if untouched (Item 52)
        const savedPositions = cliOriginalPositionsRef.current[nodeId];
        const shiftedMap = cliShiftedPositionsRef.current[nodeId];
        if (savedPositions) {
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              if (n.id === nodeId) return n;
              if (savedPositions[n.id]) {
                const wasShifted = shiftedMap?.[n.id];
                if (!wasShifted || (n.x === wasShifted.x && n.y === wasShifted.y)) {
                  return {
                    ...n,
                    x: savedPositions[n.id].x,
                    y: savedPositions[n.id].y,
                  };
                }
              }
              return n;
            })
          );
          delete cliOriginalPositionsRef.current[nodeId];
          delete cliShiftedPositionsRef.current[nodeId];
        }

        if (onToast) {
          onToast(`CLI fechado para "${targetNode.title}"`);
        }
      }
    },
    [nodes, expandedCliNodes, getNodeDimensions, onToast, roles]
  );

  const toggleProjectNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      const isOpening = !expandedProjectNodes[nodeId];

      setExpandedProjectNodes((prev) => ({
        ...prev,
        [nodeId]: isOpening,
      }));

      const EXP_W = 740;
      const EXP_H = 480;
      const currentDims = getNodeDimensions(targetNode);
      const deltaW = EXP_W - currentDims.width;
      const deltaH = EXP_H - currentDims.height;

      if (isOpening) {
        setIsInstructionVisible(false);

        // Save current positions of other nodes for this project node
        const origMap: Record<string, { x: number; y: number }> = {};
        const shiftedMap: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          origMap[n.id] = { x: n.x, y: n.y };
        });
        projectOriginalPositionsRef.current[nodeId] = origMap;

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
              n.y <= targetNode.y + EXP_H + 40;

            // Is node below expanding card?
            const isBelow = n.y >= targetNode.y + currentDims.height * 0.35;
            // Is node horizontally overlapping or close?
            const isHorizOverlap =
              n.x + nDims.width >= targetNode.x - 30 &&
              n.x <= targetNode.x + EXP_W + 40;

            let newX = n.x;
            let newY = n.y;

            if (isToRight && isVertOverlap) {
              newX += deltaW + 50;
            } else if (isBelow && isHorizOverlap) {
              newY += deltaH + 50;
            }

            if (newX !== n.x || newY !== n.y) {
              shiftedMap[n.id] = { x: newX, y: newY };
            }

            return { ...n, x: newX, y: newY };
          })
        );
        projectShiftedPositionsRef.current[nodeId] = shiftedMap;

        if (onToast) {
          onToast(`Projeto "${targetNode.title}" expandido`);
        }
      } else {
        // Closing expanded project: restore original positions of neighbors
        const savedPositions = projectOriginalPositionsRef.current[nodeId];
        const shiftedMap = projectShiftedPositionsRef.current[nodeId];
        if (savedPositions) {
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              if (n.id === nodeId) return n;
              if (savedPositions[n.id]) {
                const wasShifted = shiftedMap?.[n.id];
                if (!wasShifted || (n.x === wasShifted.x && n.y === wasShifted.y)) {
                  return {
                    ...n,
                    x: savedPositions[n.id].x,
                    y: savedPositions[n.id].y,
                  };
                }
              }
              return n;
            })
          );
          delete projectOriginalPositionsRef.current[nodeId];
          delete projectShiftedPositionsRef.current[nodeId];
        }

        if (onToast) {
          onToast(`Projeto "${targetNode.title}" recolhido`);
        }
      }
    },
    [nodes, expandedProjectNodes, getNodeDimensions, onToast]
  );

  // Ombro: resumo da última conclusão de cada agente
  const [nodeSummaries, setNodeSummaries] = useState<Record<string, { summary: string; timestamp: number }>>({});

  // Marca nodes que precisam de atenção quando o agente termina uma tarefa ou falha
  useEffect(() => {
    const markAttention = (sessionId: string) => {
      const parsed = parseOrchestrationCliSessionId(sessionId);
      if (!parsed || (parsed.floorId && parsed.floorId !== activeFloorIdRef.current)) return;
      const nodeId = parsed.nodeId;
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId && !expandedCliNodesRef.current[nodeId] ? { ...n, needsAttention: true } : n))
      );
    };

    const unsubCompleted = window.electronAPI?.pty?.onAiCompleted?.((payload) => {
      markAttention(payload.id);

      const parsed = parseOrchestrationCliSessionId(payload.id);
      if (!parsed || (parsed.floorId && parsed.floorId !== activeFloorIdRef.current)) return;
      const completedNodeId = parsed.nodeId;
      setNodeSummaries((prev) => ({
        ...prev,
        [completedNodeId]: { summary: payload.summary, timestamp: payload.timestamp },
      }));

      // Retransmite o resumo para agentes conectados com "auto-relay" ativado (Item 6 & 22)
      const autoEdges = edgesRef.current.filter((e) => e.fromNodeId === completedNodeId && e.autoRelay);
      for (const edge of autoEdges) {
        const targetNode = nodesRef.current.find((n) => n.id === edge.toNodeId);
        if (!targetNode || !(targetNode.type === 'model' || (targetNode.type === 'agent' && targetNode.provider))) {
          continue;
        }
        if (!expandedCliNodesRef.current[edge.toNodeId]) continue;
        const targetSessionId = getOrchestrationCliSessionId(activeFloorIdRef.current, edge.toNodeId);
        window.electronAPI?.pty?.write?.(targetSessionId, `${payload.summary}\r`);
      }
    });
    const unsubStatus = window.electronAPI?.pty?.onSessionStatus?.((payload) => {
      if (!payload.isRunning && !payload.exited) {
        markAttention(payload.id);
      }
    });

    return () => {
      unsubCompleted?.();
      unsubStatus?.();
    };
  }, []);

  // Cards "em uso": terminal com saída recente (IA respondendo, projeto rodando, comando executando).
  // Os links ligados a eles ficam coloridos e animados; os demais ficam cinza e parados.
  const [busyCliNodeIds, setBusyCliNodeIds] = useState<Set<string>>(() => new Set());
  // Armazena a última atividade/pensamento em tempo real emitida por nós de IA ou agentes
  const [nodeLiveActivity, setNodeLiveActivity] = useState<Record<string, { text: string; timestamp: number }>>({});
  const lastActivityUpdateRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const unsub = window.electronAPI?.pty?.onData?.((payload) => {
      const parsed = parseOrchestrationCliSessionId(payload.id);
      if (!parsed || (parsed.floorId && parsed.floorId !== activeFloorIdRef.current)) return;
      const nodeId = parsed.nodeId;

      // Extrai a linha de atividade legível em tempo real do stream
      const rawData = payload.data || '';
      const extracted = extractAiActivityText(rawData);
      if (extracted) {
        // Só troca o texto quando a atividade realmente muda e o anterior ficou visível por um tempo mínimo
        // (o TUI redesenha a tela o tempo todo e gerava um pisca-pisca com a mesma frase)
        const now = Date.now();
        const lastTime = lastActivityUpdateRef.current[nodeId] || 0;
        if (now - lastTime > 1500) {
          setNodeLiveActivity((prev) => {
            if (prev[nodeId] && activityKey(prev[nodeId].text) === activityKey(extracted)) return prev;
            lastActivityUpdateRef.current[nodeId] = now;
            return {
              ...prev,
              [nodeId]: { text: extracted, timestamp: now },
            };
          });
        }
      }

      const pending = timers.get(nodeId);
      if (pending) {
        clearTimeout(pending);
      } else {
        setBusyCliNodeIds((prev) => {
          if (prev.has(nodeId)) return prev;
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
      }
      timers.set(
        nodeId,
        setTimeout(() => {
          timers.delete(nodeId);
          setBusyCliNodeIds((prev) => {
            if (!prev.has(nodeId)) return prev;
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
        }, 2500)
      );
    });
    return () => {
      unsub?.();
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

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

  // Centraliza a câmera num único node (mantendo o zoom atual) e o seleciona
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const { width, height } = getNodeDimensions(node);
      const centerX = node.x + width / 2;
      const centerY = node.y + height / 2;
      const canvasEl = canvasRef.current;
      const canvasW = canvasEl?.clientWidth || window.innerWidth;
      const canvasH = canvasEl?.clientHeight || window.innerHeight;
      setPan({
        x: Math.round(canvasW / 2 - centerX * zoom),
        y: Math.round(canvasH / 2 - centerY * zoom),
      });
      setSelectedNodeId(nodeId);
    },
    [nodes, getNodeDimensions, zoom]
  );

  // Percorre os nodes que precisam de atenção, focando o próximo a cada chamada
  const attentionCursorRef = useRef(0);
  const handleFocusNextAttention = useCallback(() => {
    const pending = nodes.filter((n) => n.needsAttention);
    if (pending.length === 0) {
      if (onToast) onToast('Nenhum agente aguardando atenção');
      return;
    }
    attentionCursorRef.current = attentionCursorRef.current % pending.length;
    const target = pending[attentionCursorRef.current];
    attentionCursorRef.current += 1;
    handleFocusNode(target.id);
  }, [nodes, handleFocusNode, onToast]);

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
        const dyn = nodeHandlePositionsRef.current[nodeId];
        if (dyn) {
          if (dyn.side === 'bottom') {
            return { x: node.x + dyn.x, y: node.y + height + outerPad };
          }
          if (dyn.side === 'top') {
            return { x: node.x + dyn.x, y: node.y - outerPad };
          }
          if (dyn.side === 'right') {
            return { x: node.x + width + outerPad, y: node.y + dyn.y };
          }
        }
        return { x: node.x + width + outerPad, y: node.y + height / 2 };
      }

      // Input port
      const dynIn = nodeInputHandlePositionsRef.current[nodeId];
      if (dynIn) {
        if (dynIn.side === 'bottom') {
          return { x: node.x + dynIn.x, y: node.y + height + outerPad };
        }
        if (dynIn.side === 'top') {
          return { x: node.x + dynIn.x, y: node.y - outerPad };
        }
        if (dynIn.side === 'right') {
          return { x: node.x + width + outerPad, y: node.y + dynIn.y };
        }
        return { x: node.x - outerPad, y: node.y + dynIn.y };
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

      // 1. Origem da conexão (from)
      let fromPoint = { x: fromNode.x + fromDims.width + outerPad, y: fromNode.y + fromDims.height / 2 };
      let fromDir: 'right' | 'down' | 'up' | 'left' = 'right';

      if (edge.fromSide === 'bottom') {
        const ratio = edge.fromRatio ?? 0.5;
        fromPoint = { x: fromNode.x + fromDims.width * ratio, y: fromNode.y + fromDims.height + outerPad };
        fromDir = 'down';
      } else if (edge.fromSide === 'top') {
        const ratio = edge.fromRatio ?? 0.5;
        fromPoint = { x: fromNode.x + fromDims.width * ratio, y: fromNode.y - outerPad };
        fromDir = 'up';
      } else if (edge.fromSide === 'right') {
        const ratio = edge.fromRatio ?? 0.5;
        fromPoint = { x: fromNode.x + fromDims.width + outerPad, y: fromNode.y + fromDims.height * ratio };
        fromDir = 'right';
      } else if (dy > fromDims.height * 0.65 && Math.abs(dx) < 320) {
        const portOffset = edge.fromPort === 'memory' ? fromDims.width * 0.65 : fromDims.width * 0.25;
        fromPoint = { x: fromNode.x + portOffset, y: fromNode.y + fromDims.height + outerPad };
        fromDir = 'down';
      }

      // 2. Destino da conexão (to)
      let toPoint = { x: toNode.x - outerPad, y: toNode.y + toDims.height / 2 };
      let toDir: 'left' | 'up' | 'down' | 'right' = 'left';

      if (edge.toSide === 'top') {
        const ratio = edge.toRatio ?? 0.5;
        toPoint = { x: toNode.x + toDims.width * ratio, y: toNode.y - outerPad };
        toDir = 'up';
      } else if (edge.toSide === 'bottom') {
        const ratio = edge.toRatio ?? 0.5;
        toPoint = { x: toNode.x + toDims.width * ratio, y: toNode.y + toDims.height + outerPad };
        toDir = 'down';
      } else if (edge.toSide === 'right') {
        const ratio = edge.toRatio ?? 0.5;
        toPoint = { x: toNode.x + toDims.width + outerPad, y: toNode.y + toDims.height * ratio };
        toDir = 'right';
      } else if (edge.toSide === 'left') {
        const ratio = edge.toRatio ?? 0.5;
        toPoint = { x: toNode.x - outerPad, y: toNode.y + toDims.height * ratio };
        toDir = 'left';
      } else if (fromDir === 'down' && dy > 0 && Math.abs(dx) < 180) {
        toPoint = { x: toNode.x + toDims.width / 2, y: toNode.y - outerPad };
        toDir = 'up';
      } else if (fromDir === 'up' && dy < 0 && Math.abs(dx) < 180) {
        toPoint = { x: toNode.x + toDims.width / 2, y: toNode.y + toDims.height + outerPad };
        toDir = 'down';
      }

      return {
        from: fromPoint,
        to: toPoint,
        fromDir,
        toDir,
      };
    },
    [nodes, getNodeDimensions]
  );

  // Window listeners for smooth, failsafe dragging of the link tag across the canvas/screen
  useEffect(() => {
    if (!draggingTagEdgeId) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!draggingTagRef.current || !canvasRef.current) return;
      const edgeId = draggingTagRef.current.edgeId;
      const targetEdge = edgesRef.current.find((edge) => edge.id === edgeId);
      if (!targetEdge) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

      const { from, to, fromDir, toDir } = getConnectionEndpoints(targetEdge);
      const geom = getCableGeometry(from, to, fromDir, toDir);
      const bestT = findClosestTOnCubicBezier(
        geom.p1,
        geom.cp1,
        geom.cp2,
        geom.p2,
        { x: mouseCanvasX, y: mouseCanvasY },
        0.08,
        0.92,
        45
      );

      draggingTagRef.current.hasMoved = true;
      setEdges((prev) =>
        prev.map((edge) =>
          edge.id === edgeId ? { ...edge, labelRatio: bestT } : edge
        )
      );
    };

    const handleWindowMouseUp = () => {
      draggingTagRef.current = null;
      setDraggingTagEdgeId(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingTagEdgeId, pan.x, pan.y, zoom, getConnectionEndpoints]);

  // ============================================================================
  // DRAGGING NODES, PANNING & INTERACTIVE LINK DRAGGING
  // ============================================================================

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // O popup de Modelos de IA fecha pelo listener de clique-fora do documento (que ignora o próprio
    // popup). Fechar aqui desmontava o popup no mousedown e o clique no modelo nunca chegava.
    if (!nodeOptionsPopupRef.current?.contains(e.target as Node)) {
      setNodeOptionsPopup(null);
    }

    const targetEl = e.target as HTMLElement;
    const isCard = !!targetEl.closest('[data-node-card="true"]');
    const isInstruction = !!targetEl.closest('[data-instruction-panel="true"]');
    const isSelectionToolbar = !!targetEl.closest('[data-selection-toolbar="true"]');
    const isInteractiveButton =
      !!targetEl.closest('button') ||
      !!targetEl.closest('input') ||
      !!targetEl.closest('textarea') ||
      !!targetEl.closest('[data-node-modal="true"]');

    if (isInteractiveButton || isSelectionToolbar) return;

    // Pan canvas: Right-click (2), Middle-click (1), or Space+Left-click, or Alt+Left-click
    if (e.button === 2 || e.button === 1 || ((e.altKey || isSpacePressedRef.current) && e.button === 0)) {
      setIsPanning(true);
      panMouseButtonRef.current = e.button;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      if (e.button === 2) {
        hasRightDraggedRef.current = false;
        rightDragStartRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    // Left-click (button === 0) on canvas background: ALWAYS initiate marquee box selection
    if (!isCard && !isInstruction && e.button === 0) {
      e.preventDefault();
      setIsPanning(false);
      isSelectingRef.current = true;
      selectionStartRef.current = { x: e.clientX, y: e.clientY };
      const isAppend = e.shiftKey || e.metaKey || e.ctrlKey;
      selectionInitialIdsRef.current = isAppend ? [...selectedNodeIdsRef.current] : [];
      setSelectionBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
      if (!isAppend) {
        setSelectedNodeIds([]);
        setSelectedNodeId(null);
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
      const isCli = targetNode ? Boolean(expandedCliNodes[targetNode.id] || targetNode.type === 'ide') : false;
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

    if (draggingNodeId) {
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
          dragStartPositionRef.current.x += panDeltaX;
          dragStartPositionRef.current.y += panDeltaY;
        }
      }

      const dx = Math.round((e.clientX - dragStartPositionRef.current.x) / zoom);
      const dy = Math.round((e.clientY - dragStartPositionRef.current.y) / zoom);

      const isMultiDrag = selectedNodeIdsRef.current.includes(draggingNodeId) && selectedNodeIdsRef.current.length > 1;
      const initialPositions = dragStartNodePositionsRef.current;

      if (isMultiDrag) {
        setNodes((prev) =>
          prev.map((n) => {
            if (selectedNodeIdsRef.current.includes(n.id) && initialPositions[n.id]) {
              return {
                ...n,
                x: initialPositions[n.id].x + dx,
                y: initialPositions[n.id].y + dy,
              };
            }
            return n;
          })
        );
      } else {
        const newX = Math.round((e.clientX - dragOffsetRef.current.x) / zoom);
        const newY = Math.round((e.clientY - dragOffsetRef.current.y) / zoom);
        setNodes((prev) =>
          prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
        );
      }
      return;
    }

    if (draggingTagRef.current && canvasRef.current) {
      const edgeId = draggingTagRef.current.edgeId;
      const targetEdge = edgesRef.current.find((e) => e.id === edgeId);
      if (targetEdge) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

        const { from, to, fromDir, toDir } = getConnectionEndpoints(targetEdge);
        const geom = getCableGeometry(from, to, fromDir, toDir);
        const bestT = findClosestTOnCubicBezier(
          geom.p1,
          geom.cp1,
          geom.cp2,
          geom.p2,
          { x: mouseCanvasX, y: mouseCanvasY },
          0.08,
          0.92,
          45
        );

        draggingTagRef.current.hasMoved = true;
        setEdges((prev) =>
          prev.map((edge) =>
            edge.id === edgeId ? { ...edge, labelRatio: bestT } : edge
          )
        );
      }
      return;
    }

    if (isSelectingRef.current) {
      setSelectionBox((prev) =>
        prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null
      );
      const dist = Math.hypot(
        e.clientX - selectionStartRef.current.x,
        e.clientY - selectionStartRef.current.y
      );
      if (dist > 4 && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const screenMinX = Math.min(selectionStartRef.current.x, e.clientX);
        const screenMaxX = Math.max(selectionStartRef.current.x, e.clientX);
        const screenMinY = Math.min(selectionStartRef.current.y, e.clientY);
        const screenMaxY = Math.max(selectionStartRef.current.y, e.clientY);

        // Convert selection box to canvas coordinate space
        const boxX1 = (screenMinX - canvasRect.left - pan.x) / zoom;
        const boxX2 = (screenMaxX - canvasRect.left - pan.x) / zoom;
        const boxY1 = (screenMinY - canvasRect.top - pan.y) / zoom;
        const boxY2 = (screenMaxY - canvasRect.top - pan.y) / zoom;

        const enclosedIds: string[] = [];
        for (const n of nodes) {
          const { width: nw, height: nh } = getNodeDimensions(n);
          const nodeX1 = n.x;
          const nodeX2 = n.x + nw;
          const nodeY1 = n.y;
          const nodeY2 = n.y + nh;
          const overlaps = !(nodeX2 < boxX1 || nodeX1 > boxX2 || nodeY2 < boxY1 || nodeY1 > boxY2);
          if (overlaps) {
            enclosedIds.push(n.id);
          }
        }

        const combined = Array.from(new Set([...selectionInitialIdsRef.current, ...enclosedIds]));
        setSelectedNodeIds(combined);
        if (combined.length === 1) {
          setSelectedNodeId(combined[0]);
        } else {
          setSelectedNodeId(null);
          setIsInstructionVisible(false);
        }
      }
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
    } else if (draggingLink && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = Math.round((e.clientX - rect.left - pan.x) / zoom);
      const mouseY = Math.round((e.clientY - rect.top - pan.y) / zoom);

      // Magnetic snapping to target ports (como um ímã dinâmico no perímetro do card)
      let snappedTarget: {
        nodeId: string;
        port: string;
        side: 'left' | 'top' | 'bottom' | 'right';
        ratio: number;
        x: number;
        y: number;
      } | null = null;
      let minDistance = Infinity;

      for (const n of nodes) {
        if (n.id === draggingLink.fromNodeId) continue;
        if (!n.ports?.input || !Array.isArray(n.ports.input) || n.ports.input.length === 0) continue;

        const { width, height } = getNodeDimensions(n);
        const relX = mouseX - n.x;
        const relY = mouseY - n.y;

        // Raio magnético ao redor de todo o card alvo
        const snapPad = 50;
        const isNearCard =
          mouseX >= n.x - snapPad &&
          mouseX <= n.x + width + snapPad &&
          mouseY >= n.y - snapPad &&
          mouseY <= n.y + height + snapPad;

        if (isNearCard) {
          const inPos = computeInputHandlePosition(relX, relY, width, height);
          updateNodeInputHandlePosition(n.id, inPos);

          const outerPad = 7;
          let targetX = n.x - outerPad;
          let targetY = n.y + inPos.y;
          if (inPos.side === 'right') {
            targetX = n.x + width + outerPad;
            targetY = n.y + inPos.y;
          } else if (inPos.side === 'top') {
            targetX = n.x + inPos.x;
            targetY = n.y - outerPad;
          } else if (inPos.side === 'bottom') {
            targetX = n.x + inPos.x;
            targetY = n.y + height + outerPad;
          }

          const dist = Math.hypot(mouseX - targetX, mouseY - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            snappedTarget = {
              nodeId: n.id,
              port: 'in',
              side: inPos.side,
              ratio: inPos.ratio,
              x: targetX,
              y: targetY,
            };
          }
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
                snappedSide: snappedTarget!.side,
                snappedRatio: snappedTarget!.ratio,
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
                snappedSide: undefined,
                snappedRatio: undefined,
              }
            : null
        );
      }
    }

    // Se nenhum arrasto/seleção/pan estiver ativo, rastrear dinamicamente a posição das bolinhas no card hovered
    if (!resizingNode && !draggingNodeId && !isSelectingRef.current && !isPanning && !draggingLink && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const mouseCanvasX = (e.clientX - canvasRect.left - pan.x) / zoom;
      const mouseCanvasY = (e.clientY - canvasRect.top - pan.y) / zoom;

      let targetNode = hoveredNodeId ? nodes.find((n) => n.id === hoveredNodeId) : null;
      if (!targetNode) {
        targetNode = nodes.find((n) => {
          const { width, height } = getNodeDimensions(n);
          return (
            mouseCanvasX >= n.x - 8 &&
            mouseCanvasX <= n.x + width + 14 &&
            mouseCanvasY >= n.y - 8 &&
            mouseCanvasY <= n.y + height + 12
          );
        }) || null;
      }

      if (targetNode) {
        const { width, height } = getNodeDimensions(targetNode);
        const relX = mouseCanvasX - targetNode.x;
        const relY = mouseCanvasY - targetNode.y;

        if (
          relX >= -10 &&
          relX <= width + 18 &&
          relY >= -10 &&
          relY <= height + 16
        ) {
          if (hoveredNodeId !== targetNode.id) {
            setHoveredNodeId(targetNode.id);
          }
          const isOverResize =
            (relX >= width - 30 && relY >= height - 30) ||
            (relX <= 26 && relY <= 26);
          setHoveredResizeNodeId((cur) => (isOverResize ? targetNode.id : cur === targetNode.id ? null : cur));

          const edgeThresholdX = Math.min(16, width * 0.08);
          const edgeThresholdY = Math.min(14, height * 0.08);
          const isCentral =
            relX > edgeThresholdX &&
            relX < width - edgeThresholdX &&
            relY > edgeThresholdY &&
            relY < height - edgeThresholdY;
          setCenterHoveredNodeId((cur) => (isCentral ? targetNode.id : cur === targetNode.id ? null : cur));

          if (!isCentral) {
            if (targetNode.ports?.output) {
              const pos = computeHandlePosition(relX, relY, width, height);
              updateNodeHandlePosition(targetNode.id, pos);
            }
            if (targetNode.ports?.input) {
              const inPos = computeInputHandlePosition(relX, relY, width, height);
              updateNodeInputHandlePosition(targetNode.id, inPos);
            }
          }
        } else if (hoveredNodeId === targetNode.id) {
          setHoveredNodeId(null);
          setHoveredResizeNodeId(null);
          setCenterHoveredNodeId(null);
        }
      }
    }
  };

  const handleToggleNodeSize = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (node.type === 'project') {
      toggleProjectNode(node.id);
      return;
    }
    const isCli = Boolean(expandedCliNodes[node.id] || node.type === 'ide');
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
    if (e.button !== 0) return;
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

  const handleMouseUp = (e?: React.MouseEvent | MouseEvent) => {
    if (draggingTagRef.current) {
      draggingTagRef.current = null;
      setDraggingTagEdgeId(null);
    }

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

      if (targetNode && targetNode.id !== draggingLink.fromNodeId) {
        // Item 48: Drop validation - input port & cycle detection
        const hasInputPort = Boolean(targetNode.ports?.input && targetNode.ports.input.length > 0);
        if (!hasInputPort) {
          onToast?.(`O nó "${targetNode.title}" não aceita conexões de entrada.`);
        } else if (wouldCreateCycle(edges, draggingLink.fromNodeId, targetNode.id)) {
          onToast?.('Conexão rejeitada: criaria um ciclo no grafo.');
        } else {
          const linkColor = targetNode.type === 'memory' ? (themeTokens?.textPrimary || '#64748b') : undefined;
          const { width, height } = getNodeDimensions(targetNode);
          const inPos = draggingLink.snappedSide
            ? { side: draggingLink.snappedSide, ratio: draggingLink.snappedRatio ?? 0.5 }
            : computeInputHandlePosition(
                draggingLink.currentX - targetNode.x,
                draggingLink.currentY - targetNode.y,
                width,
                height
              );
          const newEdge: WorkflowEdge = {
            id: `edge-${Date.now()}`,
            fromNodeId: draggingLink.fromNodeId,
            fromPort: draggingLink.fromPort,
            fromSide: draggingLink.fromSide,
            fromRatio: draggingLink.fromRatio,
            toNodeId: targetNode.id,
            toPort: 'in',
            toSide: inPos.side,
            toRatio: inPos.ratio,
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
      }

      setDraggingLink(null);
    }

    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      const clientX = e?.clientX ?? selectionStartRef.current.x;
      const clientY = e?.clientY ?? selectionStartRef.current.y;
      const dist = Math.hypot(
        clientX - selectionStartRef.current.x,
        clientY - selectionStartRef.current.y
      );
      if (dist <= 4 && !e?.shiftKey && !e?.metaKey && !e?.ctrlKey) {
        setSelectedNodeIds([]);
        setSelectedNodeId(null);
      }
      setSelectionBox(null);
    }

    setIsPanning(false);
    panMouseButtonRef.current = null;
    setDraggingNodeId(null);
    setHoveredResizeNodeId(null);
    setCenterHoveredNodeId(null);
    setNodeInputHandlePositions({});
    nodeInputHandlePositionsRef.current = {};
  };

  handleMouseUpRef.current = handleMouseUp;

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button === 2) {
      // Clique com botão direito no card: previne iniciar pan do canvas para permitir o contextmenu do card
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    setIsPanning(false);
    isSelectingRef.current = false;
    setSelectionBox(null);
    if (draggingLink && draggingLink.fromNodeId !== nodeId) {
      e.stopPropagation();
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        const hasInputPort = Boolean(targetNode.ports?.input && targetNode.ports.input.length > 0);
        if (!hasInputPort) {
          onToast?.(`O nó "${targetNode.title}" não aceita conexões de entrada.`);
        } else if (wouldCreateCycle(edges, draggingLink.fromNodeId, targetNode.id)) {
          onToast?.('Conexão rejeitada: criaria um ciclo no grafo.');
        } else {
          const linkColor = targetNode.type === 'memory' ? (themeTokens?.textPrimary || '#64748b') : undefined;
          const { width, height } = getNodeDimensions(targetNode);
          const inPos = draggingLink.snappedSide
            ? { side: draggingLink.snappedSide, ratio: draggingLink.snappedRatio ?? 0.5 }
            : computeInputHandlePosition(
                draggingLink.currentX - targetNode.x,
                draggingLink.currentY - targetNode.y,
                width,
                height
              );
          const newEdge: WorkflowEdge = {
            id: `edge-${Date.now()}`,
            fromNodeId: draggingLink.fromNodeId,
            fromPort: draggingLink.fromPort,
            fromSide: draggingLink.fromSide,
            fromRatio: draggingLink.fromRatio,
            toNodeId: targetNode.id,
            toPort: 'in',
            toSide: inPos.side,
            toRatio: inPos.ratio,
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
        return;
      }
    }
    if (nodeOptionsPopup && nodeOptionsPopup.nodeId !== nodeId) {
      setNodeOptionsPopup(null);
    }
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedNodeIds((prev) => {
        const next = prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];
        setSelectedNodeId(next.length > 0 ? next[next.length - 1] : null);
        return next;
      });
    } else if (!selectedNodeIdsRef.current.includes(nodeId)) {
      setSelectedNodeIds([nodeId]);
      setSelectedNodeId(nodeId);
    } else {
      setSelectedNodeId(nodeId);
    }

    setDraggingNodeId(nodeId);
    hasDraggedRef.current = false;
    dragStartPositionRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = {
      x: e.clientX - node.x * zoom,
      y: e.clientY - node.y * zoom,
    };
    dragStartNodePositionsRef.current = Object.fromEntries(
      nodes.map((n) => [n.id, { x: n.x, y: n.y }])
    );
  };

  const handleStartDraggingLink = (
    nodeId: string,
    portName: string,
    e: React.MouseEvent,
    handleInfo?: {
      side: 'right' | 'bottom' | 'top';
      ratio: number;
      fromX: number;
      fromY: number;
    }
  ) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const mouseY = Math.round((e.clientY - rect.top - pan.y) / zoom);

    const node = nodes.find((n) => n.id === nodeId);
    const dims = node ? getNodeDimensions(node) : { width: 220, height: 150 };
    const outerPad = 7;

    let originX: number;
    let originY: number;
    let originDir: 'right' | 'down' | 'up' = 'right';
    let originSide: 'right' | 'bottom' | 'top' = 'right';
    let originRatio = 0.5;

    if (handleInfo && node) {
      originSide = handleInfo.side;
      originRatio = handleInfo.ratio;
      originX = handleInfo.fromX;
      originY = handleInfo.fromY;
      originDir = handleInfo.side === 'bottom' ? 'down' : handleInfo.side === 'top' ? 'up' : 'right';
    } else if (node && portName === 'chat_model') {
      originDir = 'down';
      originSide = 'bottom';
      originRatio = 0.25;
      originX = node.x + dims.width * 0.25;
      originY = node.y + dims.height + outerPad;
    } else if (node && portName === 'memory') {
      originDir = 'down';
      originSide = 'bottom';
      originRatio = 0.65;
      originX = node.x + dims.width * 0.65;
      originY = node.y + dims.height + outerPad;
    } else if (node) {
      const dyn = nodeHandlePositionsRef.current[nodeId];
      if (dyn) {
        originSide = dyn.side;
        originRatio = dyn.ratio;
        originDir = dyn.side === 'bottom' ? 'down' : dyn.side === 'top' ? 'up' : 'right';
        originX = node.x + (dyn.side === 'right' ? dims.width + outerPad : dyn.x);
        originY = node.y + (dyn.side === 'bottom' ? dims.height + outerPad : dyn.side === 'top' ? -outerPad : dyn.y);
      } else {
        originDir = 'right';
        originSide = 'right';
        originRatio = 0.5;
        originX = node.x + dims.width + outerPad;
        originY = node.y + dims.height / 2;
      }
    } else {
      originX = mouseX;
      originY = mouseY;
    }

    setDraggingLink({
      fromNodeId: nodeId,
      fromPort: portName,
      fromDir: originDir,
      fromSide: originSide,
      fromRatio: originRatio,
      fromX: originX,
      fromY: originY,
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

    const fromNode = nodes.find((n) => n.id === edge.fromNodeId);
    const fromDims = fromNode ? getNodeDimensions(fromNode) : { width: 220, height: 150 };
    const outerPad = 7;
    let fromX = mouseX;
    let fromY = mouseY;
    let fromDir: 'right' | 'down' | 'up' = 'right';

    if (fromNode) {
      if (edge.fromSide === 'bottom') {
        fromDir = 'down';
        fromX = fromNode.x + fromDims.width * (edge.fromRatio ?? 0.5);
        fromY = fromNode.y + fromDims.height + outerPad;
      } else if (edge.fromSide === 'top') {
        fromDir = 'up';
        fromX = fromNode.x + fromDims.width * (edge.fromRatio ?? 0.5);
        fromY = fromNode.y - outerPad;
      } else if (edge.fromSide === 'right') {
        fromDir = 'right';
        fromX = fromNode.x + fromDims.width + outerPad;
        fromY = fromNode.y + fromDims.height * (edge.fromRatio ?? 0.5);
      } else {
        const coords = getPortCoordinates(edge.fromNodeId, 'output', edge.fromPort);
        fromX = coords.x;
        fromY = coords.y;
        fromDir = edge.fromPort === 'chat_model' || edge.fromPort === 'memory' ? 'down' : 'right';
      }
    }

    // Live dragging from original source
    setDraggingLink({
      fromNodeId: edge.fromNodeId,
      fromPort: edge.fromPort,
      fromDir,
      fromSide: edge.fromSide,
      fromRatio: edge.fromRatio,
      fromX,
      fromY,
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
  // WORKFLOW EXECUTION (REAL FUNCTIONAL WITH TOPOLOGICAL SORT & CANCEL)
  // ============================================================================

  const handleCancelWorkflow = useCallback(() => {
    cancelWorkflowRef.current = true;
    const runIdToCancel = runningWorkflowRunIdRef.current;
    activeRunsRef.current.forEach((run) => {
      run.ctl.cancelled = true;
      run.runIds.forEach((id) => {
        try { window.electronAPI?.ai?.cancel?.(id); } catch {}
      });
    });

    try {
      window.electronAPI?.ai?.cancel?.(runIdToCancel || undefined);
    } catch (err) {
      console.warn('[Orchestration] Failed to cancel workflow run:', err);
    }
    try {
      window.electronAPI?.ai?.cancelOrchestration?.(runIdToCancel || '');
    } catch {}

    // Immediately stop flow execution UI state
    setIsExecutingFlow(false);
    runningWorkflowRunIdRef.current = null;

    // Interrupt any running CLI session with SIGINT / Ctrl+C
    busyCliNodeIds.forEach((nId) => {
      const sId = getOrchestrationCliSessionId(activeFloorIdRef.current, nId);
      try {
        window.electronAPI?.pty?.write?.(sId, '\x03');
      } catch {}
    });

    // Immediately mark all running nodes as cancelled
    setNodes((prev) =>
      prev.map((n) => (n.status === 'running' ? { ...n, status: 'cancelled' } : n))
    );

    // Immediately stop active dynamic edge effects and clear all timers
    setEdges((prev) => prev.map((e) => ({ ...e, isActive: false })));
    setActiveDynamicEdgeIds(new Set());
    setBusyCliNodeIds(new Set());
    setNodeLiveActivity({});
    activeEdgeTimersRef.current.forEach((t) => clearTimeout(t));
    activeEdgeTimersRef.current.clear();

    onToast?.('Execução do fluxo interrompida pelo usuário.');
  }, [onToast, busyCliNodeIds]);

  const executeWorkflow = async (startArg?: unknown) => {
    const startNodeId = typeof startArg === 'string' ? startArg : undefined;

    // Item 7: Consent check
    const consentKey = `devflow_orch_consent_${effectiveWorkspacePath || 'default'}`;
    const hasConsent = localStorage.getItem(consentKey) === 'true';
    if (!hasConsent) {
      setIsConsentModalOpen(true);
      return;
    }

    // Topological sorting of workflow nodes starting from triggers or root nodes
    const sortResult = topologicalSortWorkflow(nodes as any, edges as any, startNodeId);
    if (sortResult.hasCycle) {
      onToast?.('O fluxo contém ciclos ou dependências circulares. Remova os ciclos antes de executar.');
      return;
    }
    if (sortResult.orderedNodes.length === 0) {
      onToast?.('Nenhum nó conectado para execução.');
      return;
    }

    // Um nó não pode estar em duas execuções ao mesmo tempo; fluxos sem nós em comum rodam em paralelo
    const runningNodeIds = new Set(sortResult.orderedNodes.map((n) => n.id));
    for (const other of activeRunsRef.current.values()) {
      if ([...runningNodeIds].some((id) => other.nodeIds.has(id))) {
        onToast?.('Este fluxo já está em execução.');
        return;
      }
    }
    const runKey = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const run = { nodeIds: runningNodeIds, ctl: { cancelled: false }, runIds: new Set<string>() };
    activeRunsRef.current.set(runKey, run);
    setIsExecutingFlow(true);
    const startTime = Date.now();

    // Se o usuário trocar de andar durante a execução, não escreve o estado deste fluxo no andar novo
    const runFloorId = activeFloorIdRef.current;
    const setRunNodes: typeof setNodes = (u) => { if (activeFloorIdRef.current === runFloorId) setNodes(u); };
    const setRunEdges: typeof setEdges = (u) => { if (activeFloorIdRef.current === runFloorId) setEdges(u); };

    // Reset status only for nodes that will actually run
    setRunNodes((prev) =>
      prev.map((n) => (runningNodeIds.has(n.id) ? { ...n, status: 'ready', output: undefined } : n))
    );

    const outputs = new Map<string, string>();
    let overallSuccess = true;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastSummary = '';

    try {
      for (const level of sortResult.levels) {
        if (run.ctl.cancelled) break;

        const levelNodeIds = new Set(level.map((n) => n.id));

        // Mark current level nodes as running
        setRunNodes((prev) =>
          prev.map((n) => (levelNodeIds.has(n.id) ? { ...n, status: 'running' } : n))
        );

        // Inicializa atividade padrão nos nós de IA do nível
        setNodeLiveActivity((prev) => {
          const next = { ...prev };
          level.forEach((n) => {
            if (n.type === 'agent') {
              next[n.id] = { text: 'Iniciando agente...', timestamp: Date.now() };
            } else if (n.type === 'model') {
              next[n.id] = { text: 'Iniciando raciocínio com IA...', timestamp: Date.now() };
            }
          });
          return next;
        });

        // Ativa apenas os links que estão transmitindo dados de nós anteriores para este nível
        const activeIncomingEdgeIds = edges
          .filter((e) => levelNodeIds.has(e.toNodeId) && outputs.has(e.fromNodeId))
          .map((e) => e.id);
        activeIncomingEdgeIds.forEach((id) => activateEdgeById(id, 2500));

        // Execute level in parallel
        await Promise.all(
          level.map(async (node) => {
            if (run.ctl.cancelled) return;

            const nodeStartTime = Date.now();
            const incoming = edges.filter((e) => e.toNodeId === node.id);
            const upstreamTexts = incoming
              .map((e) => outputs.get(e.fromNodeId))
              .filter(Boolean) as string[];
            const upstreamInput = upstreamTexts.join('\n\n---\n\n');

            let nodeOutput = '';
            let nodeError = '';
            let nodeTokens = 0;

            if (node.type === 'trigger') {
              nodeOutput = node.config?.prompt || 'Disparo de gatilho do fluxo.';
              outputs.set(node.id, nodeOutput);
              lastSummary = nodeOutput;
              // Ativa o link de saída transmitindo o comando para o próximo nó conectado
              const outgoing = edges.filter((e) => e.fromNodeId === node.id);
              outgoing.forEach((e) => activateEdgeById(e.id, 2500));
            } else if (node.type === 'tool') {
              const cmd = (node.config?.command || '').trim();
              const openBrowserMatch = cmd.match(
                /^(?:open|xdg-open|start|browse)\s+(['"]?)((?:https?:\/\/)?(?:(?:[a-zA-Z0-9_-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s'"]*)?|https?:\/\/[^\s'"]+|www\.[^\s'"]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s'"]*)?)\1/i
              );

              if (openBrowserMatch) {
                const targetUrl = withScheme(openBrowserMatch[2]);
                const canvasBrowsers = nodes.filter((n) => n.type === 'webview');
                if (canvasBrowsers.length > 0) {
                  handleOpenUrlFromNode(node.id, targetUrl);
                  nodeOutput = `URL direcionada ao componente de navegador: ${targetUrl}`;
                  outputs.set(node.id, nodeOutput);
                  lastSummary = nodeOutput;
                } else {
                  nodeError =
                    'Ação bloqueada: a orquestração opera exclusivamente com o componente de navegador e nunca utiliza o navegador do dispositivo. Adicione um nó de Navegador ao fluxo.';
                  overallSuccess = false;
                  onToast?.(nodeError, 'error');
                }
              } else if (cmd && window.electronAPI?.shell?.exec && effectiveWorkspacePath) {
                try {
                  const res = await window.electronAPI.shell.exec(cmd, effectiveWorkspacePath);
                  if (res?.stdout) {
                    nodeOutput = res.stdout;
                    outputs.set(node.id, nodeOutput);
                    lastSummary = nodeOutput;
                  }
                  if (res?.stderr && (res.exitCode !== 0 || !res.stdout)) {
                    nodeError = res.stderr;
                    overallSuccess = false;
                  }
                } catch (shErr: any) {
                  nodeError = shErr?.message || 'Falha na execução do comando shell.';
                  overallSuccess = false;
                }
              } else {
                nodeError = 'Comando shell não configurado ou diretório inválido.';
                overallSuccess = false;
              }
            } else if (node.type === 'project') {
              const pPath = node.config?.projectPath || effectiveWorkspacePath || '';
              const pName = node.config?.projectName || node.title || 'Projeto';
              const pBranch = node.config?.gitBranch || 'main';
              nodeOutput = `[Projeto Conectado: ${pName}]\nCaminho (CWD): ${pPath}\nBranch: ${pBranch}`;
              outputs.set(node.id, nodeOutput);
              lastSummary = nodeOutput;
            } else if (node.type === 'webview') {
              // Se os nós imediatamente anteriores não geraram saída de texto (ex: modelo intermediário falhou ou não gerou texto),
              // busca nos nós ancestrais conectados (como o gatilho original ou nós anteriores) para não perder o prompt do usuário!
              let effectiveInput = upstreamInput;
              if (!effectiveInput.trim()) {
                const findAncestorPrompt = (curNodeId: string, visited = new Set<string>()): string => {
                  if (visited.has(curNodeId)) return '';
                  visited.add(curNodeId);
                  const parents = edges.filter((e) => e.toNodeId === curNodeId);
                  for (const p of parents) {
                    const outText = outputs.get(p.fromNodeId);
                    if (outText && outText.trim()) return outText.trim();
                    const parentNode = nodes.find((n) => n.id === p.fromNodeId);
                    if (parentNode?.config?.prompt && parentNode.config.prompt.trim()) {
                      return parentNode.config.prompt.trim();
                    }
                    const deeper = findAncestorPrompt(p.fromNodeId, visited);
                    if (deeper) return deeper;
                  }
                  return '';
                };
                effectiveInput = findAncestorPrompt(node.id);
              }

              const connectedProjects = getConnectedProjectNodes(node.id, nodes, edges);
              const allCanvasProjects = nodes.filter((n) => n.type === 'project');

              const candidateProjects: ProjectCandidate[] = [
                ...connectedProjects.map((p) => ({
                  id: p.id,
                  name: p.config?.projectName || p.title,
                  projectName: p.config?.projectName || p.title,
                  title: p.title,
                  fullName: p.config?.fullName,
                  projectPath: p.config?.projectPath,
                  devUrl: p.config?.devUrl,
                })),
                ...allCanvasProjects.map((p) => ({
                  id: p.id,
                  name: p.config?.projectName || p.title,
                  projectName: p.config?.projectName || p.title,
                  title: p.title,
                  fullName: p.config?.fullName,
                  projectPath: p.config?.projectPath,
                  devUrl: p.config?.devUrl,
                })),
                ...availableProjects.map((p) => ({
                  id: `avail-${p.fullName || p.name}`,
                  name: p.name,
                  projectName: p.name,
                  title: p.title || p.name,
                  fullName: p.fullName,
                  projectPath: p.localDir,
                  devUrl: p.devUrl,
                })),
              ];

              // Tenta resolver a URL a partir do input e candidatos de projeto
              let targetUrl = resolveBrowserUrlFromInput(effectiveInput, node.config?.url, candidateProjects);

              // Se a URL resolvida for search no Google ou vazia, busca projeto correspondente ou fallback
              if (!targetUrl || targetUrl === 'about:blank' || targetUrl.includes('google.com/search')) {
                const projRes = resolveTargetProjectsForNode(
                  effectiveInput,
                  candidateProjects.filter((c) => connectedProjects.some((cp) => cp.id === c.id)),
                  candidateProjects.filter((c) => allCanvasProjects.some((ac) => ac.id === c.id)),
                  candidateProjects.filter((c) => c.id.startsWith('avail-'))
                );
                if (projRes.primaryProject?.devUrl) {
                  targetUrl = projRes.primaryProject.devUrl;
                } else if (connectedProjects.length > 0 && connectedProjects[0].config?.devUrl) {
                  targetUrl = connectedProjects[0].config.devUrl;
                } else if (candidateProjects.length > 0 && candidateProjects[0].devUrl) {
                  targetUrl = candidateProjects[0].devUrl;
                } else if (node.config?.url && node.config.url !== 'about:blank') {
                  targetUrl = node.config.url;
                }
              }

              if (targetUrl && targetUrl !== 'about:blank') {
                setNodeIncomingUrls((prev) => ({
                  ...prev,
                  [node.id]: {
                    url: targetUrl,
                    timestamp: Date.now(),
                    openInNewTab: false,
                    fromNodeTitle: incoming[0]
                      ? nodes.find((n) => n.id === incoming[0].fromNodeId)?.title || 'Fluxo'
                      : 'Fluxo',
                  },
                }));

                setRunNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id ? { ...n, config: { ...n.config, url: targetUrl } } : n
                  )
                );

                nodeOutput = `Página aberta com sucesso no componente de navegador: ${targetUrl}`;
                outputs.set(node.id, nodeOutput);
                lastSummary = nodeOutput;
                onToast?.(`🌐 Navegador (${node.title || 'Navegador'}): ${targetUrl}`);
              } else {
                nodeOutput = 'Navegador em espera (nenhuma URL informada no fluxo).';
                outputs.set(node.id, nodeOutput);
                lastSummary = nodeOutput;
              }
            } else if (node.type === 'model' || node.type === 'agent') {
              // Se este nó já foi executado nesta rodada do fluxo, não executa novamente
              if (outputs.has(node.id)) {
                nodeOutput = outputs.get(node.id) || '';
                lastSummary = nodeOutput;
                return;
              }

              // Detecta se este nó é um Agente Coordenador (com IAs trabalhadoras conectadas) ou uma IA Trabalhadora
              const connectedWorkerNodes = edges
                .filter((e) => e.fromNodeId === node.id || e.toNodeId === node.id)
                .map((e) => (e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId))
                .map((id) => nodes.find((n) => n.id === id))
                .filter((n): n is WorkflowNode => Boolean(n && n.id !== node.id && (n.type === 'model' || (n.type === 'agent' && n.id !== node.id))));

              const upstreamCoordinators = edges
                .filter((e) => e.toNodeId === node.id || e.fromNodeId === node.id)
                .map((e) => (e.toNodeId === node.id ? e.fromNodeId : e.toNodeId))
                .map((id) => nodes.find((n) => n.id === id))
                .filter((n): n is WorkflowNode => Boolean(n && n.id !== node.id && n.type === 'agent' && outputs.has(n.id)));

              const isAgentCoordinator = node.type === 'agent' && connectedWorkerNodes.length > 0 && upstreamCoordinators.length === 0;
              const isWorkerExecutor = (node.type === 'model' || node.type === 'agent') && upstreamCoordinators.length > 0;

              let prompt = '';
              // Texto escrito pelo usuário/fluxo (sem as instruções injetadas), usado para detectar intenção de abrir URL
              const userIntentText = `${upstreamInput}\n${node.config?.prompt || ''}`;

              if (isAgentCoordinator) {
                prompt +=
                  `[PAPEL OBRIGATÓRIO: AGENTE COORDENADOR & ORQUESTRADOR DE TAREFAS]\n` +
                  `Você é o AGENTE COORDENADOR deste fluxo de desenvolvimento.\n` +
                  `ATENÇÃO: Você NÃO deve executar código nos arquivos diretamente nem rodar servidores ou abrir navegadores neste passo!\n` +
                  `Sua missão exclusiva é analisar a demanda do usuário e a estrutura do projeto, planejar a arquitetura técnica e DESIGNAR/DELEGAR detalhadamente as tarefas para a(s) seguinte(s) IA(s) trabalhadora(s) conectada(s) que executarão o código no próximo passo:\n` +
                  connectedWorkerNodes
                    .map(
                      (w, idx) =>
                        `  ${idx + 1}. [${w.title}] - Modelo: ${w.config?.model || w.provider || 'IA'}` +
                        (w.roleId ? ` (Especialidade: ${roles.find((r) => r.id === w.roleId)?.name || 'Desenvolvedor'})` : '')
                    )
                    .join('\n') +
                  `\n\nESTRUTURA OBRIGATÓRIA DO SEU PLANO DE DELEGAÇÃO:\n` +
                  `- Visão Geral da Solução: resumo da arquitetura e decisões técnicas.\n` +
                  `- Delegação por IA Trabalhadora: para cada IA trabalhadora conectada, atribua tarefas claras, indicando:\n` +
                  `   • Arquivos exatos a serem modificados ou criados.\n` +
                  `   • Funções, componentes e lógica a implementar.\n` +
                  `   • Comandos necessários (use os scripts do package.json do projeto; não instale dependências novas só para rodar o servidor).\n` +
                  `- Critérios de Aceitação e Conclusão.\n\n` +
                  `Finalize seu plano de delegação detalhado para que as IAs trabalhadoras recebam e executem a implementação no passo seguinte.\n\n`;
              } else if (isWorkerExecutor) {
                const coordinatorPlans = upstreamCoordinators
                  .map((c) => `--- Plano de Tarefas do Coordenador "${c.title}": ---\n${outputs.get(c.id)}`)
                  .join('\n\n');

                prompt +=
                  `[PAPEL OBRIGATÓRIO: IA TRABALHADORA & EXECUTORA DO PROJETO]\n` +
                  `Você é a IA TRABALHADORA responsável por colocar as mãos no código e realizar a implementação prática no projeto.\n` +
                  `O Agente Coordenador (${upstreamCoordinators.map((c) => `"${c.title}"`).join(', ')}) planejou e designou para você as seguintes tarefas:\n\n` +
                  coordinatorPlans +
                  `\n\nSUA MISSÃO DE EXECUÇÃO:\n` +
                  `- Aplique com precisão todas as alterações de código necessárias nos arquivos do projeto.\n` +
                  `- Para rodar a aplicação use o script de desenvolvimento do projeto (package.json); não instale dependências só para isso.\n` +
                  `- Ao iniciar o servidor da aplicação, finalize a resposta com UMA linha no formato DEVFLOW_OPEN_URL=<url completa do servidor que você iniciou> para que ela seja carregada no navegador conectado.\n\n`;
              }

              // Build combined prompt from role, system instruction, and upstream input
              const role = node.roleId ? roles.find((r) => r.id === node.roleId) : null;
              if (role?.instructions) {
                prompt += `Instruções do papel (${role.name}):\n${role.instructions}\n\n`;
              }
              if (node.config?.systemInstruction) {
                prompt += `Instrução do nó:\n${node.config.systemInstruction}\n\n`;
              }
              if (upstreamInput && !isWorkerExecutor) {
                prompt += `Entrada dos nós anteriores:\n${upstreamInput}\n\n`;
              }
              if (node.config?.prompt) {
                prompt += `Demanda:\n${node.config.prompt}`;
              }
              if (!prompt.trim()) {
                prompt = upstreamInput || 'Execute a tarefa atribuída.';
              }

              // 1. Coleta todos os candidatos de projeto (conectados, canvas, disponíveis)
              const connectedProjects = getConnectedProjectNodes(node.id, nodes, edges);
              const allCanvasProjects = nodes.filter((n) => n.type === 'project');

              const candidateProjects: ProjectCandidate[] = [
                ...connectedProjects.map((proj) => ({
                  id: proj.id,
                  name: proj.config?.projectName || proj.title,
                  projectName: proj.config?.projectName || proj.title,
                  title: proj.title,
                  fullName: proj.config?.fullName,
                  projectPath: proj.config?.projectPath,
                  devUrl: proj.config?.devUrl,
                  branch: proj.config?.gitBranch,
                  isCloned: proj.config?.isCloned !== false,
                })),
                ...allCanvasProjects.map((proj) => ({
                  id: proj.id,
                  name: proj.config?.projectName || proj.title,
                  projectName: proj.config?.projectName || proj.title,
                  title: proj.title,
                  fullName: proj.config?.fullName,
                  projectPath: proj.config?.projectPath,
                  devUrl: proj.config?.devUrl,
                  branch: proj.config?.gitBranch,
                  isCloned: proj.config?.isCloned !== false,
                })),
                ...availableProjects.map((proj) => ({
                  id: `avail-${proj.fullName || proj.name}`,
                  name: proj.name,
                  projectName: proj.name,
                  title: proj.title || proj.name,
                  fullName: proj.fullName,
                  projectPath: proj.localDir,
                  devUrl: proj.devUrl,
                  branch: proj.branch,
                  isCloned: proj.isCloned,
                })),
              ];

              // 2. Resolve quais projetos foram explicitamente ou implicitamente solicitados no prompt
              const fullPromptForMatching = `${prompt} ${upstreamInput}`;
              const projectResolution = resolveTargetProjectsForNode(
                fullPromptForMatching,
                candidateProjects.filter((c) => connectedProjects.some((cp) => cp.id === c.id)),
                candidateProjects.filter((c) => allCanvasProjects.some((ac) => ac.id === c.id)),
                candidateProjects.filter((c) => c.id.startsWith('avail-'))
              );

              const matchedProjects = projectResolution.matchedProjects;
              const primaryProject = projectResolution.primaryProject;

              // Ativa especificamente os links para o(s) projeto(s) que a IA está ativamente investigando
              if (matchedProjects.length > 0) {
                matchedProjects.forEach((proj) => {
                  activateEdgeBetweenNodes(node.id, proj.id, 4500);
                });
              } else if (primaryProject) {
                activateEdgeBetweenNodes(node.id, primaryProject.id, 4500);
              }

              let targetWorkspacePath = primaryProject?.projectPath || effectiveWorkspacePath;

              // Inspeciona package.json do projeto para fornecer scripts reais à IA e checar Portless
              let pkgScriptsSummary = '';
              let hasPortless = false;
              if (targetWorkspacePath && (window as any).electronAPI?.fs?.readFile) {
                try {
                  const pkgFile = await (window as any).electronAPI.fs.readFile(`${targetWorkspacePath}/package.json`);
                  if (pkgFile?.content) {
                    const parsedPkg = JSON.parse(pkgFile.content);
                    if (parsedPkg.scripts) {
                      pkgScriptsSummary = `\n[Scripts disponíveis em package.json]:\n${JSON.stringify(parsedPkg.scripts, null, 2)}`;
                    }
                    const allDeps = {
                      ...(parsedPkg.dependencies || {}),
                      ...(parsedPkg.devDependencies || {}),
                    };
                    hasPortless = Boolean(
                      allDeps['portless'] ||
                      allDeps['@vercel/portless'] ||
                      allDeps['vercel-labs/portless'] ||
                      (parsedPkg.scripts && Object.values(parsedPkg.scripts).some((s: any) => typeof s === 'string' && s.includes('portless')))
                    );
                  }
                } catch {}
              }

              // Orientação de servidor local: usa o que o projeto já tem (portless só se já estiver em uso)
              const portlessInstruction =
                `\n[SERVIDOR LOCAL]:\n` +
                (hasPortless
                  ? `- O projeto já usa o portless da Vercel: rode o servidor de dev via o script que o utiliza e informe a URL .localhost gerada.\n`
                  : `- Rode o servidor com o script de desenvolvimento do package.json do projeto. NÃO instale dependências (como o portless) só para isso.\n`) +
                `- NUNCA derrube processos ou portas em uso (sem kill/pkill); se a porta estiver ocupada, use outra livre.\n\n`;

              // 3. Injeta contexto dos projetos na mensagem para a IA
              if (matchedProjects.length > 1) {
                prompt =
                  `[Projetos Conectados no Fluxo (${matchedProjects.length})]:\n` +
                  matchedProjects
                    .map(
                      (proj, idx) =>
                        `${idx + 1}. Projeto: ${proj.projectName || proj.name || 'Projeto'}\n` +
                        `   - Diretório de Trabalho (CWD): ${proj.projectPath || 'Não definido'}\n`
                    )
                    .join('\n') +
                  `\nVocê tem acesso aos arquivos destes projetos para analisar o código, verificar scripts e portas internas, aplicar alterações de código e resolver tarefas.\n\n` +
                  prompt;
              } else if (primaryProject?.projectPath) {
                const pName = primaryProject.projectName || primaryProject.name || 'Projeto';
                prompt =
                  `[Projeto Conectado: ${pName}]\n` +
                  `[Diretório de Trabalho (CWD): ${targetWorkspacePath}]` +
                  pkgScriptsSummary +
                  `\nVocê tem acesso aos arquivos deste projeto para inspecionar código-fonte, analisar scripts de inicialização, verificar configurações internas de porta/URL (ex: package.json, vite.config, next.config, etc.) e realizar alterações de código.\n\n` +
                  prompt;
              }

              // Se houver componente de navegador conectado no fluxo, avisa à IA para verificar a URL interna do projeto e informá-la
              const connectedBrowsers = getConnectedBrowserNodes(node.id, nodes, edges);
              const allCanvasBrowsers = nodes.filter((n) => n.type === 'webview');
              if (connectedBrowsers.length > 0 || allCanvasBrowsers.length > 0) {
                prompt =
                  `[Navegador Conectado no Fluxo]:\n` +
                  `Existe um card de Navegador conectado ao seu fluxo para exibir o resultado da aplicação.\n` +
                  portlessInstruction +
                  `- Se a tarefa pedir para rodar, testar, visualizar ou abrir a aplicação, termine a resposta com UMA linha no formato DEVFLOW_OPEN_URL=<url completa do servidor que você iniciou> (somente se um servidor estiver realmente rodando). Essa linha faz o card de Navegador carregar a página.\n\n` +
                  prompt;
              } else {
                prompt = portlessInstruction + prompt;
              }

              const runId = `orch-${Date.now()}-${node.id}`;
              run.runIds.add(runId);
              runningWorkflowRunIdRef.current = runId;

              // Encontra nós de modelo de IA conectados a este nó (ou se este nó é o próprio modelo)
              const connectedModels = edges
                .filter(
                  (e) =>
                    (e.fromNodeId === node.id && nodes.find((n) => n.id === e.toNodeId)?.type === 'model') ||
                    (e.toNodeId === node.id && nodes.find((n) => n.id === e.fromNodeId)?.type === 'model')
                )
                .map((e) => {
                  const targetModelId = e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId;
                  return {
                    edgeId: e.id,
                    modelNode: nodes.find((n) => n.id === targetModelId)!,
                  };
                })
                .filter((item) => Boolean(item.modelNode));

              let chosenModelItem = connectedModels.find((m) => {
                const prov = (m.modelNode.provider || '').toLowerCase();
                const title = (m.modelNode.title || '').toLowerCase();
                const modelSpec = (m.modelNode.config?.model || '').toLowerCase();
                const text = fullPromptForMatching.toLowerCase();
                return (
                  (prov && text.includes(prov)) ||
                  (title && text.includes(title)) ||
                  (modelSpec && text.includes(modelSpec))
                );
              });
              if (!chosenModelItem && connectedModels.length > 0) {
                chosenModelItem = connectedModels[0];
              }

              const p = (node.provider || selectedAiProvider || 'claude') as AiProviderId;
              const modelList = getProviderModelList(p);
              const modelName = node.config?.model || modelList[0]?.label || 'Sonnet 5';

              const nodeSessionId = getOrchestrationCliSessionId(activeFloorId, node.id);
              const cliType = getNodeCliSessionType(node);

              // Garante que a sessão de terminal do nó exista no backend rodando o CLI interativo da IA
              let cliOpenError = '';
              try {
                await window.electronAPI?.pty?.create?.(
                  nodeSessionId,
                  cliType,
                  targetWorkspacePath,
                  100,
                  24,
                  accentColor,
                  { model: modelName }
                );
              } catch (createErr: any) {
                cliOpenError = `Não foi possível abrir o CLI (${cliType}): ${createErr?.message || 'falha ao iniciar o processo'}`;
              }
              setBusyCliNodeIds((prev) => new Set([...prev, node.id]));

              if (isAgentCoordinator) {
                // Ativa os links para os nós de IA trabalhadores que receberão as tarefas
                connectedWorkerNodes.forEach((w) => {
                  activateEdgeBetweenNodes(node.id, w.id, 0);
                });
                setNodeLiveActivity((prev) => ({
                  ...prev,
                  [node.id]: { text: `Agente analisando e delegando tarefas (${cliType})...`, timestamp: Date.now() },
                }));
                onToast?.(`🤖 Agente "${node.title}" elaborando e delegando tarefas para as IAs trabalhadoras...`, 'info');
              } else if (isWorkerExecutor) {
                setNodeLiveActivity((prev) => ({
                  ...prev,
                  [node.id]: { text: `IA executando tarefas designadas (${cliType})...`, timestamp: Date.now() },
                }));
                onToast?.(`💻 IA Trabalhadora "${node.title}" executando tarefas no projeto (${modelName})...`, 'info');
              } else {
                setNodeLiveActivity((prev) => ({
                  ...prev,
                  [node.id]: { text: `Escrevendo prompt no CLI (${cliType})...`, timestamp: Date.now() },
                }));
                onToast?.(`💻 Executando "${node.title}" no terminal integrado (${modelName})...`, 'info');
              }

              try {
                let res: { response?: string; error?: string; cancelled?: boolean } | null = null;

                // Executa diretamente no CLI interativo do terminal escrevendo na caixa de texto e submetendo
                if (cliOpenError) {
                  res = { response: '', error: cliOpenError };
                } else if (window.electronAPI?.pty?.runPromptInCli) {
                  res = await window.electronAPI.pty.runPromptInCli(nodeSessionId, prompt, 300000);
                }

                // Só usa o modo headless se o terminal interativo nem existir; falha do CLI é falha do nó (não mascarar)
                if (!res && !window.electronAPI?.pty?.runPromptInCli) {
                  if (window.electronAPI?.ai?.prompt) {
                    res = await (window.electronAPI.ai.prompt as any)(
                      prompt,
                      modelName,
                      targetWorkspacePath,
                      p,
                      undefined,
                      runId,
                      [nodeSessionId]
                    );
                  }
                }

                if (run.ctl.cancelled || (res as any)?.cancelled) {
                  nodeError = 'Execução cancelada pelo usuário.';
                  return;
                }
                  if (res?.response) {
                    nodeOutput = res.response.trim();
                    outputs.set(node.id, nodeOutput);
                    lastSummary = nodeOutput;

                    // Se for Agente Coordenador, anima os links conectando às IAs trabalhadoras para destacar a passagem das tarefas
                    if (isAgentCoordinator) {
                      connectedWorkerNodes.forEach((w) => {
                        activateEdgeBetweenNodes(node.id, w.id, 5000);
                      });
                    }
                    const inTok = Math.round(prompt.length / 4);
                    const outTok = Math.round(nodeOutput.length / 4);
                    totalInputTokens += inTok;
                    totalOutputTokens += outTok;
                    nodeTokens = outTok;

                    // 4. Coleta as URLs dos projetos para abrir nos navegadores a partir do output da IA
                    const urlsToOpen: Array<{ url: string; projectTitle: string }> = [];

                    // Se a resposta contiver URL explícita (não busca Google)
                    // O buffer do terminal traz o eco do prompt: extrai só a URL que o agente realmente informou
                    const responseUrl = extractAgentOpenUrl(nodeOutput, prompt);
                    if (responseUrl) {
                      urlsToOpen.push({
                        url: responseUrl,
                        projectTitle: primaryProject?.title || primaryProject?.name || 'Projeto',
                      });
                    }

                    // Se a intenção do usuário no prompt era expressamente abrir uma URL externa explícita
                    if (urlsToOpen.length === 0) {
                      const explicitPromptUrl = resolveBrowserUrlFromInput(userIntentText, undefined, candidateProjects);
                      if (
                        explicitPromptUrl &&
                        explicitPromptUrl !== 'about:blank' &&
                        !explicitPromptUrl.includes('google.com/search')
                      ) {
                        urlsToOpen.push({
                          url: explicitPromptUrl,
                          projectTitle: primaryProject?.title || 'Navegador',
                        });
                      }
                    }

                    // Fallback se houver navegador conectado no fluxo ou no canvas E houver projeto com devUrl
                    if (urlsToOpen.length === 0 && (connectedBrowsers.length > 0 || allCanvasBrowsers.length > 0)) {
                      const projWithDevUrl =
                        (primaryProject?.devUrl ? primaryProject : null) ||
                        connectedProjects.find((p) => p.devUrl) ||
                        candidateProjects.find((p) => p.devUrl);

                      if (projWithDevUrl?.devUrl) {
                        urlsToOpen.push({
                          url: projWithDevUrl.devUrl,
                          projectTitle: projWithDevUrl.title || projWithDevUrl.projectName || 'Projeto',
                        });
                      }
                    }

                    // 5. Roteia as URLs para os navegadores (distribui entre múltiplos navegadores ou em abas)
                    const availableBrowsers = connectedBrowsers.length > 0 ? connectedBrowsers : allCanvasBrowsers;

                    if (urlsToOpen.length > 0 && !isAgentCoordinator) {
                      if (availableBrowsers.length > 0) {
                        urlsToOpen.forEach((item, idx) => {
                          const targetBrowser = availableBrowsers[idx % availableBrowsers.length];
                          const isNewTab = idx > 0 && availableBrowsers.length === 1;

                          // Ativa especificamente o link conectando ao navegador de destino
                          activateEdgeBetweenNodes(node.id, targetBrowser.id, 4000);
                          if (primaryProject) {
                            activateEdgeBetweenNodes(primaryProject.id, targetBrowser.id, 4000);
                          }

                          setTimeout(() => {
                            if (run.ctl.cancelled) return;
                            setNodeIncomingUrls((prev) => ({
                              ...prev,
                              [targetBrowser.id]: {
                                url: item.url,
                                timestamp: Date.now() + idx * 60,
                                openInNewTab: isNewTab,
                                fromNodeTitle: item.projectTitle || node.title || 'IA / Agente',
                              },
                            }));
                          }, idx * 120);

                          onToast?.(`🌐 Navegador carregando URL identificada pela IA: ${item.url}`);
                        });
                      } else {
                        nodeError =
                          'Ação bloqueada: a orquestração nunca utiliza o navegador do dispositivo. Adicione um componente de Navegador ao fluxo para abrir URLs.';
                        overallSuccess = false;
                        onToast?.(nodeError, 'error');
                      }
                    }
                  } else if (res?.error) {
                    nodeError = res.error;
                    overallSuccess = false;
                  } else {
                    nodeError = 'Serviço de IA indisponível ou não retornou resposta.';
                    overallSuccess = false;
                  }
                } catch (aiErr: any) {
                nodeError = aiErr?.message || 'Erro na comunicação com o provedor.';
                overallSuccess = false;
              } finally {
                setBusyCliNodeIds((prev) => {
                  const next = new Set(prev);
                  next.delete(node.id);
                  return next;
                });
                if (chosenModelItem) {
                  deactivateEdgeById(chosenModelItem.edgeId);
                }
              }
            }

            const nodeDuration = Date.now() - nodeStartTime;
            const isNodeSuccess = !nodeError && !run.ctl.cancelled;

            setRunNodes((prev) =>
              prev.map((n) => {
                if (n.id !== node.id) return n;
                return {
                  ...n,
                  status: run.ctl.cancelled
                    ? 'cancelled'
                    : isNodeSuccess
                    ? 'success'
                    : 'failed',
                  output: {
                    text: run.ctl.cancelled ? 'Execução cancelada.' : (nodeOutput || nodeError),
                    durationMs: nodeDuration,
                    tokens: nodeTokens || undefined,
                    timestamp: new Date().toLocaleTimeString(),
                    error: run.ctl.cancelled ? 'Fluxo cancelado pelo usuário' : (nodeError || undefined),
                  },
                };
              })
            );

            // Rótulo dos cabos que SAEM do nó: o que ele entregou ao próximo e quanto levou
            {
              const outgoing = edges.filter((e) => e.fromNodeId === node.id);
              const feedsAi = outgoing.some((e) => {
                const t = nodes.find((n) => n.id === e.toNodeId)?.type;
                return t === 'model' || t === 'agent';
              });
              const kind = !isNodeSuccess
                ? 'Falhou'
                : node.type === 'trigger'
                ? 'Prompt'
                : node.type === 'project'
                ? node.config?.projectName || 'Projeto'
                : node.type === 'tool'
                ? 'Saída do comando'
                : node.type === 'webview'
                ? 'Página aberta'
                : node.type === 'agent' && feedsAi
                ? 'Plano'
                : 'Resposta';
              // Tokens da resposta (estimativa: o CLI interativo não informa o uso real)
              const tokens = nodeTokens > 0
                ? ` · ~${nodeTokens >= 1000 ? `${(nodeTokens / 1000).toFixed(1)}k` : nodeTokens} tok`
                : '';
              if (outgoing.length > 0) {
                const outIds = new Set(outgoing.map((e) => e.id));
                setRunEdges((prev) =>
                  prev.map((e) => (outIds.has(e.id) ? { ...e, label: `${kind}${tokens}` } : e))
                );
              }
            }
          })
        );

        // Turn off edge activity after level finishes
        activeIncomingEdgeIds.forEach((id) => deactivateEdgeById(id));
      }
    } finally {
      activeRunsRef.current.delete(runKey);
      const othersRunning = activeRunsRef.current.size > 0;
      setIsExecutingFlow(othersRunning);
      setRunEdges((prev) =>
        prev.map((e) => (run.nodeIds.has(e.fromNodeId) || run.nodeIds.has(e.toNodeId) ? { ...e, isActive: false } : e))
      );
      if (!othersRunning) {
        runningWorkflowRunIdRef.current = null;
        setActiveDynamicEdgeIds(new Set());
        activeEdgeTimersRef.current.forEach((t) => clearTimeout(t));
        activeEdgeTimersRef.current.clear();
      }

      const totalDuration = Date.now() - startTime;
      const durationFormatted = `${(totalDuration / 1000).toFixed(1)}s`;

      if (run.ctl.cancelled) {
        setRunNodes((prev) =>
          prev.map((n) => (n.status === 'running' ? { ...n, status: 'cancelled' } : n))
        );
        onToast?.('Execução interrompida.');
      } else {
        const triggerNode = nodes.find((n) => run.nodeIds.has(n.id) && n.type === 'trigger');
        const triggerPrompt = triggerNode?.config?.prompt || 'Fluxo Orquestrado';
        const modelNode = nodes.find((n) => n.type === 'model');
        const modelProvider = modelNode?.provider || selectedAiProvider || 'claude';
        const modelList = getProviderModelList(modelProvider);
        const modelName = modelNode?.config?.model || modelList[0]?.label || 'Sonnet 5';

        const newLog: ExecutionRecord = {
          id: `exec-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          status: overallSuccess ? 'success' : 'failed',
          duration: durationFormatted,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          triggerPrompt,
          outputSummary: lastSummary.slice(0, 160) + (lastSummary.length > 160 ? '...' : ''),
          providerUsed: AI_PROVIDER_INFOS[modelProvider]?.name || modelProvider,
          modelUsed: modelName,
        };
        if (activeFloorIdRef.current === runFloorId) {
          setExecutionLogs((prev) => [newLog, ...prev.slice(0, 29)]);
        } else {
          try {
            const k = floorStorageKey(STORAGE_KEY_LOGS, runFloorId);
            const prevLogs = JSON.parse(localStorage.getItem(k) || '[]');
            localStorage.setItem(k, JSON.stringify([newLog, ...prevLogs].slice(0, 30)));
          } catch {}
        }
        if (overallSuccess) {
          onToast?.('Fluxo executado com sucesso!');
        } else {
          onToast?.('Fluxo finalizado com falhas em um ou mais nós.');
        }
      }
    }
  };

  // ============================================================================
  // NODE CRUD ACTIONS (WITH AGENTS.md COMPLIANT CONFIRM DELETE MODAL)
  // ============================================================================

  const handleAddNode = async (
    type: NodeType,
    provider?: AiProviderId | string,
    initialConfig?: any,
    initialTitle?: string,
    position?: { x?: number; y?: number }
  ): Promise<string> => {
    const newId = `node-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultX = Math.round((260 - pan.x) / zoom) + Math.floor(Math.random() * 40);
    const defaultY = Math.round((200 - pan.y) / zoom) + Math.floor(Math.random() * 40);
    const x = position?.x !== undefined ? position.x : defaultX;
    const y = position?.y !== undefined ? position.y : defaultY;

    let title = initialTitle || 'Novo Nó';
    let subtitle = '';
    let config: any = {};
    let ports: any = { input: ['in'], output: ['out'] };
    let width = type === 'agent' ? 230 : 210;
    let height = type === 'agent' ? 170 : 160;

    if (type === 'model') {
      const p = (provider as AiProviderId) || (selectedAiProvider as AiProviderId) || 'claude';
      const meta = AI_PROVIDER_INFOS[p] || AI_PROVIDER_INFOS.claude;
      const modelList = getProviderModelList(p);
      const defaultModel = modelList[0]?.label || 'Default';
      title = initialTitle || meta.name;
      subtitle = defaultModel;
      config = {
        model: defaultModel,
        temperature: 0.7,
        maxTokens: 2048,
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['out'] };
    } else if (type === 'agent') {
      title = initialTitle || 'Agente de IA';
      subtitle = 'Agente Especialista';
      width = 230;
      height = 170;
      config = {
        systemInstruction: 'Atue como desenvolvedor e coordenador técnico. Ao rodar a aplicação para visualizá-la no navegador do fluxo, use o script de desenvolvimento do próprio projeto (package.json) e informe a URL do servidor.',
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['chat_model', 'memory', 'tool'] };
    } else if (type === 'trigger') {
      title = initialTitle || 'Prompt';
      subtitle = 'Gatilho de Entrada';
      config = {
        prompt: 'Descreva a tarefa ou questão para a IA resolver...',
        ...initialConfig,
      };
      ports = { output: ['out'] };
    } else if (type === 'tool') {
      title = initialTitle || 'Ferramenta Shell';
      subtitle = 'Comando CLI';
      config = {
        command: 'git status -s',
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['out'] };
    } else if (type === 'webview') {
      title = initialTitle || 'Navegador Web';
      subtitle = 'Visualizador Web & App';
      const canvasWidth = canvasRef.current?.clientWidth || window.innerWidth;
      const maxInitialW = Math.max(480, Math.floor((canvasWidth - 360) / zoom));
      width = Math.min(640, maxInitialW);
      height = 440;
      config = {
        url: 'about:blank',
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['out'] };
    } else if (type === 'ide') {
      title = initialTitle || 'IDE Workspace';
      subtitle = 'Ambiente de Código & CLI';
      width = 580;
      height = 380;
      config = {
        command: 'npm run dev',
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['out', 'webview'] };
    } else if (type === 'project') {
      const existingProjectNodes = nodes.filter((n) => n.type === 'project');
      const usedProjectPaths = new Set(
        existingProjectNodes.map((n) => n.config?.projectPath?.toLowerCase()).filter(Boolean)
      );
      const usedDevUrls = existingProjectNodes
        .map((n) => n.config?.devUrl)
        .filter(Boolean) as string[];

      // Procura primeiro se foi especificado um projeto pelo nome/título
      const requestedProjectQuery = initialConfig?.projectName || initialConfig?.fullName || initialTitle || '';
      const matchedAvailable = requestedProjectQuery
        ? findProjectsInText(
            requestedProjectQuery,
            availableProjects.map((p) => ({
              id: p.fullName || p.name,
              name: p.name,
              projectName: p.name,
              title: p.title || p.name,
              fullName: p.fullName,
              projectPath: p.localDir,
              branch: p.branch,
              isCloned: p.isCloned,
            }))
          )[0]
        : null;

      // Escolhe preferencialmente o projeto solicitado ou um disponível que ainda não esteja no canvas
      const candidateProj =
        (matchedAvailable &&
          availableProjects.find(
            (p) => p.name === matchedAvailable.name || p.fullName === matchedAvailable.fullName
          )) ||
        availableProjects.find(
          (p) =>
            p.localDir &&
            !usedProjectPaths.has(p.localDir.toLowerCase()) &&
            p.isCloned
        ) ||
        availableProjects.find(
          (p) =>
            p.fullName &&
            !usedProjectPaths.has(p.fullName.toLowerCase())
        ) ||
        availableProjects.find(
          (p) =>
            p.localDir &&
            effectiveWorkspacePath &&
            p.localDir.toLowerCase() === effectiveWorkspacePath.toLowerCase()
        ) ||
        availableProjects.find((p) => p.isCloned) ||
        availableProjects[0];

      const initialPath = candidateProj?.localDir || effectiveWorkspacePath || '';
      const initialName =
        candidateProj?.name ||
        (initialPath ? initialPath.split(/[/\\]/).filter(Boolean).pop() || 'Projeto' : 'Novo Projeto');
      const isCloned = candidateProj ? candidateProj.isCloned : Boolean(initialPath);

      let detectedPort: number | null = null;
      if (initialPath) {
        try {
          detectedPort = await detectProjectPort(initialPath);
        } catch {}
      }
      const sysPorts = await scanSystemOccupiedPorts();
      const uniqueDevUrl = allocateUniqueDevUrl(usedDevUrls, detectedPort, 5173, sysPorts);

      title = initialTitle || initialName;
      subtitle = isCloned ? `${candidateProj?.branch || 'main'} • Projeto` : 'Git • Não clonado';
      width = 200;
      height = 120;
      config = {
        projectName: initialName,
        fullName: candidateProj?.fullName || initialName,
        projectPath: initialPath,
        gitBranch: candidateProj?.branch || 'main',
        devUrl: uniqueDevUrl,
        isCloned,
        cloneUrl: candidateProj?.cloneUrl,
        htmlUrl: candidateProj?.htmlUrl,
        ...initialConfig,
      };
      ports = { input: ['in'], output: ['out', 'webview'] };
    }

    if (initialConfig) {
      config = { ...config, ...initialConfig };
    }

    const newNode: WorkflowNode = {
      id: newId,
      type,
      title,
      subtitle,
      provider: provider as AiProviderId,
      x,
      y,
      width,
      height,
      status: 'ready',
      config,
      ports,
    };

    // Sincroniza nodesRef.current IMEDIATAMENTE para que conexões ou chamadas subsequentes encontrem o nó no mesmo tick
    nodesRef.current = [...nodesRef.current, newNode];
    setNodes((prev) => [...prev, newNode]);
    if (type === 'ide') {
      setExpandedCliNodes((prev) => ({ ...prev, [newId]: true }));
    }
    setSelectedNodeId(newId);
    if (type !== 'webview') {
      setActiveInstructionNodeId(newId);
      setIsInstructionVisible(true);
    } else {
      setIsInstructionVisible(false);
    }
    setTimeout(() => handleFocusNode(newId), 50);
    return newId;
  };

  // Maestro: abre uma URL num navegador do canvas (cria um se não existir)
  const handleMaestroOpenUrl = async (rawUrl: string, browserNodeId?: string): Promise<string> => {
    const url = withScheme(rawUrl.trim());
    const existing = nodesRef.current.find((n) => n.type === 'webview' && (!browserNodeId || n.id === browserNodeId));
    const browserId = existing?.id || (await handleAddNode('webview', undefined, undefined, 'Navegador'));
    setNodeIncomingUrls((prev) => ({
      ...prev,
      [browserId]: { url, timestamp: Date.now(), openInNewTab: false, fromNodeTitle: 'Maestro' },
    }));
    onToast?.(`🌐 Maestro abriu no Navegador: ${url}`);
    return browserId;
  };

  // Maestro: garante o nó do projeto no canvas, liga ao navegador e abre a dev URL (subindo o servidor se preciso)
  const handleMaestroOpenProject = async (projectName: string, browserNodeId?: string): Promise<string> => {
    const asCandidate = (n: WorkflowNode) => ({
      id: n.id,
      name: n.config?.projectName || n.title,
      projectName: n.config?.projectName || n.title,
      title: n.title,
      fullName: (n.config as any)?.fullName,
      projectPath: n.config?.projectPath,
    });
    let projectNode = nodesRef.current.find(
      (n) => n.type === 'project' && findProjectsInText(projectName, [asCandidate(n)]).length > 0
    );
    if (!projectNode) {
      const id = await handleAddNode('project', undefined, undefined, projectName);
      projectNode = nodesRef.current.find((n) => n.id === id);
    }
    const devUrl = projectNode?.config?.devUrl;
    if (!projectNode || !devUrl) throw new Error(`Projeto "${projectName}" não encontrado ou sem URL de desenvolvimento.`);
    const browserId = await handleMaestroOpenUrl(devUrl, browserNodeId);
    handleConnectNodes(projectNode.id, browserId, 'webview', 'in');
    ensureDevServer(projectNode, devUrl);
    return projectNode.id;
  };

  const handleConnectNodes = useCallback(
    (fromNodeId: string, toNodeId: string, fromPort?: string, toPort?: string): boolean => {
      const curNodes = nodesRef.current.length > 0 ? nodesRef.current : nodes;
      const curEdges = edgesRef.current.length > 0 ? edgesRef.current : edges;
      const sourceNode = curNodes.find((n) => n.id === fromNodeId);
      const targetNode = curNodes.find((n) => n.id === toNodeId);
      if (!sourceNode || !targetNode) {
        console.warn(`[handleConnectNodes] Nó não encontrado: from=${fromNodeId} (${!!sourceNode}), to=${toNodeId} (${!!targetNode})`);
        return false;
      }
      if (wouldCreateCycle(fromNodeId, toNodeId, curEdges)) return false;

      // Resolução inteligente de portas compatíveis
      let actualFromPort = fromPort;
      let actualToPort = toPort;

      // Agente -> Modelo sempre usa o porto 'chat_model'
      if (sourceNode.type === 'agent' && targetNode.type === 'model') {
        actualFromPort = 'chat_model';
      } else if (sourceNode.type === 'agent' && (targetNode.type === 'tool' || targetNode.type === 'ide')) {
        actualFromPort = 'tool';
      }

      const availableOutputPorts = sourceNode.ports?.output || ['out'];
      if (!actualFromPort || !availableOutputPorts.includes(actualFromPort)) {
        actualFromPort = availableOutputPorts[0] || 'out';
      }

      const availableInputPorts = targetNode.ports?.input || ['in'];
      if (!actualToPort || !availableInputPorts.includes(actualToPort)) {
        actualToPort = availableInputPorts[0] || 'in';
      }

      const fromSide = actualFromPort === 'chat_model' || actualFromPort === 'memory' ? 'bottom' : 'right';

      const newEdge: WorkflowEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fromNodeId,
        toNodeId,
        fromPort: actualFromPort,
        toPort: actualToPort,
        fromSide,
        toSide: 'left',
        color: '#3b82f6',
      };

      edgesRef.current = [...edgesRef.current, newEdge];
      setEdges((prev) => {
        const isDuplicate = prev.some(
          (e) =>
            e.fromNodeId === fromNodeId &&
            e.toNodeId === toNodeId &&
            e.fromPort === actualFromPort &&
            e.toPort === actualToPort
        );
        if (isDuplicate) return prev;
        return [...prev, newEdge];
      });

      // Ao conectar Projeto <-> Navegador, sincroniza a URL do projeto para o componente de navegador
      if (sourceNode.type === 'project' && targetNode.type === 'webview') {
        const pUrl = sourceNode.config?.devUrl;
        if (pUrl && pUrl !== 'about:blank') {
          setNodeIncomingUrls((prev) => ({
            ...prev,
            [targetNode.id]: {
              url: pUrl,
              timestamp: Date.now(),
              openInNewTab: false,
              fromNodeTitle: sourceNode.title || 'Projeto',
            },
          }));
        }
      } else if (sourceNode.type === 'webview' && targetNode.type === 'project') {
        const pUrl = targetNode.config?.devUrl;
        if (pUrl && pUrl !== 'about:blank') {
          setNodeIncomingUrls((prev) => ({
            ...prev,
            [sourceNode.id]: {
              url: pUrl,
              timestamp: Date.now(),
              openInNewTab: false,
              fromNodeTitle: targetNode.title || 'Projeto',
            },
          }));
        }
      }

      return true;
    },
    [nodes, edges]
  );

  // Flutter: roda `flutter run -d web-server` e embute o preview num node "webview" assim que sobe
  const flutterRunIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
  const handleOpenUrlFromNodeRef = useRef(handleOpenUrlFromNode);
  useEffect(() => { handleOpenUrlFromNodeRef.current = handleOpenUrlFromNode; }, [handleOpenUrlFromNode]);
  const panRef = useRef(pan);
  useEffect(() => { panRef.current = pan; }, [pan]);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const unsub = window.electronAPI?.flutter?.onEvent?.((event) => {
      if (event.runId !== flutterRunIdRef.current) return;
      if (event.kind === 'ready') {
        const curSelected = selectedNodeIdRef.current;
        const curNodes = nodesRef.current;
        const curEdges = edgesRef.current;
        const connectedBrowsers = curSelected ? getConnectedBrowserNodes(curSelected, curNodes, curEdges) : [];
        if (connectedBrowsers.length > 0) {
          handleOpenUrlFromNodeRef.current(curSelected || '', event.url);
        } else {
          const newId = `node-webview-flutter-${Date.now()}`;
          setNodes((prev) => [
            ...prev,
            {
              id: newId,
              type: 'webview',
              title: 'Flutter (web)',
              subtitle: event.url,
              x: Math.round((260 - panRef.current.x) / zoomRef.current),
              y: Math.round((200 - panRef.current.y) / zoomRef.current),
              width: 640,
              height: 440,
              status: 'ready',
              config: { url: event.url },
              ports: { input: ['in'], output: ['out'] },
            },
          ]);
          onToast?.(`App Flutter disponível em ${event.url}`);
        }
      } else if (event.kind === 'exit') {
        onToast?.('Execução do Flutter encerrada.');
        flutterRunIdRef.current = null;
      } else if (event.kind === 'stderr' && /error/i.test(event.data)) {
        onToast?.('Erro ao rodar o Flutter — veja o terminal do sistema para detalhes.');
      }
    });
    return () => {
      unsub?.();
      if (flutterRunIdRef.current && window.electronAPI?.flutter?.stop) {
        window.electronAPI.flutter.stop(flutterRunIdRef.current);
      }
    };
  }, [onToast]);

  const handleRunFlutterWeb = useCallback(async () => {
    if (!effectiveWorkspacePath) {
      onToast?.('Nenhum workspace ativo para rodar o Flutter.');
      return;
    }
    if (flutterRunIdRef.current && window.electronAPI?.flutter?.stop) {
      try {
        window.electronAPI.flutter.stop(flutterRunIdRef.current);
      } catch {}
    }
    const runId = `flutter-${Date.now()}`;
    const port = 4040 + Math.floor(Math.random() * 200);
    flutterRunIdRef.current = runId;
    const result = await window.electronAPI?.flutter?.run?.(runId, effectiveWorkspacePath, port);
    if (!result?.success) {
      onToast?.(`Não foi possível iniciar o Flutter: ${result?.error || 'erro desconhecido'}`);
      flutterRunIdRef.current = null;
      return;
    }
    onToast?.('Iniciando Flutter (web-server)… isso pode levar alguns segundos.');
  }, [effectiveWorkspacePath, onToast]);

  // Simulador iOS (macOS, best-effort): captura a janela do Simulator.app como vídeo ao vivo
  const [isSimulatorPanelOpen, setIsSimulatorPanelOpen] = useState(false);
  const [simulatorSources, setSimulatorSources] = useState<Array<{ id: string; name: string }>>([]);
  const isMacOS = window.electronAPI?.platform === 'darwin';

  const handleOpenSimulatorCapture = useCallback(async () => {
    setIsSimulatorPanelOpen(true);
    const sources = await window.electronAPI?.capture?.listWindows?.('simulator');
    setSimulatorSources(sources || []);
  }, []);

  const confirmDeleteNode = async () => {
    if (!nodeToDelete) return;
    const targetId = nodeToDelete.id;
    setIsDeleting(true);
    try {
      killNodeSessions([targetId]);
      setNodes((prev) => prev.filter((n) => n.id !== targetId));
      setEdges((prev) => prev.filter((e) => e.fromNodeId !== targetId && e.toNodeId !== targetId));
      setExpandedCliNodes((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setNodeIncomingUrls((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      if (cliOriginalPositionsRef.current[targetId]) {
        delete cliOriginalPositionsRef.current[targetId];
      }
      if (cliShiftedPositionsRef.current[targetId]) {
        delete cliShiftedPositionsRef.current[targetId];
      }
      setExpandedProjectNodes((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      if (projectOriginalPositionsRef.current[targetId]) {
        delete projectOriginalPositionsRef.current[targetId];
      }
      if (projectShiftedPositionsRef.current[targetId]) {
        delete projectShiftedPositionsRef.current[targetId];
      }
      if (selectedNodeId === targetId) setSelectedNodeId(null);
      setSelectedNodeIds((prev) => prev.filter((id) => id !== targetId));
      if (configuringNodeId === targetId) setConfiguringNodeId(null);
      if (nodeOptionsPopup?.nodeId === targetId) setNodeOptionsPopup(null);
      onToast?.(`Nó "${nodeToDelete.title}" excluído com sucesso.`);
    } finally {
      setIsDeleting(false);
      setNodeToDelete(null);
    }
  };

  const handleDuplicateSelectedNodes = useCallback(() => {
    const selectedIds = selectedNodeIdsRef.current;
    if (selectedIds.length === 0) return;

    const selectedNodesList = nodes.filter((n) => selectedIds.includes(n.id));
    if (selectedNodesList.length === 0) return;

    const idMap: Record<string, string> = {};
    const newNodes: WorkflowNode[] = [];

    for (const original of selectedNodesList) {
      const newId = `${original.id}-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      idMap[original.id] = newId;
      newNodes.push({
        ...original,
        id: newId,
        title: `${original.title} (Cópia)`,
        x: original.x + 40,
        y: original.y + 40,
        status: 'ready',
        needsAttention: false,
        output: undefined,
      });
    }

    const selectedIdSet = new Set(selectedIds);
    const newEdges: WorkflowEdge[] = [];
    for (const edge of edges) {
      if (selectedIdSet.has(edge.fromNodeId) && selectedIdSet.has(edge.toNodeId)) {
        newEdges.push({
          ...edge,
          id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          fromNodeId: idMap[edge.fromNodeId],
          toNodeId: idMap[edge.toNodeId],
          isActive: false,
        });
      }
    }

    setNodes((prev) => [...prev, ...newNodes]);
    if (newEdges.length > 0) {
      setEdges((prev) => [...prev, ...newEdges]);
    }

    const createdIds = Object.values(idMap);
    setSelectedNodeIds(createdIds);
    if (createdIds.length > 0) {
      setSelectedNodeId(createdIds[createdIds.length - 1]);
    }
    onToast?.(`${newNodes.length} nós duplicados.`);
  }, [nodes, edges, onToast]);

  const handleToggleSelectedNodesStatus = useCallback(() => {
    const selectedIds = new Set(selectedNodeIdsRef.current);
    if (selectedIds.size === 0) return;

    const anyEnabled = nodes.some((n) => selectedIds.has(n.id) && n.status !== 'disabled');
    const newStatus = anyEnabled ? 'disabled' : 'ready';

    setNodes((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, status: newStatus } : n))
    );
    onToast?.(`${selectedIds.size} nós ${newStatus === 'disabled' ? 'desativados' : 'ativados'}.`);
  }, [nodes, onToast]);

  const handleDeleteSelectedNodes = useCallback(() => {
    const selectedIds = new Set(selectedNodeIdsRef.current);
    if (selectedIds.size === 0) return;

    const targets = nodes.filter((n) => selectedIds.has(n.id));
    if (targets.length > 0) {
      setNodesToDelete(targets);
    }
  }, [nodes]);

  const confirmDeleteSelectedNodes = useCallback(async () => {
    if (!nodesToDelete || nodesToDelete.length === 0) return;
    const targetIds = new Set(nodesToDelete.map((n) => n.id));
    setIsDeleting(true);

    try {
      killNodeSessions(Array.from(targetIds), activeFloorId);

      setNodes((prev) => prev.filter((n) => !targetIds.has(n.id)));
      setEdges((prev) => prev.filter((e) => !targetIds.has(e.fromNodeId) && !targetIds.has(e.toNodeId)));

      setExpandedCliNodes((prev) => {
        const copy = { ...prev };
        for (const id of targetIds) delete copy[id];
        return copy;
      });
      setNodeIncomingUrls((prev) => {
        const next = { ...prev };
        for (const id of targetIds) delete next[id];
        return next;
      });

      for (const id of targetIds) {
        if (cliOriginalPositionsRef.current[id]) delete cliOriginalPositionsRef.current[id];
        if (cliShiftedPositionsRef.current[id]) delete cliShiftedPositionsRef.current[id];
        if (projectOriginalPositionsRef.current[id]) delete projectOriginalPositionsRef.current[id];
        if (projectShiftedPositionsRef.current[id]) delete projectShiftedPositionsRef.current[id];
      }
      setExpandedProjectNodes((prev) => {
        const copy = { ...prev };
        for (const id of targetIds) delete copy[id];
        return copy;
      });

      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      if (configuringNodeId && targetIds.has(configuringNodeId)) {
        setConfiguringNodeId(null);
      }
      if (activeInstructionNodeId && targetIds.has(activeInstructionNodeId)) {
        setActiveInstructionNodeId(null);
        setIsInstructionVisible(false);
      }
      if (nodeOptionsPopup && targetIds.has(nodeOptionsPopup.nodeId)) {
        setNodeOptionsPopup(null);
      }

      const count = nodesToDelete.length;
      onToast?.(`${count} ${count === 1 ? 'nó excluído' : 'nós excluídos'} com sucesso.`);
    } finally {
      setIsDeleting(false);
      setNodesToDelete(null);
    }
  }, [nodesToDelete, killNodeSessions, activeFloorId, configuringNodeId, activeInstructionNodeId, nodeOptionsPopup, onToast]);

  const handleUpdateNode = useCallback(
    (id: string, updates: Partial<WorkflowNode> | { config?: any; title?: string; subtitle?: string }) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            ...updates,
            config: (updates as any).config ? { ...n.config, ...(updates as any).config } : n.config,
          };
        })
      );
    },
    []
  );

  const handleResetToDefault = () => {
    killNodeSessions(nodes.map((n) => n.id));
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setConfiguringNodeId(null);
    setExpandedCliNodes({});
    cliOriginalPositionsRef.current = {};
    cliShiftedPositionsRef.current = {};
    setExpandedProjectNodes({});
    projectOriginalPositionsRef.current = {};
    projectShiftedPositionsRef.current = {};
    onToast?.('Fluxo restaurado para o padrão.');
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
    if (pastedNode.type !== 'webview') {
      setActiveInstructionNodeId(newId);
      setIsInstructionVisible(true);
    } else {
      setIsInstructionVisible(false);
    }

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
    if (duplicatedNode.type !== 'webview') {
      setActiveInstructionNodeId(newId);
      setIsInstructionVisible(true);
    } else {
      setIsInstructionVisible(false);
    }
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

  // Mostra badges numéricos nos cards enquanto Ctrl/Cmd estiver pressionado
  const [isNumberNavActive, setIsNumberNavActive] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMaestroOpen, setIsMaestroOpen] = useState(false);

  // Keyboard listener for Escape, Delete, Duplicate (Cmd/Ctrl+D), Toggle Status (D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable ||
          Boolean(activeEl.closest?.('.xterm')) ||
          Boolean(activeEl.closest?.('[data-terminal="true"]')));

      if (e.key === 'Escape') {
        if (selectedNodeIdsRef.current.length > 0) {
          setSelectedNodeIds([]);
        }
        if (isAiPickerOpen) setIsAiPickerOpen(false);
        if (nodeOptionsPopup) setNodeOptionsPopup(null);
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isMaestroOpen) setIsMaestroOpen(false);
        if (isSimulatorPanelOpen) setIsSimulatorPanelOpen(false);
        if (isFloorsMenuOpen) setIsFloorsMenuOpen(false);
        if (isInstructionVisible) setIsInstructionVisible(false);
        if (configuringNodeId) setConfiguringNodeId(null);
        if (draggingLink) setDraggingLink(null);
        setSelectedNodeId(null);
      } else if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedNodeIdsRef.current.length > 1) {
          const targets = nodes.filter((n) => selectedNodeIdsRef.current.includes(n.id));
          if (targets.length > 0) setNodesToDelete(targets);
        } else if (nodeOptionsPopup && activePopupNode) {
          const target = activePopupNode;
          setNodeOptionsPopup(null);
          setNodeToDelete(target);
        } else if (selectedNodeId) {
          const targetNode = nodes.find((n) => n.id === selectedNodeId);
          if (targetNode) setNodeToDelete(targetNode);
        }
      } else if (!isInput && (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const allIds = nodes.map((n) => n.id);
        setSelectedNodeIds(allIds);
        if (allIds.length > 0) setSelectedNodeId(allIds[0]);
        onToast?.(`${allIds.length} nós selecionados.`);
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
        if (selectedNodeIdsRef.current.length > 1) {
          handleDuplicateSelectedNodes();
        } else if (selectedNodeId) {
          handleDuplicateNode(selectedNodeId);
        }
      } else if (!isInput && !e.metaKey && !e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        if (selectedNodeIdsRef.current.length > 1) {
          handleToggleSelectedNodesStatus();
        } else if (selectedNodeId) {
          handleToggleNodeStatus(selectedNodeId);
        }
      } else if (!isInput && (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        handleFocusNextAttention();
      } else if (!isInput && (e.metaKey || e.ctrlKey) && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const index = Number(e.key) - 1;
        const target = nodes[index];
        if (target) {
          e.preventDefault();
          handleFocusNode(target.id);
        }
      } else if (!isInput && activeTab === 'canvas' && (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (
        !isInput &&
        activeTab === 'canvas' &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === 'm' || e.key === 'M' || e.key === 'o' || e.key === 'O')
      ) {
        e.preventDefault();
        setIsMaestroOpen((prev) => !prev);
      } else if (!isInput && e.code === 'Space' && !isSpacePressedRef.current) {
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };
    const handleBlur = () => {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    isAiPickerOpen,
    nodeOptionsPopup,
    activePopupNode,
    isCommandPaletteOpen,
    isMaestroOpen,
    isSimulatorPanelOpen,
    isFloorsMenuOpen,
    isInstructionVisible,
    configuringNodeId,
    draggingLink,
    selectedNodeId,
    nodes,
    handleCopyNode,
    handlePasteNode,
    copiedNode,
    handleDuplicateNode,
    handleToggleNodeStatus,
    handleFocusNextAttention,
    handleFocusNode,
    activeTab,
  ]);
  useEffect(() => {
    const handleModifierDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsNumberNavActive(true);
    };
    const handleModifierUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsNumberNavActive(false);
    };
    const handleBlur = () => setIsNumberNavActive(false);
    window.addEventListener('keydown', handleModifierDown);
    window.addEventListener('keyup', handleModifierUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleModifierDown);
      window.removeEventListener('keyup', handleModifierUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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
        : color === '#64748b'
        ? 'url(#neon-glow-slate)'
        : 'url(#neon-glow-accent)';

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
  // ANIMATED MULTI-FILAMENT BEZIER WIRES (WITH GLOW AND PARTICLES - RESTORED)
  // ============================================================================

  const isEdgeInUse = (edge: WorkflowEdge) =>
    Boolean(edge.isActive || activeDynamicEdgeIds.has(edge.id));

  const renderAnimatedWires = () => {
    return edges.map((edge) => {
      const { from, to, fromDir, toDir } = getConnectionEndpoints(edge);
      const { midX, midY, mainD, waveUpperD, waveLowerD } = getCableGeometry(
        from,
        to,
        fromDir,
        toDir,
        edge.labelRatio ?? 0.5
      );

      const isWireActive = isEdgeInUse(edge);
      const isMemoryWire =
        edge.color === '#ffffff' ||
        edge.color === '#64748b' ||
        edge.fromPort === 'memory' ||
        edge.toPort === 'memory';
      const idleColor = isEffectiveDark ? '#4a4a4f' : '#b6bcc6';
      const wireColor = !isWireActive
        ? idleColor
        : isMemoryWire
        ? (isEffectiveDark ? '#ffffff' : '#64748b')
        : accentColor;
      const glowFilter = isMemoryWire
        ? (isEffectiveDark ? 'url(#neon-glow-white)' : 'url(#neon-glow-slate)')
        : 'url(#neon-glow-accent)';

      return (
        <g key={edge.id}>
          {isWireActive ? (
            <>
              {/* 1. Core Glow Halo (Drawn behind the arrow meniscus) */}
              <path d={mainD} fill="none" stroke={wireColor} strokeWidth={3} strokeOpacity={0.35} filter={glowFilter} />

              {/* 2. Upper Organic Harmonic Filament + fluxo de energia */}
              <path d={waveUpperD} fill="none" stroke={wireColor} strokeWidth={0.85} strokeOpacity={0.5} />
              <path
                d={waveUpperD}
                fill="none"
                stroke={isMemoryWire ? '#ffffff' : wireColor}
                strokeWidth={1}
                strokeDasharray="18 94"
                strokeLinecap="round"
                strokeOpacity={0.6}
                style={{ animation: 'dash-flow 1.4s linear infinite', willChange: 'stroke-dashoffset' }}
              />

              {/* 3. Central Bright Core Beam */}
              <path d={mainD} fill="none" stroke={wireColor} strokeWidth={1.25} strokeOpacity={0.95} />

              {/* 4. Lower Organic Harmonic Filament + fluxo de energia */}
              <path d={waveLowerD} fill="none" stroke={wireColor} strokeWidth={0.85} strokeOpacity={0.5} />
              <path
                d={waveLowerD}
                fill="none"
                stroke={isMemoryWire ? '#ffffff' : wireColor}
                strokeWidth={1}
                strokeDasharray="18 94"
                strokeLinecap="round"
                strokeOpacity={0.6}
                style={{ animation: 'dash-flow 1.4s linear infinite', willChange: 'stroke-dashoffset' }}
              />

              {/* 5a. Soft Glowing Optical Energy Stream along main cable */}
              <path
                d={mainD}
                fill="none"
                stroke={wireColor}
                strokeWidth={3.5}
                strokeDasharray="26 86"
                strokeLinecap="round"
                strokeOpacity={0.55}
                filter={glowFilter}
                style={{ animation: 'dash-flow 1.4s linear infinite', willChange: 'stroke-dashoffset' }}
              />

              {/* 5b. Crisp Core Laser Stream along main cable */}
              <path
                d={mainD}
                fill="none"
                stroke="#ffffff"
                strokeWidth={1.75}
                strokeDasharray="26 86"
                strokeLinecap="round"
                strokeOpacity={0.95}
                style={{ animation: 'dash-flow 1.4s linear infinite', willChange: 'stroke-dashoffset' }}
              />
            </>
          ) : (
            <>
              {/* Link ocioso: cinza, sem brilho e sem animação */}
              <path d={waveUpperD} fill="none" stroke={wireColor} strokeWidth={0.85} strokeOpacity={0.45} />
              <path d={mainD} fill="none" stroke={wireColor} strokeWidth={1.25} strokeOpacity={0.9} />
              <path d={waveLowerD} fill="none" stroke={wireColor} strokeWidth={0.85} strokeOpacity={0.45} />
            </>
          )}

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
              if (draggingTagRef.current) return;
              handleStartDraggingExistingLink(edge, e);
            }}
          >
            <title>Clique e arraste para mover este link</title>
          </path>

          {/* 8. Center Capsule Pill (exibido apenas quando há dado transitado na execução) */}
          {Boolean(edge.label) && (() => {
            const labelText = edge.label || '';
            const pillWidth = Math.max(54, labelText.length * 7 + 16);
            const halfW = pillWidth / 2;
            const isDraggingThisTag = draggingTagEdgeId === edge.id;

            return (
              <g
                transform={`translate(${midX}, ${midY})`}
                style={{
                  cursor: isDraggingThisTag ? 'grabbing' : 'grab',
                  pointerEvents: 'all',
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  handleStartDraggingTag(edge.id, e);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <title>Clique e arraste para posicionar ao longo da linha</title>
                {/* Generous invisible padding hit area to prevent accidentally grabbing the cable underneath */}
                <rect
                  x={-halfW - 10}
                  y={-18}
                  width={pillWidth + 20}
                  height={36}
                  fill="transparent"
                  style={{ pointerEvents: 'all' }}
                />
                {/* Visual Pill Capsule */}
                <rect
                  x={-halfW}
                  y={-12}
                  width={pillWidth}
                  height={24}
                  rx={12}
                  fill={isEffectiveDark ? '#121212' : '#ffffff'}
                  stroke={
                    isDraggingThisTag
                      ? accentColor
                      : isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'rgba(0, 0, 0, 0.15)'
                  }
                  strokeWidth={isDraggingThisTag ? 1.5 : 1}
                  filter={isDraggingThisTag ? 'url(#neon-glow-accent)' : undefined}
                />
                <text
                  x={0}
                  y={0}
                  dominantBaseline="central"
                  fill={isEffectiveDark ? '#ffffff' : '#0f172a'}
                  fontSize={11}
                  fontWeight={500}
                  textAnchor="middle"
                  fontFamily="inherit"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {labelText}
                </text>
              </g>
            );
          })()}
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
    const fromDir = draggingLink.fromDir || (isVert ? 'down' : 'right');
    const toDir: 'left' | 'up' | 'down' | 'right' =
      draggingLink.snappedSide === 'top'
        ? 'up'
        : draggingLink.snappedSide === 'bottom'
        ? 'down'
        : draggingLink.snappedSide === 'right'
        ? 'right'
        : isVert
        ? 'up'
        : 'left';
    const from = (draggingLink.fromX !== undefined && draggingLink.fromY !== undefined)
      ? { x: draggingLink.fromX, y: draggingLink.fromY }
      : getPortCoordinates(draggingLink.fromNodeId, 'output', draggingLink.fromPort);
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
          <text x={0} y={0} dominantBaseline="central" fill={isEffectiveDark ? '#ffffff' : '#0f172a'} fontSize={11} fontWeight={500} textAnchor="middle">
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

  const renderNodeCard = (node: WorkflowNode, nodeIndex: number) => {
    try {
      const numberBadgeIndex = nodeIndex < 9 ? nodeIndex + 1 : null;
    const isSelected =
      selectedNodeIds.includes(node.id) ||
      selectedNodeId === node.id ||
      configuringNodeId === node.id ||
      nodeOptionsPopup?.nodeId === node.id;
    const isRunning = node.status === 'running';
    const { width, height } = getNodeDimensions(node);
    const incomingEdges = edges.filter((e) => e.toNodeId === node.id && (e.toPort === 'in' || !e.toPort));
    const hasIncomingEdge = incomingEdges.length > 0;
    const isCliExpanded = !!expandedCliNodes[node.id] || node.type === 'ide';
    const isWebview = node.type === 'webview';
    const isProject = node.type === 'project';

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
    } else if (node.type === 'ide') {
      IconElement = <Terminal size={26} color={accentColor} strokeWidth={1.25} />;
      badgeText = 'IDE';
    } else if (node.type === 'memory') {
      IconElement = <Database size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Memória';
    } else if (node.type === 'webview') {
      IconElement = <Globe size={26} color={isEffectiveDark ? '#ffffff' : '#1e293b'} strokeWidth={1.25} />;
      badgeText = 'Navegador';
    } else if (node.type === 'project') {
      const isCloned = node.config?.isCloned !== false && Boolean(node.config?.projectPath);
      IconElement = isCloned ? (
        <FolderGit2 size={26} color={accentColor} strokeWidth={1.25} />
      ) : (
        <DownloadCloud size={26} color="#38bdf8" strokeWidth={1.25} />
      );
      badgeText = isCloned ? 'Projeto' : 'Git (Clonar)';
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
            border: isSelected
              ? `1.5px solid ${accentColor}`
              : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)'),
            pointerEvents: 'none',
            boxShadow: isSelected
              ? `0 0 16px ${accentColor}40`
              : 'none',
            transition:
              draggingNodeId === node.id || resizingNode?.nodeId === node.id
                ? 'none'
                : 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), top 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1), height 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s ease, box-shadow 0.15s ease',
            zIndex: isSelected ? 29 : 9,
          }}
        >
          {/* Top-left interactive corner resize bracket (Borda de redimensionamento visível) */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'nw')}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setNodeOptionsPopup({
                nodeId: node.id,
                x: Math.max(12, Math.min(e.clientX + 6, window.innerWidth - 242)),
                y: Math.max(12, Math.min(e.clientY + 4, window.innerHeight - 332)),
                view: 'menu',
              });
            }}
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
              borderTop: isSelected
                ? `2px solid ${accentColor}`
                : `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderLeft: isSelected
                ? `2px solid ${accentColor}`
                : `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderTopLeftRadius: 22,
              pointerEvents: 'auto',
              cursor: 'nwse-resize',
              zIndex: 60,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              setHoveredResizeNodeId(node.id);
              e.currentTarget.style.borderTopColor = accentColor;
              e.currentTarget.style.borderLeftColor = accentColor;
            }}
            onMouseLeave={(e) => {
              setHoveredResizeNodeId(null);
              e.currentTarget.style.borderTopColor = isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)');
              e.currentTarget.style.borderLeftColor = isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)');
            }}
            title="Redimensionar nó (clique para alternar tamanho ou arraste pelo canto superior esquerdo)"
          />

          {/* Bottom-right interactive corner resize bracket */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'se')}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setNodeOptionsPopup({
                nodeId: node.id,
                x: Math.max(12, Math.min(e.clientX + 6, window.innerWidth - 242)),
                y: Math.max(12, Math.min(e.clientY + 4, window.innerHeight - 332)),
                view: 'menu',
              });
            }}
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
              borderBottom: isSelected
                ? `2px solid ${accentColor}`
                : `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderRight: isSelected
                ? `2px solid ${accentColor}`
                : `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)'}`,
              borderBottomRightRadius: 22,
              pointerEvents: 'auto',
              cursor: 'se-resize',
              zIndex: 60,
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              setHoveredResizeNodeId(node.id);
              e.currentTarget.style.borderBottomColor = accentColor;
              e.currentTarget.style.borderRightColor = accentColor;
            }}
            onMouseLeave={(e) => {
              setHoveredResizeNodeId(null);
              e.currentTarget.style.borderBottomColor = isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)');
              e.currentTarget.style.borderRightColor = isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.45)');
            }}
            title="Redimensionar nó (arraste pelo canto inferior direito)"
          />
        </div>

        {/* Main Card Container */}
        <div
          data-node-card="true"
          onMouseEnter={(e) => {
            setHoveredNodeId(node.id);
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / zoom;
            const relY = (e.clientY - rect.top) / zoom;
            const edgeThresholdX = Math.min(16, width * 0.08);
            const edgeThresholdY = Math.min(14, height * 0.08);
            const isCentral =
              relX > edgeThresholdX &&
              relX < width - edgeThresholdX &&
              relY > edgeThresholdY &&
              relY < height - edgeThresholdY;
            setCenterHoveredNodeId(isCentral ? node.id : null);
          }}
          onMouseLeave={() => {
            setHoveredNodeId(null);
            setHoveredResizeNodeId(null);
            setCenterHoveredNodeId(null);
            setNodeInputHandlePositions((prev) => {
              if (!prev[node.id]) return prev;
              const next = { ...prev };
              delete next[node.id];
              return next;
            });
            delete nodeInputHandlePositionsRef.current[node.id];
          }}
          onMouseMove={(e) => handleCardMouseMove(node.id, width, height, e)}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              performZoomAt(e.clientX, e.clientY, e.deltaY);
            }
          }}
          onClick={(e) => {
            if (!hasDraggedRef.current) {
              e.stopPropagation();
              if (e.shiftKey || e.metaKey || e.ctrlKey) {
                setSelectedNodeIds((prev) => {
                  const next = prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id];
                  if (next.length === 1) {
                    setSelectedNodeId(next[0]);
                    setActiveInstructionNodeId(next[0]);
                    const targetNode = nodes.find((n) => n.id === next[0]);
                    const isTerminal = Boolean(targetNode && (expandedCliNodes[targetNode.id] || targetNode.type === 'tool'));
                    setIsInstructionVisible(!isTerminal && targetNode?.type !== 'webview');
                  } else {
                    setSelectedNodeId(null);
                    setIsInstructionVisible(false);
                  }
                  return next;
                });
              } else {
                setSelectedNodeIds([node.id]);
                setSelectedNodeId(node.id);
                if (node.type !== 'webview') {
                  setActiveInstructionNodeId(node.id);
                  const isTerminal = Boolean(expandedCliNodes[node.id] || node.type === 'tool');
                  setIsInstructionVisible(!isTerminal);
                } else {
                  setIsInstructionVisible(false);
                }
              }
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedNodeId(node.id);
            if (!selectedNodeIds.includes(node.id)) {
              setSelectedNodeIds([node.id]);
            }
            const popupWidth = 230;
            const popupHeight = 320;
            let posX = e.clientX + 6;
            if (posX + popupWidth > window.innerWidth - 12) {
              posX = e.clientX - popupWidth - 6;
            }
            let posY = e.clientY + 4;
            if (posY + popupHeight > window.innerHeight - 12) {
              posY = Math.max(12, window.innerHeight - popupHeight - 12);
            }
            setNodeOptionsPopup({
              nodeId: node.id,
              x: Math.max(12, posX),
              y: Math.max(12, posY),
              view: 'menu',
            });
          }}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width,
            height,
            minHeight: height,
            pointerEvents: 'auto',
            background: isEffectiveDark ? '#141414' : '#ffffff',
            border: isSelected
              ? `1.5px solid ${accentColor}`
              : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)'),
            borderRadius: 18,
            boxShadow: isSelected
              ? (isEffectiveDark
                  ? `0 0 0 1px ${accentColor}, 0 0 24px ${accentColor}40, 0 14px 34px rgba(0,0,0,0.75)`
                  : `0 0 0 1px ${accentColor}, 0 0 20px ${accentColor}33, 0 14px 34px rgba(0,0,0,0.12)`)
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
            alignItems: isCliExpanded || isWebview || (isProject && Boolean(expandedProjectNodes[node.id])) ? 'stretch' : 'center',
            justifyContent: isCliExpanded || isWebview || (isProject && Boolean(expandedProjectNodes[node.id])) ? 'flex-start' : 'center',
            padding: isCliExpanded || isWebview || (isProject && Boolean(expandedProjectNodes[node.id])) ? 0 : '12px 10px',
            boxSizing: 'border-box',
            overflow: 'visible',
            zIndex: isSelected ? 30 : 10,
          }}
        >
          {isWebview ? (
            <OrchestrationBrowserNode
              nodeId={node.id}
              initialUrl={
                node.config.url && node.config.url !== 'about:blank'
                  ? node.config.url
                  : (getConnectedProjectNodes(node.id, nodes, edges)[0]?.config?.devUrl || 'about:blank')
              }
              initialTabs={node.config.tabs}
              initialActiveTabId={node.config.activeTabId}
              width={width}
              height={height}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              isCtrlOrMetaPressed={isCtrlOrMetaPressed}
              incomingUrl={nodeIncomingUrls[node.id] || null}
              onUpdateUrl={(url) => {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id ? { ...n, config: { ...n.config, url } } : n
                  )
                );
              }}
              onUpdateTabs={(tabs, activeTabId) => {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id
                      ? {
                          ...n,
                          config: {
                            ...n.config,
                            tabs,
                            activeTabId,
                            url: tabs.find((t) => t.id === activeTabId)?.url || n.config.url,
                          },
                        }
                      : n
                  )
                );
              }}
              connectedProject={(() => {
                const p = getConnectedProjectNodes(node.id, nodes, edges)[0];
                if (!p) return null;
                return {
                  id: p.id,
                  title: p.title,
                  projectName: p.config?.projectName || p.title,
                  projectPath: p.config?.projectPath,
                  devUrl: p.config?.devUrl,
                };
              })()}
              allProjects={nodes
                .filter((n) => n.type === 'project')
                .map((p) => ({
                  id: p.id,
                  title: p.title,
                  projectName: p.config?.projectName || p.title,
                  projectPath: p.config?.projectPath,
                  devUrl: p.config?.devUrl,
                }))}
              onStartProjectDev={async (projectPath, projectName) => {
                if (!window.electronAPI?.pty) return;
                const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                const sessionId = `dev-server-${cleanName}`;
                await window.electronAPI.pty.create(sessionId, 'zsh', projectPath, 100, 24, accentColor);
                const runCmd = 'bun run dev 2>/dev/null || pnpm dev 2>/dev/null || npm run dev\n';
                window.electronAPI.pty.write(sessionId, runCmd);
                onToast?.(`🚀 Servidor de "${projectName}" iniciado no terminal integrado!`, 'success');
              }}
              onDeleteNode={() => {
                setNodeToDelete(node);
              }}
              onToast={onToast}
            />
          ) : isProject && Boolean(expandedProjectNodes[node.id]) ? (
            <OrchestrationProjectNode
              nodeId={node.id}
              projectName={node.config?.projectName || node.title || 'Projeto'}
              projectPath={node.config?.projectPath || ''}
              gitBranch={node.config?.gitBranch || 'main'}
              cloneUrl={node.config?.cloneUrl}
              htmlUrl={node.config?.htmlUrl}
              isCloned={node.config?.isCloned !== false && Boolean(node.config?.projectPath)}
              width={width}
              height={height}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              isExpanded={true}
              onToggleExpand={() => toggleProjectNode(node.id)}
              onUpdateConfig={(updates) => {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === node.id
                      ? {
                          ...n,
                          title: updates.projectName || n.title,
                          subtitle: updates.isCloned === false
                            ? 'Git • Não clonado'
                            : `${updates.gitBranch || n.config?.gitBranch || 'main'} • Projeto`,
                          config: { ...n.config, ...updates },
                        }
                      : n
                  )
                );
              }}
              onOpenUrlInBrowser={(url) => {
                handleOpenUrlFromNode(node.id, url);
              }}
              onDeleteNode={() => {
                setNodeToDelete(node);
              }}
              onToast={onToast}
            />
          ) : (
            <>
              {Boolean(openedCliNodeIds.has(node.id) || isCliExpanded || node.type === 'ide') && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: isCliExpanded ? 'flex' : 'none',
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
                  if ((e.target as HTMLElement).closest('button')) {
                    e.stopPropagation();
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative' }}>
                    {node.type === 'model'
                      ? (AI_PROVIDER_INFOS[(node.provider || selectedAiProvider || 'claude') as AiProviderId] || AI_PROVIDER_INFOS.claude).renderIcon(18)
                      : <Bot size={16} color={isEffectiveDark ? '#ffffff' : '#1e293b'} />}
                    {isNumberNavActive && numberBadgeIndex !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: -8,
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          background: accentColor,
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 0 2px ' + (isEffectiveDark ? '#18181b' : '#f1f5f9'),
                        }}
                      >
                        {numberBadgeIndex}
                      </div>
                    )}
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
                    {(() => {
                      const nodeRole = node.roleId ? roles.find((r) => r.id === node.roleId) : null;
                      return nodeRole ? (
                        <span
                          title={nodeRole.instructions}
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: `${nodeRole.color}25`,
                            color: nodeRole.color,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 90,
                          }}
                        >
                          {nodeRole.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {node.needsAttention && (
                    <div
                      title="Aguardando sua atenção"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: '0 0 8px #ef4444',
                      }}
                    />
                  )}
                  {/* Active PTY status dot */}
                  {(() => {
                    const isBusy =
                      busyCliNodeIds.has(node.id) ||
                      node.status === 'running' ||
                      (isExecutingFlow && (node.type === 'agent' || node.type === 'model'));
                    return (
                      <div
                        title={isBusy ? 'Terminal em processamento da IA' : 'Terminal ocioso'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          color: isBusy ? '#10b981' : textSecondary,
                          marginRight: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: isBusy ? '#10b981' : (isEffectiveDark ? '#52525b' : '#94a3b8'),
                            boxShadow: isBusy ? '0 0 8px #10b981' : 'none',
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 500 }}>{isBusy ? 'Executando' : 'Ocioso'}</span>
                      </div>
                    );
                  })()}

                  {/* Connected Browser Shortcut */}
                  {(() => {
                    const connectedBrowsers = getConnectedBrowserNodes(node.id, nodes, edges);
                    if (connectedBrowsers.length === 0) return null;
                    const bNode = connectedBrowsers[0];
                    const bUrl = bNode.config.url && bNode.config.url !== 'about:blank'
                      ? bNode.config.url
                      : (node.config?.devUrl || 'about:blank');
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUrlFromNode(node.id, bUrl);
                        }}
                        title={`Abrir no Navegador Conectado (${bNode.title} • ${bUrl})`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          marginRight: 2,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)';
                          e.currentTarget.style.borderColor = '#38bdf8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                        }}
                      >
                        <Globe size={11} color="#38bdf8" />
                        <span>Navegador Conectado</span>
                      </button>
                    );
                  })()}

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

              {node.isMaestro && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '8px 12px',
                    background: `${accentColor}0d`,
                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, color: accentColor }}>
                    <Sparkles size={12} color={accentColor} strokeWidth={1.5} />
                    <span>Modo Maestro — descreva o que precisa</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder='Ex: monte um Dev, um Revisor e um Testador, conecte à nota "Spec"'
                      value={maestroDrafts[node.id] || ''}
                      onChange={(e) => setMaestroDrafts((prev) => ({ ...prev, [node.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !maestroBusy[node.id]) handleMaestroRecruit(node.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                        background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                        color: textPrimary,
                        fontSize: 11,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => handleMaestroRecruit(node.id)}
                      disabled={maestroBusy[node.id] || !(maestroDrafts[node.id] || '').trim()}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: accentColor,
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: maestroBusy[node.id] ? 'default' : 'pointer',
                        opacity: maestroBusy[node.id] || !(maestroDrafts[node.id] || '').trim() ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {maestroBusy[node.id] ? 'Recrutando…' : 'Recrutar'}
                    </button>
                  </div>
                  {maestroRawError[node.id] && (
                    <div
                      style={{
                        fontSize: 10,
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        maxHeight: 100,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                      }}
                    >
                      {maestroRawError[node.id]}
                    </div>
                  )}
                </div>
              )}

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
                {(() => {
                  const nodeConnectedProjects = getConnectedProjectNodes(node.id, nodes, edges);
                  const nodeProjectCwd = nodeConnectedProjects[0]?.config?.path || nodeConnectedProjects[0]?.config?.url || effectiveWorkspacePath;
                  const sType = getNodeCliSessionType(node);
                  return (
                    <NativeXTerm
                      sessionId={getOrchestrationCliSessionId(activeFloorId, node.id)}
                      sessionType={sType}
                      cwd={nodeProjectCwd}
                      isActive={isTabActive && isCliExpanded}
                      initialCommand={getInitialCliCommand(node)}
                      accentColor={accentColor}
                      isDark={isEffectiveDark}
                      fontSize={12}
                      onOpenUrl={(url) => handleOpenUrlFromNode(node.id, url)}
                      onServerUrlDetected={(detectedUrl) => handleOpenUrlFromNode(node.id, detectedUrl, { fromServerDetection: true })}
                    />
                  );
                })()}
              </div>
            </div>
              )}

              {!isCliExpanded && (
                <>
              {/* Quick options trigger button (3 dots on hover or when selected) */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
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

              {/* Botão rápido para Abrir CLI nos Cards de IA, Ferramenta ou IDE */}
              {(node.type === 'agent' || node.type === 'model' || node.type === 'tool' || node.type === 'ide') && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeCli(node.id);
                  }}
                  title="Abrir CLI do Card"
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 38,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: 6,
                    color: accentColor,
                    padding: '3px 6px',
                    display: isSelected || hoveredNodeId === node.id ? 'flex' : 'none',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    zIndex: 35,
                    fontSize: 9.5,
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${accentColor}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <Terminal size={11} strokeWidth={1.5} color={accentColor} />
                  <span>CLI</span>
                </button>
              )}
              {/* Top-Right Status: Crisp Green Checkmark matching Image 2 */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  justifyContent: 'center',
                }}
              >
                {node.needsAttention && (
                  <div
                    title="Aguardando sua atenção"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 8px #ef4444',
                    }}
                  />
                )}
                {isRunning ? (
                  <RefreshCw size={13} color="#22c55e" strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                ) : node.status === 'failed' || node.status === 'cancelled' ? (
                  <AlertCircle size={13} color={node.status === 'cancelled' ? '#f59e0b' : '#ef4444'} strokeWidth={1.5} />
                ) : node.status === 'disabled' ? (
                  <Pause size={13} color={textSecondary} strokeWidth={1.5} />
                ) : node.status === 'success' ? (
                  <Check size={14} color="#22c55e" strokeWidth={1.5} />
                ) : null}
              </div>

              {isNumberNavActive && numberBadgeIndex !== null && (
                <div
                  style={{
                    position: 'absolute',
                    top: -7,
                    left: -7,
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 36,
                    border: `2px solid ${isEffectiveDark ? '#141414' : '#ffffff'}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  }}
                >
                  {numberBadgeIndex}
                </div>
              )}

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
                {node.type === 'model'
                  ? (node.title?.replace(/^Modelo\s+/i, '') || AI_PROVIDER_INFOS[(node.provider as AiProviderId) || 'claude']?.name || 'IA')
                  : node.title}
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
                {node.type === 'model'
                  ? (node.config?.model || (node.subtitle?.includes('•') ? node.subtitle.split('•')[1]?.trim() : node.subtitle) || badgeText)
                  : (node.subtitle || badgeText)}
              </div>
              {(() => {
                const nodeRole = node.roleId ? roles.find((r) => r.id === node.roleId) : null;
                return nodeRole ? (
                  <div
                    title={nodeRole.instructions}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: `${nodeRole.color}25`,
                      color: nodeRole.color,
                      marginTop: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '90%',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {nodeRole.name}
                  </div>
                ) : null;
              })()}
                </>
              )}
            </>
          )}

          {/* Dynamic Input Port Handle (Bolinha de conexão de entrada acompanha o mouse na borda esquerda/cima/baixo/direita) */}
          {Boolean(node.ports?.input && Array.isArray(node.ports.input) && node.ports.input.length > 0) && (() => {
            try {
              const outerPad = 7;
              const primaryIncoming = incomingEdges && incomingEdges.length > 0 ? incomingEdges[incomingEdges.length - 1] : undefined;
              let dynPos: { side: 'left' | 'top' | 'bottom' | 'right'; ratio: number; x: number; y: number } | undefined;

              if (primaryIncoming) {
                const side = primaryIncoming.toSide || 'left';
                const r = typeof primaryIncoming.toRatio === 'number' && !isNaN(primaryIncoming.toRatio) ? primaryIncoming.toRatio : 0.5;
                if (side === 'top') {
                  dynPos = { side: 'top', ratio: r, x: width * r, y: 0 };
                } else if (side === 'bottom') {
                  dynPos = { side: 'bottom', ratio: r, x: width * r, y: height };
                } else if (side === 'right') {
                  dynPos = { side: 'right', ratio: r, x: width, y: height * r };
                } else {
                  dynPos = { side: 'left', ratio: r, x: 0, y: height * r };
                }
              } else {
                dynPos = nodeInputHandlePositions?.[node.id] || { side: 'left', ratio: 0.5, x: 0, y: height / 2 };
              }

              const dynSide = dynPos?.side || 'left';
              const dynX = typeof dynPos?.x === 'number' && !isNaN(dynPos.x) ? dynPos.x : (dynSide === 'right' ? width : 0);
              const dynY = typeof dynPos?.y === 'number' && !isNaN(dynPos.y) ? dynPos.y : (dynSide === 'bottom' ? height : height / 2);

              const inputLeft =
                dynSide === 'left'
                  ? -outerPad
                  : dynSide === 'right'
                  ? width + outerPad
                  : dynX;
              const inputTop =
                dynSide === 'top'
                  ? -outerPad
                  : dynSide === 'bottom'
                  ? height + outerPad
                  : dynY;

              const isSnapped = draggingLink?.snappedNodeId === node.id;
              const isHoveringResize = hoveredResizeNodeId === node.id;
              const isOverCenter = centerHoveredNodeId === node.id;
              const isDraggingThisNode = draggingNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;

              // O ponto laranja de entrada só deve ser visível com hover ativo no card (fora da região central e de redimensionamento)
              // ou quando um link estiver ativamente sendo arrastado e snapado neste nó
              const isVisible =
                !isDraggingThisNode &&
                !resizingNode &&
                !isHoveringResize &&
                !isOverCenter &&
                (isSnapped ||
                 (draggingLink && draggingLink.fromNodeId !== node.id && (isHovered || isSnapped)) ||
                 (!draggingLink && isHovered));

              return (
                <div
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    if (incomingEdges.length > 0) {
                      handleStartDraggingExistingLink(incomingEdges[incomingEdges.length - 1], e);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: inputLeft,
                    top: inputTop,
                    transform: isSnapped
                      ? 'translate(-50%, -50%) scale(1.3)'
                      : 'translate(-50%, -50%)',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: isSnapped
                      ? `${accentColor}33`
                      : (isEffectiveDark ? '#18181b' : '#ffffff'),
                    border: isSnapped
                      ? `2px solid ${accentColor}`
                      : draggingLink
                      ? `1.5px solid ${accentColor}`
                      : hasIncomingEdge
                      ? `1.5px solid ${accentColor}`
                      : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(0, 0, 0, 0.22)'),
                    boxShadow: isSnapped
                      ? `0 0 16px ${accentColor}`
                      : draggingLink
                      ? `0 0 10px ${accentColor}66`
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isVisible ? 1 : 0,
                    transition:
                      'opacity 0.18s ease, border-color 0.15s ease, transform 0.15s ease, background 0.15s ease',
                    pointerEvents: draggingLink && !isSnapped ? 'none' : 'auto',
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
                        background: isSnapped
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
              );
            } catch (err) {
              console.error('[OrchestrationCanvas] Erro ao renderizar input handle:', err);
              return null;
            }
          })()}

          {/* Dynamic Output Link Handle (Bolinha de conexão acompanha o mouse na borda direita/baixo/cima) */}
          {Boolean(node.ports?.output && Array.isArray(node.ports.output) && node.ports.output.length > 0) && !draggingLink && !draggingNodeId && !resizingNode && (() => {
            try {
              const isHoveringResize = hoveredResizeNodeId === node.id;
              const isOverCenter = centerHoveredNodeId === node.id;
              if (isHoveringResize || isOverCenter) return null;

              const outerPad = 7;
              const rawDynPos = nodeHandlePositions?.[node.id];
              const dynSide = rawDynPos?.side || 'right';
              const dynRatio = typeof rawDynPos?.ratio === 'number' && !isNaN(rawDynPos.ratio) ? rawDynPos.ratio : 0.5;
              const dynX = typeof rawDynPos?.x === 'number' && !isNaN(rawDynPos.x) ? rawDynPos.x : width;
              const dynY = typeof rawDynPos?.y === 'number' && !isNaN(rawDynPos.y) ? rawDynPos.y : height / 2;

              const handleLeft = dynSide === 'right' ? width + outerPad : dynX;
              const handleTop = dynSide === 'bottom' ? height + outerPad : dynSide === 'top' ? -outerPad : dynY;
              const arrowRotation = dynSide === 'bottom' ? 90 : dynSide === 'top' ? -90 : 0;
              const isVisible = hoveredNodeId === node.id && !isHoveringResize && !isOverCenter;

              return (
                <div
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  style={{
                    position: 'absolute',
                    left: handleLeft,
                    top: handleTop,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 65,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    pointerEvents: isVisible ? 'auto' : 'none',
                  }}
                >
                  <button
                    onMouseDown={(e) => {
                      handleStartDraggingLink(node.id, 'out', e, {
                        side: dynSide,
                        ratio: dynRatio,
                        fromX: node.x + handleLeft,
                        fromY: node.y + handleTop,
                      });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    title={`Puxar link de conexão (${dynSide === 'bottom' ? 'inferior' : dynSide === 'top' ? 'superior' : 'lateral'})`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isEffectiveDark ? '#18181b' : '#ffffff',
                      border: isEffectiveDark
                        ? '1.5px solid rgba(255, 255, 255, 0.45)'
                        : '1.5px solid rgba(0, 0, 0, 0.2)',
                      boxShadow: isEffectiveDark
                        ? '0 2px 10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                        : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'crosshair',
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? 'scale(1)' : 'scale(0.7)',
                      transition:
                        'opacity 0.18s ease, transform 0.18s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                      padding: 0,
                      pointerEvents: isVisible ? 'auto' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.background = `${accentColor}26`;
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = `0 0 14px ${accentColor}80`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.45)'
                        : 'rgba(0, 0, 0, 0.2)';
                      e.currentTarget.style.background = isEffectiveDark ? '#18181b' : '#ffffff';
                      e.currentTarget.style.transform = isVisible ? 'scale(1)' : 'scale(0.7)';
                      e.currentTarget.style.boxShadow = isEffectiveDark
                        ? '0 2px 10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                        : '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <ArrowRight
                      size={13}
                      color={isEffectiveDark ? '#ffffff' : '#1e293b'}
                      strokeWidth={2.2}
                      style={{
                        transform: `rotate(${arrowRotation}deg)`,
                        transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </button>
                </div>
              );
            } catch (err) {
              console.error('[OrchestrationCanvas] Erro ao renderizar output handle:', err);
              return null;
            }
          })()}

          {/* Bottom-right corner resize grip handle (especialmente visível e acessível para CLI e WebView) */}
          <div
            onMouseDown={(e) => handleStartResize(e, node.id, 'se')}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedNodeId(node.id);
              setNodeOptionsPopup({
                nodeId: node.id,
                x: Math.max(12, Math.min(e.clientX + 6, window.innerWidth - 242)),
                y: Math.max(12, Math.min(e.clientY + 4, window.innerHeight - 332)),
                view: 'menu',
              });
            }}
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
              setHoveredResizeNodeId(node.id);
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              setHoveredResizeNodeId(null);
              e.currentTarget.style.opacity = isSelected || isCliExpanded || isWebview ? '0.75' : '0.25';
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="8.5" y1="2.5" x2="2.5" y2="8.5" stroke={isEffectiveDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8.5" y1="5.5" x2="5.5" y2="8.5" stroke={isEffectiveDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Dynamic AI Working Tooltip (Posicionado onde houver menos links, sem borda, sem título, com seta orgânica dos links) */}
          {(node.type === 'agent' || node.type === 'model') &&
            (node.status === 'running' || busyCliNodeIds.has(node.id)) &&
            (() => {
              const placement = getOptimalTooltipSide(node, nodes, edges, getNodeDimensions);
              const activityText =
                nodeLiveActivity[node.id]?.text ||
                (node.type === 'agent'
                  ? 'Analisando fluxo e executando tarefas...'
                  : 'Processando raciocínio com IA...');

              const tooltipBg = isEffectiveDark ? '#14141c' : '#ffffff';

              let containerStyle: React.CSSProperties = {
                position: 'absolute',
                zIndex: 120,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              };

              let animName = 'aiTooltipFadeTop';
              let arrowSvg: React.ReactNode = null;

              if (placement === 'top') {
                containerStyle = {
                  ...containerStyle,
                  bottom: 'calc(100% + 15px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                };
                animName = 'aiTooltipFadeTop';
                arrowSvg = (
                  <svg
                    width="20"
                    height="8"
                    viewBox="0 0 20 8"
                    style={{
                      position: 'absolute',
                      bottom: -7,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'block',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  >
                    <path
                      d="M 1 0 C 6.85 0.64, 9 5.2, 10 8 C 11 5.2, 13.15 0.64, 19 0 Z"
                      fill={tooltipBg}
                    />
                  </svg>
                );
              } else if (placement === 'bottom') {
                containerStyle = {
                  ...containerStyle,
                  top: 'calc(100% + 15px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                };
                animName = 'aiTooltipFadeBottom';
                arrowSvg = (
                  <svg
                    width="20"
                    height="8"
                    viewBox="0 0 20 8"
                    style={{
                      position: 'absolute',
                      top: -7,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'block',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  >
                    <path
                      d="M 1 8 C 6.85 7.36, 9 2.8, 10 0 C 11 2.8, 13.15 7.36, 19 8 Z"
                      fill={tooltipBg}
                    />
                  </svg>
                );
              } else if (placement === 'left') {
                containerStyle = {
                  ...containerStyle,
                  right: 'calc(100% + 15px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                };
                animName = 'aiTooltipFadeLeft';
                arrowSvg = (
                  <svg
                    width="8"
                    height="20"
                    viewBox="0 0 8 20"
                    style={{
                      position: 'absolute',
                      right: -7,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'block',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  >
                    <path
                      d="M 0 1 C 0.64 6.85, 5.2 9, 8 10 C 5.2 11, 0.64 13.15, 0 19 Z"
                      fill={tooltipBg}
                    />
                  </svg>
                );
              } else {
                // right
                containerStyle = {
                  ...containerStyle,
                  left: 'calc(100% + 15px)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                };
                animName = 'aiTooltipFadeRight';
                arrowSvg = (
                  <svg
                    width="8"
                    height="20"
                    viewBox="0 0 8 20"
                    style={{
                      position: 'absolute',
                      left: -7,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'block',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  >
                    <path
                      d="M 8 1 C 7.36 6.85, 2.8 9, 0 10 C 2.8 11, 7.36 13.15, 8 19 Z"
                      fill={tooltipBg}
                    />
                  </svg>
                );
              }

              return (
                <div style={containerStyle}>
                  {arrowSvg}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 14px 7px 11px',
                      borderRadius: 14,
                      background: tooltipBg,
                      border: 'none',
                      boxShadow: isEffectiveDark
                        ? '0 6px 24px rgba(0, 0, 0, 0.65)'
                        : '0 6px 20px rgba(0, 0, 0, 0.1)',
                      color: isEffectiveDark ? '#f8fafc' : '#0f172a',
                      animation: `${animName} 0.22s cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                  >
                    {/* Glowing pulsating beacon dot */}
                    <div
                      style={{
                        position: 'relative',
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: accentColor,
                          opacity: 0.35,
                          animation: 'aiActivityPulse 1.4s cubic-bezier(0, 0, 0.2, 1) infinite',
                        }}
                      />
                      <div
                        style={{
                          width: 6.5,
                          height: 6.5,
                          borderRadius: '50%',
                          background: accentColor,
                          boxShadow: `0 0 8px ${accentColor}`,
                        }}
                      />
                    </div>

                    {/* Content text directly beside the dot */}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: isEffectiveDark ? '#f1f5f9' : '#1e293b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 280,
                        lineHeight: 1.3,
                      }}
                      title={activityText}
                    >
                      {activityText}
                    </span>
                  </div>
                </div>
              );
            })()}
        </div>
      </React.Fragment>
    );
    } catch (err) {
      console.error(`[OrchestrationCanvas] Erro ao renderizar nó ${node.id}:`, err);
      return null;
    }
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
          title={label}
          aria-label={label}
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

  // Batuta Search: itens da paleta de comandos da Orquestração
  const commandPaletteItems = useMemo<OrchestrationPaletteItem[]>(() => {
    const createActions: OrchestrationPaletteItem[] = [
      { id: 'create-trigger', label: 'Criar Gatilho', sublabel: 'trigger', icon: <MessageSquare size={14} />, onSelect: () => handleAddNode('trigger') },
      { id: 'create-agent', label: 'Criar Agente', sublabel: 'agent', icon: <Bot size={14} />, onSelect: () => handleAddNode('agent') },
      { id: 'create-model', label: 'Criar Modelo de IA', sublabel: 'model', icon: <Sparkles size={14} />, onSelect: () => handleAddNode('model') },
      { id: 'create-tool', label: 'Criar Ferramenta CLI', sublabel: 'tool', icon: <Terminal size={14} />, onSelect: () => handleAddNode('tool') },
      { id: 'create-ide', label: 'Criar IDE / Terminal', sublabel: 'ide', icon: <Terminal size={14} />, onSelect: () => handleAddNode('ide') },
      { id: 'create-memory', label: 'Criar Memória/Nota', sublabel: 'memory', icon: <Database size={14} />, onSelect: () => handleAddNode('memory') },
      { id: 'create-project', label: 'Criar Projeto Workspace', sublabel: 'project', icon: <FolderGit2 size={14} />, onSelect: () => handleAddNode('project') },
      { id: 'create-webview', label: 'Criar Navegador', sublabel: 'webview', icon: <Globe size={14} />, onSelect: () => handleAddNode('webview') },
    ];

    const jumpActions: OrchestrationPaletteItem[] = nodes.map((n) => ({
      id: `jump-${n.id}`,
      label: n.title,
      sublabel: `Ir para • ${n.type}`,
      icon: <ArrowRight size={14} />,
      keywords: n.subtitle,
      onSelect: () => handleFocusNode(n.id),
    }));

    const globalActions: OrchestrationPaletteItem[] = [
      { id: 'global-new-floor', label: 'Novo Andar', sublabel: 'workspace isolado por branch', icon: <Layers size={14} />, onSelect: () => setIsFloorsMenuOpen(true) },
      { id: 'global-center', label: 'Centralizar mapa', icon: <Focus size={14} />, onSelect: () => handleCenterFlow() },
      { id: 'global-logs', label: 'Ver Execuções', icon: <Activity size={14} />, onSelect: () => setActiveTab('logs') },
      { id: 'global-canvas', label: 'Voltar ao Canvas', icon: <Layers size={14} />, onSelect: () => setActiveTab('canvas') },
      { id: 'global-attention', label: 'Ir para próximo agente aguardando atenção', icon: <AlertCircle size={14} />, onSelect: () => handleFocusNextAttention() },
      { id: 'global-maestro', label: isMaestroOpen ? 'Fechar Maestro' : 'Abrir Maestro', sublabel: 'orquestrador inteligente de fluxos e agentes', icon: <AuraDevIcon size={14} />, onSelect: () => setIsMaestroOpen((prev) => !prev) },
      { id: 'global-flutter', label: 'Rodar app Flutter (preview web)', sublabel: 'flutter run -d web-server', icon: <Globe size={14} />, onSelect: () => handleRunFlutterWeb() },
      ...(isMacOS
        ? [{ id: 'global-simulator', label: 'Rodar Simulador iOS (macOS)', sublabel: 'captura ao vivo do Simulator.app', icon: <Globe size={14} />, onSelect: () => handleOpenSimulatorCapture() }]
        : []),
    ];

    return [...globalActions, ...jumpActions, ...createActions];
  }, [nodes, handleAddNode, handleFocusNode, handleCenterFlow, handleFocusNextAttention, isMaestroOpen, handleRunFlutterWeb, isMacOS, handleOpenSimulatorCapture]);

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
          <div ref={floorsMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsFloorsMenuOpen((prev) => !prev)}
              title="Andares (workspaces isolados por branch)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 6,
                border: `1px solid ${border}`,
                background: isFloorsMenuOpen ? `${accentColor}18` : bgCardSecondary,
                color: isFloorsMenuOpen ? accentColor : textPrimary,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Layers size={13} strokeWidth={1.5} />
              <span>{activeFloor ? activeFloor.name : 'Térreo'}</span>
              <ChevronDown size={11} strokeWidth={1.5} />
            </button>

            {isFloorsMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: 260,
                  background: isEffectiveDark ? '#141414' : '#ffffff',
                  border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: 12,
                  boxShadow: isEffectiveDark ? '0 16px 36px rgba(0, 0, 0, 0.75)' : '0 16px 36px rgba(0, 0, 0, 0.12)',
                  zIndex: 960,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', maxHeight: 220, overflowY: 'auto' }}>
                  <button
                    onClick={() => {
                      handleSwitchFloor(GROUND_FLOOR_ID);
                      setIsFloorsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: activeFloorId === GROUND_FLOOR_ID ? `${accentColor}18` : 'transparent',
                      color: activeFloorId === GROUND_FLOOR_ID ? accentColor : textPrimary,
                      fontSize: 12,
                      fontWeight: activeFloorId === GROUND_FLOOR_ID ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = activeFloorId === GROUND_FLOOR_ID ? `${accentColor}18` : 'transparent')}
                  >
                    <span>Térreo</span>
                  </button>

                  {floors.map((floor) => {
                    const isActive = activeFloorId === floor.id;
                    return (
                      <div
                        key={floor.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 6,
                          background: isActive ? `${accentColor}18` : 'transparent',
                        }}
                      >
                        <button
                          onClick={() => {
                            handleSwitchFloor(floor.id);
                            setIsFloorsMenuOpen(false);
                          }}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '6px 8px',
                            border: 'none',
                            background: 'transparent',
                            color: isActive ? accentColor : textPrimary,
                            fontSize: 12,
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{floor.name}</span>
                          <span style={{ fontSize: 9.5, color: textSecondary }}>{floor.branch}</span>
                        </button>
                        <button
                          onClick={() => setFloorToLand(floor)}
                          disabled={isFloorBusy}
                          title="Aterrissar (merge na branch base)"
                          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
                        >
                          <ArrowDown size={12} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setFloorToDelete(floor)}
                          disabled={isFloorBusy}
                          title="Excluir andar"
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex' }}
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }} />

                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: textSecondary }}>Novo andar</div>
                  <input
                    type="text"
                    placeholder="Nome (ex: Fix urgente)"
                    value={floorDraft.name}
                    onChange={(e) => setFloorDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                      background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                      color: textPrimary,
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Branch (ex: fix/urgente)"
                    value={floorDraft.branch}
                    onChange={(e) => setFloorDraft((prev) => ({ ...prev, branch: e.target.value }))}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                      background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                      color: textPrimary,
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: textSecondary, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={floorDraft.duplicate}
                      onChange={(e) => setFloorDraft((prev) => ({ ...prev, duplicate: e.target.checked }))}
                      style={{ margin: 0, cursor: 'pointer' }}
                    />
                    Duplicar elementos do andar atual
                  </label>
                  <button
                    onClick={handleCreateFloor}
                    disabled={isFloorBusy || !floorDraft.name.trim() || !floorDraft.branch.trim()}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: accentColor,
                      color: '#ffffff',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: isFloorBusy || !floorDraft.name.trim() || !floorDraft.branch.trim() ? 0.6 : 1,
                    }}
                  >
                    {isFloorBusy ? 'Criando…' : 'Criar andar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsMaestroOpen((prev) => !prev)}
            title="Maestro — orquestrador inteligente de fluxos e agentes (Ctrl/Cmd+Shift+M)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 6,
              border: `1px solid ${border}`,
              background: isMaestroOpen ? `${accentColor}18` : bgCardSecondary,
              color: isMaestroOpen ? accentColor : textPrimary,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <AuraDevIcon size={14} />
            <span>Maestro</span>
          </button>

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
              onClick={() => {
                if (!canvasRef.current) return;
                const rect = canvasRef.current.getBoundingClientRect();
                performZoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 100);
              }}
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
              onClick={() => {
                if (!canvasRef.current) return;
                const rect = canvasRef.current.getBoundingClientRect();
                performZoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -100);
              }}
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
            onClick={isExecutingFlow ? handleCancelWorkflow : executeWorkflow}
            style={{
              background: isExecutingFlow ? '#ef4444' : accentColor,
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: `0 2px 10px ${isExecutingFlow ? '#ef444444' : `${accentColor}44`}`,
            }}
          >
            {isExecutingFlow ? (
              <>
                <X size={13} strokeWidth={2} />
                <span>Parar Fluxo</span>
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
          cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : selectionBox ? 'crosshair' : 'default',
          userSelect: 'none',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: activeTab === 'canvas' ? 'flex' : 'none',
        }}
      >
        {/* Transparent full-screen overlay during resizing, node dragging, link drag, panning, marquee selection or tag dragging */}
        {Boolean(resizingNode || draggingNodeId || draggingLink || isPanning || selectionBox || draggingTagEdgeId) && (
          <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              cursor: resizingNode
                ? resizingNode.corner === 'se'
                  ? 'se-resize'
                  : 'nwse-resize'
                : isPanning
                ? 'grabbing'
                : selectionBox
                ? 'crosshair'
                : draggingTagEdgeId
                ? 'grabbing'
                : isSpacePressed
                ? 'grab'
                : 'grabbing',
              userSelect: 'none',
              background: 'transparent',
            }}
          />
        )}

        {/* Visual Marquee Selection Box (Laço de Seleção com clique e arraste) */}
        {selectionBox && (
          <div
            style={{
              position: 'fixed',
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY),
              border: `1.5px solid ${accentColor}`,
              backgroundColor: `${accentColor}18`,
              boxShadow: `0 0 16px ${accentColor}33`,
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 100000,
            }}
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
                  {/* Recorta a área dos cards: os pontos só ganham cor ao longo dos links */}
                  <mask id="dot-card-cutout" maskUnits="userSpaceOnUse" x={-20000} y={-20000} width={40000} height={40000}>
                    <rect x={-20000} y={-20000} width={40000} height={40000} fill="#fff" />
                    {nodes.map((node) => {
                      const { width, height } = getNodeDimensions(node);
                      return (
                        <rect
                          key={'dot-cut-' + node.id}
                          x={node.x - 14}
                          y={node.y - 14}
                          width={Math.max(0, width + 28)}
                          height={Math.max(0, height + 28)}
                          rx={18}
                          fill="#000"
                        />
                      );
                    })}
                  </mask>
                </defs>
                <g mask="url(#dot-card-cutout)">

                {/* Ambient glow from each connection illuminating nearby dots with color and opacity */}
                {edges.filter((edge) => isEdgeInUse(edge)).map((edge) => {
                  const from = getPortCoordinates(edge.fromNodeId, 'output', edge.fromPort);
                  const to = getPortCoordinates(edge.toNodeId, 'input', edge.toPort);

                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const isVertical = Math.abs(dy) > Math.abs(dx) && edge.fromPort !== 'out';

                  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

                  if (isVertical) {
                    const factor = Math.max(45, Math.abs(dy) * 0.5);
                    cp1x = from.x;
                    cp1y = from.y + factor;
                    cp2x = to.x;
                    cp2y = to.y - factor;
                  } else {
                    const factor = Math.max(45, Math.abs(dx) * 0.5);
                    cp1x = from.x + factor;
                    cp1y = from.y;
                    cp2x = to.x - factor;
                    cp2y = to.y;
                  }

                  const pathD = `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
                  const isMemoryWire =
                    edge.color === '#ffffff' ||
                    edge.color === '#64748b' ||
                    edge.fromPort === 'memory' ||
                    edge.toPort === 'memory';
                  const linkColor = isMemoryWire
                    ? (isEffectiveDark ? '#ffffff' : '#64748b')
                    : accentColor;

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

                {/* Real-time illumination when dragging a link */}
                {draggingLink && (() => {
                  const from = (draggingLink.fromX !== undefined && draggingLink.fromY !== undefined)
                    ? { x: draggingLink.fromX, y: draggingLink.fromY }
                    : getPortCoordinates(draggingLink.fromNodeId, 'output');
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
              pointerEvents: 'none',
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
              onClick: () => setIsResetConfirmOpen(true),
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

            {/* IDE Workspace */}
            {renderToolbarButton({
              id: 'ide',
              label: 'IDE Workspace',
              icon: <Code size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('ide'),
            })}

            {/* Projeto Workspace */}
            {renderToolbarButton({
              id: 'project',
              label: 'Projeto',
              icon: <FolderGit2 size={15} strokeWidth={1.5} />,
              onClick: () => handleAddNode('project'),
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
          {selectedNodeIds.length <= 1 && activeInstructionNode && activeInstructionNode.type !== 'webview' && !(activeInstructionNode.type === 'project' && Boolean(expandedProjectNodes[activeInstructionNode.id])) && (
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
                minHeight: activeInstructionNode.type === 'model' || activeInstructionNode.type === 'project' ? 180 : 110,
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
                  {activeInstructionNode.type === 'project' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {activeInstructionNode.config?.isCloned === false ? (
                        <DownloadCloud size={17} color="#38bdf8" strokeWidth={1.5} />
                      ) : (
                        <FolderGit2 size={17} color={accentColor} strokeWidth={1.5} />
                      )}
                    </div>
                  )}
                  <span style={{ color: accentColor, fontWeight: 600, fontSize: 13 }}>
                    {activeInstructionNode.title}
                  </span>
                  {activeInstructionNode.type !== 'project' && (
                    <span style={{ color: isEffectiveDark ? '#ffffff' : textPrimary, fontSize: 13, opacity: 0.9 }}>
                      {getInstructionLabel(activeInstructionNode)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                              title: meta.name,
                              provider: newProv,
                              subtitle: defModel,
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
                              subtitle: e.target.value,
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

              {/* Se for nó de projeto, exibir seletores e opções completas do Projeto */}
              {activeInstructionNode.type === 'project' && (() => {
                const pConfig = activeInstructionNode.config || {};
                const pName = pConfig.projectName || activeInstructionNode.title || 'Projeto';
                const pPath = pConfig.projectPath || '';
                const pBranch = pConfig.gitBranch || 'main';
                const isCloned = pConfig.isCloned !== false && Boolean(pPath);

                const clonedProjects = availableProjects.filter((p) => p.isCloned);
                const remoteProjects = availableProjects.filter((p) => !p.isCloned);

                const matchingProject = availableProjects.find(
                  (p) =>
                    (pPath && p.localDir && p.localDir.toLowerCase() === pPath.toLowerCase()) ||
                    (pConfig.fullName && p.fullName.toLowerCase() === pConfig.fullName.toLowerCase()) ||
                    p.name.toLowerCase() === pName.toLowerCase()
                );

                const currentSelectValue = matchingProject
                  ? (matchingProject.isCloned ? matchingProject.localDir || matchingProject.name : `remote::${matchingProject.fullName}`)
                  : (pPath || '');

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginBottom: 2 }}>
                    {/* Row 1: Seletor de projeto, branch, devUrl */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Project dropdown or custom name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.4, minWidth: 200 }}>
                        <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          Projeto:
                        </span>
                        {availableProjects.length > 0 ? (
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                            <select
                              value={currentSelectValue}
                              onChange={async (e) => {
                                const val = e.target.value;
                                const otherProjectUrls = nodes
                                  .filter((n) => n.type === 'project' && n.id !== activeInstructionNode.id)
                                  .map((n) => n.config?.devUrl)
                                  .filter(Boolean) as string[];

                                if (val.startsWith('remote::')) {
                                  const fn = val.replace('remote::', '');
                                  const selected = availableProjects.find((p) => p.fullName === fn);
                                  if (selected) {
                                    const newDevUrl = allocateUniqueDevUrl(otherProjectUrls, null);
                                    handleUpdateNode(activeInstructionNode.id, {
                                      title: selected.name,
                                      subtitle: 'Git • Não clonado',
                                      config: {
                                        ...activeInstructionNode.config,
                                        projectName: selected.name,
                                        fullName: selected.fullName,
                                        projectPath: '',
                                        gitBranch: selected.branch || 'main',
                                        devUrl: newDevUrl,
                                        isCloned: false,
                                        cloneUrl: selected.cloneUrl,
                                        htmlUrl: selected.htmlUrl,
                                      },
                                    });
                                  }
                                } else {
                                  const selected = availableProjects.find((p) => p.localDir === val || p.name === val);
                                  if (selected) {
                                    let detectedPort: number | null = null;
                                    if (selected.localDir) {
                                      try {
                                        detectedPort = await detectProjectPort(selected.localDir);
                                      } catch {}
                                    }
                                    const newDevUrl = allocateUniqueDevUrl(otherProjectUrls, detectedPort);
                                    handleUpdateNode(activeInstructionNode.id, {
                                      title: selected.name,
                                      subtitle: `${selected.branch || 'main'} • Projeto`,
                                      config: {
                                        ...activeInstructionNode.config,
                                        projectName: selected.name,
                                        fullName: selected.fullName,
                                        projectPath: selected.localDir || '',
                                        gitBranch: selected.branch || 'main',
                                        devUrl: newDevUrl,
                                        isCloned: true,
                                        cloneUrl: selected.cloneUrl,
                                        htmlUrl: selected.htmlUrl,
                                      },
                                    });
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                                border: `1px solid ${border}`,
                                borderRadius: 6,
                                color: textPrimary,
                                fontSize: 11,
                                fontWeight: 500,
                                padding: '5px 22px 5px 8px',
                                outline: 'none',
                                cursor: 'pointer',
                                appearance: 'none',
                              }}
                            >
                              <option value="">{pName} (Personalizado)</option>
                              {clonedProjects.length > 0 && (
                                <optgroup label="Projetos Locais (Clonados)">
                                  {clonedProjects.map((p) => (
                                    <option key={p.id} value={p.localDir || p.name} style={{ background: isEffectiveDark ? '#1c1c1e' : '#ffffff', color: textPrimary }}>
                                      📁 {p.name} ({p.branch || 'main'})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {remoteProjects.length > 0 && (
                                <optgroup label="Repositórios GitHub (Não Clonados)">
                                  {remoteProjects.map((p) => (
                                    <option key={p.id} value={`remote::${p.fullName}`} style={{ background: isEffectiveDark ? '#1c1c1e' : '#ffffff', color: textPrimary }}>
                                      ☁️ {p.fullName} (Clonar)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <div style={{ position: 'absolute', right: 6, pointerEvents: 'none', display: 'flex', alignItems: 'center', color: textSecondary }}>
                              <ChevronDown size={11} strokeWidth={2} />
                            </div>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={pName}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateNode(activeInstructionNode.id, {
                                title: val,
                                config: { ...activeInstructionNode.config, projectName: val },
                              });
                            }}
                            placeholder="Nome do projeto..."
                            style={{
                              flex: 1,
                              background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                              border: `1px solid ${border}`,
                              borderRadius: 6,
                              color: textPrimary,
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '5px 8px',
                              outline: 'none',
                            }}
                          />
                        )}
                        {!isCloned && (
                          <button
                            type="button"
                            onClick={() => handleCloneProjectNode(activeInstructionNode.id)}
                            disabled={isCloningProject && cloningNodeId === activeInstructionNode.id}
                            style={{
                              background: '#0284c7',
                              border: 'none',
                              borderRadius: 6,
                              color: '#ffffff',
                              padding: '4px 8px',
                              fontSize: 10.5,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: isCloningProject ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                            title="Clonar repositório Git localmente"
                          >
                            <DownloadCloud size={11} />
                            <span>{isCloningProject && cloningNodeId === activeInstructionNode.id ? 'Clonando...' : 'Clonar'}</span>
                          </button>
                        )}
                      </div>

                      {/* Branch Git */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 110 }}>
                        <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          Branch:
                        </span>
                        <input
                          type="text"
                          value={pBranch}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateNode(activeInstructionNode.id, {
                              subtitle: !isCloned ? 'Git • Não clonado' : `${val} • Projeto`,
                              config: { ...activeInstructionNode.config, gitBranch: val },
                            });
                          }}
                          placeholder="main"
                          style={{
                            flex: 1,
                            background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                            border: `1px solid ${border}`,
                            borderRadius: 6,
                            color: textPrimary,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '5px 8px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    {/* Row 2: Root Directory Path */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <span style={{ fontSize: 11, color: textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        Diretório:
                      </span>
                      <input
                        type="text"
                        value={pPath}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdateNode(activeInstructionNode.id, {
                            config: { ...activeInstructionNode.config, projectPath: val, isCloned: Boolean(val) },
                          });
                        }}
                        placeholder={!isCloned ? 'Repositório remoto no GitHub — clique em Clonar para baixar' : '/caminho/do/projeto'}
                        style={{
                          flex: 1,
                          background: isEffectiveDark ? '#19191b' : bgCardSecondary,
                          border: `1px solid ${border}`,
                          borderRadius: 6,
                          color: !isCloned ? '#0284c7' : textPrimary,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          padding: '4px 8px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.electronAPI?.dialog?.openFolder) {
                            const res = await window.electronAPI.dialog.openFolder();
                            if (res) {
                              const chosen = typeof res === 'string' ? res : (res as any)?.path || (res as any)?.folderPath;
                              if (chosen) {
                                handleUpdateNode(activeInstructionNode.id, {
                                  config: { ...activeInstructionNode.config, projectPath: chosen, isCloned: true },
                                });
                              }
                            }
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${border}`,
                          borderRadius: 6,
                          color: textSecondary,
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}
                        title="Escolher pasta no computador"
                      >
                        <FolderCode size={12} />
                        <span>Procurar...</span>
                      </button>
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

          {/* Floating Multi-Selection Action Toolbar */}
          {selectedNodeIds.length > 1 && (
            <div
              data-selection-toolbar="true"
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 80,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: isEffectiveDark ? '#141416' : '#ffffff',
                border: `1px solid ${border}`,
                borderRadius: 24,
                boxShadow: isEffectiveDark
                  ? '0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)'
                  : '0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
                backdropFilter: 'blur(16px)',
                animation: 'selectionBarFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                userSelect: 'none',
              }}
            >
              {/* Badge count */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 16,
                  background: `${accentColor}18`,
                  border: `1px solid ${accentColor}33`,
                }}
              >
                <Boxes size={13} color={accentColor} />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: accentColor,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {selectedNodeIds.length} selecionados
                </span>
              </div>

              {/* Vertical divider */}
              <div style={{ width: 1, height: 16, background: border, margin: '0 2px' }} />

              {/* Duplicate selection button */}
              <button
                type="button"
                onClick={handleDuplicateSelectedNodes}
                title="Duplicar nós selecionados (⌘D / Ctrl+D)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  color: textPrimary,
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Copy size={13} strokeWidth={1.75} />
                <span>Duplicar</span>
                <span style={{ fontSize: 10, color: textSecondary, opacity: 0.8 }}>⌘D</span>
              </button>

              {/* Toggle status (enable/disable) button */}
              <button
                type="button"
                onClick={handleToggleSelectedNodesStatus}
                title="Alternar status (Ativar / Desativar) dos nós selecionados (D)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  color: textPrimary,
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Power size={13} strokeWidth={1.75} />
                <span>Alternar Status</span>
                <span style={{ fontSize: 10, color: textSecondary, opacity: 0.8 }}>D</span>
              </button>

              {/* Delete selection button (Red danger button) */}
              <button
                type="button"
                onClick={handleDeleteSelectedNodes}
                title="Excluir todos os nós selecionados (Delete / Backspace)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                }}
              >
                <Trash2 size={13} strokeWidth={1.75} />
                <span>Excluir Seleção</span>
                <span style={{ fontSize: 10, color: '#ef4444', opacity: 0.8 }}>Del</span>
              </button>

              {/* Vertical divider */}
              <div style={{ width: 1, height: 16, background: border, margin: '0 2px' }} />

              {/* Deselect / Close button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedNodeIds([]);
                  setSelectedNodeId(null);
                }}
                title="Desmarcar seleção (Esc)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  border: 'none',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  color: textSecondary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.color = textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = textSecondary;
                }}
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          )}

        </div>

        {/* Logs Tab (Separada com border radius e background padronizado, mantendo canvas montado) */}
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
            display: activeTab === 'logs' ? 'flex' : 'none',
            flexDirection: 'column',
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
                  onClick={() => setIsClearLogsConfirmOpen(true)}
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

      {/* ========================================================================= */}
      {/* NODE OPTIONS POPUP MENU (ON CARD CLICK)                                   */}
      {/* ========================================================================= */}
      {nodeOptionsPopup && activePopupNode && (() => {
        const isRolesView = nodeOptionsPopup.view === 'roles' || nodeOptionsPopup.view === 'roles_create';
        const isRelayView = nodeOptionsPopup.view === 'relay';
        const popupWidth = isRolesView || isRelayView ? 260 : 224;
        const clampedX = Math.max(12, Math.min(window.innerWidth - popupWidth - 12, nodeOptionsPopup.x));
        const clampedY = Math.max(12, Math.min(window.innerHeight - 380, nodeOptionsPopup.y));

        return (
          <div
            data-node-popup="true"
            ref={nodeOptionsPopupRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: clampedX,
              top: clampedY,
              width: popupWidth,
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
              background: isEffectiveDark ? '#141414' : '#ffffff',
              border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.12)',
              borderRadius: 12,
              boxShadow: isEffectiveDark
                ? '0 16px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 16px 36px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
              zIndex: 950,
              overflow: 'hidden',
              animation: 'popupScale 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 0.15s ease, border-color 0.15s ease',
            }}
          >
            {isRolesView ? (
              <>
                {/* Header do seletor/criador de papéis */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <button
                      onClick={() =>
                        setNodeOptionsPopup((prev) =>
                          prev ? { ...prev, view: nodeOptionsPopup.view === 'roles_create' ? 'roles' : 'menu' } : null
                        )
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: textSecondary,
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Voltar"
                    >
                      <ChevronLeft size={14} color={textPrimary} strokeWidth={1.5} />
                    </button>
                    <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                      {nodeOptionsPopup.view === 'roles_create' ? 'Novo papel' : 'Papel do agente'}
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
                    }}
                    title="Fechar"
                  >
                    <X size={13} color={textPrimary} strokeWidth={1.5} />
                  </button>
                </div>

                {nodeOptionsPopup.view === 'roles_create' ? (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nome do papel (ex: Revisor)"
                      value={newRoleDraft.name}
                      onChange={(e) => setNewRoleDraft((prev) => ({ ...prev, name: e.target.value }))}
                      style={{
                        padding: '7px 8px',
                        borderRadius: 6,
                        border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                        background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                        color: textPrimary,
                        fontSize: 11.5,
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10.5, color: textSecondary }}>Cor</span>
                      <input
                        type="color"
                        value={newRoleDraft.color}
                        onChange={(e) => setNewRoleDraft((prev) => ({ ...prev, color: e.target.value }))}
                        style={{ width: 28, height: 22, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                      />
                    </div>
                    <textarea
                      placeholder="Instruções (ex: você é o Revisor de código, foque em bugs e legibilidade)"
                      value={newRoleDraft.instructions}
                      onChange={(e) => setNewRoleDraft((prev) => ({ ...prev, instructions: e.target.value }))}
                      rows={4}
                      style={{
                        padding: '7px 8px',
                        borderRadius: 6,
                        border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                        background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                        color: textPrimary,
                        fontSize: 11,
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                    <button
                      onClick={handleCreateRole}
                      disabled={!newRoleDraft.name.trim()}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: newRoleDraft.name.trim() ? accentColor : (isEffectiveDark ? '#262626' : '#e2e8f0'),
                        color: newRoleDraft.name.trim() ? '#ffffff' : textSecondary,
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: newRoleDraft.name.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Criar e atribuir
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }}>
                    <button
                      onClick={() => {
                        assignRoleToNode(activePopupNode.id, undefined);
                        setNodeOptionsPopup(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: !activePopupNode.roleId ? `${accentColor}18` : 'transparent',
                        color: !activePopupNode.roleId ? accentColor : textPrimary,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = !activePopupNode.roleId ? `${accentColor}18` : 'transparent')}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${textSecondary}` }} />
                      <span>Nenhum</span>
                    </button>
                    {roles.map((role) => {
                      const isRoleSelected = activePopupNode.roleId === role.id;
                      return (
                        <button
                          key={role.id}
                          onClick={() => {
                            assignRoleToNode(activePopupNode.id, role.id);
                            setNodeOptionsPopup(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: isRoleSelected ? `${accentColor}18` : 'transparent',
                            color: isRoleSelected ? accentColor : textPrimary,
                            fontSize: 12,
                            fontWeight: isRoleSelected ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isRoleSelected ? `${accentColor}18` : 'transparent')}
                        >
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: role.color }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.name}</span>
                        </button>
                      );
                    })}
                    <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '4px 4px' }} />
                    <button
                      onClick={() => setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'roles_create' } : null))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: textSecondary,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Plus size={13} strokeWidth={1.5} />
                      <span>Novo papel</span>
                    </button>
                  </div>
                )}
              </>
            ) : isRelayView ? (
              <>
                {/* Header do envio para agente conectado */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <button
                      onClick={() => setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'menu' } : null))}
                      style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                      title="Voltar"
                    >
                      <ChevronLeft size={14} color={textPrimary} strokeWidth={1.5} />
                    </button>
                    <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Enviar para agente conectado</div>
                  </div>
                  <button
                    onClick={() => setNodeOptionsPopup(null)}
                    style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Fechar"
                  >
                    <X size={13} color={textPrimary} strokeWidth={1.5} />
                  </button>
                </div>

                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    placeholder="Mensagem para o(s) agente(s) conectado(s)"
                    value={relayDraft}
                    onChange={(e) => setRelayDraft(e.target.value)}
                    rows={3}
                    style={{
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
                      background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
                      color: textPrimary,
                      fontSize: 11,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                  {getConnectedAgentTargets(activePopupNode.id).length === 0 ? (
                    <div style={{ fontSize: 11, color: textSecondary }}>
                      Nenhuma conexão de saída para outro agente. Ligue um cabo deste node a outro agente/tool primeiro.
                    </div>
                  ) : (
                    getConnectedAgentTargets(activePopupNode.id).map(({ edge, target }) => (
                      <div
                        key={edge.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <button
                          onClick={() => sendRelayMessage(target.id, relayDraft, activePopupNode.id)}
                          disabled={!relayDraft.trim()}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'transparent',
                            border: 'none',
                            color: textPrimary,
                            fontSize: 11.5,
                            cursor: !relayDraft.trim() ? 'not-allowed' : 'pointer',
                            opacity: !relayDraft.trim() ? 0.5 : 1,
                            textAlign: 'left',
                            overflow: 'hidden',
                          }}
                        >
                          <ArrowRight size={12} color={accentColor} strokeWidth={1.5} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.title}</span>
                        </button>
                        <label
                          title="Retransmitir automaticamente o resumo quando este agente terminar"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: textSecondary, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <input
                            type="checkbox"
                            checked={!!edge.autoRelay}
                            onChange={() => toggleEdgeAutoRelay(edge.id)}
                            style={{ margin: 0, cursor: 'pointer' }}
                          />
                          Auto
                        </label>
                      </div>
                    ))
                  )}
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
                        : activePopupNode.type === 'project'
                        ? <FolderGit2 size={16} color={accentColor} strokeWidth={1.5} />
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
                        {activePopupNode.type === 'model'
                          ? (activePopupNode.title?.replace(/^Modelo\s+/i, '') || AI_PROVIDER_INFOS[(activePopupNode.provider as AiProviderId) || 'claude']?.name || 'IA')
                          : activePopupNode.title}
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
                        {activePopupNode.type === 'model'
                          ? (activePopupNode.config?.model || (activePopupNode.subtitle?.includes('•') ? activePopupNode.subtitle.split('•')[1]?.trim() : activePopupNode.subtitle) || 'Modelo de IA')
                          : (activePopupNode.subtitle ||
                            (activePopupNode.type === 'trigger'
                              ? 'Gatilho'
                              : activePopupNode.type === 'agent'
                              ? 'Agente de IA'
                              : activePopupNode.type === 'model'
                              ? 'Modelo de IA'
                              : activePopupNode.type === 'tool'
                              ? 'Ferramenta CLI'
                              : activePopupNode.type === 'ide'
                              ? 'Ambiente IDE'
                              : activePopupNode.type === 'webview'
                              ? 'Navegador Web'
                              : activePopupNode.type === 'memory'
                              ? 'Memória'
                              : activePopupNode.type === 'project'
                              ? 'Projeto & Código'
                              : String(activePopupNode.type).toUpperCase()))}
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

                  {/* Expandir / Recolher Projeto ou Clonar (Para Cards de Projeto) */}
                  {activePopupNode.type === 'project' && (
                    <>
                      {activePopupNode.config?.isCloned === false ? (
                        <button
                          onClick={() => {
                            const targetId = activePopupNode.id;
                            setNodeOptionsPopup(null);
                            handleCloneProjectNode(targetId);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: '#38bdf8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DownloadCloud size={14} color="#38bdf8" strokeWidth={1.5} />
                            <span>Clonar Repositório Git</span>
                          </div>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: 'rgba(56, 189, 248, 0.18)',
                              color: '#38bdf8',
                            }}
                          >
                            Git
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const targetId = activePopupNode.id;
                            setNodeOptionsPopup(null);
                            toggleProjectNode(targetId);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: expandedProjectNodes[activePopupNode.id] ? `${accentColor}18` : 'transparent',
                            color: expandedProjectNodes[activePopupNode.id] ? accentColor : textPrimary,
                            fontSize: 12,
                            fontWeight: expandedProjectNodes[activePopupNode.id] ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = expandedProjectNodes[activePopupNode.id] ? `${accentColor}18` : 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Code2 size={14} color={expandedProjectNodes[activePopupNode.id] ? accentColor : textPrimary} strokeWidth={1.5} />
                            <span>{expandedProjectNodes[activePopupNode.id] ? 'Recolher Projeto' : 'Expandir Projeto (Arquivos & Código)'}</span>
                          </div>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: expandedProjectNodes[activePopupNode.id] ? `${accentColor}25` : (isEffectiveDark ? '#262626' : '#e2e8f0'),
                              color: expandedProjectNodes[activePopupNode.id] ? accentColor : textSecondary,
                            }}
                          >
                            IDE
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const targetId = activePopupNode.id;
                          setNodeOptionsPopup(null);
                          handleOpenUrlFromNode(
                            targetId,
                            activePopupNode.config?.devUrl || 'http://localhost:5173'
                          );
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
                          <Globe size={14} color="#38bdf8" strokeWidth={1.5} />
                          <span>Abrir no Navegador</span>
                        </div>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: 4,
                            background: 'rgba(56, 189, 248, 0.18)',
                            color: '#38bdf8',
                          }}
                        >
                          Dev
                        </span>
                      </button>

                      {/* Linha Divisória */}
                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Papel do agente */}
                  {(activePopupNode.type === 'model' || activePopupNode.type === 'agent' || activePopupNode.type === 'tool') && (
                    <>
                      <button
                        onClick={() => setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'roles' } : null))}
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
                          <Tag size={14} color={textPrimary} strokeWidth={1.5} />
                          <span>Papel</span>
                        </div>
                        {(() => {
                          const currentRole = roles.find((r) => r.id === activePopupNode.roleId);
                          return currentRole ? (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                padding: '2px 5px',
                                borderRadius: 4,
                                background: `${currentRole.color}25`,
                                color: currentRole.color,
                                maxWidth: 90,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {currentRole.name}
                            </span>
                          ) : (
                            <ChevronRight size={13} color={textSecondary} strokeWidth={1.5} />
                          );
                        })()}
                      </button>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Enviar para agente conectado (conexões funcionais) */}
                  {getConnectedAgentTargets(activePopupNode.id).length > 0 && (
                    <>
                      <button
                        onClick={() => setNodeOptionsPopup((prev) => (prev ? { ...prev, view: 'relay' } : null))}
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
                          <ArrowRight size={14} color={textPrimary} strokeWidth={1.5} />
                          <span>Enviar para agente conectado</span>
                        </div>
                        <ChevronRight size={13} color={textSecondary} strokeWidth={1.5} />
                      </button>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Modo Maestro (recrutar/dispensar agentes via prompt) */}
                  {(activePopupNode.type === 'tool' || activePopupNode.type === 'agent') && (
                    <>
                      <button
                        onClick={() => {
                          toggleNodeMaestro(activePopupNode.id);
                          setNodeOptionsPopup(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: activePopupNode.isMaestro ? `${accentColor}18` : 'transparent',
                          color: activePopupNode.isMaestro ? accentColor : textPrimary,
                          fontSize: 12,
                          fontWeight: activePopupNode.isMaestro ? 600 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = activePopupNode.isMaestro ? `${accentColor}18` : 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Sparkles size={14} color={activePopupNode.isMaestro ? accentColor : textPrimary} strokeWidth={1.5} />
                          <span>{activePopupNode.isMaestro ? 'Remover Modo Maestro' : 'Tornar Modo Maestro'}</span>
                        </div>
                      </button>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />
                    </>
                  )}

                  {/* Configurar */}
                  {activePopupNode.type !== 'webview' && (
                    <button
                      onClick={() => {
                        const targetId = activePopupNode.id;
                        setNodeOptionsPopup(null);
                        setSelectedNodeId(targetId);
                        setConfiguringNodeId(targetId);
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
                  )}

                  {/* Linha Divisória */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 4px' }} />

                  {/* Executar ou Parar Fluxo */}
                  <button
                    onClick={() => {
                      setNodeOptionsPopup(null);
                      if (activePopupNode.type === 'trigger') {
                        executeWorkflow(activePopupNode.id);
                      } else if (isExecutingFlow) {
                        handleCancelWorkflow();
                      } else {
                        executeWorkflow();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: isExecutingFlow ? '#ef4444' : textPrimary,
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
                      {isExecutingFlow ? (
                        <>
                          <X size={14} color="#ef4444" strokeWidth={2} />
                          <span>Parar Fluxo</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} color={textPrimary} strokeWidth={1.5} />
                          <span>Executar Fluxo</span>
                        </>
                      )}
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

                  {/* Excluir Nó (abre modal de confirmação padronizado conforme AGENTS.md) */}
                  <button
                    onClick={() => {
                      setNodeOptionsPopup(null);
                      setNodeToDelete(activePopupNode);
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

      {/* Batuta Search: command palette da Orquestração (Ctrl/Cmd+K) */}
      <OrchestrationCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commandPaletteItems}
        accentColor={accentColor}
        isEffectiveDark={isEffectiveDark}
        bgCard={bgCard}
        border={border}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        hoverBg={hoverBg}
      />

      {/* Maestro: orquestrador inteligente de fluxos e agentes (Ctrl/Cmd+Shift+M) */}
      <OrchestrationMaestroPanel
        isOpen={isMaestroOpen}
        onClose={() => setIsMaestroOpen(false)}
        nodes={nodes}
        edges={edges}
        onAddNode={handleAddNode}
        onConnectNodes={handleConnectNodes}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={(node) => setNodeToDelete(node)}
        onRunWorkflow={executeWorkflow}
        onOpenUrl={handleMaestroOpenUrl}
        onOpenProject={handleMaestroOpenProject}
        onCancelWorkflow={handleCancelWorkflow}
        isExecutingFlow={isExecutingFlow}
        onFocusNode={handleFocusNode}
        availableProjects={availableProjects}
        workspacePath={effectiveWorkspacePath}
        currentUser={currentUser}
        selectedAiProvider={selectedAiProvider}
        selectedModel={selectedModel}
        installedClis={installedClis}
        activeModels={activeModels}
        onSelectAiProvider={onSelectAiProvider}
        onSelectModel={onSelectModel}
        accentColor={accentColor}
        isEffectiveDark={isEffectiveDark}
        themeTokens={themeTokens}
        onToast={onToast}
      />

      {/* Simulador iOS (macOS, best-effort): captura ao vivo via desktopCapturer */}
      <OrchestrationSimulatorPanel
        isOpen={isSimulatorPanelOpen}
        onClose={() => setIsSimulatorPanelOpen(false)}
        sources={simulatorSources}
        onRefresh={handleOpenSimulatorCapture}
        accentColor={accentColor}
        isEffectiveDark={isEffectiveDark}
        bgCard={bgCard}
        border={border}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />

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
                              title: meta.name,
                              provider: newProv,
                              subtitle: defaultModel.label,
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
                              subtitle: chosen.label,
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
        message="Tem certeza que deseja remover este nó do fluxo de orquestração? Esta ação removerá o nó e suas conexões e não pode ser desfeita."
        itemDescription={nodeToDelete ? `${nodeToDelete.title} (${nodeToDelete.type})` : undefined}
        confirmLabel="Excluir Nó"
        cancelLabel="Cancelar"
        isDeleting={isDeleting}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={confirmDeleteNode}
        onClose={() => setNodeToDelete(null)}
      />

      {/* Confirmation Modal for Multi-Node Selection Deletion conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={Boolean(nodesToDelete && nodesToDelete.length > 0)}
        title={
          nodesToDelete && nodesToDelete.length === 1
            ? 'Excluir Nó Selecionado'
            : `Excluir ${nodesToDelete?.length || 0} Nós Selecionados`
        }
        message="Tem certeza que deseja excluir todos os nós selecionados do fluxo de orquestração? Esta ação removerá os nós e todas as suas conexões e não pode ser desfeita."
        itemDescription={
          nodesToDelete
            ? nodesToDelete.length <= 4
              ? nodesToDelete.map((n) => n.title || n.id).join(', ')
              : `${nodesToDelete.slice(0, 3).map((n) => n.title || n.id).join(', ')} e mais ${nodesToDelete.length - 3} nós`
            : undefined
        }
        confirmLabel={
          nodesToDelete && nodesToDelete.length === 1
            ? 'Excluir Nó'
            : `Excluir ${nodesToDelete?.length || 0} Nós`
        }
        cancelLabel="Cancelar"
        iconType="trash"
        isDeleting={isDeleting}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={confirmDeleteSelectedNodes}
        onClose={() => setNodesToDelete(null)}
      />

      {/* Confirmation Modal for Floor Deletion conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={!!floorToDelete}
        title="Excluir Andar (Worktree)"
        message="Tem certeza que deseja excluir este andar? O worktree associado será removido do sistema de arquivos e suas alterações não salvas serão perdidas. Esta ação não pode ser desfeita."
        itemDescription={floorToDelete ? `${floorToDelete.name} (${floorToDelete.branch})` : undefined}
        confirmLabel="Excluir Andar"
        cancelLabel="Cancelar"
        iconType="trash"
        isDeleting={isFloorBusy}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={async () => {
          if (!floorToDelete) return;
          const floor = floorToDelete;
          setFloorToDelete(null);
          await handleDeleteFloor(floor);
        }}
        onClose={() => setFloorToDelete(null)}
      />

      {/* Confirmation Modal for Floor Landing conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={!!floorToLand}
        title="Aterrissar Andar"
        message="Tem certeza que deseja aterrissar as alterações deste andar na branch principal? O worktree será mesclado na branch base."
        itemDescription={floorToLand ? `${floorToLand.name} (${floorToLand.branch})` : undefined}
        confirmLabel="Aterrissar Andar"
        cancelLabel="Cancelar"
        iconType="warning"
        isDeleting={isFloorBusy}
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={async () => {
          if (!floorToLand) return;
          const floor = floorToLand;
          setFloorToLand(null);
          await handleLandFloor(floor);
        }}
        onClose={() => setFloorToLand(null)}
      />

      {/* Confirmation Modal for Workflow Reset conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={isResetConfirmOpen}
        title="Restaurar Fluxo Padrão"
        message="Tem certeza que deseja restaurar o fluxo padrão? Todos os nós, conexões e configurações atuais deste andar serão substituídos pelo modelo inicial. Esta ação não pode ser desfeita."
        confirmLabel="Restaurar Padrão"
        cancelLabel="Cancelar"
        iconType="warning"
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={() => {
          setIsResetConfirmOpen(false);
          handleResetToDefault();
        }}
        onClose={() => setIsResetConfirmOpen(false)}
      />

      {/* Confirmation Modal for Clearing Logs conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={isClearLogsConfirmOpen}
        title="Limpar Histórico de Logs"
        message="Tem certeza que deseja limpar todo o histórico de logs de execução deste andar? Esta ação não pode ser desfeita."
        confirmLabel="Limpar Logs"
        cancelLabel="Cancelar"
        iconType="trash"
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={() => {
          setExecutionLogs([]);
          setIsClearLogsConfirmOpen(false);
          onToast?.('Logs de execução limpos.');
        }}
        onClose={() => setIsClearLogsConfirmOpen(false)}
      />

      {/* Confirmation Modal for Workspace Consent conforming to AGENTS.md rule */}
      <ConfirmDeleteModal
        isOpen={isConsentModalOpen}
        title="Autorizar Execução no Workspace"
        message="A execução do fluxo de orquestração executa chamadas de CLI e agentes que podem criar ou modificar arquivos no seu diretório de trabalho. Deseja conceder autorização para este workspace?"
        itemDescription={effectiveWorkspacePath || 'Workspace atual'}
        confirmLabel="Autorizar e Executar"
        cancelLabel="Cancelar"
        iconType="warning"
        accentColor={accentColor}
        themeTokens={themeTokens}
        onConfirm={() => {
          const consentKey = `devflow_orch_consent_${effectiveWorkspacePath || 'default'}`;
          localStorage.setItem(consentKey, 'true');
          setIsConsentModalOpen(false);
          executeWorkflow();
        }}
        onClose={() => setIsConsentModalOpen(false)}
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
        @keyframes selectionBarFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        @keyframes aiActivityPulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0.15; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
        @keyframes aiTooltipFadeTop {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes aiTooltipFadeBottom {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes aiTooltipFadeLeft {
          from { opacity: 0; transform: translateY(-50%) translateX(4px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        @keyframes aiTooltipFadeRight {
          from { opacity: 0; transform: translateY(-50%) translateX(-4px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
    </div>
  );
};
