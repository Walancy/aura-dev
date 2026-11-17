import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Globe,
  ImagePlus,
  LayoutTemplate,
  Link2,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Settings2,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Plus,
  Undo2,
  X,
} from 'lucide-react';
import { AiChatTimeline } from '../ide/chat/AiChatTimeline';
import { PromptEditor, type PromptEditorRef } from '../PromptEditor';
import { AI_BRAND_COLORS, formatModelDisplayName } from '../../constants/ai';
import { hexToRgba, getContrastTextColor } from '../../utils/color';
import { renderMarkdownPreview } from '../../utils/markdown';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { PopupPortal, popupColors } from '../ui/PopupPortal';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { abortAllAiRequests } from '../design2/aiScreenFromLlm';
import { getFieldTokens } from '../../utils/fieldTokens';
import { logSystemActivity } from '../../utils/brainService';
import { GroupedModelMenu } from '../ui/GroupedModelMenu';
import { SITE_TEMPLATES, FREE_TEMPLATE_ID, freeTemplate, type SiteTemplate } from './siteTemplates';
import { postInspectorState, wrapForPreview, type SiteSelection } from './siteInspector';
import { ensureSiteTools, applyCutouts, applyAssets } from './siteTools';
import { inspectSiteHtml } from './siteQuality';
import { applyPhotos } from './siteImages';
import { SiteSettingsPopup } from './SiteSettingsPopup';
import { finalizeSiteHtml, type SiteSettings } from './siteSeo';
import { buildCreatePrompt, buildEditPrompt, runSiteAi, expandSiteBrief, withBrief, BRIEF_MAX_CHARS, buildPolishPrompt, needsReviewPass, wantsAttachedImage, type SiteReference } from './siteAi';
import { AiChatMessageQueue } from '../ide/chat/AiChatMessageQueue';
import { ImageLightbox } from '../ui/ImageLightbox';
import { templateSampleHtml } from './siteTemplateSample';
import {
  backupSiteHtml,
  createSite,
  deleteCustomTemplate,
  deleteSite,
  historyCount,
  listCustomTemplates,
  listSites,
  readChat,
  readSiteHtml,
  siteDir,
  sitesRoot,
  undoSiteHtml,
  writeChat,
  writeMeta,
  writeSiteHtml,
  type SiteChatMessage,
  type SiteMeta,
  shrinkImage,
} from './siteStore';

interface Props {
  isActive: boolean;
  projectName?: string;
  selectedAiProvider: string;
  selectedModel?: string;
  themeTokens: any;
  accentColor: string;
  /** cor do chat da IA (a mesma do chat da IDE) */
  chatAccentColor?: string;
  isEffectiveDark: boolean;
  aiProviders: Array<{ id: string; name: string }>;
  aiModelsByProvider: Record<string, Array<{ id: string; label: string }>>;
  onChangeAiProvider: (id: string) => void;
  onChangeAiModel: (modelId: string) => void;
  onAiTaskDone?: (r: { ok: boolean; message: string; workspace: string }) => void;
  showToast?: (message: string) => void;
}

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, number | undefined> = { desktop: undefined, tablet: 820, mobile: 390 };


const fmtDuration = (ms: number) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

