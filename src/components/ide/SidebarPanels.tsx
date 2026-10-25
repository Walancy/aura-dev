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
  X,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  Layers,
  AtSign,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react';
import { FileIcon } from '../FileIcon';
import { shq, parseStatusZ, discardCommand, stageCommand, unstageCommand, SYNC_COMMAND } from '../../utils/gitShell';
import { logSystemActivity } from '../../utils/brainService';
import {
  type DesignBridgeManifest,
  type DesignScreenSpec,
  buildScreenSvgFallbackDataUrl,
  resolveDesignScreenPreviewUrl,
} from '../../utils/designBridgeService';

export interface SidebarPanelsProps {
  previewUrl: string | null;
  projects?: Array<{ name: string; localDir?: string }>;
  onOpenPreview: (url: string) => void;
  activeTab: 'search' | 'git' | 'debug' | 'preview' | 'testing' | 'design';
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
  onGenerateCommitMessage?: (repoDir: string) => Promise<string>;
  designManifest?: DesignBridgeManifest | null;
  selectedDesignScreenId?: string | null;
  onSelectDesignScreen?: (screen: DesignScreenSpec) => void;
  onImplementDesignScreen?: (screen?: DesignScreenSpec) => void;
  onMentionDesignScreen?: (screen?: DesignScreenSpec) => void;
  onRefreshDesignManifest?: () => void;
}

