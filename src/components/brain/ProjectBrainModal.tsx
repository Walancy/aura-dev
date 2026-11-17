import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setBrainActivity } from '../../utils/brainActivity';
import { TitleTooltips } from '../ui/TitleTooltips';
import { AiGenerateButton } from '../ui/AiGenerateButton';
import { runSiteAi } from '../sites/siteAi';
import { Brain, FilePlus2, RefreshCw, X, ExternalLink, Search, FileText, Hash, Link2, Pencil, Eye, Sparkles, Save, Copy, Check, Plus, RotateCcw, Layers, Network, ListChecks, Trash2, Eraser, ListRestart, Unlink, Loader2, Terminal, AlertTriangle } from 'lucide-react';
import type { ProjectBrainContext } from '../../types/brain';
import { VaultGraphView, DEFAULT_GRAPH_SETTINGS, type GraphSettings } from './VaultGraph';
import { hasCliSync, syncBrainToCli } from './cliSync';
import { brainStaleness, findBrokenRefs, markBrainFresh, readBrainMeta, type Staleness } from './freshness';
import { MiniSwitch } from '../ui/MiniSwitch';
import { AI_NOTE_MARK, BRAIN_NOTES_DIR, buildGraph, buildResolver, newNoteTemplate, parseNote, scanVault, summarizeVaultForAi, type GraphNode, type VaultNote } from './vault';
import { loadProjectBrain, saveProjectBrain, generateBrainAiContext, setBrainVaultSummary, logBrainActivity, scanProjectCodebase } from '../../utils/brainService';
import { TutorialTriggerButton, useRegisterTutorialOverlay } from '../tutorial/TutorialTriggerButton';
import { renderMarkdownPreview } from '../../utils/markdown';
import { getFieldTokens } from '../../utils/fieldTokens';
import { getContrastTextColor } from '../../utils/color';

interface ProjectBrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  projectName?: string;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
  onOpenFile?: (path: string) => void;
  onToast?: (message: string) => void;
  aiProvider?: string;
  aiModel?: string;
  aiProviders?: Array<{ id: string; name: string }>;
  aiModelsByProvider?: Record<string, Array<{ id: string; label: string }>>;
  onChangeAiProvider?: (id: string) => void;
  onChangeAiModel?: (id: string) => void;
}

const SETTINGS_KEY = (ws: string) => `devflow_brain_graph_settings_v1:${ws}`;
const WIKI = /\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/g;

type Side = 'notes' | 'ai';

