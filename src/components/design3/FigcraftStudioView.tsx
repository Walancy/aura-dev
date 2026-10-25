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
import { cutoutTrimmed, exportNodePng, setImageFill } from './figcraftBg';
import ContentCutRounded from '@mui/icons-material/ContentCutRounded';
import { abortAllAiRequests } from '../design2/aiScreenFromLlm';
import StopRounded from '@mui/icons-material/StopRounded';
import UnsplashKeyPopup from '../design2/UnsplashKeyPopup';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import { findProjectPrd, mentionsPrd, readPrdFile, type Prd } from './figcraftPrd';
import { logSystemActivity } from '../../utils/brainService';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { AI_PROVIDERS } from '../../constants/ai';
import {
  extractDesignManifestFromInspect,
  syncDesignBridgeToWorkspace,
  buildDesignImplementationPrompt,
  buildCliTerminalDesignPrompt,
  type DesignBridgeManifest,
  type DesignScreenSpec,
} from '../../utils/designBridgeService';
import CodeRounded from '@mui/icons-material/CodeRounded';
import TerminalRounded from '@mui/icons-material/TerminalRounded';
import { findFreeSpot } from '../design2/freeSpot';

interface CanvasSelectedItem {
  id: number;
  name: string;
  kind: 'image' | 'screen' | 'element';
  width: number;
  height: number;
}

