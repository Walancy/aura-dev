import { describe, it, expect } from 'bun:test';
import { parseMaestroActions, resolveNodeId } from '../src/utils/maestroActions';

describe('maestroActions utility', () => {
  it('parses explicit ```json:actions block and separates cleanText', () => {
    const raw = `
Criei o pipeline solicitado com um nó de prompt, um agente e o modelo Claude.

\`\`\`json:actions
[
  {
    "action": "add_node",
    "type": "trigger",
    "title": "Prompt Entrada",
    "config": { "prompt": "Resolver issue #2" }
  },
  {
    "action": "add_node",
    "type": "agent",
    "title": "Agente Dev"
  },
  {
    "action": "connect_nodes",
    "from": "$node-0",
    "to": "$node-1",
    "fromPort": "out",
    "toPort": "in"
  }
]
\`\`\`

Os nós foram vinculados e estão prontos no canvas.
    `.trim();

    const result = parseMaestroActions(raw);
    expect(result.actions.length).toBe(3);
    expect(result.actions[0].action).toBe('add_node');
    expect(result.actions[1].action).toBe('add_node');
    expect(result.actions[2].action).toBe('connect_nodes');
    expect(result.cleanText).toContain('Criei o pipeline solicitado');
    expect(result.cleanText).toContain('Os nós foram vinculados');
    expect(result.cleanText).not.toContain('```json:actions');
  });

  it('parses generic json block containing actions', () => {
    const raw = `
Vou atualizar o prompt do card de entrada.
\`\`\`json
[
  {
    "action": "update_node",
    "nodeId": "node-trigger-123",
    "config": { "prompt": "Novo prompt detalhado para a IA." }
  }
]
\`\`\`
Prompt atualizado!
    `;

    const result = parseMaestroActions(raw);
    expect(result.actions.length).toBe(1);
    expect(result.actions[0].action).toBe('update_node');
    if (result.actions[0].action === 'update_node') {
      expect(result.actions[0].nodeId).toBe('node-trigger-123');
      expect(result.actions[0].config?.prompt).toBe('Novo prompt detalhado para a IA.');
    }
  });

  it('returns empty actions for text without action blocks', () => {
    const raw = 'Olá! O fluxo atual possui 3 agentes ativos e nenhuma issue pendente.';
    const result = parseMaestroActions(raw);
    expect(result.actions.length).toBe(0);
    expect(result.cleanText).toBe(raw);
  });

  it('resolves $node-N references properly', () => {
    const createdIds = ['node-trigger-1', 'node-agent-2', 'node-model-3'];
    expect(resolveNodeId('$node-0', createdIds)).toBe('node-trigger-1');
    expect(resolveNodeId('$node-1', createdIds)).toBe('node-agent-2');
    expect(resolveNodeId('$node-2', createdIds)).toBe('node-model-3');
    expect(resolveNodeId('node-existing-99', createdIds)).toBe('node-existing-99');
  });
});
