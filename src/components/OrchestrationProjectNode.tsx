import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FolderGit2,
  FolderCode,
  Folder,
  FolderOpen,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  Globe,
  Play,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  FileCode2,
  Save,
  ExternalLink,
  ChevronDown as DropdownIcon,
  Code2,
  FileText,
  X,
  DownloadCloud,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { FileIcon, FolderIcon } from './FileIcon';
import { allocateUniqueDevUrl, detectProjectPort, scanSystemOccupiedPorts, extractPortFromUrl, detectProjectApps, DetectedProjectApp } from '../utils/projectDevUrl';

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  extension?: string;
  size?: number;
  children?: FileTreeNode[];
}

export interface OrchestrationProjectNodeProps {
  nodeId: string;
  projectPath?: string;
  projectName?: string;
  gitBranch?: string;
  devUrl?: string;
  cloneUrl?: string;
  htmlUrl?: string;
  isCloned?: boolean;
  existingDevUrls?: string[];
  width: number;
  height: number;
  isEffectiveDark: boolean;
  accentColor: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateConfig: (config: {
    projectPath: string;
    projectName: string;
    gitBranch?: string;
    devUrl?: string;
    cloneUrl?: string;
    htmlUrl?: string;
    isCloned?: boolean;
  }) => void;
  onOpenUrlInBrowser?: (url: string) => void;
  onDeleteNode?: () => void;
  onToast?: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

// Maps file extension to Monaco editor language
function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'dart':
      return 'dart';
    case 'toml':
      return 'toml';
    case 'xml':
    case 'svg':
      return 'xml';
    default:
      return 'plaintext';
  }
}

