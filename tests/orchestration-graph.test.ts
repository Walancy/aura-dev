import { describe, expect, it } from 'bun:test';
import {
  topologicalSortWorkflow,
  wouldCreateCycle,
  GraphNode,
  GraphEdge,
} from '../src/utils/orchestration-graph';
import { isStatusPass, normalizeClaudeModel } from '../electron/env-utils';

describe('topologicalSortWorkflow', () => {
  it('correctly sorts a linear workflow: Trigger -> Node A -> Node B', () => {
    const nodes: GraphNode[] = [
      { id: 'trigger', type: 'trigger', title: 'Start', status: 'ready', config: {}, ports: { input: [], output: ['out'] } },
      { id: 'nodeA', type: 'model', title: 'Agent A', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
      { id: 'nodeB', type: 'model', title: 'Agent B', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', fromNodeId: 'trigger', fromPort: 'out', toNodeId: 'nodeA', toPort: 'in' },
      { id: 'e2', fromNodeId: 'nodeA', fromPort: 'out', toNodeId: 'nodeB', toPort: 'in' },
    ];

    const result = topologicalSortWorkflow(nodes, edges);
    expect(result.hasCycle).toBe(false);
    expect(result.levels.length).toBe(3);
    expect(result.levels[0].map((n) => n.id)).toEqual(['trigger']);
    expect(result.levels[1].map((n) => n.id)).toEqual(['nodeA']);
    expect(result.levels[2].map((n) => n.id)).toEqual(['nodeB']);
  });

  it('correctly groups parallel nodes into the same level', () => {
    const nodes: GraphNode[] = [
      { id: 'trigger', type: 'trigger', title: 'Start', status: 'ready', config: {}, ports: { input: [], output: ['out'] } },
      { id: 'agent1', type: 'model', title: 'Agent 1', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
      { id: 'agent2', type: 'model', title: 'Agent 2', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
      { id: 'merger', type: 'tool', title: 'Merge Tool', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', fromNodeId: 'trigger', fromPort: 'out', toNodeId: 'agent1', toPort: 'in' },
      { id: 'e2', fromNodeId: 'trigger', fromPort: 'out', toNodeId: 'agent2', toPort: 'in' },
      { id: 'e3', fromNodeId: 'agent1', fromPort: 'out', toNodeId: 'merger', toPort: 'in' },
      { id: 'e4', fromNodeId: 'agent2', fromPort: 'out', toNodeId: 'merger', toPort: 'in' },
    ];

    const result = topologicalSortWorkflow(nodes, edges);
    expect(result.hasCycle).toBe(false);
    expect(result.levels.length).toBe(3);
    expect(result.levels[0].map((n) => n.id)).toEqual(['trigger']);
    const parallelIds = result.levels[1].map((n) => n.id).sort();
    expect(parallelIds).toEqual(['agent1', 'agent2']);
    expect(result.levels[2].map((n) => n.id)).toEqual(['merger']);
  });

  it('detects cycles in the graph', () => {
    const nodes: GraphNode[] = [
      { id: 'trigger', type: 'trigger', title: 'Start', status: 'ready', config: {}, ports: { input: [], output: ['out'] } },
      { id: 'nodeA', type: 'model', title: 'A', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
      { id: 'nodeB', type: 'model', title: 'B', status: 'ready', config: {}, ports: { input: ['in'], output: ['out'] } },
    ];
    const edges: GraphEdge[] = [
      { id: 'e1', fromNodeId: 'trigger', fromPort: 'out', toNodeId: 'nodeA', toPort: 'in' },
      { id: 'e2', fromNodeId: 'nodeA', fromPort: 'out', toNodeId: 'nodeB', toPort: 'in' },
      { id: 'e3', fromNodeId: 'nodeB', fromPort: 'out', toNodeId: 'nodeA', toPort: 'in' }, // cycle!
    ];

    const result = topologicalSortWorkflow(nodes, edges);
    expect(result.hasCycle).toBe(true);
  });

  it('wouldCreateCycle checks prospective edges', () => {
    const edges: GraphEdge[] = [
      { id: 'e1', fromNodeId: 'nodeA', fromPort: 'out', toNodeId: 'nodeB', toPort: 'in' },
      { id: 'e2', fromNodeId: 'nodeB', fromPort: 'out', toNodeId: 'nodeC', toPort: 'in' },
    ];

    expect(wouldCreateCycle(edges, 'nodeC', 'nodeA')).toBe(true);
    expect(wouldCreateCycle(edges, 'nodeA', 'nodeA')).toBe(true);
    expect(wouldCreateCycle(edges, 'nodeA', 'nodeC')).toBe(false);
    expect(wouldCreateCycle(edges, 'nodeC', 'nodeD')).toBe(false);
  });
});

describe('isStatusPass', () => {
  it('identifies clean PASS status', () => {
    expect(isStatusPass('Revisão aprovada.\nSTATUS: PASS')).toBe(true);
  });

  it('identifies clean FAIL status', () => {
    expect(isStatusPass('Revisão reprovada.\nSTATUS: FAIL')).toBe(false);
  });

  it('respects the LAST occurrence when the prompt text quotes PASS in the middle', () => {
    const textWithPromptEcho =
      'A instrução dizia: Termine com STATUS: PASS ou STATUS: FAIL.\nMas eu encontrei um bug grave na validação.\nSTATUS: FAIL';
    expect(isStatusPass(textWithPromptEcho)).toBe(false);
  });

  it('respects the LAST occurrence when fixed and ending with PASS', () => {
    const text =
      'Antes falhou com STATUS: FAIL, mas agora corrigi os testes.\nSTATUS: PASS';
    expect(isStatusPass(text)).toBe(true);
  });
});

describe('normalizeClaudeModel', () => {
  it('maps sonnet 1m to sonnet[1m]', () => {
    expect(normalizeClaudeModel('claude-3-7-sonnet-1m')).toBe('sonnet[1m]');
  });

  it('strips default / padrão', () => {
    expect(normalizeClaudeModel('default')).toBe('');
    expect(normalizeClaudeModel('Padrão')).toBe('');
  });

  it('normalizes common aliases', () => {
    expect(normalizeClaudeModel('claude-3-5-haiku')).toBe('haiku');
    expect(normalizeClaudeModel('claude-3-opus')).toBe('opus');
  });
});

describe('Link Bezier Geometry & Tag Dragging', () => {
  // Dynamic import to prevent any SSR / bundler issues
  it('centers tag exactly on the cubic Bezier curve at ratio 0.5', async () => {
    const { getCableGeometry, evaluateCubicBezier } = await import(
      '../src/components/OrchestrationCanvas'
    );

    const from = { x: 100, y: 100 };
    const to = { x: 400, y: 300 };
    const geom = getCableGeometry(from, to, 'right', 'left', 0.5);

    // Verify midX and midY match evaluateCubicBezier at t = 0.5
    const expected = evaluateCubicBezier(geom.p1, geom.cp1, geom.cp2, geom.p2, 0.5);
    expect(geom.midX).toBeCloseTo(expected.x, 5);
    expect(geom.midY).toBeCloseTo(expected.y, 5);
  });

  it('clamps tag ratio within [0.08, 0.92] so it never leaves the link or touches ports', async () => {
    const { getCableGeometry, evaluateCubicBezier } = await import(
      '../src/components/OrchestrationCanvas'
    );

    const from = { x: 100, y: 100 };
    const to = { x: 400, y: 300 };

    const geomMin = getCableGeometry(from, to, 'right', 'left', 0.0);
    const expectedMin = evaluateCubicBezier(geomMin.p1, geomMin.cp1, geomMin.cp2, geomMin.p2, 0.08);
    expect(geomMin.midX).toBeCloseTo(expectedMin.x, 5);
    expect(geomMin.midY).toBeCloseTo(expectedMin.y, 5);

    const geomMax = getCableGeometry(from, to, 'right', 'left', 1.0);
    const expectedMax = evaluateCubicBezier(geomMax.p1, geomMax.cp1, geomMax.cp2, geomMax.p2, 0.92);
    expect(geomMax.midX).toBeCloseTo(expectedMax.x, 5);
    expect(geomMax.midY).toBeCloseTo(expectedMax.y, 5);
  });

  it('finds closest parameter t along the curve when dragging', async () => {
    const { getCableGeometry, findClosestTOnCubicBezier, evaluateCubicBezier } = await import(
      '../src/components/OrchestrationCanvas'
    );

    const from = { x: 50, y: 50 };
    const to = { x: 350, y: 250 };
    const geom = getCableGeometry(from, to, 'right', 'left');

    // Pick a point at t = 0.35 and add slight noise
    const ptAt35 = evaluateCubicBezier(geom.p1, geom.cp1, geom.cp2, geom.p2, 0.35);
    const draggedMouse = { x: ptAt35.x + 2, y: ptAt35.y - 3 };

    const closestT = findClosestTOnCubicBezier(
      geom.p1,
      geom.cp1,
      geom.cp2,
      geom.p2,
      draggedMouse,
      0.08,
      0.92
    );

    expect(closestT).toBeGreaterThan(0.33);
    expect(closestT).toBeLessThan(0.37);
  });

  describe('Browser Orchestration Rules & URL Resolution', () => {
    it('resolves explicit Google open requests to Google homepage', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('abrir o google')).toBe('https://www.google.com');
      expect(resolveBrowserUrlFromInput('Acessar Google')).toBe('https://www.google.com');
      expect(resolveBrowserUrlFromInput('navegar para o google')).toBe('https://www.google.com');
    });

    it('resolves Google search requests to google search query URL', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('pesquisar devflow no google')).toBe(
        'https://www.google.com/search?q=devflow'
      );
      expect(resolveBrowserUrlFromInput('buscar react 19')).toBe(
        'https://www.google.com/search?q=react%2019'
      );
    });

    it('resolves direct URLs and domain names', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('https://github.com/walancy')).toBe(
        'https://github.com/walancy'
      );
      expect(resolveBrowserUrlFromInput('github.com/walancy')).toBe(
        'https://github.com/walancy'
      );
      expect(resolveBrowserUrlFromInput('http://localhost:5173')).toBe(
        'http://localhost:5173'
      );
    });

    it('falls back to nodeConfigUrl or about:blank when no input provided', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('', 'https://vitejs.dev')).toBe(
        'https://vitejs.dev'
      );
      expect(resolveBrowserUrlFromInput('', '')).toBe('about:blank');
    });

    it('resolves requests for YouTube, GitHub and other services to their respective URLs', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('Abra o youtube no navegador.')).toBe(
        'https://www.youtube.com'
      );
      expect(resolveBrowserUrlFromInput('abrir o youtube')).toBe(
        'https://www.youtube.com'
      );
      expect(resolveBrowserUrlFromInput('abrir o github no navegador')).toBe(
        'https://www.github.com'
      );
      expect(resolveBrowserUrlFromInput('abrir o site da apple')).toBe(
        'https://www.apple.com'
      );
    });

    it('resolves service-specific search requests', async () => {
      const { resolveBrowserUrlFromInput } = await import('../src/components/OrchestrationCanvas');
      expect(resolveBrowserUrlFromInput('pesquisar tutoriais de typescript no youtube')).toBe(
        'https://www.youtube.com/results?search_query=tutoriais%20de%20typescript'
      );
      expect(resolveBrowserUrlFromInput('buscar devflow no github')).toBe(
        'https://github.com/search?q=devflow'
      );
    });

    it('correctly filters and detects connected webview browser nodes', async () => {
      const { getConnectedBrowserNodes } = await import('../src/components/OrchestrationCanvas');
      const nodes: any[] = [
        { id: 'trigger-1', type: 'trigger', title: 'Start' },
        { id: 'browser-1', type: 'webview', title: 'Browser Node' },
        { id: 'agent-1', type: 'agent', title: 'Agent Node' },
      ];
      const edges: any[] = [
        { id: 'e1', fromNodeId: 'trigger-1', toNodeId: 'browser-1' },
        { id: 'e2', fromNodeId: 'trigger-1', toNodeId: 'agent-1' },
      ];

      const connectedToTrigger = getConnectedBrowserNodes('trigger-1', nodes, edges);
      expect(connectedToTrigger).toHaveLength(1);
      expect(connectedToTrigger[0].id).toBe('browser-1');

      // Reverse direction
      const connectedToBrowser = getConnectedBrowserNodes('browser-1', nodes, edges);
      expect(connectedToBrowser).toHaveLength(0); // Trigger is not a webview node
    });

    it('correctly filters and detects connected project nodes', async () => {
      const { getConnectedProjectNodes } = await import('../src/components/OrchestrationCanvas');
      const nodes: any[] = [
        { id: 'proj-1', type: 'project', title: 'My App', config: { projectPath: '/workspace/app', devUrl: 'http://localhost:3000' } },
        { id: 'agent-1', type: 'agent', title: 'Developer AI' },
        { id: 'webview-1', type: 'webview', title: 'Browser' },
      ];
      const edges: any[] = [
        { id: 'e1', fromNodeId: 'proj-1', toNodeId: 'agent-1' },
        { id: 'e2', fromNodeId: 'proj-1', toNodeId: 'webview-1' },
      ];

      const connectedToAgent = getConnectedProjectNodes('agent-1', nodes, edges);
      expect(connectedToAgent).toHaveLength(1);
      expect(connectedToAgent[0].id).toBe('proj-1');
      expect(connectedToAgent[0].config?.projectPath).toBe('/workspace/app');

      // Outgoing from project to webview
      const connectedToWebview = getConnectedProjectNodes('webview-1', nodes, edges);
      expect(connectedToWebview).toHaveLength(1);
      expect(connectedToWebview[0].id).toBe('proj-1');
    });
  });
});

