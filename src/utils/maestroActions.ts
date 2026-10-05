import type { NodeType } from '../components/OrchestrationCanvas';

export interface MaestroAddNodeAction {
  action: 'add_node';
  type: NodeType;
  title?: string;
  provider?: string;
  config?: Record<string, any>;
  position?: { x?: number; y?: number };
}

export interface MaestroConnectNodesAction {
  action: 'connect_nodes';
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
}

export interface MaestroUpdateNodeAction {
  action: 'update_node';
  nodeId: string;
  title?: string;
  subtitle?: string;
  config?: Record<string, any>;
}

export interface MaestroDeleteNodeAction {
  action: 'delete_node';
  nodeId: string;
}

export interface MaestroRunWorkflowAction {
  action: 'run_workflow';
}

export interface MaestroOpenUrlAction {
  action: 'open_url';
  url: string;
  nodeId?: string;
}

export interface MaestroOpenProjectAction {
  action: 'open_project';
  projectName: string;
  nodeId?: string;
}

export type MaestroAction =
  | MaestroAddNodeAction
  | MaestroConnectNodesAction
  | MaestroUpdateNodeAction
  | MaestroDeleteNodeAction
  | MaestroRunWorkflowAction
  | MaestroOpenUrlAction
  | MaestroOpenProjectAction;

export interface ParseMaestroResult {
  cleanText: string;
  actions: MaestroAction[];
}

/**
 * Extrai blocos ```json:actions ... ``` ou ```json ... ``` com ações do Maestro.
 * Retorna o texto limpo (sem o bloco JSON de ações) e o array de ações válidas.
 */
export function parseMaestroActions(responseText: string): ParseMaestroResult {
  if (!responseText) {
    return { cleanText: '', actions: [] };
  }

  // 1. Procurar por bloco específico ```json:actions ... ``` ou ```actions ... ```
  const actionBlockRegex = /```(?:json:actions|actions)\s*([\s\S]*?)```/i;
  let match = responseText.match(actionBlockRegex);

  let actions: MaestroAction[] = [];
  let cleanText = responseText;

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        actions = parsed.filter((a) => a && typeof a === 'object' && typeof a.action === 'string');
      }
      cleanText = responseText.replace(match[0], '').trim();
    } catch {
      // JSON com erro de sintaxe, tenta recuperar se possível
    }
  }

  // 2. Se não encontrou bloco explícito :actions, verifica se há um bloco json com array de actions
  if (actions.length === 0) {
    const genericJsonRegex = /```(?:json)?\s*(\[\s*\{[\s\S]*?"action"[\s\S]*?\}\s*\])\s*```/i;
    const genericMatch = responseText.match(genericJsonRegex);
    if (genericMatch && genericMatch[1]) {
      try {
        const parsed = JSON.parse(genericMatch[1].trim());
        if (Array.isArray(parsed)) {
          actions = parsed.filter((a) => a && typeof a === 'object' && typeof a.action === 'string');
          if (actions.length > 0) {
            cleanText = responseText.replace(genericMatch[0], '').trim();
          }
        }
      } catch {}
    }
  }

  return { cleanText, actions };
}

/**
 * Resolve referências temporárias como "$node-0", "$node-1" para os IDs reais gerados.
 */
export function resolveNodeId(ref: string, createdNodeIds: string[]): string {
  if (!ref) return '';
  const match = ref.match(/^\$node-(\d+)$/);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (idx >= 0 && idx < createdNodeIds.length) {
      return createdNodeIds[idx];
    }
  }
  return ref;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface ExistingNodeInfo {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  type?: string;
}

/**
 * Calcula posições organizadas e sem sobreposição para os nós criados em lote pelo Maestro.
 * Organiza em pipeline horizontal (Trigger -> Agente -> Tool -> Webview) com Modelos posicionados
 * diretamente abaixo dos seus respectivos agentes conectados.
 */
export function calculateMaestroBatchLayout(
  actions: MaestroAction[],
  existingNodes: ExistingNodeInfo[] = [],
  canvasViewport?: { pan: { x: number; y: number }; zoom: number }
): Map<number, NodePosition> {
  const positions = new Map<number, NodePosition>();

  // 1. Coletar todas as ações add_node
  const addNodeIndices: number[] = [];
  actions.forEach((a, idx) => {
    if (a.action === 'add_node') {
      addNodeIndices.push(idx);
    }
  });

  if (addNodeIndices.length === 0) return positions;

  // 2. Determinar ponto inicial no canvas (evitando colisão com nós existentes)
  let startX = 120;
  let startY = 140;

  if (existingNodes && existingNodes.length > 0) {
    let maxX = 0;
    let minY = Infinity;
    for (const n of existingNodes) {
      const right = (n.x || 0) + (n.width || 230);
      if (right > maxX) maxX = right;
      if (n.y !== undefined && n.y < minY) minY = n.y;
    }
    startX = maxX + 100;
    startY = minY < Infinity ? Math.max(100, minY) : 140;
  } else if (canvasViewport) {
    const { pan, zoom } = canvasViewport;
    startX = Math.max(80, Math.round((140 - pan.x) / zoom));
    startY = Math.max(80, Math.round((140 - pan.y) / zoom));
  }

  // 3. Mapear conexões entre nós adicionados no lote (ex: $node-0 -> $node-1)
  const connections: Array<{ fromIdx: number; toIdx: number }> = [];
  for (const a of actions) {
    if (a.action === 'connect_nodes') {
      const fromMatch = a.from?.match(/^\$node-(\d+)$/);
      const toMatch = a.to?.match(/^\$node-(\d+)$/);
      if (fromMatch && toMatch) {
        connections.push({
          fromIdx: parseInt(fromMatch[1], 10),
          toIdx: parseInt(toMatch[1], 10),
        });
      }
    }
  }

  // 4. Calcular coordenadas para cada nó adicionado
  let pipelineColumn = 0;

  for (let i = 0; i < addNodeIndices.length; i++) {
    const action = actions[addNodeIndices[i]] as MaestroAddNodeAction;

    // Se já tiver posição explícita com x e y válidos, respeita
    if (action.position && typeof action.position.x === 'number' && typeof action.position.y === 'number') {
      positions.set(i, { x: action.position.x, y: action.position.y });
      continue;
    }

    // Caso especial: nó do tipo 'model' conectado a um 'agent'
    // Deve ficar diretamente abaixo do agente correspondente (no porto chat_model)
    if (action.type === 'model') {
      const incomingConn = connections.find((c) => c.toIdx === i);
      if (incomingConn !== undefined && positions.has(incomingConn.fromIdx)) {
        const agentPos = positions.get(incomingConn.fromIdx)!;
        positions.set(i, {
          x: agentPos.x,
          y: agentPos.y + 240, // Espaçamento vertical perfeito abaixo do card do agente
        });
        continue;
      }
    }

    // Nós sequenciais do pipeline principal (trigger, agent, tool, webview, ide, project)
    const posX = startX + pipelineColumn * 300;
    const posY = startY;
    positions.set(i, { x: posX, y: posY });
    pipelineColumn++;
  }

  return positions;
}

