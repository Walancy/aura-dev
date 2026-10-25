/** Prefixo dos ids das sessões PTY da orquestração (uma por nó, por andar). */
export const ORCHESTRATION_CLI_SESSION_PREFIX = 'orch-cli-';

export const getOrchestrationCliSessionId = (floorId: string, nodeId: string): string =>
  `${ORCHESTRATION_CLI_SESSION_PREFIX}${floorId}-${nodeId}`;

/** Andares: 'ground' (térreo) ou 'floor-<timestamp>' (criados pelo usuário); o id do nó pode ter hífens. */
const FLOOR_AND_NODE = /^(ground|floor-\d+)-(.+)$/;

export const parseOrchestrationCliSessionId = (sessionId: string): { floorId: string; nodeId: string } | null => {
  if (!sessionId.startsWith(ORCHESTRATION_CLI_SESSION_PREFIX)) return null;
  const rest = sessionId.slice(ORCHESTRATION_CLI_SESSION_PREFIX.length);
  const m = FLOOR_AND_NODE.exec(rest);
  if (m) return { floorId: m[1], nodeId: m[2] };
  // formato antigo, sem andar: o id inteiro é o nó
  const dash = rest.indexOf('-');
  return dash === -1 ? { floorId: '', nodeId: rest } : { floorId: rest.slice(0, dash), nodeId: rest.slice(dash + 1) };
};