export const OrchestrationProjectNode: React.FC<OrchestrationProjectNodeProps> = ({
  nodeId,
  projectPath: initialProjectPath,
  projectName: initialProjectName,
  gitBranch: initialGitBranch,
  devUrl: initialDevUrl,
  cloneUrl: initialCloneUrl,
  htmlUrl: initialHtmlUrl,
  isCloned: initialIsCloned,
  existingDevUrls = [],
  width,
  height,
  isEffectiveDark,
  accentColor,
  isExpanded,
  onToggleExpand,
  onUpdateConfig,
  onOpenUrlInBrowser,
  onDeleteNode,
  onToast,
}) => {
  // Available system projects (from Git / GitHub)
  const [projectsList, setProjectsList] = useState<GitProjectItem[]>([]);
  const [isProjectsDropdownOpen, setIsProjectsDropdownOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(initialProjectPath || '');
  const [currentName, setCurrentName] = useState<string>(initialProjectName || 'Projeto');
  const [currentBranch, setCurrentBranch] = useState<string>(initialGitBranch || 'main');
  const [currentDevUrl, setCurrentDevUrl] = useState<string>(initialDevUrl || 'http://localhost:5173');
  const [currentCloneUrl, setCurrentCloneUrl] = useState<string | undefined>(initialCloneUrl);
  const [currentHtmlUrl, setCurrentHtmlUrl] = useState<string | undefined>(initialHtmlUrl);
  const [isClonedState, setIsClonedState] = useState<boolean>(initialIsCloned !== false && Boolean(initialProjectPath));
  const [isCloning, setIsCloning] = useState<boolean>(false);

  // File tree & editor states
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasCopiedPath, setHasCopiedPath] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    setCurrentPath(initialProjectPath || '');
    setCurrentName(initialProjectName || 'Projeto');
    setCurrentBranch(initialGitBranch || 'main');
    setCurrentDevUrl(initialDevUrl || 'http://localhost:5173');
    setCurrentCloneUrl(initialCloneUrl);
    setCurrentHtmlUrl(initialHtmlUrl);
    setIsClonedState(initialIsCloned !== false && Boolean(initialProjectPath));
  }, [initialProjectPath, initialProjectName, initialGitBranch, initialDevUrl, initialCloneUrl, initialHtmlUrl, initialIsCloned]);

  // Load Git projects
  const loadProjects = useCallback(async () => {
    try {
      const list = await fetchAllGitProjects(currentPath);
      setProjectsList(list);

      // Auto assign if path is empty
      if (!currentPath && list.length > 0) {
        const firstCloned = list.find((p) => p.isCloned && p.localDir) || list[0];
        if (firstCloned.isCloned && firstCloned.localDir) {
          let detectedPort: number | null = null;
          try {
            detectedPort = await detectProjectPort(firstCloned.localDir);
          } catch {}
          const sysPorts = await scanSystemOccupiedPorts();
          const newDevUrl = allocateUniqueDevUrl(existingDevUrls, detectedPort, 5173, sysPorts);
          setCurrentPath(firstCloned.localDir);
          setCurrentName(firstCloned.name);
          setCurrentBranch(firstCloned.branch || 'main');
          setCurrentCloneUrl(firstCloned.cloneUrl);
          setCurrentHtmlUrl(firstCloned.htmlUrl);
          setCurrentDevUrl(newDevUrl);
          setIsClonedState(true);
          onUpdateConfig({
            projectPath: firstCloned.localDir,
            projectName: firstCloned.name,
            gitBranch: firstCloned.branch || 'main',
            devUrl: newDevUrl,
            cloneUrl: firstCloned.cloneUrl,
            htmlUrl: firstCloned.htmlUrl,
            isCloned: true,
          });
        }
      }
    } catch (err) {
      console.warn('[OrchestrationProjectNode] Erro ao listar projetos do Git:', err);
    }
  }, [currentPath, existingDevUrls, onUpdateConfig]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCloneProject = useCallback(
    async (targetProj?: GitProjectItem) => {
      const projToClone: GitProjectItem =
        targetProj ||
        projectsList.find(
          (p) =>
            p.name.toLowerCase() === currentName.toLowerCase() ||
            (p.cloneUrl && p.cloneUrl === currentCloneUrl)
        ) || {
          id: 'temp',
          name: currentName,
          fullName: currentName,
          cloneUrl: currentCloneUrl || currentHtmlUrl,
          htmlUrl: currentHtmlUrl,
          isCloned: false,
        };

      setIsCloning(true);
      if (onToast) onToast(`Iniciando clone de "${projToClone.name}"...`);
      try {
        const res = await cloneGitRepository(projToClone);
        if (res.success && res.repoPath) {
          if (onToast) onToast(`Repositório "${projToClone.name}" clonado com sucesso!`);
          let detectedPort: number | null = null;
          try {
            detectedPort = await detectProjectPort(res.repoPath);
          } catch {}
          const sysPorts = await scanSystemOccupiedPorts();
          const newDevUrl = allocateUniqueDevUrl(existingDevUrls, detectedPort, 5173, sysPorts);
          setCurrentPath(res.repoPath);
          setCurrentName(projToClone.name);
          const b = projToClone.branch || 'main';
          setCurrentBranch(b);
          setCurrentDevUrl(newDevUrl);
          setIsClonedState(true);
          onUpdateConfig({
            projectPath: res.repoPath,
            projectName: projToClone.name,
            gitBranch: b,
            devUrl: newDevUrl,
            cloneUrl: projToClone.cloneUrl,
            htmlUrl: projToClone.htmlUrl,
            isCloned: true,
          });
          await loadProjects();
        } else if (res.error && res.error !== 'Operação cancelada pelo usuário') {
          if (onToast) onToast(`Erro ao clonar: ${res.error}`);
        }
      } catch (err: any) {
        if (onToast) onToast(`Erro ao clonar: ${err?.message || 'Falha no clone'}`);
      } finally {
        setIsCloning(false);
      }
    },
    [projectsList, currentName, currentCloneUrl, currentHtmlUrl, existingDevUrls, onUpdateConfig, loadProjects, onToast]
  );

  // Fetch file tree whenever currentPath changes
  const loadFileTree = useCallback(async () => {
    if (!currentPath || !window.electronAPI?.fs?.getTree) return;
    setIsLoadingFiles(true);
    try {
      const res = await window.electronAPI.fs.getTree(currentPath, 3);
      const tree: FileTreeNode[] = Array.isArray(res) ? (res as FileTreeNode[]) : ((res as any)?.tree || []);
      setFileTree(tree);
      // Auto expand root level folders
      if (tree && Array.isArray(tree)) {
        const topDirs = new Set<string>();
        tree.forEach((node) => {
          if (node.isDirectory) topDirs.add(node.path);
        });
        setExpandedFolders(topDirs);
      }
    } catch (err) {
      console.warn('[OrchestrationProjectNode] Erro ao carregar árvore de arquivos:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  // Load active file content
  const handleSelectFile = async (node: FileTreeNode) => {
    if (node.isDirectory) {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) {
          next.delete(node.path);
        } else {
          next.add(node.path);
        }
        return next;
      });
      return;
    }

    setSelectedFile(node);
    if (!window.electronAPI?.fs?.readFile) return;
    try {
      const res = await window.electronAPI.fs.readFile(node.path);
      const content = typeof res === 'string' ? res : (res?.content ?? '');
      setFileContent(content);
    } catch (err: any) {
      onToast?.(`Erro ao abrir arquivo: ${err?.message || 'Arquivo ilegível'}`, 'error');
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile || !window.electronAPI?.fs?.writeFile) return;
    setIsSaving(true);
    try {
      await window.electronAPI.fs.writeFile(selectedFile.path, fileContent);
      onToast?.(`Arquivo salvo com sucesso: ${selectedFile.name}`, 'success');
    } catch (err: any) {
      onToast?.(`Falha ao salvar arquivo: ${err?.message || 'Erro de escrita'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPath = () => {
    if (!currentPath) return;
    navigator.clipboard.writeText(currentPath);
    setHasCopiedPath(true);
    setTimeout(() => setHasCopiedPath(false), 2000);
    onToast?.('Caminho do projeto copiado!', 'info');
  };

  const handleRunDev = async () => {
    if (!currentDevUrl) return;

    if (onOpenUrlInBrowser) {
      onOpenUrlInBrowser(currentDevUrl);
    }

    if (currentPath && isClonedState && window.electronAPI?.pty) {
      const targetPort = extractPortFromUrl(currentDevUrl);
      const sysPorts = await scanSystemOccupiedPorts();
      const isAlreadyRunning = targetPort ? sysPorts.includes(targetPort) : false;

      if (!isAlreadyRunning) {
        onToast?.(`🚀 Iniciando servidor local para "${currentName}" em segundo plano...`, 'info');
        const cleanName = currentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const sessionId = `dev-server-${cleanName}`;
        try {
          await window.electronAPI.pty.create(sessionId, 'zsh', currentPath, 100, 24, accentColor);
          // Executa com fallback inteligente de gerenciador de pacotes
          const runCmd = 'bun run dev 2>/dev/null || pnpm dev 2>/dev/null || npm run dev\n';
          window.electronAPI.pty.write(sessionId, runCmd);
          onToast?.(`Servidor do projeto iniciado via terminal integrado na porta ${targetPort || 'padrão'}`, 'success');
        } catch (err: any) {
          console.warn('[OrchestrationProjectNode] Erro ao iniciar servidor:', err);
        }
      } else {
        onToast?.(`🌐 Servidor ativo! Conectando ${currentDevUrl} no navegador`, 'info');
      }
    } else {
      onToast?.(`🌐 Abrindo ${currentDevUrl} no navegador`, 'info');
    }
  };

  const handleSelectProject = async (p: { name: string; path: string; branch?: string }) => {
    let detectedPort: number | null = null;
    if (p.path) {
      try {
        detectedPort = await detectProjectPort(p.path);
      } catch {}
    }
    const sysPorts = await scanSystemOccupiedPorts();
    const newDevUrl = allocateUniqueDevUrl(existingDevUrls, detectedPort, 5173, sysPorts);
    setCurrentPath(p.path);
    setCurrentName(p.name);
    setCurrentBranch(p.branch || 'main');
    setCurrentDevUrl(newDevUrl);
    setIsProjectsDropdownOpen(false);
    setSelectedFile(null);
    setFileContent('');
    onUpdateConfig({
      projectPath: p.path,
      projectName: p.name,
      gitBranch: p.branch || 'main',
      devUrl: newDevUrl,
    });
    onToast?.(`Contexto alterado para: ${p.name}`, 'info');
  };

  // Filter file tree recursively
  const filteredTree = useMemo(() => {
    if (!searchFilter.trim()) return fileTree;
    const query = searchFilter.toLowerCase();

    function filterNodes(nodes: FileTreeNode[]): FileTreeNode[] {
      return nodes
        .map((node) => {
          if (node.isDirectory) {
            const filteredChildren = node.children ? filterNodes(node.children) : [];
            if (filteredChildren.length > 0 || node.name.toLowerCase().includes(query)) {
              return { ...node, children: filteredChildren };
            }
            return null;
          }
          if (node.name.toLowerCase().includes(query)) {
            return node;
          }
          return null;
        })
        .filter(Boolean) as FileTreeNode[];
    }

    return filterNodes(fileTree);
  }, [fileTree, searchFilter]);

  // Count total files recursively for the card badge
  const totalFilesCount = useMemo(() => {
    let count = 0;
    function countNodes(nodes: FileTreeNode[]) {
      nodes.forEach((n) => {
        if (!n.isDirectory) count++;
        if (n.children) countNodes(n.children);
      });
    }
    countNodes(fileTree);
    return count;
  }, [fileTree]);

  // Recursively render tree items
  const renderTreeNodes = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((item) => {
      const isExpandedDir = expandedFolders.has(item.path);
      const isSelected = selectedFile?.path === item.path;

      return (
        <div key={item.path} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSelectFile(item);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: `4px 8px 4px ${8 + depth * 14}px`,
              cursor: 'pointer',
              borderRadius: 4,
              background: isSelected
                ? `${accentColor}25`
                : 'transparent',
              color: isSelected
                ? accentColor
                : isEffectiveDark
                ? '#e4e4e7'
                : '#18181b',
              fontSize: 12,
              fontWeight: isSelected ? 600 : 400,
              userSelect: 'none',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {item.isDirectory ? (
              <>
                {isExpandedDir ? (
                  <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                ) : (
                  <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                )}
                <FolderIcon folderName={item.name} isOpen={isExpandedDir} size={15} />
              </>
            ) : (
              <>
                <div style={{ width: 13, flexShrink: 0 }} />
                <FileIcon fileName={item.name} size={15} />
              </>
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 11.5,
              }}
            >
              {item.name}
            </span>
          </div>

          {item.isDirectory && isExpandedDir && item.children && item.children.length > 0 && (
            <div>{renderTreeNodes(item.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  // ----------------------------------------------------
  // COLLAPSED CARD VIEW
  // ----------------------------------------------------
  if (!isExpanded) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: isEffectiveDark ? '#141417' : '#ffffff',
          borderRadius: 16,
          overflow: 'hidden',
          boxSizing: 'border-box',
          padding: '12px 14px',
          justifyContent: 'space-between',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          const tag = target.tagName.toLowerCase();
          if (target.closest('[data-no-drag]') || target.closest('button') || tag === 'input' || tag === 'button' || tag === 'svg' || tag === 'path') {
            e.stopPropagation();
          }
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: `${accentColor}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <FolderGit2 size={17} strokeWidth={2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isEffectiveDark ? '#ffffff' : '#0f172a',
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentName}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: `${accentColor}20`,
                    color: accentColor,
                  }}
                >
                  Projeto
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: isEffectiveDark ? '#71717a' : '#94a3b8',
                }}
              >
                Contexto da IA no fluxo
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Quick Run Dev / Open in Browser Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRunDev();
              }}
              title={`Executar Servidor e Abrir no Navegador (${currentDevUrl})`}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)';
              }}
            >
              <Globe size={12} strokeWidth={2} />
              <span>Navegador</span>
            </button>

            {/* Quick Expand Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              title="Expandir Visualizador de Código e Arquivos"
              style={{
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}35`,
                color: accentColor,
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${accentColor}28`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${accentColor}18`;
              }}
            >
              <Maximize2 size={12} strokeWidth={2} />
              <span>Expandir</span>
            </button>
          </div>
        </div>

        {/* Project Selector Dropdown */}
        <div style={{ position: 'relative', marginTop: 6 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsProjectsDropdownOpen((prev) => !prev);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 8,
              border: isEffectiveDark
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(0, 0, 0, 0.1)',
              background: isEffectiveDark ? '#1c1c20' : '#f8fafc',
              color: isEffectiveDark ? '#e4e4e7' : '#1e293b',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {!isClonedState ? `☁️ ${currentName} (Não clonado)` : currentName}
            </span>
            <DropdownIcon size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
          </button>

          {isProjectsDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: isEffectiveDark ? '#18181b' : '#ffffff',
                border: isEffectiveDark
                  ? '1px solid rgba(255, 255, 255, 0.15)'
                  : '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                zIndex: 60,
                maxHeight: 220,
                overflowY: 'auto',
                padding: '4px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {projectsList.map((p) => {
                const isSelected = Boolean(
                  (p.localDir && currentPath && p.localDir.toLowerCase() === currentPath.toLowerCase()) ||
                  p.name.toLowerCase() === currentName.toLowerCase()
                );
                return (
                  <div
                    key={p.id}
                    onClick={async () => {
                      setIsProjectsDropdownOpen(false);
                      let detectedPort: number | null = null;
                      if (p.isCloned && p.localDir) {
                        try {
                          detectedPort = await detectProjectPort(p.localDir);
                        } catch {}
                      }
                      const sysPorts = await scanSystemOccupiedPorts();
                      const newDevUrl = allocateUniqueDevUrl(existingDevUrls, detectedPort, 5173, sysPorts);
                      setCurrentDevUrl(newDevUrl);

                      if (p.isCloned && p.localDir) {
                        setCurrentPath(p.localDir);
                        setCurrentName(p.name);
                        setCurrentBranch(p.branch || 'main');
                        setCurrentCloneUrl(p.cloneUrl);
                        setCurrentHtmlUrl(p.htmlUrl);
                        setIsClonedState(true);
                        onUpdateConfig({
                          projectPath: p.localDir,
                          projectName: p.name,
                          gitBranch: p.branch || 'main',
                          devUrl: newDevUrl,
                          cloneUrl: p.cloneUrl,
                          htmlUrl: p.htmlUrl,
                          isCloned: true,
                        });
                      } else {
                        setCurrentName(p.name);
                        setCurrentPath('');
                        setCurrentCloneUrl(p.cloneUrl);
                        setCurrentHtmlUrl(p.htmlUrl);
                        setIsClonedState(false);
                        onUpdateConfig({
                          projectPath: '',
                          projectName: p.name,
                          gitBranch: p.branch || 'main',
                          devUrl: newDevUrl,
                          cloneUrl: p.cloneUrl,
                          htmlUrl: p.htmlUrl,
                          isCloned: false,
                        });
                      }
                      onToast?.(`Contexto alterado para: ${p.name}`, 'info');
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? `${accentColor}18` : 'transparent',
                      color: isSelected ? accentColor : isEffectiveDark ? '#f4f4f5' : '#18181b',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.isCloned ? `📁 ${p.name}` : `☁️ ${p.fullName}`}
                      </span>
                      <span style={{ fontSize: 9.5, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.isCloned ? (p.localDir || p.branch || 'main') : 'GitHub (Não clonado)'}
                      </span>
                    </div>
                    {!p.isCloned && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProjectsDropdownOpen(false);
                          handleCloneProject(p);
                        }}
                        style={{
                          marginLeft: 6,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 0,
                        }}
                        title="Clonar repositório"
                      >
                        <DownloadCloud size={11} />
                        <span>Clonar</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Path Snippet & Quick stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isEffectiveDark ? '#1a1a1e' : '#f1f5f9',
            padding: '5px 8px',
            borderRadius: 6,
            fontSize: 10,
            color: isEffectiveDark ? '#a1a1aa' : '#64748b',
          }}
        >
          <span
            style={{
              maxWidth: 190,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
              color: !isClonedState ? '#0284c7' : undefined,
            }}
            title={currentPath || 'Não clonado'}
          >
            {isClonedState && currentPath ? currentPath : '☁️ Git Remoto (Não clonado)'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyPath();
            }}
            title="Copiar caminho"
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
          >
            {hasCopiedPath ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: isEffectiveDark ? '#71717a' : '#94a3b8' }}>
            <span>{totalFilesCount} arquivos</span>
            <span>•</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{currentBranch}</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // EXPANDED IDE-LIKE VIEW (Full Tree + Monaco Editor)
  // ----------------------------------------------------
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isEffectiveDark ? '#0f0f12' : '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
        border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.14)'}`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Chrome */}
      <div
        style={{
          height: 38,
          background: isEffectiveDark ? '#18181c' : '#f1f5f9',
          borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          flexShrink: 0,
        }}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          const tag = target.tagName.toLowerCase();
          if (target.closest('[data-no-drag]') || target.closest('button') || tag === 'input' || tag === 'button' || tag === 'svg' || tag === 'path') {
            e.stopPropagation();
          }
        }}
      >
        {/* Left: Project title & branch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <FolderCode size={16} color={accentColor} />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: isEffectiveDark ? '#ffffff' : '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentName}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 4,
              background: `${accentColor}20`,
              color: accentColor,
            }}
          >
            Contexto Ativo
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: isEffectiveDark ? '#71717a' : '#94a3b8',
              fontFamily: 'monospace',
            }}
          >
            ({currentBranch})
          </span>
        </div>

        {/* Right Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={loadFileTree}
            title="Recarregar arquivos do projeto"
            style={{
              background: 'none',
              border: 'none',
              color: isEffectiveDark ? '#a1a1aa' : '#64748b',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RotateCw size={13} className={isLoadingFiles ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRunDev();
            }}
            title={`Executar Servidor e Abrir no Navegador (${currentDevUrl})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 5,
              border: '1px solid rgba(16, 185, 129, 0.35)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              cursor: 'pointer',
            }}
          >
            <Globe size={12} strokeWidth={2} />
            <span>Navegador</span>
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            title="Recolher card de projeto"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 5,
              border: isEffectiveDark
                ? '1px solid rgba(255, 255, 255, 0.15)'
                : '1px solid rgba(0, 0, 0, 0.15)',
              background: isEffectiveDark ? '#27272a' : '#e2e8f0',
              color: isEffectiveDark ? '#f4f4f5' : '#0f172a',
              cursor: 'pointer',
            }}
          >
            <Minimize2 size={12} />
            <span>Recolher</span>
          </button>
        </div>
      </div>

      {/* Main Split Body: Left Tree + Right Editor OR Uncloned State Screen */}
      {!isClonedState || !currentPath ? (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: isEffectiveDark ? '#111114' : '#f8fafc',
            textAlign: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DownloadCloud size={26} color="#38bdf8" />
          </div>
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: isEffectiveDark ? '#f8fafc' : '#0f172a', marginBottom: 6 }}>
              Repositório Git Não Clonado
            </div>
            <div style={{ fontSize: 12, color: isEffectiveDark ? '#94a3b8' : '#64748b', lineHeight: 1.5 }}>
              O projeto <strong style={{ color: accentColor }}>{currentName}</strong> foi selecionado a partir do Git mas ainda não está clonado nesta máquina. Clone o repositório para explorar os arquivos e visualizar o código diretamente aqui.
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCloneProject()}
            disabled={isCloning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: isCloning ? 'default' : 'pointer',
              opacity: isCloning ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <DownloadCloud size={14} />
            <span>{isCloning ? 'Clonando repositório...' : 'Clonar Repositório Agora'}</span>
          </button>
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}
        >
        {/* Left: File Tree Explorer */}
        <div
          style={{
            width: 220,
            borderRight: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            display: 'flex',
            flexDirection: 'column',
            background: isEffectiveDark ? '#131316' : '#f8fafc',
            flexShrink: 0,
          }}
        >
          {/* Tree search bar */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Search size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Filtrar arquivos..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 11,
                color: isEffectiveDark ? '#e4e4e7' : '#18181b',
              }}
            />
            {searchFilter && (
              <X
                size={12}
                style={{ cursor: 'pointer', opacity: 0.5 }}
                onClick={() => setSearchFilter('')}
              />
            )}
          </div>

          {/* Tree list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {isLoadingFiles ? (
              <div
                style={{
                  padding: 16,
                  textAlign: 'center',
                  fontSize: 11,
                  color: isEffectiveDark ? '#71717a' : '#94a3b8',
                }}
              >
                Carregando arquivos...
              </div>
            ) : filteredTree.length > 0 ? (
              renderTreeNodes(filteredTree)
            ) : (
              <div
                style={{
                  padding: 16,
                  textAlign: 'center',
                  fontSize: 11,
                  color: isEffectiveDark ? '#71717a' : '#94a3b8',
                }}
              >
                Nenhum arquivo encontrado
              </div>
            )}
          </div>
        </div>

        {/* Right: Code Viewer / Monaco Editor */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: isEffectiveDark ? '#0c0c0e' : '#ffffff',
          }}
        >
          {selectedFile ? (
            <>
              {/* File Tab Header */}
              <div
                style={{
                  height: 32,
                  background: isEffectiveDark ? '#141418' : '#f1f5f9',
                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <FileIcon fileName={selectedFile.name} size={14} />
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: isEffectiveDark ? '#f4f4f5' : '#0f172a',
                    }}
                  >
                    {selectedFile.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: isEffectiveDark ? '#71717a' : '#94a3b8',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 260,
                    }}
                    title={selectedFile.path}
                  >
                    {selectedFile.path.replace(currentPath, '')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveFile}
                  disabled={isSaving}
                  title="Salvar alterações no arquivo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: accentColor,
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  <Save size={11} />
                  <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
                </button>
              </div>

              {/* Monaco Editor */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <Editor
                  height="100%"
                  language={getMonacoLanguage(selectedFile.path)}
                  theme={isEffectiveDark ? 'vs-dark' : 'light'}
                  value={fileContent}
                  onChange={(val) => setFileContent(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    tabSize: 2,
                    renderWhitespace: 'selection',
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: isEffectiveDark ? '#71717a' : '#94a3b8',
              }}
            >
              <FileCode2 size={36} strokeWidth={1.2} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Visualizador de Código do Projeto
              </span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                Selecione um arquivo na árvore à esquerda para visualizar e editar o código
              </span>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
