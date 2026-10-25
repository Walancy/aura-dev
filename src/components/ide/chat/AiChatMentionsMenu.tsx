import React from 'react';
import {
  FileCode2,
  Folder,
  GitBranch,
  Terminal,
  BookOpen,
  Cpu,
  ImageIcon,
  Layout,
} from 'lucide-react';
import { FileIcon } from '../../FileIcon';

export interface MentionItem {
  id: string;
  type: 'file' | 'folder' | 'git' | 'terminal' | 'rules' | 'mcp' | 'design';
  title: string;
  subtitle?: string;
  path?: string;
  data?: any;
}

interface AiChatMentionsMenuProps {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  files: Array<{ name: string; path: string; isDirectory?: boolean }>;
  designScreens?: Array<{ id: string; name: string; slug: string; width: number; height: number; deviceType?: string; colors?: string[] }>;
  gitBranch?: string;
  onSelect: (item: MentionItem) => void;
  themeTokens: any;
  accentColor: string;
  isEffectiveDark: boolean;
}

export const AiChatMentionsMenu: React.FC<AiChatMentionsMenuProps> = ({
  isOpen,
  query,
  selectedIndex,
  files,
  designScreens = [],
  gitBranch,
  onSelect,
  themeTokens,
  accentColor,
  isEffectiveDark,
}) => {
  if (!isOpen) return null;

  const q = (query || '').toLowerCase();

  // Dynamic design screen mentions from FigCraft Design Bridge
  const designMentions: MentionItem[] = [
    {
      id: 'mention-design-all',
      type: 'design',
      title: '@design',
      path: '@design',
      subtitle:
        designScreens.length > 0
          ? `Todas as telas da aba Design (${designScreens.length}: ${designScreens.map((s) => s.name).join(', ')})`
          : 'Especificação visual, cores, tipografia e layouts da aba Design',
    },
    ...designScreens.map((scr) => ({
      id: `mention-design-${scr.id}`,
      type: 'design' as const,
      title: `@design:${scr.name}`,
      path: `@design:${scr.name}`,
      subtitle: `Tela do Design (${scr.width}x${scr.height}px${scr.colors?.length ? ` · ${scr.colors.slice(0, 4).join(' ')}` : ''})`,
    })),
  ];

  // Standard special mention items
  const systemMentions: MentionItem[] = [
    ...designMentions,
    {
      id: 'mention-git-status',
      type: 'git',
      title: '@git',
      path: '@git',
      subtitle: `Status do repositório (${gitBranch || 'main'}), diff e arquivos alterados`,
    },
    {
      id: 'mention-terminal-output',
      type: 'terminal',
      title: '@terminal',
      path: '@terminal',
      subtitle: 'Histórico recente e saídas do terminal integrado',
    },
    {
      id: 'mention-rules',
      type: 'rules',
      title: '@rules',
      path: '@rules',
      subtitle: 'Diretrizes, convenções e regras de código do projeto',
    },
    {
      id: 'mention-mcp',
      type: 'mcp',
      title: '@mcp',
      path: '@mcp',
      subtitle: 'Ferramentas e conexões do Model Context Protocol',
    },
  ];

  // Map workspace files to mention items
  const safeFiles = Array.isArray(files) ? files : [];
  const fileMentions: MentionItem[] = safeFiles.map((f) => ({
    id: f.path,
    type: f.isDirectory ? 'folder' : 'file',
    title: f.name,
    subtitle: f.path,
    path: f.path,
  }));

  // Filter all items by query
  const allItems = [...systemMentions, ...fileMentions].filter((item) => {
    if (!q) return true;
    const cleanTitle = item.title.replace(/^@+/, '').toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      cleanTitle.includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  });

  const clampedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, allItems.length - 1));

  const bgMenu = isEffectiveDark ? '#181818' : '#ffffff';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  const renderIcon = (item: MentionItem) => {
    if (item.type === 'design') return <Layout size={13} color={accentColor || '#ec4899'} />;
    if (item.type === 'git') return <GitBranch size={13} color="#f97316" />;
    if (item.type === 'terminal') return <Terminal size={13} color="#22c55e" />;
    if (item.type === 'rules') return <BookOpen size={13} color="#38bdf8" />;
    if (item.type === 'mcp') return <Cpu size={13} color="#a855f7" />;
    if (item.type === 'folder') return <Folder size={13} color={accentColor} />;

    const ext = (item.title.split('.').pop() || '').toLowerCase();
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);
    if (isImg) return <ImageIcon size={13} color="#60a5fa" />;
    return <FileIcon fileName={item.title} size={13} />;
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        background: bgMenu,
        borderRadius: 8,
        border: 'none',
        boxShadow: 'none',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 260,
        overflowY: 'auto',
        zIndex: 99999,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px 6px 4px',
          borderBottom: `1px solid ${divider}`,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: themeTokens.textSecondary }}>
          Contexto com @ (Arquivos, Git, Terminal, Regras)
        </span>
        <span style={{ fontSize: 10, color: themeTokens.textSecondary, opacity: 0.8 }}>
          {allItems.length} itens
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {allItems.length === 0 ? (
          <div style={{ padding: '8px 10px', fontSize: 11.5, color: themeTokens.textSecondary }}>
            Nenhum item correspondente para @{query}
          </div>
        ) : (
          allItems.slice(0, 30).map((item, idx) => {
            const isSelected = idx === clampedIndex;
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: isSelected
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                    : 'transparent',
                  gap: 8,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {renderIcon(item)}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isSelected ? themeTokens.textPrimary : themeTokens.textPrimary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span
                      style={{
                        fontSize: 10.5,
                        color: themeTokens.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        opacity: 0.8,
                      }}
                      title={item.subtitle}
                    >
                      {item.subtitle}
                    </span>
                  )}
                </div>
                {item.type !== 'file' && item.type !== 'folder' && (
                  <span
                    style={{
                      fontSize: 9.5,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      color: themeTokens.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    {item.type}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
