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
import type { Shape, Page, ToolId, ExportItem, FillItem, DesignStyle, DesignVariable, DesignMode } from './types';
import { applyVariables, createColorVariable, DEFAULT_MODES } from './variables';

type VariablesList = DesignVariable[];
import { applyStyles, colorStyleFromShape, textStyleFromShape } from './styles';
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
import FigmaImportModal from './FigmaImportModal';
import IconPickerModal from './IconPickerModal';
import { descendantIds } from './constraints';
import { iconShape, loadIcons } from './icons';
import { applyAiEdits, buildAiEditPrompt, editScope } from './aiEdit';
import { AiJsonStream, type AiStreamEvent } from './aiJsonStream';
import { buildProjectDigest } from './projectDigest';
import { fetchStockImage } from './stockImage';
import { findFreeSpot } from './freeSpot';
import FramesPopup from './FramesPopup';
import ProposalPopup from './ProposalPopup';
import { buildProposalHtml, buildProposalPrompt, collectFrameContext, parseProposal } from './proposal';
import UnsplashKeyPopup from './UnsplashKeyPopup';
import { buildDevicePreset } from './devices';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { getActiveBrainContextSync, generateBrainAiContext } from '../../utils/brainService';
import { buildAiScreenPrompt, parseAiScreenResponse, requestAiScreenRaw, ScreenBuilder } from './aiScreenFromLlm';
import { downloadBlob, exportShape } from './exportDesign';
import { alignDeltas, applyDeltas, distributeDeltas, type AlignMode } from './align';
import { unionBox } from './snap';
import { addAutoLayout, relayoutAll } from './autoLayout';
import { createInstance, detachInstance, switchVariant, syncInstances, variantsOf } from './components';
import { duplicateShapes } from './duplicate';
import { generateCode, componentName, type CodeTarget } from './codegen';
import PrototypePlayer from './PrototypePlayer';
import type { RulerGuide } from './rulers';
import { deleteVersion, listVersions, loadVersion, saveVersion, type VersionEntry } from './versions';
import { booleanShapes, flattenShape, type BooleanOp } from './booleanOps';

