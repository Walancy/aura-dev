import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Lock,
  Smartphone,
  Tablet,
  Monitor,
  Plus,
  X,
  Radio,
  Play,
  Server,
  Loader2,
  Check,
  Sparkles,
} from 'lucide-react';
import { AuraDevIcon } from './icons/AiProviderIcons';
import {
  scanSystemOccupiedPorts,
  extractPortFromUrl,
  detectProjectApps,
  type DetectedProjectApp,
} from '../utils/projectDevUrl';

export function cleanBrowserUrl(url?: string | null): string {
  if (!url) return '';
  let cleaned = url
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Strip markdown formatting (*, _, `, ', ", <, >, (, ), [, ])
  cleaned = cleaned.replace(/^[*_`"'<(\[]+/, '').replace(/[*_`"'>)\]]+$/, '');

  // Strip trailing /*, /**, /*. (artifacts from wildcard prompt expansions)
  cleaned = cleaned.replace(/\/\*+.*$/, '');

  return cleaned.trim();
}

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
  isLoading?: boolean;
  hasError?: boolean;
}

export interface ProjectNodeInfo {
  id: string;
  title: string;
  projectName?: string;
  projectPath?: string;
  devUrl?: string;
}

export interface OrchestrationBrowserNodeProps {
  nodeId: string;
  initialUrl?: string;
  initialTabs?: BrowserTab[];
  initialActiveTabId?: string;
  width: number;
  height: number;
  isEffectiveDark: boolean;
  accentColor: string;
  incomingUrl?: {
    url: string;
    timestamp: number;
    openInNewTab?: boolean;
    fromNodeTitle?: string;
  } | null;
  connectedProject?: ProjectNodeInfo | null;
  allProjects?: ProjectNodeInfo[];
  onStartProjectDev?: (projectPath: string, projectName: string, port?: number) => Promise<void>;
  onUpdateUrl?: (url: string) => void;
  onUpdateTabs?: (tabs: BrowserTab[], activeTabId: string) => void;
  onDeleteNode?: () => void;
  isCtrlOrMetaPressed?: boolean;
  onToast?: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export function getTabTitleFromUrl(url: string): string {
  try {
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'about:blank') return 'Nova Aba';
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
      return `Local:${parsed.port || '80'}${path}`;
    }
    if (parsed.hostname.endsWith('.localhost')) {
      const appName = parsed.hostname.replace(/\.localhost$/, '');
      const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
      return `${appName}${parsed.port ? `:${parsed.port}` : ''}${path}`;
    }
    const host = parsed.hostname.replace(/^www\./, '');
    return host || 'Nova Aba';
  } catch {
    return url.slice(0, 16) || 'Nova Aba';
  }
}

