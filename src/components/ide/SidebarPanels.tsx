import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  GitBranch,
  Play,
  Monitor,
  Blocks,
  RefreshCw,
  XCircle,
  Check,
  CheckCheck,
  CaseUpper,
  WholeWord,
  Regex,
  ChevronRight,
  FileText,
  RotateCcw,
  Plus,
  Minus,
  Eye,
  Download,
  Star,
  ExternalLink,
  X,
} from 'lucide-react';

export interface SidebarPanelsProps {
  activeTab: 'search' | 'git' | 'debug' | 'preview' | 'extensions';
  workspacePath: string;
  themeTokens: {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    hoverBg: string;
  };
  isEffectiveDark: boolean;
  accentColor: string;
  accentTextColor: string;
  activeFile?: { path: string; name: string; language?: string } | null;
  onOpenFile: (filePath: string, fileName?: string) => void;
  onJumpToLine: (filePath: string, line: number) => void;
  onStartReview?: (files: any[], index?: number) => void;
  onRunTerminalCommand: (name: string, command: string) => void;
  onToast: (msg: string) => void;
  onOpenBranchModal?: () => void;
  currentBranch?: string;
  onSelectExtension?: (ext: any) => void;
}

export const SidebarPanels: React.FC<SidebarPanelsProps> = ({
  activeTab,
  workspacePath,
  themeTokens,
  isEffectiveDark,
  accentColor,
  accentTextColor,
  activeFile,
  onOpenFile,
  onJumpToLine,
  onStartReview,
  onRunTerminalCommand,
  onToast,
  onOpenBranchModal,
  currentBranch = 'main',
  onSelectExtension,
}) => {
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex.length === 3 ? cleanHex.split('').map((c) => c + c).join('') : cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // -------------------------------------------------------------------------
  // 1. Search Panel State & Logic
  // -------------------------------------------------------------------------
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalReplaceQuery, setGlobalReplaceQuery] = useState('');
  const [isSearchReplaceOpen, setIsSearchReplaceOpen] = useState(false);
  const [searchMatchCase, setSearchMatchCase] = useState(false);
  const [searchMatchWholeWord, setSearchMatchWholeWord] = useState(false);
  const [searchUseRegex, setSearchUseRegex] = useState(false);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ file: string; line: number; text: string }>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const executeGlobalSearch = useCallback(
    async (query = globalSearchQuery) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearchingFiles(true);
      try {
        if (window.electronAPI?.fs?.searchInFiles) {
          const res = await window.electronAPI.fs.searchInFiles(workspacePath, query.trim(), {
            matchCase: searchMatchCase,
            matchWholeWord: searchMatchWholeWord,
            isRegex: searchUseRegex,
            maxResults: 250,
          });
          setSearchResults(res?.results || []);
        } else {
          const excludeDirs = '--exclude-dir={node_modules,.git,dist,.next,.turbo,build,out}';
          let flags = '-rnI';
          if (!searchMatchCase) flags += 'i';
          if (searchMatchWholeWord) flags += 'w';
          if (searchUseRegex) flags += 'E';
          else flags += 'F';
          const escaped = query.trim().replace(/'/g, "'\\''");
          const cmd = `grep ${flags} ${excludeDirs} -- '${escaped}' "${workspacePath}" | head -n 250`;
          const res = await window.electronAPI?.shell?.exec(cmd, workspacePath);
          if (res?.stdout) {
            const lines = res.stdout.split('\n').filter(Boolean);
            const list: Array<{ file: string; line: number; text: string }> = [];
            for (const line of lines) {
              const m = line.match(/^([^:]+):(\d+):(.*)$/);
              if (m) list.push({ file: m[1], line: parseInt(m[2], 10), text: m[3] });
            }
            setSearchResults(list);
          } else {
            setSearchResults([]);
          }
        }
      } catch (err: any) {
        console.warn('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearchingFiles(false);
      }
    },
    [globalSearchQuery, workspacePath, searchMatchCase, searchMatchWholeWord, searchUseRegex]
  );

  const handleReplaceAll = async () => {
    if (!globalSearchQuery.trim() || searchResults.length === 0) return;
    const fileGroups: Record<string, boolean> = {};
    searchResults.forEach((r) => {
      fileGroups[r.file] = true;
    });
    let count = 0;
    for (const filePath of Object.keys(fileGroups)) {
      try {
        const readRes = await window.electronAPI?.fs?.readFile(filePath);
        if (readRes?.content) {
          const flags = searchMatchCase ? 'g' : 'gi';
          const pattern = searchUseRegex
            ? globalSearchQuery
            : globalSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const finalPattern = searchMatchWholeWord ? `\\b${pattern}\\b` : pattern;
          const regex = new RegExp(finalPattern, flags);
          const newContent = readRes.content.replace(regex, globalReplaceQuery);
          if (newContent !== readRes.content) {
            await window.electronAPI?.fs?.writeFile(filePath, newContent);
            count++;
          }
        }
      } catch {}
    }
    onToast(`Substituído em ${count} arquivo(s)`);
    executeGlobalSearch();
  };

  const groupedSearchResults = useMemo(() => {
    const map = new Map<string, Array<{ line: number; text: string }>>();
    for (const r of searchResults) {
      if (!map.has(r.file)) map.set(r.file, []);
      map.get(r.file)!.push({ line: r.line, text: r.text });
    }
    return Array.from(map.entries()).map(([file, matches]) => ({ file, matches }));
  }, [searchResults]);

  // -------------------------------------------------------------------------
  // 2. Git / Source Control State & Logic
  // -------------------------------------------------------------------------
  const [gitChanges, setGitChanges] = useState<Array<{ path: string; status: string; staged: boolean }>>([]);
  const [gitCommitMsg, setGitCommitMsg] = useState('');
  const [isGitLoading, setIsGitLoading] = useState(false);

  const refreshGitStatus = useCallback(async () => {
    if (!window.electronAPI?.shell?.exec) return;
    setIsGitLoading(true);
    const cwd = workspacePath || process.cwd();
    try {
      const statusRes = await window.electronAPI.shell.exec('git status --porcelain=v1', cwd);
      if (statusRes?.stdout !== undefined) {
        const lines = statusRes.stdout.split('\n').filter(Boolean);
        const changes: Array<{ path: string; status: string; staged: boolean }> = [];
        for (const line of lines) {
          const x = line[0];
          const y = line[1];
          const fPath = line.substring(3).trim();
          if (x !== ' ' && x !== '?') {
            changes.push({ path: fPath, status: x, staged: true });
          }
          if (y !== ' ') {
            changes.push({ path: fPath, status: y === '?' ? '??' : y, staged: false });
          }
        }
        setGitChanges(changes);
      }
    } catch (err) {
      console.warn('Git status refresh failed:', err);
    } finally {
      setIsGitLoading(false);
    }
  }, [workspacePath]);

  const handleGitCommit = async () => {
    if (!gitCommitMsg.trim()) {
      onToast('Digite uma mensagem de commit');
      return;
    }
    setIsGitLoading(true);
    const cwd = workspacePath || process.cwd();
    try {
      const hasStaged = gitChanges.some((c) => c.staged);
      if (!hasStaged) {
        await window.electronAPI?.shell?.exec('git add -A', cwd);
      }
      const escaped = gitCommitMsg.replace(/"/g, '\\"');
      const commitRes = await window.electronAPI?.shell?.exec(`git commit -m "${escaped}"`, cwd);
      if (commitRes?.exitCode === 0) {
        setGitCommitMsg('');
        onToast('Commit realizado com sucesso!');
        await refreshGitStatus();
      } else {
        onToast(commitRes?.stderr || 'Erro ao commitar');
      }
    } catch (err: any) {
      onToast(`Erro no commit: ${err.message}`);
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleGitDiscard = async (filePath: string) => {
    const cwd = workspacePath || process.cwd();
    try {
      await window.electronAPI?.shell?.exec(
        `git checkout -- "${filePath}" || git restore "${filePath}" || rm -rf "${filePath}"`,
        cwd
      );
      onToast(`Alterações descartadas em ${filePath}`);
      refreshGitStatus();
    } catch (err: any) {
      onToast(`Erro ao descartar: ${err.message}`);
    }
  };

  const handleGitStage = async (filePath: string) => {
    const cwd = workspacePath || process.cwd();
    await window.electronAPI?.shell?.exec(`git add "${filePath}"`, cwd);
    refreshGitStatus();
  };

  const handleGitUnstage = async (filePath: string) => {
    const cwd = workspacePath || process.cwd();
    await window.electronAPI?.shell?.exec(`git reset HEAD "${filePath}"`, cwd);
    refreshGitStatus();
  };

  const handleGitSync = async () => {
    const cwd = workspacePath || process.cwd();
    onToast('Sincronizando com o repositório remoto...');
    try {
      const res = await window.electronAPI?.shell?.exec('git pull --rebase && git push', cwd);
      if (res?.exitCode === 0) {
        onToast('Sincronizado com sucesso!');
      } else {
        onToast(res?.stderr || 'Sincronização concluída com avisos');
      }
      refreshGitStatus();
    } catch (e: any) {
      onToast(`Erro na sincronização: ${e.message}`);
    }
  };

  // -------------------------------------------------------------------------
  // 3. Run and Debug State & Logic
  // -------------------------------------------------------------------------
  const [packageScripts, setPackageScripts] = useState<Record<string, string>>({});
  const [isLoadingScripts, setIsLoadingScripts] = useState(false);

  const loadPackageScripts = useCallback(async () => {
    setIsLoadingScripts(true);
    try {
      const pkgPath = `${workspacePath}/package.json`;
      const res = await window.electronAPI?.fs?.readFile(pkgPath);
      if (res?.content) {
        const parsed = JSON.parse(res.content);
        setPackageScripts(parsed.scripts || {});
      } else {
        setPackageScripts({});
      }
    } catch {
      setPackageScripts({});
    } finally {
      setIsLoadingScripts(false);
    }
  }, [workspacePath]);

  const handleRunActiveFile = () => {
    if (!activeFile) {
      onToast('Nenhum arquivo ativo para executar');
      return;
    }
    const ext = activeFile.name.split('.').pop()?.toLowerCase();
    let cmd = '';
    if (ext === 'ts' || ext === 'tsx') {
      cmd = `bun "${activeFile.path}" || ts-node "${activeFile.path}"`;
    } else if (ext === 'js' || ext === 'jsx' || ext === 'mjs') {
      cmd = `node "${activeFile.path}"`;
    } else if (ext === 'py') {
      cmd = `python3 "${activeFile.path}"`;
    } else if (ext === 'sh') {
      cmd = `bash "${activeFile.path}"`;
    } else if (ext === 'html') {
      cmd = `open "${activeFile.path}"`;
    } else {
      cmd = `cat "${activeFile.path}"`;
    }
    onRunTerminalCommand(`Run: ${activeFile.name}`, cmd);
    onToast(`Executando ${activeFile.name} no terminal`);
  };

  // -------------------------------------------------------------------------
  // 4. Web Preview & Ports State & Logic
  // -------------------------------------------------------------------------
  const [activePortsList, setActivePortsList] = useState<Array<{ port: number; process: string; pid?: number }>>([]);
  const [isScanningPorts, setIsScanningPorts] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('http://localhost:5173');
  const [inputPreviewUrl, setInputPreviewUrl] = useState('http://localhost:5173');
  const [previewViewport, setPreviewViewport] = useState<'responsive' | 'mobile'>('responsive');
  const [previewIframeKey, setPreviewIframeKey] = useState(0);

  const scanActivePorts = useCallback(async () => {
    setIsScanningPorts(true);
    try {
      if (window.electronAPI?.ports?.scan) {
        const res = await window.electronAPI.ports.scan();
        setActivePortsList(res?.ports || []);
        if (res?.ports && res.ports.length > 0 && previewUrl === 'http://localhost:5173') {
          setPreviewUrl(`http://localhost:${res.ports[0].port}`);
          setInputPreviewUrl(`http://localhost:${res.ports[0].port}`);
        }
      } else {
        const res = await window.electronAPI?.shell?.exec('lsof -iTCP -sTCP:LISTEN -n -P');
        if (res?.stdout) {
          const lines = res.stdout.split('\n').slice(1).filter(Boolean);
          const found: Array<{ port: number; process: string; pid?: number }> = [];
          const seen = new Set<number>();
          for (const l of lines) {
            const parts = l.split(/\s+/);
            const proc = parts[0];
            const pid = parseInt(parts[1], 10);
            const portPart = parts[8] || parts[parts.length - 2];
            const match = portPart?.match(/:(\d+)$/);
            if (match) {
              const port = parseInt(match[1], 10);
              if (!seen.has(port)) {
                seen.add(port);
                found.push({ port, process: proc, pid });
              }
            }
          }
          setActivePortsList(found);
        }
      }
    } catch (err) {
      console.warn('Scan ports error:', err);
    } finally {
      setIsScanningPorts(false);
    }
  }, [previewUrl]);

  // -------------------------------------------------------------------------
  // 5. Extensions Marketplace State & Logic
  // -------------------------------------------------------------------------
  const [extensionTab, setExtensionTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [extensionSearchQuery, setExtensionSearchQuery] = useState('');
  const [selectedExtensionCategory, setSelectedExtensionCategory] = useState<string>('');
  const [marketplaceExtensions, setMarketplaceExtensions] = useState<any[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('devflow_installed_extensions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        name: 'prettier-vscode',
        namespace: 'esbenp',
        displayName: 'Prettier - Code formatter',
        description: 'Code formatter using prettier for JS, TS, HTML, CSS, JSON and more.',
        version: '10.4.1',
        downloadCount: 42500000,
        averageRating: 4.8,
        enabled: true,
        installedAt: 'Padrão da IDE',
      },
      {
        name: 'vscode-eslint',
        namespace: 'dbaeumer',
        displayName: 'ESLint',
        description: 'Integrates ESLint JavaScript into VS Code.',
        version: '3.0.10',
        downloadCount: 35100000,
        averageRating: 4.7,
        enabled: true,
        installedAt: 'Padrão da IDE',
      },
      {
        name: 'vscode-icons',
        namespace: 'vscode-icons-team',
        displayName: 'vscode-icons',
        description: 'Icons for Visual Studio Code',
        version: '12.9.0',
        downloadCount: 22400000,
        averageRating: 4.9,
        enabled: true,
        installedAt: 'Padrão da IDE',
      },
      {
        name: 'tailwind-shade-for-vscode',
        namespace: 'bradlc',
        displayName: 'Tailwind CSS IntelliSense',
        description: 'Intelligent Tailwind CSS tooling for VS Code',
        version: '0.14.3',
        downloadCount: 18900000,
        averageRating: 4.9,
        enabled: true,
        installedAt: 'Padrão da IDE',
      },
    ];
  });
  const [isExtensionsLoading, setIsExtensionsLoading] = useState(false);

  const searchMarketplace = useCallback(
    async (query = extensionSearchQuery, category = selectedExtensionCategory) => {
      setIsExtensionsLoading(true);
      try {
        if (window.electronAPI?.extensions?.search) {
          const res = await window.electronAPI.extensions.search(query, 35, category);
          if (res?.success && res.extensions) {
            setMarketplaceExtensions(res.extensions);
          } else {
            setMarketplaceExtensions([]);
          }
        }
      } catch (err) {
        console.warn('Search extensions failed:', err);
        setMarketplaceExtensions([]);
      } finally {
        setIsExtensionsLoading(false);
      }
    },
    [extensionSearchQuery, selectedExtensionCategory]
  );

  const handleInstallExtension = async (ext: any) => {
    onToast(`Baixando e instalando "${ext.displayName || ext.name}"...`);
    try {
      if (window.electronAPI?.extensions?.install) {
        const res = await window.electronAPI.extensions.install(ext.namespace, ext.name, ext.version);
        if (res?.success && res.record) {
          setInstalledExtensions((prev) => {
            const filtered = prev.filter((i) => !((i.namespace === ext.namespace) && i.name === ext.name));
            const updated = [res.record, ...filtered];
            localStorage.setItem('devflow_installed_extensions', JSON.stringify(updated));
            return updated;
          });
          onToast(`Extensão "${ext.displayName || ext.name}" instalada e pronta para uso!`);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Backend install failed, fallback to local registry:', err);
    }

    setInstalledExtensions((prev) => {
      const exists = prev.some(
        (item) => (item.namespace || '') + '.' + item.name === (ext.namespace || '') + '.' + ext.name
      );
      if (exists) return prev;
      const updated = [
        {
          ...ext,
          enabled: true,
          installedAt: new Date().toLocaleDateString('pt-BR'),
        },
        ...prev,
      ];
      localStorage.setItem('devflow_installed_extensions', JSON.stringify(updated));
      return updated;
    });
    onToast(`Extensão "${ext.displayName || ext.name}" instalada com sucesso!`);
  };

  const handleUninstallExtension = (extName: string, extNamespace?: string) => {
    setInstalledExtensions((prev) => {
      const updated = prev.filter(
        (item) => !((item.namespace || '') === (extNamespace || '') && item.name === extName)
      );
      localStorage.setItem('devflow_installed_extensions', JSON.stringify(updated));
      return updated;
    });
    onToast(`Extensão desinstalada.`);
  };

  const handleToggleExtensionEnabled = (extName: string, extNamespace?: string) => {
    setInstalledExtensions((prev) => {
      const updated = prev.map((item) => {
        if ((item.namespace || '') === (extNamespace || '') && item.name === extName) {
          return { ...item, enabled: !item.enabled };
        }
        return item;
      });
      localStorage.setItem('devflow_installed_extensions', JSON.stringify(updated));
      return updated;
    });
  };

  // Trigger data load when tabs switch
  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else if (activeTab === 'git') {
      refreshGitStatus();
    } else if (activeTab === 'debug') {
      loadPackageScripts();
    } else if (activeTab === 'preview') {
      scanActivePorts();
    } else if (activeTab === 'extensions') {
      if (marketplaceExtensions.length === 0) {
        searchMarketplace('');
      }
    }
  }, [activeTab, refreshGitStatus, loadPackageScripts, scanActivePorts, searchMarketplace, marketplaceExtensions.length]);

  return (
    <>
      {/* -------------------------------------------------- */}
      {/* 1. Search Panel (Border-free)                      */}
      {/* -------------------------------------------------- */}
      {activeTab === 'search' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 10,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
            <span
              style={{
                color: themeTokens.textPrimary,
                fontSize: 11,
                fontFamily: 'Poppins',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Busca
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => executeGlobalSearch()}
                title="Atualizar busca"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RefreshCw size={13} className={isSearchingFiles ? 'spin-animate' : ''} />
              </button>
              <button
                onClick={() => {
                  setGlobalSearchQuery('');
                  setSearchResults([]);
                }}
                title="Limpar busca"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <XCircle size={13} />
              </button>
            </div>
          </div>

          {/* Search & Replace Box */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
              <div
                onClick={() => setIsSearchReplaceOpen(!isSearchReplaceOpen)}
                style={{
                  cursor: 'pointer',
                  color: themeTokens.textSecondary,
                  transform: isSearchReplaceOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Alternar Substituição"
              >
                <ChevronRight size={14} />
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  borderRadius: 6,
                  border: 'none',
                  padding: '5px 8px',
                  gap: 6,
                }}
              >
                <input
                  ref={searchInputRef}
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') executeGlobalSearch();
                  }}
                  placeholder="Buscar no workspace (Enter)"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: themeTokens.textPrimary,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => setSearchMatchCase(!searchMatchCase)}
                  title="Diferenciar maiúsculas/minúsculas"
                  style={{
                    background: searchMatchCase ? hexToRgba(accentColor, 0.2) : 'transparent',
                    border: 'none',
                    color: searchMatchCase ? accentColor : themeTokens.textSecondary,
                    borderRadius: 4,
                    padding: '2px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <CaseUpper size={12} />
                </button>
                <button
                  onClick={() => setSearchMatchWholeWord(!searchMatchWholeWord)}
                  title="Palavra inteira"
                  style={{
                    background: searchMatchWholeWord ? hexToRgba(accentColor, 0.2) : 'transparent',
                    border: 'none',
                    color: searchMatchWholeWord ? accentColor : themeTokens.textSecondary,
                    borderRadius: 4,
                    padding: '2px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <WholeWord size={12} />
                </button>
                <button
                  onClick={() => setSearchUseRegex(!searchUseRegex)}
                  title="Expressão regular"
                  style={{
                    background: searchUseRegex ? hexToRgba(accentColor, 0.2) : 'transparent',
                    border: 'none',
                    color: searchUseRegex ? accentColor : themeTokens.textSecondary,
                    borderRadius: 4,
                    padding: '2px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Regex size={12} />
                </button>
              </div>
            </div>

            {isSearchReplaceOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', paddingLeft: 18 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 6,
                    border: 'none',
                    padding: '5px 8px',
                  }}
                >
                  <input
                    value={globalReplaceQuery}
                    onChange={(e) => setGlobalReplaceQuery(e.target.value)}
                    placeholder="Substituir"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11,
                      fontFamily: 'inherit',
                      minWidth: 0,
                    }}
                  />
                </div>
                <button
                  onClick={handleReplaceAll}
                  disabled={!globalSearchQuery.trim() || searchResults.length === 0}
                  title="Substituir Tudo"
                  style={{
                    background: hexToRgba(accentColor, 0.15),
                    border: 'none',
                    color: accentColor,
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10.5,
                    fontWeight: 500,
                  }}
                >
                  <CheckCheck size={12} />
                  <span>Tudo</span>
                </button>
              </div>
            )}
          </div>

          {/* Results summary */}
          <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, width: '100%', padding: '0 2px' }}>
            {isSearchingFiles ? (
              <span>Pesquisando no workspace...</span>
            ) : searchResults.length > 0 ? (
              <span>
                {searchResults.length} ocorrência(s) em {groupedSearchResults.length} arquivo(s)
              </span>
            ) : globalSearchQuery.trim() ? (
              <span>Nenhum resultado encontrado</span>
            ) : (
              <span>Digite uma busca e pressione Enter</span>
            )}
          </div>

          {/* Results tree */}
          <div
            className="no-scrollbar"
            style={{ flex: 1, width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {groupedSearchResults.map(({ file, matches }) => {
              const fileName = file.split('/').pop() || file;
              const relPath = file.replace(workspacePath, '').replace(/^\//, '');
              return (
                <div
                  key={file}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 6,
                    border: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => onJumpToLine(file, matches[0]?.line || 1)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <FileText size={12} color={accentColor} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: themeTokens.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={relPath}
                      >
                        {fileName}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 5px',
                        borderRadius: 8,
                        background: hexToRgba(accentColor, 0.15),
                        color: accentColor,
                        fontWeight: 600,
                      }}
                    >
                      {matches.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {matches.slice(0, 30).map((m, idx) => (
                      <div
                        key={idx}
                        onClick={() => onJumpToLine(file, m.line)}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 6,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                          border: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ color: themeTokens.textMuted, fontSize: 9.5, minWidth: 24, textAlign: 'right' }}>
                          {m.line}
                        </span>
                        <span
                          style={{
                            color: themeTokens.textSecondary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {m.text.trim()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* 2. Git / Source Control Panel (Border-free)        */}
      {/* -------------------------------------------------- */}
      {activeTab === 'git' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 10,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={13} color={accentColor} />
              <span
                style={{
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Controle de Versão
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={refreshGitStatus}
                title="Atualizar status do Git"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RefreshCw size={13} className={isGitLoading ? 'spin-animate' : ''} />
              </button>
              <button
                onClick={handleGitSync}
                title="Sincronizar (Pull & Push)"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* Branch Chip */}
          <div
            onClick={onOpenBranchModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: 6,
              padding: '5px 8px',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
            }}
            title="Clique para alternar branch"
          >
            <GitBranch size={12} color={accentColor} />
            <span
              style={{
                fontSize: 11,
                color: themeTokens.textPrimary,
                fontWeight: 500,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentBranch || 'main'}
            </span>
            <ChevronRight size={12} color={themeTokens.textSecondary} />
          </div>

          {/* Commit Box */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={gitCommitMsg}
              onChange={(e) => setGitCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  handleGitCommit();
                }
              }}
              placeholder="Mensagem de commit (⌘Enter para commitar)..."
              rows={3}
              style={{
                width: '100%',
                background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                border: 'none',
                borderRadius: 6,
                padding: '7px 9px',
                color: themeTokens.textPrimary,
                fontSize: 11,
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleGitCommit}
              disabled={isGitLoading || !gitCommitMsg.trim()}
              style={{
                width: '100%',
                background: accentColor,
                color: accentTextColor,
                border: 'none',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: isGitLoading || !gitCommitMsg.trim() ? 'not-allowed' : 'pointer',
                opacity: isGitLoading || !gitCommitMsg.trim() ? 0.6 : 1,
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Commit</span>
            </button>
          </div>

          {/* Changes Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'flex', marginTop: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase' }}>
              Alterações ({gitChanges.length})
            </span>
            {gitChanges.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => window.electronAPI?.shell?.exec('git add -A', workspacePath).then(() => refreshGitStatus())}
                  title="Adicionar todas as alterações (Stage All)"
                  style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => window.electronAPI?.shell?.exec('git reset HEAD', workspacePath).then(() => refreshGitStatus())}
                  title="Remover todas do stage (Unstage All)"
                  style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
                >
                  <Minus size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Changes List */}
          <div
            className="no-scrollbar"
            style={{ flex: 1, width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {gitChanges.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: themeTokens.textMuted, fontSize: 11 }}>
                Nenhuma alteração pendente
              </div>
            ) : (
              gitChanges.map((change, idx) => {
                const fileName = change.path.split('/').pop() || change.path;
                const statusColor =
                  change.status === 'M'
                    ? '#f59e0b'
                    : change.status === 'A'
                    ? '#10b981'
                    : change.status === 'D'
                    ? '#ef4444'
                    : '#3b82f6';
                const fullPath = change.path.startsWith('/') ? change.path : `${workspacePath}/${change.path}`;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 6px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      onClick={() => {
                        if (onStartReview) {
                          onStartReview([
                            {
                              path: fullPath,
                              name: fileName,
                              status: change.status === 'M' ? 'modified' : change.status === 'A' ? 'added' : 'deleted',
                            },
                          ]);
                        } else {
                          onOpenFile(fullPath, fileName);
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}
                      title={`${change.path} (Clique para comparar)`}
                    >
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: statusColor, minWidth: 14 }}>
                        {change.status}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: themeTokens.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fileName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          if (onStartReview) {
                            onStartReview([
                              {
                                path: fullPath,
                                name: fileName,
                                status: change.status === 'M' ? 'modified' : change.status === 'A' ? 'added' : 'deleted',
                              },
                            ]);
                          }
                        }}
                        title="Comparar com HEAD (Diff Review)"
                        style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={() => handleGitDiscard(change.path)}
                        title="Descartar alterações"
                        style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        onClick={() => (change.staged ? handleGitUnstage(change.path) : handleGitStage(change.path))}
                        title={change.staged ? 'Remover do Stage' : 'Adicionar ao Stage'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: change.staged ? '#10b981' : themeTokens.textSecondary,
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        {change.staged ? <Minus size={12} /> : <Plus size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* 3. Run and Debug Panel (Border-free)               */}
      {/* -------------------------------------------------- */}
      {activeTab === 'debug' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Play size={13} color={accentColor} />
              <span
                style={{
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Executar e Depurar
              </span>
            </div>
            <button
              onClick={loadPackageScripts}
              title="Recarregar scripts"
              style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
            >
              <RefreshCw size={13} className={isLoadingScripts ? 'spin-animate' : ''} />
            </button>
          </div>

          {/* Active File Quick Run */}
          <div
            style={{
              width: '100%',
              padding: 10,
              background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary }}>ARQUIVO ATUAL</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color={accentColor} />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: themeTokens.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeFile ? activeFile.name : 'Nenhum arquivo aberto'}
                </span>
                <span style={{ fontSize: 9.5, color: themeTokens.textMuted }}>
                  {activeFile?.language || 'runtime'}
                </span>
              </div>
            </div>
            <button
              onClick={handleRunActiveFile}
              disabled={!activeFile}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: activeFile ? 'pointer' : 'not-allowed',
                opacity: activeFile ? 1 : 0.6,
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Play size={12} fill="#ffffff" />
              <span>Executar Arquivo Atual</span>
            </button>
          </div>

          {/* package.json Scripts */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary }}>
              SCRIPTS DO PACKAGE.JSON ({Object.keys(packageScripts).length})
            </span>
            <div
              className="no-scrollbar"
              style={{ width: '100%', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              {Object.keys(packageScripts).length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: themeTokens.textMuted, fontSize: 11 }}>
                  Nenhum script encontrado no package.json
                </div>
              ) : (
                Object.entries(packageScripts).map(([sName, sCmd]) => (
                  <div
                    key={sName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                      borderRadius: 6,
                      border: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, marginRight: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>{sName}</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          color: themeTokens.textMuted,
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sCmd}
                      </span>
                    </div>
                    <button
                      onClick={() => onRunTerminalCommand(`Script: ${sName}`, `npm run ${sName}`)}
                      title={`Executar npm run ${sName}`}
                      style={{
                        background: hexToRgba(accentColor, 0.15),
                        border: 'none',
                        color: accentColor,
                        borderRadius: 5,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      <Play size={11} fill={accentColor} />
                      <span>Run</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* 4. Web Preview & Ports Panel (Border-free)         */}
      {/* -------------------------------------------------- */}
      {activeTab === 'preview' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 10,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Monitor size={13} color={accentColor} />
              <span
                style={{
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Portas & Web Preview
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={scanActivePorts}
                title="Escanear portas ativas"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RefreshCw size={13} className={isScanningPorts ? 'spin-animate' : ''} />
              </button>
              <button
                onClick={() => window.electronAPI?.shell?.openExternal(previewUrl)}
                title="Abrir no navegador do sistema"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <ExternalLink size={13} />
              </button>
            </div>
          </div>

          {/* Active Ports List */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary }}>
              PORTAS EM EXECUÇÃO ({activePortsList.length})
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activePortsList.length === 0 ? (
                <div style={{ fontSize: 10.5, color: themeTokens.textMuted, padding: '4px 0' }}>
                  Nenhum servidor local detectado (Inicie seu app com npm run dev)
                </div>
              ) : (
                activePortsList.map((p) => {
                  const isCurrent = previewUrl.includes(`:${p.port}`);
                  return (
                    <div
                      key={p.port}
                      onClick={() => {
                        const url = `http://localhost:${p.port}`;
                        setPreviewUrl(url);
                        setInputPreviewUrl(url);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: isCurrent
                          ? hexToRgba(accentColor, 0.2)
                          : isEffectiveDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.06)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>:{p.port}</span>
                      <span style={{ fontSize: 9.5, color: themeTokens.textSecondary }}>({p.process})</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Embedded Web Browser */}
          <div
            style={{
              width: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 8,
              border: 'none',
              overflow: 'hidden',
              background: isEffectiveDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)',
              minHeight: 250,
            }}
          >
            {/* Address bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                border: 'none',
                background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <button
                onClick={() => setPreviewIframeKey((k) => k + 1)}
                title="Recarregar página"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RefreshCw size={12} />
              </button>
              <input
                value={inputPreviewUrl}
                onChange={(e) => setInputPreviewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    let url = inputPreviewUrl.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'http://' + url;
                    }
                    setPreviewUrl(url);
                  }
                }}
                placeholder="http://localhost:5173"
                style={{
                  flex: 1,
                  background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 7px',
                  color: themeTokens.textPrimary,
                  fontSize: 10.5,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setPreviewViewport(previewViewport === 'responsive' ? 'mobile' : 'responsive')}
                title={previewViewport === 'responsive' ? 'Mudar para Mobile (375px)' : 'Mudar para Responsivo'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: previewViewport === 'mobile' ? accentColor : themeTokens.textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <Monitor size={12} />
              </button>
            </div>

            {/* iframe */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <iframe
                key={previewIframeKey}
                src={previewUrl}
                style={{
                  width: previewViewport === 'mobile' ? 375 : '100%',
                  height: '100%',
                  border: 'none',
                  boxShadow: previewViewport === 'mobile' ? '0 0 20px rgba(0,0,0,0.3)' : 'none',
                }}
                title="Web Preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* 5. VS Code Extensions Marketplace Panel (Border-free)*/}
      {/* -------------------------------------------------- */}
      {activeTab === 'extensions' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 10,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Blocks size={14} color={accentColor} />
              <span
                style={{
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Extensões: Open VSX
              </span>
            </div>
            <button
              onClick={() => searchMarketplace()}
              title="Atualizar lista"
              style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
            >
              <RefreshCw size={13} className={isExtensionsLoading ? 'spin-animate' : ''} />
            </button>
          </div>

          {/* Marketplace / Installed Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderRadius: 6,
              border: 'none',
              padding: 2,
              gap: 2,
              boxSizing: 'border-box',
            }}
          >
            <button
              onClick={() => setExtensionTab('marketplace')}
              style={{
                flex: 1,
                padding: '4px 0',
                border: 'none',
                borderRadius: 4,
                background: extensionTab === 'marketplace' ? hexToRgba(accentColor, 0.25) : 'transparent',
                color: extensionTab === 'marketplace' ? accentColor : themeTokens.textSecondary,
                fontWeight: extensionTab === 'marketplace' ? 600 : 400,
                fontSize: 10.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Marketplace
            </button>
            <button
              onClick={() => setExtensionTab('installed')}
              style={{
                flex: 1,
                padding: '4px 0',
                border: 'none',
                borderRadius: 4,
                background: extensionTab === 'installed' ? hexToRgba(accentColor, 0.25) : 'transparent',
                color: extensionTab === 'installed' ? accentColor : themeTokens.textSecondary,
                fontWeight: extensionTab === 'installed' ? 600 : 400,
                fontSize: 10.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s ease',
              }}
            >
              <span>Instaladas</span>
              <span
                style={{
                  fontSize: 9,
                  padding: '0 4px',
                  borderRadius: 8,
                  background: accentColor,
                  color: accentTextColor,
                  fontWeight: 700,
                }}
              >
                {installedExtensions.length}
              </span>
            </button>
          </div>

          {/* Search Input (Border-free) */}
          {extensionTab === 'marketplace' && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                borderRadius: 6,
                border: 'none',
                padding: '6px 8px',
                gap: 6,
                boxSizing: 'border-box',
              }}
            >
              <Search size={12} color={themeTokens.textSecondary} />
              <input
                value={extensionSearchQuery}
                onChange={(e) => {
                  setExtensionSearchQuery(e.target.value);
                  searchMarketplace(e.target.value);
                }}
                placeholder="Buscar no Open VSX Registry..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />
              {extensionSearchQuery && (
                <button
                  onClick={() => {
                    setExtensionSearchQuery('');
                    searchMarketplace('');
                  }}
                  style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Category Filter Chips (Border-free) */}
          {extensionTab === 'marketplace' && (
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', width: '100%', paddingBottom: 2 }} className="no-scrollbar">
              {['', 'Themes', 'Linters', 'Formatters', 'Programming Languages', 'Snippets'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedExtensionCategory(cat);
                    searchMarketplace(extensionSearchQuery, cat);
                  }}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: 9.5,
                    whiteSpace: 'nowrap',
                    border: 'none',
                    background:
                      selectedExtensionCategory === cat
                        ? hexToRgba(accentColor, 0.25)
                        : isEffectiveDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.06)',
                    color: selectedExtensionCategory === cat ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    fontWeight: selectedExtensionCategory === cat ? 600 : 400,
                  }}
                >
                  {cat === '' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Extension Cards List (Border-free rows like VS Code) */}
          <div
            className="no-scrollbar"
            style={{ flex: 1, width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {isExtensionsLoading ? (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: themeTokens.textSecondary,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <RefreshCw size={14} className="spin-animate" />
                <span>Carregando extensões...</span>
              </div>
            ) : (
              (extensionTab === 'marketplace' ? marketplaceExtensions : installedExtensions).map((ext) => {
                const isInstalled = installedExtensions.some(
                  (i) => (i.namespace || '') === (ext.namespace || '') && i.name === ext.name
                );
                const installedItem = installedExtensions.find(
                  (i) => (i.namespace || '') === (ext.namespace || '') && i.name === ext.name
                );
                const iconUrl = ext.files?.icon || ext.iconUrl;
                const dCount = ext.downloadCount
                  ? ext.downloadCount > 1000000
                    ? `${(ext.downloadCount / 1000000).toFixed(1)}M`
                    : ext.downloadCount > 1000
                    ? `${(ext.downloadCount / 1000).toFixed(0)}k`
                    : String(ext.downloadCount)
                  : null;

                return (
                  <div
                    key={(ext.namespace || '') + '.' + ext.name}
                    onClick={() => onSelectExtension?.(ext)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: 'none',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={ext.name}
                          style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: hexToRgba(accentColor, 0.15),
                            color: accentColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {ext.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: themeTokens.textPrimary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {ext.displayName || ext.name}
                          </span>
                          {ext.version && (
                            <span style={{ fontSize: 9.5, color: themeTokens.textMuted, flexShrink: 0 }}>
                              v{ext.version}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10.5, color: themeTokens.textSecondary, fontWeight: 500 }}>
                          {ext.namespace || 'Community'}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: themeTokens.textMuted,
                            marginTop: 3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.35,
                          }}
                        >
                          {ext.description || 'Nenhuma descrição disponível'}
                        </span>
                      </div>
                    </div>

                    {/* Footer (Border-free) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 2,
                        paddingTop: 2,
                        border: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {dCount && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: themeTokens.textSecondary }}>
                            <Download size={10} />
                            <span>{dCount}</span>
                          </div>
                        )}
                        {ext.averageRating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9.5, color: '#f59e0b' }}>
                            <Star size={10} fill="#f59e0b" />
                            <span>{ext.averageRating.toFixed(1)}</span>
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isInstalled ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExtensionEnabled(ext.name, ext.namespace);
                              }}
                              title={installedItem?.enabled ? 'Desativar extensão' : 'Ativar extensão'}
                              style={{
                                background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 7px',
                                color: installedItem?.enabled ? '#10b981' : themeTokens.textMuted,
                                fontSize: 9.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              {installedItem?.enabled ? 'Ativado' : 'Desativado'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUninstallExtension(ext.name, ext.namespace);
                              }}
                              title="Desinstalar extensão"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 7px',
                                color: '#ef4444',
                                fontSize: 9.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              Desinstalar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstallExtension(ext);
                            }}
                            style={{
                              background: accentColor,
                              color: accentTextColor,
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 10px',
                              fontSize: 10.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: 'none',
                            }}
                          >
                            <Download size={10} />
                            <span>Instalar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
};
