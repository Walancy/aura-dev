import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CheckCircle2, CircleDot, Clock3, Focus, GitBranch, Pause, Play, RotateCcw, Search, ShieldCheck, Sparkles, Square, TerminalSquare, XCircle, Zap } from 'lucide-react';

type AgentState = 'idle' | 'working' | 'review' | 'done' | 'blocked';
type AgentNode = { id: string; name: string; role: string; phase: string; state: AgentState; x: number; y: number; detail: string; task: string };
type GraphEvent = { issueId?: string; phase?: string; kind?: string; message?: string; payload?: { type?: string } };
type Point = { x: number; y: number };
type SelectionBox = { start: Point; current: Point };
type Interaction =
  | { type: 'pan'; start: Point; origin: Point }
  | { type: 'drag'; start: Point; origin: Point; ids: string[] }
  | { type: 'marquee'; start: Point };

const initialNodes: AgentNode[] = [
  { id: 'coordinator', name: 'Orchestrator', role: 'Coordinator', phase: 'dispatch', state: 'working', x: 250, y: 210, detail: 'Distribui tarefas, controla orçamento e mantém checkpoints.', task: 'Sprint atual' },
  { id: 'analyst', name: 'Scout', role: 'Analyst', phase: 'inspect', state: 'working', x: 545, y: 105, detail: 'Lê a issue, o repositório e as restrições locais.', task: 'Contexto do workspace' },
  { id: 'builder', name: 'Forge', role: 'Implementer', phase: 'implement', state: 'idle', x: 570, y: 315, detail: 'Implementa a menor mudança segura e executa testes direcionados.', task: 'Aguardando plano' },
  { id: 'reviewer', name: 'Sentinel', role: 'Verifier', phase: 'review', state: 'review', x: 870, y: 210, detail: 'Revisa o diff, executa testes e decide PASS ou FAIL.', task: 'Revisão automática' },
  { id: 'github', name: 'GitHub', role: 'Project sync', phase: 'sync', state: 'idle', x: 1115, y: 210, detail: 'Sincroniza status, comentários e checkpoints do Project.', task: 'Project board' },
];

const edges: Array<[string, string]> = [['coordinator', 'analyst'], ['coordinator', 'builder'], ['analyst', 'builder'], ['builder', 'reviewer'], ['reviewer', 'github'], ['github', 'coordinator']];

const stateMeta: Record<AgentState, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: 'idle', color: '#64748b', icon: <CircleDot size={12} /> },
  working: { label: 'working', color: '#ff8a3d', icon: <Activity size={12} /> },
  review: { label: 'review', color: '#8b9cff', icon: <ShieldCheck size={12} /> },
  done: { label: 'done', color: '#45d483', icon: <CheckCircle2 size={12} /> },
  blocked: { label: 'blocked', color: '#ff6874', icon: <XCircle size={12} /> },
};

export interface OrchestrationCanvasProps {
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: { bgCard?: string; bgCardSecondary?: string; textPrimary?: string; textSecondary?: string; border?: string; hoverBg?: string };
}