export const OrchestrationBrowserNode: React.FC<OrchestrationBrowserNodeProps> = ({
  nodeId,
  initialUrl = 'about:blank',
  initialTabs,
  initialActiveTabId,
  width,
  height,
  isEffectiveDark,
  accentColor,
  incomingUrl,
  connectedProject,
  allProjects,
  onStartProjectDev,
  onUpdateUrl,
  onUpdateTabs,
  onDeleteNode,
  isCtrlOrMetaPressed = false,
  onToast,
}) => {
  // Listen for Ctrl/Cmd modifier state to disable iframe pointer events so canvas can zoom smoothly
  const [isInternalCtrlDown, setIsInternalCtrlDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsInternalCtrlDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsInternalCtrlDown(false);
      }
    };
    const handleBlur = () => setIsInternalCtrlDown(false);
    const handleCustomDown = () => setIsInternalCtrlDown(true);
    const handleCustomUp = () => setIsInternalCtrlDown(false);

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('orchestration-ctrl-down', handleCustomDown);
    window.addEventListener('orchestration-ctrl-up', handleCustomUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('orchestration-ctrl-down', handleCustomDown);
      window.removeEventListener('orchestration-ctrl-up', handleCustomUp);
    };
  }, []);

  // System ports and monorepo detected sub-apps state
  const [occupiedPorts, setOccupiedPorts] = useState<number[]>([]);
  const [detectedApps, setDetectedApps] = useState<DetectedProjectApp[]>([]);
  const [isStartingServer, setIsStartingServer] = useState(false);

  const refreshSystemPortsAndApps = async () => {
    try {
      const ports = await scanSystemOccupiedPorts();
      setOccupiedPorts(ports);

      const targetPath = connectedProject?.projectPath || allProjects?.[0]?.projectPath;
      if (targetPath) {
        const apps = await detectProjectApps(targetPath);
        setDetectedApps(apps);
      }
    } catch {}
  };

  useEffect(() => {
    refreshSystemPortsAndApps();
  }, [connectedProject?.projectPath]);

  // Tabs State (multi-abas com limpeza automática de URLs corrompidas)
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    if (initialTabs && initialTabs.length > 0) {
      const seen = new Set<string>();
      const cleaned: BrowserTab[] = [];
      for (const t of initialTabs) {
        const cUrl = cleanBrowserUrl(t.url);
        const norm = cUrl.replace(/\/$/, '');
        if (!norm || norm === 'about:blank' || !seen.has(norm)) {
          if (norm && norm !== 'about:blank') seen.add(norm);
          cleaned.push({
            ...t,
            url: cUrl || 'about:blank',
            title: cUrl ? getTabTitleFromUrl(cUrl) : 'Nova Aba',
            isLoading: false,
            hasError: false,
          });
        }
      }
      if (cleaned.length > 0) return cleaned;
    }
    const defUrl = initialUrl && initialUrl !== 'about:blank' ? cleanBrowserUrl(initialUrl) : 'about:blank';
    return [
      {
        id: `tab-1`,
        url: defUrl,
        title: defUrl === 'about:blank' ? 'Nova Aba' : getTabTitleFromUrl(defUrl),
        history: [defUrl],
        historyIndex: 0,
        isLoading: defUrl !== 'about:blank',
        hasError: false,
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (initialActiveTabId && initialTabs?.some((t) => t.id === initialActiveTabId)) {
      return initialActiveTabId;
    }
    return tabs[0]?.id || `tab-1`;
  });

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || {
    id: 'tab-1',
    url: initialUrl,
    title: 'Nova Aba',
    history: [initialUrl],
    historyIndex: 0,
  };

  const [inputUrl, setInputUrl] = useState(activeTab.url);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [incomingNotice, setIncomingNotice] = useState<string | null>(null);
  const [iframeReloadKeys, setIframeReloadKeys] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pollServerIntervalRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const clearTabLoadTimer = (tabId: string) => {
    if (loadTimeoutRefs.current[tabId]) {
      clearTimeout(loadTimeoutRefs.current[tabId]);
      delete loadTimeoutRefs.current[tabId];
    }
    if (pollServerIntervalRefs.current[tabId]) {
      clearInterval(pollServerIntervalRefs.current[tabId]);
      delete pollServerIntervalRefs.current[tabId];
    }
  };

  // Helper para iniciar o servidor de desenvolvimento do projeto conectado
  const handleStartProjectServer = async (overridePort?: number) => {
    const project = connectedProject || allProjects?.[0];
    if (!project?.projectPath) {
      onToast?.('Nenhum caminho de projeto configurado neste fluxo.', 'error');
      return;
    }

    setIsStartingServer(true);
    const projectName = project.projectName || project.title || 'projeto';
    onToast?.(`🚀 Iniciando servidor de "${projectName}" em segundo plano...`, 'info');

    try {
      if (onStartProjectDev) {
        await onStartProjectDev(project.projectPath, projectName, overridePort);
      } else if (window.electronAPI?.pty) {
        const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const sessionId = `dev-server-${cleanName}`;
        await window.electronAPI.pty.create(sessionId, 'zsh', project.projectPath, 100, 24, accentColor);
        const runCmd = 'bun run dev 2>/dev/null || pnpm dev 2>/dev/null || npm run dev\n';
        window.electronAPI.pty.write(sessionId, runCmd);
      }

      // Inicia verificação rápida da aba ativa
      if (activeTabId) {
        startTabLoadTimer(activeTabId);
      }
    } catch (err: any) {
      onToast?.(`Erro ao iniciar servidor: ${err?.message || 'Falha no processo'}`, 'error');
    } finally {
      setTimeout(() => setIsStartingServer(false), 3000);
    }
  };

  // Inicia verificação e polling inteligente para servidores de desenvolvimento
  const startTabLoadTimer = (tabId: string, urlOverride?: string) => {
    clearTabLoadTimer(tabId);
    refreshSystemPortsAndApps();

    const rawTarget = urlOverride || tabs.find((t) => t.id === tabId)?.url;
    const targetUrl = cleanBrowserUrl(rawTarget);
    const isLocalhost = Boolean(targetUrl && (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')));

    if (isLocalhost && targetUrl) {
      // 1. Imediatamente faz checagem rápida se a porta está escutando no sistema
      const targetPort = extractPortFromUrl(targetUrl);
      scanSystemOccupiedPorts().then((sysPorts) => {
        setOccupiedPorts(sysPorts);
        if (targetPort && !sysPorts.includes(targetPort)) {
          // Servidor está offline! Marca erro rapidamente para não travar em tela branca
          setTabs((prev) =>
            prev.map((t) => (t.id === tabId ? { ...t, isLoading: false, hasError: true } : t))
          );
        }
      });

      // 2. Polling ativo a cada 1s para detectar quando o servidor responder e carregar automaticamente
      pollServerIntervalRefs.current[tabId] = setInterval(async () => {
        try {
          const ctrl = new AbortController();
          const tId = setTimeout(() => ctrl.abort(), 900);
          await fetch(targetUrl, { method: 'GET', mode: 'no-cors', cache: 'no-cache', signal: ctrl.signal });
          clearTimeout(tId);

          // Servidor respondeu! Limpa polling e força recarga com sucesso
          clearTabLoadTimer(tabId);
          setIframeReloadKeys((prev) => ({ ...prev, [tabId]: (prev[tabId] || 0) + 1 }));
          setTabs((prev) =>
            prev.map((t) => (t.id === tabId ? { ...t, isLoading: false, hasError: false } : t))
          );
        } catch {
          // Continua aguardando o servidor subir
        }
      }, 1000);

      // 3. Timeout de 15s para compilações mais longas
      loadTimeoutRefs.current[tabId] = setTimeout(() => {
        clearTabLoadTimer(tabId);
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id === tabId && t.isLoading) {
              return { ...t, isLoading: false, hasError: true };
            }
            return t;
          })
        );
      }, 15000);
    } else {
      // URL externa normal (8s)
      loadTimeoutRefs.current[tabId] = setTimeout(() => {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id === tabId && t.isLoading) {
              return { ...t, isLoading: false, hasError: true };
            }
            return t;
          })
        );
      }, 8000);
    }
  };

  // Limpa todos os timers ao desmontar o componente
  useEffect(() => {
    return () => {
      Object.values(loadTimeoutRefs.current).forEach((timer) => clearTimeout(timer));
      Object.values(pollServerIntervalRefs.current).forEach((timer) => clearInterval(timer));
    };
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!viewportRef.current) return;
    const updateSize = () => {
      if (viewportRef.current) {
        const w = viewportRef.current.clientWidth;
        const h = viewportRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setViewportSize({ width: w, height: h });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: rw, height: rh } = entry.contentRect;
        if (rw > 0 && rh > 0) {
          setViewportSize({ width: rw, height: rh });
        }
      }
    });
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  const containerWidth = viewportSize.width > 0 ? viewportSize.width : Math.max(300, width - 2);
  const containerHeight = viewportSize.height > 0 ? viewportSize.height : Math.max(200, height - 105);

  let targetWidth = 1920;
  let scale = 1;

  if (viewport === 'desktop') {
    targetWidth = 1920;
    scale = containerWidth / 1920;
  } else if (viewport === 'tablet') {
    targetWidth = 768;
    scale = containerWidth < 768 ? containerWidth / 768 : 1;
  } else if (viewport === 'mobile') {
    targetWidth = 375;
    scale = containerWidth < 375 ? containerWidth / 375 : 1;
  }

  const effectiveScale = Math.max(0.02, scale);
  const iframeWidth = targetWidth;
  const iframeHeight = Math.round(containerHeight / effectiveScale);

  // Sync with initialTabs if floor/props change (sem loop de re-render)
  const lastSyncStrRef = useRef<string>('');
  useEffect(() => {
    if (initialTabs && initialTabs.length > 0) {
      const syncStr = JSON.stringify(initialTabs.map((t) => `${t.id}:${t.url}`));
      if (syncStr !== lastSyncStrRef.current) {
        lastSyncStrRef.current = syncStr;
        const cleaned = initialTabs.map((t) => ({
          ...t,
          url: cleanBrowserUrl(t.url),
          isLoading: false,
        }));
        setTabs(cleaned);
        if (initialActiveTabId && cleaned.some((t) => t.id === initialActiveTabId)) {
          setActiveTabId(initialActiveTabId);
        }
      }
    }
  }, [initialTabs, initialActiveTabId]);

  // Keep inputUrl synced when activeTab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url === 'about:blank' ? '' : activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  // Cleanup notice timer on unmount
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Handle incoming URLs sent from connected IDEs / terminal nodes
  const lastIncomingTsRef = useRef<number>(0);
  const lastProcessedUrlRef = useRef<{ url: string; time: number }>({ url: '', time: 0 });

  useEffect(() => {
    if (!incomingUrl || incomingUrl.timestamp <= lastIncomingTsRef.current) return;
    lastIncomingTsRef.current = incomingUrl.timestamp;

    let targetUrl = cleanBrowserUrl(incomingUrl.url);
    if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('about:')) {
      if (targetUrl.startsWith('localhost') || targetUrl.startsWith('127.0.0.1') || targetUrl.includes('.localhost')) {
        targetUrl = `http://${targetUrl}`;
      } else {
        targetUrl = `https://${targetUrl}`;
      }
    }

    // Debounce duplicate incoming URL triggers within 3.5 seconds
    // mesma página = mesma aba: ignora esquema, "www." e barra final (github.com e https://www.github.com/ abriam duas abas)
    const cleanForCompare = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    const normalizedTarget = cleanForCompare(targetUrl);
    const now = Date.now();
    if (
      lastProcessedUrlRef.current.url === normalizedTarget &&
      now - lastProcessedUrlRef.current.time < 3500
    ) {
      return;
    }
    lastProcessedUrlRef.current = { url: normalizedTarget, time: now };

    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setIncomingNotice(`✦ Aberto de: ${incomingUrl.fromNodeTitle || 'IDE'}`);
    noticeTimerRef.current = setTimeout(() => setIncomingNotice(null), 4000);

    // 1. Check if an existing tab already has this exact URL (never duplicate tab for same URL)
    const existingTabIndex = tabs.findIndex(
      (t) => cleanForCompare(t.url) === normalizedTarget
    );

    if (existingTabIndex !== -1) {
      const existingTab = tabs[existingTabIndex];
      if (activeTabId !== existingTab.id) {
        setActiveTabId(existingTab.id);
      }
      setInputUrl(existingTab.url);
      setIframeReloadKeys((prev) => ({ ...prev, [existingTab.id]: (prev[existingTab.id] || 0) + 1 }));
      startTabLoadTimer(existingTab.id, existingTab.url);
      const updated = tabs.map((t) =>
        t.id === existingTab.id ? { ...t, isLoading: true, hasError: false } : t
      );
      setTabs(updated);
      onUpdateTabs?.(updated, existingTab.id);
      onUpdateUrl?.(existingTab.url);
      return;
    }

    // 2. Determina se a aba ativa atual é descartável (em branco ou sem conteúdo útil)
    const currentActiveTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    const isDisposableTab =
      !currentActiveTab ||
      currentActiveTab.url === 'about:blank' ||
      !currentActiveTab.url.trim() ||
      (currentActiveTab.hasError && currentActiveTab.history.length <= 1);

    // Abre em nova aba apenas se explicitamente solicitado ou se a aba ativa não for descartável (limitado a 8 abas)
    const shouldOpenNewTab = Boolean(incomingUrl.openInNewTab) || (!isDisposableTab && tabs.length < 8);

    if (shouldOpenNewTab) {
      const newTabId = `tab-${Date.now()}`;
      const newTabTitle = getTabTitleFromUrl(targetUrl);
      const newTab: BrowserTab = {
        id: newTabId,
        url: targetUrl,
        title: newTabTitle,
        history: [targetUrl],
        historyIndex: 0,
        isLoading: true,
        hasError: false,
      };
      const updated = [...tabs, newTab];
      startTabLoadTimer(newTabId, targetUrl);
      setIframeReloadKeys((prev) => ({ ...prev, [newTabId]: (prev[newTabId] || 0) + 1 }));
      setTabs(updated);
      setActiveTabId(newTabId);
      setInputUrl(targetUrl);
      onUpdateTabs?.(updated, newTabId);
      onUpdateUrl?.(targetUrl);
    } else {
      // Aba ativa é em branco/descartável ou atingiu limite de abas, navega nela
      handleNavigate(targetUrl);
    }
  }, [incomingUrl, tabs, activeTabId]);

  // Navigate active tab to target URL
  const handleNavigate = (targetUrl: string) => {
    let url = cleanBrowserUrl(targetUrl);
    if (!url) return;
    if (/^file:/i.test(url)) {
      setIncomingNotice('Acesso a arquivos locais restrito por segurança');
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith('about:')) {
      if (url.startsWith('localhost') || url.startsWith('127.0.0.1') || url.includes('.localhost')) {
        url = `http://${url}`;
      } else {
        url = `https://${url}`;
      }
    }

    setInputUrl(url);
    startTabLoadTimer(activeTabId, url);
    const updatedTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        const history = t.history.slice(0, t.historyIndex + 1);
        history.push(url);
        return {
          ...t,
          url,
          title: getTabTitleFromUrl(url),
          history,
          historyIndex: history.length - 1,
          isLoading: true,
          hasError: false,
        };
      }
      return t;
    });

    setTabs(updatedTabs);
    setIframeReloadKeys((prev) => ({ ...prev, [activeTabId]: (prev[activeTabId] || 0) + 1 }));
    onUpdateUrl?.(url);
    onUpdateTabs?.(updatedTabs, activeTabId);
  };

  // Add new tab
  const handleAddTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const defUrl = 'about:blank';
    const newTab: BrowserTab = {
      id: newTabId,
      url: defUrl,
      title: 'Nova Aba',
      history: [defUrl],
      historyIndex: 0,
      isLoading: false,
      hasError: false,
    };
    const updated = [...tabs, newTab];
    setTabs(updated);
    setActiveTabId(newTabId);
    setInputUrl('');
    onUpdateTabs?.(updated, newTabId);
    onUpdateUrl?.(defUrl);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Close tab
  const handleCloseTab = (e: React.MouseEvent, tabIdToClose: string) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      // If closing the only tab, reset it to blank/default
      const defUrl = 'about:blank';
      const resetTab: BrowserTab = {
        id: `tab-${Date.now()}`,
        url: defUrl,
        title: 'Nova Aba',
        history: [defUrl],
        historyIndex: 0,
        isLoading: false,
        hasError: false,
      };
      setTabs([resetTab]);
      setActiveTabId(resetTab.id);
      setInputUrl('');
      onUpdateTabs?.([resetTab], resetTab.id);
      onUpdateUrl?.(defUrl);
      return;
    }

    clearTabLoadTimer(tabIdToClose); // o poll de uma aba fechada não pode continuar rodando
    const tabIndex = tabs.findIndex((t) => t.id === tabIdToClose);
    const updated = tabs.filter((t) => t.id !== tabIdToClose);
    let nextActiveId = activeTabId;

    if (activeTabId === tabIdToClose) {
      const nextIndex = Math.min(tabIndex, updated.length - 1);
      nextActiveId = updated[nextIndex].id;
      setInputUrl(updated[nextIndex].url);
    }

    setTabs(updated);
    setActiveTabId(nextActiveId);
    onUpdateTabs?.(updated, nextActiveId);
  };

  // History Back / Forward
  const handleGoBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const newIndex = activeTab.historyIndex - 1;
    const targetUrl = activeTab.history[newIndex];
    setInputUrl(targetUrl);
    startTabLoadTimer(activeTabId, targetUrl); // a URL de destino (a da aba ainda é a que está sendo deixada)
    const updated = tabs.map((t) =>
      t.id === activeTabId
        ? {
            ...t,
            url: targetUrl,
            title: getTabTitleFromUrl(targetUrl),
            historyIndex: newIndex,
            isLoading: true,
            hasError: false,
          }
        : t
    );
    setTabs(updated);
    setIframeReloadKeys((prev) => ({ ...prev, [activeTabId]: (prev[activeTabId] || 0) + 1 }));
    onUpdateUrl?.(targetUrl);
    onUpdateTabs?.(updated, activeTabId);
  };

  const handleGoForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const newIndex = activeTab.historyIndex + 1;
    const targetUrl = activeTab.history[newIndex];
    setInputUrl(targetUrl);
    startTabLoadTimer(activeTabId, targetUrl); // a URL de destino (a da aba ainda é a que está sendo deixada)
    const updated = tabs.map((t) =>
      t.id === activeTabId
        ? {
            ...t,
            url: targetUrl,
            title: getTabTitleFromUrl(targetUrl),
            historyIndex: newIndex,
            isLoading: true,
            hasError: false,
          }
        : t
    );
    setTabs(updated);
    setIframeReloadKeys((prev) => ({ ...prev, [activeTabId]: (prev[activeTabId] || 0) + 1 }));
    onUpdateUrl?.(targetUrl);
    onUpdateTabs?.(updated, activeTabId);
  };

  const handleReload = () => {
    startTabLoadTimer(activeTabId);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, isLoading: true, hasError: false } : t))
    );
    setIframeReloadKeys((prev) => ({ ...prev, [activeTabId]: (prev[activeTabId] || 0) + 1 }));
  };

  const handleOpenExternal = () => {
    onToast?.(
      'Ação bloqueada: a orquestração opera exclusivamente dentro do componente de navegador e nunca utiliza o navegador do dispositivo.',
      'error'
    );
  };



  const headerBg = isEffectiveDark ? '#18181b' : '#f1f5f9';
  const barBg = isEffectiveDark ? '#101012' : '#ffffff';
  const textPrimary = isEffectiveDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isEffectiveDark ? '#94a3b8' : '#64748b';
  const borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('orchestration-zoom', {
              detail: {
                clientX: e.clientX,
                clientY: e.clientY,
                deltaY: e.deltaY,
              },
            })
          );
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isEffectiveDark ? '#0c0c0e' : '#ffffff',
        borderRadius: 18,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Browser Header Chrome with Tabs */}
      <div
        style={{
          padding: '8px 12px',
          background: headerBg,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          flexShrink: 0,
        }}
        onMouseDown={(e) => {
          // Abas, barra de endereço e atalhos não podem iniciar o arraste do card: o arraste liga uma
          // camada transparente de tela cheia no canvas e o mouseup cai nela, então o clique se perdia.
          const target = e.target as HTMLElement;
          const tag = target.tagName.toLowerCase();
          if (target.closest('[data-no-drag]') || tag === 'input' || tag === 'button' || tag === 'svg' || tag === 'path') {
            e.stopPropagation();
          }
        }}
      >
        {/* Top Row: Window Controls & Tab Bar & Viewports */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
          {/* Left: macOS Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode?.();
              }}
              title="Excluir navegador da tela"
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                opacity: 0.85,
                transition: 'opacity 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#f59e0b',
                opacity: 0.85,
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#10b981',
                opacity: 0.85,
              }}
            />
          </div>

          {/* Center: Tabs Strip */}
          <div
            data-no-drag
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flex: 1,
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTabId(tab.id);
                    setInputUrl(tab.url);
                    onUpdateTabs?.(tabs, tab.id);
                    onUpdateUrl?.(tab.url);
                  }}
                  title={tab.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: '6px 6px 0 0',
                    background: isActive
                      ? isEffectiveDark
                        ? '#27272a'
                        : '#ffffff'
                      : isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)',
                    borderTop: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                    borderLeft: `1px solid ${isActive ? borderColor : 'transparent'}`,
                    borderRight: `1px solid ${isActive ? borderColor : 'transparent'}`,
                    borderBottom: isActive ? 'none' : `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    minWidth: 70,
                    maxWidth: 150,
                    flexShrink: 0,
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                >
                  <Globe
                    size={11}
                    color={isActive ? accentColor : textSecondary}
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? textPrimary : textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {tab.title || 'Aba'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    title="Fechar aba"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 2,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: textSecondary,
                      opacity: isActive ? 0.75 : 0.35,
                      flexShrink: 0,
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isActive ? '0.75' : '0.35';
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = textSecondary;
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}

            {/* New Tab Button (+) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddTab();
              }}
              title="Nova aba"
              style={{
                background: 'transparent',
                border: `1px dashed ${borderColor}`,
                borderRadius: 5,
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: textSecondary,
                flexShrink: 0,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accentColor;
                e.currentTarget.style.color = accentColor;
                e.currentTarget.style.background = `${accentColor}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.color = textSecondary;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Plus size={11} />
            </button>
          </div>

          {/* Right: Incoming Notice Pill & Viewport Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {incomingNotice && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <Radio size={10} style={{ animation: 'pulse 1s infinite' }} />
                <span>{incomingNotice}</span>
              </div>
            )}

            {/* Device Viewport Toggle Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: barBg,
                borderRadius: 6,
                padding: '2px',
                border: `1px solid ${borderColor}`,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewport('desktop');
                }}
                title="Desktop (100%)"
                style={{
                  background: viewport === 'desktop' ? accentColor : 'transparent',
                  color: viewport === 'desktop' ? '#ffffff' : textSecondary,
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.12s ease',
                }}
              >
                <Monitor size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewport('tablet');
                }}
                title="Tablet (768px)"
                style={{
                  background: viewport === 'tablet' ? accentColor : 'transparent',
                  color: viewport === 'tablet' ? '#ffffff' : textSecondary,
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.12s ease',
                }}
              >
                <Tablet size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewport('mobile');
                }}
                title="Mobile (375px)"
                style={{
                  background: viewport === 'mobile' ? accentColor : 'transparent',
                  color: viewport === 'mobile' ? '#ffffff' : textSecondary,
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.12s ease',
                }}
              >
                <Smartphone size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Address Bar Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGoBack();
              }}
              disabled={!activeTab || activeTab.historyIndex <= 0}
              title="Voltar"
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab && activeTab.historyIndex > 0 ? textSecondary : `${textSecondary}55`,
                padding: 4,
                borderRadius: 4,
                cursor: activeTab && activeTab.historyIndex > 0 ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                if (activeTab && activeTab.historyIndex > 0) e.currentTarget.style.color = textPrimary;
              }}
              onMouseLeave={(e) => {
                if (activeTab && activeTab.historyIndex > 0) e.currentTarget.style.color = textSecondary;
              }}
            >
              <ArrowLeft size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGoForward();
              }}
              disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1}
              title="Avançar"
              style={{
                background: 'transparent',
                border: 'none',
                color:
                  activeTab && activeTab.historyIndex < activeTab.history.length - 1
                    ? textSecondary
                    : `${textSecondary}55`,
                padding: 4,
                borderRadius: 4,
                cursor:
                  activeTab && activeTab.historyIndex < activeTab.history.length - 1
                    ? 'pointer'
                    : 'default',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                if (activeTab && activeTab.historyIndex < activeTab.history.length - 1)
                  e.currentTarget.style.color = textPrimary;
              }}
              onMouseLeave={(e) => {
                if (activeTab && activeTab.historyIndex < activeTab.history.length - 1)
                  e.currentTarget.style.color = textSecondary;
              }}
            >
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReload();
              }}
              title="Recarregar aba ativa"
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <RotateCw
                size={13}
                style={{
                  animation: activeTab?.isLoading ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
            </button>
          </div>

          {/* Interactive URL Input Bar */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: barBg,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '3px 8px',
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Lock size={12} color={inputUrl.startsWith('https://') ? '#10b981' : textSecondary} />
            <input
              ref={inputRef}
              type="text"
              value={inputUrl === 'about:blank' ? '' : inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNavigate(inputUrl);
                }
              }}
              placeholder="Digite uma URL (ex: http://localhost:5173)..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textPrimary,
                fontSize: 11.5,
                fontFamily: 'inherit',
                width: '100%',
              }}
            />
            {inputUrl !== activeTab?.url && (
              <button
                type="button"
                onClick={() => handleNavigate(inputUrl)}
                style={{
                  background: accentColor,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Ir
              </button>
            )}
          </div>

          {/* Open in External OS Browser (Chrome/Safari) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenExternal();
            }}
            title="Abrir no navegador externo do sistema (Chrome / Safari)"
            style={{
              background: barBg,
              border: `1px solid ${borderColor}`,
              color: textSecondary,
              padding: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
          >
            <ExternalLink size={12} />
          </button>
        </div>


      </div>

      {/* Multi-Tab Viewports & Live Iframes Area */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isEffectiveDark ? '#09090b' : '#f8fafc',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Iframe Viewport Container (Desktop / Tablet / Mobile Centering) */}
        <div
          ref={viewportRef}
          style={{
            width: viewport === 'mobile' ? (containerWidth < 375 ? '100%' : 375) : viewport === 'tablet' ? (containerWidth < 768 ? '100%' : 768) : '100%',
            height: '100%',
            maxWidth: '100%',
            background: '#000000',
            boxShadow:
              viewport !== 'desktop'
                ? isEffectiveDark
                  ? '0 0 24px rgba(0, 0, 0, 0.8)'
                  : '0 0 20px rgba(0, 0, 0, 0.15)'
                : 'none',
            borderLeft: viewport !== 'desktop' ? `1px solid ${borderColor}` : 'none',
            borderRight: viewport !== 'desktop' ? `1px solid ${borderColor}` : 'none',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Render an iframe for EVERY tab so tab switching preserves page state and form values */}
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTabId;
            const reloadKey = iframeReloadKeys[tab.id] || 0;
            const isBlank = !tab.url || tab.url.trim() === '' || tab.url.trim() === 'about:blank' || tab.url.trim() === 'about:newtab';

            if (isBlank) {
              return (
                <div
                  key={tab.id}
                  style={{
                    display: isTabActive ? 'flex' : 'none',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    background: '#000000',
                    color: '#ffffff',
                    userSelect: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: 24,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Subtle dynamic radial aura background glow */}
                  <div
                    style={{
                      position: 'absolute',
                      width: 520,
                      height: 520,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${accentColor}28 0%, rgba(56, 189, 248, 0.08) 35%, transparent 68%)`,
                      filter: 'blur(45px)',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Central Content */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      maxWidth: 460,
                      width: '100%',
                      textAlign: 'center',
                      gap: 16,
                      animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {/* Aura Logo Emblem with elegant glow border */}
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 14,
                        borderRadius: 30,
                        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)',
                        boxShadow: `0 0 36px ${accentColor}30, 0 12px 30px rgba(0, 0, 0, 0.65)`,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <AuraDevIcon size={88} />
                    </div>

                    {/* Branding Titles */}
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: 23,
                          fontWeight: 700,
                          letterSpacing: '-0.025em',
                          fontFamily: "'Poppins', sans-serif",
                          background: 'linear-gradient(180deg, #ffffff 0%, #d4d4d8 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        Aura Browser
                      </h2>
                      <p
                        style={{
                          margin: '6px 0 0 0',
                          fontSize: 12.5,
                          color: '#71717a',
                          fontWeight: 400,
                        }}
                      >
                        Ambiente rápido de testes e pré-visualização web
                      </p>
                    </div>

                    {/* Central Quick URL Bar */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 390,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 10,
                        padding: '7px 12px',
                        gap: 8,
                        marginTop: 4,
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    >
                      <Globe size={15} color="#71717a" />
                      <input
                        type="text"
                        placeholder="Digite uma URL (ex: localhost:5173)..."
                        defaultValue=""
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if (val.trim()) handleNavigate(val);
                          }
                        }}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#ffffff',
                          fontSize: 12.5,
                          fontFamily: 'inherit',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          color: '#a1a1aa',
                          background: 'rgba(255, 255, 255, 0.08)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        ↵ Enter
                      </span>
                    </div>


                  </div>
                </div>
              );
            }

            return (
              <div
                key={tab.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: isTabActive ? 'flex' : 'none',
                  flexDirection: 'column',
                  width: '100%',
                  height: '100%',
                  background: '#000000',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${iframeWidth}px`,
                    height: `${iframeHeight}px`,
                    transform: `scale(${effectiveScale})`,
                    transformOrigin: 'top left',
                    flexShrink: 0,
                  }}
                >
                  <iframe
                    key={`${tab.id}-${reloadKey}`}
                    src={tab.url}
                    title={tab.title}
                    allow="cross-origin-isolated; autoplay; camera; microphone; geolocation"
                    referrerPolicy="no-referrer-when-downgrade"
                    onLoad={async (e) => {
                      const iframeEl = e.currentTarget;
                      clearTabLoadTimer(tab.id);

                      let loadSucceeded = true;
                      const isLocalhost = Boolean(tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')));

                      if (isLocalhost) {
                        try {
                          // Verificação real via fetch para não confundir tela de erro interna do Chromium com carregamento bem-sucedido
                          const ctrl = new AbortController();
                          const tId = setTimeout(() => ctrl.abort(), 1800);
                          await fetch(tab.url, { method: 'GET', mode: 'no-cors', cache: 'no-cache', signal: ctrl.signal });
                          clearTimeout(tId);
                          loadSucceeded = true;
                        } catch {
                          loadSucceeded = false;
                        }
                      } else {
                        try {
                          const loc = iframeEl.contentWindow?.location?.href;
                          if (loc && (loc.startsWith('chrome-error:') || loc.includes('about:blank#blocked'))) {
                            loadSucceeded = false;
                          }
                        } catch {
                          loadSucceeded = true;
                        }
                      }

                      if (!loadSucceeded) {
                        setTabs((prev) =>
                          prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false, hasError: true } : t))
                        );
                        return;
                      }

                      try {
                        const win = iframeEl.contentWindow;
                        if (win && !(win as any).__orchestrationWheelHooked) {
                          (win as any).__orchestrationWheelHooked = true;
                          win.addEventListener('wheel', (we: WheelEvent) => {
                            if (we.ctrlKey || we.metaKey) {
                              we.preventDefault();
                              we.stopPropagation();
                              const rect = iframeEl.getBoundingClientRect();
                              window.dispatchEvent(
                                new CustomEvent('orchestration-zoom', {
                                  detail: {
                                    clientX: rect.left + we.clientX * effectiveScale,
                                    clientY: rect.top + we.clientY * effectiveScale,
                                    deltaY: we.deltaY,
                                  },
                                })
                              );
                            }
                          }, { passive: false, capture: true });
                          win.addEventListener('keydown', (ke: KeyboardEvent) => {
                            if (ke.key === 'Control' || ke.key === 'Meta') {
                              window.dispatchEvent(new CustomEvent('orchestration-ctrl-down'));
                            }
                          }, true);
                          win.addEventListener('keyup', (ke: KeyboardEvent) => {
                            if (ke.key === 'Control' || ke.key === 'Meta') {
                              window.dispatchEvent(new CustomEvent('orchestration-ctrl-up'));
                            }
                          }, true);
                        }
                      } catch {}

                      setTabs((prev) =>
                        prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false, hasError: false } : t))
                      );
                    }}
                    onError={() => {
                      clearTabLoadTimer(tab.id);
                      setTabs((prev) =>
                        prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false, hasError: true } : t))
                      );
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: isEffectiveDark ? '#141414' : '#ffffff',
                      pointerEvents: isCtrlOrMetaPressed || isInternalCtrlDown ? 'none' : 'auto',
                    }}
                  />
                </div>

                {/* Loading indicator bar */}
                {tab.isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: `linear-gradient(90deg, ${accentColor}, #3b82f6)`,
                      animation: 'pulse 1s ease-in-out infinite',
                      zIndex: 10,
                    }}
                  />
                )}

                {/* Placeholder para aba em branco */}
                {(!tab.url || tab.url === 'about:blank') && !tab.isLoading && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: isEffectiveDark ? '#141416' : '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 24,
                      textAlign: 'center',
                      gap: 12,
                      color: textPrimary,
                      zIndex: 4,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: '50%',
                        background: isEffectiveDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Globe size={28} color={accentColor} />
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>Navegador Integrado</div>
                    <div style={{ fontSize: 11.5, color: textSecondary, maxWidth: 320, lineHeight: '18px' }}>
                      Conecte um projeto ou execute o fluxo para abrir a aplicação aqui, ou digite uma URL acima.
                    </div>
                  </div>
                )}

                {/* Fallback overlay if iframe blocked, errored or server offline */}
                {tab.hasError && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: isEffectiveDark ? '#141416' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 24,
                      textAlign: 'center',
                      gap: 14,
                      color: textPrimary,
                      zIndex: 5,
                      overflowY: 'auto',
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: '50%',
                        background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Radio size={28} color="#ef4444" style={{ animation: 'pulse 1.8s ease-in-out infinite' }} />
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {tab.url.includes('localhost') || tab.url.includes('127.0.0.1')
                        ? 'Servidor Local Desconectado'
                        : 'Falha ao Conectar no Endereço'}
                    </div>

                    <div style={{ fontSize: 12, color: textSecondary, maxWidth: 380, lineHeight: '19px' }}>
                      {tab.url.includes('localhost') || tab.url.includes('127.0.0.1') ? (
                        <>
                          Nenhum processo está respondendo em <strong style={{ color: textPrimary }}>{tab.url}</strong>.
                          Inicie o servidor de desenvolvimento para visualizar a aplicação.
                        </>
                      ) : (
                        <>Não foi possível carregar <strong style={{ color: textPrimary }}>{tab.url}</strong>. Verifique a URL ou sua conexão.</>
                      )}
                    </div>

                    {/* Botão de Iniciar Servidor do Projeto */}
                    {(connectedProject?.projectPath || allProjects?.[0]?.projectPath) && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          disabled={isStartingServer}
                          onClick={() => handleStartProjectServer(extractPortFromUrl(tab.url) || undefined)}
                          style={{
                            background: isStartingServer
                              ? 'rgba(59, 130, 246, 0.5)'
                              : `linear-gradient(135deg, ${accentColor}, #2563eb)`,
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 18px',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: isStartingServer ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isStartingServer ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Iniciando Servidor ({connectedProject?.projectName || connectedProject?.title || 'Projeto'})...</span>
                            </>
                          ) : (
                            <>
                              <Play size={13} fill="#ffffff" />
                              <span>Iniciar Servidor ({connectedProject?.projectName || connectedProject?.title || 'Projeto'})</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Se houver sub-aplicações detectadas no monorepo (ex: client, admin, wireframe) */}
                    {detectedApps.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Aplicações do Monorepo:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 360 }}>
                          {detectedApps.map((app) => {
                            const isCurrent = tab.url.includes(`:${app.port}`);
                            return (
                              <button
                                key={app.name}
                                type="button"
                                onClick={() => handleNavigate(app.url)}
                                style={{
                                  background: isCurrent
                                    ? accentColor
                                    : isEffectiveDark
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.06)',
                                  color: isCurrent ? '#ffffff' : textPrimary,
                                  border: isCurrent ? 'none' : `1px solid ${borderColor}`,
                                  borderRadius: 6,
                                  padding: '4px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <Globe size={11} />
                                <span>{app.name} (:{app.port})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Se houver outras portas ouvindo no sistema (ex: 5173, 3000, etc.) */}
                    {occupiedPorts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Portas Ativas no Computador:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 360 }}>
                          {occupiedPorts.map((p) => {
                            const isCurrent = tab.url.includes(`:${p}`);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleNavigate(`http://localhost:${p}`)}
                                style={{
                                  background: isCurrent
                                    ? '#10b981'
                                    : isEffectiveDark
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : 'rgba(16, 185, 129, 0.08)',
                                  color: isCurrent ? '#ffffff' : isEffectiveDark ? '#34d399' : '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  borderRadius: 6,
                                  padding: '4px 10px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isCurrent ? '#ffffff' : '#10b981' }} />
                                <span>Porta :{p}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Botão Tentar Novamente */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={handleReload}
                        style={{
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          color: textPrimary,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <RotateCw size={13} />
                        <span>Tentar Novamente</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
