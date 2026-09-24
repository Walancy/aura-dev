import React, { useState } from 'react';
import {
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Triangle,
  Star,
  Type,
  CaseSensitive,
  Pen,
  Pencil,
  Frame,
  SquareDashedBottom,
  Scissors,
  Folder,
  Image as ImageIcon,
  MessageSquare,
  StickyNote,
  Ruler,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
  Search,
  Plus,
  SlidersHorizontal,
  Copy,
  Edit2,
  X,
} from 'lucide-react';
import type { Shape, Page } from './types';

interface LayersPanelProps {
  shapes: Shape[];
  selectedId: string | null;
  selectedIds?: string[];
  readOnly?: boolean;
  themeTokens?: any;
  accentColor?: string;
  pages?: Page[];
  selectedPageId?: string;
  onSelectPage?: (pageId: string) => void;
  onAddPage?: () => void;
  onRenamePage?: (pageId: string, newName: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onSelect: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDelete?: (id: string) => void;
  onContextMenuShape?: (shape: Shape, clientX: number, clientY: number) => void;
}

export default function LayersPanel({
  shapes,
  selectedId,
  selectedIds,
  readOnly = false,
  themeTokens,
  accentColor = '#007acc',
  pages = [
    { id: 'page-1', name: 'Page 1' },
    { id: 'page-2', name: 'Page 2' },
    { id: 'page-3', name: 'Page 3' },
    { id: 'page-4', name: 'Page 4' },
  ],
  selectedPageId = 'page-1',
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onContextMenuShape,
}: LayersPanelProps) {
  const [expandedFrames, setExpandedFrames] = useState<Record<string, boolean>>({});
  const [isSearchingPages, setIsSearchingPages] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);

  const toggleFrame = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFrames((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  // Profundidade real (para indentação) e visibilidade na árvore (colapso de ancestral esconde filhos)
  const depthOf = (id: string): number => {
    let depth = 0;
    let current = shapes.find((s) => s.id === id);
    while (current?.parentId) {
      depth += 1;
      current = shapes.find((s) => s.id === current!.parentId);
    }
    return depth;
  };

  const isVisibleInTree = (s: Shape): boolean => {
    let current = s;
    while (current.parentId) {
      const parent = shapes.find((p) => p.id === current.parentId);
      if (!parent) break;
      const parentExpanded = expandedFrames[parent.id] ?? true;
      if (!parentExpanded) return false;
      current = parent;
    }
    return true;
  };

  const visibleShapes = shapes.filter(isVisibleInTree);

  const textPrimary = themeTokens?.textPrimary || '#ffffff';
  const textSecondary = themeTokens?.textSecondary || '#888888';
  const textMuted = themeTokens?.textMuted || '#555555';
  const bgCard = themeTokens?.bgCard || '#101010';
  const hoverBg = themeTokens?.hoverBg || 'rgba(255, 255, 255, 0.05)';
  const dividerColor = themeTokens?.borderSubtle && themeTokens.borderSubtle !== 'transparent'
    ? themeTokens.borderSubtle
    : 'rgba(255, 255, 255, 0.06)';

  const renderIcon = (type: Shape['type']) => {
    switch (type) {
      case 'rect':
        return <Square size={13} strokeWidth={1.75} color={textMuted} />;
      case 'ellipse':
        return <Circle size={13} strokeWidth={1.75} color={textMuted} />;
      case 'line':
        return <Minus size={13} strokeWidth={2} color={textMuted} />;
      case 'arrow':
        return <ArrowUpRight size={13} strokeWidth={1.75} color={textMuted} />;
      case 'polygon':
        return <Triangle size={13} strokeWidth={1.75} color={textMuted} />;
      case 'star':
        return <Star size={13} strokeWidth={1.75} color={textMuted} />;
      case 'text':
        return <Type size={13} strokeWidth={1.75} color={textMuted} />;
      case 'text-path':
        return <CaseSensitive size={13} strokeWidth={1.75} color={textMuted} />;
      case 'pen':
        return <Pen size={13} strokeWidth={1.75} color={textMuted} />;
      case 'pencil':
        return <Pencil size={13} strokeWidth={1.75} color={textMuted} />;
      case 'frame':
        return <Frame size={13} strokeWidth={1.75} color={textMuted} />;
      case 'section':
        return <SquareDashedBottom size={13} strokeWidth={1.75} color={textMuted} />;
      case 'slice':
        return <Scissors size={13} strokeWidth={1.75} color={textMuted} />;
      case 'group':
        return <Folder size={13} strokeWidth={1.75} color={textMuted} />;
      case 'image':
        return <ImageIcon size={13} strokeWidth={1.75} color={textMuted} />;
      case 'comment':
        return <MessageSquare size={13} strokeWidth={1.75} color={textMuted} />;
      case 'annotation':
        return <StickyNote size={13} strokeWidth={1.75} color={textMuted} />;
      case 'measurement':
        return <Ruler size={13} strokeWidth={1.75} color={textMuted} />;
      default:
        return <Square size={13} strokeWidth={1.75} color={textMuted} />;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: bgCard,
        color: textPrimary,
        fontSize: 11,
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO: PAGES                                                  */}
      {/* ------------------------------------------------------------- */}
      <div style={{ padding: '10px 12px 6px 12px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, letterSpacing: 0.2 }}>
            Pages
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsSearchingPages((prev) => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isSearchingPages ? accentColor : textSecondary,
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
              title="Pesquisar páginas"
            >
              <Search size={12} />
            </button>
            <button
              type="button"
              onClick={onAddPage}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
              }}
              title="Adicionar nova página"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Input de filtro de páginas */}
        {isSearchingPages && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
              borderRadius: 5,
              background: themeTokens?.bgCardSecondary || 'rgba(255,255,255,0.04)',
              border: `1px solid ${dividerColor}`,
              marginBottom: 6,
            }}
          >
            <Search size={10} color={textMuted} />
            <input
              type="text"
              autoFocus
              value={pageSearchQuery}
              onChange={(e) => setPageSearchQuery(e.target.value)}
              placeholder="Filtrar páginas..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 10.5,
                color: textPrimary,
                fontFamily: 'inherit',
                padding: 0,
              }}
            />
            {pageSearchQuery && (
              <button
                type="button"
                onClick={() => setPageSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 0 }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}

        {/* Lista de Páginas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pages
            .filter((p) => !pageSearchQuery.trim() || p.name.toLowerCase().includes(pageSearchQuery.toLowerCase()))
            .map((p) => {
              const isSelected = p.id === selectedPageId;
              const isEditing = editingPageId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isEditing) onSelectPage?.(p.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingPageId(p.id);
                    setEditingPageName(p.name);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? `${accentColor}22` : 'transparent',
                    color: isSelected ? accentColor : textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: 11,
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    setHoveredPageId(p.id);
                    if (!isSelected) e.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    setHoveredPageId(null);
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                  title={
                    isSelected
                      ? `${p.name} (Página ativa - duplo clique para renomear)`
                      : `${p.name} (Clique para alternar para esta área de trabalho)`
                  }
                >
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingPageName}
                      onChange={(e) => setEditingPageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenamePage?.(p.id, editingPageName);
                          setEditingPageId(null);
                        } else if (e.key === 'Escape') {
                          setEditingPageId(null);
                        }
                      }}
                      onBlur={() => {
                        onRenamePage?.(p.id, editingPageName);
                        setEditingPageId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: themeTokens?.bgCardSecondary || '#1e1e1e',
                        border: `1px solid ${accentColor}`,
                        borderRadius: 4,
                        color: textPrimary,
                        fontSize: 11,
                        fontWeight: 600,
                        outline: 'none',
                        padding: '1px 4px',
                        width: '100%',
                      }}
                    />
                  ) : (
                    <>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {p.name}
                      </span>
                      {hoveredPageId === p.id && (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onDuplicatePage?.(p.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: textSecondary,
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              borderRadius: 3,
                            }}
                            title="Duplicar página"
                          >
                            <Copy size={11} />
                          </button>
                          {pages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeletePage?.(p.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                borderRadius: 3,
                              }}
                              title="Excluir página"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: dividerColor, margin: '4px 0', flexShrink: 0 }} />

      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO: LAYERS                                                 */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 6px 12px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, letterSpacing: 0.2 }}>
          Layers
        </span>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
          title="Filtros de Camadas"
        >
          <SlidersHorizontal size={12} />
        </button>
      </div>