interface DesignStudioViewProps {
  /** false quando a aba de Design está escondida (continua montada para a IA terminar de gerar) */
  isActive?: boolean;
  /** A IA terminou (ou falhou): o App avisa se o usuário estiver em outra tela */
  onAiTaskDone?: (r: { ok: boolean; message: string }) => void;
  workspacePath: string;
  repoName?: string;
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models?: Array<{ id: string; label: string }> }>;
  onInstallAiCli?: (provider: any) => void;
  onToast?: (message: string) => void;
  /** Manda um texto para o chat de IA do projeto (abre a IDE com o prompt preenchido) */
  onSendToChat?: (text: string) => void;
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
  onToast,
  isActive = true,
  onAiTaskDone,
  onSendToChat,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  // Modo apresentação do protótipo
  const [presentFrameId, setPresentFrameId] = useState<string | null>(null);
  // Código do design (React / HTML / Flutter)
  const [codeShape, setCodeShape] = useState<Shape | null>(null);
  const [codeTarget, setCodeTarget] = useState<CodeTarget>('react');
  // Histórico de versões do design (arquivos em .devflow/design2/versions)
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const [isFigmaImportOpen, setIsFigmaImportOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isFramesOpen, setIsFramesOpen] = useState(false);
  const [isUnsplashOpen, setIsUnsplashOpen] = useState(false);
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  // Variáveis de cor com modos (Claro/Escuro), salvas junto com o design
  const [variables, setVariables] = useState<DesignVariable[]>([]);
  const [modes, setModes] = useState<DesignMode[]>(DEFAULT_MODES);
  const [activeModeId, setActiveModeId] = useState<string>('light');
  const variablesRef = useRef({ list: variables, modeId: activeModeId });
  variablesRef.current = { list: variables, modeId: activeModeId };
  // Estilos do documento (cor e texto), salvos junto com o design
  const [styles, setStyles] = useState<DesignStyle[]>([]);
  const stylesRef = useRef<DesignStyle[]>(styles);
  stylesRef.current = styles;
  // Colaboração: nome exibido no cursor e limitador de envio
  const lastCursorSendRef = useRef(0);
  const myCursorName = useMemo(() => (workspacePath ? workspacePath.split('/').filter(Boolean).pop() || 'Você' : 'Você').slice(0, 14), [workspacePath]);
  // Visualização: grade, réguas e encaixe inteligente (preferências salvas)
  const [viewPrefs, setViewPrefs] = useState<{ grid: boolean; rulers: boolean; snap: boolean; guides: boolean; rulerRelative: boolean }>(() => {
    const base = { grid: false, rulers: false, snap: true, guides: true, rulerRelative: true };
    try { return { ...base, ...JSON.parse(localStorage.getItem('design_view_prefs') || '{}') }; } catch { return base; }
  });
  // Guias arrastadas das réguas, por página (salvas no documento)
  const [guidesByPage, setGuidesByPage] = useState<Record<string, RulerGuide[]>>({});
  const toggleViewPref = useCallback((key: 'grid' | 'rulers' | 'snap' | 'guides' | 'rulerRelative') => {
    setViewPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('design_view_prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
  // Participante só fica somente-leitura se o anfitrião não permitiu edição
  const readOnly = room.role === 'viewing' && !room.canEdit;

  const {
    loadedShapes,
    loadedPages,
    loadedSelectedPageId,
    loadedPageViewports,
    loadedStyles,
    loadedVariables,
    loadedGuides,
    isLoading,
  } = usePersistedDesign(workspacePath, shapes, pages, selectedPageId, pageViewports, readOnly, styles, { list: variables, modes, activeModeId }, guidesByPage);

  useEffect(() => {
    if (loadedGuides) setGuidesByPage(loadedGuides);
  }, [loadedGuides]);

  useEffect(() => {
    if (loadedVariables) {
      variablesRef.current = { list: loadedVariables.list, modeId: loadedVariables.activeModeId };
      setVariables(loadedVariables.list);
      if (loadedVariables.modes?.length) setModes(loadedVariables.modes);
      setActiveModeId(loadedVariables.activeModeId || 'light');
    }
  }, [loadedVariables]);

  useEffect(() => {
    if (loadedStyles) {
      stylesRef.current = loadedStyles;
      setStyles(loadedStyles);
    }
  }, [loadedStyles]);

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
        // Ao confirmar a mudança, frames com auto layout reorganizam os filhos (e fazem hug)
        const combined = [...otherPageShapes, ...(commit ? relayoutAll(syncInstances(applyVariables(applyStyles(tagged, stylesRef.current), variablesRef.current.list, variablesRef.current.modeId))) : tagged)];
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
    (rawNext: Shape[], commit: boolean) => {
      const next = commit ? relayoutAll(syncInstances(applyVariables(applyStyles(rawNext, stylesRef.current), variablesRef.current.list, variablesRef.current.modeId))) : rawNext;
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
    (file: File, at?: { x: number; y: number }) => {
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
            x: Math.round((at ? at.x : viewport.x + viewport.width / 2) - w / 2),
            y: Math.round((at ? at.y : viewport.y + viewport.height / 2) - h / 2),
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

  // Última versão do inserir-imagem (soltar vários arquivos precisa enxergar o estado já atualizado)
  const insertImageRef = useRef(handleInsertImage);
  insertImageRef.current = handleInsertImage;

  const handlePaste = useCallback(async (coords?: { x: number; y: number }) => {
    // Imagem na área de transferência (print ou imagem copiada) vira um shape de imagem
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          handleInsertImage(new File([blob], 'Imagem colada', { type }));
          return;
        }
      }
    } catch {}
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
  }, [clipboardShape, shapes, activePageShapes, selectedPageId, zoom, applyActivePageShapes, handleInsertImage]);

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

  // Exporta o shape (e descendentes) em cada formato/escala configurado no painel; sem configuração, PNG 1x
  const handleExportShape = useCallback(
    async (shape: Shape, items: ExportItem[]) => {
      const list: ExportItem[] = items.length > 0 ? items : [{ id: 'default', format: 'PNG', scale: '1x' }];
      try {
        for (const item of list) {
          const { blob, filename } = await exportShape(activePageShapes, shape, item);
          downloadBlob(blob, filename);
        }
        onToast?.(list.length === 1 ? 'Arquivo exportado' : `${list.length} arquivos exportados`);
      } catch (err: any) {
        onToast?.(`Erro ao exportar: ${err?.message || 'falha inesperada'}`);
      }
    },
    [activePageShapes, onToast]
  );

  const handleToggleMask = useCallback((shape: Shape) => {
    applyShapes(
      shapes.map((s) => (s.id === shape.id ? { ...s, isMask: !s.isMask } : s)),
      true
    );
  }, [shapes, applyShapes]);

  const handleAddAutoLayout = useCallback((shape: Shape) => {
    const ids = selectedIds.includes(shape.id) && selectedIds.length > 0 ? selectedIds : [shape.id];
    const res = addAutoLayout(shapes, ids, () => `frame-${crypto.randomUUID().slice(0, 6)}`);
    if (!res) return;
    applyShapes(res.shapes, true);
    handleSelectSingle(res.selectId);
  }, [shapes, selectedIds, applyShapes, handleSelectSingle]);

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
    const visible = activePageShapes.filter((s) => s.visible !== false && !s.locked);
    if (visible.length === 0) return;
    setSelectedIds(visible.map((s) => s.id));
    setSelectedId(visible[visible.length - 1].id);
  }, [activePageShapes]);

  // Duplicar seleção (Cmd/Ctrl+D): copia com filhos, desloca 20px e seleciona as cópias
  const handleDuplicate = useCallback(() => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
    if (ids.length === 0) return;
    const { shapes: copies, newRootIds } = duplicateShapes(shapes, ids);
    if (copies.length === 0) return;
    applyShapes([...shapes, ...copies], true);
    setSelectedIds(newRootIds);
    setSelectedId(newRootIds[0]);
  }, [selectedIds, selectedShape, shapes, applyShapes]);

  // Enquadrar a câmera numa área (Shift+1 tudo, Shift+2 seleção)
  const fitCameraTo = useCallback(
    (box: { x: number; y: number; width: number; height: number }) => {
      const pxW = Math.max(1, viewport.width * zoom);
      const pxH = Math.max(1, viewport.height * zoom);
      const next = Math.min(3, Math.max(0.02, Math.min(pxW / Math.max(1, box.width), pxH / Math.max(1, box.height)) * 0.85));
      setZoom(Number(next.toFixed(3)));
      setTargetCamera({ x: box.x + box.width / 2, y: box.y + box.height / 2, zoom: Number(next.toFixed(3)), timestamp: Date.now() });
    },
    [viewport, zoom]
  );

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
      if (readOnly || !isActiveRef.current) return;
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

      // Booleanas (Alt+Shift+U/S/I/E) e Flatten (Alt+Shift+F)
      if (e.altKey && e.shiftKey && !mod) {
        const boolMap: Record<string, BooleanOp | 'flatten'> = { KeyU: 'union', KeyS: 'subtract', KeyI: 'intersect', KeyE: 'exclude', KeyF: 'flatten' };
        if (boolMap[e.code]) {
          e.preventDefault();
          keyActionsRef.current.handleBoolean(boolMap[e.code]);
          return;
        }
      }

      // Alinhar (Alt + A/D/W/S/V/H) e distribuir (Alt+Shift+H/V), como no Figma
      if (e.altKey && !mod) {
        const key = e.code;
        const map: Record<string, AlignMode> = { KeyA: 'left', KeyD: 'right', KeyW: 'top', KeyS: 'bottom', KeyH: 'center-x', KeyV: 'center-y' };
        if (e.shiftKey && (key === 'KeyH' || key === 'KeyV')) {
          e.preventDefault();
          keyActionsRef.current.handleDistribute(key === 'KeyH' ? 'x' : 'y');
          return;
        }
        if (!e.shiftKey && map[key]) {
          e.preventDefault();
          keyActionsRef.current.handleAlign(map[key]);
          return;
        }
      }

      // Visualização: Cmd/Ctrl+' grade, Cmd/Ctrl+; guias, Shift+R réguas
      if (mod && e.key === ';' && !e.shiftKey) {
        e.preventDefault();
        toggleViewPref('guides');
        return;
      }
      if (mod && e.key === "'") {
        e.preventDefault();
        toggleViewPref('grid');
        return;
      } else if (!mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        toggleViewPref('rulers');
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

      // Duplicar, selecionar tudo, nudge com setas, Esc e zoom (Shift+0/1/2)
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (e.key === 'Escape') {
        setTool('select');
        setSelectedIds([]);
        setSelectedId(null);
        return;
      }
      if (!mod && e.key.startsWith('Arrow') && selectedIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const d = { dx: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0 };
        applyShapes(applyDeltas(shapes, new Map(selectedIds.map((id) => [id, d] as const))), true);
        return;
      }
      if (!mod && e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        setZoom(1);
        return;
      }
      if (!mod && e.shiftKey && e.code === 'Digit1' && activePageShapes.length > 0) {
        e.preventDefault();
        fitCameraTo(unionBox(activePageShapes.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }))));
        return;
      }
      if (!mod && e.shiftKey && e.code === 'Digit2') {
        const sel = activePageShapes.filter((s) => selectedIds.includes(s.id));
        if (sel.length > 0) {
          e.preventDefault();
          fitCameraTo(unionBox(sel.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height }))));
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
    handleDuplicate,
    handleSelectAll,
    fitCameraTo,
    toggleViewPref,
    selectedIds,
    shapes,
    applyShapes,
    activePageShapes,
  ]);

  // Alinha a seleção: com 2+ shapes, à própria seleção; com 1, ao pai (ou à área visível). Filhos acompanham.
  const handleAlign = useCallback(
    (alignment: AlignMode) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      const targets = activePageShapes.filter((s) => ids.includes(s.id));
      if (targets.length === 0) return;
      let ref: { x: number; y: number; width: number; height: number };
      let margin = 0;
      if (targets.length > 1) {
        ref = unionBox(targets.map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height })));
      } else {
        const parent = targets[0].parentId ? shapes.find((s) => s.id === targets[0].parentId) : null;
        ref = parent ? { x: parent.x, y: parent.y, width: parent.width, height: parent.height } : viewport;
        margin = 20;
      }
      applyShapes(applyDeltas(shapes, alignDeltas(shapes, ids, alignment, ref, margin)), true);
    },
    [selectedIds, selectedShape, activePageShapes, shapes, applyShapes, viewport]
  );

  // Operações booleanas entre 2+ formas fechadas (o resultado é um caminho; os originais saem do canvas) e Flatten
  const handleBoolean = useCallback(
    (op: BooleanOp | 'flatten') => {
      const targets = shapes.filter((s) => selectedIds.includes(s.id)).sort((a, b) => a.zIndex - b.zIndex);
      if (op === 'flatten') {
        if (targets.length === 0) return;
        const flats = targets.map((t) => flattenShape(t, crypto.randomUUID()));
        if (flats.some((f) => !f)) {
          onToast?.('Só formas fechadas (retângulo, elipse, polígono, estrela) podem ser achatadas');
          return;
        }
        const ids = new Set(targets.map((t) => t.id));
        applyShapes([...shapes.filter((s) => !ids.has(s.id)), ...(flats as Shape[])], true);
        setSelectedId((flats[0] as Shape).id);
        return;
      }
      if (targets.length < 2) {
        onToast?.('Selecione 2 ou mais elementos para a operação booleana');
        return;
      }
      const result = booleanShapes(targets, op, crypto.randomUUID());
      if (!result) {
        onToast?.('Resultado vazio ou formas não suportadas (use formas fechadas que se sobreponham)');
        return;
      }
      const ids = new Set(targets.map((t) => t.id));
      applyShapes([...shapes.filter((s) => !ids.has(s.id)), result], true);
      setSelectedIds([result.id]);
      setSelectedId(result.id);
    },
    [shapes, selectedIds, applyShapes, onToast]
  );

  // "Ajustar seleção": o frame/seção passa a caber exatamente nos filhos
  const handleFitSelection = useCallback(() => {
    if (!selectedShape || (selectedShape.type !== 'frame' && selectedShape.type !== 'section')) {
      onToast?.('Selecione um frame ou seção para ajustar ao conteúdo');
      return;
    }
    const kids = shapes.filter((s) => s.parentId === selectedShape.id && s.visible !== false);
    if (kids.length === 0) return;
    const box = unionBox(kids.map((k) => ({ x: k.x, y: k.y, width: k.width, height: k.height })));
    applyShapes(
      shapes.map((s) => (s.id === selectedShape.id ? { ...s, x: box.x, y: box.y, width: box.width, height: box.height } : s)),
      true
    );
  }, [selectedShape, shapes, applyShapes, onToast]);

  // Variáveis: criar a partir do preenchimento, ligar, editar por modo, trocar o modo ativo
  const commitVariables = useCallback((list: VariablesList, modeId: string) => {
    variablesRef.current = { list, modeId }; // antes de aplicar, para o pipeline já usar os valores novos
    setVariables(list);
    setActiveModeId(modeId);
  }, []);

  const handleCreateVariable = useCallback(() => {
    if (!selectedShape) return;
    const first = selectedShape.fills && selectedShape.fills.length > 0 ? selectedShape.fills[0] : null;
    const id = crypto.randomUUID();
    const v = createColorVariable(id, `Variável ${variables.length + 1}`, first?.color || selectedShape.fill || '#D9D9D9', modes);
    commitVariables([...variables, v], activeModeId);
    applyShapes(shapes.map((s) => (s.id === selectedShape.id ? { ...s, fillVariableId: id } : s)), true);
  }, [selectedShape, variables, modes, activeModeId, shapes, applyShapes, commitVariables]);

  const handleBindVariable = useCallback(
    (variableId: string | undefined) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      applyShapes(shapes.map((s) => (ids.includes(s.id) ? { ...s, fillVariableId: variableId } : s)), true);
    },
    [selectedIds, selectedShape, shapes, applyShapes]
  );

  const handleUpdateVariable = useCallback(
    (variableId: string, patch: { name?: string; modeId?: string; value?: string }) => {
      const next = variables.map((v) =>
        v.id !== variableId ? v : { ...v, name: patch.name ?? v.name, values: patch.modeId && patch.value ? { ...v.values, [patch.modeId]: patch.value } : v.values }
      );
      commitVariables(next, activeModeId);
      applyShapes(shapes, true); // propaga o valor novo
    },
    [variables, activeModeId, shapes, applyShapes, commitVariables]
  );

  const handleDeleteVariable = useCallback(
    (variableId: string) => {
      commitVariables(variables.filter((v) => v.id !== variableId), activeModeId);
      applyShapes(shapes.map((s) => (s.fillVariableId === variableId ? { ...s, fillVariableId: undefined } : s)), true);
    },
    [variables, activeModeId, shapes, applyShapes, commitVariables]
  );

  const handleSetMode = useCallback(
    (modeId: string) => {
      commitVariables(variables, modeId);
      applyShapes(shapes, true); // recolore tudo com os valores do modo
    },
    [variables, shapes, applyShapes, commitVariables]
  );

  // Estilos: criar a partir da seleção, aplicar, atualizar, renomear e excluir
  const commitStyles = useCallback((next: DesignStyle[]) => {
    stylesRef.current = next; // antes de aplicar, para o pipeline já usar os valores novos
    setStyles(next);
  }, []);

  const handleCreateStyle = useCallback(
    (kind: 'color' | 'text') => {
      if (!selectedShape) return;
      const id = crypto.randomUUID();
      const count = styles.filter((s) => s.kind === kind).length + 1;
      const style = kind === 'color' ? colorStyleFromShape(selectedShape, id, `Cor ${count}`) : textStyleFromShape(selectedShape, id, `Texto ${count}`);
      commitStyles([...styles, style]);
      applyShapes(shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...(kind === 'color' ? { fillStyleId: id } : { textStyleId: id }) } : s)), true);
    },
    [selectedShape, styles, shapes, applyShapes, commitStyles]
  );

  const handleApplyStyle = useCallback(
    (style: DesignStyle) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      applyShapes(
        shapes.map((s) => (ids.includes(s.id) ? { ...s, ...(style.kind === 'color' ? { fillStyleId: style.id } : { textStyleId: style.id }) } : s)),
        true
      );
    },
    [selectedIds, selectedShape, shapes, applyShapes]
  );

  const handleUpdateStyle = useCallback(
    (styleId: string) => {
      if (!selectedShape) return;
      const old = styles.find((s) => s.id === styleId);
      if (!old) return;
      const fresh = old.kind === 'color' ? colorStyleFromShape(selectedShape, styleId, old.name) : textStyleFromShape(selectedShape, styleId, old.name);
      commitStyles(styles.map((s) => (s.id === styleId ? fresh : s)));
      applyShapes(shapes, true); // propaga o valor novo para todos os shapes ligados
    },
    [selectedShape, styles, shapes, applyShapes, commitStyles]
  );

  const handleRenameStyle = useCallback((styleId: string, name: string) => commitStyles(styles.map((s) => (s.id === styleId ? { ...s, name } : s))), [styles, commitStyles]);

  const handleDeleteStyle = useCallback(
    (styleId: string) => {
      commitStyles(styles.filter((s) => s.id !== styleId));
      applyShapes(shapes.map((s) => (s.fillStyleId === styleId || s.textStyleId === styleId ? { ...s, fillStyleId: s.fillStyleId === styleId ? undefined : s.fillStyleId, textStyleId: s.textStyleId === styleId ? undefined : s.textStyleId } : s)), true);
    },
    [styles, shapes, applyShapes, commitStyles]
  );

  const snapshotNow = useCallback(
    () => ({ shapes, pages, selectedPageId, pageViewports, styles: stylesRef.current }),
    [shapes, pages, selectedPageId, pageViewports]
  );

  const handleSaveVersion = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const entry = await saveVersion(workspacePath, snapshotNow());
      setVersions(await listVersions(workspacePath));
      onToast?.(`Versão salva: ${entry.label}`);
    } catch {
      onToast?.('Não foi possível salvar a versão');
    }
  }, [workspacePath, snapshotNow, onToast]);

  const handleOpenVersions = useCallback(async () => {
    setIsDocMenuOpen(false);
    setIsVersionsOpen(true);
    if (workspacePath) setVersions(await listVersions(workspacePath));
  }, [workspacePath]);

  const handleRestoreVersion = useCallback(
    async (v: VersionEntry) => {
      if (!workspacePath) return;
      const snap = await loadVersion(workspacePath, v.id);
      if (!snap) {
        onToast?.('Versão não encontrada');
        return;
      }
      // Guarda o estado atual antes de voltar, para poder desfazer o restaurar
      await saveVersion(workspacePath, snapshotNow(), `Antes de restaurar "${v.label}"`).catch(() => {});
      stylesRef.current = snap.styles || [];
      setStyles(snap.styles || []);
      setPages(snap.pages?.length ? snap.pages : DEFAULT_PAGES);
      setSelectedPageId(snap.selectedPageId || 'page-1');
      setShapesRaw(snap.shapes);
      historyRef.current = { stack: [snap.shapes], index: 0 };
      room.broadcast(snap.shapes);
      setVersions(await listVersions(workspacePath));
      setIsVersionsOpen(false);
      onToast?.(`Restaurada: ${v.label}`);
    },
    [workspacePath, snapshotNow, room, onToast]
  );

  const handleDeleteVersion = useCallback(
    async (v: VersionEntry) => {
      if (workspacePath) setVersions(await deleteVersion(workspacePath, v.id));
    },
    [workspacePath]
  );

  const codeText = useMemo(() => (codeShape ? generateCode(codeTarget, activePageShapes, codeShape) : ''), [codeShape, codeTarget, activePageShapes]);

  const handleSaveCodeToProject = useCallback(async () => {
    if (!codeShape || !workspacePath) return;
    const ext = codeTarget === 'react' ? 'tsx' : codeTarget === 'html' ? 'html' : 'dart';
    const name = componentName(codeShape.name || 'Tela');
    const file = `${workspacePath}/src/design-export/${name}.${ext}`;
    try {
      await (window as any).electronAPI?.fs?.writeFile?.(file, codeText);
      onToast?.(`Salvo em src/design-export/${name}.${ext}`);
    } catch {
      onToast?.('Não foi possível salvar o arquivo');
    }
  }, [codeShape, codeTarget, codeText, workspacePath, onToast]);

  const handleAskAiToImplement = useCallback(() => {
    if (!codeShape || !onSendToChat) return;
    const label = codeTarget === 'react' ? 'React (TSX)' : codeTarget === 'html' ? 'HTML' : 'Flutter';
    const issue = codeShape.linkedIssue ? ` Este design está ligado à issue #${codeShape.linkedIssue}.` : '';
    onSendToChat(
      `Implemente no projeto a tela "${codeShape.name || 'Tela'}" do Design (${label}), seguindo a stack e os componentes que o projeto já usa e reaproveitando o que existir.${issue}

Código de referência gerado do design:

\`\`\`
${codeText}
\`\`\``
    );
    setCodeShape(null);
  }, [codeShape, codeTarget, codeText, onSendToChat]);

  // Variantes: trocar a instância para outra variante do mesmo componente
  const handleSwitchVariant = useCallback(
    (instance: Shape, componentId: string) => {
      const res = switchVariant(shapes, instance.id, componentId);
      if (!res) return;
      applyShapes(res.shapes, true);
      setSelectedIds([res.newRootId]);
      setSelectedId(res.newRootId);
    },
    [shapes, applyShapes]
  );

  // Componentes: criar instância ligada e desanexar
  const handleCreateInstance = useCallback(
    (shape: Shape) => {
      const inst = createInstance(shapes, shape.id, { x: shape.width + 40, y: 0 }).map((s) => ({ ...s, pageId: selectedPageId }));
      if (inst.length === 0) return;
      applyShapes([...shapes, ...inst], true);
      setSelectedIds([inst[0].id]);
      setSelectedId(inst[0].id);
    },
    [shapes, applyShapes, selectedPageId]
  );

  const handleDetachInstance = useCallback(
    (shape: Shape) => {
      applyShapes(detachInstance(shapes, shape.id), true);
    },
    [shapes, applyShapes]
  );

  // Distribui com espaços iguais (3 ou mais selecionados)
  const handleDistribute = useCallback(
    (axis: 'x' | 'y') => {
      if (selectedIds.length < 3) {
        onToast?.('Selecione 3 ou mais elementos para distribuir');
        return;
      }
      applyShapes(applyDeltas(shapes, distributeDeltas(shapes, selectedIds, axis)), true);
    },
    [selectedIds, shapes, applyShapes, onToast]
  );

  // Os atalhos (efeito acima) chamam estas ações pela ref para sempre usar a versão mais recente
  const keyActionsRef = useRef({ handleAlign, handleDistribute, handleBoolean });
  keyActionsRef.current = { handleAlign, handleDistribute, handleBoolean };


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

  // Telas geradas pela IA aguardando aceite / regeração
  const [aiReview, setAiReview] = useState<Array<{ id: string; prompt: string; busy?: boolean; w?: number; h?: number; refs?: string[] }>>([]);

  /** Brain do projeto + resumo dos arquivos (README, package.json, estrutura, cores) do projeto da header */
  const getProjectContext = useCallback(async () => {
    const digest = await buildProjectDigest(workspacePath).catch(() => '');
    let brainText = '';
    try {
      const brain = workspacePath ? getActiveBrainContextSync(workspacePath) : null;
      brainText = brain ? generateBrainAiContext(brain).replace(/\s+/g, ' ').slice(0, 1500) : '';
    } catch {}
    return [repoName ? `Projeto: ${repoName}.` : '', brainText, digest].filter(Boolean).join('\n').slice(0, 5500) || undefined;
  }, [workspacePath, repoName]);

  /** Gera telas em tempo real: cada elemento aparece no canvas assim que a IA o descreve. */
  const runScreenGeneration = useCallback(
    async (o: { signal?: { cancelled: boolean }; prompt: string; basePrompt: string; referenceImages?: string[]; startX: number; startY: number; onProgress?: (m: string) => void; replaceFrameId?: string; maxScreens?: number }) => {
      const icons = await loadIcons().catch(() => undefined);
      const projectContext = await getProjectContext();
      const aiReq = { prompt: o.prompt, pageId: selectedPageId, startX: o.startX, startY: o.startY, accentColor, isDark: isEffectiveDark, icons, projectContext, canReadProject: !!workspacePath, maxScreens: o.maxScreens, referenceImages: o.referenceImages };

      let base = activePageShapes;
      if (o.replaceFrameId) {
        const gone = new Set([o.replaceFrameId, ...descendantIds(activePageShapes, o.replaceFrameId)]);
        base = activePageShapes.filter((s) => !gone.has(s.id));
      }
      let live: Shape[] = [];
      const apply = (commit = false) => applyActivePageShapes([...base, ...live], commit);

      const builder = new ScreenBuilder(aiReq);
      const stream = new AiJsonStream();
      const queue: AiStreamEvent[] = [];
      let streamDone = false;
      let screenCount = 0;
      const imageJobs: Promise<void>[] = [];
      let imgStarted = 0;
      const startImages = () => {
        while (imgStarted < builder.pending.length) {
          const job = builder.pending[imgStarted++];
          imageJobs.push(
            fetchStockImage(job.query, job.width, job.height)
              .then((r) => {
                if (!r || o.signal?.cancelled) return;
                const cur = builder.all.find((s) => s.id === job.id);
                builder.patch(job.id, { imageUrl: r.dataUrl, name: r.credit ? `${cur?.name || 'Foto'} · Foto: ${r.credit} (Unsplash)` : cur?.name });
                live = builder.all;
                apply(false);
              })
              .catch(() => {})
          );
        }
      };
      const handle = (ev: AiStreamEvent) => {
        if (ev.kind === 'screen') {
          const shapes = builder.startScreen(ev.header);
          if (!shapes.length) return;
          live = builder.all;
          apply(false);
          screenCount++;
          o.onProgress?.(`Criando a tela "${shapes[0].name}"…`);
          if (screenCount === 1) {
            const f = shapes[0];
            const z = f.width > 1000 ? 0.48 : 0.65;
            setZoom(z);
            setTargetCamera({ x: f.x + f.width / 2, y: f.y + f.height / 2, zoom: z, timestamp: Date.now() });
          }
        } else {
          const shape = builder.addItem(ev.item);
          if (!shape) return;
          builder.settle(); // auto layout: hug/fill/posições
          live = builder.all;
          apply(false);
          startImages();
          o.onProgress?.(`Criando ${shape.name || shape.type}… (${builder.itemCount} elementos)`);
        }
      };
      const consumer = (async () => {
        while ((!streamDone || queue.length) && !o.signal?.cancelled) {
          const ev = queue.shift();
          if (!ev) { await new Promise((r) => setTimeout(r, 30)); continue; }
          handle(ev);
          await new Promise((r) => setTimeout(r, queue.length > 10 ? 12 : ev.kind === 'item' ? 45 : 150));
        }
      })();

      o.onProgress?.(`Pedindo o layout para ${selectedAiProvider || 'a IA'}${workspacePath ? ' (analisando o projeto)' : ''}...`);
      let final = '';
      let failure: any = null;
      // enquanto a IA pensa (ainda sem nada para desenhar), mostra que está viva
      const startedAt = Date.now();
      const waitTimer = setInterval(() => {
        if (builder.itemCount === 0 && screenCount === 0) o.onProgress?.(`${selectedAiProvider || 'A IA'} está pensando no layout… ${Math.round((Date.now() - startedAt) / 1000)}s`);
      }, 1000);
      try {
        final = await requestAiScreenRaw(buildAiScreenPrompt(aiReq), selectedAiProvider, selectedModel, workspacePath || undefined, 480000, (chunk) => queue.push(...stream.push(chunk)), (o.referenceImages || []).map((p) => p.slice(0, p.lastIndexOf('/'))));
        // CLIs que só devolvem no fim: o que não chegou em tempo real entra agora (aparece em sequência)
        if (stream.consumed === 0 && final) queue.push(...stream.push(final));
      } catch (err) {
        failure = err;
      }
      clearInterval(waitTimer);
      streamDone = true;
      await consumer;
      if (o.signal?.cancelled) {
        // cancelado: descarta o que foi criado até aqui
        applyActivePageShapes(activePageShapes, false); // volta ao estado anterior (inclusive a tela que seria substituída)
        return 0;
      }

      if (builder.itemCount === 0 && final) {
        // o parser incremental não achou nada: tenta a resposta inteira
        const whole = parseAiScreenResponse(final, aiReq);
        if (whole) {
          builder.all = whole.shapes;
          live = builder.all;
          builder.pending.push(...whole.pending);
          startImages();
          builder.frameIds.push(whole.mainFrameId);
          apply(false);
        }
      }
      await Promise.all(imageJobs);

      let frameIds = builder.frameIds.length ? builder.frameIds : live.filter((s) => s.type === 'frame' && !s.parentId).map((s) => s.id);
      if (live.length === 0) {
        // sem layout da IA não inventamos um modelo fixo: avisa o usuário
        setAiReview((prev) => prev.map((r) => (r.id === o.replaceFrameId ? { ...r, busy: false } : r)));
        throw new Error(failure?.message || 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.');
      } else if (failure) {
        onToast?.(`${failure?.message || 'A IA parou antes do fim'}; mantive o que já foi criado`);
      }
      apply(true);
      handleSelectSingle(frameIds[0] || null);
      setAiReview((prev) => [...prev.filter((r) => r.id !== o.replaceFrameId), ...frameIds.map((id) => { const sc = builder.screens_.find((x) => x.rootId === id); return { id, prompt: o.basePrompt, w: sc?.width, h: sc?.height, refs: o.referenceImages }; })]);
      if (!o.replaceFrameId && frameIds.length > 1) {
        const frames = live.filter((s) => frameIds.includes(s.id));
        const minX = Math.min(...frames.map((f) => f.x));
        const maxX = Math.max(...frames.map((f) => f.x + f.width));
        const z = Math.max(0.1, Math.min(0.65, (viewport.width * zoom * 0.9) / (maxX - minX)));
        setZoom(z);
        setTargetCamera({ x: (minX + maxX) / 2, y: frames[0].y + frames[0].height / 2, zoom: z, timestamp: Date.now() });
      }
      return frameIds.length;
    },
    [selectedPageId, accentColor, isEffectiveDark, selectedAiProvider, selectedModel, workspacePath, getProjectContext, applyActivePageShapes, activePageShapes, handleSelectSingle, onToast, viewport, zoom]
  );

  const handlePrototypeWithAi = useCallback(
    async (prompt: string, onProgress?: (msg: string) => void, images?: string[], selection?: string[], signal?: { cancelled: boolean }) => {
      const clean = prompt.trim();
      if (!clean) return { success: false, error: 'O prompt não pode estar vazio.' };

      setIsGeneratingAi(true);
      try {
        // imagens de referência: viram arquivos temporários que a CLI de IA abre pelo caminho
        const refs: string[] = [];
        for (const dataUrl of images || []) {
          const save = (window as any).electronAPI?.fs?.saveTempImage;
          if (!save) break;
          const r = await save(dataUrl.split(',')[1], 'jpg').catch(() => null);
          if (r?.path) refs.push(r.path);
        }
        const refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];
        if (refs.length) onProgress?.(`${refs.length} imagem(ns) de referência anexada(s)`);
        // só conta o que realmente existe e está visível nesta página (ids antigos/de outra página não são seleção)
        const sel = selection ?? selectedIds; // seleção do momento em que o pedido foi enviado
        const liveIds = sel.filter((id) => activePageShapes.some((s) => s.id === id && s.visible !== false));
        const firstSel = activePageShapes.find((s) => s.id === liveIds[0]);
        const selFrame = firstSel ? (firstSel.type === 'frame' ? firstSel : activePageShapes.find((s) => s.id === firstSel.parentId && s.type === 'frame') || null) : null;
        // aparelho selecionado: o alvo é a tela dentro dele
        const genTarget = selFrame ? activePageShapes.find((s) => s.parentId === selFrame.id && s.deviceScreen) || selFrame : null;
        const hasContent = !!genTarget && activePageShapes.some((s) => s.parentId === genTarget.id && !s.deviceChrome);

        // Seleção existente (que não seja um frame vazio): a IA EDITA o que está selecionado
        if (liveIds.length > 0 && (!selFrame || liveIds.length > 1 || hasContent)) {
          const icons = await loadIcons().catch(() => undefined);
          const scope = editScope(activePageShapes, liveIds);
          onProgress?.(`Pedindo para ${selectedAiProvider || 'a IA'} editar ${liveIds.length} elemento(s) selecionado(s)...`);
          const raw = await requestAiScreenRaw(
            buildAiEditPrompt({ prompt: clean, accentColor, isDark: isEffectiveDark, referenceImages: refs }, scope, liveIds),
            selectedAiProvider, selectedModel, workspacePath || undefined, 240000, undefined, refDirs
          );
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          const edited = applyAiEdits(raw, activePageShapes, scope, liveIds, { pageId: selectedPageId, isDark: isEffectiveDark, accentColor, icons });
          if (!edited) { onAiTaskDone?.({ ok: false, message: 'A IA não devolveu alterações válidas. Tente descrever a mudança de outra forma.' }); return { success: false, error: 'A IA não devolveu alterações válidas. Tente descrever a mudança de outra forma.' }; }
          let editedShapes = edited.shapes;
          if (edited.pending.length) {
            const imgs = await Promise.all(edited.pending.map((j) => fetchStockImage(j.query, j.width, j.height).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
            editedShapes = editedShapes.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; });
          }
          applyActivePageShapes(editedShapes, true);
          onToast?.(`IA: ${edited.changed} alterado(s), ${edited.added} adicionado(s), ${edited.removed} removido(s)`);
          onAiTaskDone?.({ ok: true, message: 'Alterações aplicadas à seleção' });
          return { success: true };
        }

        // Frame vazio selecionado: gera o conteúdo dentro dele (sem tempo real)
        if (genTarget) {
          const icons = await loadIcons().catch(() => undefined);
          const aiReq = { prompt: clean, pageId: selectedPageId, startX: genTarget.x, startY: genTarget.y, accentColor, isDark: isEffectiveDark, targetFrame: genTarget, icons, canReadProject: !!workspacePath, referenceImages: refs };
          let generated: ReturnType<typeof parseAiScreenResponse> = null;
          onProgress?.(`Pedindo o layout para ${selectedAiProvider || 'a IA'}...`);
          generated = parseAiScreenResponse(await requestAiScreenRaw(buildAiScreenPrompt(aiReq), selectedAiProvider, selectedModel, workspacePath || undefined, 240000, undefined, refDirs), aiReq);
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          if (!generated) { onAiTaskDone?.({ ok: false, message: 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.' }); return { success: false, error: 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.' }; }
          const result = generated;
          // troca o conteúdo da tela (e tudo dentro dele), mantendo as peças do aparelho
          const inside = new Set(descendantIds(activePageShapes, genTarget.id));
          const others = activePageShapes.filter((s) => s.id !== genTarget.id && (!inside.has(s.id) || s.deviceChrome));
          const content = result.shapes.filter((s) => s.id !== genTarget.id);
          let next = [...others, genTarget, ...content];
          if (generated?.pending.length) {
            const imgs = await Promise.all(generated.pending.map((j) => fetchStockImage(j.query, j.width, j.height).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
            next = next.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; });
          }
          applyActivePageShapes(next, true);
          handleSelectSingle(genTarget.id);
          onAiTaskDone?.({ ok: true, message: 'Conteúdo da tela gerado' });
          return { success: true };
        }

        // Nada selecionado: cria telas novas, em tempo real
        const spot = findFreeSpot(activePageShapes, Math.round(viewport.x + viewport.width * 0.1) || 100, Math.round(viewport.y + 60) || 100, 460, 920);
        const count = await runScreenGeneration({ prompt: clean, basePrompt: clean, referenceImages: refs, startX: spot.x, startY: spot.y, onProgress, signal });
        if (signal?.cancelled) return { success: false, error: 'cancelado' };
        onAiTaskDone?.({ ok: true, message: count === 1 ? 'Tela gerada e pronta para revisar' : `${count} telas geradas e prontas para revisar` });
        return { success: true };
      } catch (err: any) {
        if (signal?.cancelled) return { success: false, error: 'cancelado' };
        console.error('Erro ao prototipar com IA:', err);
        onAiTaskDone?.({ ok: false, message: err?.message || 'Falha ao gerar a tela' });
        return { success: false, error: err?.message || 'Falha ao processar protótipo com IA. Tente novamente.' };
      } finally {
        setIsGeneratingAi(false);
      }
    },
    [viewport, selectedPageId, accentColor, isEffectiveDark, selectedAiProvider, selectedModel, workspacePath, applyActivePageShapes, activePageShapes, selectedIds, handleSelectSingle, onToast, onAiTaskDone, runScreenGeneration]
  );

  /** Telas (frames raiz) das seleções, na ordem de leitura (esquerda→direita, cima→baixo) */
  const proposalFrames = useMemo(() => {
    const byId = new Map(activePageShapes.map((s) => [s.id, s]));
    const roots = new Map<string, Shape>();
    for (const id of selectedIds) {
      let cur = byId.get(id);
      while (cur?.parentId && byId.get(cur.parentId)) cur = byId.get(cur.parentId);
      if (cur && cur.type === 'frame') roots.set(cur.id, cur);
    }
    return [...roots.values()].sort((a, b) => a.x - b.x || a.y - b.y).slice(0, 12);
  }, [selectedIds, activePageShapes]);

  const handleGenerateProposal = useCallback(
    async (o: { client: string; company: string; notes: string }, status: (m: string) => void) => {
      try {
        const api = (window as any).electronAPI?.fs;
        if (!api?.exportPdf) return { ok: false, message: 'Disponível apenas no app desktop' };
        status('Renderizando as telas…');
        const images: Record<string, string> = {};
        for (const f of proposalFrames) {
          const { blob } = await exportShape(shapes, f, { id: 'proposal', format: 'JPG', scale: '1.5x' });
          images[f.id] = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(r.error);
            r.readAsDataURL(blob);
          });
        }
        const frames = proposalFrames.map((f) => collectFrameContext(shapes, f));
        status(`${selectedAiProvider || 'A IA'} está analisando as telas${workspacePath ? ' e o projeto' : ''}…`);
        const raw = await requestAiScreenRaw(
          buildProposalPrompt({ ...o, projectContext: await getProjectContext(), frames }),
          selectedAiProvider, selectedModel, workspacePath || undefined, 240000
        );
        const proposal = parseProposal(raw, frames);
        if (!proposal) return { ok: false, message: 'A IA não devolveu uma proposta válida. Tente novamente.' };
        status('Gerando o PDF…');
        const html = buildProposalHtml(proposal, images, frames, { accent: accentColor, client: o.client || undefined, company: o.company || undefined });
        const res = await api.exportPdf(html, proposal.title);
        if (res.error) return { ok: false, message: res.error };
        if (res.canceled) return { ok: true, message: 'Salvamento cancelado' };
        return { ok: true, message: `Proposta salva em ${res.path}` };
      } catch (err: any) {
        return { ok: false, message: err?.message || 'Falha ao gerar a proposta' };
      }
    },
    [proposalFrames, shapes, selectedAiProvider, selectedModel, workspacePath, getProjectContext, accentColor]
  );

  const handleAiAccept = useCallback((id: string) => {
    setAiReview((prev) => prev.filter((r) => r.id !== id));
    onToast?.('Tela aceita');
  }, [onToast]);

  // ---------------- Fila de gerações da IA (uma por vez, em ordem) ----------------
  interface AiJob {
    id: string;
    kind: 'prompt' | 'regen';
    prompt: string;
    label: string;
    images: string[];
    selection: string[];
    frameId?: string;
    status: 'queued' | 'running' | 'error';
    progress?: string;
    signal: { cancelled: boolean };
  }
  const [aiQueue, setAiQueue] = useState<AiJob[]>([]);
  const runningJobRef = useRef<string | null>(null);

  const patchJob = useCallback((id: string, patch: Partial<AiJob>) => setAiQueue((q) => q.map((j) => (j.id === id ? { ...j, ...patch } : j))), []);

  const handleEnqueueAi = useCallback(
    (prompt: string, images: string[]) => {
      const job: AiJob = { id: crypto.randomUUID(), kind: 'prompt', prompt, label: prompt, images, selection: selectedIds, status: 'queued', signal: { cancelled: false } };
      setAiQueue((q) => [...q, job]);
    },
    [selectedIds]
  );

  const handleCancelAiJob = useCallback(
    (id: string) => {
      const job = aiQueue.find((j) => j.id === id);
      if (!job) return;
      job.signal.cancelled = true;
      if (job.kind === 'regen' && job.frameId) setAiReview((prev) => prev.map((r) => (r.id === job.frameId ? { ...r, busy: false } : r)));
      if (job.status !== 'running') {
        setAiQueue((q) => q.filter((j) => j.id !== id));
      } else {
        patchJob(id, { progress: 'Cancelando…' });
        (window as any).electronAPI?.ai?.cancel?.(undefined, workspacePath || undefined); // encerra a CLI em execução
      }
    },
    [aiQueue, patchJob, workspacePath]
  );

  /** Sobe um pedido na fila, nunca acima do que já está sendo gerado */
  const handleMoveAiJobUp = useCallback((id: string) => {
    setAiQueue((q) => {
      const i = q.findIndex((j) => j.id === id);
      const firstQueued = q.findIndex((j) => j.status === 'queued');
      if (i <= 0 || i <= firstQueued || q[i].status !== 'queued') return q;
      const next = q.slice();
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }, []);

  const handleAiRegenerate = useCallback(
    (id: string) => {
      const entry = aiReview.find((r) => r.id === id);
      const frame = activePageShapes.find((s) => s.id === id);
      if (!entry || !frame || entry.busy) return;
      setAiReview((prev) => prev.map((r) => (r.id === id ? { ...r, busy: true } : r)));
      setAiQueue((q) => [...q, { id: crypto.randomUUID(), kind: 'regen', prompt: entry.prompt, label: `Regerar a tela "${frame.name}"`, images: [], selection: [], frameId: id, status: 'queued', signal: { cancelled: false } }]);
    },
    [aiReview, activePageShapes]
  );

  const runRegenJob = useCallback(
    async (job: AiJob): Promise<string | null> => {
      const entry = aiReview.find((r) => r.id === job.frameId);
      const frame = activePageShapes.find((s) => s.id === job.frameId);
      if (!entry || !frame) return 'A tela original não existe mais';
      try {
        await runScreenGeneration({
          prompt: `${entry.prompt}\n\nGere APENAS a tela "${frame.name}" (${Math.round(entry.w ?? frame.width)}x${Math.round(entry.h ?? frame.height)} px, escreva exatamente esse width/height): UMA única tela, com um layout NOVO e diferente da versão anterior (outra composição), mantendo o mesmo estilo e fluxo.`,
          basePrompt: entry.prompt,
          referenceImages: entry.refs,
          startX: frame.x,
          startY: frame.y,
          replaceFrameId: job.frameId,
          maxScreens: 1,
          signal: job.signal,
          onProgress: (m) => patchJob(job.id, { progress: m }),
        });
        if (!job.signal.cancelled) onAiTaskDone?.({ ok: true, message: `Nova versão da tela "${frame.name}" gerada` });
        return null;
      } catch (err: any) {
        if (!job.signal.cancelled) {
          onAiTaskDone?.({ ok: false, message: err?.message || 'Falha ao regerar a tela' });
          return err?.message || 'Falha ao regerar a tela';
        }
        return null;
      } finally {
        setAiReview((prev) => prev.map((r) => (r.id === job.frameId ? { ...r, busy: false } : r)));
      }
    },
    [aiReview, activePageShapes, runScreenGeneration, patchJob, onToast, onAiTaskDone]
  );

  // Processa a fila: um pedido por vez, na ordem; ao terminar (ou cancelar) segue para o próximo
  // devolve a mensagem de erro (ou null): o card fica na fila com o erro até o usuário dispensar ou tentar de novo
  const runJobRef = useRef<(job: AiJob) => Promise<string | null>>(async () => null);
  runJobRef.current = async (job) => {
    setIsGeneratingAi(true);
    try {
      if (job.kind === 'regen') return await runRegenJob(job);
      const res = await handlePrototypeWithAi(job.prompt, (m) => patchJob(job.id, { progress: m }), job.images, job.selection, job.signal);
      if (res && res.success === false && !job.signal.cancelled) return res.error || 'Erro ao gerar com IA';
      return null;
    } catch (err: any) {
      return job.signal.cancelled ? null : err?.message || 'Erro ao gerar com IA';
    } finally {
      setIsGeneratingAi(false);
    }
  };
  useEffect(() => {
    if (runningJobRef.current) return;
    const next = aiQueue.find((j) => j.status === 'queued');
    if (!next) return;
    runningJobRef.current = next.id;
    setAiQueue((q) => q.map((j) => (j.id === next.id ? { ...j, status: 'running' } : j)));
    runJobRef.current(next).then((error) => {
      runningJobRef.current = null;
      if (error) {
        onToast?.(error);
        setAiQueue((q) => q.map((j) => (j.id === next.id ? { ...j, status: 'error', progress: error } : j)));
      } else setAiQueue((q) => q.filter((j) => j.id !== next.id));
    });
  }, [aiQueue]);

  /** Tenta de novo um pedido que falhou: volta para o fim da fila */
  const handleRetryAiJob = useCallback((id: string) => {
    setAiQueue((q) => {
      const job = q.find((j) => j.id === id);
      if (!job) return q;
      return [...q.filter((j) => j.id !== id), { ...job, status: 'queued', progress: undefined, signal: { cancelled: false } }];
    });
  }, []);


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
                    {([
                      ['save', 'Salvar versão'],
                      ['history', 'Histórico de versões…'],
                      ['figma', 'Importar do Figma…'],
                      ['proposal', 'Gerar proposta com IA (telas selecionadas)…'],
                      ['unsplash', 'Chave do Unsplash (imagens da IA)…'],
                      ['clearGuides', 'Limpar guias da página'],
                    ] as const).map(([key, label]) => (
                      <div
                        key={key}
                        onClick={() => {
                          if (key === 'save') {
                            setIsDocMenuOpen(false);
                            handleSaveVersion();
                          } else if (key === 'history') {
                            handleOpenVersions();
                          } else if (key === 'figma') {
                            setIsDocMenuOpen(false);
                            setIsFigmaImportOpen(true);
                          } else if (key === 'proposal') {
                            setIsDocMenuOpen(false);
                            if (proposalFrames.length === 0) onToast?.('Selecione uma ou mais telas (frames) para gerar a proposta');
                            else setIsProposalOpen(true);
                          } else if (key === 'unsplash') {
                            setIsDocMenuOpen(false);
                            setIsUnsplashOpen(true);
                          } else {
                            setGuidesByPage((prev) => ({ ...prev, [selectedPageId]: [] }));
                            setIsDocMenuOpen(false);
                            onToast?.('Guias da página removidas');
                          }
                        }}
                        style={{ padding: '7px 12px', fontSize: 11, fontFamily: "'Poppins', sans-serif", color: tokens.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 13 }} />
                        <span>{label}</span>
                      </div>
                    ))}
                    {([
                      ['grid', "Mostrar grade  (Ctrl+')"],
                      ['rulers', 'Mostrar réguas  (Shift+R)'],
                      ['rulerRelative', 'Réguas relativas ao frame'],
                      ['guides', 'Mostrar guias  (Ctrl+;)'],
                      ['snap', 'Encaixe inteligente'],
                    ] as const).map(([key, label]) => (
                      <div
                        key={key}
                        onClick={() => toggleViewPref(key)}
                        style={{ padding: '7px 12px', fontSize: 11, fontFamily: "'Poppins', sans-serif", color: tokens.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 13, textAlign: 'center', color: accentColor }}>{viewPrefs[key] ? '✓' : ''}</span>
                        <span>{label}</span>
                      </div>
                    ))}
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

        <div
          style={{ display: 'contents' }}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer?.items || []).some((i) => i.kind === 'file')) e.preventDefault();
          }}
          onDrop={(e) => {
            const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
            if (files.length === 0 || readOnly) return;
            e.preventDefault();
            // Ponto do soltar em coordenadas do canvas
            const svg = (e.target as Element).closest('svg');
            const rect = svg?.getBoundingClientRect();
            files.forEach((file, i) =>
              setTimeout(
                () =>
                  insertImageRef.current(
                    file,
                    rect ? { x: viewport.x + (e.clientX - rect.left) / zoom + i * 24, y: viewport.y + (e.clientY - rect.top) / zoom + i * 24 } : undefined
                  ),
                i * 250
              )
            );
          }}
        >
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
          aiReview={aiReview}
          onAiAccept={handleAiAccept}
          onAiRegenerate={handleAiRegenerate}
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
          onPointerMove={(x, y) => {
            // ~12 envios/s no máximo
            const now = Date.now();
            if (room.role === 'idle' || now - lastCursorSendRef.current < 80) return;
            lastCursorSendRef.current = now;
            room.sendCursor({ x, y, name: myCursorName, color: accentColor });
          }}
          remoteCursors={Object.values(room.remoteCursors)}
          snapEnabled={viewPrefs.snap}
          showGrid={viewPrefs.grid}
          showRulers={viewPrefs.rulers}
          rulerRelative={viewPrefs.rulerRelative}
          showUserGuides={viewPrefs.guides}
          userGuides={guidesByPage[selectedPageId] || []}
          onUserGuidesChange={(list) => setGuidesByPage((prev) => ({ ...prev, [selectedPageId]: list }))}
        />
        </div>

        {/* Toolbar Flutuante Inferior com Dropdowns e Div de IA */}
        <DesignToolbar
          tool={readOnly ? 'select' : tool}
          onSelectTool={setTool}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={tokens}
          onInsertImage={handleInsertImage}
          onOpenIcons={() => setIsIconPickerOpen(true)}
          onOpenFrames={() => setIsFramesOpen(true)}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          onSelectAiProvider={onSelectAiProvider}
          onSelectModel={onSelectModel}
          installedClis={installedClis}
          activeModels={activeModels}
          onInstallAiCli={onInstallAiCli}
          onPrototypeWithAi={handlePrototypeWithAi}
          aiQueue={aiQueue.map((j) => ({ id: j.id, label: j.label, status: j.status, progress: j.progress }))}
          onEnqueueAi={handleEnqueueAi}
          onCancelAiJob={handleCancelAiJob}
          onMoveAiJobUp={handleMoveAiJobUp}
          onRetryAiJob={handleRetryAiJob}
          isGeneratingAi={isGeneratingAi}
          selectedFrame={selectedFrame}
        />

        {/* ================================================================= */}
        {/* FIGMA COLOR PICKER FLUTUANTE E ARRASTÁVEL DENTRO DA DIV DO CENTRO */}
        {/* ================================================================= */}
        {activeColorPicker && selectedShape && (() => {
          const fills: FillItem[] = (selectedShape.fills && selectedShape.fills.length > 0)
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
              fillType={activeFillItem?.type}
              gradientStops={activeFillItem?.gradientStops}
              gradientAngle={activeFillItem?.gradientAngle}
              onGradientChange={
                activeColorPicker.target === 'fill'
                  ? (patch) => {
                      const targetId = activeFillItem?.id;
                      const updatedFills = fills.map((f) =>
                        isAllFills || f.id === targetId
                          ? { ...f, ...patch, color: patch.gradientStops?.[0]?.color ?? f.color }
                          : f
                      );
                      applyShapes(
                        shapes.map((s) => (s.id === selectedShape.id ? { ...s, fills: updatedFills } : s)),
                        false
                      );
                    }
                  : undefined
              }
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
                        ? { ...s, fill: newColor, opacity: newOpacity, fills: updatedFills, fillStyleId: undefined }
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
        {/* MODO APRESENTAÇÃO                                                 */}
        {/* ================================================================= */}
        {presentFrameId && (
          <PrototypePlayer shapes={activePageShapes} startFrameId={presentFrameId} accentColor={accentColor} onClose={() => setPresentFrameId(null)} />
        )}

        {/* ================================================================= */}
        {/* CÓDIGO DO DESIGN                                                  */}
        {/* ================================================================= */}
        {codeShape && (
          <div onClick={() => setCodeShape(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 720, maxWidth: '92vw', height: '75vh', background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, color: tokens.textPrimary, fontFamily: "'Poppins', sans-serif" }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Código de “{codeShape.name || 'Tela'}”</span>
                {(['react', 'html', 'flutter'] as CodeTarget[]).map((t) => (
                  <button key={t} type="button" onClick={() => setCodeTarget(t)} style={{ background: codeTarget === t ? `${accentColor}33` : 'transparent', border: `1px solid ${codeTarget === t ? accentColor : tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                    {t === 'react' ? 'React' : t === 'html' ? 'HTML' : 'Flutter'}
                  </button>
                ))}
                <button type="button" onClick={() => setCodeShape(null)} style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <pre style={{ flex: 1, margin: 0, overflow: 'auto', background: tokens.bgCardSecondary, borderRadius: 8, padding: 12, fontSize: 11, lineHeight: 1.5, fontFamily: "'JetBrains Mono', Menlo, monospace", userSelect: 'text', whiteSpace: 'pre' }}>{codeText}</pre>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(codeText); onToast?.('Código copiado'); }} style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Copiar</button>
                <button type="button" onClick={handleSaveCodeToProject} style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Salvar no projeto</button>
                {onSendToChat && (
                  <button type="button" onClick={handleAskAiToImplement} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Pedir à IA para implementar</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* HISTÓRICO DE VERSÕES                                              */}
        {/* ================================================================= */}
        {isFramesOpen && (
          <FramesPopup
            tokens={tokens}
            accentColor={accentColor}
            onClose={() => setIsFramesOpen(false)}
            onPick={async (preset) => {
              const icons = await loadIcons().catch(() => undefined);
              const z = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 2 : 2;
              const dev = buildDevicePreset(preset, {
                idGen: () => crypto.randomUUID(),
                pageId: selectedPageId,
                x: Math.round(viewport.x + viewport.width / 2 - preset.width / 2),
                y: Math.round(viewport.y + viewport.height / 2 - preset.height / 2),
                z,
                isDark: false,
                icons,
              });
              applyShapes([...shapes, ...dev.shapes], true);
              handleSelectSingle(dev.rootId);
            }}
          />
        )}

        {isProposalOpen && (
          <ProposalPopup tokens={tokens} accentColor={accentColor} frameNames={proposalFrames.map((f) => f.name)} onClose={() => setIsProposalOpen(false)} onGenerate={handleGenerateProposal} />
        )}

        {isUnsplashOpen && (
          <UnsplashKeyPopup tokens={tokens} accentColor={accentColor} onClose={() => setIsUnsplashOpen(false)} onSaved={(has) => onToast?.(has ? 'Chave do Unsplash salva' : 'Chave removida: a IA usará fotos do picsum.photos')} />
        )}

        {isIconPickerOpen && (
          <IconPickerModal
            tokens={tokens}
            accentColor={accentColor}
            onClose={() => setIsIconPickerOpen(false)}
            onPick={(name, d) => {
              const size = 24;
              const parent = selectedFrame && selectedFrame.type === 'frame' ? selectedFrame : undefined;
              const cx = parent ? parent.x + parent.width / 2 : viewport.x + viewport.width / 2;
              const cy = parent ? parent.y + parent.height / 2 : viewport.y + viewport.height / 2;
              const shape = iconShape({ [name]: d }, name, {
                id: crypto.randomUUID(),
                pageId: selectedPageId,
                parentId: parent?.id,
                x: Math.round(cx - size / 2),
                y: Math.round(cy - size / 2),
                size,
                fill: isEffectiveDark ? '#FFFFFF' : '#111111',
                zIndex: shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) + 1 : 1,
              });
              applyShapes([...shapes, shape], true);
              handleSelectSingle(shape.id);
            }}
          />
        )}

        {isFigmaImportOpen && (
          <FigmaImportModal
            tokens={tokens}
            accentColor={accentColor}
            onClose={() => setIsFigmaImportOpen(false)}
            onImport={(newPages, newShapes, note) => {
              if (newPages.length) {
                setPages((prev) => [...prev, ...newPages]);
                setSelectedPageId(newPages[0].id);
              }
              // sem páginas novas (nó solto): vai para a página atual
              const target = selectedPageId;
              const placed = newPages.length ? newShapes : newShapes.map((s) => ({ ...s, pageId: target }));
              applyShapes([...shapes, ...placed], true);
              onToast?.(note);
            }}
          />
        )}

        {isVersionsOpen && (
          <div
            onClick={() => setIsVersionsOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 440, maxHeight: '70vh', background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, color: tokens.textPrimary, fontFamily: "'Poppins', sans-serif" }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Histórico de versões</span>
                <button type="button" onClick={handleSaveVersion} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>Salvar versão agora</button>
                <button type="button" onClick={() => setIsVersionsOpen(false)} style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {versions.length === 0 && <span style={{ fontSize: 12, color: tokens.textSecondary, padding: 8 }}>Nenhuma versão salva ainda.</span>}
                {versions.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: tokens.bgCardSecondary }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.label}</div>
                      <div style={{ fontSize: 10, color: tokens.textSecondary }}>{new Date(v.createdAt).toLocaleString('pt-BR')} • {v.shapeCount} elementos</div>
                    </div>
                    <button type="button" onClick={() => handleRestoreVersion(v)} style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>Restaurar</button>
                    <button type="button" onClick={() => handleDeleteVersion(v)} title="Excluir versão" style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
            onChange={(patch: Partial<Shape>) => {
              if (!selectedShape) return;
              // Editar a cor/tipografia à mão desliga o estilo do documento naquele elemento
              if (selectedShape.fillStyleId && ('fills' in patch || 'fill' in patch) && !('fillStyleId' in patch)) patch = { ...patch, fillStyleId: undefined };
              if (selectedShape.textStyleId && ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight'].some((k) => k in patch) && !('textStyleId' in patch)) patch = { ...patch, textStyleId: undefined };
              // Alterar uma instância registra o que foi sobrescrito (o componente não reverte essas propriedades)
              if (selectedShape.sourceId) {
                const keys = Object.keys(patch).filter((k) => k !== 'x' && k !== 'y' && k !== 'overrides');
                if (keys.length > 0) patch = { ...patch, overrides: Array.from(new Set([...(selectedShape.overrides || []), ...keys])) };
              }
              let next = shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s));
              // Editar X/Y de um frame/grupo leva os filhos junto
              const dx = typeof patch.x === 'number' ? patch.x - selectedShape.x : 0;
              const dy = typeof patch.y === 'number' ? patch.y - selectedShape.y : 0;
              if (dx !== 0 || dy !== 0) {
                const children = shapes.filter((c) => c.parentId === selectedShape.id).map((c) => [c.id, { dx, dy }] as const);
                if (children.length > 0) next = applyDeltas(next, new Map(children));
              }
              applyShapes(next, true);
            }}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            selectionCount={selectedIds.length}
            onBoolean={handleBoolean}
            onFitSelection={handleFitSelection}
            onCreateInstance={handleCreateInstance}
            variantOptions={selectedShape?.instanceOf ? variantsOf(activePageShapes, selectedShape.instanceOf).map((c) => ({ id: c.id, name: c.variantName || c.name || 'Variante' })) : []}
            onSwitchVariant={handleSwitchVariant}
            onShowCode={(sh) => setCodeShape(sh)}
            prototypeFrames={activePageShapes.filter((s) => s.type === 'frame').map((s) => ({ id: s.id, name: s.name || 'Frame' }))}
            onPresent={(id) => setPresentFrameId(id)}
            variables={variables}
            modes={modes}
            activeModeId={activeModeId}
            onCreateVariable={handleCreateVariable}
            onBindVariable={handleBindVariable}
            onUpdateVariable={handleUpdateVariable}
            onDeleteVariable={handleDeleteVariable}
            onSetMode={handleSetMode}
            styles={styles}
            onCreateStyle={handleCreateStyle}
            onApplyStyle={handleApplyStyle}
            onUpdateStyle={handleUpdateStyle}
            onRenameStyle={handleRenameStyle}
            onDeleteStyle={handleDeleteStyle}
            onDetachInstance={handleDetachInstance}
            onFocusSelection={handleFocusSelection}
            activeColorPicker={activeColorPicker}
            onActiveColorPickerChange={setActiveColorPicker}
            isStrokeSettingsOpen={isStrokeSettingsOpen}
            onStrokeSettingsOpenChange={setIsStrokeSettingsOpen}
            activeEffectId={activeEffectId}
            onActiveEffectIdChange={setActiveEffectId}
            isTypeSettingsOpen={isTypeSettingsOpen}
            onTypeSettingsOpenChange={setIsTypeSettingsOpen}
            onExport={handleExportShape}
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
                onHost={(name, allowEdit) => room.hostRoom(name, shapes, allowEdit)}
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
        message={deleteTarget && selectedIds.length > 1 && selectedIds.includes(deleteTarget.id) ? `Tem certeza que deseja excluir os ${selectedIds.length} elementos selecionados (e o que há dentro deles)? Esta ação não pode ser desfeita.` : `Tem certeza que deseja excluir "${deleteTarget?.name || 'este elemento'}" e tudo o que há dentro dele? Esta ação não pode ser desfeita.`}
        itemDescription={
          deleteTarget
            ? selectedIds.length > 1 && selectedIds.includes(deleteTarget.id)
              ? `${selectedIds.length} elementos selecionados`
              : `${deleteTarget.type.toUpperCase()} • ${Math.round(deleteTarget.width)} × ${Math.round(deleteTarget.height)}px`
            : undefined
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        themeTokens={tokens}
        accentColor={accentColor}
        onConfirm={() => {
          if (deleteTarget) {
            // com várias camadas selecionadas, exclui todas; sempre junto com os descendentes
            const roots = selectedIds.includes(deleteTarget.id) ? selectedIds : [deleteTarget.id];
            const gone = new Set<string>(roots);
            roots.forEach((id) => descendantIds(shapes, id).forEach((d) => gone.add(d)));
            applyShapes(shapes.filter((s) => !gone.has(s.id)), true);
            setAiReview((prev) => prev.filter((r) => !gone.has(r.id)));
            handleSelectMultiple([]);
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

