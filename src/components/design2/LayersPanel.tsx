import React, { useEffect, useMemo, useState } from 'react';
import { filterLayers } from './layersFilter';
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
  Component,
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
  /** abre o painel de Assets (componentes do documento) */
  onOpenAssets?: () => void;
  onRenamePage?: (pageId: string, newName: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onSelect: (id: string) => void;
  /** seleção de várias camadas (Shift = intervalo, Cmd/Ctrl = alternar, Alt = camada + tudo que há dentro) */
  onSelectMany?: (ids: string[]) => void;
  /** arrastar uma camada: antes/depois de outra ou para dentro de um frame/grupo */
  onReorder?: (dragId: string, targetId: string, pos: 'before' | 'after' | 'inside') => void;
  onToggleVisibility?: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onDelete?: (id: string) => void;
  onContextMenuShape?: (shape: Shape, clientX: number, clientY: number) => void;
}

export default function LayersPanel({
  shapes: shapesRaw,
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
  onOpenAssets,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  onSelect,
  onSelectMany,
  onReorder,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onContextMenuShape,
}: LayersPanelProps) {
  // Como no Figma: a camada mais acima na pilha (zIndex maior) fica no TOPO da lista, em cada nível
  const shapes = useMemo(() => {
    const kids = new Map<string | undefined, Shape[]>();
    const ids = new Set(shapesRaw.map((x) => x.id));
    shapesRaw.forEach((x) => {
      const k = x.parentId && ids.has(x.parentId) ? x.parentId : undefined;
      (kids.get(k) ?? kids.set(k, []).get(k)!).push(x);
    });
    const out: Shape[] = [];
    const walk = (k: string | undefined) => {
      const list = (kids.get(k) ?? []).map((x, i) => ({ x, i })).sort((a, b) => (b.x.zIndex ?? 0) - (a.x.zIndex ?? 0) || b.i - a.i);
      for (const { x } of list) { out.push(x); walk(x.id); }
    };
    walk(undefined);
    return out;
  }, [shapesRaw]);
  const [expandedFrames, setExpandedFrames] = useState<Record<string, boolean>>({});
  const [isSearchingPages, setIsSearchingPages] = useState(false);
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);

  // Índices (O(n)) em vez de buscas por linha: com centenas de camadas isso era quadrático e travava ao abrir/renderizar
  const { depthMap, parentsWithKids, byId } = useMemo(() => {
    const byId = new Map(shapes.map((x) => [x.id, x]));
    const depthMap = new Map<string, number>();
    const parentsWithKids = new Set<string>();
    const depthOf = (id: string): number => {
      const hit = depthMap.get(id);
      if (hit !== undefined) return hit;
      const sh = byId.get(id);
      const d = sh?.parentId && byId.has(sh.parentId) ? depthOf(sh.parentId) + 1 : 0;
      depthMap.set(id, d);
      return d;
    };
    for (const x of shapes) {
      depthOf(x.id);
      if (x.parentId) parentsWithKids.add(x.parentId);
    }
    return { depthMap, parentsWithKids, byId };
  }, [shapes]);

  // Só os frames de topo começam abertos (árvore enxuta); o resto abre sob demanda
  const isOpen = (id: string) => expandedFrames[id] ?? (depthMap.get(id) ?? 0) === 0;

  const toggleFrame = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFrames((prev) => ({ ...prev, [id]: !isOpen(id) }));
  };

  // Selecionar algo (no canvas ou nas camadas) abre os pais para a camada aparecer na árvore
  useEffect(() => {
    const ids = selectedIds && selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (!ids.length) return;
    setExpandedFrames((prev) => {
      let next = prev;
      for (const id of ids) {
        let cur = byId.get(id);
        while (cur?.parentId) {
          const pid = cur.parentId;
          if ((prev[pid] ?? (depthMap.get(pid) ?? 0) === 0) === false && next[pid] !== true) next = { ...next, [pid]: true };
          cur = byId.get(pid);
        }
      }
      return next;
    });
  }, [selectedId, selectedIds, byId, depthMap]);

  const isVisibleInTree = (s: Shape): boolean => {
    let current = s;
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      if (!isOpen(parent.id)) return false;
      current = parent;
    }
    return true;
  };

  // Busca de camadas: com texto digitado, lista as que combinam (achatadas, sem depender de pastas abertas)
  const [layerQuery, setLayerQuery] = useState('');
  const [isSearchingLayers, setIsSearchingLayers] = useState(false);
  const visibleShapes = layerQuery.trim() ? filterLayers(shapes, layerQuery) : shapes.filter(isVisibleInTree);

  // Seleção múltipla: ao selecionar uma camada "principal" (frame/grupo), as inferiores entram junto
  const anchorRef = React.useRef<string | null>(null);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const zoneFor = (e: React.DragEvent, s: Shape): 'before' | 'after' | 'inside' => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    const container = s.type === 'frame' || s.type === 'group' || s.type === 'section';
    if (container && !s.deviceChrome) return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
    return y < 0.5 ? 'before' : 'after';
  };
  const withDescendants = (id: string): string[] => {
    const out = [id];
    for (let i = 0; i < out.length; i++) for (const k of shapes) if (k.parentId === out[i]) out.push(k.id);
    return out;
  };
  const currentSelection = (): string[] => (selectedIds && selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
  const handleRowClick = (e: React.MouseEvent, s: Shape) => {
    if (!onSelectMany) { onSelect(s.id); return; }
    if (e.shiftKey && anchorRef.current && anchorRef.current !== s.id) {
      const ids = visibleShapes.map((x) => x.id);
      const a = ids.indexOf(anchorRef.current), b = ids.indexOf(s.id);
      if (a >= 0 && b >= 0) {
        const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
        const all = new Set<string>();
        range.forEach((id) => withDescendants(id).forEach((d) => all.add(d)));
        onSelectMany([...all]);
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      const cur = new Set(currentSelection());
      const group = withDescendants(s.id);
      if (cur.has(s.id)) group.forEach((d) => cur.delete(d));
      else group.forEach((d) => cur.add(d));
      anchorRef.current = s.id;
      onSelectMany([...cur]);
      return;
    }
    anchorRef.current = s.id;
    if (e.altKey) { onSelectMany(withDescendants(s.id)); return; }
    onSelect(s.id);
  };

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
          onClick={() => onOpenAssets?.()}
          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex', marginLeft: 'auto', marginRight: 6 }}
          title="Assets: componentes do documento (Shift+I)"
        >
          <Component size={12} />
        </button>
        <button
          type="button"
          onClick={() => { setIsSearchingLayers((v) => !v); if (isSearchingLayers) setLayerQuery(''); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: isSearchingLayers ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
          title="Buscar camadas (nome, tipo ou #cor)"
        >
          <Search size={12} />
        </button>
      </div>
      {isSearchingLayers && (
        <div style={{ padding: '0 12px 6px', flexShrink: 0 }}>
          <input
            autoFocus
            value={layerQuery}
            onChange={(e) => setLayerQuery(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { setLayerQuery(''); setIsSearchingLayers(false); } }}
            placeholder="Nome, tipo ou #cor"
            style={{ width: '100%', boxSizing: 'border-box', background: hoverBg, border: 'none', borderRadius: 6, color: textPrimary, fontSize: 11, padding: '5px 8px', outline: 'none' }}
          />
          {layerQuery.trim() && <div style={{ fontSize: 10, color: textMuted, padding: '4px 2px 0' }}>{visibleShapes.length} resultado(s)</div>}
        </div>
      )}

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
          const hasChildren = isFrame && parentsWithKids.has(s.id);
          const isExpanded = isOpen(s.id);
          const depth = layerQuery.trim() ? 0 : depthMap.get(s.id) ?? 0;
          const isHidden = s.visible === false;
          const isLocked = !!s.locked;

          return (
            <div
              key={s.id}
              draggable={!!onReorder && !s.deviceChrome && !s.locked && !readOnly}
              onDragStart={(e) => { setDragLayerId(s.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); }}
              onDragEnd={() => { setDragLayerId(null); setDropHint(null); }}
              onDragOver={(e) => {
                if (!dragLayerId || dragLayerId === s.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const pos = zoneFor(e, s);
                setDropHint((h) => (h && h.id === s.id && h.pos === pos ? h : { id: s.id, pos }));
              }}
              onDragLeave={() => setDropHint((h) => (h && h.id === s.id ? null : h))}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragLayerId;
                const pos = zoneFor(e, s);
                setDragLayerId(null);
                setDropHint(null);
                if (id && id !== s.id) onReorder?.(id, s.id, pos === 'before' ? 'after' : pos === 'after' ? 'before' : pos);
              }}
              onClick={(e) => handleRowClick(e, s)}
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
                boxShadow: dropHint?.id === s.id ? (dropHint.pos === 'before' ? `inset 0 2px 0 0 ${accentColor}` : dropHint.pos === 'after' ? `inset 0 -2px 0 0 ${accentColor}` : `inset 0 0 0 1.5px ${accentColor}`) : undefined,
                ...(dragLayerId === s.id ? { opacity: 0.4 } : {}),
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
                {s.devStatus && (
                  <span title={s.devStatus === 'ready' ? 'Pronto para dev' : 'Implementado'} style={{ width: 7, height: 7, borderRadius: '50%', background: s.devStatus === 'ready' ? '#2ecc71' : '#4f9dff', flexShrink: 0, marginLeft: 4 }} />
                )}
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