      {/* Árvore de Camadas */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 40,
        }}
      >
        {visibleShapes.length === 0 ? (
          <div
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              color: textMuted,
              fontSize: 11,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SquareDashedBottom size={22} color={textMuted} strokeWidth={1.5} />
            <div style={{ fontWeight: 500, color: textSecondary, fontSize: 11.5 }}>
              Nenhuma camada nesta página
            </div>
            <div style={{ fontSize: 10, opacity: 0.75, maxWidth: 170, lineHeight: 1.4 }}>
              Desenhe frames ou formas no canvas para criar nesta área de trabalho
            </div>
          </div>
        ) : (
          visibleShapes.map((s) => {
          const isSelected = selectedIds && selectedIds.length > 0 ? selectedIds.includes(s.id) : s.id === selectedId;
          const isFrame = s.type === 'frame' || s.type === 'group';
          const hasChildren = isFrame && shapes.some((c) => c.parentId === s.id);
          const isExpanded = expandedFrames[s.id] ?? true;
          const depth = depthOf(s.id);
          const isHidden = s.visible === false;
          const isLocked = !!s.locked;

          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(s.id);
                onContextMenuShape?.(s, e.clientX, e.clientY);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `5px 10px 5px ${12 + depth * 14}px`,
                cursor: 'pointer',
                background: isSelected ? `${accentColor}20` : 'transparent',
                color: isSelected ? textPrimary : textSecondary,
                borderLeft: isSelected ? `2.5px solid ${accentColor}` : '2.5px solid transparent',
                fontSize: 11,
                gap: 6,
                minHeight: 26,
                boxSizing: 'border-box',
                opacity: isHidden ? 0.5 : 1,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = hoverBg;
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => toggleFrame(s.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textMuted,
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                ) : (
                  <span style={{ width: 11 }} />
                )}

                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {renderIcon(s.type)}
                </span>

                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  title={s.name || s.type}
                >
                  {s.name || s.type}
                </span>
              </div>

              {/* Ações: visibilidade, travar, excluir */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility?.(s.id);
                      }}
                      style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer', padding: 3, display: 'flex' }}
                      title={isHidden ? 'Mostrar' : 'Ocultar'}
                    >
                      {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock?.(s.id);
                      }}
                      style={{ background: 'transparent', border: 'none', color: isLocked ? accentColor : textMuted, cursor: 'pointer', padding: 3, display: 'flex' }}
                      title={isLocked ? 'Destravar' : 'Travar'}
                    >
                      {isLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(s.id);
                      }}
                      style={{ background: 'transparent', border: 'none', color: textMuted, cursor: 'pointer', padding: 3, display: 'flex' }}
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
