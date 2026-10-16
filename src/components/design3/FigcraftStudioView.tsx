import { useCallback, useEffect, useRef, useState } from 'react';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import BoltRounded from '@mui/icons-material/BoltRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import FigcraftDocsPanel from './FigcraftDocsPanel';
import { AiChatHeader } from '../ide/chat/AiChatHeader';
import { AiChatTimeline } from '../ide/chat/AiChatTimeline';
import type { ExecutionStepItem } from '../../types/ide';
import type { FigcraftCall } from './figcraftAi';
import { FcSync } from './figcraftShapes';
import { runFigcraftAi } from './figcraftScreenAi';
import { abortAllAiRequests } from '../design2/aiScreenFromLlm';
import StopRounded from '@mui/icons-material/StopRounded';
import UnsplashKeyPopup from '../design2/UnsplashKeyPopup';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { logSystemActivity } from '../../utils/brainService';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { AI_PROVIDERS } from '../../constants/ai';

interface ChatMsg { id: string; role: 'user' | 'ai'; text: string; ts: number; steps?: ExecutionStepItem[]; workedDuration?: string; error?: boolean; /** passos do histórico do FigCraft que este pedido gerou (o Desfazer volta todos) */ undoSteps?: number; /** miniaturas das imagens de referência anexadas ao pedido */ images?: string[] }
interface ChatSession { id: string; title: string; ts: number; messages: ChatMsg[] }

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Miniatura (lado maior 160px) para guardar no histórico da conversa sem pesar o armazenamento. */
function thumbOf(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 160 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  isActive: boolean;
  workspacePath: string;
  selectedAiProvider: string;
  selectedModel: string;
  themeTokens: Record<string, string>;
  accentColor: string;
  isEffectiveDark: boolean;
  projectName?: string;
  projectSubtitle?: string;
  userInitial?: string;
  aiProviders?: { id: string; name: string }[];
  aiModelsByProvider?: Record<string, { id: string; label: string }[]>;
  onChangeAiProvider?: (id: string) => void;
  onChangeAiModel?: (id: string) => void;
  /** avisa o app quando a IA termina (notificação se o usuário estiver em outra tela) */
  onAiTaskDone?: (r: { ok: boolean; message: string; workspace: string }) => void;
}

