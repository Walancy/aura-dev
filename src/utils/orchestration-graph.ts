export interface GraphNode {
  id: string;
  type: string;
  provider?: string;
  title: string;
  subtitle?: string;
  status: 'idle' | 'ready' | 'running' | 'success' | 'failed' | 'disabled' | 'cancelled';
  roleId?: string;
  config: Record<string, any>;
  ports?: { input?: string[]; output?: string[] };
  output?: {
    text: string;
    durationMs?: number;
    tokens?: number;
    timestamp?: string;
    error?: string;
  };
}

export interface GraphEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  isActive?: boolean;
  label?: string;
  autoRelay?: boolean;
}

export interface TopologicalSortResult {
  levels: GraphNode[][];
  hasCycle: boolean;
  orderedNodes: GraphNode[];
}

/**
 * Topologically sorts reachable workflow nodes starting from trigger nodes
 * (or all enabled source nodes if no trigger is present).
 * Returns nodes grouped by execution level (independent nodes at same level can run in parallel)
 * and detects cycles using Kahn's algorithm.
 */
export function topologicalSortWorkflow(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startNodeId?: string
): TopologicalSortResult {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (n.status !== 'disabled') {
      nodeMap.set(n.id, n);
    }
  }

  // Normalize edges between Agent and Model so Agent (Coordinator) always precedes Model (Worker)
  const normalizedEdges = edges.map((e) => {
    const fromNode = nodeMap.get(e.fromNodeId);
    const toNode = nodeMap.get(e.toNodeId);
    if (fromNode?.type === 'model' && toNode?.type === 'agent') {
      return { ...e, fromNodeId: toNode.id, toNodeId: fromNode.id };
    }
    return e;
  });

  // Filter valid edges connecting enabled nodes
  const validEdges = normalizedEdges.filter(
    (e) => nodeMap.has(e.fromNodeId) && nodeMap.has(e.toNodeId) && e.fromNodeId !== e.toNodeId
  );

  // Determine starting nodes
  let rootIds: string[] = [];
  if (startNodeId && nodeMap.has(startNodeId)) {
    rootIds = [startNodeId];
  } else {
    // Triggers and connected root nodes without incoming edges (e.g. project nodes connected to agents or browsers)
    const hasIncoming = new Set(validEdges.map((e) => e.toNodeId));
    const nonIncomingRoots = nodes.filter((n) => n.status !== 'disabled' && !hasIncoming.has(n.id));
    const triggers = nodes.filter((n) => n.type === 'trigger' && n.status !== 'disabled');

    if (triggers.length > 0) {
      const connectedRoots = nonIncomingRoots.filter((r) => validEdges.some((e) => e.fromNodeId === r.id));
      rootIds = Array.from(new Set([...triggers.map((t) => t.id), ...connectedRoots.map((r) => r.id)]));
      if (rootIds.length === 0) {
        rootIds = triggers.map((t) => t.id);
      }
    } else if (nonIncomingRoots.length > 0) {
      rootIds = nonIncomingRoots.map((n) => n.id);
    } else {
      rootIds = nodes.filter((n) => n.status !== 'disabled').map((n) => n.id);
    }
  }

  // Find all reachable nodes from roots via BFS
  const reachable = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (!reachable.has(curr)) {
      reachable.add(curr);
      for (const e of validEdges) {
        if (e.fromNodeId === curr && !reachable.has(e.toNodeId)) {
          queue.push(e.toNodeId);
        }
      }
    }
  }

  // Build in-degree and adjacency list for reachable subgraph
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of reachable) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const e of validEdges) {
    if (reachable.has(e.fromNodeId) && reachable.has(e.toNodeId)) {
      adj.get(e.fromNodeId)?.push(e.toNodeId);
      inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) || 0) + 1);
    }
  }

  // Kahn's algorithm by levels
  let currentLevel: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      currentLevel.push(id);
    }
  }

  const levels: GraphNode[][] = [];
  const orderedNodes: GraphNode[] = [];
  let visitedCount = 0;

  while (currentLevel.length > 0) {
    const levelNodes: GraphNode[] = [];
    const nextLevel: string[] = [];

    for (const nodeId of currentLevel) {
      visitedCount += 1;
      const node = nodeMap.get(nodeId);
      if (node) {
        levelNodes.push(node);
        orderedNodes.push(node);
      }

      for (const neighbor of adj.get(nodeId) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextLevel.push(neighbor);
        }
      }
    }

    if (levelNodes.length > 0) {
      const agentNodes = levelNodes.filter((n) => n.type === 'agent');
      const modelNodes = levelNodes.filter((n) => n.type === 'model');
      const otherNodes = levelNodes.filter((n) => n.type !== 'agent' && n.type !== 'model');

      if (agentNodes.length > 0 && modelNodes.length > 0) {
        levels.push([...agentNodes, ...otherNodes]);
        levels.push(modelNodes);
      } else {
        levels.push(levelNodes);
      }
    }
    currentLevel = nextLevel;
  }

  const hasCycle = visitedCount < reachable.size;

  return {
    levels,
    hasCycle,
    orderedNodes,
  };
}

/**
 * Checks whether adding an edge from fromId to toId would introduce a cycle.
 */
export function wouldCreateCycle(edges: GraphEdge[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true;
  // BFS from toId to see if we can reach fromId
  const visited = new Set<string>();
  const queue = [toId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === fromId) return true;
    visited.add(curr);
    for (const edge of edges) {
      if (edge.fromNodeId === curr && !visited.has(edge.toNodeId)) {
        queue.push(edge.toNodeId);
      }
    }
  }
  return false;
}
