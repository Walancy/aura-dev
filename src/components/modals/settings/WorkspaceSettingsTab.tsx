import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  GitBranch,
  RefreshCw,
  Plus,
  Check,
  Search,
  Copy,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens, GitBranchItem } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

export interface WorkspaceSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  workspacePath: string;
  currentBranch: string;
  gitRepoName?: string;
  branchesList?: GitBranchItem[];
  onCheckoutBranch?: (name: string) => void;
  onCreateBranch?: (name: string) => void;
  isCreatingBranch?: boolean;
  onSyncGit?: () => void;
  isSyncingGit?: boolean;
  onRefreshBranches?: () => void;
  restoreLastWorkspace?: boolean;
  setRestoreLastWorkspace?: (value: boolean) => void;
  autoRefreshGitStatus?: boolean;
  setAutoRefreshGitStatus?: (value: boolean) => void;
}

export interface PendingGitFile {
  path: string;
  filename: string;
  dirname: string;
  status: string;
  staged: boolean;
  label: string;
  color: string;
}

export const WorkspaceSettingsTab: React.FC<WorkspaceSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  workspacePath,
  currentBranch,
  gitRepoName,
  branchesList = [],
  onCheckoutBranch,
  onCreateBranch,
  isCreatingBranch = false,
  onSyncGit,
  isSyncingGit = false,
  onRefreshBranches,
  restoreLastWorkspace,
  setRestoreLastWorkspace,
  autoRefreshGitStatus,
  setAutoRefreshGitStatus,
}) => {
  const [newBranchInput, setNewBranchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState(false);

  // Pending changes state
  const [pendingChanges, setPendingChanges] = useState<PendingGitFile[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [aheadCount, setAheadCount] = useState<number>(0);
  const [behindCount, setBehindCount] = useState<number>(0);
  const [changesFilter, setChangesFilter] = useState('');
  const [changesTypeFilter, setChangesTypeFilter] = useState<'all' | 'modified' | 'untracked'>('all');

  const workspaceName = workspacePath ? workspacePath.split('/').filter(Boolean).pop() || 'workspace' : 'workspace';

  const fetchPendingStatus = useCallback(async () => {
    if (!workspacePath) return;
    setIsLoadingStatus(true);
    try {
      if ((window as any).electronAPI?.shell?.exec) {
        const [statusRes, branchRes] = await Promise.all([
          (window as any).electronAPI.shell.exec('git status --porcelain=v1', workspacePath),
          (window as any).electronAPI.shell.exec('git status -sb', workspacePath),
        ]);
        const stdout = (typeof statusRes === 'string' ? statusRes : statusRes?.stdout) || '';
        const branchOut = (typeof branchRes === 'string' ? branchRes : branchRes?.stdout) || '';

        const lines = stdout.split('\n').filter((l: string) => l.trim().length > 0);
        const parsed: PendingGitFile[] = lines.map((line: string) => {
          const x = line.charAt(0);
          const y = line.charAt(1);
          let rawPath = line.substring(2).trim();
          if (rawPath.includes(' -> ')) {
            rawPath = rawPath.split(' -> ')[1].trim();
          }
          const cleanPath = rawPath.replace(/^"|"$/g, '');
          const filename = cleanPath.split('/').pop() || cleanPath;
          const dirname = cleanPath.includes('/') ? cleanPath.substring(0, cleanPath.lastIndexOf('/')) : '';

          let status = 'M';
          let label = 'Modificado';
          let color = '#eab308';

          if (x === '?' && y === '?') {
            status = '??';
            label = 'Não rastreado';
            color = '#22c55e';
          } else if (x === 'A' || y === 'A') {
            status = 'A';
            label = 'Adicionado';
            color = '#22c55e';
          } else if (x === 'D' || y === 'D') {
            status = 'D';
            label = 'Excluído';
            color = '#ef4444';
          } else if (x === 'R' || y === 'R') {
            status = 'R';
            label = 'Renomeado';
            color = '#3b82f6';
          } else if (x === 'M' || y === 'M') {
            status = 'M';
            label = 'Modificado';
            color = '#eab308';
          }

          const staged = x !== ' ' && x !== '?';
          return {
            path: cleanPath,
            filename,
            dirname,
            status,
            staged,
            label,
            color,
          };
        });
        setPendingChanges(parsed);

        const firstBranchLine = branchOut.split('\n')[0] || '';
        if (firstBranchLine.startsWith('##')) {
          const aheadMatch = firstBranchLine.match(/ahead (\d+)/);
          setAheadCount(aheadMatch ? parseInt(aheadMatch[1], 10) : 0);
          const behindMatch = firstBranchLine.match(/behind (\d+)/);
          setBehindCount(behindMatch ? parseInt(behindMatch[1], 10) : 0);
        }
      }
    } catch (err) {
      console.error('Erro ao consultar git status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    fetchPendingStatus();
  }, [fetchPendingStatus]);

  const filteredBranches = branchesList.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChanges = pendingChanges.filter((item) => {
    const matchesQuery =
      item.filename.toLowerCase().includes(changesFilter.toLowerCase()) ||
      item.path.toLowerCase().includes(changesFilter.toLowerCase());
    if (!matchesQuery) return false;
    if (changesTypeFilter === 'modified') return item.status === 'M';
    if (changesTypeFilter === 'untracked') return item.status === '??' || item.status === 'A';
    return true;
  });

  const handleCreateBranchSubmit = () => {
    const trimmed = newBranchInput.trim();
    if (!trimmed || isCreatingBranch || !onCreateBranch) return;
    logSystemActivity('workspace', 'criar_branch', trimmed, { workspace: workspaceName });
    onCreateBranch(trimmed);
    setNewBranchInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* Informações e Ações do Workspace */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          gap: 12,
          borderRadius: 8,
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              <Folder size={16} color={accentColor} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 400, color: themeTokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {gitRepoName || workspaceName}
              </div>
              <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {workspacePath}
              </div>
            </div>
          </div>
          {currentBranch && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                height: 24,
                borderRadius: 4,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: accentColor,
                fontSize: 11,
                fontWeight: 400,
                flexShrink: 0,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              <GitBranch size={12} />
              <span>{currentBranch}</span>
            </div>
          )}
        </div>

        {/* Botões de Ação do Workspace */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {onSyncGit && (
            <button
              type="button"
              onClick={() => {
                logSystemActivity('workspace', 'sincronizar_git', gitRepoName || workspaceName);
                onSyncGit();
                setTimeout(fetchPendingStatus, 1500);
              }}
              disabled={isSyncingGit}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: themeTokens.textPrimary,
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 400,
                cursor: isSyncingGit ? 'not-allowed' : 'pointer',
                opacity: isSyncingGit ? 0.6 : 1,
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSyncingGit) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSyncingGit) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <RefreshCw
                size={11}
                color={accentColor}
                style={{ animation: isSyncingGit ? 'spin 1s linear infinite' : 'none' }}
              />
              <span>{isSyncingGit ? 'Sincronizando...' : 'Sincronizar (Pull & Push)'}</span>
            </button>
          )}

          {onRefreshBranches && (
            <button
              type="button"
              onClick={() => {
                logSystemActivity('workspace', 'atualizar_branches', workspaceName);
                onRefreshBranches();
                fetchPendingStatus();
              }}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: themeTokens.textPrimary,
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 400,
                cursor: 'pointer',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
            >
              <RefreshCw size={11} />
              <span>Atualizar Branches</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(workspacePath);
                setCopiedPath(true);
                setTimeout(() => setCopiedPath(false), 2000);
                logSystemActivity('workspace', 'copiar_caminho', workspacePath);
              }
            }}
            style={{
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              color: themeTokens.textPrimary,
              border: 'none',
              boxShadow: 'none',
              borderRadius: 6,
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 400,
              cursor: 'pointer',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
          >
            {copiedPath ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
            <span>{copiedPath ? 'Caminho Copiado' : 'Copiar Caminho'}</span>
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Alterações Pendentes de Commit */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          gap: 12,
          borderRadius: 8,
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Alterações Pendentes de Commit
            </div>
            <div
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 4,
                background: pendingChanges.length > 0
                  ? (isEffectiveDark ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.1)')
                  : (isEffectiveDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.1)'),
                color: pendingChanges.length > 0 ? '#eab308' : '#22c55e',
                fontWeight: 400,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {pendingChanges.length > 0 ? `${pendingChanges.length} arquivos` : 'Repositório limpo'}
            </div>

            {aheadCount > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: isEffectiveDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                }}
              >
                <ArrowUp size={10} />
                <span>{aheadCount} à frente</span>
              </div>
            )}

            {behindCount > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                }}
              >
                <ArrowDown size={10} />
                <span>{behindCount} atrás</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                logSystemActivity('workspace', 'atualizar_git_status', workspacePath);
                fetchPendingStatus();
              }}
              disabled={isLoadingStatus}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                color: themeTokens.textPrimary,
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 400,
                cursor: isLoadingStatus ? 'not-allowed' : 'pointer',
                opacity: isLoadingStatus ? 0.6 : 1,
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoadingStatus) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoadingStatus) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <RefreshCw
                size={11}
                color={accentColor}
                style={{ animation: isLoadingStatus ? 'spin 1s linear infinite' : 'none' }}
              />
              <span>{isLoadingStatus ? 'Verificando...' : 'Atualizar Status'}</span>
            </button>
          </div>
        </div>

        {/* Toolbar de Filtro e Categorias */}
        {pendingChanges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[
                { id: 'all', label: `Todos (${pendingChanges.length})` },
                { id: 'modified', label: `Modificados (${pendingChanges.filter((f) => f.status === 'M').length})` },
                { id: 'untracked', label: `Novos (${pendingChanges.filter((f) => f.status === '??' || f.status === 'A').length})` },
              ].map((tab) => {
                const isActive = changesTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChangesTypeFilter(tab.id as any)}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 400,
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      background: isActive
                        ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0')
                        : 'transparent',
                      color: isActive ? accentColor : themeTokens.textSecondary,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative', width: 200 }}>
              <Search
                size={12}
                style={{
                  position: 'absolute',
                  left: 9,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: themeTokens.textSecondary,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Filtrar arquivos..."
                value={changesFilter}
                onChange={(e) => setChangesFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: 28,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 6,
                  padding: '0 10px 0 28px',
                  fontSize: 11,
                  color: themeTokens.textPrimary,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'background 0.15s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Lista de Arquivos Pendentes */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 220,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {isLoadingStatus && pendingChanges.length === 0 ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                fontSize: 11.5,
                color: themeTokens.textSecondary,
              }}
            >
              Consultando alterações do Git...
            </div>
          ) : pendingChanges.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '20px 12px',
                textAlign: 'center',
                fontSize: 11.5,
                color: '#22c55e',
                borderRadius: 6,
                background: isEffectiveDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.04)',
              }}
            >
              <CheckCircle2 size={15} />
              <span>Nenhuma alteração pendente de commit. Árvore de trabalho limpa.</span>
            </div>
          ) : filteredChanges.length === 0 ? (
            <div
              style={{
                padding: '20px 12px',
                textAlign: 'center',
                fontSize: 11.5,
                color: themeTokens.textSecondary,
              }}
            >
              Nenhum arquivo corresponde ao filtro.
            </div>
          ) : (
            filteredChanges.map((file, idx) => (
              <div
                key={file.path || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 5,
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  gap: 8,
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(0, 0, 0, 0.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0, flex: 1 }}>
                  {/* Badge de Status */}
                  <span
                    style={{
                      width: 22,
                      height: 18,
                      borderRadius: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 500,
                      background: isEffectiveDark ? `${file.color}22` : `${file.color}18`,
                      color: file.color,
                      flexShrink: 0,
                    }}
                    title={file.label}
                  >
                    {file.status}
                  </span>

                  {/* Nome e Diretório */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 400,
                        color: themeTokens.textPrimary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.filename}
                    </span>
                    {file.dirname && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: themeTokens.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file.dirname}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Descritivo e Staged */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {file.staged && (
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: isEffectiveDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.1)',
                        color: '#22c55e',
                      }}
                    >
                      staged
                    </span>
                  )}
                  <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                    {file.label}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Criar Nova Branch */}
      {onCreateBranch && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Criar Nova Branch
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Nome da nova branch (ex: feat/minha-feature)..."
                value={newBranchInput}
                onChange={(e) => setNewBranchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBranchInput.trim() && !isCreatingBranch) {
                    handleCreateBranchSubmit();
                  }
                }}
                style={{
                  flex: 1,
                  height: 28,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 11.5,
                  color: themeTokens.textPrimary,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'background 0.15s ease',
                }}
              />
              <button
                type="button"
                onClick={handleCreateBranchSubmit}
                disabled={!newBranchInput.trim() || isCreatingBranch}
                style={{
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: accentColor,
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 400,
                  cursor: newBranchInput.trim() && !isCreatingBranch ? 'pointer' : 'not-allowed',
                  opacity: newBranchInput.trim() && !isCreatingBranch ? 1 : 0.5,
                  boxSizing: 'border-box',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Plus size={12} />
                <span>{isCreatingBranch ? 'Criando...' : 'Criar Branch'}</span>
              </button>
            </div>
          </div>

          <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
        </>
      )}

      {/* Branches Disponíveis & Filtro */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Branches Disponíveis
            </div>
            <div
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: themeTokens.textSecondary,
              }}
            >
              {filteredBranches.length}
            </div>
          </div>

          {/* Campo de Busca */}
          <div style={{ position: 'relative', width: 200 }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: themeTokens.textSecondary,
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Filtrar branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: 28,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px 0 28px',
                fontSize: 11,
                color: themeTokens.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'background 0.15s ease',
              }}
            />
          </div>
        </div>

        {/* Lista de Branches */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            maxHeight: 260,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {filteredBranches.length === 0 ? (
            <div
              style={{
                padding: '20px 10px',
                textAlign: 'center',
                fontSize: 11.5,
                color: themeTokens.textSecondary,
              }}
            >
              Nenhuma branch encontrada.
            </div>
          ) : (
            filteredBranches.map((branch, idx) => {
              const isCur = branch.isCurrent || branch.name === currentBranch;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 6,
                    background: isCur
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')
                      : 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCur) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.025)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCur) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
                    <GitBranch size={13} color={isCur ? accentColor : themeTokens.textSecondary} />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 400,
                        color: isCur ? accentColor : themeTokens.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {branch.name}
                    </span>
                    {branch.isRemote && (
                      <span
                        style={{
                          fontSize: 9.5,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          color: themeTokens.textSecondary,
                        }}
                      >
                        remote
                      </span>
                    )}
                  </div>

                  {isCur ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#22c55e',
                        fontSize: 11,
                        fontWeight: 400,
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} />
                      <span>Atual</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        logSystemActivity('workspace', 'checkout_branch', branch.name);
                        onCheckoutBranch?.(branch.name);
                      }}
                      style={{
                        height: 28,
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                        border: 'none',
                        boxShadow: 'none',
                        borderRadius: 5,
                        padding: '0 10px',
                        fontSize: 11,
                        fontWeight: 400,
                        color: themeTokens.textPrimary,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxSizing: 'border-box',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = accentColor;
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'rgba(0, 0, 0, 0.06)';
                        e.currentTarget.style.color = themeTokens.textPrimary;
                      }}
                    >
                      Checkout
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Comportamento e Opções do Workspace */}
      {(setRestoreLastWorkspace || setAutoRefreshGitStatus) && (
        <>
          <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Comportamento do Workspace
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {setRestoreLastWorkspace && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 10,
                    gap: 10,
                    borderRadius: 6,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                      Restaurar Workspace ao Abrir
                    </div>
                    <div style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                      Reabre automaticamente a pasta deste projeto ao iniciar o Aura Dev.
                    </div>
                  </div>
                  <MiniSwitch
                    checked={Boolean(restoreLastWorkspace)}
                    onChange={(val) => {
                      logSystemActivity('workspace', 'toggle_restore_workspace', 'workspace', { ativo: val });
                      setRestoreLastWorkspace(val);
                    }}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                  />
                </div>
              )}

              {setAutoRefreshGitStatus && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 10,
                    gap: 10,
                    borderRadius: 6,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                      Atualizar Status do Git Automaticamente
                    </div>
                    <div style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                      Consulta periodicamente alterações de branches e arquivos locais.
                    </div>
                  </div>
                  <MiniSwitch
                    checked={Boolean(autoRefreshGitStatus)}
                    onChange={(val) => {
                      logSystemActivity('workspace', 'toggle_auto_refresh_git', 'workspace', { ativo: val });
                      setAutoRefreshGitStatus(val);
                    }}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
