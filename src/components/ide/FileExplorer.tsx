import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { FileNode } from '../../types';

interface FileExplorerProps {
  tree: FileNode[];
  onSelectFile: (filePath: string, name: string) => void;
  activeFilePath?: string;
  onRefresh: () => void;
  onCreateItem: (path: string, isDirectory: boolean) => void;
  onDeleteItem: (path: string) => void;
  rootPath: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  onSelectFile,
  activeFilePath,
  onRefresh,
  onCreateItem,
  onDeleteItem,
  rootPath,
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([rootPath]));
  const [creatingType, setCreatingType] = useState<'file' | 'dir' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const getFileIcon = (node: FileNode) => {
    if (node.isDirectory) {
      return expandedDirs.has(node.path) ? (
        <FolderOpen size={14} color="#f59e0b" />
      ) : (
        <Folder size={14} color="#f59e0b" />
      );
    }
    const ext = node.extension || '';
    if (node.name.toLowerCase().includes('dockerfile')) {
      return <FileCode size={14} color="#38bdf8" />;
    }
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return <FileCode size={14} color="#3b82f6" />;
    }
    if (['.json', '.toml', '.yaml', '.yml'].includes(ext)) {
      return <FileJson size={14} color="#eab308" />;
    }
    if (['.md', '.txt'].includes(ext)) {
      return <FileText size={14} color="#94a3b8" />;
    }
    return <File size={14} color="#9ca3af" />;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setCreatingType(null);
      return;
    }
    const targetPath = `${rootPath}/${newItemName.trim()}`;
    onCreateItem(targetPath, creatingType === 'dir');
    setCreatingType(null);
    setNewItemName('');
  };

  const renderNodes = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isSelected = activeFilePath === node.path;

      return (
        <div key={node.path}>
          <div
            onClick={() => {
              if (node.isDirectory) {
                toggleDir(node.path);
              } else {
                onSelectFile(node.path, node.name);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 8px',
              paddingLeft: `${depth * 14 + 10}px`,
              fontSize: '0.78rem',
              color: isSelected ? '#ffffff' : 'var(--text-primary)',
              backgroundColor: isSelected ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
              borderLeft: 'none',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              {node.isDirectory ? (
                <span style={{ color: 'var(--text-muted)' }}>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              ) : (
                <span style={{ width: '12px' }} />
              )}
              {getFileIcon(node)}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.name}
              </span>
            </div>

            {/* Hover actions */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Excluir ${node.name}?`)) {
                  onDeleteItem(node.path);
                }
              }}
              style={{ opacity: 0.3, padding: '2px' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
              title="Excluir"
            >
              <Trash2 size={11} color="#ef4444" />
            </div>
          </div>

          {node.isDirectory && isExpanded && node.children && (
            <div>{renderNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      style={{
        width: '240px',
        minWidth: '200px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 'none',
          fontSize: '0.74rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>Explorer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-icon"
            title="Novo Arquivo"
            onClick={() => setCreatingType('file')}
          >
            <Plus size={13} />
          </button>
          <button
            className="btn-icon"
            title="Nova Pasta"
            onClick={() => setCreatingType('dir')}
          >
            <FolderPlus size={13} />
          </button>
          <button className="btn-icon" title="Atualizar" onClick={onRefresh}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Inline Creation Input */}
      {creatingType && (
        <form onSubmit={handleCreateSubmit} style={{ padding: '6px 10px' }}>
          <input
            autoFocus
            type="text"
            placeholder={creatingType === 'file' ? 'nome-arquivo.ts' : 'nome-da-pasta'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onBlur={() => setCreatingType(null)}
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '0.78rem',
              backgroundColor: 'var(--bg-main)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              outline: 'none',
            }}
          />
        </form>
      )}

      {/* File Tree List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {tree.length === 0 ? (
          <div style={{ padding: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Nenhum arquivo encontrado
          </div>
        ) : (
          renderNodes(tree)
        )}
      </div>
    </div>
  );
};