/**
 * Se o prompt do usuário expressar a intenção de criar um fluxo ou nós conectados,
 * e a IA não tiver gerado ações connect_nodes, infere automaticamente as conexões
 * lógicas entre os nós recém-criados.
 */
export function inferMissingConnections(
  actions: MaestroAction[],
  userPromptText: string = ''
): MaestroAction[] {
  const hasExplicitConnections = actions.some((a) => a.action === 'connect_nodes');
  if (hasExplicitConnections) {
    return actions;
  }

  const addNodeActions = actions.filter((a) => a.action === 'add_node') as MaestroAddNodeAction[];
  if (addNodeActions.length < 2) {
    return actions;
  }

  // Verifica se o prompt sugere fluxo/pipeline/conexão
  const normalized = userPromptText.toLowerCase();
  const suggestsPipeline =
    !userPromptText ||
    /pipeline|fluxo|workflow|conectad|ligad|ligar|conectar|chain|encadead/i.test(normalized);

  if (!suggestsPipeline) {
    return actions;
  }

  const newConnections: MaestroConnectNodesAction[] = [];

  // Mapear nós por tipo e seu índice no batch
  const nodeEntries = addNodeActions.map((action, idx) => ({ idx, type: action.type }));

  // Regra 1: Trigger -> Agente
  const triggers = nodeEntries.filter((n) => n.type === 'trigger');
  const agents = nodeEntries.filter((n) => n.type === 'agent');
  const models = nodeEntries.filter((n) => n.type === 'model');
  const tools = nodeEntries.filter((n) => n.type === 'tool' || n.type === 'ide');
  const webviews = nodeEntries.filter((n) => n.type === 'webview');

  if (triggers.length > 0 && agents.length > 0) {
    // Conectar primeiro trigger ao primeiro agente
    newConnections.push({
      action: 'connect_nodes',
      from: `$node-${triggers[0].idx}`,
      to: `$node-${agents[0].idx}`,
      fromPort: 'out',
      toPort: 'in',
    });
  } else if (triggers.length > 0 && models.length > 0 && agents.length === 0) {
    // Trigger -> Model direto se não houver agente
    newConnections.push({
      action: 'connect_nodes',
      from: `$node-${triggers[0].idx}`,
      to: `$node-${models[0].idx}`,
      fromPort: 'out',
      toPort: 'in',
    });
  }

  // Regra 2: Agente -> Modelo (porta chat_model)
  if (agents.length > 0 && models.length > 0) {
    newConnections.push({
      action: 'connect_nodes',
      from: `$node-${agents[0].idx}`,
      to: `$node-${models[0].idx}`,
      fromPort: 'chat_model',
      toPort: 'in',
    });
  }

  // Regra 3: Agente -> Tool (porta tool)
  if (agents.length > 0 && tools.length > 0) {
    newConnections.push({
      action: 'connect_nodes',
      from: `$node-${agents[0].idx}`,
      to: `$node-${tools[0].idx}`,
      fromPort: 'tool',
      toPort: 'in',
    });
  }

  // Regra 4: Tool ou Agente -> Webview
  if (webviews.length > 0) {
    const source = tools.length > 0 ? tools[0] : agents.length > 0 ? agents[0] : null;
    if (source) {
      newConnections.push({
        action: 'connect_nodes',
        from: `$node-${source.idx}`,
        to: `$node-${webviews[0].idx}`,
        fromPort: 'out',
        toPort: 'in',
      });
    }
  }

  // Se nenhuma regra estrutural casou mas temos nós sequenciais, conecta linearmente
  if (newConnections.length === 0 && nodeEntries.length >= 2) {
    for (let i = 0; i < nodeEntries.length - 1; i++) {
      const from = nodeEntries[i];
      const to = nodeEntries[i + 1];
      const fromPort = from.type === 'agent' && to.type === 'model' ? 'chat_model' : 'out';
      newConnections.push({
        action: 'connect_nodes',
        from: `$node-${from.idx}`,
        to: `$node-${to.idx}`,
        fromPort,
        toPort: 'in',
      });
    }
  }

  return [...actions, ...newConnections];
}