/** Brain do projeto: sidesheet que sobe de baixo ocupando quase toda a tela, com o vault de notas (links [[assim]]) e o grafo no estilo do Obsidian. */
export const ProjectBrainModal: React.FC<ProjectBrainModalProps> = ({ isOpen, onClose, workspacePath, projectName, accentColor, isEffectiveDark, onOpenFile, onToast, aiProvider = 'claude', aiModel, aiProviders = [], aiModelsByProvider = {}, onChangeAiProvider, onChangeAiModel }) => {
  useRegisterTutorialOverlay('modal_brain', isOpen);
  const ft = getFieldTokens(isEffectiveDark);
  const t = useMemo(
    () => ({
      text: isEffectiveDark ? '#f4f4f5' : '#0f172a',
      sub: isEffectiveDark ? '#a1a1aa' : '#64748b',
      muted: isEffectiveDark ? '#71717a' : '#94a3b8',
      divider: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
      panel: isEffectiveDark ? '#202020' : '#f1f1f2',
      field: ft.fieldBg,
      hover: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      bg: isEffectiveDark ? '#141414' : '#ffffff',
    }),
    [isEffectiveDark, ft.fieldBg],
  );

  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [allNotes, setNotes] = useState<VaultNote[]>([]);
  const [scopePref, setScopePref] = useState<'brain' | 'project' | null>(null);
  // escopo do vault: só as notas do Brain (.aura/brain) ou todos os .md do projeto; sem escolha salva, usa o Brain quando ele já tem notas
  const hasBrainNotes = allNotes.some((n) => n.rel.startsWith(`${BRAIN_NOTES_DIR}/`));
  const scope: 'brain' | 'project' = scopePref ?? (hasBrainNotes ? 'brain' : 'project');
  const notes = useMemo(() => (scope === 'brain' ? allNotes.filter((n) => n.rel.startsWith(`${BRAIN_NOTES_DIR}/`)) : allNotes), [allNotes, scope]);
  const wsRef = useRef(workspacePath);
  wsRef.current = workspacePath;
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState<Side>('notes');
  const [query, setQuery] = useState('');
  const [activePath, setActivePath] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [brain, setBrain] = useState<ProjectBrainContext | null>(null);
  const [brainDirty, setBrainDirty] = useState(false);
  const [rescanningBrain, setRescanningBrain] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [addingTech, setAddingTech] = useState(false);
  const [newTech, setNewTech] = useState('');
  type BrainSuggestion = Partial<Pick<ProjectBrainContext, 'summary' | 'architectureOverview' | 'modulesSummary' | 'aiDirectives' | 'techStack'>>;
  const [suggestion, setSuggestion] = useState<BrainSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const brainRef = useRef<ProjectBrainContext | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [stale, setStale] = useState<Staleness | null>(null);
  const [broken, setBroken] = useState<Map<string, string[]>>(new Map());
  const AUTO_KEY = `devflow_brain_auto_update:${workspacePath}`;
  const [autoUpdate, setAutoUpdate] = useState(false);
  const autoRan = useRef(false);
  const linkCtl = useRef<{ abort?: (why?: string) => void }>({});
  const mapCtl = useRef<{ abort?: (why?: string) => void }>({});
  const suggestCtl = useRef<{ abort?: (why?: string) => void }>({});
  const [aiSection, setAiSection] = useState<'stack' | 'summary' | 'arch' | 'rules' | 'payload'>('stack');
  const prevNodes = useRef<Map<string, GraphNode>>(new Map());

  // entrada e saída animadas
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const reload = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    try {
      const ws = workspacePath;
      const v = await scanVault(ws);
      // trocou de projeto enquanto lia: descarta, senão as notas do projeto anterior aparecem no atual
      if (wsRef.current !== ws) return;
      setNotes(v.notes);
      setAttachments(v.attachments);
      setBrainVaultSummary(workspacePath, summarizeVaultForAi(v.notes));
      // quem já sincronizou com as CLIs mantém o índice em dia sem precisar clicar
      if (await hasCliSync(workspacePath)) syncBrainToCli(workspacePath, brainRef.current, v.notes).catch(() => {});
      // frescor: arquivos citados que sumiram e commits desde a última atualização do mapa
      findBrokenRefs(workspacePath, v.notes).then(setBroken).catch(() => {});
      if (v.notes.some((n) => n.content.includes(AI_NOTE_MARK))) {
        if (!(await readBrainMeta(workspacePath))) await markBrainFresh(workspacePath);
        setStale(await brainStaleness(workspacePath));
      } else setStale(null);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (isOpen && !workspacePath) { setNotes([]); setAttachments([]); setBrain(null); return; }
    if (!isOpen || !workspacePath) return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY(workspacePath));
      setSettings(raw ? { ...DEFAULT_GRAPH_SETTINGS, ...JSON.parse(raw) } : DEFAULT_GRAPH_SETTINGS);
    } catch {
      setSettings(DEFAULT_GRAPH_SETTINGS);
    }
    // projeto novo: nada do anterior pode ficar na tela enquanto as notas são lidas
    setNotes([]); setAttachments([]); setBrain(null); setStale(null); setBroken(new Map()); setSuggestion(null);
    try { const sc = localStorage.getItem(`devflow_brain_scope:${workspacePath}`); setScopePref(sc === 'brain' || sc === 'project' ? sc : null); } catch { setScopePref(null); }
    try { setAutoUpdate(localStorage.getItem(AUTO_KEY) === '1'); } catch { setAutoUpdate(false); }
    autoRan.current = false;
    prevNodes.current = new Map();
    setActivePath(null);
    setBrainDirty(false);
    reload();
    loadProjectBrain(workspacePath, projectName).then((b) => { setBrain(b); setBrainDirty(false); }).catch(() => {});
  }, [isOpen, workspacePath, projectName, reload]);

  const updateSettings = (s: GraphSettings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY(workspacePath), JSON.stringify(s)); } catch {}
  };

  const graph = useMemo(() => {
    const g = buildGraph(notes, attachments, prevNodes.current);
    prevNodes.current = new Map(g.nodes.map((n) => [n.id, n]));
    return g;
  }, [notes, attachments]);

  const resolve = useMemo(() => buildResolver(notes), [notes]);
  const active = useMemo(() => notes.find((n) => n.path === activePath) || null, [notes, activePath]);

  useEffect(() => {
    setEditing(false);
    setDirty(false);
    setDraft(active?.content ?? '');
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.rel.toLowerCase().includes(q) || n.tags.some((x) => x.includes(q.replace(/^#/, '')))) : notes;
  }, [notes, query]);

  const saveNote = useCallback(async () => {
    if (!active || !dirty) return;
    const fs = (window as any).electronAPI?.fs;
    // editar uma nota da IA a torna do usuário: a IA deixa de sobrescrevê-la ou apagá-la
    const text = draft.replace(AI_NOTE_MARK, '').replace(/^\n+/, '');
    const res = await fs?.writeFile(active.path, text).catch(() => null);
    if (!res?.success) { onToast?.('Não foi possível salvar a nota'); return; }
    const { tags, links } = parseNote(text);
    setNotes((l) => l.map((n) => (n.path === active.path ? { ...n, content: text, tags, links } : n)));
    setDirty(false);
    logBrainActivity('salvar_nota', projectName || '', { nota: active.rel });
  }, [active, dirty, draft, onToast, projectName]);

  const createNote = async (rawName: string) => {
    const name = rawName.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.md$/i, '');
    if (!name) return null;
    const existing = resolve(name);
    if (existing) { setActivePath(existing.path); return existing; }
    const path = `${workspacePath.replace(/\/+$/, '')}/${BRAIN_NOTES_DIR}/${name}.md`;
    const content = newNoteTemplate(name);
    const res = await (window as any).electronAPI?.fs?.writeFile(path, content).catch(() => null);
    if (!res?.success) { onToast?.('Não foi possível criar a nota'); return null; }
    const note: VaultNote = { path, name, rel: `${BRAIN_NOTES_DIR}/${name}.md`, content, tags: [], links: [] };
    setNotes((l) => [...l, note].sort((a, b) => a.rel.localeCompare(b.rel)));
    setActivePath(path);
    setEditing(true);
    logBrainActivity('criar_nota', projectName || '', { nota: note.rel });
    return note;
  };

  const openLink = async (target: string) => {
    const hit = resolve(target);
    if (hit) setActivePath(hit.path);
    else await createNote(target);
  };

  const onGraphOpen = (n: GraphNode) => {
    if (n.kind === 'note') setActivePath(n.path);
    else if (n.kind === 'missing') openLink(n.label);
    else if (n.kind === 'tag') updateSettings({ ...settings, search: `tag:${n.label.slice(1)}` });
  };

  const rendered = useMemo(() => {
    if (!active) return null;
    const md = active.content.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(WIKI, (_m, target: string, alias?: string) => `[${(alias || target).trim()}](aura-note:${encodeURIComponent(target.trim())})`);
    return renderMarkdownPreview(md, { textPrimary: t.text, textSecondary: t.sub, textMuted: t.muted, border: t.divider, accentColor, isEffectiveDark, fontSize: 13, regularFont: true });
  }, [active, t, accentColor, isEffectiveDark]);

  const onPreviewClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href') || '';
    if (href.startsWith('aura-note:')) {
      e.preventDefault();
      e.stopPropagation();
      openLink(decodeURIComponent(href.slice('aura-note:'.length)));
    }
  };

  const saveBrain = async (patch: Partial<ProjectBrainContext>) => {
    if (!brain) return;
    const next = { ...brain, ...patch };
    setBrain(next);
    await saveProjectBrain(next);
    setBrainDirty(false);
    onToast?.('Contexto da IA salvo');
  };

  const rescanBrain = async () => {
    if (!workspacePath || rescanningBrain) return;
    setRescanningBrain(true);
    try {
      const scanned = await scanProjectCodebase(workspacePath, projectName);
      const merged: ProjectBrainContext = brain
        ? { ...scanned, aiDirectives: brain.aiDirectives || scanned.aiDirectives }
        : scanned;
      await saveProjectBrain(merged);
      setBrain(merged);
      setBrainDirty(false);
      onToast?.('Contexto do projeto reescaneado');
    } finally {
      setRescanningBrain(false);
    }
  };

  const isAiNote = (n: VaultNote) => n.content.includes(AI_NOTE_MARK);
  const aiNotes = notes.filter(isAiNote);

  /** Notas sem nenhuma ligação com outra nota (nem de entrada nem de saída): aparecem soltas no grafo. */
  const orphans = notes.filter((n) => !(graph.outgoing.get(n.path)?.length) && !(graph.backlinks.get(n.path)?.length));

  /** A IA liga as notas soltas às relacionadas; só notas geradas por ela recebem o [[link]] (as do usuário não são editadas). O que a IA não ligar vai para a "Visão geral". */
  const connectOrphans = async () => {
    if (!workspacePath || !orphans.length) return;
    if (linking) { linkCtl.current.abort?.('cancelado'); return; }
    setLinking(true);
    try {
      const fs = (window as any).electronAPI?.fs;
      const brief = (n: VaultNote) => `- ${n.name}: ${n.content.replace(AI_NOTE_MARK, '').replace(/\s+/g, ' ').trim().slice(0, 220)}`;
      const editable = notes.filter(isAiNote);
      const links: Array<{ from?: unknown; to?: unknown }> = [];
      if (editable.length) {
        const prompt = `Você cuida de um grafo de notas (estilo Obsidian) que mapeia um projeto de software. Algumas notas estão SOLTAS, sem ligação com nenhuma outra. Decida a quais notas cada uma deve se ligar, pelo que ela trata.

NOTAS SOLTAS:
${orphans.map(brief).join('\n')}

TODAS AS NOTAS:
${notes.map(brief).join('\n').slice(0, 20000)}

NOTAS EDITÁVEIS (só elas podem receber o link): ${editable.map((n) => n.name).join(', ')}

Para cada nota solta, proponha de 1 a 3 ligações no formato {"from": nota editável, "to": nota destino}. Se a solta for editável, ela pode ser o "from"; se não for, use como "from" uma editável relacionada e como "to" a solta. Use nomes exatos, sem inventar notas. Não explore arquivos.
Responda SOMENTE com JSON válido: {"links":[{"from":"nome","to":"nome"}]}`;
        try {
          const out = await runSiteAi({ prompt, provider: aiProvider, model: aiModel, cwd: workspacePath, effort: 'low', onText: () => {}, ctl: linkCtl.current });
          const m = (out || '').match(/\{[\s\S]*\}/);
          if (m) links.push(...(JSON.parse(m[0])?.links || []));
        } catch (e) {
          if ((e as Error)?.message === 'cancelado') throw e;
        }
      }
      const byName = new Map(notes.map((n) => [n.name.toLowerCase(), n]));
      const pending = new Map<string, Set<string>>();
      const queue = (from: VaultNote, to: VaultNote) => {
        if (from.path === to.path || !isAiNote(from)) return;
        if (from.links.some((l) => resolve(l)?.path === to.path)) return;
        pending.set(from.path, (pending.get(from.path) || new Set()).add(to.name));
      };
      for (const l of links) {
        const from = byName.get(String(l.from || '').trim().toLowerCase());
        const to = byName.get(String(l.to || '').trim().toLowerCase());
        if (from && to) queue(from, to);
      }
      // garantia: o que ainda ficaria solto liga na visão geral
      const hub = editable.find((n) => /vis[aã]o geral|overview|índice|indice/i.test(n.name)) || editable[0];
      if (hub) {
        const linked = new Set<string>();
        for (const [from, set] of pending) { linked.add(from); set.forEach((nm) => { const t = byName.get(nm.toLowerCase()); if (t) linked.add(t.path); }); }
        for (const o of orphans) if (!linked.has(o.path)) queue(hub, o);
      }
      let changed = 0;
      for (const [path, targets] of pending) {
        const note = notes.find((n) => n.path === path);
        if (!note) continue;
        const add = [...targets].map((nm) => `- [[${nm}]]`).join('\n');
        const body = /^#{1,3}\s*Rela[cç][oõ]es\s*$/im.test(note.content)
          ? note.content.replace(/(^#{1,3}\s*Rela[cç][oõ]es\s*$)/im, `$1\n${add}`)
          : `${note.content.trimEnd()}\n\n## Relações\n${add}\n`;
        const res = await fs?.writeFile?.(path, body).catch(() => null);
        if (res?.success) changed++;
      }
      if (!changed) { onToast?.('Nenhuma ligação nova para criar'); return; }
      await reload();
      logBrainActivity('conectar_nos_soltos', projectName || '', { notas: changed });
      onToast?.(`${orphans.length} notas soltas conectadas`);
    } catch {
      onToast?.('Não foi possível ajustar as ligações');
    } finally {
      setLinking(false);
    }
  };

  brainRef.current = brain;
  const syncCli = async () => {
    if (!workspacePath) return;
    const files = await syncBrainToCli(workspacePath, brain, notes, true);
    if (!files.length) { onToast?.('Não foi possível sincronizar com as CLIs'); return; }
    logBrainActivity('sincronizar_clis', projectName || '', { arquivos: files });
    onToast?.(`Brain sincronizado: ${files.join(', ')}`);
  };

  const deleteNotes = async (list: VaultNote[]) => {
    const fs = (window as any).electronAPI?.fs;
    for (const n of list) await fs?.deleteItem?.(n.path).catch(() => {});
    const gone = new Set(list.map((n) => n.path));
    setNotes((l) => l.filter((n) => !gone.has(n.path)));
    if (activePath && gone.has(activePath)) { setActivePath(null); setEditing(false); setDirty(false); }
  };

  const deleteNote = async (n: VaultNote) => {
    await deleteNotes([n]);
    setConfirmDel(null);
    logBrainActivity('excluir_nota', projectName || '', { nota: n.rel });
    onToast?.('Nota excluída');
  };

  /** Apaga só as notas geradas pela IA; as escritas ou editadas pelo usuário ficam. */
  const cleanAiNotes = async () => {
    if (!aiNotes.length) return;
    await deleteNotes(aiNotes);
    setConfirmDel(null);
    logBrainActivity('limpar_grafo_ia', projectName || '', { notas: aiNotes.length });
    onToast?.(`${aiNotes.length} notas da IA removidas`);
  };

  /** A IA lê o projeto e grava um mapa em notas .md ligadas por [[links]]: o grafo nasce delas e outras IAs leem o mapa em vez de reexplorar o código.
   *  'adjust' (padrão quando já existe mapa) revisa as notas atuais; 'fresh' descarta as da IA e recria do zero. */
  const generateGraphWithAi = async (mode: 'auto' | 'fresh' = 'auto') => {
    if (!workspacePath) return;
    if (mapping) { mapCtl.current.abort?.('cancelado'); return; }
    const adjust = mode === 'auto' && aiNotes.length > 0;
    // ajuste focado: a IA recebe o que mudou no projeto e as notas com arquivos que não existem mais
    const hint = adjust
      ? `${stale?.changed.length ? `\nARQUIVOS ALTERADOS DESDE A ÚLTIMA ATUALIZAÇÃO (${stale.commits} commits): ${stale.changed.join(', ')}. Revise primeiro as notas desses módulos.\n` : ''}${broken.size ? `\nNOTAS COM ARQUIVOS QUE NÃO EXISTEM MAIS:\n${[...broken].map(([path, files]) => `- ${notes.find((n) => n.path === path)?.name}: ${files.join(', ')}`).join('\n')}\nCorrija os caminhos ou remova as menções.\n` : ''}`
      : '';
    setMapping(true);
    try {
      const existing = adjust
        ? `\nMAPA ATUAL (notas já geradas; revise, não recomece do zero):\n${aiNotes.map((n) => `### ${n.name}\n${n.content.replace(AI_NOTE_MARK, '').trim()}`).join('\n\n').slice(0, 24000)}\n`
        : '';
      const prompt = `Você mapeia um projeto de software para que OUTRAS IAs entendam a arquitetura sem ler o código todo, gastando poucos tokens. Explore a pasta atual (package.json, README, estrutura de pastas, arquivos de entrada e módulos principais) com ferramentas de leitura. Não crie nem edite arquivos.
${existing}${hint}
${adjust
  ? 'AJUSTE o mapa atual conforme o código real: corrija notas desatualizadas, acrescente módulos que faltam, junte ou remova notas redundantes e conserte [[links]] quebrados. Devolva em "notes" só as notas novas ou alteradas (com o texto completo) e, em "remove", os nomes das notas que devem ser apagadas.'
  : 'Gere de 8 a 25 notas que formam um grafo de conhecimento, em Markdown, no estilo Obsidian.'}
- Uma nota "Visão geral" (ponto de entrada) que liga com [[links]] para as notas dos módulos principais.
- Uma nota por módulo, camada, fluxo ou conceito importante (ex.: processo principal, interface, serviços, banco de dados, autenticação, build e deploy, fluxo de dados).
- Cada nota: 2 a 4 frases sobre a função e as responsabilidades, uma lista "Arquivos-chave" com caminhos reais relativos à raiz, e "Relações" com [[links]] para as notas com que se conecta (use o nome exato de outra nota).
- Todo [[link]] deve apontar para uma nota existente. Adicione de 1 a 3 #tags curtas por nota (ex.: #backend #ui #infra).
- Nomes de nota curtos e únicos, sem barras nem extensão. Português do Brasil, sem emojis, fiel ao código real, sem inventar arquivos.

Responda SOMENTE com JSON válido, sem markdown em volta: {"notes":[{"name":"Visão geral","body":"texto em markdown da nota"}],"remove":["nome de nota a apagar"]}`;
      const out = await runSiteAi({ prompt, provider: aiProvider, model: aiModel, cwd: workspacePath, effort: 'medium', onText: () => {}, ctl: mapCtl.current });
      const m = (out || '').match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : null;
      const list: Array<{ name?: unknown; body?: unknown }> = parsed?.notes || [];
      const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.md$/i, '') : '');
      const fs = (window as any).electronAPI?.fs;
      const dir = `${workspacePath.replace(/\/+$/, '')}/${BRAIN_NOTES_DIR}`;
      await fs?.createItem?.(dir, true).catch(() => {});
      let written = 0;
      const kept = new Set<string>();
      for (const n of list.slice(0, 40)) {
        const name = clean(n.name);
        const body = typeof n.body === 'string' ? n.body.trim() : '';
        if (!name || !body) continue;
        const path = `${dir}/${name}.md`;
        // notas do usuário nunca são sobrescritas: só as que a IA gerou antes
        const prev = await fs?.readFile?.(path).catch(() => null);
        if (prev?.content && !prev.content.includes(AI_NOTE_MARK)) continue;
        const res = await fs?.writeFile?.(path, `${AI_NOTE_MARK}\n${body}\n`).catch(() => null);
        if (res?.success) { written++; kept.add(path); }
      }
      if (!written) { onToast?.('A IA não gerou notas'); return; }
      // recriar: some o que a IA tinha e não voltou; ajustar: some só o que ela mandou remover
      const drop = mode === 'fresh'
        ? aiNotes.filter((n) => !kept.has(n.path))
        : aiNotes.filter((n) => (Array.isArray(parsed?.remove) ? parsed.remove : []).map(clean).includes(n.name) && !kept.has(n.path));
      if (drop.length) await deleteNotes(drop);
      await markBrainFresh(workspacePath);
      await reload();
      setSide('notes');
      logBrainActivity(adjust ? 'ajustar_grafo_ia' : 'gerar_grafo_ia', projectName || '', { notas: written, removidas: drop.length });
      onToast?.(adjust ? `Grafo ajustado: ${written} notas, ${drop.length} removidas` : `Grafo gerado com ${written} notas`);
    } catch {
      onToast?.('Não foi possível gerar o grafo');
    } finally {
      setMapping(false);
    }
  };

  const suggestWithAi = async () => {
    if (!workspacePath || !brain) return;
    if (suggesting) { suggestCtl.current.abort?.('cancelado'); return; }
    setSuggesting(true);
    setSuggestion(null);
    try {
      const scanned = await scanProjectCodebase(workspacePath, projectName);
      const prompt = `Você analisa um projeto de software para preencher o "Brain", o contexto que todos os agentes de IA recebem antes de trabalhar nele. Explore a pasta atual (package.json, README, estrutura de pastas, arquivos principais) com ferramentas de leitura e proponha melhorias para o contexto abaixo. Não crie nem edite arquivos.

CONTEXTO ATUAL
${generateBrainAiContext(brain)}

SCAN AUTOMÁTICO
${generateBrainAiContext(scanned)}

Responda SOMENTE com um objeto JSON válido, sem markdown, com estas chaves (omita as que já estiverem boas):
{"summary": "objetivo e domínio do projeto em 2 a 4 frases", "architectureOverview": "como a arquitetura e os fluxos estão organizados", "modulesSummary": "módulos principais e o que cada um faz, em uma linha", "aiDirectives": "regras obrigatórias para os agentes, uma por linha, numeradas, específicas deste projeto", "techStack": ["tecnologias reais usadas, com versão quando souber"]}
Português do Brasil, sem emojis, fiel ao código real, sem inventar.`;
      const out = await runSiteAi({ prompt, provider: aiProvider, model: aiModel, cwd: workspacePath, effort: 'medium', onText: () => {}, ctl: suggestCtl.current });
      const m = (out || '').match(/\{[\s\S]*\}/);
      const raw = m ? JSON.parse(m[0]) : null;
      const next: BrainSuggestion = {};
      for (const k of ['summary', 'architectureOverview', 'modulesSummary', 'aiDirectives'] as const) {
        const v = typeof raw?.[k] === 'string' ? raw[k].trim() : '';
        if (v && v !== (brain[k] || '').trim()) next[k] = v;
      }
      if (Array.isArray(raw?.techStack)) {
        const add = raw.techStack.filter((x: unknown) => typeof x === 'string' && x.trim() && !brain.techStack.includes(x as string));
        if (add.length) next.techStack = add;
      }
      if (Object.keys(next).length) {
        setSuggestion(next);
        onToast?.('Sugestões da IA prontas');
      } else onToast?.('A IA não encontrou o que melhorar');
    } catch {
      onToast?.('Não foi possível gerar sugestões');
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (key: keyof BrainSuggestion) => {
    if (!brain || !suggestion || suggestion[key] === undefined) return;
    if (key === 'techStack') updateBrainField({ techStack: [...brain.techStack, ...(suggestion.techStack || [])] });
    else updateBrainField({ [key]: suggestion[key] } as Partial<ProjectBrainContext>);
    dropSuggestion(key);
  };
  const dropSuggestion = (key: keyof BrainSuggestion) =>
    setSuggestion((cur) => {
      if (!cur) return cur;
      const { [key]: _, ...rest } = cur;
      return Object.keys(rest).length ? rest : null;
    });

  const updateBrainField = (patch: Partial<ProjectBrainContext>) => {
    if (!brain) return;
    setBrain({ ...brain, ...patch });
    setBrainDirty(true);
  };

  const addTechTag = () => {
    const val = newTech.trim();
    if (!val || !brain) {
      setAddingTech(false);
      setNewTech('');
      return;
    }
    if (!brain.techStack.includes(val)) {
      updateBrainField({ techStack: [...brain.techStack, val] });
    }
    setNewTech('');
    setAddingTech(false);
  };

  const removeTechTag = (tag: string) => {
    if (!brain) return;
    updateBrainField({ techStack: brain.techStack.filter((x) => x !== tag) });
  };

  const copyPayload = async () => {
    if (!brain) return;
    try {
      await navigator.clipboard.writeText(generateBrainAiContext(brain));
      setCopiedPayload(true);
      onToast?.('Contexto copiado para a área de transferência');
      setTimeout(() => setCopiedPayload(false), 1800);
    } catch {}
  };

  // a IA do próprio Brain (gerar, sugerir, conectar) também acende o botão da header
  useEffect(() => {
    setBrainActivity('modal', mapping || suggesting || linking);
    return () => setBrainActivity('modal', false);
  }, [mapping, suggesting, linking]);

  // atualização automática (opcional): ao abrir, se o projeto andou o bastante, a IA ajusta o mapa uma vez
  useEffect(() => {
    if (!isOpen || !autoUpdate || mapping || autoRan.current || !aiNotes.length) return;
    if ((stale?.commits || 0) >= 5 || broken.size >= 3) {
      autoRan.current = true;
      generateGraphWithAi('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoUpdate, stale, broken, aiNotes.length, mapping]);

  if (!mounted) return null;

  const backlinks = active ? (graph.backlinks.get(active.path) || []).map((p) => notes.find((n) => n.path === p)).filter(Boolean) as VaultNote[] : [];
  const outgoing = active ? (graph.outgoing.get(active.path) || []).map((p) => notes.find((n) => n.path === p)).filter(Boolean) as VaultNote[] : [];
  const unresolved = active ? [...new Set(active.links.filter((l) => !resolve(l) && !/\.[a-z0-9]{1,5}$/i.test(l)))] : [];

  const btn: React.CSSProperties = { height: 30, borderRadius: 6, border: 'none', background: t.field, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px', fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400, transition: 'background 0.15s ease, color 0.15s ease' };
  const iconBtn: React.CSSProperties = { ...btn, width: 30, padding: 0 };
  const input: React.CSSProperties = { height: 30, padding: '0 10px', borderRadius: 6, border: 'none', outline: 'none', background: t.field, color: t.text, fontSize: 12, fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box', width: '100%' };
  const heading: React.CSSProperties = { fontSize: 11, color: t.muted, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 };
  const linkRow: React.CSSProperties = { fontSize: 12, color: t.sub, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: shown ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)', backdropFilter: shown ? 'blur(6px)' : 'none', transition: 'background 0.3s ease', WebkitAppRegion: 'no-drag' as any }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <TitleTooltips isDark={isEffectiveDark} />
      <button
        className="df-pressable"
        title="Fechar (Esc)"
        onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: shown ? 1 : 0, transition: 'opacity 0.3s ease' }}
      >
        <X size={18} />
      </button>

      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, top: 42,
          background: t.bg, color: t.text, borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: "'Poppins', -apple-system, sans-serif",
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* barra superior */}
        <div data-tour="brain-header" style={{ height: 38, padding: '0 12px', display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 12, flexShrink: 0, background: accentColor, color: getContrastTextColor(accentColor) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Brain size={18} strokeWidth={1.6} style={{ animation: mapping || suggesting ? 'brainPulse 1.1s ease-in-out infinite' : 'skin-menu-in 400ms var(--ease-out) both' }} />
            <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>Brain</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 0 }}>
            {projectName || workspacePath.split('/').filter(Boolean).pop()} · {notes.length} notas · {graph.links.length} links
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* lateral esquerda: notas e contexto da IA */}
          <div data-tour="brain-sidebar-tabs" style={{ width: 260, flexShrink: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 12, borderRight: `1px solid ${t.divider}`, minHeight: 0 }}>
            {side === 'ai' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {([['stack', 'Stack tecnológica', Layers], ['summary', 'Resumo do projeto', FileText], ['arch', 'Arquitetura e módulos', Network], ['rules', 'Diretrizes para as IAs', ListChecks], ['payload', 'O que as IAs recebem', Eye]] as const).map(([id, label, Icon]) => {
                  const on = aiSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="df-pressable"
                      onClick={() => setAiSection(id)}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = t.hover; }}
                      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                      style={{ height: 30, padding: '0 10px', borderRadius: 6, border: 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'inherit', fontWeight: on ? 500 : 400, cursor: 'pointer', textAlign: 'left', color: on ? t.text : t.sub, background: on ? t.hover : 'transparent', transition: 'background 0.15s ease, color 0.15s ease' }}
                    >
                      <Icon size={13} color={on ? accentColor : t.sub} /> {label}
                    </button>
                  );
                })}
              </div>
            ) : (
            <>
                <div style={{ display: 'flex', gap: 4, padding: 3, background: t.field, borderRadius: 6, height: 30, boxSizing: 'border-box', alignItems: 'center' }}>
                  {([['brain', 'Brain', 'Só as notas do Brain (.aura/brain)'], ['project', 'Projeto', 'Todos os arquivos .md do projeto']] as const).map(([id, label, tip]) => (
                    <button
                      key={id}
                      type="button"
                      className="df-pressable"
                      title={tip}
                      onClick={() => { setScopePref(id); setActivePath(null); try { localStorage.setItem(`devflow_brain_scope:${workspacePath}`, id); } catch {} }}
                      style={{ flex: 1, height: 24, borderRadius: 5, border: 'none', fontSize: 12, fontFamily: 'inherit', fontWeight: scope === id ? 500 : 400, cursor: 'pointer', color: scope === id ? t.text : t.sub, background: scope === id ? (isEffectiveDark ? '#2a2a2e' : '#ffffff') : 'transparent', transition: 'background 0.15s ease, color 0.15s ease' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={12} color={t.muted} style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input style={{ ...input, paddingLeft: 30 }} placeholder="Buscar notas ou #tags" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {creating && (
                  <input
                    autoFocus
                    style={input}
                    placeholder="Nome da nota"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                      if (e.key === 'Enter') { await createNote(newName); setCreating(false); setNewName(''); }
                    }}
                    onBlur={() => { setCreating(false); setNewName(''); }}
                  />
                )}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filtered.map((n, i) => {
                    const on = n.path === activePath;
                    const armed = confirmDel === n.path;
                    return (
                      <div
                        key={n.path}
                        onClick={() => setActivePath(n.path)}
                        title={n.rel}
                        onMouseEnter={(e) => { setHoverRow(n.path); if (!on) e.currentTarget.style.background = t.hover; }}
                        onMouseLeave={(e) => { setHoverRow(null); if (!on) e.currentTarget.style.background = 'transparent'; }}
                        style={{ padding: '5px 8px', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: on ? t.hover : 'transparent', transition: 'background 0.12s ease', animation: `brainRowIn 220ms var(--ease-out) ${Math.min(i, 12) * 22}ms both` }}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 12, color: on ? accentColor : t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                          {n.rel.includes('/') && <span style={{ fontSize: 10, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.rel.slice(0, n.rel.lastIndexOf('/'))}</span>}
                        </div>
                        {broken.has(n.path) && <span title={`Cita arquivos que não existem mais: ${broken.get(n.path)!.join(', ')}`} style={{ display: 'flex', flexShrink: 0 }}><AlertTriangle size={11} color="#f97316" /></span>}
                        {isAiNote(n) && <Sparkles size={10} color={t.muted} style={{ flexShrink: 0 }} />}
                        {(hoverRow === n.path || armed) && (
                          <button
                            type="button"
                            className="df-pressable"
                            title={armed ? 'Clique de novo para excluir' : 'Excluir nota'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (armed) deleteNote(n);
                              else { setConfirmDel(n.path); setTimeout(() => setConfirmDel((c) => (c === n.path ? null : c)), 3000); }
                            }}
                            style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: armed ? '#ef4444' : 'transparent', color: armed ? '#fff' : t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, animation: 'dfOpacityEnter 120ms ease both', transition: 'background 0.12s ease, color 0.12s ease' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!filtered.length && <div style={{ fontSize: 12, color: t.muted, padding: 8 }}>{loading ? 'Lendo notas...' : 'Nenhuma nota. Crie uma ou adicione arquivos .md ao projeto.'}</div>}
                </div>
            </>
            )}
          </div>

          {/* centro: grafo ou contexto da IA */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${t.divider}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4, padding: 3, background: t.field, borderRadius: 6, height: 30, boxSizing: 'border-box', alignItems: 'center' }}>
                {([['notes', 'Grafo', Brain], ['ai', 'Contexto IA', Sparkles]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className="df-pressable"
                    onClick={() => setSide(id)}
                    style={{
                      height: 24,
                      padding: '0 12px',
                      borderRadius: 5,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: side === id ? 500 : 400,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      color: side === id ? t.text : t.sub,
                      background: side === id ? (isEffectiveDark ? '#2a2a2e' : '#ffffff') : 'transparent',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    <Icon size={12} color={side === id ? accentColor : t.sub} /> {label}
                  </button>
                ))}
              </div>

              {side === 'notes' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AiGenerateButton
                    verb={aiNotes.length ? 'Ajustar grafo' : 'Gerar grafo'}
                    title="A IA analisa o projeto e monta o grafo em notas, para outras IAs gastarem menos tokens entendendo o projeto"
                    loading={mapping}
                    onGenerate={() => generateGraphWithAi()}
                    providers={aiProviders}
                    modelsByProvider={aiModelsByProvider}
                    provider={aiProvider}
                    model={aiModel}
                    onChangeProvider={(id) => onChangeAiProvider?.(id)}
                    onChangeModel={(id) => onChangeAiModel?.(id)}
                    accentColor={accentColor}
                    isDark={isEffectiveDark}
                    textPrimary={t.text}
                    textSecondary={t.sub}
                    fieldBg={t.field}
                    fieldBgHover={t.hover}
                  />
                  <button className="df-pressable" style={iconBtn} title="Sincronizar com as CLIs: escreve o índice do Brain num bloco do CLAUDE.md, AGENTS.md e GEMINI.md, para Claude Code, Codex e Gemini no terminal usarem o mapa" onClick={syncCli} onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.field; }}>
                    <Terminal size={13} />
                  </button>
                  {orphans.length > 0 && (
                    <button className="df-pressable" style={{ ...iconBtn, position: 'relative' }} title={linking ? 'Cancelar' : `Conectar ${orphans.length} nós soltos: a IA liga cada nota solta às relacionadas`} onClick={connectOrphans} onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.field; }}>
                      {linking ? <Loader2 size={13} color={accentColor} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Unlink size={13} />}
                      {!linking && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, borderRadius: 7, background: accentColor, color: getContrastTextColor(accentColor), fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', animation: 'dfOpacityEnter 160ms ease both' }}>{orphans.length}</span>}
                    </button>
                  )}
                  {aiNotes.length > 0 && !mapping && (
                    <>
                      <button className="df-pressable" style={iconBtn} title="Recriar o grafo do zero com a IA (as notas escritas por você ficam)" onClick={() => generateGraphWithAi('fresh')} onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }} onMouseLeave={(e) => { e.currentTarget.style.background = t.field; }}>
                        <ListRestart size={13} />
                      </button>
                      <button
                        className="df-pressable"
                        style={{ ...iconBtn, background: confirmDel === 'all' ? '#ef4444' : t.field, color: confirmDel === 'all' ? '#fff' : t.text }}
                        title={confirmDel === 'all' ? `Clique de novo para apagar ${aiNotes.length} notas da IA` : 'Limpar as notas geradas pela IA (as suas ficam)'}
                        onClick={() => { if (confirmDel === 'all') cleanAiNotes(); else { setConfirmDel('all'); setTimeout(() => setConfirmDel((c) => (c === 'all' ? null : c)), 3000); } }}
                      >
                        <Eraser size={13} />
                      </button>
                    </>
                  )}
                  <TutorialTriggerButton contextId="modal_brain" isDark={isEffectiveDark} accentColor={accentColor} textColor={t.text} mutedColor={t.sub} height={30} compact contextName={projectName || 'Brain'} />
                  <button className="df-pressable" style={iconBtn} title="Reler as notas do projeto" onClick={reload}>
                    <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <button className="df-pressable" style={{ ...iconBtn, background: accentColor, color: '#fff' }} title="Nova nota" onClick={() => { setSide('notes'); setCreating(true); }}>
                    <FilePlus2 size={13} />
                  </button>
                </div>
              )}
              {side === 'ai' && brain && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: t.muted, marginRight: 4 }}>
                    v{brain.version || 1} · {brain.nodes?.length || 0} nós · atualizado {new Date(brain.lastIndexedAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <AiGenerateButton
              verb="Sugerir"
              title="A IA analisa o projeto e sugere melhorias que você aceita ou recusa"
              loading={suggesting}
              onGenerate={suggestWithAi}
              providers={aiProviders}
              modelsByProvider={aiModelsByProvider}
              provider={aiProvider}
              model={aiModel}
              onChangeProvider={(id) => onChangeAiProvider?.(id)}
              onChangeModel={(id) => onChangeAiModel?.(id)}
              accentColor={accentColor}
              isDark={isEffectiveDark}
              textPrimary={t.text}
              textSecondary={t.sub}
              fieldBg={t.field}
              fieldBgHover={t.hover}
            />
                  <button
                    type="button"
                    className="df-pressable"
                    title="Reescanear arquivos, dependências e estrutura do projeto"
                    onClick={rescanBrain}
                    style={btn}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = t.field; }}
                  >
                    <RotateCcw size={12} style={{ animation: rescanningBrain ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <button
                    type="button"
                    className="df-pressable"
                    title="Copiar o payload completo enviado para os agentes de IA"
                    onClick={copyPayload}
                    style={btn}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.hover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = t.field; }}
                  >
                    {copiedPayload ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                  </button>
                  <button
                    type="button"
                    className="df-pressable"
                    title="Salvar alterações no contexto da IA (.devflow/brain.json)"
                    onClick={() =>
                      saveBrain({
                        summary: brain.summary,
                        architectureOverview: brain.architectureOverview,
                        modulesSummary: brain.modulesSummary,
                        aiDirectives: brain.aiDirectives,
                        techStack: brain.techStack,
                      })
                    }
                    style={{
                      ...btn,
                      background: accentColor,
                      color: getContrastTextColor(accentColor),
                      fontWeight: 500,
                      opacity: brainDirty ? 1 : 0.88,
                    }}
                  >
                    <Save size={12} />
                  </button>
                </div>
              )}
            </div>
            {side === 'notes' && aiNotes.length > 0 && (
              <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${t.divider}`, flexShrink: 0, fontSize: 11.5, color: t.sub, animation: 'brainFadeUp 220ms var(--ease-out) both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {(stale?.commits || 0) > 0 || broken.size > 0 ? <AlertTriangle size={12} color="#f97316" /> : <Check size={12} color="#22c55e" />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(stale?.commits || 0) > 0 || broken.size > 0
                      ? `${stale?.commits ? `${stale.commits} commits e ${stale.changed.length} arquivos mudaram desde a última atualização` : 'Mapa em dia com os commits'}${broken.size ? ` · ${broken.size} notas citam arquivos que não existem mais` : ''}`
                      : 'Mapa em dia com o projeto'}
                  </span>
                  {((stale?.commits || 0) > 0 || broken.size > 0) && !mapping && (
                    <button type="button" className="df-pressable" title="A IA revisa só o que mudou e corrige as notas defasadas" onClick={() => generateGraphWithAi('auto')} style={{ ...btn, height: 22, padding: '0 8px', fontSize: 11, background: accentColor, color: getContrastTextColor(accentColor), flexShrink: 0 }}>
                      <Sparkles size={11} /> Atualizar agora
                    </button>
                  )}
                </div>
                <label title="Ao abrir o Brain, a IA ajusta o mapa sozinha quando passaram 5 commits ou há notas quebradas (gasta tokens)" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                  Atualizar sozinho
                  <MiniSwitch checked={autoUpdate} accentColor={accentColor} onChange={() => { const next = !autoUpdate; setAutoUpdate(next); try { localStorage.setItem(AUTO_KEY, next ? '1' : '0'); } catch {} }} />
                </label>
              </div>
            )}
            <div key={side} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animation: 'brainFadeUp 240ms var(--ease-out) both' }}>
            {side === 'notes' ? (
              <VaultGraphView graph={graph} settings={settings} onSettings={updateSettings} activeId={activePath} onOpen={onGraphOpen} isDark={isEffectiveDark} accentColor={accentColor} tokens={t} />
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', justifyContent: 'center' }}>
                <div key={aiSection} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, animation: 'brainFadeUp 220ms var(--ease-out) both' }}>
                  {suggestion && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      {([
                        ['techStack', 'Stack tecnológica', 'stack'],
                        ['summary', 'Resumo do projeto', 'summary'],
                        ['architectureOverview', 'Visão arquitetural', 'arch'],
                        ['modulesSummary', 'Módulos principais', 'arch'],
                        ['aiDirectives', 'Diretrizes para as IAs', 'rules'],
                      ] as const).filter(([k, , sec]) => sec === aiSection && suggestion[k] !== undefined).map(([k, label]) => (
                        <div key={k} style={{ padding: 10, borderRadius: 6, background: t.field, display: 'flex', flexDirection: 'column', gap: 8, animation: 'skin-menu-in 180ms var(--ease-out) both' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ ...heading, color: accentColor }}><Sparkles size={12} color={accentColor} /> Sugestão da IA: {label}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="df-pressable" title="Descartar esta sugestão" onClick={() => dropSuggestion(k)} style={{ ...btn, height: 24, padding: '0 8px', fontSize: 11 }}><X size={11} /> Recusar</button>
                              <button type="button" className="df-pressable" title="Aplicar no campo (ainda precisa salvar o contexto)" onClick={() => acceptSuggestion(k)} style={{ ...btn, height: 24, padding: '0 8px', fontSize: 11, background: accentColor, color: getContrastTextColor(accentColor) }}><Check size={11} /> Aceitar</button>
                            </div>
                          </div>
                          {k === 'techStack' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(suggestion.techStack || []).map((x) => <span key={x} style={{ height: 24, padding: '0 8px', borderRadius: 6, background: t.hover, color: t.text, fontSize: 11.5, display: 'inline-flex', alignItems: 'center' }}>+ {x}</span>)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: t.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{suggestion[k] as string}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {aiSection === 'stack' && (<>
                  {/* Stack tecnológica editável */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={heading}>Stack tecnológica</span>
                    {!addingTech && (
                      <button
                        type="button"
                        className="df-pressable"
                        title="Adicionar tecnologia à stack do projeto"
                        onClick={() => setAddingTech(true)}
                        style={{ ...btn, height: 24, padding: '0 8px', fontSize: 11 }}
                      >
                        <Plus size={11} /> Adicionar
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {(brain?.techStack || []).map((tech) => (
                      <span
                        key={tech}
                        style={{
                          height: 26,
                          padding: '0 8px',
                          borderRadius: 6,
                          background: t.field,
                          color: t.text,
                          fontSize: 11.5,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{tech}</span>
                        <button
                          type="button"
                          title={`Remover ${tech}`}
                          onClick={() => removeTechTag(tech)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: t.muted,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {addingTech && (
                      <input
                        autoFocus
                        value={newTech}
                        onChange={(e) => setNewTech(e.target.value)}
                        placeholder="Ex: Tailwind CSS"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTechTag();
                          if (e.key === 'Escape') { setAddingTech(false); setNewTech(''); }
                        }}
                        onBlur={addTechTag}
                        style={{ ...input, width: 150, height: 26, fontSize: 11.5, padding: '0 8px' }}
                      />
                    )}
                  </div>

                  </>)}
                  {aiSection === 'summary' && (<>
                  {/* Resumo do projeto */}
                  <span style={heading}>Resumo do projeto</span>
                  <textarea
                    style={{ ...input, flex: 1, minHeight: 160, padding: 10, resize: 'none', lineHeight: 1.55 }}
                    placeholder="Descreva o objetivo principal e o domínio do projeto..."
                    value={brain?.summary || ''}
                    onChange={(e) => updateBrainField({ summary: e.target.value })}
                  />

                  </>)}
                  {aiSection === 'arch' && (<>
                  {/* Visão arquitetural e módulos */}
                  <span style={heading}>Visão arquitetural e módulos</span>
                  <textarea
                    style={{ ...input, flex: 1, minHeight: 160, padding: 10, resize: 'none', lineHeight: 1.55 }}
                    placeholder="Como a arquitetura e os fluxos de trabalho estão organizados..."
                    value={brain?.architectureOverview || ''}
                    onChange={(e) => updateBrainField({ architectureOverview: e.target.value })}
                  />
                  <input
                    style={{ ...input, flexShrink: 0 }}
                    placeholder="Módulos principais (ex: Modulos mapeados: src, electron, templates)"
                    value={brain?.modulesSummary || ''}
                    onChange={(e) => updateBrainField({ modulesSummary: e.target.value })}
                  />

                  </>)}
                  {aiSection === 'rules' && (<>
                  {/* Diretrizes para as IAs */}
                  <span style={heading}>Diretrizes para as IAs</span>
                  <textarea
                    style={{ ...input, flex: 1, minHeight: 160, padding: 10, resize: 'none', lineHeight: 1.55 }}
                    placeholder="Liste as regras obrigatórias que todos os agentes de IA devem seguir..."
                    value={brain?.aiDirectives || ''}
                    onChange={(e) => updateBrainField({ aiDirectives: e.target.value })}
                  />

                  </>)}
                  {aiSection === 'payload' && (<>
                  {/* O que as IAs recebem */}
                  <span style={heading}>O que as IAs recebem</span>
                  <pre
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      margin: 0,
                      padding: 12,
                      borderRadius: 6,
                      background: t.field,
                      color: t.sub,
                      fontSize: 11,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: "'JetBrains Mono', Menlo, monospace",
                    }}
                  >
                    {brain ? generateBrainAiContext(brain) : ''}
                  </pre>
                  </>)}
                </div>
              </div>
            )}
            </div>
          </div>


          {/* nota aberta */}
          {active && (
            <div key={active.path} style={{ width: 400, flexShrink: 0, borderLeft: `1px solid ${t.divider}`, display: 'flex', flexDirection: 'column', minHeight: 0, animation: 'brainSlideIn 240ms var(--ease-out) both' }}>
              <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${t.divider}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active.name}</div>
                  <div style={{ fontSize: 10, color: t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active.rel}</div>
                </div>
                {editing && dirty && <button className="df-pressable" style={{ ...btn, background: accentColor, color: '#fff' }} onClick={saveNote}><Save size={13} /> Salvar</button>}
                <button className="df-pressable" style={iconBtn} title={editing ? 'Ver nota' : 'Editar nota'} onClick={async () => { if (editing) await saveNote(); setEditing((e) => !e); }}>
                  {editing ? <Eye size={13} /> : <Pencil size={13} />}
                </button>
                <button className="df-pressable" style={iconBtn} title="Abrir no editor da IDE" onClick={() => { onOpenFile?.(active.path); onClose(); }}>
                  <ExternalLink size={13} />
                </button>
                <button
                  className="df-pressable"
                  style={{ ...iconBtn, background: confirmDel === active.path ? '#ef4444' : t.field, color: confirmDel === active.path ? '#fff' : t.text }}
                  title={confirmDel === active.path ? 'Clique de novo para excluir a nota' : 'Excluir nota'}
                  onClick={() => {
                    if (confirmDel === active.path) deleteNote(active);
                    else { setConfirmDel(active.path); setTimeout(() => setConfirmDel((c) => (c === active.path ? null : c)), 3000); }
                  }}
                >
                  <Trash2 size={13} />
                </button>
                <button className="df-pressable" style={iconBtn} title="Fechar nota" onClick={async () => { await saveNote(); setActivePath(null); }}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
                    onBlur={saveNote}
                    spellCheck={false}
                    style={{ ...input, height: '100%', minHeight: 300, padding: 10, resize: 'none', lineHeight: 1.6, fontFamily: "'JetBrains Mono', Menlo, monospace", fontSize: 12 }}
                  />
                ) : (
                  <div onClick={onPreviewClick}>{rendered}</div>
                )}
                {active.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {active.tags.map((tag) => (
                      <span key={tag} onClick={() => updateSettings({ ...settings, search: `tag:${tag}` })} style={{ fontSize: 11, color: accentColor, background: t.field, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Hash size={10} />{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${t.divider}`, paddingTop: 12 }}>
                  <span style={heading}><Link2 size={11} /> Menções ({backlinks.length})</span>
                  {backlinks.map((n) => <div key={n.path} style={linkRow} onClick={() => setActivePath(n.path)}><FileText size={11} />{n.name}</div>)}
                  {!backlinks.length && <span style={{ fontSize: 11, color: t.muted }}>Nenhuma nota aponta para esta.</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={heading}><Link2 size={11} /> Links de saída ({outgoing.length + unresolved.length})</span>
                  {outgoing.map((n) => <div key={n.path} style={linkRow} onClick={() => setActivePath(n.path)}><FileText size={11} />{n.name}</div>)}
                  {unresolved.map((l) => <div key={l} style={{ ...linkRow, color: t.muted }} title="Nota ainda não criada: clique para criar" onClick={() => openLink(l)}><FilePlus2 size={11} />{l}</div>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