/** Nome do site a partir da descrição: as primeiras palavras, sem pontuação. */
function nameFromDescription(desc: string, fallback: string): string {
  const words = desc.replace(/[\n\r]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const name = words.join(' ');
  return name.length >= 3 ? name.charAt(0).toUpperCase() + name.slice(1) : fallback;
}

interface QueuedSiteRun {
  id: string;
  text: string;
  siteId: string | null;
  refs: Array<{ id: string; kind: 'url' | 'image'; label: string; url?: string; dataUrl?: string }>;
  selection: SiteSelection[];
  ts: number;
}

export default function SitesStudioView({
  isActive,
  projectName,
  selectedAiProvider,
  selectedModel,
  themeTokens,
  accentColor,
  chatAccentColor: chatAccentProp,
  isEffectiveDark,
  aiProviders,
  aiModelsByProvider,
  onChangeAiProvider,
  onChangeAiModel,
  onAiTaskDone,
  showToast,
}: Props) {
  const ft = getFieldTokens(isEffectiveDark);
  const pc = popupColors(isEffectiveDark);
  const divider = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const subtle = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const subtleHover = isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  // ---- sites e preview
  const [sites, setSites] = useState<SiteMeta[]>([]);
  const [current, setCurrent] = useState<SiteMeta | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [root, setRoot] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [inspect, setInspect] = useState(false);
  const [mode, setMode] = useState<'section' | 'element'>('section');
  const [selection, setSelection] = useState<SiteSelection[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // ---- painel esquerdo
  const [leftTab, setLeftTab] = useState<'models' | 'sites'>('models');
  const [search, setSearch] = useState('');
  const [pendingTemplate, setPendingTemplate] = useState<SiteTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = useState<SiteTemplate[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<SiteMeta | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<SiteTemplate | null>(null);

  // ---- chat
  const [chatOpen, setChatOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [messages, setMessages] = useState<SiteChatMessage[]>([]);
  const editorRef = useRef<PromptEditorRef>(null);
  const [hasText, setHasText] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [refs, setRefs] = useState<Array<{ id: string; kind: 'url' | 'image'; label: string; url?: string; dataUrl?: string }>>([]);
  const [refOpen, setRefOpen] = useState(false);
  const [refUrl, setRefUrl] = useState('');
  const refAnchor = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const providerAnchor = useRef<HTMLDivElement>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [chatWidth, setChatWidth] = useState(340);
  const [draggingChat, setDraggingChat] = useState(false);
  const [busy, setBusy] = useState(false);
  // pedidos feitos enquanto a IA gera: rodam em sequência quando ela termina
  const [queue, setQueue] = useState<QueuedSiteRun[]>([]);
  const runRef = useRef<(t?: string, q?: QueuedSiteRun) => Promise<void>>(async () => {});
  const [live, setLive] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<{ abort?: (why?: string) => void }>({});
  const currentRef = useRef<SiteMeta | null>(null);
  currentRef.current = current;

  const refreshSites = useCallback(async () => {
    const list = await listSites();
    setSites(list);
    return list;
  }, []);

  const openSite = useCallback(async (meta: SiteMeta | null) => {
    setCurrent(meta);
    setSelection([]);
    setPendingTemplate(null);
    if (!meta) {
      setHtml(null);
      setMessages([]);
      setCanUndo(false);
      return;
    }
    const [h, chat, hist] = await Promise.all([readSiteHtml(meta.id), readChat(meta.id), historyCount(meta.id)]);
    setHtml(h);
    setMessages(chat);
    setCanUndo(hist > 0);
    setPreviewKey((k) => k + 1);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const list = await listCustomTemplates();
    setCustomTemplates(list.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, colors: t.colors, brief: t.brief, custom: true })));
  }, []);

  useEffect(() => {
    (async () => {
      setRoot(await sitesRoot());
      refreshTemplates();
      const list = await refreshSites();
      if (list[0]) openSite(list[0]);
      else if (SITE_TEMPLATES[0]) setPendingTemplate(SITE_TEMPLATES[0]);
    })();
  }, [refreshSites, openSite, refreshTemplates]);

  // conversa salva na pasta do site
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => writeChat(current.id, messages), 400);
    return () => clearTimeout(t);
  }, [messages, current]);

  // fecha o menu de IA/modelo ao clicar fora (sem camada fixa: o blur do compositor quebraria o position:fixed)
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (providerAnchor.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
      setActiveSub(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, live]);

  // ---- inspetor do preview
  const inspectorState = useMemo(() => ({ enabled: inspect && !busy, mode, accent: accentColor, selected: selection.map((s) => s.path) }), [inspect, busy, mode, accentColor, selection]);
  useEffect(() => {
    postInspectorState(frameRef.current, inspectorState);
  }, [inspectorState, previewKey]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'aura-ready') postInspectorState(frameRef.current, inspectorState);
      else if (d.type === 'aura-select' && Array.isArray(d.items)) setSelection(d.items);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [inspectorState]);

  // quando o usuário escolhe um modelo no painel esquerdo, limpamos a seleção anterior
  const selectTemplate = useCallback((t: SiteTemplate) => {
    setSelection([]);
    setPendingTemplate((prev) => {
      const next = prev?.id === t.id ? null : t;
      if (next) setPreviewKey((k) => k + 1);
      return next;
    });
  }, []);

  const srcDoc = useMemo(() => (html && current && !pendingTemplate ? wrapForPreview(html, `file://${siteDir(root, current.id)}/`) : ''), [html, current, pendingTemplate, root]);
  // preview do modelo escolhido (com inspetor ativo para que Seções/Elementos, Reload, Abrir no navegador e Download funcionem também no modelo)
  const sampleRawHtml = useMemo(() => (pendingTemplate?.sample ? templateSampleHtml(pendingTemplate) : ''), [pendingTemplate]);
  const sampleDoc = useMemo(() => (sampleRawHtml ? wrapForPreview(sampleRawHtml) : ''), [sampleRawHtml]);
  const activeHtml = pendingTemplate ? sampleRawHtml || null : html;
  const activePreviewDoc = srcDoc || sampleDoc;
  const sidebarWidth = 280;
  const thumbWidth = sidebarWidth - 16 - 12;
  const thumbHeight = 148;

  // ---- IA
  const pushAi = (m: Partial<SiteChatMessage> & { id: string }) =>
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));

  /** Pedido curto vira um briefing completo em segundo plano; se falhar, segue com o texto original (só cancelamento interrompe). */
  const enrichRequest = async (text: string, workspace: string, hasRefs: boolean): Promise<string> => {
    if (hasRefs || text.length > BRIEF_MAX_CHARS) return text;
    setLive('Planejando o site...');
    try {
      const brief = await expandSiteBrief({ description: text, projectName, provider: selectedAiProvider, model: selectedModel, cwd: workspace, ctl: ctlRef.current });
      return withBrief(text, brief);
    } catch (e: any) {
      if (/cancelad/i.test(e?.message || '')) throw e;
      return text;
    }
  };

  /**
   * Passada de acabamento depois da criação: a checagem estática acha arquivo cortado/sem animação/sem responsivo e, com CLIs que
   * entregam menos numa passada só (Antigravity etc.), a IA ainda faz uma revisão crítica. Se a versão revisada ficar pior, volta à anterior.
   */
  const polishPass = async (siteId: string, siteName: string, request: string, workspace: string, reference?: SiteReference) => {
    const before = await readSiteHtml(siteId);
    if (!before) return;
    // auditoria visual: renderiza em desktop/tablet/celular, mede problemas reais e salva capturas em _check/ para a IA ver
    setLive('Conferindo o site em 3 larguras...');
    const audit = await window.electronAPI?.fs?.auditSite?.(workspace).catch(() => null);
    const issues = [...inspectSiteHtml(before), ...(audit?.issues || [])];
    const checkShots = audit?.shots || [];
    const hasRef = !!reference && (reference.pages.length > 0 || reference.images.length > 0);
    const full = needsReviewPass(selectedAiProvider) || hasRef;
    if (!issues.length && !full) return;
    setLive(hasRef ? 'Comparando com a referência...' : issues.length ? 'Corrigindo problemas encontrados...' : 'Revisando o design...');
    try {
      await runSiteAi({ prompt: buildPolishPrompt({ siteName, request, issues, full, reference, checkShots }), provider: selectedAiProvider, model: selectedModel, cwd: workspace, effort: 'high', ctl: ctlRef.current, onText: () => {} });
      const after = await readSiteHtml(siteId);
      const worse = !after || inspectSiteHtml(after).length > issues.length || after.length < before.length * 0.7;
      if (worse) await writeSiteHtml(siteId, before);
    } catch (e: any) {
      if (/cancelad/i.test(e?.message || '')) throw e;
      await writeSiteHtml(siteId, before);
    }
  };

  const run = useCallback(
    async (overrideText?: string, queued?: QueuedSiteRun) => {
      const raw = (overrideText ?? editorRef.current?.getValue() ?? '').trim();
      const usedRefs = queued ? queued.refs : refs;
      const usedSel = queued ? queued.selection : selection;
      const text = raw || (usedRefs.length ? 'Recrie o visual da referência para o meu negócio.' : '');
      if (!text || busy) return;
      let site = current;
      // sem modelo escolhido, a IA cria do zero inspirada no catálogo (com ou sem referência)
      // imagem anexada + "use essa imagem no site": ela vira conteúdo do site (data-asset), não referência de layout
      const assetMode = usedRefs.some((r) => r.kind === 'image') && wantsAttachedImage(text);
      const asReference = usedRefs.some((r) => r.kind === 'url') || (usedRefs.some((r) => r.kind === 'image') && !assetMode);
      const template = pendingTemplate || (!site ? freeTemplate(asReference) : null);
      const creating = !!template;
      const userMsg: SiteChatMessage = {
        id: `u${Date.now()}`,
        role: 'user',
        text,
        ts: Date.now(),
        selection: usedSel.length ? usedSel.map((s) => s.label) : undefined,
        refs: usedRefs.map((r) => r.label),
        refImages: usedRefs.some((r) => r.dataUrl) ? await Promise.all(usedRefs.map((r) => (r.dataUrl ? shrinkImage(r.dataUrl) : Promise.resolve(null)))) : undefined,
      };
      const aiId = `a${Date.now()}`;
      if (!queued) {
        editorRef.current?.clear();
        setHasText(false);
        setRefs([]);
      }
      setBusy(true);
      setLive('');
      const started = Date.now();
      let workspace = '';
      try {
        let promptText: string;
        let refInfo: SiteReference | undefined;
        if (creating) {
          const tpl = template!;
          site = await createSite({ name: nameFromDescription(text, tpl.name), templateId: tpl.id, templateName: tpl.name, project: projectName });
          // o esqueleto do modelo já fica visível enquanto a IA o transforma no site real
          const skeleton = tpl.sample ? templateSampleHtml(tpl) : null;
          if (skeleton) await writeSiteHtml(site.id, skeleton);
          setPendingTemplate(null);
          await refreshSites();
          setCurrent(site);
          setHtml(skeleton);
          setPreviewKey((k) => k + 1);
          setMessages([userMsg, { id: aiId, role: 'ai', text: '', ts: Date.now() }]);
          workspace = siteDir(root || (await sitesRoot()), site.id);
          const reference = await prepareReference(workspace, usedRefs);
          refInfo = reference;
          promptText = buildCreatePrompt({ brief: tpl.brief, templateName: tpl.name, description: tpl.id === FREE_TEMPLATE_ID ? await enrichRequest(text, workspace, usedRefs.length > 0) : text, siteName: site.name, projectName, hasSkeleton: !!skeleton, custom: !!tpl.custom, free: tpl.id === FREE_TEMPLATE_ID, reference, selection: usedSel });
        } else {
          setMessages((prev) => [...prev, userMsg, { id: aiId, role: 'ai', text: '', ts: Date.now() }]);
          await backupSiteHtml(site!.id);
          workspace = siteDir(root || (await sitesRoot()), site!.id);
          const reference = await prepareReference(workspace, usedRefs);
          refInfo = reference;
          promptText = buildEditPrompt({ request: site!.templateId === 'blank' && messages.length === 0 ? await enrichRequest(text, workspace, usedRefs.length > 0) : text, selection: usedSel, siteName: site!.name, reference, blank: site!.templateId === 'blank' && messages.length === 0 });
        }
        await ensureSiteTools().catch(() => {});
        let streamed = '';
        const answer = await runSiteAi({
          prompt: promptText,
          provider: selectedAiProvider,
          model: selectedModel,
          cwd: workspace,
          effort: creating && template?.id === FREE_TEMPLATE_ID ? 'high' : undefined,
          ctl: ctlRef.current,
          onText: (t) => {
            streamed += t;
            const line = streamed.trim().split('\n').pop() || '';
            setLive(line.length > 90 ? `…${line.slice(-90)}` : line);
          },
        });
        if (creating || (site!.templateId === 'blank' && messages.length === 0)) await polishPass(site!.id, site!.name, text, workspace, asReference ? refInfo : undefined);
        // imagens anexadas pelo usuário que a IA marcou para uso (data-asset / asset:nome): embute o arquivo de _reference/
        if (/\bdata-asset\s*=|asset:[\w.-]+\.(png|jpe?g|webp|gif|avif)/i.test((await readSiteHtml(site!.id)) || '')) {
          setLive('Inserindo a imagem anexada...');
          const as = await applyAssets(site!.id).catch(() => ({ ok: 0, miss: 0 }));
          if (as.miss) showToast?.(`Não encontrei ${as.miss} imagem(ns) anexada(s) citada(s) no site.`);
        }
        // <img data-photo="..."> : o app busca as fotos reais (a IA só descreve); depois vêm os recortes
        if (/\bdata-photo\s*=/i.test((await readSiteHtml(site!.id)) || '')) {
          setLive('Buscando as fotos...');
          const ph = await applyPhotos(site!.id).catch(() => ({ ok: 0, fail: 0, hasKey: true }));
          if (ph.fail) showToast?.(`Não encontrei ${ph.fail} foto(s); o espaço ficou com o fundo de reserva.`);
          else if (ph.ok && !ph.hasKey) showToast?.('Fotos do Wikimedia (sem chave). Para fotos melhores, informe as chaves do Unsplash e do Pexels em Design > Imagens.');
        }
        // imagens marcadas com data-cutout: o app remove o fundo (a IA não mexe em base64)
        if (/<img[^>]*\bdata-cutout\b/i.test((await readSiteHtml(site!.id)) || '')) {
          setLive('Removendo o fundo das imagens...');
          const cut = await applyCutouts(site!.id).catch(() => ({ ok: 0, fail: 0 }));
          if (cut.fail) showToast?.(`Não consegui remover o fundo de ${cut.fail} imagem(ns); mantive a foto original.`);
        }
        const newHtml = await readSiteHtml(site!.id);
        if (!newHtml) throw new Error('A IA terminou, mas o index.html não foi criado. Tente de novo.');
        setHtml(newHtml);
        if (!queued) setSelection([]);
        setPreviewKey((k) => k + 1);
        const meta = { ...site!, updatedAt: Date.now() };
        await writeMeta(meta);
        setCurrent(meta);
        await refreshSites();
        if (!creating) setCanUndo(true);
        const summary = (answer || streamed).trim() || (creating ? 'Site criado.' : 'Site atualizado.');
        pushAi({ id: aiId, text: summary, workedDuration: fmtDuration(Date.now() - started) });
        logSystemActivity('sites', creating ? 'criar_site' : 'editar_site', site!.name, { template: site!.templateId, selecao: usedSel.map((s) => s.label) });
        onAiTaskDone?.({ ok: true, message: summary.slice(0, 160), workspace });
      } catch (err: any) {
        const msg = err?.message || 'Falha inesperada';
        pushAi({ id: aiId, text: msg, error: true, workedDuration: fmtDuration(Date.now() - started) });
        if (!/cancelad/i.test(msg)) onAiTaskDone?.({ ok: false, message: msg, workspace });
      } finally {
        setBusy(false);
        setLive('');
        ctlRef.current = {};
      }
    },
    [refs, busy, current, pendingTemplate, selection, projectName, root, selectedAiProvider, selectedModel, refreshSites, onAiTaskDone, showToast],
  );

  /** Captura a URL e copia os screenshots para _reference/ dentro da pasta do site; a IA lê dali. */
  const prepareReference = async (workspace: string, list: typeof refs): Promise<SiteReference | undefined> => {
    if (!list.length) return undefined;
    setLive('Preparando a referência...');
    const api = (window as any).electronAPI?.fs;
    const dir = `${workspace}/_reference`;
    await api?.createItem(dir, true);
    const out: SiteReference = { pages: [], images: [] };
    let n = 0;
    for (const r of list) {
      if (r.kind === 'url' && r.url) {
        setLive(`Capturando ${r.label}...`);
        const res = await api?.captureSiteReference?.(r.url, workspace);
        if (!res || res.error) throw new Error(`Não consegui abrir ${r.label}: ${res?.error || 'captura indisponível (reinstale o app).'}`);
        out.pages.push({ host: res.host || r.label, url: r.url, shots: res.shots || [], hasCss: !!res.hasCss, three: !!res.three?.detected });
      } else if (r.dataUrl) {
        const m = /^data:image\/(\w+);base64,(.+)$/.exec(r.dataUrl);
        if (!m) continue;
        const tmp = await api?.saveTempImage(m[2], m[1] === 'jpeg' ? 'jpg' : m[1]);
        if (!tmp?.path) continue;
        const name = `user-${++n}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
        await api?.copyItem(tmp.path, `${dir}/${name}`);
        out.images.push(name);
      }
    }
    setLive('');
    return out;
  };

  const addImageRef = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setRefs((prev) => (prev.filter((r) => r.kind === 'image').length >= 4 ? prev : [...prev, { id: `i${Date.now()}${Math.random().toString(36).slice(2, 5)}`, kind: 'image', label: file.name || 'screenshot', dataUrl: String(reader.result) }]));
    };
    reader.readAsDataURL(file);
  };

  const pickScreenshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => Array.from(input.files || []).forEach(addImageRef);
    input.click();
  };

  const addUrlRef = () => {
    let u = refUrl.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
      const host = new URL(u).host;
      setRefs((prev) => [...prev.filter((r) => r.kind !== 'url'), { id: `u${Date.now()}`, kind: 'url', label: host, url: u }]);
      setRefUrl('');
      setRefOpen(false);
      editorRef.current?.focus();
    } catch {
      showToast?.('Endereço inválido.');
    }
  };

  runRef.current = run;

  /** Com a IA ocupada, o pedido (com referências e seleção) entra na fila em vez de ser enviado. */
  const enqueue = (overrideText?: string) => {
    const text = (overrideText ?? editorRef.current?.getValue() ?? '').trim();
    if (!text && !refs.length) return;
    setQueue((q) => [...q, { id: `q${Date.now()}${Math.random().toString(36).slice(2, 5)}`, text: text || 'Recrie o visual da referência para o meu negócio.', siteId: current?.id ?? null, refs, selection, ts: Date.now() }]);
    editorRef.current?.clear();
    setHasText(false);
    setRefs([]);
    setSelection([]);
  };

  useEffect(() => {
    if (busy || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    // o site mudou enquanto o pedido esperava: não aplica a edição em outro site
    if (next.siteId && next.siteId !== current?.id) return;
    runRef.current(next.text, next);
  }, [busy, queue, current?.id]);

  const stop = () => {
    setQueue([]);
    ctlRef.current.abort?.('cancelado');
    abortAllAiRequests('cancelado');
  };

  const undo = async () => {
    if (!current || busy) return;
    const h = await undoSiteHtml(current.id);
    if (h === null) return;
    setHtml(h);
    setSelection([]);
    setPreviewKey((k) => k + 1);
    setCanUndo((await historyCount(current.id)) > 0);
    logSystemActivity('sites', 'desfazer_edicao', current.name);
  };

  const removeSite = async (meta: SiteMeta) => {
    await deleteSite(meta.id);
    logSystemActivity('sites', 'excluir_site', meta.name);
    const list = await refreshSites();
    if (current?.id === meta.id) openSite(list[0] || null);
    setConfirmDelete(null);
  };

  const newBlankSite = async () => {
    if (busy) return;
    const meta = await createSite({ name: 'Novo site', templateId: 'blank', templateName: 'Em branco', project: projectName });
    await writeSiteHtml(meta.id, '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Novo site</title>\n<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#8a8a8a;background:#fff}</style>\n</head>\n<body>\n<main><section id="inicio">Projeto em branco. Descreva o site no chat.</section></main>\n</body>\n</html>\n');
    await refreshSites();
    await openSite(meta);
    setLeftTab('sites');
    logSystemActivity('sites', 'criar_site_em_branco', meta.name);
  };

  const settingsAnchor = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveSettings = async (v: SiteSettings) => {
    if (!current) return;
    const meta = { ...current, domain: v.domain, gaId: v.gaId, clarityId: v.clarityId, updatedAt: Date.now() };
    await writeMeta(meta);
    setCurrent(meta);
    refreshSites();
    showToast?.('Configurações do site salvas');
    logSystemActivity('sites', 'configurar_site', meta.name, { dominio: v.domain, analytics: !!v.gaId, clarity: !!v.clarityId });
  };

  const renameSite = async (name: string) => {
    if (!current || !name.trim()) return;
    const meta = { ...current, name: name.trim(), updatedAt: Date.now() };
    await writeMeta(meta);
    setCurrent(meta);
    refreshSites();
    logSystemActivity('sites', 'renomear_site', meta.name);
  };

  const exportHtml = async () => {
    const base = activeHtml;
    if (!base) return;
    const content = !pendingTemplate && current ? finalizeSiteHtml(base, current) : base;
    const fileName = pendingTemplate ? `${pendingTemplate.id}.html` : `${current?.id || 'site'}.html`;
    const api = (window as any).electronAPI;
    try {
      const home: string = (await api?.fs?.getHomeDir?.()) || '';
      const target = `${home}/Downloads/${fileName}`;
      await api.fs.writeFile(target, content);
      api.shell?.showItemInFolder?.(target);
      showToast?.(`Salvo em Downloads: ${fileName}`);
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    logSystemActivity('sites', 'exportar_site', pendingTemplate?.name || current?.name || 'site');
  };

  const reloadPreview = async () => {
    setSelection([]);
    if (!pendingTemplate && current) setHtml(await readSiteHtml(current.id));
    setPreviewKey((k) => k + 1);
    showToast?.('Preview recarregado');
  };

  const openInBrowser = async () => {
    if (!activeHtml) return;
    const api = (window as any).electronAPI;
    if (!pendingTemplate && current) {
      const res = await api?.shell?.openExternal?.(`file://${siteDir(root || (await sitesRoot()), current.id)}/index.html`);
      if (res && res.success === false) showToast?.('Não foi possível abrir no navegador.');
      return;
    }
    if (pendingTemplate) {
      const r = root || (await sitesRoot());
      const previewPath = `${r}/_preview-${pendingTemplate.id}.html`;
      await api?.fs?.createItem?.(r, true);
      await api?.fs?.writeFile?.(previewPath, activeHtml);
      api?.shell?.openExternal?.(`file://${previewPath}`);
    }
  };

  const removeCustomTemplate = async (t: SiteTemplate) => {
    await deleteCustomTemplate(t.id);
    logSystemActivity('sites', 'excluir_modelo', t.name);
    if (pendingTemplate?.id === t.id) setPendingTemplate(null);
    refreshTemplates();
    setConfirmDeleteTemplate(null);
  };

  // ---- derivados
  const chatAccent = chatAccentProp || AI_BRAND_COLORS[selectedAiProvider] || accentColor;
  const siteIdx = sites.findIndex((x) => x.id === current?.id);
  const saveFile = (name: string, content: string, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportChatMd = () => saveFile(`${current?.id || 'site'}-chat.md`, messages.map((m) => `**${m.role === 'user' ? 'Você' : 'IA'}** (${new Date(m.ts).toLocaleString()})\n\n${m.text}\n`).join('\n'), 'text/markdown');
  const exportChatJson = () => saveFile(`${current?.id || 'site'}-chat.json`, JSON.stringify(messages, null, 2), 'application/json');
  const q = search.trim().toLowerCase();
  const matches = (t: SiteTemplate) => !q || `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q);
  const templates = SITE_TEMPLATES.filter(matches);
  const myTemplates = customTemplates.filter(matches);
  const siteList = sites.filter((s) => !q || `${s.name} ${s.templateName}`.toLowerCase().includes(q));
  const claudeTip = selectedAiProvider !== 'claude' && aiProviders.some((p) => p.id === 'claude');
  const providerName = aiProviders.find((p) => p.id === selectedAiProvider)?.name || selectedAiProvider;
  const modelLabel = (aiModelsByProvider[selectedAiProvider] || []).find((m) => m.id === selectedModel)?.label || selectedModel || null;
  const placeholder = pendingTemplate
    ? `Descreva o site para criar com o modelo ${pendingTemplate.name}: negócio, público, tom e seções`
    : selection.length
      ? `Peça a alteração em ${selection.length === 1 ? selection[0].label : `${selection.length} elementos`}...`
      : current
        ? 'Peça uma alteração, selecione uma seção no preview ou anexe uma referência (URL ou screenshot)'
        : 'Descreva o site para a IA criar do zero (inspirada nos modelos), escolha um modelo à esquerda ou anexe uma referência';
  const canSend = hasText || refs.length > 0;

  // ---- estilos
  const panel: React.CSSProperties = { background: themeTokens.bgCard, borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box' };
  const ctrl = (on = false): React.CSSProperties => ({
    height: 30,
    minWidth: 30,
    padding: '0 8px',
    borderRadius: 6,
    border: 'none',
    background: on ? accentColor : subtle,
    color: on ? '#fff' : themeTokens.textPrimary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 150ms ease, color 150ms ease, transform 140ms var(--ease-out)',
  });
  const tabBtn = (on: boolean): React.CSSProperties => ({
    height: 30,
    padding: '0 10px',
    borderRadius: 6,
    border: 'none',
    background: on ? subtleHover : 'transparent',
    color: on ? themeTokens.textPrimary : themeTokens.textSecondary,
    fontSize: 12,
    fontWeight: 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 150ms ease, color 150ms ease',
  });
  const hoverable = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (e.currentTarget.dataset.on !== '1') e.currentTarget.style.background = subtleHover;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      if (e.currentTarget.dataset.on !== '1') e.currentTarget.style.background = e.currentTarget.dataset.bg || subtle;
    },
  };

  const renderTemplate = (t: SiteTemplate) => {
    const on = pendingTemplate?.id === t.id;
    return (
      <div key={t.id} style={{ position: 'relative', width: '100%' }} className="df-site-card">
        <button
          key={t.id}
          type="button"
          className="df-pressable"
          title={t.description}
          onClick={() => {
            selectTemplate(t);
            if (!on) editorRef.current?.focus();
          }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: 6, borderRadius: 8, border: 'none', background: on ? subtleHover : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'background-color 150ms ease' }}
          {...hoverable}
          data-on={on ? '1' : undefined}
          data-bg="transparent"
        >
          <div style={{ width: '100%', height: thumbHeight, borderRadius: 6, background: t.colors[0], position: 'relative', overflow: 'hidden', outline: on ? `2px solid ${accentColor}` : 'none', outlineOffset: -2, transition: 'outline-color 150ms ease' }}>
            {t.sample ? (
              // miniatura real: a página de exemplo em escala, sem interação
              <iframe
                srcDoc={templateSampleHtml(t)}
                title={t.name}
                tabIndex={-1}
                loading="lazy"
                style={{ width: 1200, height: Math.ceil((thumbHeight / thumbWidth) * 1200), border: 'none', transform: `scale(${thumbWidth / 1200})`, transformOrigin: 'top left', pointerEvents: 'none', display: 'block', background: t.colors[0] }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${t.colors[0]} 0%, ${t.colors[0]} 55%, ${t.colors[1]} 140%)` }} />
            )}
          </div>
          <div style={{ fontSize: 12, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
          <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, marginTop: -4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category}</div>
        </button>

        {t.custom && (
          <button
            type="button"
            title="Excluir modelo"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteTemplate(t);
            }}
            style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, border: 'none', borderRadius: 5, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'background-color 150ms ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  };

  // Ocultar/mostrar painéis: o painel de largura fixa desliza para fora pela margem (sem reflow do conteúdo) e some com fade;
  // a margem negativa também cancela o vão de 5px, então o painel central ocupa o espaço todo.
  const slide = (open: boolean, side: 'marginLeft' | 'marginRight', width: number): React.CSSProperties => ({
    [side]: open ? 0 : -(width + 5),
    opacity: open ? 1 : 0,
    visibility: open ? 'visible' : 'hidden',
    pointerEvents: open ? 'auto' : 'none',
    transition: `${side} 320ms var(--ease-out), opacity 220ms ease, visibility 0s linear ${open ? '0s' : '320ms'}`,
  });

  return (
    <div
      data-tour="sites-studio"
      style={{ display: isActive ? 'flex' : 'none', flex: '1 1 0', minHeight: 0, minWidth: 0, width: '100%', padding: 5, gap: 5, boxSizing: 'border-box', overflow: 'hidden', background: themeTokens.bgApp, fontFamily: "'Poppins', sans-serif", fontWeight: 400 }}
    >
      {/* ---------------------------------------------------------------- esquerda: modelos e sites */}
      <div data-tour="sites-left-panel" style={{ ...panel, width: sidebarWidth, flexShrink: 0, padding: 8, gap: 8, ...slide(leftOpen, 'marginLeft', sidebarWidth) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" style={tabBtn(leftTab === 'models')} onClick={() => setLeftTab('models')}>Modelos</button>
          <button type="button" style={tabBtn(leftTab === 'sites')} onClick={() => setLeftTab('sites')}>Meus sites{sites.length ? ` ${sites.length}` : ''}</button>
          <div className="df-search-box" style={{ flex: 1, minWidth: 0, height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 6, background: ft.fieldBg }}>
            <Search size={12} color={themeTokens.textSecondary} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'inherit', padding: 0 }} />
          </div>
        </div>

        {leftTab === 'sites' && (
          <button type="button" className="df-pressable" onClick={newBlankSite} disabled={busy} style={{ ...ctrl(), width: '100%', justifyContent: 'center', gap: 6, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
            <Plus size={13} />
            <span>Novo site</span>
          </button>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leftTab === 'models' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                {templates.map(renderTemplate)}
              </div>
              {myTemplates.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, padding: '4px 6px 0', borderTop: `1px solid ${divider}`, paddingTop: 10 }}>Seus modelos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>{myTemplates.map(renderTemplate)}</div>
                </>
              )}
              {templates.length === 0 && myTemplates.length === 0 && <div style={{ fontSize: 12, color: themeTokens.textMuted, textAlign: 'center', padding: 16 }}>Nenhum modelo encontrado</div>}
            </>
          ) : siteList.length === 0 ? (
            <div style={{ fontSize: 12, color: themeTokens.textMuted, textAlign: 'center', padding: '24px 12px', lineHeight: 1.6 }}>
              {sites.length ? 'Nenhum site encontrado' : 'Os sites criados pela IA aparecem aqui.'}
            </div>
          ) : (
            siteList.map((s) => {
              const on = current?.id === s.id;
              return (
                <div
                  key={s.id}
                  className="df-pressable"
                  onClick={() => openSite(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: on ? subtleHover : 'transparent', cursor: 'pointer', transition: 'background-color 150ms ease' }}
                  {...hoverable}
                  data-on={on ? '1' : undefined}
                  data-bg="transparent"
                >
                  <Globe size={14} color={on ? accentColor : themeTokens.textSecondary} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.templateName} · {new Date(s.updatedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Excluir site"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(s);
                    }}
                    style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: themeTokens.textSecondary, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'color 150ms ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- centro: preview */}
      <div style={{ ...panel, flex: 1, minWidth: 0, padding: 5, gap: 5 }}>
        <div data-tour="sites-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 30 }}>
          <button type="button" title={leftOpen ? 'Ocultar modelos e sites' : 'Mostrar modelos e sites'} onClick={() => setLeftOpen((v) => !v)} style={ctrl(false)} {...hoverable}>
            <PanelLeft size={14} color={leftOpen ? accentColor : themeTokens.textSecondary} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, paddingLeft: 4 }}>
            <LayoutTemplate size={14} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.name : pendingTemplate ? `Novo site · ${pendingTemplate.name}` : 'Sites'}</span>
            {current && <span style={{ fontSize: 11, color: themeTokens.textSecondary, whiteSpace: 'nowrap' }}>· {current.templateName}</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: subtle, borderRadius: 6, padding: 2, height: 30, boxSizing: 'border-box' }}>
            {(
              [
                ['desktop', Monitor, 'Desktop'],
                ['tablet', Tablet, 'Tablet (820px)'],
                ['mobile', Smartphone, 'Celular (390px)'],
              ] as Array<[Device, React.ComponentType<any>, string]>
            ).map(([d, Icon, title]) => (
              <button key={d} type="button" title={title} onClick={() => setDevice(d)} style={{ width: 26, height: 26, border: 'none', borderRadius: 5, background: device === d ? (isEffectiveDark ? '#2e2e2e' : '#ffffff') : 'transparent', color: device === d ? themeTokens.textPrimary : themeTokens.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'background-color 150ms ease, color 150ms ease' }}>
                <Icon size={14} />
              </button>
            ))}
          </div>

          <button type="button" title={inspect ? 'Seleção ligada: clique no preview para escolher o que editar (Shift para vários, Esc limpa)' : 'Ligar seleção no preview'} onClick={() => setInspect((v) => !v)} style={ctrl(inspect)} data-on={inspect ? '1' : undefined} {...hoverable}>
            <MousePointerClick size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: subtle, borderRadius: 6, padding: 2, height: 30, boxSizing: 'border-box', opacity: inspect ? 1 : 0.5, transition: 'opacity 150ms ease' }}>
            {(['section', 'element'] as const).map((m) => (
              <button key={m} type="button" disabled={!inspect} onClick={() => setMode(m)} style={{ height: 26, padding: '0 8px', border: 'none', borderRadius: 5, background: mode === m ? (isEffectiveDark ? '#2e2e2e' : '#ffffff') : 'transparent', color: mode === m ? themeTokens.textPrimary : themeTokens.textSecondary, fontSize: 11.5, fontWeight: 400, cursor: inspect ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'background-color 150ms ease, color 150ms ease' }}>
                {m === 'section' ? 'Seções' : 'Elementos'}
              </button>
            ))}
          </div>

          <button type="button" title={canUndo ? 'Desfazer a última edição da IA' : 'Nada para desfazer: ainda não há edições da IA neste site'} disabled={!canUndo || busy} onClick={undo} style={{ ...ctrl(false), opacity: canUndo && !busy ? 1 : 0.4 }} {...hoverable}>
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            title="Recarregar o preview"
            disabled={!activeHtml}
            onClick={reloadPreview}
            style={{ ...ctrl(false), opacity: activeHtml ? 1 : 0.4 }}
            {...hoverable}
          >
            <RefreshCw size={14} />
          </button>
          <button type="button" title="Abrir no navegador" disabled={!activeHtml} onClick={openInBrowser} style={{ ...ctrl(false), opacity: activeHtml ? 1 : 0.4 }} {...hoverable}>
            <ExternalLink size={14} />
          </button>
          <button ref={settingsAnchor} type="button" title="Domínio, Google Analytics e Microsoft Clarity" disabled={!current || !!pendingTemplate} onClick={() => setSettingsOpen((v) => !v)} style={{ ...ctrl(settingsOpen), opacity: current && !pendingTemplate ? 1 : 0.4 }} data-on={settingsOpen ? '1' : '0'} {...hoverable}>
            <Settings2 size={14} />
          </button>
          <button type="button" title="Baixar index.html (com domínio, Analytics e Clarity, se configurados)" disabled={!activeHtml} onClick={exportHtml} style={{ ...ctrl(false), opacity: activeHtml ? 1 : 0.4 }} {...hoverable}>
            <Download size={14} />
          </button>
          <button type="button" title={chatOpen ? 'Ocultar o chat' : 'Mostrar o chat'} onClick={() => setChatOpen((v) => !v)} style={ctrl(false)} {...hoverable}>
            <PanelRight size={14} color={chatOpen ? accentColor : themeTokens.textSecondary} />
          </button>
        </div>

        {current && (
          <SiteSettingsPopup
            anchor={settingsAnchor.current}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            isDark={isEffectiveDark}
            accentColor={accentColor}
            accentTextColor={getContrastTextColor(accentColor)}
            value={{ domain: current.domain, gaId: current.gaId, clarityId: current.clarityId }}
            onSave={saveSettings}
          />
        )}

        <div data-tour="sites-preview" style={{ flex: 1, minHeight: 0, borderRadius: 8, background: isEffectiveDark ? '#000' : '#e4e7eb', display: 'flex', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          {activePreviewDoc ? (
            <iframe
              key={`${pendingTemplate ? `tpl-${pendingTemplate.id}` : `site-${current?.id || 'none'}`}-${previewKey}`}
              ref={frameRef}
              srcDoc={activePreviewDoc}
              title={pendingTemplate?.name || current?.name || 'Preview'}
              onLoad={() => postInspectorState(frameRef.current, inspectorState)}
              style={{ width: DEVICE_WIDTH[device] ?? '100%', maxWidth: '100%', height: '100%', border: 'none', background: '#fff', display: 'block', transition: 'width 250ms var(--ease-out)' }}
            />
          ) : (
            <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, maxWidth: 420, textAlign: 'center', animation: 'fadeIn 0.2s ease-out' }}>
              {pendingTemplate ? (
                <>
                  <div style={{ width: 220, height: 130, borderRadius: 10, background: `linear-gradient(135deg, ${pendingTemplate.colors[0]} 0%, ${pendingTemplate.colors[0]} 55%, ${pendingTemplate.colors[1]} 140%)`, display: 'flex', alignItems: 'flex-end', padding: 12, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: 18, color: pendingTemplate.colors[2] }}>{pendingTemplate.name}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: themeTokens.textPrimary }}>{pendingTemplate.category}</div>
                  <div style={{ fontSize: 12, color: themeTokens.textSecondary, lineHeight: 1.6 }}>{pendingTemplate.description}</div>
                  <div style={{ fontSize: 12, color: themeTokens.textMuted }}>{busy ? 'A IA está escrevendo o site...' : 'Descreva o site no chat para a IA gerar.'}</div>
                </>
              ) : (
                <>
                  <Globe size={28} color={themeTokens.textMuted} />
                  <div style={{ fontSize: 12.5, color: themeTokens.textSecondary, lineHeight: 1.6 }}>Escolha um modelo à esquerda e descreva o site no chat. Depois, clique nas seções do preview para pedir alterações.</div>
                </>
              )}
            </div>
          )}
          {busy && html && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, backgroundSize: '200% 100%', animation: 'dfShimmer 1.2s linear infinite' }} />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- direita: chat */}
      {(
        <>
          <div
            className={`resizer-col ${draggingChat ? 'dragging' : ''}`}
            title="Arraste para redimensionar o chat (duplo clique restaura)"
            style={{ marginLeft: -5, marginRight: -5, display: chatOpen ? 'flex' : 'none' }}
            onDoubleClick={() => setChatWidth(340)}
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = chatWidth;
              setDraggingChat(true);
              document.body.classList.add('resizing-col');
              const move = (ev: MouseEvent) => setChatWidth(Math.max(280, Math.min(640, startW + (startX - ev.clientX))));
              const up = () => {
                setDraggingChat(false);
                document.body.classList.remove('resizing-col');
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
            }}
          />
          <div
            data-tour="sites-chat"
            style={{
              ...slide(chatOpen, 'marginRight', chatWidth),
              width: chatWidth,
              alignSelf: 'stretch',
              padding: 12,
              background: isEffectiveDark
                ? `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccent, 0.2)} 0%, #101010 100%)`
                : `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccent, 0.22)} 0%, #ffffff 100%)`,
              borderRadius: 10,
              border: 'none',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'stretch',
              gap: 10,
              display: 'flex',
              position: 'relative',
              flexShrink: 0,
              boxSizing: 'border-box',
              minHeight: 0,
            }}
          >
            {/* Header: histórico + logo da IA + nome + modelo + navegação entre sites + mais opções */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '2px 4px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div
                  onClick={() => setLeftTab('sites')}
                  title="Meus sites"
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px 3px', borderRadius: 6 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={11} color={themeTokens.textSecondary} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {renderAiIcon(selectedAiProvider, 17)}
                  <div style={{ color: themeTokens.textPrimary, fontSize: 13, fontFamily: 'Poppins, sans-serif', fontWeight: 400 }}>{providerName}</div>
                  {modelLabel && (
                    <div
                      onClick={() => {
                        setPickerOpen(true);
                        setActiveSub(selectedAiProvider);
                      }}
                      title="Modelo ativo. Clique para alterar."
                      style={{ fontSize: 10.5, color: chatAccent, padding: '1px 2px', cursor: 'pointer', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'opacity 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <span>{formatModelDisplayName(modelLabel) || modelLabel}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
                {([
                  [ArrowLeft, 'Site anterior', siteIdx >= 0 && siteIdx < sites.length - 1, () => openSite(sites[siteIdx + 1])],
                  [ArrowRight, 'Próximo site', siteIdx > 0, () => openSite(sites[siteIdx - 1])],
                ] as Array<[React.ComponentType<any>, string, boolean, () => void]>).map(([Icon, title, enabled, go]) => (
                  <button
                    key={title}
                    className="df-pressable"
                    onClick={go}
                    disabled={!enabled}
                    title={title}
                    style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.4, padding: '4px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = themeTokens.textPrimary;
                      e.currentTarget.style.background = subtleHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = themeTokens.textSecondary;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon size={13} />
                  </button>
                ))}
                <button
                  ref={menuAnchor}
                  className="df-pressable"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Mais opções"
                  style={{ background: menuOpen ? subtleHover : 'transparent', border: 'none', color: menuOpen ? themeTokens.textPrimary : themeTokens.textSecondary, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = themeTokens.textPrimary;
                    e.currentTarget.style.background = subtleHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!menuOpen) {
                      e.currentTarget.style.color = themeTokens.textSecondary;
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }} onMouseDown={() => setMenuOpen(false)} />
                    <div
                      className="df-dropdown-menu df-popover-right"
                      style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: ft.dropdownMenuBg, border: ft.dropdownBorder, borderRadius: 8, padding: 4, minWidth: 170, zIndex: 100000, boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {([
                        [Clock, 'Meus sites', () => setLeftTab('sites')],
                        [Save, 'Exportar conversa (.md)', exportChatMd],
                        [Save, 'Exportar conversa (.json)', exportChatJson],
                        [Trash2, 'Limpar conversa', () => setMessages([])],
                      ] as Array<[React.ComponentType<any>, string, () => void]>).map(([Icon, label, act]) => (
                        <div
                          key={label}
                          className="df-row-interactive"
                          onClick={() => {
                            setMenuOpen(false);
                            act();
                          }}
                          style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: themeTokens.textPrimary, display: 'flex', alignItems: 'center', gap: 8, transition: 'background-color 150ms var(--ease-out), transform 150ms var(--ease-out)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = subtleHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Icon size={13} color={label === 'Meus sites' ? accentColor : themeTokens.textSecondary} />
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Histórico rolável, com a logo da IA ao fundo enquanto a conversa está vazia */}
            <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {messages.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0, userSelect: 'none' }}>
                  <div style={{ opacity: isEffectiveDark ? 0.08 : 0.06, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{renderAiIcon(selectedAiProvider, 150)}</div>
                </div>
              )}
              <div ref={listRef} style={{ flex: '1 1 0', minHeight: 0, position: 'relative', zIndex: 1, padding: '4px 2px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'text' }}>
                {messages.map((m, idx) => {
                  if (m.role === 'user') {
                    return (
                      <div key={m.id} className="df-subtle-enter" style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '92%' }}>
                        <div style={{ position: 'relative', background: hexToRgba(chatAccent, 0.15), color: themeTokens.textPrimary, padding: '8px 12px', borderRadius: '8px 2px 8px 8px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontWeight: 400, fontSize: 13, lineHeight: '18px', flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 34, minWidth: 130, boxSizing: 'border-box' }}>
                          {[...(m.refs || []), ...(m.selection || [])].length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(m.refs || []).map((r, i) => m.refImages?.[i] ? (
                                <img key={`r${i}`} src={m.refImages[i]!} alt={r} title="Ver em tela cheia" onClick={() => setZoomImg(m.refImages![i])} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', cursor: 'zoom-in' }} />
                              ) : (
                                <span key={`r${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 7px', borderRadius: 5, background: subtleHover }}>
                                  <Link2 size={10} /> {r}
                                </span>
                              ))}
                              {(m.selection || []).map((x, i) => (
                                <span key={`s${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 7px', borderRadius: 5, background: subtleHover }}>
                                  <MousePointerClick size={10} /> {x}
                                </span>
                              ))}
                            </div>
                          )}
                          <span>{m.text}</span>
                        </div>
                      </div>
                    );
                  }
                  const working = busy && idx === messages.length - 1;
                  return (
                    <div key={m.id} className="df-subtle-enter" style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '96%', width: '100%' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, background: subtle, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{renderAiIcon(selectedAiProvider || 'claude', 14)}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', minWidth: 0 }}>
                        <AiChatTimeline workedDuration={m.workedDuration} isWorking={working} liveAction={working ? live || undefined : undefined} accentColor={accentColor} themeTokens={themeTokens} isEffectiveDark={isEffectiveDark} />
                        {m.text && (
                          <div style={{ background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)', color: m.error ? '#ef4444' : themeTokens.textPrimary, padding: '10px 14px', borderRadius: 8, border: 'none', wordBreak: 'break-word', lineHeight: '20px', fontSize: 13 }}>
                            {m.error
                              ? m.text
                              : renderMarkdownPreview(m.text, { textPrimary: themeTokens.textPrimary, textSecondary: themeTokens.textSecondary, textMuted: themeTokens.textMuted, border: 'transparent', accentColor: chatAccent, isEffectiveDark, fontSize: 13, regularFont: true })}
                          </div>
                        )}
                        {m.error && !busy && (
                          <button type="button" className="df-pressable" onClick={() => run(messages[idx - 1]?.text)} style={{ ...ctrl(false), alignSelf: 'flex-start', height: 28 }} {...hoverable}>
                            <RefreshCw size={13} color={accentColor} />
                            Tentar novamente
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compositor */}
            <AiChatMessageQueue
              bare
              queue={queue.map((q) => ({ id: q.id, prompt: q.text, timestamp: q.ts }))}
              onRemoveFromQueue={(id) => setQueue((l) => l.filter((q) => q.id !== id))}
              accentColor={chatAccent}
              themeTokens={themeTokens}
              isEffectiveDark={isEffectiveDark}
            />
            {claudeTip && (
              <div
                className="df-opacity-enter"
                style={{
                  alignSelf: 'stretch',
                  height: 40,
                  boxSizing: 'border-box',
                  borderRadius: '10px 10px 0 0',
                  background: accentColor,
                  color: getContrastTextColor(accentColor),
                  // a faixa desce 10px atrás do campo e os cantos de baixo são recortados no formato do canto arredondado do campo (curva invertida)
                  WebkitMask: 'linear-gradient(#000,#000) top / 100% 30px no-repeat, radial-gradient(circle at 10px 10px, transparent 10px, #000 10.5px) left bottom / 10px 10px no-repeat, radial-gradient(circle at 0 10px, transparent 10px, #000 10.5px) right bottom / 10px 10px no-repeat',
                  mask: 'linear-gradient(#000,#000) top / 100% 30px no-repeat, radial-gradient(circle at 10px 10px, transparent 10px, #000 10.5px) left bottom / 10px 10px no-repeat, radial-gradient(circle at 0 10px, transparent 10px, #000 10.5px) right bottom / 10px 10px no-repeat',
                }}
              >
                <div style={{ height: 30, padding: '0 4px 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400 }}>
                    Melhor com
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.92)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{renderAiIcon('claude', 13)}</span>
                      Claude
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    title="Os sites ficam muito melhores com o Claude Sonnet: troca a IA do chat para ele"
                    onClick={() => {
                      const sonnet = (aiModelsByProvider.claude || []).find((m) => /sonnet/i.test(m.id) || /sonnet/i.test(m.label));
                      onChangeAiProvider('claude');
                      onChangeAiModel(sonnet?.id || 'sonnet');
                      logSystemActivity('sites', 'trocar_para_claude', 'Claude Sonnet');
                    }}
                    style={{ height: 22, padding: '0 12px', borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.18)', color: 'inherit', fontSize: 11, fontFamily: 'Poppins, sans-serif', fontWeight: 500, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1, transition: 'background-color 0.15s ease' }}
                    onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.18)')}
                  >
                    Trocar
                  </button>
                </div>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (busy) enqueue();
                else run();
              }}
              style={{ alignSelf: 'stretch', marginTop: claudeTip ? -20 : undefined, background: ft.fieldBg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 10, border: 'none', outline: 'none', boxShadow: 'none', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', overflow: 'visible', position: 'relative', flexShrink: 0, zIndex: 50 }}
            >
              <div style={{ alignSelf: 'stretch', padding: '10px 14px 6px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(pendingTemplate || selection.length > 0 || refs.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    {pendingTemplate && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: subtleHover, borderRadius: 6, padding: '3px 8px 3px 6px', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: themeTokens.textPrimary, maxWidth: '100%' }}>
                        <LayoutTemplate size={13} color={chatAccent} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>Novo site · {pendingTemplate.name}</span>
                        <button type="button" title="Cancelar" onClick={() => setPendingTemplate(null)} style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 3 }} onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}>
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {selection.map((x) => (
                      <div key={x.path} title={x.path} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: subtleHover, borderRadius: 6, padding: '3px 8px 3px 6px', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: themeTokens.textPrimary, maxWidth: '100%' }}>
                        <MousePointerClick size={13} color={chatAccent} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{x.label}</span>
                        <button type="button" title="Remover da seleção" onClick={() => setSelection((prev) => prev.filter((y) => y.path !== x.path))} style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 3 }} onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {refs.map((r) => (
                      <div key={r.id} title={r.url || r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: subtleHover, borderRadius: 6, padding: r.dataUrl ? '2px 8px 2px 2px' : '3px 8px 3px 6px', fontSize: 12, fontFamily: 'Poppins, sans-serif', color: themeTokens.textPrimary, maxWidth: '100%' }}>
                        {r.dataUrl ? <img src={r.dataUrl} alt="" title="Ver em tela cheia" onClick={() => setZoomImg(r.dataUrl!)} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', cursor: 'zoom-in' }} /> : <Link2 size={13} color={chatAccent} />}
                        {!r.dataUrl && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{r.label}</span>}
                        <button type="button" title="Remover referência" onClick={() => setRefs((prev) => prev.filter((x) => x.id !== r.id))} style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 1, display: 'flex', alignItems: 'center', borderRadius: 3 }} onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div onInputCapture={() => setHasText(!!editorRef.current?.getValue().trim())} onKeyUpCapture={() => setHasText(!!editorRef.current?.getValue().trim())}>
                  <PromptEditor
                    ref={editorRef}
                    placeholder={placeholder}
                    isEffectiveDark={isEffectiveDark}
                    maxImages={4}
                    currentImagesCount={refs.filter((r) => r.kind === 'image').length}
                    onImageAttached={addImageRef}
                    onSubmit={(p) => {
                      if (p.trim() || refs.length) (busy ? enqueue(p) : run(p));
                    }}
                  />
                </div>
              </div>

              <div style={{ alignSelf: 'stretch', padding: '8px 10px', justifyContent: 'space-between', alignItems: 'center', display: 'flex', gap: 6, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0 }}>
                  <button
                    ref={refAnchor}
                    type="button"
                    className="df-pressable"
                    onClick={() => setRefOpen((v) => !v)}
                    title="Referência: URL de um site ou screenshot para a IA recriar"
                    style={{ height: 26, width: 26, borderRadius: 5, border: 'none', background: refOpen || refs.length ? hexToRgba(chatAccent, 0.18) : ft.fieldBg, color: refs.length ? chatAccent : themeTokens.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                  >
                    <Link2 size={13} />
                  </button>
                  <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }} ref={providerAnchor}>
                    <div
                      className="df-dropdown-trigger df-pressable"
                      onClick={() => {
                        const willOpen = !pickerOpen;
                        setPickerOpen(willOpen);
                        setActiveSub(willOpen ? selectedAiProvider : null);
                      }}
                      style={{ height: 26, paddingLeft: 7, paddingRight: 7, borderRadius: 5, background: pickerOpen ? ft.fieldBgHover : ft.fieldBg, border: ft.fieldBorder, boxShadow: 'none', alignItems: 'center', gap: 5, display: 'flex', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background-color 150ms var(--ease-out), transform 140ms var(--ease-out)', maxWidth: 190, minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}
                    >
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{renderAiIcon(selectedAiProvider, 13.5)}</div>
                      <div style={{ color: themeTokens.textPrimary, fontSize: 11.5, fontFamily: 'Poppins, sans-serif', fontWeight: 400, whiteSpace: 'nowrap', minWidth: 0, flexShrink: 0 }}>{providerName}</div>
                      {selectedModel && (
                        <div style={{ color: themeTokens.textSecondary, opacity: 0.85, fontSize: 10.5, fontFamily: 'Poppins, sans-serif', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
                          {formatModelDisplayName(selectedModel) || selectedModel}
                        </div>
                      )}
                      <ChevronDown size={10} className="df-chevron" color={themeTokens.textSecondary} style={{ flexShrink: 0, transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 160ms var(--ease-out)' }} />
                    </div>
                    {pickerOpen && (
                      <div
                        className="df-dropdown-menu"
                        data-placement="top"
                        style={{ position: 'absolute', bottom: 34, left: 0, background: ft.dropdownMenuBg, borderRadius: 10, border: ft.dropdownBorder, boxShadow: 'none', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 9999, whiteSpace: 'nowrap', minWidth: 190 }}
                      >
                        {aiProviders.map((p) => {
                          const isSelected = selectedAiProvider === p.id;
                          const isOpen = activeSub === p.id;
                          const models = aiModelsByProvider[p.id] || [];
                          return (
                            <div
                              key={p.id}
                              className="df-row-interactive"
                              onClick={() => {
                                if (p.id !== selectedAiProvider) onChangeAiProvider(p.id);
                                if (models.length > 0) setActiveSub((prev) => (prev === p.id ? null : p.id));
                                else {
                                  setPickerOpen(false);
                                  setActiveSub(null);
                                }
                              }}
                              style={{ padding: '7px 10px', color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400, cursor: 'pointer', borderRadius: 6, whiteSpace: 'nowrap', background: isSelected ? hexToRgba(accentColor, 0.15) : isOpen ? subtleHover : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'background-color 150ms var(--ease-out), opacity 150ms var(--ease-out), transform 150ms var(--ease-out)' }}
                              onMouseEnter={(e) => {
                                if (!isSelected && !isOpen) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected && !isOpen) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                {renderAiIcon(p.id, 15)}
                                <span>{p.name}</span>
                              </div>
                              {models.length > 0 && (
                                <div
                                  className="df-pressable"
                                  title="Ver opções de modelos"
                                  style={{ padding: '2px 3px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent', transition: 'background-color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                                >
                                  <ChevronRight size={11} color={isOpen ? themeTokens.textPrimary : themeTokens.textSecondary} style={{ opacity: isOpen ? 1 : 0.6, transform: isOpen ? 'rotate(90deg)' : 'rotate(180deg)', transition: 'transform 160ms var(--ease-out), opacity 150ms var(--ease-out)' }} />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {(() => {
                          const target = aiProviders.find((p) => p.id === activeSub);
                          const models = target ? aiModelsByProvider[target.id] || [] : [];
                          if (!target || models.length === 0) return null;
                          if (target.id === 'antigravity') {
                            return (
                              <div style={{ position: 'absolute', right: 'calc(100% + 4px)', left: 'auto', bottom: 0, zIndex: 100002 }}>
                                <GroupedModelMenu
                                  providerName={target.name}
                                  models={models}
                                  isCurrent={(m) => target.id === selectedAiProvider && (selectedModel === m.id || selectedModel === m.label)}
                                  onSelect={(m) => {
                                    if (target.id !== selectedAiProvider) onChangeAiProvider(target.id);
                                    onChangeAiModel(m.id);
                                    setPickerOpen(false);
                                    setActiveSub(null);
                                  }}
                                  accentColor={accentColor}
                                  isDark={isEffectiveDark}
                                  textPrimary={themeTokens.textPrimary}
                                  textSecondary={themeTokens.textSecondary}
                                  border={themeTokens.border}
                                  menuBg={ft.dropdownMenuBg}
                                  menuBorder={ft.dropdownBorder}
                                  hexToRgba={hexToRgba}
                                />
                              </div>
                            );
                          }
                          return (
                            <div
                              className="df-dropdown-menu"
                              data-placement="top"
                              onClick={(e) => e.stopPropagation()}
                              style={{ position: 'absolute', right: 'calc(100% + 4px)', left: 'auto', bottom: 0, background: ft.dropdownMenuBg, borderRadius: 10, border: ft.dropdownBorder, boxShadow: 'none', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 100002, minWidth: 160, width: 'max-content', maxWidth: 240, maxHeight: 'min(360px, calc(100vh - 120px))', overflowY: 'auto' }}
                            >
                              <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 400, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modelos {target.name}</div>
                              {models.map((m) => {
                                const isCurrent = target.id === selectedAiProvider && (selectedModel === m.id || selectedModel === m.label);
                                return (
                                  <div
                                    key={m.id}
                                    className="df-row-interactive"
                                    onClick={() => {
                                      if (target.id !== selectedAiProvider) onChangeAiProvider(target.id);
                                      onChangeAiModel(m.id);
                                      setPickerOpen(false);
                                      setActiveSub(null);
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: isCurrent ? hexToRgba(accentColor, 0.15) : 'transparent', display: 'flex', alignItems: 'center', gap: 8, transition: 'background-color 150ms var(--ease-out), transform 150ms var(--ease-out)', whiteSpace: 'nowrap' }}
                                    onMouseEnter={(e) => {
                                      if (!isCurrent) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    {isCurrent ? <Check size={12} color={accentColor} className="df-check-pop" style={{ flexShrink: 0 }} /> : <div style={{ width: 12, flexShrink: 0 }} />}
                                    <span style={{ fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: 400, color: isCurrent ? accentColor : themeTokens.textPrimary, whiteSpace: 'nowrap' }}>{formatModelDisplayName(m.label) || m.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {busy && canSend && (
                    <button
                      type="submit"
                      className="df-pressable"
                      title="Adicionar à fila: envia quando a IA terminar"
                      style={{ width: 24, height: 24, background: chatAccent, borderRadius: 61, border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background-color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                    >
                      <ArrowRight size={13} strokeWidth={2.5} color={getContrastTextColor(chatAccent)} />
                    </button>
                  )}
                  {busy ? (
                    <button
                      type="button"
                      onClick={stop}
                      title="Interromper geração"
                      className="df-pressable"
                      style={{ width: 24, height: 24, background: isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)', borderRadius: 61, border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background-color 150ms var(--ease-out), transform 140ms var(--ease-out)', boxShadow: 'none' }}
                    >
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: '#ef4444' }} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className={canSend ? 'df-pressable' : undefined}
                      disabled={!canSend}
                      title="Enviar mensagem"
                      style={{ width: 24, height: 24, background: canSend ? chatAccent : isEffectiveDark ? '#333333' : '#e2e8f0', borderRadius: 61, border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: canSend ? getContrastTextColor(chatAccent) : isEffectiveDark ? '#666666' : '#94a3b8', cursor: canSend ? 'pointer' : 'default', flexShrink: 0, transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out), transform 140ms var(--ease-out)' }}
                    >
                      <ArrowRight size={13} strokeWidth={2.5} color={canSend ? getContrastTextColor(chatAccent) : isEffectiveDark ? '#666666' : '#94a3b8'} />
                    </button>
                  )}
                </div>
              </div>
            </form>

            <PopupPortal anchor={refAnchor.current} open={refOpen} onClose={() => setRefOpen(false)} width={300} maxHeight={320} isDark={isEffectiveDark}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
                <div style={{ fontSize: 12, color: pc.text, lineHeight: 1.5 }}>A IA usa a referência como guia de visual e estrutura, com o conteúdo do seu negócio.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px', borderRadius: 6, background: pc.field }}>
                  <Link2 size={12} color={pc.sub} />
                  <input
                    autoFocus
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addUrlRef();
                    }}
                    placeholder="https://site-de-referencia.com"
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: pc.text, fontSize: 12, fontFamily: 'inherit', padding: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" style={{ ...ctrl(true), flex: 1, opacity: refUrl.trim() ? 1 : 0.5 }} disabled={!refUrl.trim()} onClick={addUrlRef}>
                    <Link2 size={13} /> Usar URL
                  </button>
                  <button
                    type="button"
                    style={{ ...ctrl(false), flex: 1, background: pc.hover, color: pc.text }}
                    onClick={() => {
                      setRefOpen(false);
                      pickScreenshot();
                    }}
                  >
                    <ImagePlus size={13} /> Screenshot
                  </button>
                </div>
                <div style={{ fontSize: 11, color: pc.sub, lineHeight: 1.5 }}>Também dá para colar ou arrastar imagens direto no campo de mensagem.</div>
              </div>
            </PopupPortal>

          </div>
        </>
      )}

      <ConfirmDeleteModal
        isOpen={!!confirmDelete}
        title="Excluir site"
        message={`O site "${confirmDelete?.name || ''}" e a conversa dele serão apagados.`}
        itemDescription="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={() => confirmDelete && removeSite(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      <ConfirmDeleteModal
        isOpen={!!confirmDeleteTemplate}
        title="Excluir modelo"
        message={`O modelo "${confirmDeleteTemplate?.name || ''}" será removido dos seus modelos.`}
        itemDescription="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={() => confirmDeleteTemplate && removeCustomTemplate(confirmDeleteTemplate)}
        onClose={() => setConfirmDeleteTemplate(null)}
      />
      <ImageLightbox src={zoomImg} onClose={() => setZoomImg(null)} />
    </div>
  );
}
