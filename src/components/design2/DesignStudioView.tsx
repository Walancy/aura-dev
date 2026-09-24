import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  PanelLeft,
  X,
  Edit2,
  Copy,
  Download,
  History,
  FolderGit2,
  Check,
} from 'lucide-react';
import DesignCanvas from './DesignCanvas';
import type { CanvasViewport } from './DesignCanvas';
import type { Shape, Page, ToolId } from './types';
import LayersPanel from './LayersPanel';
import PropertiesPanel, { type ActiveColorPickerInfo } from './PropertiesPanel';
import FigmaColorPicker from './FigmaColorPicker';
import FigmaStrokeSettingsModal from './FigmaStrokeSettingsModal';
import FigmaEffectSettingsModal from './FigmaEffectSettingsModal';
import FigmaTypeSettingsModal from './FigmaTypeSettingsModal';
import RoomPanel from './RoomPanel';
import DesignToolbar from './DesignToolbar';
import { useDesignRoom } from './useDesignRoom';
import { usePersistedDesign } from './usePersistedDesign';
import FigmaContextMenu from './FigmaContextMenu';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { generateAiPrototypeScreen } from './aiScreenGenerator';

interface DesignStudioViewProps {
  workspacePath: string;
  repoName?: string;
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models?: Array<{ id: string; label: string }> }>;
  onInstallAiCli?: (provider: any) => void;
  activeProject?: {
    name: string;
    fullName?: string;
    description?: string;
    owner?: string;
    localDir?: string;
  } | null;
  availableProjects?: Array<{
    id: string | number;
    name: string;
    fullName: string;
    localDir?: string;
    isCloned: boolean;
    owner?: string;
  }>;
  onSelectWorkspace?: (dirPath: string, repoName?: string) => Promise<void> | void;
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: {
    bgApp: string;
    bgCard: string;
    bgCardSecondary: string;
    bgCardElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderSubtle: string;
    hoverBg: string;
  };
}

const DEFAULT_PAGES: Page[] = [
  { id: 'page-1', name: 'Page 1' },
  { id: 'page-2', name: 'Page 2' },
  { id: 'page-3', name: 'Page 3' },
  { id: 'page-4', name: 'Page 4' },
];

const DEFAULT_FIGMA_SHAPES: Shape[] = [
  {
    id: 'rect-148',
    name: 'Rectangle 148',
    type: 'rect',
    x: 5437,
    y: -12645,
    width: 1199,
    height: 728,
    rotation: 0,
    fill: '#D9D9D9',
    stroke: '#000000',
    strokeWidth: 1,
    strokePosition: 'inside',
    strokeSides: 'all',
    opacity: 1,
    cornerRadius: 0,
    independentCorners: false,
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
    cornerSmoothing: 0,
    fills: [
      { id: 'fill-1', color: '#D9D9D9', opacity: 1, visible: true, type: 'solid' },
    ],
    strokes: [
      { id: 'stroke-1', color: '#000000', opacity: 1, visible: true },
    ],
    effects: [],
    exports: [],
    zIndex: 30,
    visible: true,
  },
  {
    id: 'line-8',
    name: 'Line 8',
    type: 'line',
    x: 5000,
    y: -12900,
    width: 250,
    height: 0,
    rotation: 0,
    fill: 'none',
    stroke: '#555555',
    strokeWidth: 1,
    opacity: 1,
    zIndex: 29,
    visible: true,
  },
  {
    id: 'frame-1984080046',
    name: 'Frame 1984080046',
    type: 'frame',
    x: 4800,
    y: -12600,
    width: 320,
    height: 480,
    rotation: 0,
    fill: '#2a2a2a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 28,
    visible: true,
  },
  {
    id: 'frame-1984080048',
    name: 'Frame 1984080048',
    type: 'frame',
    x: 4800,
    y: -12000,
    width: 320,
    height: 480,
    rotation: 0,
    fill: '#2a2a2a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 27,
    visible: true,
  },
  {
    id: 'image-25',
    name: 'image 25',
    type: 'image',
    x: 4200,
    y: -12400,
    width: 400,
    height: 300,
    rotation: 0,
    fill: '#333333',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 26,
    visible: true,
  },
  {
    id: 'group-4',
    name: 'Group 4',
    type: 'group',
    x: 3600,
    y: -12500,
    width: 500,
    height: 600,
    rotation: 0,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 25,
    visible: true,
  },
  {
    id: 'rect-26',
    name: 'Rectangle 26',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12480,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 24,
    visible: true,
  },
  {
    id: 'rect-25',
    name: 'Rectangle 25',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12420,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 23,
    visible: true,
  },
  {
    id: 'rect-24',
    name: 'Rectangle 24',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12360,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 22,
    visible: true,
  },
  {
    id: 'rect-22',
    name: 'Rectangle 22',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12300,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 21,
    visible: true,
  },
  {
    id: 'rect-21',
    name: 'Rectangle 21',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12240,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 20,
    visible: true,
  },
  {
    id: 'rect-20',
    name: 'Rectangle 20',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12180,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 19,
    visible: true,
  },
  {
    id: 'rect-19',
    name: 'Rectangle 19',
    parentId: 'group-4',
    type: 'rect',
    x: 3620,
    y: -12120,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 18,
    visible: true,
  },
  {
    id: 'group-2',
    name: 'Group 2',
    type: 'group',
    x: 3000,
    y: -12500,
    width: 400,
    height: 400,
    rotation: 0,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 17,
    visible: true,
  },
  {
    id: 'image-24',
    name: 'image 24',
    parentId: 'group-2',
    type: 'image',
    x: 3020,
    y: -12480,
    width: 200,
    height: 200,
    rotation: 0,
    fill: '#444444',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 16,
    visible: false,
  },
  {
    id: 'image-24-vec',
    name: 'image 24 [Vectorized]',
    parentId: 'group-2',
    type: 'image',
    x: 3020,
    y: -12480,
    width: 200,
    height: 200,
    rotation: 0,
    fill: '#555555',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 15,
    visible: true,
  },
  {
    id: 'group-1',
    name: 'Group 1',
    type: 'group',
    x: 2400,
    y: -12500,
    width: 300,
    height: 300,
    rotation: 0,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 14,
    visible: true,
  },
  {
    id: 'rect-17',
    name: 'Rectangle 17',
    parentId: 'group-1',
    type: 'rect',
    x: 2420,
    y: -12480,
    width: 140,
    height: 50,
    rotation: 0,
    fill: '#3a3a3a',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 13,
    visible: true,
  },
  {
    id: 'frame-110',
    name: 'Frame 110',
    type: 'frame',
    x: 1800,
    y: -12500,
    width: 300,
    height: 250,
    rotation: 0,
    fill: '#242424',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 12,
    visible: true,
  },
  {
    id: 'frame-104',
    name: 'Frame 104',
    type: 'frame',
    x: 1400,
    y: -12500,
    width: 300,
    height: 250,
    rotation: 0,
    fill: '#242424',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 11,
    visible: true,
  },
  {
    id: 'frame-88',
    name: 'Frame 88',
    type: 'frame',
    x: 1000,
    y: -12500,
    width: 300,
    height: 250,
    rotation: 0,
    fill: '#242424',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 10,
    visible: true,
  },
  {
    id: 'frame-98',
    name: 'Frame 98',
    type: 'frame',
    x: 600,
    y: -12500,
    width: 300,
    height: 250,
    rotation: 0,
    fill: '#242424',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 9,
    visible: true,
  },
  {
    id: 'text-tarefas',
    name: '138/150 tarefas',
    type: 'text',
    x: 200,
    y: -12500,
    width: 150,
    height: 30,
    rotation: 0,
    fill: '#ffffff',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    text: '138/150 tarefas',
    fontSize: 14,
    zIndex: 8,
    visible: true,
  },
  {
    id: 'frame-85',
    name: 'Frame 85',
    type: 'frame',
    x: -200,
    y: -12500,
    width: 300,
    height: 250,
    rotation: 0,
    fill: '#242424',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    zIndex: 7,
    visible: true,
  },
];