export const SidebarPanels: React.FC<SidebarPanelsProps> = ({
  activeTab,
  previewUrl,
  projects = [],
  onOpenPreview,
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
  onGenerateCommitMessage,
  designManifest,
  selectedDesignScreenId,
  onSelectDesignScreen,
  onImplementDesignScreen,
  onMentionDesignScreen,
  onRefreshDesignManifest,
}) => {
  const [designSearchQuery, setDesignSearchQuery] = useState('');
  const [resolvedDesignThumbs, setResolvedDesignThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const screens = designManifest?.screens || [];
    if (screens.length === 0) return;
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const scr of screens) {
        const url = await resolveDesignScreenPreviewUrl(workspacePath, scr);
        if (!alive) return;
        next[scr.id] = url;
      }
      if (alive) {
        setResolvedDesignThumbs((prev) => {
          const changed = Object.keys(next).some((k) => prev[k] !== next[k]);
          return changed ? { ...prev, ...next } : prev;
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspacePath, designManifest]);

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
  // 2. Git / Source Control State & Logic (multi-repo)
  // -------------------------------------------------------------------------
  interface RepoGitEntry {
    dir: string;
    name: string;
    branch: string;
    changes: Array<{ path: string; status: string; staged: boolean }>;
    commitMsg: string;
    isLoading: boolean;
    isGenerating: boolean;
    collapsed: boolean;
    changesCollapsed: boolean;
  }

  const [gitRepos, setGitRepos] = useState<RepoGitEntry[]>([]);
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [changesGroupCollapsed, setChangesGroupCollapsed] = useState(false);

  const updateRepo = useCallback(
    (dir: string, patch: Partial<RepoGitEntry> | ((r: RepoGitEntry) => Partial<RepoGitEntry>)) => {
      setGitRepos((prev) =>
        prev.map((r) => (r.dir === dir ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r))
      );
    },
    []
  );

  const discoverAndRefreshRepos = useCallback(async () => {
    if (!window.electronAPI?.shell?.exec) return;
    setIsGitLoading(true);
    try {
      let repoDirs: Array<{ dir: string; name: string }> = [];
      if (window.electronAPI.git?.listRepos) {
        repoDirs = (await window.electronAPI.git.listRepos(workspacePath)) || [];
      }
      if (repoDirs.length === 0) {
        repoDirs = [{ dir: workspacePath, name: workspacePath.split('/').filter(Boolean).pop() || 'workspace' }];
      }

      const results = await Promise.all(
        repoDirs.map(async ({ dir, name }) => {
          const [statusRes, branchRes] = await Promise.all([
            window.electronAPI!.shell!.exec('GIT_OPTIONAL_LOCKS=0 git status --porcelain=v1 -z', dir),
            // `--show-current` funciona também em repositório novo (sem commits); em HEAD solto devolve vazio
            window.electronAPI!.shell!.exec('git branch --show-current || true; git rev-parse --short HEAD 2>/dev/null', dir),
          ]);
          const changes = parseStatusZ(statusRes?.stdout || '');
          const [curBranch, shortHead] = (branchRes?.stdout || '').split('\n').map((l) => l.trim());
          // com HEAD solto (sem branch) mostra o commit; sem nada é uma branch ainda sem commits
          const branch = curBranch || (shortHead ? `(${shortHead})` : 'main');
          return { dir, name, branch, changes };
        })
      );

      setGitRepos((prev) =>
        results.map((r) => {
          const existing = prev.find((p) => p.dir === r.dir);
          return {
            dir: r.dir,
            name: r.name,
            branch: r.branch,
            changes: r.changes,
            commitMsg: existing?.commitMsg || '',
            isLoading: false,
            isGenerating: existing?.isGenerating || false,
            collapsed: existing?.collapsed ?? false,
            changesCollapsed: existing?.changesCollapsed ?? false,
          };
        })
      );
    } catch (err) {
      console.warn('Git status refresh failed:', err);
    } finally {
      setIsGitLoading(false);
    }
  }, [workspacePath]);

  const handleGitCommit = async (repoDir: string): Promise<boolean> => {
    const repo = gitRepos.find((r) => r.dir === repoDir);
    if (!repo || !repo.commitMsg.trim()) {
      onToast('Digite uma mensagem de commit');
      return false;
    }
    updateRepo(repoDir, { isLoading: true });
    try {
      const hasStaged = repo.changes.some((c) => c.staged);
      if (!hasStaged) {
        await window.electronAPI?.shell?.exec('git add -A', repoDir);
      }
      const commitRes = await window.electronAPI?.shell?.exec(`git commit -m ${shq(repo.commitMsg.trim())}`, repoDir);
      if (commitRes?.exitCode === 0) {
        updateRepo(repoDir, { commitMsg: '' });
        onToast(`Commit realizado em ${repo.name}!`);
        logSystemActivity('git', 'commit', repoDir, { mensagem: repo.commitMsg.trim().slice(0, 120) });
        await discoverAndRefreshRepos();
        return true;
      } else {
        onToast((commitRes?.stderr || commitRes?.stdout || 'Erro ao commitar').trim().split('\n')[0]);
      }
    } catch (err: any) {
      onToast(`Erro no commit: ${err.message}`);
    } finally {
      updateRepo(repoDir, { isLoading: false });
    }
    return false;
  };

  const handleGitDiscard = async (repoDir: string, filePath: string) => {
    try {
      const res = await window.electronAPI?.shell?.exec(discardCommand(filePath), repoDir);
      onToast(res?.exitCode === 0 ? `Alterações descartadas em ${filePath}` : `Erro ao descartar: ${(res?.stderr || '').trim().split('\n')[0]}`);
      logSystemActivity('git', 'descartar_alteracoes', repoDir, { arquivo: filePath });
      discoverAndRefreshRepos();
    } catch (err: any) {
      onToast(`Erro ao descartar: ${err.message}`);
    }
  };

  const handleGitStage = async (repoDir: string, filePath: string) => {
    const res = await window.electronAPI?.shell?.exec(stageCommand(filePath), repoDir);
    if (res?.exitCode !== 0) onToast(`Erro ao adicionar: ${(res?.stderr || '').trim().split('\n')[0]}`);
    discoverAndRefreshRepos();
  };

  const handleGitUnstage = async (repoDir: string, filePath: string) => {
    const res = await window.electronAPI?.shell?.exec(unstageCommand(filePath), repoDir);
    if (res?.exitCode !== 0) onToast(`Erro ao remover do stage: ${(res?.stderr || '').trim().split('\n')[0]}`);
    discoverAndRefreshRepos();
  };

  const handleGitSync = async (repoDir: string, repoName: string) => {
    onToast(`Sincronizando ${repoName}...`);
    try {
      const res = await window.electronAPI?.shell?.exec(SYNC_COMMAND, repoDir);
      if (res?.exitCode === 0) {
        onToast(`${repoName} sincronizado com sucesso!`);
      } else {
        onToast(`Erro ao sincronizar: ${(res?.stderr || res?.error || '').trim().split('\n').filter(Boolean).slice(-1)[0] || 'verifique o remoto'}`);
      }
      logSystemActivity('git', 'sincronizar', repoDir, { ok: res?.exitCode === 0 });
      discoverAndRefreshRepos();
    } catch (e: any) {
      onToast(`Erro na sincronização: ${e.message}`);
    }
  };

  const handleGenerateCommitMsg = async (repoDir: string) => {
    if (!onGenerateCommitMessage) {
      onToast('Geração por IA indisponível');
      return;
    }
    updateRepo(repoDir, { isGenerating: true });
    try {
      const msg = await onGenerateCommitMessage(repoDir);
      updateRepo(repoDir, { commitMsg: msg });
    } catch (err: any) {
      onToast(err?.message || 'Erro ao gerar mensagem com IA');
    } finally {
      updateRepo(repoDir, { isGenerating: false });
    }
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: themeTokens.textSecondary,
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
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
  const [activePortsList, setActivePortsList] = useState<Array<{ port: number; process?: string; command?: string; cwd?: string; pid?: number | string }>>([]);
  const [isScanningPorts, setIsScanningPorts] = useState(false);

  // Nome do projeto (o mesmo do seletor da header) dono do processo, pelo diretório de trabalho.
  const projectLabel = (p: { cwd?: string; command?: string }) => {
    if (!p.cwd) return p.command || '';
    const hit = projects
      .filter((x) => x.localDir && (p.cwd === x.localDir || p.cwd!.startsWith(x.localDir.replace(/\/$/, '') + '/')))
      .sort((a, b) => b.localDir!.length - a.localDir!.length)[0];
    return hit?.name || p.cwd.split('/').filter(Boolean).pop() || p.command || '';
  };

  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(new Set());
  const [closeConfirm, setCloseConfirm] = useState<typeof activePortsList | null>(null);
  const [isClosingPorts, setIsClosingPorts] = useState(false);

  const closePorts = async (list: typeof activePortsList) => {
    setIsClosingPorts(true);
    const pids = [...new Set(list.map((p) => p.pid).filter(Boolean))] as Array<number | string>;
    const results = await Promise.all(pids.map((pid) => window.electronAPI!.ports.kill(pid)));
    const failed = results.filter((r) => !r?.success).length;
    onToast(failed ? `${failed} processo(s) não puderam ser encerrados` : `${list.length} porta(s) fechada(s)`);
    setSelectedPorts(new Set());
    setCloseConfirm(null);
    setIsClosingPorts(false);
    setTimeout(scanActivePorts, 400);
  };

  const scanActivePorts = useCallback(async () => {
    setIsScanningPorts(true);
    try {
      if (window.electronAPI?.ports?.scan) {
        const res = await window.electronAPI.ports.scan();
        setActivePortsList(res?.ports || []);
      } else {
        const res = await window.electronAPI?.shell?.exec('lsof -iTCP -sTCP:LISTEN -n -P');
        if (res?.stdout) {
          const lines = res.stdout.split('\n').slice(1).filter(Boolean);
          const found: Array<{ port: number; process?: string; command?: string; cwd?: string; pid?: number | string }> = [];
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
  }, []);


  // Trigger data load when tabs switch
  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else if (activeTab === 'git') {
      discoverAndRefreshRepos();
    } else if (activeTab === 'debug') {
      loadPackageScripts();
    } else if (activeTab === 'preview') {
      scanActivePorts();
    }
  }, [activeTab, discoverAndRefreshRepos, loadPackageScripts, scanActivePorts]);

  return (
    <div
      style={{
        width: '100%',
        flex: '1 1 0',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        overflow: 'hidden',
      }}
    >
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
            padding: '8px 10px',
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 6,
            display: 'flex',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Changes Group (wraps every detected repo) */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              onClick={() => setChangesGroupCollapsed(!changesGroupCollapsed)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 0', userSelect: 'none' }}
            >
              <ChevronRight
                size={12}
                color={themeTokens.textSecondary}
                style={{ transform: changesGroupCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s ease' }}
              />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase' }}>
                Alterações
              </span>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => discoverAndRefreshRepos()}
                  title="Atualizar status do Git"
                  style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <RefreshCw size={13} className={isGitLoading ? 'spin-animate' : ''} />
                </button>
                <button
                  onClick={() => gitRepos.forEach((r) => handleGitSync(r.dir, r.name))}
                  title="Sincronizar todos os repositórios (Pull & Push)"
                  style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {!changesGroupCollapsed && (
              gitRepos.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: themeTokens.textMuted, fontSize: 11 }}>
                  {isGitLoading ? 'Verificando repositórios...' : 'Nenhum repositório Git encontrado'}
                </div>
              ) : (
                gitRepos.map((repo) => {
                  const isDirty = repo.changes.length > 0;
                  return (
                    <div key={repo.dir} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Repo Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
                        <div
                          onClick={() => updateRepo(repo.dir, { collapsed: !repo.collapsed })}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: themeTokens.textSecondary, flexShrink: 0 }}
                        >
                          <ChevronRight
                            size={13}
                            style={{ transform: repo.collapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s ease' }}
                          />
                        </div>
                        <span
                          onClick={() => updateRepo(repo.dir, { collapsed: !repo.collapsed })}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: themeTokens.textPrimary,
                            cursor: 'pointer',
                            minWidth: 0,
                            flexShrink: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={repo.dir}
                        >
                          {repo.name}
                        </span>
                        <span style={{ fontSize: 10, color: themeTokens.textSecondary, fontWeight: 500, flexShrink: 0 }}>
                          {repo.branch}
                          {isDirty ? '*' : ''}
                        </span>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={() => discoverAndRefreshRepos()}
                            title="Atualizar"
                            style={iconBtnStyle}
                          >
                            <RefreshCw size={11} />
                          </button>
                          <button
                            onClick={() => handleGitSync(repo.dir, repo.name)}
                            title="Sincronizar (Pull & Push)"
                            style={iconBtnStyle}
                          >
                            <RotateCcw size={11} />
                          </button>
                          <button
                            onClick={() =>
                              window.electronAPI?.shell?.exec('git reset --hard && git clean -fd', repo.dir).then(() => discoverAndRefreshRepos())
                            }
                            title="Descartar todas as alterações"
                            style={iconBtnStyle}
                          >
                            <Check size={11} />
                          </button>
                          <button
                            onClick={() => onRunTerminalCommand(repo.name, `cd "${repo.dir}"`)}
                            title="Mais ações"
                            style={iconBtnStyle}
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        </div>
                      </div>

                      {!repo.collapsed && (
                        <>
                          {/* Commit Box */}
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 19, boxSizing: 'border-box' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                              <textarea
                                value={repo.commitMsg}
                                onChange={(e) => updateRepo(repo.dir, { commitMsg: e.target.value })}
                                onKeyDown={(e) => {
                                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    handleGitCommit(repo.dir);
                                  }
                                }}
                                placeholder="Message (⌘Enter to commit)"
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
                              {!repo.commitMsg && (
                                <button
                                  onClick={() => handleGenerateCommitMsg(repo.dir)}
                                  disabled={repo.isGenerating}
                                  title="Gerar mensagem de commit com a IA selecionada no chat"
                                  style={{
                                    position: 'absolute',
                                    right: 6,
                                    bottom: 6,
                                    background: hexToRgba(accentColor, 0.18),
                                    border: 'none',
                                    color: accentColor,
                                    borderRadius: 5,
                                    padding: '3px 7px',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    cursor: repo.isGenerating ? 'not-allowed' : 'pointer',
                                    opacity: repo.isGenerating ? 0.6 : 1,
                                  }}
                                >
                                  <Sparkles size={10} className={repo.isGenerating ? 'spin-animate' : ''} />
                                  <span>{repo.isGenerating ? 'Gerando...' : 'Generate'}</span>
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', width: '100%' }}>
                              <button
                                onClick={() => handleGitCommit(repo.dir)}
                                disabled={repo.isLoading || !repo.commitMsg.trim()}
                                style={{
                                  flex: 1,
                                  background: accentColor,
                                  color: accentTextColor,
                                  border: 'none',
                                  borderRadius: '6px 0 0 6px',
                                  padding: '6px 10px',
                                  cursor: repo.isLoading || !repo.commitMsg.trim() ? 'not-allowed' : 'pointer',
                                  opacity: repo.isLoading || !repo.commitMsg.trim() ? 0.6 : 1,
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
                              <button
                                onClick={() => handleGitCommit(repo.dir).then((ok) => ok && handleGitSync(repo.dir, repo.name))}
                                disabled={repo.isLoading || !repo.commitMsg.trim()}
                                title="Commit e sincronizar"
                                style={{
                                  background: accentColor,
                                  color: accentTextColor,
                                  border: 'none',
                                  borderLeft: `1px solid ${hexToRgba('#000000', 0.18)}`,
                                  borderRadius: '0 6px 6px 0',
                                  padding: '6px 8px',
                                  cursor: repo.isLoading || !repo.commitMsg.trim() ? 'not-allowed' : 'pointer',
                                  opacity: repo.isLoading || !repo.commitMsg.trim() ? 0.6 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Per-repo Changes Subsection */}
                          <div style={{ width: '100%', paddingLeft: 19, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div
                              onClick={() => updateRepo(repo.dir, { changesCollapsed: !repo.changesCollapsed })}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 0', userSelect: 'none' }}
                            >
                              <ChevronRight
                                size={11}
                                color={themeTokens.textSecondary}
                                style={{ transform: repo.changesCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s ease' }}
                              />
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', flex: 1 }}>
                                Alterações
                              </span>
                              {repo.changes.length > 0 && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: themeTokens.textSecondary,
                                    background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    borderRadius: 9,
                                    padding: '1px 6px',
                                    minWidth: 14,
                                    textAlign: 'center',
                                  }}
                                >
                                  {repo.changes.length}
                                </span>
                              )}
                              {repo.changes.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => window.electronAPI?.shell?.exec('git add -A', repo.dir).then(() => discoverAndRefreshRepos())}
                                    title="Adicionar todas as alterações (Stage All)"
                                    style={iconBtnStyle}
                                  >
                                    <Plus size={11} />
                                  </button>
                                  <button
                                    onClick={() => window.electronAPI?.shell?.exec('git reset -q', repo.dir).then(() => discoverAndRefreshRepos())}
                                    title="Remover todas do stage (Unstage All)"
                                    style={iconBtnStyle}
                                  >
                                    <Minus size={11} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {!repo.changesCollapsed && (
                              repo.changes.length === 0 ? (
                                <div style={{ padding: '8px 0', color: themeTokens.textMuted, fontSize: 10.5 }}>
                                  Nenhuma alteração pendente
                                </div>
                              ) : (
                                repo.changes.map((change, idx) => {
                                  const fileName = change.path.split('/').pop() || change.path;
                                  const dirIdx = change.path.lastIndexOf('/');
                                  const dirPart = dirIdx > -1 ? `${repo.name}/${change.path.substring(0, dirIdx)}` : repo.name;
                                  const statusColor =
                                    change.status === 'M'
                                      ? '#e2c08d'
                                      : change.status === 'A'
                                      ? '#73c991'
                                      : change.status === 'D'
                                      ? '#f14c4c'
                                      : '#73c991';
                                  const fullPath = change.path.startsWith('/') ? change.path : `${repo.dir}/${change.path}`;
                                  return (
                                    <div
                                      key={idx}
                                      className="skin-tab"
                                      style={{
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '4px 4px',
                                        borderRadius: 5,
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
                                        <FileIcon fileName={fileName} size={14} />
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: themeTokens.textPrimary,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {fileName}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: themeTokens.textMuted,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            minWidth: 0,
                                          }}
                                        >
                                          {dirPart}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
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
                                          style={iconBtnStyle}
                                        >
                                          <Eye size={11} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleGitDiscard(repo.dir, change.path);
                                          }}
                                          title="Descartar alterações"
                                          style={iconBtnStyle}
                                        >
                                          <RotateCcw size={10} />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            change.staged ? handleGitUnstage(repo.dir, change.path) : handleGitStage(repo.dir, change.path);
                                          }}
                                          title={change.staged ? 'Remover do Stage' : 'Adicionar ao Stage'}
                                          style={{ ...iconBtnStyle, color: change.staged ? '#73c991' : themeTokens.textSecondary }}
                                        >
                                          {change.staged ? <Minus size={11} /> : <Plus size={11} />}
                                        </button>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, minWidth: 12, textAlign: 'center' }}>
                                          {change.status}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )
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
          <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'flex', flexWrap: 'wrap', rowGap: 4, columnGap: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: themeTokens.textSecondary, whiteSpace: 'nowrap' }}>
              PORTAS EM EXECUÇÃO ({activePortsList.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              {selectedPorts.size > 0 && (
                <button
                  onClick={() => setCloseConfirm(activePortsList.filter((p) => selectedPorts.has(p.port)))}
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Fechar selecionadas ({selectedPorts.size})
                </button>
              )}
              {activePortsList.length > 0 && (
                <button
                  onClick={() => setCloseConfirm(activePortsList)}
                  style={{ background: 'transparent', color: themeTokens.textSecondary, border: 'none', borderRadius: 5, padding: '2px 5px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Fechar todas
                </button>
              )}
              <button
                onClick={scanActivePorts}
                title="Escanear portas ativas"
                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <RefreshCw size={13} className={isScanningPorts ? 'spin-animate' : ''} />
              </button>
            </div>
          </div>

          {/* Active Ports List */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activePortsList.length === 0 ? (
                <div style={{ fontSize: 10.5, color: themeTokens.textMuted, padding: '4px 0' }}>
                  Nenhum servidor local detectado (Inicie seu app com npm run dev)
                </div>
              ) : (
                activePortsList.map((p) => {
                  const isCurrent = !!previewUrl && previewUrl.includes(`:${p.port}`);
                  return (
                    <div
                      key={p.port}
                      onClick={() => {
                        onOpenPreview(`http://localhost:${p.port}`);
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
                      <input
                        type="checkbox"
                        checked={selectedPorts.has(p.port)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() =>
                          setSelectedPorts((prev) => {
                            const n = new Set(prev);
                            n.has(p.port) ? n.delete(p.port) : n.add(p.port);
                            return n;
                          })
                        }
                        style={{
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          width: 14,
                          height: 14,
                          margin: 0,
                          flexShrink: 0,
                          borderRadius: 4,
                          cursor: 'pointer',
                          border: `1px solid ${selectedPorts.has(p.port) ? accentColor : isEffectiveDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)'}`,
                          background: selectedPorts.has(p.port)
                            ? `${accentColor} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6.5' fill='none' stroke='${accentTextColor === '#000000' ? '%23000' : '%23fff'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/10px no-repeat`
                            : 'transparent',
                        }}
                      />
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>:{p.port}</span>
                      <span style={{ fontSize: 10.5, color: themeTokens.textSecondary, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectLabel(p)}</span>
                      <button
                        title="Fechar porta"
                        onClick={(e) => { e.stopPropagation(); setCloseConfirm([p]); }}
                        style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {closeConfirm && (
        <div
          onClick={() => !isClosingPorts && setCloseConfirm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 340, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, background: themeTokens.bgCard, border: '1px solid ' + themeTokens.border, color: themeTokens.textPrimary }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Fechar {closeConfirm.length === 1 ? `a porta :${closeConfirm[0].port}` : `${closeConfirm.length} portas`}?
            </div>
            <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Os processos que usam essas portas serão encerrados (kill -9). Trabalho não salvo neles será perdido.
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {closeConfirm.map((p) => (
                <div key={p.port} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ fontWeight: 600 }}>:{p.port}</span>
                  <span style={{ color: themeTokens.textSecondary }}>{projectLabel(p)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                disabled={isClosingPorts}
                onClick={() => setCloseConfirm(null)}
                style={{ background: 'transparent', color: themeTokens.textSecondary, border: 'none', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                disabled={isClosingPorts}
                onClick={() => closePorts(closeConfirm)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                {isClosingPorts ? 'Fechando...' : 'Fechar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* -------------------------------------------------- */}
      {/* 6. Testing Panel (VS Code & Antigravity Beaker)     */}
      {/* -------------------------------------------------- */}
      {activeTab === 'testing' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            padding: 12,
            background: themeTokens.bgCard,
            borderRadius: 8,
            border: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            display: 'inline-flex',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: themeTokens.textSecondary }}>
              Testes & Validação
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onRunTerminalCommand('Testes', 'npm test')}
                style={{
                  background: accentColor,
                  color: accentTextColor,
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Executar todos os testes no terminal"
              >
                <Play size={10} />
                <span>Executar</span>
              </button>
            </div>
          </div>

          {/* Quick Runner Cards */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => onRunTerminalCommand('npm test', 'npm test')}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary }}>npm test</div>
                <div style={{ fontSize: 10, color: themeTokens.textSecondary }}>Executa o test runner padrão do projeto</div>
              </div>
              <Play size={12} style={{ color: accentColor }} />
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => onRunTerminalCommand('Vitest Watch', 'npx vitest')}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary }}>Vitest (Watch)</div>
                <div style={{ fontSize: 10, color: themeTokens.textSecondary }}>Execução interativa contínua</div>
              </div>
              <Play size={12} style={{ color: accentColor }} />
            </div>

            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => onRunTerminalCommand('TypeCheck', 'npx tsc --noEmit')}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary }}>TypeScript Check</div>
                <div style={{ fontSize: 10, color: themeTokens.textSecondary }}>Validação estática de tipos</div>
              </div>
              <Play size={12} style={{ color: accentColor }} />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 6. DESIGN BRIDGE PANEL (Telas da aba Design na esquerda da IDE)     */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'design' && (
        <div
          style={{
            width: '100%',
            flex: '1 1 0',
            minHeight: 0,
            padding: 10,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: 'none',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Search + Refresh Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div
              style={{
                flex: 1,
                height: 28,
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
              }}
            >
              <Search size={12} color={themeTokens.textMuted} />
              <input
                type="text"
                value={designSearchQuery}
                onChange={(e) => setDesignSearchQuery(e.target.value)}
                placeholder="Buscar tela do design..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: themeTokens.textPrimary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  fontFamily: 'Poppins, sans-serif',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => onRefreshDesignManifest?.()}
              title="Recarregar telas da aba Design"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: themeTokens.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {(designManifest?.screens?.length ?? 0) > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                paddingBottom: 8,
                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, color: themeTokens.textSecondary, fontWeight: 400 }}>
                {designManifest!.screens.length} tela{designManifest!.screens.length === 1 ? '' : 's'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onMentionDesignScreen?.(undefined)}
                  title="Mencionar todas as telas (@design) no chat da IDE"
                  style={{
                    height: 26,
                    padding: '0 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    color: themeTokens.textPrimary,
                    fontSize: 10.5,
                    fontWeight: 400,
                    fontFamily: 'Poppins, sans-serif',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <AtSign size={11} />
                  <span>Todas</span>
                </button>
                <button
                  type="button"
                  onClick={() => onImplementDesignScreen?.(undefined)}
                  title="Implementar todas as telas da aba Design no projeto"
                  style={{
                    height: 26,
                    padding: '0 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 400,
                    fontFamily: 'Poppins, sans-serif',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>Implementar todas</span>
                </button>
              </div>
            </div>
          )}

          {/* Screens List */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {!designManifest || designManifest.screens.length === 0 ? (
              <div
                style={{
                  padding: '28px 12px',
                  textAlign: 'center',
                  fontSize: 11.5,
                  color: themeTokens.textSecondary,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <LayoutGrid size={22} strokeWidth={1.5} color={themeTokens.textMuted} />
                <span>Nenhuma tela sincronizada na aba Design.</span>
                <span style={{ fontSize: 10.5, color: themeTokens.textMuted, lineHeight: 1.4 }}>
                  Crie ou gere telas na aba Design para visualizá-las e implementá-las aqui.
                </span>
              </div>
            ) : (
              designManifest.screens
                .filter((scr) => {
                  const q = designSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    scr.name.toLowerCase().includes(q) ||
                    scr.slug.toLowerCase().includes(q) ||
                    scr.pageName.toLowerCase().includes(q)
                  );
                })
                .map((scr) => {
                  const isSelected = selectedDesignScreenId === scr.id;
                  const thumbUrl = resolvedDesignThumbs[scr.id] || scr.previewDataUrl || buildScreenSvgFallbackDataUrl(scr);
                  return (
                    <div
                      key={scr.id}
                      onClick={() => onSelectDesignScreen?.(scr)}
                      title={`Clique para abrir o preview de "${scr.name}" na área central`}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        background: isSelected
                          ? hexToRgba(accentColor, isEffectiveDark ? 0.18 : 0.12)
                          : isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.03)',
                        border: 'none',
                        boxShadow: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.07)'
                            : 'rgba(0, 0, 0, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.03)';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 88,
                          borderRadius: 5,
                          overflow: 'hidden',
                          background: scr.backgroundHex || (isEffectiveDark ? '#121214' : '#f1f5f9'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={thumbUrl}
                          alt={scr.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 400,
                              color: isSelected ? accentColor : themeTokens.textPrimary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {scr.name}
                          </span>
                          <span style={{ fontSize: 10, color: themeTokens.textSecondary }}>
                            {scr.width}×{scr.height}px · {scr.elementCount} elem
                          </span>
                        </div>
                        <Eye size={13} color={isSelected ? accentColor : themeTokens.textSecondary} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