export const OrchestrationCanvas: React.FC<OrchestrationCanvasProps> = ({ accentColor = '#FF6A00', isEffectiveDark = true, themeTokens }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<AgentNode[]>(initialNodes);
  const [selectedId, setSelectedId] = useState('coordinator');
  const [selectedIds, setSelectedIds] = useState<string[]>(['coordinator']);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [running, setRunning] = useState(true);
  const interactionRef = useRef<Interaction | null>(null);
  const spacePressedRef = useRef(false);
  const [events, setEvents] = useState<Array<{ time: string; text: string; color: string }>>([
    { time: 'agora', text: 'Orchestrator conectado ao workspace', color: '#45d483' },
    { time: 'agora', text: 'Budget de tokens: 82% disponível', color: accentColor },
  ]);

  const colors = {
    bg: themeTokens?.bgCardSecondary || (isEffectiveDark ? '#111318' : '#f8fafc'),
    panel: themeTokens?.bgCard || (isEffectiveDark ? '#17191f' : '#ffffff'),
    text: themeTokens?.textPrimary || (isEffectiveDark ? '#f5f7fb' : '#0f172a'),
    muted: themeTokens?.textSecondary || (isEffectiveDark ? '#8991a3' : '#64748b'),
    border: themeTokens?.border || (isEffectiveDark ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.10)'),
  };

  useEffect(() => {
    const unsubscribe = window.electronAPI?.ai?.onOrchestratorEvent?.((event: GraphEvent) => {
      const target = event.issueId ? 'builder' : event.phase === 'planning' ? 'analyst' : event.phase === 'verification' || event.phase === 'repair' ? 'reviewer' : 'coordinator';
      const phase = event.phase || event.kind || 'progress';
      setNodes((current) => current.map((node) => node.id === target ? { ...node, state: event.kind === 'failed' ? 'blocked' : event.kind === 'completed' ? 'done' : 'working', phase } : node));
      setEvents((current) => [{ time: 'agora', text: event.message || `Evento recebido: ${phase}`, color: event.kind === 'failed' ? '#ff6874' : accentColor }, ...current].slice(0, 8));
    });
    return () => unsubscribe?.();
  }, [accentColor]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selected = nodeById.get(selectedId) || nodes[0];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    const grid = 28 * zoom;
    ctx.strokeStyle = isEffectiveDark ? 'rgba(255,255,255,.045)' : 'rgba(15,23,42,.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < rect.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke(); }
    for (let y = 0; y < rect.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke(); }
    const point = (node: AgentNode) => ({ x: node.x * zoom + pan.x, y: node.y * zoom + pan.y });
    edges.forEach(([fromId, toId]) => {
      const from = nodeById.get(fromId); const to = nodeById.get(toId); if (!from || !to) return;
      const a = point(from); const b = point(to); const active = from.state === 'working' || to.state === 'working';
      ctx.beginPath(); ctx.moveTo(a.x + 86 * zoom, a.y + 42 * zoom); ctx.lineTo(b.x + 6 * zoom, b.y + 42 * zoom);
      ctx.strokeStyle = active ? `${accentColor}aa` : (isEffectiveDark ? 'rgba(255,255,255,.15)' : 'rgba(15,23,42,.16)'); ctx.lineWidth = active ? 2 : 1; ctx.stroke();
      if (active) { ctx.beginPath(); ctx.arc((a.x + b.x) / 2 + 34 * zoom, (a.y + b.y) / 2 + 42 * zoom, 3, 0, Math.PI * 2); ctx.fillStyle = accentColor; ctx.fill(); }
    });
    nodes.forEach((node) => {
      const { x, y } = point(node); const meta = stateMeta[node.state]; const selected = node.id === selectedId;
      ctx.shadowColor = selected ? `${meta.color}55` : 'transparent'; ctx.shadowBlur = selected ? 18 : 0;
      ctx.fillStyle = colors.panel; ctx.beginPath(); ctx.roundRect(x, y, 178 * zoom, 84 * zoom, 10 * zoom); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = selectedIds.includes(node.id) ? meta.color : colors.border; ctx.lineWidth = selectedIds.includes(node.id) ? 1.5 : 1; ctx.stroke();
      ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(x + 17 * zoom, y + 21 * zoom, 5 * zoom, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors.text; ctx.font = `600 ${12 * zoom}px Poppins, sans-serif`; ctx.fillText(node.name, x + 30 * zoom, y + 25 * zoom);
      ctx.fillStyle = colors.muted; ctx.font = `${10 * zoom}px Poppins, sans-serif`; ctx.fillText(node.role, x + 13 * zoom, y + 47 * zoom); ctx.fillText(node.phase, x + 13 * zoom, y + 66 * zoom);
      ctx.fillStyle = meta.color; ctx.font = `600 ${9 * zoom}px Poppins, sans-serif`; ctx.fillText(meta.label.toUpperCase(), x + 123 * zoom, y + 22 * zoom);
    });
    if (selectionBox) {
      const x = Math.min(selectionBox.start.x, selectionBox.current.x);
      const y = Math.min(selectionBox.start.y, selectionBox.current.y);
      const width = Math.abs(selectionBox.current.x - selectionBox.start.x);
      const height = Math.abs(selectionBox.current.y - selectionBox.start.y);
      ctx.fillStyle = `${accentColor}18`;
      ctx.strokeStyle = `${accentColor}cc`;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  }, [accentColor, colors.bg, colors.border, colors.muted, colors.panel, colors.text, isEffectiveDark, nodeById, nodes, pan, selectedIds, selectionBox, zoom]);

  useEffect(() => { draw(); const onResize = () => draw(); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }, [draw]);

  const toViewportPoint = (event: { clientX: number; clientY: number }, element: HTMLCanvasElement): Point => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const toWorldPoint = (point: Point): Point => ({ x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom });

  const nodeAt = (point: Point) => {
    const world = toWorldPoint(point);
    return [...nodes].reverse().find((node) => world.x >= node.x && world.x <= node.x + 178 && world.y >= node.y && world.y <= node.y + 84);
  };

  const selectNodesInBox = (box: SelectionBox) => {
    const a = toWorldPoint({ x: Math.min(box.start.x, box.current.x), y: Math.min(box.start.y, box.current.y) });
    const b = toWorldPoint({ x: Math.max(box.start.x, box.current.x), y: Math.max(box.start.y, box.current.y) });
    return nodes.filter((node) => node.x < b.x && node.x + 178 > a.x && node.y < b.y && node.y + 84 > a.y).map((node) => node.id);
  };

  const select = (ids: string[], additive: boolean) => {
    const next = additive ? Array.from(new Set([...selectedIds, ...ids])) : ids;
    setSelectedIds(next);
    if (next[0]) setSelectedId(next[0]);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toViewportPoint(event, event.currentTarget);
    const hit = nodeAt(point);
    const isPan = event.button === 1 || spacePressedRef.current || event.button === 2;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (isPan) {
      interactionRef.current = { type: 'pan', start: point, origin: pan };
      return;
    }
    if (event.button !== 0) return;
    if (hit) {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const ids = additive && selectedIds.includes(hit.id) ? selectedIds : additive ? [...selectedIds, hit.id] : [hit.id];
      select(ids, false);
      interactionRef.current = { type: 'drag', start: point, origin: point, ids };
    } else {
      if (!event.shiftKey && !event.metaKey && !event.ctrlKey) select([], false);
      interactionRef.current = { type: 'marquee', start: point };
      setSelectionBox({ start: point, current: point });
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const point = toViewportPoint(event, event.currentTarget);
    if (interaction.type === 'pan') {
      setPan({ x: interaction.origin.x + point.x - interaction.start.x, y: interaction.origin.y + point.y - interaction.start.y });
    } else if (interaction.type === 'drag') {
      const delta = { x: (point.x - interaction.start.x) / zoom, y: (point.y - interaction.start.y) / zoom };
      setNodes((current) => current.map((node) => interaction.ids.includes(node.id) ? { ...node, x: node.x + delta.x, y: node.y + delta.y } : node));
      interactionRef.current = { ...interaction, start: point };
    } else {
      setSelectionBox({ start: interaction.start, current: point });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = interactionRef.current;
    if (interaction?.type === 'marquee' && selectionBox) select(selectNodesInBox(selectionBox), event.shiftKey || event.metaKey || event.ctrlKey);
    interactionRef.current = null;
    setSelectionBox(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = toViewportPoint(event, event.currentTarget);
    if (event.ctrlKey || event.metaKey) {
      const nextZoom = Math.min(1.8, Math.max(0.5, zoom * Math.pow(1.0015, -event.deltaY)));
      const world = { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
      setPan({ x: point.x - world.x * nextZoom, y: point.y - world.y * nextZoom });
      setZoom(nextZoom);
    } else {
      setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
    }
  };

  const fitToNodes = (ids: string[]) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const targets = nodes.filter((node) => ids.includes(node.id));
    if (!rect || !targets.length) return;
    const minX = Math.min(...targets.map((node) => node.x));
    const minY = Math.min(...targets.map((node) => node.y));
    const maxX = Math.max(...targets.map((node) => node.x + 178));
    const maxY = Math.max(...targets.map((node) => node.y + 84));
    const padding = 80;
    const nextZoom = Math.min(1.8, Math.max(0.5, Math.min((rect.width - padding) / (maxX - minX), (rect.height - padding) / (maxY - minY))));
    setZoom(nextZoom);
    setPan({ x: (rect.width - (maxX - minX) * nextZoom) / 2 - minX * nextZoom, y: (rect.height - (maxY - minY) * nextZoom) / 2 - minY * nextZoom });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) { spacePressedRef.current = true; event.preventDefault(); }
      if (event.key === 'Escape') { interactionRef.current = null; setSelectionBox(null); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); select(nodes.map((node) => node.id), false); }
      if (event.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); }
      if (event.key === '1') { setZoom(1); }
      if (event.key === '2') fitToNodes(selectedIds.length ? selectedIds : ['coordinator']);
      if (event.key === 'F' || event.key === 'f' || (event.shiftKey && event.key === '1')) fitToNodes(nodes.map((node) => node.id));
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(1.8, value + 0.1));
      if (event.key === '-') setZoom((value) => Math.max(0.5, value - 0.1));
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') spacePressedRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [nodes, pan, selectedIds]);

  const toggleRun = () => { setRunning((value) => !value); setEvents((current) => [{ time: 'agora', text: running ? 'Execução pausada pelo operador' : 'Execução retomada', color: running ? '#f59e0b' : '#45d483' }, ...current].slice(0, 8)); };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', alignSelf: 'stretch', width: '100%', minWidth: 0, minHeight: 0, color: colors.text, background: colors.bg, overflow: 'hidden', fontFamily: 'Poppins, sans-serif' }} aria-label="Canvas de orquestração">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${colors.border}`, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 600, letterSpacing: '-.02em' }}>Orquestração</h1>
          <p style={{ color: colors.muted, fontSize: 11.5, marginTop: 5 }}>Acompanhe agentes, dependências e decisões em tempo real.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: running ? '#45d483' : '#f59e0b', fontSize: 11, padding: '6px 9px', background: running ? 'rgba(69,212,131,.10)' : 'rgba(245,158,11,.10)', borderRadius: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{running ? 'executando' : 'pausado'}</span>
          <button type="button" onClick={toggleRun} aria-label={running ? 'Pausar execução' : 'Retomar execução'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: `1px solid ${colors.border}`, borderRadius: 5, color: colors.text, background: 'transparent', cursor: 'pointer', fontSize: 11 }}>{running ? <Pause size={13} /> : <Play size={13} />}{running ? 'Pausar' : 'Retomar'}</button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Centralizar canvas" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: `1px solid ${colors.border}`, borderRadius: 5, color: colors.muted, background: 'transparent', cursor: 'pointer' }}><Focus size={14} /></button>
        </div>
      </header>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 22px', borderBottom: `1px solid ${colors.border}`, color: colors.muted, fontSize: 10.5 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Zap size={12} color={accentColor} /> 3 agentes ativos</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><GitBranch size={12} /> 2 dependências aguardando</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TerminalSquare size={12} /> 82% tokens disponíveis</span><span style={{ marginLeft: 'auto' }}>Sprint: Autonomous hardening</span>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 1 }}>
        <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 360, overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(event) => event.preventDefault()}
            role="img"
            aria-label="Grafo dos agentes de orquestração. Arraste nós para movê-los; use Espaço mais arraste para navegar; use Command ou Control mais a roda para zoom."
            style={{ display: 'block', width: '100%', height: '100%', outline: 'none', cursor: spacePressedRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
          />
          <div style={{ position: 'absolute', bottom: 14, left: 18, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', color: colors.muted, background: `${colors.panel}e8`, border: `1px solid ${colors.border}`, borderRadius: 5, fontSize: 10 }}><span>zoom</span><button type="button" onClick={() => setZoom((value) => Math.max(.5, value - .1))} aria-label="Diminuir zoom" style={{ border: 0, background: 'transparent', color: colors.text, cursor: 'pointer' }}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .1))} aria-label="Aumentar zoom" style={{ border: 0, background: 'transparent', color: colors.text, cursor: 'pointer' }}>+</button><span style={{ marginLeft: 6, opacity: .8 }}>⌘/Ctrl + roda · Espaço + arraste · 1/2/F</span></div>
        </div>
        <aside style={{ width: 292, flexShrink: 0, display: 'flex', flexDirection: 'column', background: colors.panel, borderLeft: `1px solid ${colors.border}`, overflowY: 'auto' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${colors.border}` }}><div style={{ color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>Agente selecionado</div><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: stateMeta[selected.state].color }} /><strong style={{ fontSize: 14 }}>{selected.name}</strong><span style={{ marginLeft: 'auto', color: stateMeta[selected.state].color, fontSize: 10 }}>{stateMeta[selected.state].label}</span></div><p style={{ color: colors.muted, fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>{selected.detail}</p></div>
          <div style={{ padding: 16, borderBottom: `1px solid ${colors.border}` }}><div style={{ color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Pipeline</div>{nodes.map((node) => <button type="button" key={node.id} onClick={() => { setSelectedId(node.id); setSelectedIds([node.id]); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', border: 0, background: 'transparent', color: node.id === selectedId ? colors.text : colors.muted, cursor: 'pointer', textAlign: 'left' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: stateMeta[node.state].color, boxShadow: node.state === 'working' ? `0 0 0 4px ${stateMeta[node.state].color}22` : 'none' }} /><span style={{ fontSize: 11, flex: 1 }}>{node.name}</span><span style={{ fontSize: 9, color: stateMeta[node.state].color }}>{node.phase}</span></button>)}</div>
          <div style={{ padding: 16, flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}><Clock3 size={11} /> Atividade recente</div>{events.map((event, index) => <div key={`${event.time}-${index}`} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: index === events.length - 1 ? 0 : `1px solid ${colors.border}` }}><span style={{ width: 6, height: 6, flexShrink: 0, marginTop: 4, borderRadius: '50%', background: event.color }} /><div><div style={{ color: colors.text, fontSize: 10.5, lineHeight: 1.35 }}>{event.text}</div><div style={{ color: colors.muted, fontSize: 9, marginTop: 3 }}>{event.time}</div></div></div>)}</div>
        </aside>
      </div>
    </section>
  );
};
