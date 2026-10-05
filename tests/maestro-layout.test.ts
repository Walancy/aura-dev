import { describe, it, expect } from 'bun:test';
import {
  calculateMaestroBatchLayout,
  inferMissingConnections,
  type MaestroAction,
} from '../src/utils/maestroActions';

describe('maestro layout & linking utility', () => {
  it('calculates clean horizontal pipeline with model under agent', () => {
    const actions: MaestroAction[] = [
      { action: 'add_node', type: 'trigger', title: 'Prompt Entrada' },
      { action: 'add_node', type: 'agent', title: 'Agente Dev' },
      { action: 'add_node', type: 'model', title: 'Modelo Sonnet' },
      { action: 'connect_nodes', from: '$node-0', to: '$node-1', fromPort: 'out', toPort: 'in' },
      { action: 'connect_nodes', from: '$node-1', to: '$node-2', fromPort: 'chat_model', toPort: 'in' },
    ];

    const layout = calculateMaestroBatchLayout(actions, []);
    expect(layout.size).toBe(3);

    const pos0 = layout.get(0)!;
    const pos1 = layout.get(1)!;
    const pos2 = layout.get(2)!;

    // Trigger is at start
    expect(pos0.x).toBe(120);
    expect(pos0.y).toBe(140);

    // Agent is offset horizontally by 300px
    expect(pos1.x).toBe(120 + 300);
    expect(pos1.y).toBe(140);

    // Model is directly underneath Agent
    expect(pos2.x).toBe(pos1.x);
    expect(pos2.y).toBe(pos1.y + 240);
  });

  it('offsets new pipeline to avoid collision with existing canvas nodes', () => {
    const existingNodes = [
      { id: 'n1', x: 100, y: 140, width: 220, height: 160 },
      { id: 'n2', x: 400, y: 140, width: 220, height: 160 },
    ];

    const actions: MaestroAction[] = [
      { action: 'add_node', type: 'tool', title: 'Git CLI' },
      { action: 'add_node', type: 'webview', title: 'Preview' },
    ];

    const layout = calculateMaestroBatchLayout(actions, existingNodes);
    const pos0 = layout.get(0)!;
    const pos1 = layout.get(1)!;

    // Rightmost existing node ends at 400 + 220 = 620
    // startX should be >= 620 + 100 = 720
    expect(pos0.x).toBeGreaterThanOrEqual(720);
    expect(pos1.x).toBe(pos0.x + 300);
    expect(pos0.x).not.toBe(pos1.x);
  });

  it('infers missing connections when user prompts for a connected pipeline', () => {
    const actions: MaestroAction[] = [
      { action: 'add_node', type: 'trigger', title: 'Prompt' },
      { action: 'add_node', type: 'agent', title: 'Agente' },
      { action: 'add_node', type: 'model', title: 'Modelo' },
    ];

    const prompt = 'Crie um pipeline completo com prompt, agente e modelo conectados.';
    const enriched = inferMissingConnections(actions, prompt);

    expect(enriched.length).toBe(5); // 3 add_node + 2 connect_nodes
    const connections = enriched.filter((a) => a.action === 'connect_nodes');
    expect(connections.length).toBe(2);

    expect(connections[0]).toEqual({
      action: 'connect_nodes',
      from: '$node-0',
      to: '$node-1',
      fromPort: 'out',
      toPort: 'in',
    });

    expect(connections[1]).toEqual({
      action: 'connect_nodes',
      from: '$node-1',
      to: '$node-2',
      fromPort: 'chat_model',
      toPort: 'in',
    });
  });

  it('does not duplicate connections if actions already include explicit connect_nodes', () => {
    const actions: MaestroAction[] = [
      { action: 'add_node', type: 'trigger', title: 'Prompt' },
      { action: 'add_node', type: 'agent', title: 'Agente' },
      { action: 'connect_nodes', from: '$node-0', to: '$node-1', fromPort: 'out', toPort: 'in' },
    ];

    const enriched = inferMissingConnections(actions, 'conecte tudo');
    expect(enriched.length).toBe(3);
  });
});