export default function DesignStudioView({
  workspacePath,
  repoName,
  activeProject,
  availableProjects,
  onSelectWorkspace,
  accentColor = '#0d99ff',
  isEffectiveDark = true,
  themeTokens,
  selectedAiProvider,
  selectedModel,
  onSelectAiProvider,
  onSelectModel,
  installedClis,
  activeModels,
  onInstallAiCli,
}: DesignStudioViewProps) {
  const tokens = themeTokens || {
    bgApp: isEffectiveDark ? '#000000' : '#eaedf1',
    bgCard: isEffectiveDark ? '#101010' : '#ffffff',
    bgCardSecondary: isEffectiveDark ? '#181818' : '#f1f5f9',
    bgCardElevated: isEffectiveDark ? '#1f1f1f' : '#e2e8f0',
    textPrimary: isEffectiveDark ? '#ffffff' : '#0f172a',
    textSecondary: isEffectiveDark ? '#888888' : '#475569',
    textMuted: isEffectiveDark ? '#555555' : '#64748b',
    border: 'transparent',
    borderSubtle: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    hoverBg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  };

  // Nome e subtítulo do projeto ativo selecionado na Header
  const activeHeaderProjectName = useMemo(() => {
    if (activeProject?.name) return activeProject.name;
    try {
      const saved = localStorage.getItem('header_active_project_name');
      if (saved) return saved;
    } catch {}
    const folder = workspacePath.split('/').filter(Boolean).pop() || 'Projeto';
    if (folder.toLowerCase() === 'devflow-desktop') return 'Aura Dev';
    return folder;
  }, [activeProject, workspacePath]);

  const activeHeaderProjectSubtitle = useMemo(() => {
    if (activeProject?.description) return activeProject.description;
    if (activeProject?.fullName) return activeProject.fullName;
    try {
      const savedDesc = localStorage.getItem('header_active_project_desc');
      if (savedDesc) return savedDesc;
      const savedFull = localStorage.getItem('header_active_project_fullname');
      if (savedFull) return savedFull;
    } catch {}
    if (repoName) return repoName.includes('/') ? repoName : `Walancy/${repoName}`;
    const folder = workspacePath.split('/').filter(Boolean).pop() || '';
    if (folder.toLowerCase() === 'devflow-desktop') return 'Walancy/aura-dev';
    return workspacePath || 'Design Studio';
  }, [activeProject, repoName, workspacePath]);

  const [shapes, setShapesRaw] = useState<Shape[]>(() =>
    DEFAULT_FIGMA_SHAPES.map((s) => ({ ...s, pageId: s.pageId || 'page-1' }))
  );
  const [selectedId, setSelectedId] = useState<string | null>('rect-148');
  const [selectedIds, setSelectedIds] = useState<string[]>(['rect-148']);

  const handleSelectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setSelectedId(ids.length > 0 ? ids[0] : null);
  }, []);

  const handleSelectSingle = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedIds(id ? [id] : []);
  }, []);
  const [tool, setTool] = useState<ToolId>('select');
  const [zoom, setZoom] = useState<number>(0.21);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 0, y: 0, width: 1000, height: 700 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>(DEFAULT_PAGES);
  const [selectedPageId, setSelectedPageId] = useState<string>('page-1');
  const [pageViewports, setPageViewports] = useState<Record<string, { x: number; y: number; zoom: number }>>({});
  const [deletePageTarget, setDeletePageTarget] = useState<Page | null>(null);
  const [isDeletePageModalOpen, setIsDeletePageModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState<string>(activeHeaderProjectName);
  const [docSubtitle, setDocSubtitle] = useState<string>(activeHeaderProjectSubtitle);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isDocMenuOpen, setIsDocMenuOpen] = useState<boolean>(false);

  // Mantém o título e subtítulo sincronizados com o projeto ativo selecionado na header
  useEffect(() => {
    setDocTitle(activeHeaderProjectName);
    setDocSubtitle(activeHeaderProjectSubtitle);
  }, [activeHeaderProjectName, activeHeaderProjectSubtitle]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    shape: Shape | null;
  }>({ isOpen: false, x: 0, y: 0, shape: null });
  const [clipboardShape, setClipboardShape] = useState<Shape | null>(null);
  const [copiedProperties, setCopiedProperties] = useState<Partial<Shape> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shape | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<ActiveColorPickerInfo | null>(null);
  const [isStrokeSettingsOpen, setIsStrokeSettingsOpen] = useState(false);
  const [isTypeSettingsOpen, setIsTypeSettingsOpen] = useState(false);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null);

  // Redimensionamento das colunas esquerda e direita (comportamento IDÊNTICO à tela IDE)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('design_left_sidebar_width');
    return saved ? Math.max(180, Math.min(Number(saved), 500)) : 250;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('design_right_sidebar_width');
    return saved ? Math.max(240, Math.min(Number(saved), 550)) : 300;
  });
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.min(Math.max(startW + delta, 180), 500);
      setLeftSidebarWidth(newW);
      localStorage.setItem('design_left_sidebar_width', String(newW));
    };

    const onMouseUp = () => {
      setIsDraggingLeft(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftSidebarWidth]);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = rightSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 240), 550);
      setRightSidebarWidth(newW);
      localStorage.setItem('design_right_sidebar_width', String(newW));
    };

    const onMouseUp = () => {
      setIsDraggingRight(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [rightSidebarWidth]);

  useEffect(() => {
    setActiveColorPicker(null);
    setActiveEffectId(null);
  }, [selectedId]);

  const historyRef = useRef<{ stack: Shape[][]; index: number }>({
    stack: [DEFAULT_FIGMA_SHAPES],
    index: 0,
  });

  const room = useDesignRoom(setShapesRaw);
  const readOnly = room.role === 'viewing';

  const {
    loadedShapes,
    loadedPages,
    loadedSelectedPageId,
    loadedPageViewports,
    isLoading,
  } = usePersistedDesign(workspacePath, shapes, pages, selectedPageId, pageViewports, readOnly);

  useEffect(() => {
    if (loadedShapes && loadedShapes.length > 0) {
      setShapesRaw(loadedShapes);
      historyRef.current = { stack: [loadedShapes], index: 0 };
    }
    if (loadedPages && loadedPages.length > 0) {
      setPages(loadedPages);
    }
    if (loadedSelectedPageId) {
      setSelectedPageId(loadedSelectedPageId);
    }
    if (loadedPageViewports) {
      setPageViewports(loadedPageViewports);
      const activeVp = loadedPageViewports[loadedSelectedPageId || selectedPageId];
      if (activeVp) {
        setViewport((prev) => ({ ...prev, x: activeVp.x, y: activeVp.y }));
        setZoom(activeVp.zoom);
      }
    }
  }, [loadedShapes, loadedPages, loadedSelectedPageId, loadedPageViewports]);

  const activePageShapes = useMemo(() => {
    return shapes.filter((s) => (s.pageId || 'page-1') === selectedPageId);
  }, [shapes, selectedPageId]);

  const applyActivePageShapes = useCallback(
    (nextActive: Shape[], commit: boolean = true) => {
      const tagged = nextActive.map((s) =>
        s.pageId === selectedPageId ? s : { ...s, pageId: selectedPageId }
      );
      setShapesRaw((prev) => {
        const otherPageShapes = prev.filter((s) => (s.pageId || 'page-1') !== selectedPageId);
        const combined = [...otherPageShapes, ...tagged];
        room.broadcast(combined);
        if (commit) {
          const h = historyRef.current;
          h.stack = h.stack.slice(0, h.index + 1);
          h.stack.push(combined);
          h.index = h.stack.length - 1;
        }
        return combined;
      });
    },
    [selectedPageId, room]
  );

  const applyShapes = useCallback(
    (next: Shape[], commit: boolean) => {
      setShapesRaw(next);
      room.broadcast(next);
      if (commit) {
        const h = historyRef.current;
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(next);
        h.index = h.stack.length - 1;
      }
    },
    [room]
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    setShapesRaw(h.stack[h.index]);
    room.broadcast(h.stack[h.index]);
  }, [room]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    setShapesRaw(h.stack[h.index]);
    room.broadcast(h.stack[h.index]);
  }, [room]);

  const [isDevMode, setIsDevMode] = useState(false);

  const handleInsertImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          const aspect = img.width / (img.height || 1);
          const w = Math.min(400, img.width || 300);
          const h = Math.round(w / aspect);
          const zIndex = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1;
          const newShape: Shape = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            type: 'image',
            x: Math.round(viewport.x + viewport.width / 2 - w / 2),
            y: Math.round(viewport.y + viewport.height / 2 - h / 2),
            width: w,
            height: h,
            rotation: 0,
            fill: '#ffffff',
            stroke: 'transparent',
            strokeWidth: 0,
            opacity: 1,
            imageUrl: dataUrl,
            zIndex,
            visible: true,
            pageId: selectedPageId,
          };
          applyShapes([...shapes, newShape], true);
          setSelectedId(newShape.id);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [shapes, applyShapes, viewport, selectedPageId]
  );

  const selectedShape = useMemo(
    () => activePageShapes.find((s) => s.id === selectedId) || null,
    [activePageShapes, selectedId]
  );

  const selectedFrame = useMemo(() => {
    if (!selectedShape) return null;
    if (selectedShape.type === 'frame') return selectedShape;
    if (selectedShape.parentId) {
      return activePageShapes.find((s) => s.id === selectedShape.parentId && s.type === 'frame') || null;
    }
    return null;
  }, [selectedShape, activePageShapes]);

  const handleCopy = useCallback((shape: Shape) => {
    setClipboardShape(shape);
    try {
      navigator.clipboard.writeText(JSON.stringify(shape, null, 2));
    } catch (_) { }
  }, []);

  const handlePaste = useCallback((coords?: { x: number; y: number }) => {
    if (!clipboardShape) return;
    const newId = crypto.randomUUID();
    const maxZ = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1;
    const nextX = coords ? Math.round((coords.x - 300) / zoom) : clipboardShape.x + 30;
    const nextY = coords ? Math.round((coords.y - 100) / zoom) : clipboardShape.y + 30;
    const cloned: Shape = {
      ...clipboardShape,
      id: newId,
      name: `${clipboardShape.name || 'Component'} (Copy)`,
      pageId: selectedPageId,
      x: nextX,
      y: nextY,
      zIndex: maxZ,
    };
    applyActivePageShapes([...activePageShapes, cloned], true);
    setSelectedId(cloned.id);
  }, [clipboardShape, shapes, activePageShapes, selectedPageId, zoom, applyActivePageShapes]);

  const handlePasteToReplace = useCallback((target: Shape) => {
    if (!clipboardShape) return;
    const replaced: Shape = {
      ...clipboardShape,
      id: target.id,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
      zIndex: target.zIndex,
    };
    applyShapes(shapes.map((s) => (s.id === target.id ? replaced : s)), true);
  }, [clipboardShape, shapes, applyShapes]);

  const handleCopyAs = useCallback((format: 'svg' | 'png' | 'css') => {
    if (!selectedShape) return;
    if (format === 'svg') {
      const svgStr = `<svg width="${selectedShape.width}" height="${selectedShape.height}" viewBox="0 0 ${selectedShape.width} ${selectedShape.height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${selectedShape.width}" height="${selectedShape.height}" rx="${selectedShape.cornerRadius || 0}" fill="${selectedShape.fill}" stroke="${selectedShape.stroke}" stroke-width="${selectedShape.strokeWidth}" />
</svg>`;
      navigator.clipboard.writeText(svgStr);
    } else if (format === 'css') {
      const cssStr = `/* CSS for ${selectedShape.name || 'Component'} */
width: ${selectedShape.width}px;
height: ${selectedShape.height}px;
background: ${selectedShape.fill};
${selectedShape.strokeWidth > 0 ? `border: ${selectedShape.strokeWidth}px solid ${selectedShape.stroke};` : ''}
${selectedShape.cornerRadius ? `border-radius: ${selectedShape.cornerRadius}px;` : ''}
opacity: ${selectedShape.opacity ?? 1};
transform: rotate(${selectedShape.rotation || 0}deg);`;
      navigator.clipboard.writeText(cssStr);
    }
  }, [selectedShape]);

  const handleCopyProperties = useCallback((shape: Shape) => {
    setCopiedProperties({
      fill: shape.fill,
      fills: shape.fills,
      stroke: shape.stroke,
      strokes: shape.strokes,
      strokeWidth: shape.strokeWidth,
      cornerRadius: shape.cornerRadius,
      opacity: shape.opacity,
      effects: shape.effects,
    });
  }, []);

  const handlePasteProperties = useCallback((shape: Shape) => {
    if (!copiedProperties) return;
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, ...copiedProperties } : s)),
      true
    );
  }, [copiedProperties, shapes, applyShapes]);

  const handleBringToFront = useCallback((shape: Shape) => {
    const maxZ = Math.max(...shapes.map((s) => s.zIndex), 0) + 1;
    applyShapes(shapes.map((s) => (s.id === shape.id ? { ...s, zIndex: maxZ } : s)), true);
  }, [shapes, applyShapes]);

  const handleSendToBack = useCallback((shape: Shape) => {
    const minZ = Math.min(...shapes.map((s) => s.zIndex), 0) - 1;
    applyShapes(shapes.map((s) => (s.id === shape.id ? { ...s, zIndex: minZ } : s)), true);
  }, [shapes, applyShapes]);

  const handleGroupSelection = useCallback((shape: Shape) => {
    const groupId = `group-${crypto.randomUUID().slice(0, 6)}`;
    const groupShape: Shape = {
      id: groupId,
      name: 'Group',
      type: 'group',
      x: shape.x - 10,
      y: shape.y - 10,
      width: shape.width + 20,
      height: shape.height + 20,
      rotation: 0,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      zIndex: shape.zIndex,
      visible: true,
      pageId: shape.pageId || selectedPageId,
    };
    const updatedChild: Shape = { ...shape, parentId: groupId };
    applyShapes([...shapes.map((s) => (s.id === shape.id ? updatedChild : s)), groupShape], true);
    setSelectedId(groupId);
  }, [shapes, applyShapes, selectedPageId]);

  const handleFrameSelection = useCallback((shape: Shape) => {
    const frameId = `frame-${crypto.randomUUID().slice(0, 6)}`;
    const frameShape: Shape = {
      id: frameId,
      name: 'Frame',
      type: 'frame',
      x: shape.x - 10,
      y: shape.y - 10,
      width: shape.width + 20,
      height: shape.height + 20,
      rotation: 0,
      fill: '#1e1e1e',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      zIndex: shape.zIndex,
      visible: true,
      pageId: shape.pageId || selectedPageId,
    };
    const updatedChild: Shape = { ...shape, parentId: frameId };
    applyShapes([...shapes.map((s) => (s.id === shape.id ? updatedChild : s)), frameShape], true);
    setSelectedId(frameId);
  }, [shapes, applyShapes, selectedPageId]);

  const handleFlatten = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, name: `${s.name || 'Vector'} (Flattened)` } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleOutlineStroke = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, fill: s.stroke, strokeWidth: 0 } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleToggleMask = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, isMask: !s.isMask } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleAddAutoLayout = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) =>
        s.id === shape.id
          ? {
            ...s,
            hasAutoLayout: !s.hasAutoLayout,
            layoutFlow: 'horizontal',
            layoutGap: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }
          : s
      ),
      true
    );
  }, [shapes, applyShapes]);

  const handleCreateComponent = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, isComponent: !s.isComponent } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleFlipHorizontal = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, flipX: !s.flipX } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleFlipVertical = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, flipY: !s.flipY } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleSelectAll = useCallback(() => {
    if (activePageShapes.length > 0) setSelectedId(activePageShapes[activePageShapes.length - 1].id);
  }, [activePageShapes]);

  const handleRequestDelete = useCallback((shape: Shape) => {
    setDeleteTarget(shape);
    setIsDeleteModalOpen(true);
  }, []);

  const handleToggleVisibility = useCallback(
    (id: string) => {
      applyShapes(
        shapes.map((s) => (s.id === id ? { ...s, visible: s.visible === false ? true : false } : s)),
        true
      );
    },
    [shapes, applyShapes]
  );

  const handleToggleLock = useCallback(
    (id: string) => {
      applyShapes(
        shapes.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)),
        true
      );
    },
    [shapes, applyShapes]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readOnly) return;
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Context menu action shortcuts
      if (mod && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
        if (selectedShape) {
          e.preventDefault();
          handleCopy(selectedShape);
          return;
        }
      } else if (mod && e.key.toLowerCase() === 'v' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handlePaste();
        return;
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'r') {
        if (selectedShape) {
          e.preventDefault();
          handlePasteToReplace(selectedShape);
          return;
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 'c') {
        if (selectedShape) {
          e.preventDefault();
          handleCopyProperties(selectedShape);
          return;
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 'v') {
        if (selectedShape) {
          e.preventDefault();
          handlePasteProperties(selectedShape);
          return;
        }
      } else if (e.key === ']') {
        if (selectedShape) {
          e.preventDefault();
          handleBringToFront(selectedShape);
          return;
        }
      } else if (e.key === '[') {
        if (selectedShape) {
          e.preventDefault();
          handleSendToBack(selectedShape);
          return;
        }
      } else if (mod && e.key.toLowerCase() === 'g' && !e.altKey) {
        if (selectedShape) {
          e.preventDefault();
          handleGroupSelection(selectedShape);
          return;
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 'g') {
        if (selectedShape) {
          e.preventDefault();
          handleFrameSelection(selectedShape);
          return;
        }
      } else if (e.shiftKey && e.key.toLowerCase() === 'a' && !mod) {
        if (selectedShape) {
          e.preventDefault();
          handleAddAutoLayout(selectedShape);
          return;
        }
      } else if (mod && e.altKey && e.key.toLowerCase() === 'k') {
        if (selectedShape) {
          e.preventDefault();
          handleCreateComponent(selectedShape);
          return;
        }
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        if (selectedShape) {
          e.preventDefault();
          handleToggleVisibility(selectedShape.id);
          return;
        }
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        if (selectedShape) {
          e.preventDefault();
          handleToggleLock(selectedShape.id);
          return;
        }
      } else if (e.shiftKey && e.key.toLowerCase() === 'h' && !mod) {
        if (selectedShape) {
          e.preventDefault();
          handleFlipHorizontal(selectedShape);
          return;
        }
      } else if (e.shiftKey && e.key.toLowerCase() === 'v' && !mod) {
        if (selectedShape) {
          e.preventDefault();
          handleFlipVertical(selectedShape);
          return;
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedShape) {
          e.preventDefault();
          handleRequestDelete(selectedShape);
          return;
        }
      }

      if (!mod && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') setTool('select');
        else if (key === 'k') setTool('scale');
        else if (key === 'f') setTool('frame');
        else if (key === 's' && e.shiftKey) setTool('section');
        else if (key === 's' && !e.shiftKey) setTool('slice');
        else if (key === 'r') setTool('rect');
        else if (key === 'l' && !e.shiftKey) setTool('line');
        else if (key === 'l' && e.shiftKey) setTool('arrow');
        else if (key === 'o') setTool('ellipse');
        else if (key === 'p' && !e.shiftKey) setTool('pen');
        else if (key === 'p' && e.shiftKey) setTool('pencil');
        else if (key === 't') setTool('text');
        else if (key === 'c') setTool('comment');
        else if (key === 'y') setTool('annotation');
        else if (key === 'm' && e.shiftKey) setTool('measurement');
        else if (key === 'h') setTool('hand');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    undo,
    redo,
    readOnly,
    selectedShape,
    handleCopy,
    handlePaste,
    handlePasteToReplace,
    handleCopyProperties,
    handlePasteProperties,
    handleBringToFront,
    handleSendToBack,
    handleGroupSelection,
    handleFrameSelection,
    handleAddAutoLayout,
    handleCreateComponent,
    handleToggleVisibility,
    handleToggleLock,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRequestDelete,
  ]);

  const handleAlign = useCallback(
    (alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => {
      if (!selectedShape) return;
      // Alinha em relação ao frame/grupo pai (quando existe) ou à área visível do canvas.
      const parent = selectedShape.parentId ? shapes.find((s) => s.id === selectedShape.parentId) : null;
      const bounds = parent
        ? { x: parent.x, y: parent.y, width: parent.width, height: parent.height }
        : viewport;
      const margin = 20;
      let patch: Partial<Shape> = {};
      if (alignment === 'center-x') {
        patch = { x: Math.round(bounds.x + bounds.width / 2 - selectedShape.width / 2) };
      } else if (alignment === 'left') {
        patch = { x: Math.round(bounds.x + margin) };
      } else if (alignment === 'right') {
        patch = { x: Math.round(bounds.x + bounds.width - selectedShape.width - margin) };
      } else if (alignment === 'center-y') {
        patch = { y: Math.round(bounds.y + bounds.height / 2 - selectedShape.height / 2) };
      } else if (alignment === 'top') {
        patch = { y: Math.round(bounds.y + margin) };
      } else if (alignment === 'bottom') {
        patch = { y: Math.round(bounds.y + bounds.height - selectedShape.height - margin) };
      }
      applyShapes(
        shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s)),
        true
      );
    },
    [selectedShape, shapes, applyShapes, viewport]
  );

  const handleFocusSelection = useCallback(() => {
    if (!selectedShape) return;
    const centerX = selectedShape.x + (selectedShape.width || 0) / 2;
    const centerY = selectedShape.y + (selectedShape.height || 0) / 2;
    setViewport((prev) => ({
      ...prev,
      x: Math.round(prev.width / 2 - centerX * zoom),
      y: Math.round(prev.height / 2 - centerY * zoom),
    }));
  }, [selectedShape, zoom]);

  const handleSelectPage = useCallback(
    (pageId: string) => {
      if (pageId === selectedPageId) return;

      // 1. Salva viewport e zoom da página atual
      setPageViewports((prev) => ({
        ...prev,
        [selectedPageId]: { x: viewport.x, y: viewport.y, zoom },
      }));

      // 2. Limpa seleção atual
      setSelectedId(null);

      // 3. Restaura ou calcula viewport e zoom da nova página
      const saved = pageViewports[pageId];
      if (saved) {
        setViewport((prev) => ({ ...prev, x: saved.x, y: saved.y }));
        setZoom(saved.zoom);
      } else {
        const targetShapes = shapes.filter((s) => (s.pageId || 'page-1') === pageId);
        if (targetShapes.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          targetShapes.forEach((s) => {
            minX = Math.min(minX, s.x);
            minY = Math.min(minY, s.y);
            maxX = Math.max(maxX, s.x + (s.width || 0));
            maxY = Math.max(maxY, s.y + (s.height || 0));
          });
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const newZoom = 0.35;
          setZoom(newZoom);
          setViewport((prev) => ({
            ...prev,
            x: Math.round(prev.width / 2 - centerX * newZoom),
            y: Math.round(prev.height / 2 - centerY * newZoom),
          }));
        } else {
          setZoom(0.5);
          setViewport((prev) => ({
            ...prev,
            x: Math.round(prev.width / 2),
            y: Math.round(prev.height / 2),
          }));
        }
      }

      setSelectedPageId(pageId);
    },
    [selectedPageId, viewport, zoom, pageViewports, shapes]
  );

  const handleAddPage = useCallback(() => {
    const newId = `page-${Date.now()}`;
    const nextNum = pages.length + 1;
    const newPage: Page = {
      id: newId,
      name: `Page ${nextNum}`,
    };
    setPages((prev) => [...prev, newPage]);
    handleSelectPage(newId);
  }, [pages, handleSelectPage]);

  const handleRenamePage = useCallback((pageId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, name: clean } : p)));
  }, []);

  const handleDuplicatePage = useCallback(
    (pageId: string) => {
      const source = pages.find((p) => p.id === pageId);
      if (!source) return;
      const newId = `page-${Date.now()}`;
      const newPage: Page = {
        id: newId,
        name: `${source.name} (Copy)`,
      };
      const sourceShapes = shapes.filter((s) => (s.pageId || 'page-1') === pageId);
      const cloned = sourceShapes.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        pageId: newId,
      }));
      setPages((prev) => {
        const idx = prev.findIndex((p) => p.id === pageId);
        const next = [...prev];
        next.splice(idx + 1, 0, newPage);
        return next;
      });
      applyShapes([...shapes, ...cloned], true);
      handleSelectPage(newId);
    },
    [pages, shapes, applyShapes, handleSelectPage]
  );

  const handleRequestDeletePage = useCallback(
    (pageId: string) => {
      if (pages.length <= 1) return;
      const target = pages.find((p) => p.id === pageId);
      if (target) {
        setDeletePageTarget(target);
        setIsDeletePageModalOpen(true);
      }
    },
    [pages]
  );

  const handleConfirmDeletePage = useCallback(
    (pageId: string) => {
      if (pages.length <= 1) return;
      const remainingShapes = shapes.filter((s) => (s.pageId || 'page-1') !== pageId);
      applyShapes(remainingShapes, true);

      const idx = pages.findIndex((p) => p.id === pageId);
      const fallbackPage = pages[idx > 0 ? idx - 1 : idx + 1];

      setPages((prev) => prev.filter((p) => p.id !== pageId));

      if (selectedPageId === pageId && fallbackPage) {
        handleSelectPage(fallbackPage.id);
      }
    },
    [pages, shapes, selectedPageId, applyShapes, handleSelectPage]
  );

  const handleMoveToPage = useCallback(
    (shape: Shape, targetPageId: string) => {
      if ((shape.pageId || 'page-1') === targetPageId) return;
      const updated = shapes.map((s) => (s.id === shape.id ? { ...s, pageId: targetPageId } : s));
      applyShapes(updated, true);
      handleSelectPage(targetPageId);
      setSelectedId(shape.id);
    },
    [shapes, applyShapes, handleSelectPage]
  );

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [targetCamera, setTargetCamera] = useState<{ x: number; y: number; zoom?: number; timestamp?: number } | null>(null);

  const handlePrototypeWithAi = useCallback(
    async (prompt: string, onProgress?: (msg: string) => void) => {
      const clean = prompt.trim();
      if (!clean) return { success: false, error: 'O prompt não pode estar vazio.' };

      setIsGeneratingAi(true);
      try {
        onProgress?.(
          selectedFrame
            ? `Analisando frame "${selectedFrame.name}" e arquitetura do prompt...`
            : 'Analisando prompt e definindo estrutura de layout...'
        );

        // Breve pausa para dar feedback visual fluido e claro ao usuário
        await new Promise((resolve) => setTimeout(resolve, 350));

        onProgress?.(
          selectedFrame
            ? `Gerando alterações e componentes para "${selectedFrame.name}"...`
            : 'Criando componentes, paleta de cores e hierarquia visual...'
        );

        await new Promise((resolve) => setTimeout(resolve, 400));

        // Posiciona a tela no centro visível da viewport atual do usuário
        let placeX = Math.round(viewport.x + (viewport.width - 1440) / 2);
        let placeY = Math.round(viewport.y + (viewport.height - 900) / 2);
        if (!placeX || isNaN(placeX)) placeX = 100;
        if (!placeY || isNaN(placeY)) placeY = 100;

        onProgress?.('Renderizando elementos no canvas...');

        const { shapes: newShapes, mainFrameId, width, height } = generateAiPrototypeScreen({
          prompt: clean,
          pageId: selectedPageId,
          startX: placeX,
          startY: placeY,
          accentColor,
          isDark: isEffectiveDark,
          providerName: selectedAiProvider,
          targetFrame: selectedFrame,
        });

        if (selectedFrame) {
          // A IA modifica o frame selecionado: preserva outros shapes e substitui os filhos desse frame
          const otherShapes = activePageShapes.filter(
            (s) => s.id !== selectedFrame.id && s.parentId !== selectedFrame.id
          );
          applyActivePageShapes([...otherShapes, ...newShapes], true);
          handleSelectSingle(selectedFrame.id);

          // Anima e centraliza a câmera no frame selecionado
          const newZoom = selectedFrame.width > 1000 ? 0.48 : 0.65;
          setZoom(newZoom);
          setTargetCamera({
            x: selectedFrame.x + selectedFrame.width / 2,
            y: selectedFrame.y + selectedFrame.height / 2,
            zoom: newZoom,
            timestamp: Date.now(),
          });
        } else {
          // Adiciona ao canvas na página ativa
          applyActivePageShapes([...activePageShapes, ...newShapes], true);
          handleSelectSingle(mainFrameId);

          // Anima e centraliza a câmera na tela prototipada
          const newZoom = width > 1000 ? 0.48 : 0.65;
          setZoom(newZoom);
          setTargetCamera({
            x: placeX + width / 2,
            y: placeY + height / 2,
            zoom: newZoom,
            timestamp: Date.now(),
          });
        }

        return { success: true };
      } catch (err: any) {
        console.error('Erro ao prototipar com IA:', err);
        return {
          success: false,
          error: err?.message || 'Falha ao processar protótipo com IA. Tente novamente.',
        };
      } finally {
        setIsGeneratingAi(false);
      }
    },
    [viewport, selectedPageId, accentColor, isEffectiveDark, selectedAiProvider, applyActivePageShapes, activePageShapes, selectedFrame, handleSelectSingle]
  );

  return (
    <div
      style={{
        alignSelf: 'stretch',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'row',
        gap: 0,
        padding: 5,
        boxSizing: 'border-box',
        background: 'transparent',
        color: tokens.textPrimary,
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ===================================================================== */}
      {/* 1. COLUNA ESQUERDA: TOP HEADER (UNTITLED) + LAYERS PANEL              */}
      {/* ===================================================================== */}
      {isSidebarOpen && (
        <>
          <div
            style={{
              width: leftSidebarWidth,
              flexShrink: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            {/* Top Div em cima da div da esquerda (Projeto ativo na Header + PanelLeft toggle) */}
            <div
              style={{
                height: 44,
                flexShrink: 0,
                background: tokens.bgCard,
                borderRadius: 10,
                border: '1px solid ' + tokens.border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 70,
              }}
            >
              {/* Título & Subtítulo (Sincronizado com o Projeto selecionado na Header) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 0,
                  marginRight: 8,
                  padding: '2px 4px',
                  borderRadius: 6,
                  transition: 'background 0.15s ease',
                }}
                onClick={() => {
                  if (!isEditingTitle) setIsDocMenuOpen((prev) => !prev);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title={`Projeto ativo: ${docTitle} (${docSubtitle}) - Clique para trocar ou opções`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={docTitle}
                      autoFocus
                      onChange={(e) => setDocTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      onBlur={() => setIsEditingTitle(false)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: tokens.bgCardSecondary,
                        border: `1px solid ${accentColor}`,
                        borderRadius: 4,
                        color: tokens.textPrimary,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'Poppins', sans-serif",
                        padding: '1px 5px',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: tokens.textPrimary,
                          letterSpacing: 0.1,
                          fontFamily: "'Poppins', sans-serif",
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {docTitle}
                      </span>
                      <ChevronDown
                        size={12}
                        color={tokens.textSecondary}
                        style={{
                          flexShrink: 0,
                          transform: isDocMenuOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    color: tokens.textMuted,
                    marginTop: -1,
                    fontFamily: "'Poppins', sans-serif",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {docSubtitle}
                </span>
              </div>

              {/* Botão de alternar sidebar */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: accentColor,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Ocultar barra lateral"
              >
                <PanelLeft size={18} color={accentColor} strokeWidth={2} />
              </button>

              {/* Menu Dropdown do Arquivo / Projeto */}
              {isDocMenuOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 90,
                    }}
                    onClick={() => setIsDocMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 6,
                      marginTop: 6,
                      background: tokens.bgCardElevated,
                      border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                      borderRadius: 8,
                      boxShadow: isEffectiveDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
                      padding: '4px 0',
                      minWidth: 220,
                      zIndex: 100,
                    }}
                  >
                    {/* Seletor Rápido de Projetos Disponíveis */}
                    {availableProjects && availableProjects.length > 0 && onSelectWorkspace && (
                      <>
                        <div
                          style={{
                            padding: '6px 12px 4px 12px',
                            fontSize: 10,
                            fontWeight: 600,
                            color: tokens.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Projetos
                        </div>
                        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                          {availableProjects.map((proj) => {
                            const isSelected =
                              proj.name.toLowerCase() === docTitle.toLowerCase() ||
                              (proj.localDir && workspacePath && proj.localDir.toLowerCase() === workspacePath.toLowerCase());
                            return (
                              <div
                                key={proj.id}
                                onClick={async () => {
                                  setIsDocMenuOpen(false);
                                  if (proj.localDir) {
                                    await onSelectWorkspace(proj.localDir, proj.name);
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  fontFamily: "'Poppins', sans-serif",
                                  color: isSelected ? accentColor : tokens.textPrimary,
                                  background: isSelected ? `${accentColor}12` : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = tokens.hoverBg;
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                  <FolderGit2 size={12} color={isSelected ? accentColor : tokens.textSecondary} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {proj.name}
                                  </span>
                                </div>
                                {isSelected && <Check size={12} color={accentColor} />}
                              </div>
                            );
                          })}
                        </div>
                        <div
                          style={{
                            height: 1,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                            margin: '4px 0',
                          }}
                        />
                      </>
                    )}

                    <div
                      onClick={() => {
                        setIsEditingTitle(true);
                        setIsDocMenuOpen(false);
                      }}
                      style={{
                        padding: '7px 12px',
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: tokens.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Edit2 size={13} color={tokens.textSecondary} />
                      <span>Renomear</span>
                    </div>
                    <div
                      onClick={() => {
                        const cloned = activePageShapes.map((s) => ({
                          ...s,
                          id: crypto.randomUUID(),
                          x: s.x + 30,
                          y: s.y + 30,
                          pageId: selectedPageId,
                        }));
                        applyActivePageShapes([...activePageShapes, ...cloned], true);
                        setIsDocMenuOpen(false);
                      }}
                      style={{
                        padding: '7px 12px',
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: tokens.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Copy size={13} color={tokens.textSecondary} />
                      <span>Duplicar elementos</span>
                    </div>
                    <div
                      onClick={() => {
                        const dataStr =
                          'data:text/json;charset=utf-8,' +
                          encodeURIComponent(
                            JSON.stringify(
                              {
                                pages,
                                selectedPageId,
                                shapes,
                                pageViewports,
                              },
                              null,
                              2
                            )
                          );
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute('href', dataStr);
                        downloadAnchor.setAttribute('download', `${docTitle || 'design'}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                        setIsDocMenuOpen(false);
                      }}
                      style={{
                        padding: '7px 12px',
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: tokens.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Download size={13} color={tokens.textSecondary} />
                      <span>Exportar JSON</span>
                    </div>
                    <div
                      onClick={() => setIsDocMenuOpen(false)}
                      style={{
                        padding: '7px 12px',
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: tokens.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <History size={13} color={tokens.textSecondary} />
                      <span>Histórico de versões</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Layers Panel */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: 10,
                overflow: 'hidden',
                background: tokens.bgCard,
                border: '1px solid ' + tokens.border,
              }}
            >
              <LayersPanel
                shapes={activePageShapes}
                selectedId={selectedId}
                selectedIds={selectedIds}
                readOnly={readOnly}
                themeTokens={tokens}
                accentColor={accentColor}
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={handleSelectPage}
                onAddPage={handleAddPage}
                onRenamePage={handleRenamePage}
                onDuplicatePage={handleDuplicatePage}
                onDeletePage={handleRequestDeletePage}
                onSelect={handleSelectSingle}
                onToggleVisibility={handleToggleVisibility}
                onToggleLock={handleToggleLock}
                onDelete={(id) => {
                  const s = shapes.find((item) => item.id === id);
                  if (s) handleRequestDelete(s);
                }}
                onContextMenuShape={(shape, cx, cy) => {
                  handleSelectSingle(shape.id);
                  setContextMenu({ isOpen: true, x: cx, y: cy, shape });
                }}
              />
            </div>
          </div>

          {/* Resizer Coluna Esquerda (Estilo IDE) */}
          <div
            className={`resizer-col ${isDraggingLeft ? 'dragging' : ''}`}
            onMouseDown={startResizeLeft}
            onDoubleClick={() => {
              setLeftSidebarWidth(250);
              localStorage.setItem('design_left_sidebar_width', '250');
            }}
            title="Arraste para redimensionar (Duplo clique para restaurar 250px)"
            style={{
              '--accent-color': accentColor,
            } as React.CSSProperties}
          />
        </>
      )}

      {/* ===================================================================== */}
      {/* 2. CANVAS CENTRAL (FULL HEIGHT ENTRE AS DUAS COLUNAS)                 */}
      {/* ===================================================================== */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 10,
          background: tokens.bgCard,
          border: '1px solid ' + tokens.border,
          pointerEvents: isDraggingLeft || isDraggingRight ? 'none' : 'auto',
        }}
      >
        {/* Se a barra lateral estiver fechada, botão flutuante para reabrir */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: tokens.bgCardElevated,
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              borderRadius: 6,
              color: tokens.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              zIndex: 40,
              boxShadow: isEffectiveDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
            }}
            title="Mostrar barra lateral"
          >
            <PanelLeft size={15} />
          </button>
        )}

        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.textMuted,
              fontSize: 12,
              fontFamily: "'Poppins', sans-serif",
              zIndex: 20,
              background: tokens.bgCardSecondary,
            }}
          >
            Carregando desenho do projeto…
          </div>
        )}

        <DesignCanvas
          shapes={activePageShapes}
          selectedId={selectedId}
          selectedIds={selectedIds}
          tool={readOnly ? 'select' : tool}
          readOnly={readOnly}
          accentColor={accentColor}
          bgCanvas={tokens.bgCardSecondary}
          zoom={zoom}
          onZoomChange={setZoom}
          onViewportChange={setViewport}
          targetCamera={targetCamera}
          onSelect={handleSelectSingle}
          onSelectMultiple={handleSelectMultiple}
          onShapesChange={applyActivePageShapes}
          onToolUsed={() => setTool('select')}
          onContextMenuShape={(shape, cx, cy) => {
            handleSelectSingle(shape.id);
            setContextMenu({ isOpen: true, x: cx, y: cy, shape });
          }}
          onContextMenuCanvas={(cx, cy) => {
            setContextMenu({ isOpen: true, x: cx, y: cy, shape: null });
          }}
        />

        {/* Toolbar Flutuante Inferior com Dropdowns e Div de IA */}
        <DesignToolbar
          tool={readOnly ? 'select' : tool}
          onSelectTool={setTool}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={tokens}
          onInsertImage={handleInsertImage}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          onSelectAiProvider={onSelectAiProvider}
          onSelectModel={onSelectModel}
          installedClis={installedClis}
          activeModels={activeModels}
          onInstallAiCli={onInstallAiCli}
          onPrototypeWithAi={handlePrototypeWithAi}
          isGeneratingAi={isGeneratingAi}
          selectedFrame={selectedFrame}
        />

        {/* ================================================================= */}
        {/* FIGMA COLOR PICKER FLUTUANTE E ARRASTÁVEL DENTRO DA DIV DO CENTRO */}
        {/* ================================================================= */}
        {activeColorPicker && selectedShape && (() => {
          const fills = (selectedShape.fills && selectedShape.fills.length > 0)
            ? selectedShape.fills
            : [{ id: 'default-fill', color: selectedShape.fill || '#D9D9D9', opacity: selectedShape.opacity ?? 1, visible: true, type: 'solid' }];
          const strokes = (selectedShape.strokes && selectedShape.strokes.length > 0)
            ? selectedShape.strokes
            : [{ id: 'default-stroke', color: selectedShape.stroke || '#000000', opacity: 1, visible: true }];

          const isAllFills = activeColorPicker.target === 'fill' && activeColorPicker.id === 'all';
          const isAllStrokes = activeColorPicker.target === 'stroke' && activeColorPicker.id === 'all';

          const activeFillItem = activeColorPicker.target === 'fill'
            ? (isAllFills ? fills[0] : (fills.find((f) => f.id === activeColorPicker.id) || fills[0]))
            : null;
          const activeStrokeItem = activeColorPicker.target === 'stroke'
            ? (isAllStrokes ? strokes[0] : (strokes.find((s) => s.id === activeColorPicker.id) || strokes[0]))
            : null;

          const currentColor = activeColorPicker.target === 'fill'
            ? activeFillItem?.color || selectedShape.fill || '#D9D9D9'
            : activeStrokeItem?.color || selectedShape.stroke || '#000000';
          const currentOpacity = activeColorPicker.target === 'fill'
            ? activeFillItem?.opacity ?? 1
            : activeStrokeItem?.opacity ?? 1;

          return (
            <FigmaColorPicker
              color={currentColor}
              opacity={currentOpacity}
              themeTokens={tokens}
              accentColor={accentColor}
              onChange={(newColor, newOpacity) => {
                if (activeColorPicker.target === 'fill') {
                  const updatedFills = isAllFills
                    ? fills.map((f) => ({ ...f, color: newColor, opacity: newOpacity }))
                    : fills.map((f) =>
                      f.id === activeColorPicker.id || (!fills.some((x) => x.id === activeColorPicker.id) && f === fills[0])
                        ? { ...f, color: newColor, opacity: newOpacity }
                        : f
                    );
                  applyShapes(
                    shapes.map((s) =>
                      s.id === selectedShape.id
                        ? { ...s, fill: newColor, opacity: newOpacity, fills: updatedFills }
                        : s
                    ),
                    false
                  );
                } else {
                  const updatedStrokes = isAllStrokes
                    ? strokes.map((s) => ({ ...s, color: newColor, opacity: newOpacity }))
                    : strokes.map((s) =>
                      s.id === activeColorPicker.id || (!strokes.some((x) => x.id === activeColorPicker.id) && s === strokes[0])
                        ? { ...s, color: newColor, opacity: newOpacity }
                        : s
                    );
                  applyShapes(
                    shapes.map((s) =>
                      s.id === selectedShape.id
                        ? { ...s, stroke: newColor, strokes: updatedStrokes }
                        : s
                    ),
                    false
                  );
                }
              }}
              onClose={() => setActiveColorPicker(null)}
            />
          );
        })()}

        {/* ================================================================= */}
        {/* FIGMA STROKE SETTINGS FLUTUANTE                                   */}
        {/* ================================================================= */}
        {isStrokeSettingsOpen && selectedShape && (
          <FigmaStrokeSettingsModal
            shape={selectedShape}
            themeTokens={tokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            onChange={(patch) => {
              applyShapes(
                shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s)),
                true
              );
            }}
            onClose={() => setIsStrokeSettingsOpen(false)}
          />
        )}

        {/* ================================================================= */}
        {/* FIGMA TYPE SETTINGS FLUTUANTE                                     */}
        {/* ================================================================= */}
        {isTypeSettingsOpen && selectedShape && (selectedShape.type === 'text' || selectedShape.type === 'text-path') && (
          <FigmaTypeSettingsModal
            shape={selectedShape}
            themeTokens={tokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            onChange={(patch) => {
              applyShapes(
                shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s)),
                true
              );
            }}
            onClose={() => setIsTypeSettingsOpen(false)}
          />
        )}

        {/* ================================================================= */}
        {/* FIGMA EFFECT SETTINGS FLUTUANTE DENTRO DA DIV DO CENTRO           */}
        {/* ================================================================= */}
        {activeEffectId && selectedShape && selectedShape.effects?.some((e) => e.id === activeEffectId) && (
          <FigmaEffectSettingsModal
            effect={selectedShape.effects.find((e) => e.id === activeEffectId)!}
            themeTokens={tokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            onUpdate={(patch) => {
              applyShapes(
                shapes.map((s) =>
                  s.id === selectedShape.id
                    ? {
                        ...s,
                        effects: (s.effects || []).map((e) =>
                          e.id === activeEffectId ? { ...e, ...patch } : e
                        ),
                      }
                    : s
                ),
                true
              );
            }}
            onClose={() => setActiveEffectId(null)}
          />
        )}

        {/* Botão de Ajuda '?' Inferior Direito */}
        <button
          type="button"
          style={{
            position: 'absolute',
            bottom: 18,
            right: 18,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: tokens.bgCardElevated,
            border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            color: tokens.textSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isEffectiveDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            zIndex: 50,
          }}
          title="Ajuda e atalhos do teclado"
        >
          ?
        </button>
      </div>

      {/* Resizer Coluna Direita (Estilo IDE) */}
      <div
        className={`resizer-col ${isDraggingRight ? 'dragging' : ''}`}
        onMouseDown={startResizeRight}
        onDoubleClick={() => {
          setRightSidebarWidth(300);
          localStorage.setItem('design_right_sidebar_width', '300');
        }}
        title="Arraste para redimensionar (Duplo clique para restaurar 300px)"
        style={{
          '--accent-color': accentColor,
        } as React.CSSProperties}
      />

      {/* ===================================================================== */}
      {/* 3. COLUNA DIREITA: TOP ACTIONS CARD + PROPERTIES INSPECTOR PANEL      */}
      {/* ===================================================================== */}
      <div
        style={{
          width: rightSidebarWidth,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {/* Top Div em cima da div da direita (Avatares dos Usuários na Sala, Share, Zoom) */}
        <div
          style={{
            height: 44,
            flexShrink: 0,
            background: tokens.bgCard,
            borderRadius: 10,
            border: '1px solid ' + tokens.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            boxSizing: 'border-box',
            zIndex: 60,
          }}
        >
          {/* 1. Avatares dos Usuários Conectados na Sala */}
          <div
            onClick={() => setIsShareModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            title={
              room.role === 'hosting'
                ? `Você (Host) + ${room.viewerCount} usuário(s) conectado(s)`
                : room.role === 'viewing'
                  ? `Conectado à sala de ${room.hostedRoom?.name || 'colega'}`
                  : 'Você (Clique para abrir ou compartilhar sala LAN)'
            }
          >
            {/* Avatar do Usuário Atual (Local) */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                border: `2px solid ${tokens.bgCard}`,
                boxShadow: isEffectiveDark ? '0 0 0 1px rgba(255,255,255,0.1)' : '0 0 0 1px rgba(0,0,0,0.1)',
                zIndex: 3,
                position: 'relative',
              }}
            >
              W
              {/* Indicador de status online */}
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: `1.5px solid ${tokens.bgCard}`,
                }}
              />
            </div>

            {/* Avatares dos Usuários na Sala (se houver espectadores conectados) */}
            {room.role === 'hosting' && room.viewerCount > 0 && (
              <>
                {Array.from({ length: Math.min(room.viewerCount, 2) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background:
                        i === 0
                          ? 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
                          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                      marginLeft: -8,
                      border: `2px solid ${tokens.bgCard}`,
                      boxShadow: isEffectiveDark ? '0 0 0 1px rgba(255,255,255,0.1)' : '0 0 0 1px rgba(0,0,0,0.1)',
                      zIndex: 2 - i,
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
                {room.viewerCount > 2 && (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: tokens.bgCardSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      color: tokens.textSecondary,
                      marginLeft: -8,
                      border: `2px solid ${tokens.bgCard}`,
                      zIndex: 0,
                    }}
                  >
                    +{room.viewerCount - 2}
                  </div>
                )}
              </>
            )}

            {/* Se estiver participando da sala de outro usuário */}
            {room.role === 'viewing' && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  marginLeft: -8,
                  border: `2px solid ${tokens.bgCard}`,
                  zIndex: 2,
                }}
                title={`Host: ${room.hostedRoom?.name || 'Colega'}`}
              >
                H
              </div>
            )}
          </div>

          {/* 2. Grupo da Direita: Botão Share + Seletor de Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Botão Share */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              style={{
                background: accentColor,
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                padding: '4px 14px',
                height: 28,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s ease',
                boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              title="Compartilhar projeto via LAN"
            >
              Share
            </button>

            {/* Seletor de Zoom */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsZoomMenuOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'transparent',
                  border: 'none',
                  color: tokens.textPrimary,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 500,
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Ajustar zoom"
              >
                <span>{`${Math.round(zoom * 100)}%`}</span>
                <ChevronDown size={11} color={tokens.textSecondary} />
              </button>

              {isZoomMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: tokens.bgCardElevated,
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    borderRadius: 8,
                    boxShadow: isEffectiveDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
                    padding: '4px 0',
                    minWidth: 90,
                    zIndex: 100,
                  }}
                >
                  {[
                    { label: '21%', val: 0.21 },
                    { label: '50%', val: 0.5 },
                    { label: '100%', val: 1.0 },
                    { label: '200%', val: 2.0 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      onClick={() => {
                        setZoom(item.val);
                        setIsZoomMenuOpen(false);
                      }}
                      style={{
                        padding: '5px 12px',
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: Math.round(zoom * 100) === Math.round(item.val * 100) ? accentColor : tokens.textPrimary,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Properties Panel (Abaixo da top div) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 10,
            overflow: 'hidden',
            background: tokens.bgCard,
            border: '1px solid ' + tokens.border,
          }}
        >
          <PropertiesPanel
            shape={selectedShape}
            themeTokens={tokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            onChange={(patch) =>
              selectedShape &&
              applyShapes(
                shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s)),
                true
              )
            }
            onAlign={handleAlign}
            onFocusSelection={handleFocusSelection}
            activeColorPicker={activeColorPicker}
            onActiveColorPickerChange={setActiveColorPicker}
            isStrokeSettingsOpen={isStrokeSettingsOpen}
            onStrokeSettingsOpenChange={setIsStrokeSettingsOpen}
            activeEffectId={activeEffectId}
            onActiveEffectIdChange={setActiveEffectId}
            isTypeSettingsOpen={isTypeSettingsOpen}
            onTypeSettingsOpenChange={setIsTypeSettingsOpen}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE COMPARTILHAMENTO / LAN ROOM                                  */}
      {/* ===================================================================== */}
      {isShareModalOpen && (
        <div
          onClick={() => setIsShareModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: tokens.bgCardElevated,
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: 10,
              width: 440,
              maxWidth: '90vw',
              boxShadow: isEffectiveDark ? '0 16px 40px rgba(0,0,0,0.7)' : '0 16px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary }}>
                Compartilhar no Figma LAN
              </span>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: tokens.textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <RoomPanel
                role={room.role}
                hostedRoom={room.hostedRoom}
                viewerCount={room.viewerCount}
                availableRooms={room.availableRooms}
                isBrowsing={room.isBrowsing}
                accentColor={accentColor}
                themeTokens={tokens}
                onHost={(name) => room.hostRoom(name, shapes)}
                onStopHosting={room.stopHosting}
                onStartBrowsing={room.startBrowsing}
                onStopBrowsing={room.stopBrowsing}
                onJoin={room.joinRoom}
                onLeave={room.leaveRoom}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MENU DE CONTEXTO FIGMA (BOTÃO DIREITO EM ELEMENTO OU CANVAS)          */}
      {/* ===================================================================== */}
      <FigmaContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        targetShape={contextMenu.shape || selectedShape}
        shapes={shapes}
        pages={pages}
        clipboardShape={clipboardShape}
        copiedProperties={copiedProperties}
        themeTokens={tokens}
        accentColor={accentColor}
        isEffectiveDark={isEffectiveDark}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onPasteToReplace={handlePasteToReplace}
        onCopyAs={handleCopyAs}
        onCopyProperties={handleCopyProperties}
        onPasteProperties={handlePasteProperties}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onGroupSelection={handleGroupSelection}
        onFrameSelection={handleFrameSelection}
        onFlatten={handleFlatten}
        onOutlineStroke={handleOutlineStroke}
        onToggleMask={handleToggleMask}
        onAddAutoLayout={handleAddAutoLayout}
        onCreateComponent={handleCreateComponent}
        onToggleVisibility={(shape) => handleToggleVisibility(shape.id)}
        onToggleLock={(shape) => handleToggleLock(shape.id)}
        onFlipHorizontal={handleFlipHorizontal}
        onFlipVertical={handleFlipVertical}
        onMoveToPage={handleMoveToPage}
        onSelectAll={handleSelectAll}
        onRequestDelete={handleRequestDelete}
      />

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (REGRA AGENTS.MD)                    */}
      {/* ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="Excluir Elemento"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name || 'este elemento'}" do projeto? Esta ação não pode ser desfeita.`}
        itemDescription={
          deleteTarget
            ? `${deleteTarget.type.toUpperCase()} • ${Math.round(deleteTarget.width)} × ${Math.round(deleteTarget.height)}px`
            : undefined
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        themeTokens={tokens}
        accentColor={accentColor}
        onConfirm={() => {
          if (deleteTarget) {
            applyShapes(shapes.filter((s) => s.id !== deleteTarget.id), true);
            if (selectedId === deleteTarget.id) setSelectedId(null);
          }
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
      />
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PÁGINA (REGRA AGENTS.MD)         */}
      {/* ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={isDeletePageModalOpen}
        title="Excluir Página"
        message={`Tem certeza que deseja excluir "${deletePageTarget?.name || 'esta página'}" e todas as suas camadas? Esta ação não pode ser desfeita.`}
        itemDescription={
          deletePageTarget
            ? `Página • ${shapes.filter((s) => (s.pageId || 'page-1') === deletePageTarget.id).length} camadas associadas`
            : undefined
        }
        confirmLabel="Excluir Página"
        cancelLabel="Cancelar"
        themeTokens={tokens}
        accentColor={accentColor}
        onConfirm={() => {
          if (deletePageTarget && pages.length > 1) {
            handleConfirmDeletePage(deletePageTarget.id);
          }
          setIsDeletePageModalOpen(false);
          setDeletePageTarget(null);
        }}
        onClose={() => {
          setIsDeletePageModalOpen(false);
          setDeletePageTarget(null);
        }}
      />
    </div>
  );
}