/** Aba "Design 2": editor FigCraft (Rust/wasm) em iframe + barra de IA que substitui a barra de ferramentas igual a tela Design. */
export default function FigcraftStudioView({
  isActive,
  workspacePath,
  selectedAiProvider,
  selectedModel,
  themeTokens,
  accentColor,
  isEffectiveDark,
  projectName,
  projectSubtitle,
  userInitial,
  aiProviders = [],
  aiModelsByProvider = {},
  onChangeAiProvider,
  onChangeAiModel,
  onAiTaskDone,
}: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadJson<ChatMsg[]>(`design2_ai_chat:${workspacePath}`, []));
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadJson<ChatSession[]>(`design2_ai_sessions:${workspacePath}`, []));
  const [sessionTitle, setSessionTitle] = useState('Design 2');
  const [showHistory, setShowHistory] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  // corpo do cartao da coluna esquerda do FigCraft, onde ficam os paineis de IA e de documentacao
  const [body, setBody] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shell, setShell] = useState({ l: 280, r: 300, w: 1200, h: 800, cx: 361 });
  const chatEnd = useRef<HTMLDivElement>(null);
  // conversa e sessoes de IA sao do projeto selecionado: ao trocar de projeto, grava no antigo e carrega o novo
  const chatWs = useRef(workspacePath);
  useEffect(() => { if (chatWs.current !== workspacePath) return; try { localStorage.setItem(`design2_ai_chat:${workspacePath}`, JSON.stringify(messages.slice(-80))); } catch { /* sem armazenamento */ } }, [messages, workspacePath]);
  useEffect(() => { if (chatWs.current !== workspacePath) return; try { localStorage.setItem(`design2_ai_sessions:${workspacePath}`, JSON.stringify(sessions.slice(0, 30))); } catch { /* sem armazenamento */ } }, [sessions, workspacePath]);
  useEffect(() => {
    if (chatWs.current === workspacePath) return;
    chatWs.current = workspacePath;
    setMessages(loadJson<ChatMsg[]>(`design2_ai_chat:${workspacePath}`, []));
    setSessions(loadJson<ChatSession[]>(`design2_ai_sessions:${workspacePath}`, []));
  }, [workspacePath]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [messages, busy, showHistory]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPickerOpen, setAiPickerOpen] = useState(false);
  const [hoveredProv, setHoveredProv] = useState<string | null>(null);
  const [tokensFollowing, setTokensFollowing] = useState(true);
  const [fastMode, setFastMode] = useState(true); // modelo de esforço baixo: a geração leva uma fração do tempo (desligue em + > Modo rápido para a qualidade máxima)
  const [useProjectContext, setUseProjectContext] = useState(true);
  const [keysOpen, setKeysOpen] = useState(false);
  const [showSendHint, setShowSendHint] = useState(false);
  const [aiImages, setAiImages] = useState<string[]>([]);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const readyResolve = useRef<(() => void) | null>(null);
  const ready = useRef<Promise<void>>(null as any);
  if (!ready.current) {
    ready.current = new Promise((res) => {
      readyResolve.current = res;
    });
  }

  const call: FigcraftCall = useCallback(
    (method, params = {}) =>
      ready.current.then(
        () =>
          new Promise<any>((resolve, reject) => {
            const win = frame.current?.contentWindow;
            if (!win) return reject(new Error('FigCraft ainda carregando'));
            const fc = Math.random().toString(36).slice(2);
            const timer = setTimeout(() => {
              removeEventListener('message', on);
              reject(new Error('FigCraft nao respondeu'));
            }, 180000); // a primeira abertura carrega o wasm inteiro e pode demorar
            const on = (e: MessageEvent) => {
              if (e.source !== win || e.data?.fc !== fc) return;
              clearTimeout(timer);
              removeEventListener('message', on);
              e.data.ok ? resolve(e.data.body ? JSON.parse(e.data.body) : null) : reject(new Error(e.data.body));
            };
            addEventListener('message', on);
            win.postMessage({ fc, method, params }, '*');
          })
      ),
    []
  );

  const syncRef = useRef<FcSync | null>(null);
  if (!syncRef.current) syncRef.current = new FcSync(call);
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);

  // Sincroniza tokens visuais e visibilidade da barra de ferramentas com o padrao da tela Design
  const themeKey = useRef('');
  const latest = useRef({ isEffectiveDark, accentColor, projectName, projectSubtitle, userInitial, aiModalOpen, docsOpen });
  latest.current = { isEffectiveDark, accentColor, projectName, projectSubtitle, userInitial, aiModalOpen, docsOpen };

  const syncTheme = useCallback(
    (force = false, overrideHideToolbar?: boolean) => {
      const dark = latest.current.isEffectiveDark;
      const a = latest.current.accentColor.length === 7 ? latest.current.accentColor : '#2563eb';
      const title = latest.current.projectName || 'Estudio de Design';
      const subtitle = latest.current.projectSubtitle || 'Sem projeto vinculado';
      const avatar = latest.current.userInitial || 'W';
      void overrideHideToolbar;
      const hideToolbar = 0; // a conversa com a IA abre num painel acima da barra, as ferramentas continuam visiveis
      // (sem espaco reservado: o painel de IA ocupa o corpo da coluna esquerda, como o painel de Recursos)
      const inset = 0;
      // qual painel do host ocupa o corpo do cartao da coluna esquerda
      const leftBody = latest.current.aiModalOpen ? 'ai' : latest.current.docsOpen ? 'docs' : '';
      const key = `${dark}${a}${title}${subtitle}${avatar}${hideToolbar}${inset}${leftBody}`;
      if (!force && key === themeKey.current) return;
      themeKey.current = key;
      const canvasBg = dark ? '#181818' : '#f1f5f9'; // = bgCardSecondary da tela Design
      call('ui.theme', {
        bg: dark ? '#000000' : '#eaedf1',
        panel: dark ? '#101010' : '#ffffff', // = bgCard da tela Design
        canvas: canvasBg,
        border: dark ? '#ffffff14' : '#00000014', // linha divisoria = rgba(255,255,255,0.08) da tela Design
        border_strong: '#00000000',
        field_hover_border: '#00000000',
        text: dark ? '#ffffff' : '#0f172a',
        text_secondary: dark ? '#888888' : '#475569',
        text_tertiary: dark ? '#555555' : '#64748b',
        icon: dark ? '#ffffff' : '#0f172a',
        icon_secondary: dark ? '#888888' : '#475569',
        hover: dark ? '#1f1f1f' : '#e2e8f0',
        pressed: dark ? '#2a2a2a' : '#cbd5e1',
        field: dark ? '#181818' : '#f1f5f9', // = bgCardSecondary da tela Design
        accent: a,
        accent_hover: a + 'cc',
        accent_text: a,
        focus: a,
        selected_row: a + '26',
        selected_row_child: a + '14',
        tab_bar: dark ? '#000000' : '#eaedf1',
        tab_active: dark ? '#101010' : '#ffffff',
        menu: dark ? '#1f1f1f' : '#e2e8f0', // = bgCardElevated: menus e popups se destacam do card sem borda nem sombra
        menu_text: dark ? '#ffffff' : '#0f172a',
        menu_hover: a,
        radius: 10,
        gap: 5,
        layout: 'aura',
        title,
        subtitle,
        avatar: avatar.toUpperCase(),
        props_label: 'Propriedades',
        hide_toolbar: hideToolbar,
        inset_left: inset,
        left_body: leftBody,
      })
        .then(() => call('ui.set', { theme: dark ? 'dark' : 'light' }))
        .then(() => call('document.inspect', { depth: 0 }))
        .then(async (d) => {
          // fundo de todas as paginas igual ao canvas do tema, sem sobrescrever uma cor escolhida pelo usuario
          const stock = ['#F5F5F5', '#1E1E1E', '#181818', '#0D0D0D', '#F1F5F9', '#232323'];
          for (const page of d.pages || []) {
            if (stock.includes(String(page.background).toUpperCase()) && String(page.background).toLowerCase() !== canvasBg) {
              await call('engine.execute', { command: 'page.setBackground', params: { id: page.id, color: canvasBg } });
            }
          }
        })
        .catch(() => {
          themeKey.current = '';
        });
    },
    [call]
  );

  // Documento novo: 4 paginas abertas por padrao, como na tela Design
  const ensureDefaultPages = useCallback(async () => {
    try {
      const d = await call('document.inspect', { depth: 1 });
      const pages = d.pages || [];
      if (pages.length !== 1 || (pages[0].children || []).length > 0) return;
      for (let i = 2; i <= 4; i++) await call('engine.execute', { command: 'page.add', params: { name: `Page ${i}` } });
      await call('engine.execute', { command: 'page.select', params: { id: pages[0].id } });
    } catch {
      /* sem paginas extras: nao impede o uso */
    }
  }, [call]);

  // O documento do FigCraft e do projeto selecionado na header: salvo em <projeto>/.devflow/figcraft/project.json
  // (como o design.json da tela Design), gravado sozinho a cada mudanca e restaurado ao voltar ao projeto.
  const loadedFor = useRef('');
  const switching = useRef(false);
  const projFile = (ws: string) => `${ws}/.devflow/figcraft/project.json`;
  const saveProject = useCallback(async (ws: string, onlyIfDirty: boolean) => {
    const fs = (window as any).electronAPI?.fs;
    if (!ws || !fs?.writeFile) return;
    const r = await call('doc.dump', { ifDirty: onlyIfDirty });
    if (r?.data) await fs.writeFile(projFile(ws), JSON.stringify({ version: 1, updatedAt: Date.now(), data: r.data }));
  }, [call]);
  useEffect(() => {
    (async () => {
      await ready.current;
      if (loadedFor.current === workspacePath) return;
      const fs = (window as any).electronAPI?.fs;
      switching.current = true;
      try {
        if (loadedFor.current) await saveProject(loadedFor.current, false);
        let data: string | null = null;
        if (workspacePath && fs?.readFile) {
          try {
            const r = await fs.readFile(projFile(workspacePath));
            data = r?.content ? JSON.parse(r.content).data || null : null;
          } catch { data = null; }
        }
        await call('doc.restore', data ? { data } : {});
        syncRef.current = new FcSync(call);
        if (!data) await ensureDefaultPages();
        themeKey.current = '';
        syncTheme(true);
        loadedFor.current = workspacePath;
      } catch { /* sem restaurar: nao grava por cima do projeto */ } finally {
        switching.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);
  useEffect(() => {
    const tick = () => { if (!switching.current && loadedFor.current === workspacePath) saveProject(workspacePath, true).catch(() => {}); };
    const t = setInterval(tick, 3000);
    return () => { clearInterval(t); tick(); };
  }, [workspacePath, saveProject]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickImageRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.data?.fcReady) {
        readyResolve.current?.();
        themeKey.current = '';
        syncTheme(true);
      }
      if (e.data?.fcEvent === 'docs') {
        // o botao Docs da barra lateral abre e fecha o painel de documentacao (corpo da coluna esquerda; fecha o de IA)
        setDocsOpen((v) => {
          if (!v) {
            latest.current.aiModalOpen = false;
            setAiModalOpen(false);
          }
          return !v;
        });
      }
      if (e.data?.fcEvent === 'pick-image') {
        // o navegador nao tem dialogo nativo dentro do FigCraft: abre o seletor aqui e devolve os bytes
        pickImageRef.current?.click();
      }
      if (e.data?.fcEvent === 'ai') {
        // o botao de IA da barra lateral abre e fecha o painel
        const next = !latest.current.aiModalOpen;
        latest.current.aiModalOpen = next;
        setAiModalOpen(next);
        if (next) setDocsOpen(false);
        if (next) setTimeout(() => textareaRef.current?.focus(), 40);
      }
    };
    addEventListener('message', on);
    return () => removeEventListener('message', on);
  }, [syncTheme, ensureDefaultPages]);

  useEffect(() => {
    syncTheme(true);
  }, [aiModalOpen, docsOpen, isEffectiveDark, accentColor, projectName, projectSubtitle, userInitial, syncTheme]);

  useEffect(() => {
    if (!isActive) return;
    frame.current?.focus();
  }, [isActive]);

  // o corpo do cartao da coluna esquerda (medido pelo FigCraft): os paineis ocupam exatamente esse espaco
  useEffect(() => {
    if (!aiModalOpen && !docsOpen) return;
    let alive = true;
    const measure = () =>
      call('ui.inspect', {})
        .then((d: any) => {
          if (!alive) return;
          const b = d?.hostBody;
          const next = b && !d?.panels?.leftCollapsed ? { x: b[0], y: b[1], w: b[2], h: b[3] } : null;
          setBody((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          const sh = { l: d?.panels?.left ?? 280, r: d?.panels?.right ?? 300, w: frame.current?.clientWidth ?? 1200, h: frame.current?.clientHeight ?? 800, cx: d?.canvas?.rect?.[0] ?? 361 };
          setShell((prev) => (JSON.stringify(prev) === JSON.stringify(sh) ? prev : sh));
        })
        .catch(() => {});
    measure();
    const id = setInterval(measure, 400);
    return () => { alive = false; clearInterval(id); };
  }, [aiModalOpen, docsOpen, call]);

  const closeAiBar = useCallback(() => {
    latest.current.aiModalOpen = false;
    setAiPickerOpen(false);
    setAiModalOpen(false);
    syncTheme(true, false);
    frame.current?.focus();
  }, [syncTheme]);

  const addAiImages = (files: File[]) => {
    files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 4)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setAiImages((prev) => [...prev, reader.result as string].slice(0, 4));
          }
        };
        reader.readAsDataURL(file);
      });
  };

  /** Interrompe a geração em andamento: cancela as chamadas à IA e o que já foi criado é mantido pelo orquestrador (ou removido se era só o quadro vazio). */
  const stop = () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    abortAllAiRequests('cancelado');
    setLog('Geração interrompida');
  };

  const run = async () => {
    const text = prompt.trim() || (aiImages.length ? 'Crie a tela seguindo exatamente o design das imagens de referência anexadas.' : '');
    if (!text || busy) return;
    setBusy(true);
    setLog('Lendo o documento...');
    const t0 = Date.now();
    const aiId = `a${t0}`;
    const sentImages = aiImages;
    const thumbs = (await Promise.all(sentImages.map(thumbOf))).filter(Boolean);
    setMessages((m) => [...m, { id: `u${t0}`, role: 'user', text, ts: t0, images: thumbs.length ? thumbs : undefined }, { id: aiId, role: 'ai', text: '', ts: t0 }]);
    setPrompt('');
    setAiImages([]);
    logSystemActivity('design', 'Iniciou geracao com IA no Design 2', projectName || 'Estudio de Design', {
      prompt: text,
      provider: selectedAiProvider,
      model: selectedModel,
    });
    // etapas ao vivo no chat: o que a IA está fazendo agora (analisando, planejando, criando a tela X, montando elementos...)
    const liveSteps: ExecutionStepItem[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, steps: liveSteps.map((st) => ({ ...st })) } : x)));
      }, 120);
    };
    const upsert = (id: string, type: ExecutionStepItem['type'], label: string) => {
      const at = liveSteps.findIndex((st) => st.id === id);
      if (at >= 0) { if (liveSteps[at].label === label) return; liveSteps[at] = { id, type, label }; }
      else { liveSteps.push({ id, type, label }); if (liveSteps.length > 60) liveSteps.shift(); }
      flush();
    };
    const progress = (msg: string) => {
      setLog(msg);
      const sec = Math.round((Date.now() - t0) / 1000);
      let mt: RegExpExecArray | null;
      if ((mt = /^Criando a tela "(.+)"/.exec(msg))) return upsert(`screen:${liveSteps.length}`, 'edit', `Criando a tela "${mt[1]}"`);
      if ((mt = /^Criando (.+)… \((\d+) elementos\)/.exec(msg))) return upsert('build', 'edit', `Montando a interface: ${mt[2]} elementos (último: ${mt[1]})`);
      if (/pensando no layout/.test(msg)) return upsert('think', 'thought', `Pensando no layout… ${sec}s`);
      if (/^Analisando \d+ imagem\(ns\) de referência… \d+s$/.test(msg)) return upsert('analysis', 'analyze', msg);
      if (/^Tela \d+ de \d+/.test(msg)) return upsert('multi', 'edit', msg);
      const type: ExecutionStepItem['type'] = /^(Analisando|Planejando|\d+ telas planejadas)/.test(msg) ? 'analyze' : /^(Lendo|Renderizando)/.test(msg) ? 'explore' : /^Conferindo/.test(msg) ? 'edit' : 'run';
      const last = liveSteps[liveSteps.length - 1];
      if (last && last.label === msg) return;
      upsert(`p:${liveSteps.length}`, type, msg);
    };
    try {
      const cancel = { cancelled: false };
      cancelRef.current = cancel;
      const doc = await call('document.inspect', { depth: 0 });
      const h0 = doc.history?.undo?.length ?? 0;
      const result = await runFigcraftAi({
        call, sync: syncRef.current!, prompt: text, images: sentImages, ws: workspacePath, projectName, useCtx: useProjectContext, useTokens: tokensFollowing, fastMode,
        provider: selectedAiProvider, model: selectedModel, accentColor, isDark: isEffectiveDark, selection: doc.selection || [],
        onProgress: progress, signal: cancel, onToast: (m) => setLog(m),
      });
      const n = result.layers;
      const after = await call('document.inspect', { depth: 0 }).catch(() => null);
      const undoSteps = Math.max(1, (after?.history?.undo?.length ?? h0 + 1) - h0);
      setLog(result.message);
      const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      const steps: ExecutionStepItem[] = [...liveSteps.map((st) => ({ ...st })), { id: 'apply', type: 'edit', label: `Aplicou ${n} camadas no canvas` }];
      setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, text: `Pronto: ${result.message} (${n} camadas).`, steps, workedDuration: `${secs}s`, undoSteps } : x)));
      onAiTaskDone?.({ ok: true, message: result.message, workspace: workspacePath });
      logSystemActivity('design', 'Concluiu geracao com IA no Design 2', projectName || 'Estudio de Design', {
        prompt: text,
        layersChanged: n,
      });
    } catch (e: any) {
      const stopped = /cancelado/i.test(String(e?.message));
      const msg = stopped ? 'Geração interrompida.' : e?.message || String(e);
      setLog(stopped ? msg : 'Erro: ' + msg);
      if (!stopped) onAiTaskDone?.({ ok: false, message: msg, workspace: workspacePath });
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, text: msg, error: !stopped, steps: liveSteps.length ? liveSteps.map((st) => ({ ...st })) : x.steps } : x)));
      logSystemActivity('design', 'Erro na geracao com IA no Design 2', projectName || 'Estudio de Design', {
        prompt: text,
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  };

  const providersList = aiProviders.length > 0 ? aiProviders : AI_PROVIDERS.map((p) => ({ id: p.id, name: p.name }));
  const activeProviderName = providersList.find((p) => p.id === selectedAiProvider)?.name || selectedAiProvider || 'IA';
  const activeModelLabel =
    (aiModelsByProvider[selectedAiProvider] || []).find((m) => m.id === selectedModel)?.label || selectedModel || '';
  const targetProvId = hoveredProv || selectedAiProvider;
  const targetProvName = providersList.find((p) => p.id === targetProvId)?.name || targetProvId || 'IA';
  const hoveredModels = aiModelsByProvider[targetProvId] || [];

  return (
    <div
      style={{
        position: 'relative',
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
        alignSelf: 'stretch',
        width: '100%',
        minWidth: 0,
        flex: '1 1 0',
        minHeight: 0,
        padding: 0,
        boxSizing: 'border-box',
        background: isEffectiveDark ? '#000000' : '#eaedf1',
      }}
    >
      <input
        ref={pickImageRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const url = String(reader.result || '');
            const data = url.slice(url.indexOf(',') + 1);
            call('ui.putImage', { data }).catch(() => {});
          };
          reader.readAsDataURL(file);
        }}
      />
      <iframe
        ref={frame}
        src="figcraft://app/index.html?v=7"
        title="FigCraft"
        style={{
          flex: 1,
          minHeight: 0,
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
        allow="clipboard-read; clipboard-write; gamepad"
      />

      {keysOpen && <UnsplashKeyPopup tokens={themeTokens as any} accentColor={accentColor} onClose={() => setKeysOpen(false)} onSaved={() => {}} />}

      {docsOpen && body && (
        <FigcraftDocsPanel
          call={call}
          rect={body}
          shell={shell}
          onClose={() => setDocsOpen(false)}
          themeTokens={themeTokens}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          projectName={projectName}
          workspacePath={workspacePath}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
        />
      )}

      {/* Painel de IA: ocupa o corpo da coluna esquerda no lugar de Paginas/Camadas (como o painel de Recursos), com historico de pedidos no design do chat da IDE */}
      {aiModalOpen && body && (
        <div
          id="design2-ai-prompt-bar"
          style={{
            position: 'absolute',
            // exatamente o corpo do cartao da coluna esquerda: o cartao (fundo e cantos) e do FigCraft
            top: body.y,
            left: body.x,
            width: body.w,
            height: body.h,
            background: 'transparent',
            border: 'none',
            padding: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            zIndex: 200,
            fontFamily: "'Poppins', sans-serif",
            userSelect: 'none',
            overflow: 'visible',
          }}
        >
          {/* Popover de Selecao de IA e Modelo (duas colunas, ancorado acima da barra) */}
          {aiPickerOpen && providersList.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                left: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                zIndex: 300,
                userSelect: 'none',
              }}
            >
              {/* Coluna da Esquerda: Modelos da IA ativa/hovered */}
              {hoveredModels.length > 0 && (
                <div
                  style={{
                    background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                    borderRadius: 12,
                    border: 'none',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    minWidth: 185,
                    maxWidth: 230,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  <div
                    style={{
                      padding: '4px 8px 6px',
                      fontSize: 10,
                      fontWeight: 400,
                      color: themeTokens.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 2,
                    }}
                  >
                    Modelos {targetProvName}
                  </div>
                  {hoveredModels.map((m) => {
                    const isCurrent = targetProvId === selectedAiProvider && m.id === selectedModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (targetProvId !== selectedAiProvider) onChangeAiProvider?.(targetProvId);
                          onChangeAiModel?.(m.id);
                          setAiPickerOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          background: isCurrent
                            ? isEffectiveDark
                              ? 'rgba(34, 197, 94, 0.16)'
                              : 'rgba(34, 197, 94, 0.12)'
                            : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          transition: 'background 0.12s ease',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: isCurrent ? '#22c55e' : themeTokens.textPrimary,
                            fontWeight: 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.label}
                        </span>
                        {isCurrent && <CheckRounded sx={{ fontSize: 14, color: '#22c55e' }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Coluna da Direita: Selecionar IA */}
              <div
                style={{
                  background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                  borderRadius: 12,
                  border: 'none',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 230,
                }}
              >
                <div
                  style={{
                    padding: '4px 8px 6px',
                    fontSize: 10,
                    fontWeight: 400,
                    color: themeTokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 2,
                  }}
                >
                  Selecionar IA e Modelo
                </div>
                {providersList.map((p) => {
                  const isSelected = p.id === selectedAiProvider;
                  const isHovered = p.id === targetProvId;
                  const provModels = aiModelsByProvider[p.id] || [];
                  const curModel = provModels.find((m) => m.id === selectedModel)?.label || provModels[0]?.label || '';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onMouseEnter={() => setHoveredProv(p.id)}
                      onClick={() => {
                        setHoveredProv(p.id);
                        onChangeAiProvider?.(p.id);
                        if (provModels[0]) onChangeAiModel?.(provModels[0].id);
                        if (provModels.length === 0) setAiPickerOpen(false);
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: isSelected
                          ? isEffectiveDark
                            ? 'rgba(34, 197, 94, 0.16)'
                            : 'rgba(34, 197, 94, 0.12)'
                          : isHovered
                          ? isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)'
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'background 0.12s ease',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        {renderAiIcon(p.id, 15)}
                        <span style={{ fontSize: 12, color: isSelected ? '#22c55e' : themeTokens.textPrimary, fontWeight: 400 }}>
                          {p.name}
                        </span>
                        {isSelected && curModel && (
                          <span
                            style={{
                              fontSize: 11,
                              color: themeTokens.textSecondary,
                              opacity: 0.8,
                              maxWidth: 95,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            · {curModel}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {isSelected && <CheckRounded sx={{ fontSize: 14, color: '#22c55e' }} />}
                        <KeyboardArrowRightRounded sx={{ fontSize: 15, color: themeTokens.textSecondary }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <AiChatHeader
            sessionTitle={sessionTitle}
            providerId={selectedAiProvider}
            providerName={activeProviderName}
            modelLabel={activeModelLabel}
            onNewChat={() => {
              if (messages.length) setSessions((s) => [{ id: `s${Date.now()}`, title: sessionTitle === 'Design 2' ? (messages.find((x) => x.role === 'user')?.text.slice(0, 40) || 'Conversa') : sessionTitle, ts: Date.now(), messages }, ...s]);
              setMessages([]);
              setSessionTitle('Design 2');
              setShowHistory(false);
            }}
            onOpenHistory={() => setShowHistory((v) => !v)}
            onRenameChat={setSessionTitle}
            onExportMarkdown={() => download('design2-chat.md', messages.map((m) => `**${m.role === 'user' ? 'Voce' : 'IA'}** (${new Date(m.ts).toLocaleString()})\n\n${m.text}\n`).join('\n'), 'text/markdown')}
            onExportJson={() => download('design2-chat.json', JSON.stringify(messages, null, 2), 'application/json')}
            onClearHistory={() => setMessages([])}
            onClosePanel={closeAiBar}
            onSelectModel={() => {
              setAiPickerOpen((v) => !v);
              setHoveredProv(selectedAiProvider);
            }}
            accentColor={accentColor}
            themeTokens={themeTokens}
            isEffectiveDark={isEffectiveDark}
          />

          {/* Historico: pedidos e respostas da IA (ou a lista de conversas anteriores) */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10, userSelect: 'text' }}>
            {showHistory ? (
              sessions.length === 0 ? (
                <div style={{ fontSize: 12, color: themeTokens.textMuted, textAlign: 'center', padding: 20 }}>Nenhuma conversa anterior</div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setMessages(s.messages); setSessionTitle(s.title); setShowHistory(false); }}
                    style={{ textAlign: 'left', background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 8, padding: '8px 10px', color: themeTokens.textPrimary, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                  >
                    <div style={{ fontSize: 12 }}>{s.title}</div>
                    <div style={{ fontSize: 10.5, color: themeTokens.textMuted }}>{new Date(s.ts).toLocaleString()} - {s.messages.filter((x) => x.role === 'user').length} pedidos</div>
                  </button>
                ))
              )
            ) : messages.length === 0 ? (
              <div style={{ fontSize: 12, color: themeTokens.textMuted, textAlign: 'center', padding: '28px 16px', lineHeight: 1.6 }}>
                Descreva a tela ou o ajuste que a IA deve fazer no canvas. Os pedidos e o que foi feito ficam aqui.
              </div>
            ) : (
              messages.map((m, idx) => {
                const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (m.role === 'user') {
                  return (
                    <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                      {m.images?.length ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {m.images.map((src, i) => (
                            <img key={i} src={src} alt={`Referencia ${i + 1}`} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                          ))}
                        </div>
                      ) : null}
                      <div style={{ background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '7px 10px', fontSize: 12, lineHeight: 1.5, color: themeTokens.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                      <span style={{ fontSize: 10, color: themeTokens.textMuted }}>{time}</span>
                    </div>
                  );
                }
                const working = busy && idx === messages.length - 1;
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {renderAiIcon(selectedAiProvider || 'claude', 14)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <AiChatTimeline
                        steps={m.steps}
                        workedDuration={m.workedDuration}
                        isWorking={working}
                        liveAction={log || undefined}
                        accentColor={accentColor}
                        themeTokens={themeTokens}
                        isEffectiveDark={isEffectiveDark}
                      />
                      {m.text && (
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: m.error ? '#ef4444' : themeTokens.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                      )}
                      {!working && !m.error && m.steps && (
                        <button
                          type="button"
                          onClick={async () => { for (let i = 0; i < (m.undoSteps || 1); i++) await call('engine.execute', { command: 'edit.undo', params: {} }).catch(() => {}); setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, undoSteps: undefined, steps: undefined, text: `${x.text} (desfeito)` } : x))); }}
                          style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: themeTokens.textSecondary, fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: "'Poppins', sans-serif" }}
                        >
                          Desfazer
                        </button>
                      )}
                      <span style={{ fontSize: 10, color: themeTokens.textMuted }}>{time}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEnd} />
          </div>

          {/* Container interno do prompt com linha divisoria e barra de acoes */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer.files || []);
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault();
                addAiImages(files);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 10px',
              margin: '0 8px 8px',
              gap: 8,
            }}
          >
            {aiImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {aiImages.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <img src={src} alt={`Referencia ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      title="Remover imagem"
                      onClick={() => setAiImages((prev) => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        border: 'none',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <CloseRounded sx={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData?.files || []);
                if (files.some((f) => f.type.startsWith('image/'))) {
                  e.preventDefault();
                  addAiImages(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  run();
                } else if (e.key === 'Escape') {
                  if (aiPickerOpen) {
                    setAiPickerOpen(false);
                  } else {
                    closeAiBar();
                  }
                }
              }}
              placeholder="Descreva a tela para a IA prototipar... Ex: 'Tela de login moderna com dark mode e botao Google'"
              disabled={busy}
              style={{
                width: '100%',
                minHeight: 72,
                maxHeight: 180,
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.5,
                fontFamily: "'Poppins', sans-serif",
                padding: 0,
                boxSizing: 'border-box',
              }}
            />

            {/* Linha Divisoria */}
            <div
              style={{
                height: 1,
                width: '100%',
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                margin: '2px 0',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
              <input
                ref={aiFileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  addAiImages(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              {/* Opcoes do pedido num popup: anexar, design tokens, modo rapido e contexto do projeto */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  title={aiImages.length ? `${aiImages.length} imagem(ns) de referência (cole, arraste ou clique para anexar mais)` : 'Anexar imagens de referência de design (também dá para colar ou arrastar)'}
                  onClick={() => aiFileRef.current?.click()}
                  style={{ width: 28, height: 28, border: 'none', borderRadius: 8, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: aiImages.length ? (isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent', color: aiImages.length ? accentColor : themeTokens.textMuted || themeTokens.textSecondary, cursor: 'pointer', transition: 'background .15s ease' }}
                >
                  <AttachFileRounded sx={{ fontSize: 16 }} />
                </button>
                <button
                  type="button"
                  title="Opcoes do pedido"
                  onClick={() => setPlusOpen((v) => !v)}
                  style={{
                    width: 28,
                    height: 28,
                    border: 'none',
                    borderRadius: 8,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: plusOpen ? (isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent',
                    color: aiImages.length || tokensFollowing || fastMode ? accentColor : themeTokens.textMuted || themeTokens.textSecondary,
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
                {plusOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 34,
                      left: 0,
                      minWidth: 210,
                      background: isEffectiveDark ? '#1f1f1f' : '#e2e8f0',
                      borderRadius: 10,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      zIndex: 320,
                    }}
                  >
                    {[
                      { key: 'attach', label: aiImages.length ? `Anexar imagens (${aiImages.length})` : 'Anexar imagens', icon: <AttachFileRounded sx={{ fontSize: 15 }} />, on: aiImages.length > 0, toggle: false, run: () => { aiFileRef.current?.click(); setPlusOpen(false); } },
                      { key: 'tokens', label: 'Design tokens', icon: <PaletteOutlined sx={{ fontSize: 15 }} />, on: tokensFollowing, toggle: true, run: () => setTokensFollowing((v) => !v) },
                      { key: 'fast', label: 'Modo rapido', icon: <BoltRounded sx={{ fontSize: 16 }} />, on: fastMode, toggle: true, run: () => setFastMode((v) => !v) },
                      { key: 'img', label: 'Chaves de imagens (pessoas)', icon: <ImageOutlined sx={{ fontSize: 15 }} />, on: false, toggle: false, run: () => { setKeysOpen(true); setPlusOpen(false); } },
                      { key: 'ctx', label: 'Contexto do projeto', icon: <InfoOutlined sx={{ fontSize: 15 }} />, on: useProjectContext, toggle: true, run: () => setUseProjectContext((v) => !v) },
                    ].map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={o.run}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', color: themeTokens.textPrimary, fontSize: 12, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", textAlign: 'left' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ display: 'flex', color: o.on ? accentColor : themeTokens.textSecondary }}>{o.icon}</span>
                        <span style={{ flex: 1 }}>{o.label}</span>
                        {o.toggle && (
                          <span style={{ position: 'relative', width: 24, height: 14, borderRadius: 8, background: o.on ? accentColor : isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)', flexShrink: 0 }}>
                            <span style={{ position: 'absolute', top: 2, left: o.on ? 12 : 2, width: 10, height: 10, borderRadius: 5, background: '#fff', transition: 'left 0.15s ease' }} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }} />

              <button
                type="button"
                disabled={!busy && !prompt.trim() && !aiImages.length}
                onClick={busy ? stop : run}
                title={busy ? 'Parar a geração' : 'Gerar (Enter)'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  background: busy || prompt.trim()
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.08)',
                  color: busy || prompt.trim() ? '#ffffff' : themeTokens.textMuted || themeTokens.textSecondary,
                  border: 'none',
                  borderRadius: 6,
                  padding: '0 14px',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: busy || prompt.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {busy ? <StopRounded sx={{ fontSize: 17 }} /> : <AutoAwesomeOutlined sx={{ fontSize: 15 }} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
