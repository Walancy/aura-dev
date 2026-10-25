import { test, expect } from 'bun:test';
import { getOrchestrationCliSessionId, parseOrchestrationCliSessionId } from '../src/utils/orchestrationSession';

test('ida e volta do id da sessão, no térreo e em andares criados pelo usuário', () => {
  for (const floorId of ['ground', 'floor-1730000123456']) {
    for (const nodeId of ['n1', 'node-abc-12', 'node_1730_x', 'maestro-agent-3']) {
      expect(parseOrchestrationCliSessionId(getOrchestrationCliSessionId(floorId, nodeId))).toEqual({ floorId, nodeId });
    }
  }
});

test('ids de outras sessões não são da orquestração', () => {
  expect(parseOrchestrationCliSessionId('dev-server-app')).toBeNull();
  expect(parseOrchestrationCliSessionId('terminal-1')).toBeNull();
});