function extractCanvasSelection(inspected: any): CanvasSelectedItem[] {
  const sel: number[] = Array.isArray(inspected?.selection) ? inspected.selection.filter((x: any) => typeof x === 'number') : [];
  if (!sel.length) return [];
  const page = (inspected?.pages || []).find((p: any) => p.id === inspected?.currentPage) || inspected?.pages?.[0];
  if (!page) return [];
  const rawIdx = new Map<number, any>();
  const rawParentIdx = new Map<number, number>();
  const walk = (n: any, parentId?: number) => {
    if (!n || typeof n.id !== 'number') return;
    rawIdx.set(n.id, n);
    if (parentId !== undefined) rawParentIdx.set(n.id, parentId);
    for (const c of n.children || []) walk(c, n.id);
  };
  for (const c of page.children || []) walk(c, undefined);
  const rootOf = (id: number): number => {
    let cur = id;
    while (rawParentIdx.has(cur)) cur = rawParentIdx.get(cur)!;
    return cur;
  };
  const isStandaloneImage = (node: any): boolean => {
    if (!node) return false;
    const kids = node.children || [];
    const hasImg = (node.fills || []).some((f: any) => f.type === 'image');
    if (hasImg && kids.length === 0) return true;
    if (kids.length === 1 && (kids[0].fills || []).some((f: any) => f.type === 'image') && !(kids[0].children || []).length) return true;
    return false;
  };
  const out: CanvasSelectedItem[] = [];
  const seen = new Set<number>();
  for (const id of sel) {
    const n = rawIdx.get(id);
    if (!n || n.visible === false) continue;
    const rId = rootOf(id);
    const rootNode = rawIdx.get(rId) || n;
    if (id !== rId && isStandaloneImage(n)) {
      // imagem dentro de uma tela/grupo: o proprio no e a selecao
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: String(n.name || 'Imagem'),
        kind: 'image',
        width: Math.round(n.width || 400),
        height: Math.round(n.height || 300),
      });
    } else if (isStandaloneImage(rootNode)) {
      if (seen.has(rId)) continue;
      seen.add(rId);
      out.push({
        id: rId,
        name: String(rootNode.name || 'Imagem no canvas'),
        kind: 'image',
        width: Math.round(rootNode.width || 400),
        height: Math.round(rootNode.height || 300),
      });
    } else if (id === rId && String(n.type || '').toLowerCase() === 'frame') {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: String(n.name || 'Tela'),
        kind: 'screen',
        width: Math.round(n.width || 393),
        height: Math.round(n.height || 852),
      });
    } else {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: String(n.name || n.type || 'Elemento'),
        kind: 'element',
        width: Math.round(n.width || 100),
        height: Math.round(n.height || 40),
      });
    }
  }
  return out;
}

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
  /** envia telas geradas no Design para implementação imediata no chat da IDE */
  onImplementInIde?: (payload: { prompt: string; screens: DesignScreenSpec[]; manifest: DesignBridgeManifest }) => void;
  /** envia telas geradas no Design para implementação imediata no terminal CLI ativo */
  onSendToCli?: (payload: { prompt: string; screens: DesignScreenSpec[]; manifest: DesignBridgeManifest }) => void;
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
  onImplementInIde,
  onSendToCli,
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
  const prdFileRef = useRef<HTMLInputElement>(null);
  const [prd, setPrd] = useState<Prd | null>(null);
  const [prdMsg, setPrdMsg] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const copyError = (id: string, text: string) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopiedId(id); setTimeout(() => setCopiedId((c) => (c === id ? '' : c)), 1500); };
  const flashPrdMsg = (m: string) => { setPrdMsg(m); setTimeout(() => setPrdMsg(''), 4000); };
  /** o que cada pedido enviou (texto, imagens, seleção, PRD): o "Tentar novamente" repete exatamente isso */
  const runInfo = useRef(new Map<string, { text: string; images: string[]; selection: number[]; prd: Prd | null }>());

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
  const [userInteractedCanvas, setUserInteractedCanvas] = useState(false);
  const latest = useRef({ isEffectiveDark, accentColor, projectName, projectSubtitle, userInitial, aiModalOpen, docsOpen, workspacePath });
  latest.current = { isEffectiveDark, accentColor, projectName, projectSubtitle, userInitial, aiModalOpen, docsOpen, workspacePath };

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
  const [bridgeManifest, setBridgeManifest] = useState<DesignBridgeManifest | null>(null);
  const [handoffMenuOpen, setHandoffMenuOpen] = useState(false);
  const [selectedHandoffScreenId, setSelectedHandoffScreenId] = useState<string>('all');
  const previewCacheRef = useRef<Record<string, string>>({});
  const screenSigCacheRef = useRef<Record<string, string>>({});

  const syncDesignBridge = useCallback(
    async (ws: string, exportPreviews = false): Promise<DesignBridgeManifest | null> => {
      if (!ws) return null;
      try {
        const inspected = await call('document.inspect', { depth: 12 });
        if (!inspected) return null;

        const manifest = extractDesignManifestFromInspect(
          inspected,
          ws,
          latest.current.projectName,
          previewCacheRef.current
        );

        let anyExported = false;
        for (const screen of manifest.screens) {
          const sid = String(screen.id);
          const sigKey = `${ws}:${sid}`;
          const nextSig = JSON.stringify({
            name: screen.name,
            width: screen.width,
            height: screen.height,
            backgroundHex: screen.backgroundHex,
            elementCount: screen.elementCount,
            texts: screen.texts,
            colors: screen.colors,
            components: screen.components,
          });
          const sigChanged = screenSigCacheRef.current[sigKey] !== nextSig;
          if (!previewCacheRef.current[sid] || (exportPreviews && sigChanged)) {
            const numericId = Number(sid);
            if (!Number.isNaN(numericId)) {
              try {
                const exp = await call('engine.execute', {
                  command: 'file.export',
                  params: { ids: [numericId], format: 'jpg', scale: 1 },
                });
                anyExported = true;
                if (exp?.data) {
                  const dataUrl = `data:image/jpeg;base64,${exp.data}`;
                  previewCacheRef.current[sid] = dataUrl;
                  screen.previewDataUrl = dataUrl;
                  screenSigCacheRef.current[sigKey] = nextSig;
                }
              } catch {}
            }
          } else if (previewCacheRef.current[sid]) {
            screen.previewDataUrl = previewCacheRef.current[sid];
          }
        }

        // engine.execute(file.export) increments the WASM page revision counter; clear the dirty flag so saveProject(8s) does not loop
        if (anyExported) {
          await call('doc.dump', { ifDirty: true }).catch(() => {});
        }

        setBridgeManifest((prev) => {
          if (
            prev &&
            prev.workspacePath === manifest.workspacePath &&
            JSON.stringify(prev.selectedScreenIds) === JSON.stringify(manifest.selectedScreenIds) &&
            prev.screens.length === manifest.screens.length &&
            prev.screens.every(
              (s, idx) =>
                s.id === manifest.screens[idx]?.id &&
                s.name === manifest.screens[idx]?.name &&
                s.width === manifest.screens[idx]?.width &&
                s.height === manifest.screens[idx]?.height &&
                s.elementCount === manifest.screens[idx]?.elementCount &&
                s.previewDataUrl === manifest.screens[idx]?.previewDataUrl
            )
          ) {
            return prev;
          }
          return manifest;
        });
        await syncDesignBridgeToWorkspace(manifest);
        return manifest;
      } catch {
        return null;
      }
    },
    [call]
  );

  const handleHandoffDesign = useCallback(
    async (target: 'ide' | 'cli', specificScreenId?: string) => {
      setHandoffMenuOpen(false);
      const manifest = (await syncDesignBridge(workspacePath, true)) || bridgeManifest;
      if (!manifest || manifest.screens.length === 0) return;

      const canvasSelectedIds = manifest.selectedScreenIds || [];
      let chosenScreens = manifest.screens;
      if (specificScreenId && specificScreenId !== 'all' && specificScreenId !== 'selected') {
        chosenScreens = manifest.screens.filter((s) => s.id === specificScreenId || s.slug === specificScreenId);
      } else if (canvasSelectedIds.length > 0) {
        chosenScreens = manifest.screens.filter((s) => canvasSelectedIds.includes(s.id));
      } else if (selectedHandoffScreenId && selectedHandoffScreenId !== 'all') {
        chosenScreens = manifest.screens.filter((s) => s.id === selectedHandoffScreenId || s.slug === selectedHandoffScreenId);
      }
      const finalScreens = chosenScreens.length > 0 ? chosenScreens : manifest.screens;

      if (target === 'ide') {
        const promptText = buildDesignImplementationPrompt(manifest, finalScreens);
        onImplementInIde?.({ prompt: promptText, screens: finalScreens, manifest });
      } else {
        const promptText = buildCliTerminalDesignPrompt(manifest, finalScreens);
        onSendToCli?.({ prompt: promptText, screens: finalScreens, manifest });
      }
    },
    [workspacePath, bridgeManifest, selectedHandoffScreenId, syncDesignBridge, onImplementInIde, onSendToCli]
  );

  // Sincroniza as telas e previews reais ao sair da aba Design para a IDE ou CLI
  const prevActiveRef = useRef(isActive);
  useEffect(() => {
    if (prevActiveRef.current && !isActive && workspacePath && !switching.current && !busy) {
      syncDesignBridge(workspacePath, true).catch(() => {});
    }
    prevActiveRef.current = isActive;
  }, [isActive, workspacePath, busy, syncDesignBridge]);

  const projFile = (ws: string) => `${ws}/.devflow/figcraft/project.json`;
  const saveProject = useCallback(async (ws: string, onlyIfDirty: boolean) => {
    const fs = (window as any).electronAPI?.fs;
    if (!ws || !fs?.writeFile) return;
    const r = await call('doc.dump', { ifDirty: onlyIfDirty });
    if (r?.data) {
      await fs.writeFile(projFile(ws), JSON.stringify({ version: 1, updatedAt: Date.now(), data: r.data }));
      syncDesignBridge(ws, true).catch(() => {});
    }
  }, [call, syncDesignBridge]);
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
        await call('engine.execute', { command: 'select.set', params: { ids: [] } }).catch(() => {});
        setUserInteractedCanvas(false);
        syncRef.current = new FcSync(call);
        if (!data) {
          await ensureDefaultPages();
        } else {
          // Remove efeitos que forcam o vello_cpu (retained.rs) a cachear frames/cards como bitmaps que ficam embacados ao dar zoom
          try {
            const inspected = await call('document.inspect', { depth: 16 });
            let anySanitized = false;
            const idsToClear: number[] = [];
            const collectEffectNodes = (n: any) => {
              if (Array.isArray(n.effects) && n.effects.length > 0 && typeof n.id === 'number') {
                idsToClear.push(n.id);
              }
              for (const c of n.children || []) collectEffectNodes(c);
            };
            for (const p of inspected?.pages || []) {
              for (const c of p.children || []) collectEffectNodes(c);
            }
            if (idsToClear.length > 0) {
              anySanitized = true;
              await call('engine.execute', { command: 'node.set', params: { ids: idsToClear, props: { effects: [] } } }).catch(() => {});
            }
            if (anySanitized && workspacePath) {
              setTimeout(() => {
                if (!switching.current && loadedFor.current === workspacePath) {
                  saveProject(workspacePath, false).catch(() => {});
                }
              }, 2000);
            }
          } catch { /* documento continua utilizavel */ }
        }
        themeKey.current = '';
        syncTheme(true);
        loadedFor.current = workspacePath;
        if (workspacePath) {
          setTimeout(() => {
            if (!switching.current && loadedFor.current === workspacePath) {
              syncDesignBridge(workspacePath, true).catch(() => {});
            }
          }, 900);
        }
      } catch { /* sem restaurar: nao grava por cima do projeto */ } finally {
        switching.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);
  useEffect(() => {
    const tick = () => { if (!switching.current && !busy && loadedFor.current === workspacePath) saveProject(workspacePath, true).catch(() => {}); };
    const t = setInterval(tick, 8000);
    return () => { clearInterval(t); tick(); };
  }, [workspacePath, busy, saveProject]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickImageRef = useRef<HTMLInputElement>(null);
  const [canvasSelection, setCanvasSelection] = useState<CanvasSelectedItem[]>([]);

  const placeImagesOnCanvas = useCallback(
    async (items: Array<{ dataUrl: string; width?: number; height?: number; name?: string }>, undoInternalPaste?: boolean) => {
      if (!items.length) return;
      try {
        if (undoInternalPaste) {
          await call('engine.execute', { command: 'edit.undo', params: {} }).catch(() => {});
        }
        const inspected = await call('document.inspect', { depth: 4 }).catch(() => null);
        const page = (inspected?.pages || []).find((p: any) => p.id === inspected?.currentPage) || inspected?.pages?.[0];
        const existingBoxes = ((page?.children || []) as any[])
          .filter((c) => c && c.visible !== false)
          .map((c, idx) => ({
            id: String(c.id ?? idx),
            type: 'frame' as const,
            name: String(c.name || ''),
            x: Number(c.x || 0),
            y: Number(c.y || 0),
            width: Number(c.width || 400),
            height: Number(c.height || 300),
            rotation: 0,
            fill: '#000000',
            stroke: 'none',
            strokeWidth: 0,
            opacity: 1,
            cornerRadius: 0,
            visible: true,
            locked: false,
            zIndex: idx,
          }));
        // como no Figma: a imagem entra no centro do objeto selecionado; sem seleção, no centro da área visível do canvas
        const container = extractCanvasSelection(inspected).find((c) => c.kind !== 'image') ?? null;
        const view = container ? null : await call('engine.execute', { command: 'view.get', params: {} }).catch(() => null);
        const vcx = Number(view?.cx ?? view?.center?.x ?? view?.center?.[0]);
        const vcy = Number(view?.cy ?? view?.center?.y ?? view?.center?.[1]);
        const hasView = Number.isFinite(vcx) && Number.isFinite(vcy);
        const maxRight = existingBoxes.length
          ? Math.max(...existingBoxes.map((b) => b.x + b.width))
          : 0;
        const firstY = existingBoxes.length ? existingBoxes[0].y : 100;
        let curX = existingBoxes.length ? maxRight + 120 : 100;
        const curY = firstY;

        const placedIds: number[] = [];
        const placedItems: CanvasSelectedItem[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const url = String(item.dataUrl || '');
          const commaIdx = url.indexOf(',');
          const base64 = commaIdx >= 0 ? url.slice(commaIdx + 1) : url;
          if (!base64) continue;
          const rawW = Math.max(48, Math.round(item.width || 400));
          const rawH = Math.max(48, Math.round(item.height || 300));
          // Mantém proporção original da imagem colada, limitando lado maior a 960px para caber bem ao lado das telas
          const scale = Math.min(1, 960 / Math.max(rawW, rawH), container ? Math.min(container.width / rawW, container.height / rawH) : 1);
          const targetW = Math.max(container ? 8 : 64, Math.round(rawW * scale));
          const targetH = Math.max(container ? 8 : 64, Math.round(rawH * scale));
          const spot = container
            ? { x: Math.round((container.width - targetW) / 2), y: Math.round((container.height - targetH) / 2) }
            : hasView
            ? { x: i === 0 ? Math.round(vcx - targetW / 2) : curX, y: Math.round(vcy - targetH / 2) }
            : i === 0
            ? findFreeSpot(existingBoxes as any, curX, curY, targetW + 60, targetH + 60)
            : { x: curX, y: curY };
          const pr = await call('engine.execute', {
            command: 'image.place',
            params: {
              data: base64,
              ...(container ? { parent: container.id } : {}),
              x: spot.x,
              y: spot.y,
              width: targetW,
              height: targetH,
              mode: 'fill',
            },
          }).catch(() => null);
          const pid = pr?.id ?? pr?.ids?.[0];
          if (typeof pid === 'number') {
            const nodeName = item.name || (items.length > 1 ? `Imagem colada ${i + 1}` : 'Imagem colada');
            await call('engine.execute', {
              command: 'node.set',
              params: { ids: [pid], props: { name: nodeName, width: targetW, height: targetH } },
            }).catch(() => {});
            placedIds.push(pid);
            placedItems.push({ id: pid, name: nodeName, kind: 'image', width: targetW, height: targetH });
            curX = container ? curX : spot.x + targetW + 80;
          }
        }
        if (placedIds.length) {
          await call('engine.execute', { command: 'select.set', params: { ids: placedIds } }).catch(() => {});
          setCanvasSelection(placedItems);
          setUserInteractedCanvas(true);
          setLog(placedIds.length === 1 ? 'Imagem colada e selecionada no canvas' : `${placedIds.length} imagens coladas e selecionadas no canvas`);
          logSystemActivity('design', 'Colou imagem no canvas do Design', latest.current.projectName || 'Estudio de Design', {
            count: placedIds.length,
          });
          if (latest.current.workspacePath) {
            saveProject(latest.current.workspacePath, true).catch(() => {});
          }
        }
      } catch {}
    },
    [call, saveProject]
  );

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.data?.fcCanvasInput) {
        setUserInteractedCanvas(true);
      }
      if (Array.isArray(e.data?.fcPasteImages) && e.data.fcPasteImages.length > 0) {
        placeImagesOnCanvas(e.data.fcPasteImages, Boolean(e.data?.fcUndoInternalPaste));
      }
      if (e.data?.fcSelectionSync) {
        try {
          if (e.data?.fcUserInteracted || e.data?.userInteracted) setUserInteractedCanvas(true);
          const inspected =
            typeof e.data.fcSelectionSync === 'string'
              ? JSON.parse(e.data.fcSelectionSync)
              : e.data.fcSelectionSync;
          if (inspected) {
            const nextSel = extractCanvasSelection(inspected);
            setCanvasSelection((prev) =>
              JSON.stringify(prev) === JSON.stringify(nextSel) ? prev : nextSel
            );
            if (latest.current.workspacePath) {
              const manifest = extractDesignManifestFromInspect(
                inspected,
                latest.current.workspacePath,
                latest.current.projectName,
                previewCacheRef.current
              );
              setBridgeManifest((prev) => {
                if (
                  prev &&
                  prev.workspacePath === manifest.workspacePath &&
                  JSON.stringify(prev.selectedScreenIds) === JSON.stringify(manifest.selectedScreenIds) &&
                  prev.screens.length === manifest.screens.length &&
                  prev.screens.every(
                    (s, idx) =>
                      s.id === manifest.screens[idx]?.id &&
                      s.name === manifest.screens[idx]?.name &&
                      s.width === manifest.screens[idx]?.width &&
                      s.height === manifest.screens[idx]?.height &&
                      s.elementCount === manifest.screens[idx]?.elementCount
                  )
                ) {
                  return prev;
                }
                return manifest;
              });
            }
          }
        } catch {}
      }
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
  }, [syncTheme, ensureDefaultPages, placeImagesOnCanvas]);

  // Também permite colar imagens no canvas quando o foco estiver na janela pai (fora de inputs/textareas)
  useEffect(() => {
    if (!isActive) return;
    const onParentPaste = async (e: ClipboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
        return;
      }
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const loaded = await Promise.all(
        files.slice(0, 6).map(
          (file, idx) =>
            new Promise<{ dataUrl: string; width: number; height: number; name: string } | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (!dataUrl) return resolve(null);
                const img = new Image();
                img.onload = () =>
                  resolve({
                    dataUrl,
                    width: img.naturalWidth || img.width || 400,
                    height: img.naturalHeight || img.height || 300,
                    name: file.name ? file.name.replace(/\.[^.]+$/, '') : idx > 0 ? `Imagem colada ${idx + 1}` : 'Imagem colada',
                  });
                img.onerror = () => resolve({ dataUrl, width: 400, height: 300, name: 'Imagem colada' });
                img.src = dataUrl;
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            })
        )
      );
      const valid = loaded.filter((x): x is { dataUrl: string; width: number; height: number; name: string } => Boolean(x));
      if (valid.length) {
        placeImagesOnCanvas(valid);
      }
    };
    window.addEventListener('paste', onParentPaste);
    return () => window.removeEventListener('paste', onParentPaste);
  }, [isActive, placeImagesOnCanvas]);

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
    addEventListener('resize', measure);
    const id = setInterval(measure, 800);
    return () => { alive = false; removeEventListener('resize', measure); clearInterval(id); };
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

  const hasSelectedCanvasImage = canvasSelection.some((s) => s.kind === 'image');
  const [cutBusyId, setCutBusyId] = useState<number | null>(null);

  /** Remove o fundo da imagem selecionada no canvas e troca o preenchimento da própria camada. */
  const removeImageBg = async (item: CanvasSelectedItem) => {
    if (cutBusyId !== null || busy) return;
    setCutBusyId(item.id);
    setLog('Removendo o fundo da imagem...');
    try {
      const src = await exportNodePng(call, item.id);
      if (!src) throw new Error('Não consegui ler a imagem selecionada');
      const r = await cutoutTrimmed(src);
      if (!r.dataUrl) throw new Error(r.error || 'Não consegui remover o fundo da imagem');
      if (!(await setImageFill(call, item.id, r.dataUrl))) throw new Error('Não consegui aplicar a imagem sem fundo');
      setLog('Fundo removido');
      logSystemActivity('design', 'Removeu o fundo de uma imagem no Design', projectName || 'Estudio de Design', { layer: item.name });
    } catch (e: any) {
      setLog('Erro: ' + (e?.message || String(e)));
    } finally {
      setCutBusyId(null);
    }
  };

  const run = async (re?: { aiId: string }) => {
    const info = re ? runInfo.current.get(re.aiId) : undefined;
    const failedUserId = re ? `u${re.aiId.slice(1)}` : '';
    const text =
      info?.text ??
      (re ? messages.find((m) => m.id === failedUserId)?.text : undefined) ??
      (prompt.trim() ||
        (aiImages.length
          ? 'Crie a tela seguindo exatamente o design das imagens de referência anexadas.'
          : hasSelectedCanvasImage
          ? 'Recrie a tela da imagem selecionada no canvas em camadas editáveis.'
          : prd
          ? 'Crie todas as telas do projeto com base no PRD enviado.'
          : ''));
    if (!text || busy) return;
    if (re) setMessages((m) => m.filter((x) => x.id !== re.aiId && x.id !== failedUserId));
    setBusy(true);
    setLog('Lendo o documento...');
    const t0 = Date.now();
    const aiId = `a${t0}`;
    const sentImages = info ? info.images : re ? [] : aiImages;
    let sentPrd: Prd | null = info ? info.prd : re ? null : prd;
    const chatThumbs = (await Promise.all(sentImages.map(thumbOf))).filter(Boolean);
    // Miniaturas dos itens selecionados no canvas (imagens coladas e/ou telas selecionadas) para exibir no histórico do chat
    const canvasThumbs: string[] = [];
    if (!re && canvasSelection.length > 0) {
      for (const selItem of canvasSelection.slice(0, 3)) {
        try {
          const exp = await call('engine.execute', {
            command: 'file.export',
            params: { ids: [selItem.id], format: 'jpg', scale: 0.35 },
          });
          if (exp?.data) {
            const t = await thumbOf(`data:image/jpeg;base64,${exp.data}`);
            if (t) canvasThumbs.push(t);
          }
        } catch {}
      }
    }
    const thumbs = [...chatThumbs, ...canvasThumbs].slice(0, 4);
    setMessages((m) => [...m, { id: `u${t0}`, role: 'user', text, ts: t0, images: thumbs.length ? thumbs : undefined }, { id: aiId, role: 'ai', text: '', ts: t0 }]);
    if (!re) { setPrompt(''); setAiImages([]); setPrd(null); }
    logSystemActivity('design', 'Iniciou geracao com IA no Design 2', projectName || 'Estudio de Design', {
      prompt: text,
      provider: selectedAiProvider,
      model: selectedModel,
      canvasSelectionCount: canvasSelection.length,
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
      if (info?.selection.length) await call('engine.execute', { command: 'select.set', params: { ids: info.selection } }).catch(() => {});
      if (!sentPrd && mentionsPrd(text)) {
        progress('Lendo o PRD da pasta do projeto…');
        sentPrd = await findProjectPrd(workspacePath);
        if (!sentPrd) throw new Error('Não encontrei um PRD na pasta do projeto. Use + > Enviar PRD para anexar o arquivo.');
      }
      const doc = await call('document.inspect', { depth: 0 });
      const activeSelectionIds: number[] = Array.isArray(doc.selection) && doc.selection.length
        ? doc.selection
        : canvasSelection.map((s) => s.id);
      runInfo.current.set(aiId, { text, images: sentImages, selection: activeSelectionIds, prd: sentPrd });
      const h0 = doc.history?.undo?.length ?? 0;
      const result = await runFigcraftAi({
        call, sync: syncRef.current!, prompt: text, images: sentImages, ws: workspacePath, projectName, useCtx: useProjectContext, useTokens: tokensFollowing, fastMode,
        provider: selectedAiProvider, model: selectedModel, accentColor, isDark: isEffectiveDark, selection: activeSelectionIds, prd: sentPrd?.text,
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
      await syncDesignBridge(workspacePath, true).catch(() => {});
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
        src="figcraft://app/index.html?v=15"
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

      {(() => {
        const img = canvasSelection.find((c) => c.kind === 'image');
        if (!img) return null;
        const working = cutBusyId === img.id;
        return (
          <button
            type="button"
            title="Remover o fundo da imagem selecionada"
            disabled={cutBusyId !== null || busy}
            onClick={() => removeImageBg(img)}
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: 'none',
              background: accentColor,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 400,
              cursor: cutBusyId !== null || busy ? 'default' : 'pointer',
              opacity: cutBusyId !== null || busy ? 0.7 : 1,
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              zIndex: 5,
            }}
          >
            {working ? (
              <AutorenewRounded sx={{ fontSize: 16, animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
            ) : (
              <ContentCutRounded sx={{ fontSize: 16 }} />
            )}
            {working ? 'Removendo fundo...' : 'Remover fundo'}
          </button>
        );
      })()}

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
            <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setAiPickerOpen(false)} />
            <div
              style={{
                position: 'absolute',
                top: 44,
                left: 8,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 5,
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
                    order: 2,
                    width: 230,
                    flexShrink: 0,
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
                  order: 1,
                  width: 260,
                  flexShrink: 0,
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
            </>
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
                      {m.error && m.text && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12 }}>
                            <ErrorOutlineRounded sx={{ fontSize: 16 }} />
                            <span>Erro</span>
                            <button
                              type="button"
                              title={copiedId === m.id ? 'Copiado' : 'Copiar o erro'}
                              onClick={() => copyError(m.id, m.text)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, padding: 0, border: 'none', borderRadius: 6, background: copiedId === m.id ? 'rgba(239,68,68,0.18)' : 'transparent', color: '#ef4444', cursor: 'pointer', transition: 'background .15s ease, transform .15s ease', transform: copiedId === m.id ? 'scale(1.15)' : 'scale(1)' }}
                              onMouseEnter={(e) => { if (copiedId !== m.id) e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                              onMouseLeave={(e) => { if (copiedId !== m.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                              {copiedId === m.id ? <CheckRounded sx={{ fontSize: 15 }} /> : <ContentCopyRounded sx={{ fontSize: 15 }} />}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#ef4444', whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>{m.text}</div>
                        </div>
                      )}
                      {!m.error && m.text && (
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: m.error ? '#ef4444' : themeTokens.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                      )}
                      {m.error && !working && !busy && (
                        <button
                          type="button"
                          onClick={() => run({ aiId: m.id })}
                          onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'; const i = e.currentTarget.querySelector('svg'); if (i) (i as SVGElement).style.transform = 'rotate(-180deg)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; const i = e.currentTarget.querySelector('svg'); if (i) (i as SVGElement).style.transform = 'rotate(0deg)'; }}
                          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 6, border: 'none', background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: themeTokens.textPrimary, fontSize: 12, fontWeight: 400, cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'background .15s ease' }}
                        >
                          <ReplayRounded sx={{ fontSize: 15, color: accentColor, transition: 'transform .3s ease' }} />
                          Tentar novamente
                        </button>
                      )}
                      {!working && !m.error && m.steps && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
                          <button
                            type="button"
                            onClick={() => handleHandoffDesign('ide', 'all')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              height: 24,
                              padding: '0 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              fontFamily: "'Poppins', sans-serif",
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                            }}
                            title="Abrir chat da IDE e implementar este design no código do projeto"
                          >
                            <CodeRounded sx={{ fontSize: 13, color: accentColor }} />
                            Implementar na IDE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHandoffDesign('cli', 'all')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              height: 24,
                              padding: '0 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              fontFamily: "'Poppins', sans-serif",
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                            }}
                            title="Enviar especificação completa e imagens para o agente ativo no Terminal CLI"
                          >
                            <TerminalRounded sx={{ fontSize: 13, color: '#22c55e' }} />
                            Enviar ao CLI
                          </button>
                          <button
                            type="button"
                            onClick={async () => { for (let i = 0; i < (m.undoSteps || 1); i++) await call('engine.execute', { command: 'edit.undo', params: {} }).catch(() => {}); setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, undoSteps: undefined, steps: undefined, text: `${x.text} (desfeito)` } : x))); }}
                            style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, fontSize: 11, cursor: 'pointer', padding: '0 4px', height: 24, fontFamily: "'Poppins', sans-serif" }}
                          >
                            Desfazer
                          </button>
                        </div>
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
            {canvasSelection.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {canvasSelection.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    title={`${item.kind === 'image' ? 'Imagem selecionada no canvas' : item.kind === 'screen' ? 'Tela selecionada no canvas' : 'Elemento selecionado no canvas'}: ${item.name} (${item.width}x${item.height})`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                      color: themeTokens.textPrimary,
                      fontSize: 11,
                      fontWeight: 400,
                      maxWidth: '100%',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {item.kind === 'image' ? (
                      <ImageOutlined sx={{ fontSize: 13, color: accentColor, flexShrink: 0 }} />
                    ) : (
                      <PaletteOutlined sx={{ fontSize: 13, color: accentColor, flexShrink: 0 }} />
                    )}
                    <span style={{ color: themeTokens.textSecondary, flexShrink: 0 }}>
                      {item.kind === 'image' ? 'Imagem:' : item.kind === 'screen' ? 'Tela:' : 'Item:'}
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 120,
                      }}
                    >
                      {item.name}
                    </span>
                    {item.kind === 'image' && (
                      <button
                        type="button"
                        title="Remover fundo da imagem"
                        disabled={cutBusyId !== null || busy}
                        onClick={() => removeImageBg(item)}
                        onMouseEnter={(e) => { e.currentTarget.style.color = accentColor; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = themeTokens.textSecondary; }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 400,
                          color: themeTokens.textSecondary,
                          cursor: cutBusyId !== null || busy ? 'default' : 'pointer',
                          opacity: cutBusyId !== null && cutBusyId !== item.id ? 0.5 : 1,
                          transition: 'color 0.15s ease, opacity 0.15s ease',
                        }}
                      >
                        {cutBusyId === item.id ? (
                          <AutorenewRounded sx={{ fontSize: 12, animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
                        ) : (
                          <ContentCutRounded sx={{ fontSize: 12 }} />
                        )}
                        Remover fundo
                      </button>
                    )}
                    <button
                      type="button"
                      title="Remover da seleção"
                      onClick={() => {
                        const nextIds = canvasSelection.filter((x) => x.id !== item.id).map((x) => x.id);
                        setCanvasSelection((prev) => prev.filter((x) => x.id !== item.id));
                        call('engine.execute', { command: 'select.set', params: { ids: nextIds } }).catch(() => {});
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        color: themeTokens.textMuted || themeTokens.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      <CloseRounded sx={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

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

            {(prd || prdMsg) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
                {prd && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 8px', borderRadius: 6, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: themeTokens.textPrimary, fontSize: 12, minWidth: 0 }}>
                    <DescriptionOutlined sx={{ fontSize: 15, color: accentColor }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{prd.name}</span>
                    <button type="button" title="Remover PRD" onClick={() => setPrd(null)} style={{ display: 'flex', border: 'none', background: 'transparent', padding: 0, color: themeTokens.textMuted || themeTokens.textSecondary, cursor: 'pointer' }}>
                      <CloseRounded sx={{ fontSize: 14 }} />
                    </button>
                  </div>
                )}
                {prdMsg && <span style={{ fontSize: 11, color: themeTokens.textMuted }}>{prdMsg}</span>}
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
              placeholder={
                canvasSelection.some((s) => s.kind === 'image') && canvasSelection.some((s) => s.kind !== 'image')
                  ? 'Imagem e tela selecionadas: peça para editar a tela usando a imagem como referência ou criar uma nova tela combinando ambas...'
                  : canvasSelection.some((s) => s.kind === 'image')
                  ? 'Imagem selecionada no canvas: peça para recriar como tela editável, usar como referência de estilo ou fazer modificações...'
                  : canvasSelection.length > 0
                  ? 'Tela selecionada: peça modificações na seleção ou crie novas telas seguindo este design...'
                  : "Descreva a tela para a IA prototipar... Ex: 'Tela de login moderna com dark mode e botao Google'"
              }
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
              <input
                ref={prdFileRef}
                type="file"
                accept=".md,.mdx,.markdown,.txt,text/markdown,text/plain"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const r = await readPrdFile(f);
                  if (r) setPrd(r); else flashPrdMsg('Não consegui ler o arquivo. Envie um PRD em .md ou .txt.');
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
                      { key: 'prd', label: prd ? `PRD: ${prd.name}` : 'Enviar PRD', icon: <DescriptionOutlined sx={{ fontSize: 15 }} />, on: !!prd, toggle: false, run: () => { prdFileRef.current?.click(); setPlusOpen(false); } },
                      { key: 'prdProj', label: 'PRD do projeto', icon: <DescriptionOutlined sx={{ fontSize: 15 }} />, on: false, toggle: false, run: async () => { setPlusOpen(false); const r = await findProjectPrd(workspacePath); if (r) setPrd(r); else flashPrdMsg('Nenhum PRD encontrado na pasta do projeto'); } },
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

                {/* Botao e Popover de Handoff: Implementar Design na IDE ou no CLI */}
                <button
                  type="button"
                  title="Implementar telas do Design no código do projeto (IDE ou CLI)"
                  onClick={async () => {
                    const next = !handoffMenuOpen;
                    setHandoffMenuOpen(next);
                    if (next) {
                      setPlusOpen(false);
                      await syncDesignBridge(workspacePath, false);
                    }
                  }}
                  style={{
                    height: 28,
                    padding: '0 9px',
                    border: 'none',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: handoffMenuOpen
                      ? isEffectiveDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.08)'
                      : isEffectiveDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.05)',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 400,
                    fontFamily: "'Poppins', sans-serif",
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <CodeRounded sx={{ fontSize: 14, color: accentColor }} />
                  <span>Implementar</span>
                  {bridgeManifest?.screens?.length ? (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: themeTokens.textSecondary,
                      }}
                    >
                      {bridgeManifest.screens.length}
                    </span>
                  ) : null}
                  <KeyboardArrowDownRounded sx={{ fontSize: 14, color: themeTokens.textSecondary }} />
                </button>

                {handoffMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 34,
                      left: 0,
                      width: 248,
                      background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                      borderRadius: 10,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      zIndex: 330,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        color: themeTokens.textSecondary,
                        padding: '2px 4px 4px',
                        borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      }}
                    >
                      Selecione a tela para replicar no projeto
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150, overflowY: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedHandoffScreenId('all')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background:
                            selectedHandoffScreenId === 'all'
                              ? isEffectiveDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.06)'
                              : 'transparent',
                          color: themeTokens.textPrimary,
                          fontSize: 11.5,
                          fontWeight: 400,
                          fontFamily: "'Poppins', sans-serif",
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>Todas as telas ({bridgeManifest?.screens?.length || 0})</span>
                        {selectedHandoffScreenId === 'all' && <CheckRounded sx={{ fontSize: 14, color: accentColor }} />}
                      </button>
                      {(bridgeManifest?.screens || []).map((scr) => {
                        const isSel = selectedHandoffScreenId === scr.id;
                        return (
                          <button
                            key={scr.id}
                            type="button"
                            onClick={() => setSelectedHandoffScreenId(scr.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 6,
                              padding: '6px 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: isSel
                                ? isEffectiveDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.06)'
                                : 'transparent',
                              color: themeTokens.textPrimary,
                              fontSize: 11.5,
                              fontWeight: 400,
                              fontFamily: "'Poppins', sans-serif",
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {scr.name}
                            </span>
                            <span style={{ fontSize: 10, color: themeTokens.textSecondary, flexShrink: 0 }}>
                              {scr.width}x{scr.height}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        paddingTop: 4,
                        borderTop: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleHandoffDesign('ide')}
                        style={{
                          flex: 1,
                          height: 28,
                          border: 'none',
                          borderRadius: 6,
                          background: accentColor,
                          color: '#ffffff',
                          fontSize: 11.5,
                          fontWeight: 400,
                          fontFamily: "'Poppins', sans-serif",
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        <CodeRounded sx={{ fontSize: 14 }} />
                        Na IDE
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHandoffDesign('cli')}
                        style={{
                          flex: 1,
                          height: 28,
                          border: 'none',
                          borderRadius: 6,
                          background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                          color: themeTokens.textPrimary,
                          fontSize: 11.5,
                          fontWeight: 400,
                          fontFamily: "'Poppins', sans-serif",
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <TerminalRounded sx={{ fontSize: 14, color: '#22c55e' }} />
                        No CLI
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }} />

              <button
                type="button"
                disabled={!busy && !prompt.trim() && !aiImages.length && !prd && !hasSelectedCanvasImage}
                onClick={busy ? stop : () => run()}
                title={busy ? 'Parar a geração' : 'Gerar (Enter)'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  background: busy || prompt.trim() || aiImages.length || prd || hasSelectedCanvasImage
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.08)',
                  color: busy || prompt.trim() || aiImages.length || prd || hasSelectedCanvasImage ? '#ffffff' : themeTokens.textMuted || themeTokens.textSecondary,
                  border: 'none',
                  borderRadius: 6,
                  padding: '0 14px',
                  fontSize: 12,
                  fontWeight: 400,
                  cursor: busy || prompt.trim() || aiImages.length || prd || hasSelectedCanvasImage ? 'pointer' : 'not-allowed',
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
