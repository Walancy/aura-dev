import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  PanelLeft,
  PanelRight,
  Palette,
  Share2,
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
import { applyVariables, createColorVariable, createTypedVariable, DEFAULT_MODES } from './variables';

type VariablesList = DesignVariable[];
import { applyStyles, STYLE_FIELD, styleFromShape, type StyleKind } from './styles';
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
import { descendantIds, resizeDescendants } from './constraints';
import { iconShape, loadIcons } from './icons';
import { applyAiEdits, buildAiEditPrompt, editScope } from './aiEdit';
import { AiJsonStream, type AiStreamEvent } from './aiJsonStream';
import { buildProjectDigest } from './projectDigest';
import { fetchStockImage } from './stockImage';
import { findFreeSpot } from './freeSpot';
import { lowEffortModel, resolveCliModel, visionModel } from './aiModel';
import { analyzeReferenceImages } from './referenceAnalysis';
import { describeScreenStyle } from './screenStyle';
import { fixLayout } from './layoutFix';
import { reorderLayers } from './layersOrder';
import { collectSelectionColors, replaceSelectionColor } from './selectionColors';
import { STYLE_MODE_MARK, wantsNewScreens } from './screenFlow';
import { listProjectAssets } from './projectAssets';
import { applyModeScope, applyTokensSection, buildTokensGenPrompt, buildTokensSectionPrompt, type TokenSection, normalizeTokens, parseTokens, tokensFromShapes, type DesignTokens } from './designTokens';
import { ensureGoogleFont } from './fonts';
import { setMeasureFamily } from './textFit';
import DesignTokensPanel, { DesignTokensComposer } from './DesignTokensPanel';
import DesignSettingsPanel, { type ViewPrefKey, type ViewPrefs } from './DesignSettingsPanel';
import { buildPlanPrompt, looksMultiScreen, parsePlan, screenPrompt } from './appPlan';
import { restorePrevious, reviewAfterUndo, withPrevious, type AiReviewEntry } from './aiReviewUndo';
import { readProjectShapes, readProjectTokens, updateProjectShapes } from './projectDoc';
import FramesPopup from './FramesPopup';
import ProposalPopup from './ProposalPopup';
import { buildProposalHtml, buildProposalPrompt, collectFrameContext, parseProposal } from './proposal';
import UnsplashKeyPopup from './UnsplashKeyPopup';
import RenamePopup from './RenamePopup';
import AssetsPopup from './AssetsPopup';
import AuditPopup from './AuditPopup';
import DevPanel from './DevPanel';
import { COLOR_BLIND } from './colorBlind';
import { cssOf, specsOf } from './devSpecs';
import DiffPopup from './DiffPopup';
import { diffShapes, type ShapesDiff } from './diffShapes';
import { applyAuditFix } from './audit';
import VariantMatrixPopup from './VariantMatrixPopup';
import { arrangeVariants, createVariantMatrix } from './variantMatrix';
import { buildDevice, buildDevicePreset } from './devices';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { getActiveBrainContextSync, generateBrainAiContext } from '../../utils/brainService';
import { buildAiScreenPrompt, parseAiScreenResponse, requestAiScreenRaw, ScreenBuilder, guessScreenFormat } from './aiScreenFromLlm';
import { buildExportSvg, downloadBlob, exportShape, rasterize } from './exportDesign';
import { tidyShapes } from './tidy';
import { outlineStroke } from './outlineStroke';
import { removeBackground } from './removeBg';
import { fixContrast } from './audit';
import { listRefs, matchRefs, readRef, saveRefs } from './references';
import { importSvg } from './svgImport';
import { pseudoLocalizeShapes, restoreLocalized } from './pseudoLoc';
import { PATH_TARGET_TYPES } from './textOnPath';
import { applyTextResize } from './textResize';
import { applyPatchToSelection, mixedKeys } from './multiEdit';
import { selectSimilar } from './selectSimilar';
import { opacityFromKey, type OpacityKeyState } from './opacityKeys';
import { copySubtree, pasteClip, replaceWithClip, type Clip } from './clipboard';
import { alignDeltas, alignReference, applyDeltas, distributeDeltas, type AlignMode, type AlignTarget } from './align';
import { unionBox } from './snap';
import { addAutoLayout, relayoutAll } from './autoLayout';
import { defaultPropValue, propTargets } from './componentProps';
import { createInstance, detachInstance, switchVariant, syncInstances, variantsOf } from './components';
import { duplicateShapes } from './duplicate';
import { componentName, type CodeTarget } from './codegen';
import { generateCodeAny } from './codegenNative';
import PrototypePlayer from './PrototypePlayer';
import type { RulerGuide } from './rulers';
import { deleteVersion, listVersions, loadVersion, saveVersion, type VersionEntry } from './versions';
import { booleanShapes, flattenShape, type BooleanOp } from './booleanOps';

interface DesignStudioViewProps {
  /** false quando a aba de Design está escondida (continua montada para a IA terminar de gerar) */
  isActive?: boolean;
  /** A IA terminou (ou falhou): o App avisa se o usuário estiver em outra tela */
  onAiTaskDone?: (r: { ok: boolean; message: string; workspace: string }) => void;
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
  const [outlineMode, setOutlineMode] = useState(false);
  const [colorBlind, setColorBlind] = useState('');
  // painel de propriedades (coluna da direita): pode ser ocultado para ganhar área de canvas
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('design_right_panel_open') !== '0'; } catch { return true; }
  });
  const toggleRightPanel = useCallback((v: boolean) => {
    setIsRightPanelOpen(v);
    try { localStorage.setItem('design_right_panel_open', v ? '1' : '0'); } catch {}
  }, []);
  const openTokensPanel = useCallback(() => {
    setRightPanelMode('tokens');
    toggleRightPanel(true);
  }, [toggleRightPanel]);
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
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isVariantMatrixOpen, setIsVariantMatrixOpen] = useState(false);
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
  const [viewPrefs, setViewPrefs] = useState<ViewPrefs>(() => {
    const base: ViewPrefs = { grid: false, rulers: false, snap: true, guides: true, rulerRelative: true, pixelSnap: false, pixelGrid: true };
    try { return { ...base, ...JSON.parse(localStorage.getItem('design_view_prefs') || '{}') }; } catch { return base; }
  });
  // Guias arrastadas das réguas, por página (salvas no documento)
  const [guidesByPage, setGuidesByPage] = useState<Record<string, RulerGuide[]>>({});
  const toggleViewPref = useCallback((key: ViewPrefKey) => {
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
  const opacityKeyRef = useRef<OpacityKeyState | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const clipboardShape = clip ? clip.shapes.find((s) => s.id === clip.rootIds[0]) || null : null;
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

  // Design tokens do projeto (salvos no design.json): a IA segue estes valores quando existem
  const [designTokens, setDesignTokens] = useState<DesignTokens | null>(null);
  const designTokensRef = useRef<DesignTokens | null>(null);
  designTokensRef.current = designTokens;
  // a fonte dos tokens vale para o canvas (carrega do Google Fonts) e para medir/quebrar os textos
  useEffect(() => {
    const f = designTokens && designTokens.enabled !== false ? designTokens.fontFamily : null;
    if (f) ensureGoogleFont(f);
    setMeasureFamily(f);
  }, [designTokens]);
  // fontes usadas pelos textos do design (ex.: Inter, Roboto): carrega do Google Fonts se não estiverem instaladas
  const fontFamiliesKey = useMemo(() => [...new Set(shapes.filter((x) => x.type === 'text' && x.fontFamily).map((x) => x.fontFamily as string))].slice(0, 8).join('|'), [shapes]);
  useEffect(() => {
    fontFamiliesKey.split('|').filter(Boolean).forEach((f) => ensureGoogleFont(f));
  }, [fontFamiliesKey]);
  // o que a coluna da direita mostra: propriedades do elemento ou os design tokens do projeto
  const [rightPanelMode, setRightPanelMode] = useState<'properties' | 'tokens' | 'settings' | 'dev'>('properties');
  const [isPanelMenuOpen, setIsPanelMenuOpen] = useState(false);
  // última troca em massa dos tokens (extrair/gerar com IA): permite reverter para o que havia antes
  const [tokensUndo, setTokensUndo] = useState<{ previous: DesignTokens | null; label: string; section: 'all' | 'colors' | TokenSection } | null>(null);
  // selecionar um elemento com as configurações abertas volta ao inspetor (Propriedades)
  useEffect(() => {
    if (selectedIds.length > 0) setRightPanelMode((m) => (m === 'settings' ? 'properties' : m));
  }, [selectedIds]);
  const {
    loadedShapes,
    loadedPages,
    loadedSelectedPageId,
    loadedPageViewports,
    loadedStyles,
    loadedVariables,
    loadedGuides,
    loadedTokens,
    isLoading,
  } = usePersistedDesign(workspacePath, shapes, pages, selectedPageId, pageViewports, readOnly, styles, { list: variables, modes, activeModeId }, guidesByPage, designTokens);

  useEffect(() => {
    if (loadedGuides) setGuidesByPage(loadedGuides);
  }, [loadedGuides]);

  useEffect(() => {
    if (!isLoading) setDesignTokens(loadedTokens);
  }, [loadedTokens, isLoading]);

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
    if (loadedShapes) {
      // também quando está vazia: apagar tudo e recarregar não pode trazer os exemplos de volta
      setShapesRaw(loadedShapes);
      historyRef.current = { stack: [loadedShapes], index: 0 };
      // projeto sem páginas salvas: páginas padrão (não herda as do projeto anterior)
      if (!(loadedPages && loadedPages.length > 0)) setPages(DEFAULT_PAGES);
      if (!loadedSelectedPageId) setSelectedPageId(DEFAULT_PAGES[0].id);
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

  /** Centraliza o canvas no elemento (e afasta o zoom só se ele não couber na tela) */
  const focusOnShape = useCallback(
    (id: string) => {
      const list = shapesRef.current;
      const s = list.find((x) => x.id === id);
      if (!s) return;
      // grupos podem ter tamanho 0: usa a caixa dos descendentes
      let box = { x: s.x, y: s.y, w: s.width, h: s.height };
      if (!(s.width > 0 && s.height > 0)) {
        const kids = list.filter((k) => descendantIds(list, id).includes(k.id));
        if (kids.length) {
          const minX = Math.min(...kids.map((k) => k.x));
          const minY = Math.min(...kids.map((k) => k.y));
          box = { x: minX, y: minY, w: Math.max(...kids.map((k) => k.x + k.width)) - minX, h: Math.max(...kids.map((k) => k.y + k.height)) - minY };
        }
      }
      // enquadra a camada (como "zoom para a seleção"): reduz se for grande e AMPLIA se for pequena (até 200%)
      const fit = Math.min((viewport.width * zoom * 0.7) / Math.max(1, box.w), (viewport.height * zoom * 0.7) / Math.max(1, box.h));
      const z = Math.min(2, Math.max(0.05, Number(fit.toFixed(3))));
      if (z !== zoom) setZoom(z);
      setTargetCamera({ x: box.x + box.w / 2, y: box.y + box.h / 2, zoom: z, timestamp: Date.now() });
    },
    [viewport, zoom]
  );

  const applyActivePageShapes = useCallback(
    (nextActive: Shape[], commit: boolean = true) => {
      const tagged = nextActive.map((s) =>
        s.pageId === selectedPageId ? s : { ...s, pageId: selectedPageId }
      );
      setShapesRaw((prev) => {
        const otherPageShapes = prev.filter((s) => (s.pageId || 'page-1') !== selectedPageId);
        // Ao confirmar a mudança, frames com auto layout reorganizam os filhos (e fazem hug)
        const combined = [...otherPageShapes, ...(commit ? relayoutAll(applyTextResize(syncInstances(applyVariables(applyStyles(tagged, stylesRef.current), variablesRef.current.list, variablesRef.current.modeId)))) : tagged)];
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
      const next = commit ? relayoutAll(applyTextResize(syncInstances(applyVariables(applyStyles(rawNext, stylesRef.current), variablesRef.current.list, variablesRef.current.modeId)))) : rawNext;
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

  const multiSelected = useMemo(() => (selectedIds.length > 1 ? activePageShapes.filter((s) => selectedIds.includes(s.id)) : []), [selectedIds, activePageShapes]);

  const selectedFrame = useMemo(() => {
    if (!selectedShape) return null;
    if (selectedShape.type === 'frame') return selectedShape;
    if (selectedShape.parentId) {
      return activePageShapes.find((s) => s.id === selectedShape.parentId && s.type === 'frame') || null;
    }
    return null;
  }, [selectedShape, activePageShapes]);

  // Copia a seleção (ou só o elemento do menu, se ele não estiver selecionado) com todos os descendentes
  const handleCopy = useCallback((shape: Shape) => {
    const ids = selectedIds.includes(shape.id) ? selectedIds : [shape.id];
    const next = copySubtree(shapes, ids);
    if (!next) return;
    setClip(next);
    try {
      navigator.clipboard.writeText(JSON.stringify(next.shapes.find((s) => s.id === next.rootIds[0]), null, 2));
    } catch (_) { }
  }, [selectedIds, shapes]);

  // Última versão do inserir-imagem (soltar vários arquivos precisa enxergar o estado já atualizado)
  const insertImageRef = useRef(handleInsertImage);
  insertImageRef.current = handleInsertImage;

  const handlePaste = useCallback(async (coords?: { x: number; y: number }, inPlace = false) => {
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
    if (!clip) return;
    const { shapes: pasted, newRootIds } = pasteClip(clip, shapes, coords ? { at: { x: Math.round((coords.x - 300) / zoom), y: Math.round((coords.y - 100) / zoom) }, pageId: selectedPageId } : { offset: inPlace ? { x: 0, y: 0 } : { x: 30, y: 30 }, pageId: selectedPageId });
    applyShapes([...shapes, ...pasted], true);
    setSelectedIds(newRootIds);
    setSelectedId(newRootIds[0]);
  }, [clip, shapes, selectedPageId, zoom, applyShapes, handleInsertImage]);

  const handlePasteToReplace = useCallback((target: Shape) => {
    if (!clip) return;
    const r = replaceWithClip(clip, shapes, target.id);
    if (!r) return;
    applyShapes(r.shapes, true);
    setSelectedIds([r.newRootId]);
    setSelectedId(r.newRootId);
  }, [clip, shapes, applyShapes]);

  // Copiar como SVG/PNG/CSS/código (Cmd/Ctrl+Shift+C copia como PNG)
  const handleCopyAs = useCallback(async (format: 'svg' | 'png' | 'css' | 'code') => {
    if (!selectedShape) return;
    try {
      if (format === 'svg') {
        await navigator.clipboard.writeText(buildExportSvg(shapes, selectedShape, 1).svg);
      } else if (format === 'png') {
        const { svg, bounds } = buildExportSvg(shapes, selectedShape, 2);
        const blob = await rasterize(svg, Math.max(1, Math.round(bounds.width * 2)), Math.max(1, Math.round(bounds.height * 2)), 'image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else if (format === 'css') {
        await navigator.clipboard.writeText(cssOf(specsOf(selectedShape, activePageShapes, styles, variables, activeModeId)));
      } else {
        await navigator.clipboard.writeText(generateCodeAny('react', activePageShapes, selectedShape));
      }
      onToast?.(`Copiado como ${format === 'code' ? 'código React' : format.toUpperCase()}`);
    } catch (err) {
      onToast?.(`Não foi possível copiar: ${err instanceof Error ? err.message : 'erro'}`);
    }
  }, [selectedShape, shapes, activePageShapes, styles, variables, activeModeId, onToast]);

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

  // Outline stroke: o traço vira um caminho preenchido (união dos segmentos com pontas/quinas redondas)
  // Remover fundo da imagem com o rembg local; sem ele, o toast explica como instalar
  const handleRemoveBackground = useCallback(async (shape: Shape) => {
    const api = window.electronAPI;
    if (!shape.imageUrl || !api?.fs?.saveTempImage || !api?.fs?.readFileDataUrl || !api?.shell?.exec) return onToast?.('Disponível apenas no app desktop');
    onToast?.('Removendo o fundo…');
    const r = await removeBackground(shape.imageUrl, {
      saveTempImage: api.fs.saveTempImage,
      exec: (c) => api.shell.exec(c),
      readDataUrl: (p) => api.fs.readFileDataUrl!(p, 30 * 1024 * 1024),
    });
    if (!r.dataUrl) return onToast?.(r.error || 'Não foi possível remover o fundo');
    applyShapes(shapes.map((s) => (s.id === shape.id ? { ...s, imageUrl: r.dataUrl } : s)), true);
    onToast?.('Fundo removido');
  }, [shapes, applyShapes, onToast]);

  // Importar SVG: vira um frame com os elementos como shapes
  const importSvgFile = useCallback(async (file: File, at?: { x: number; y: number }) => {
    const text = await file.text();
    const pos = at || { x: Math.round(viewport.x + viewport.width / 2 - 100), y: Math.round(viewport.y + viewport.height / 2 - 100) };
    const imported = importSvg(text, file.name.replace(/\.svg$/i, ''), pos, () => crypto.randomUUID(), selectedPageId);
    if (!imported) return onToast?.('Não consegui ler este SVG');
    const z = shapes.length ? Math.max(...shapes.map((s) => s.zIndex)) : 0;
    applyShapes([...shapes, ...imported.map((s, i) => ({ ...s, zIndex: z + 1 + i }))], true);
    setSelectedIds([imported[0].id]);
    setSelectedId(imported[0].id);
    onToast?.(`SVG importado: ${imported.length - 1} elementos`);
  }, [shapes, viewport, selectedPageId, applyShapes, onToast]);

  const handleOutlineStroke = useCallback((shape: Shape) => {
    const r = outlineStroke(shapes, shape.id, crypto.randomUUID());
    if (!r) {
      onToast?.('Este elemento não tem traço visível para converter');
      return;
    }
    applyShapes(r.shapes, true);
    setSelectedIds([r.selectId]);
    setSelectedId(r.selectId);
  }, [shapes, applyShapes, onToast]);

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

      // Modo contorno (Cmd/Ctrl+Y) e modo foco (Cmd/Ctrl+\\: esconde ou volta os dois painéis)
      if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyY') {
        e.preventDefault();
        setOutlineMode((v) => !v);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.code === 'Backslash') {
        e.preventDefault();
        const open = !(isSidebarOpen || isRightPanelOpen);
        setIsSidebarOpen(open);
        toggleRightPanel(open);
        return;
      }

      // Modo Dev (Shift+D)
      if (e.shiftKey && !mod && !e.altKey && e.code === 'KeyD') {
        e.preventDefault();
        setRightPanelMode((m) => (m === 'dev' ? 'properties' : 'dev'));
        return;
      }

      // Assets (Shift+I)
      if (e.shiftKey && !mod && !e.altKey && e.code === 'KeyI') {
        e.preventDefault();
        setIsAssetsOpen((v) => !v);
        return;
      }

      // Renomear a seleção em massa (F2)
      if (e.key === 'F2' && !mod && selectedIds.length > 0) {
        e.preventDefault();
        setIsRenameOpen(true);
        return;
      }

      // Organizar (Ctrl/Cmd+Alt+T)
      if (mod && e.altKey && !e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        keyActionsRef.current.handleTidy();
        return;
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

      // Copiar como PNG (Cmd/Ctrl+Shift+C)
      if (mod && e.shiftKey && !e.altKey && e.code === 'KeyC' && selectedShape) {
        e.preventDefault();
        handleCopyAs('png');
        return;
      }

      // Context menu action shortcuts
      if (mod && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
        if (selectedShape) {
          e.preventDefault();
          handleCopy(selectedShape);
          return;
        }
      } else if (mod && e.key.toLowerCase() === 'v' && !e.altKey) {
        // Cmd/Ctrl+V cola deslocado; Cmd/Ctrl+Shift+V cola no mesmo lugar
        e.preventDefault();
        handlePaste(undefined, e.shiftKey);
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

      // Opacidade pelo teclado: 1…9 = 10…90%, 0 = 100%, dois dígitos rápidos = valor exato
      if (!mod && !e.altKey && !e.shiftKey && /^Digit[0-9]$/.test(e.code) && selectedIds.length > 0) {
        const r = opacityFromKey(opacityKeyRef.current, e.code.slice(5), Date.now());
        if (r) {
          e.preventDefault();
          opacityKeyRef.current = r.state;
          applyShapes(shapes.map((s) => (selectedIds.includes(s.id) ? { ...s, opacity: r.opacity } : s)), true);
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
    handleCopyAs,
    isSidebarOpen,
    isRightPanelOpen,
    toggleRightPanel,
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
  const [alignTarget, setAlignTarget] = useState<AlignTarget>(() => {
    try { return (localStorage.getItem('design_align_target') as AlignTarget) || 'auto'; } catch { return 'auto'; }
  });
  const changeAlignTarget = useCallback((t: AlignTarget) => {
    setAlignTarget(t);
    try { localStorage.setItem('design_align_target', t); } catch {}
  }, []);
  // Organizar (Tidy up): arruma a seleção em linhas/colunas com vão igual
  const handleTidy = useCallback(() => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
    if (ids.length < 2) {
      onToast?.('Selecione 2 ou mais elementos para organizar');
      return;
    }
    const deltas = tidyShapes(shapes, ids);
    if (deltas.size === 0) return;
    applyShapes(applyDeltas(shapes, deltas), true);
  }, [selectedIds, selectedShape, shapes, applyShapes, onToast]);

  // Pseudolocalização: testa o layout com textos acentuados e ~30% mais longos (reversível)
  const handlePseudoLoc = useCallback((restore: boolean) => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
    if (ids.length === 0) {
      onToast?.('Selecione os elementos cujos textos serão pseudolocalizados');
      return;
    }
    applyShapes(restore ? restoreLocalized(shapes, ids) : pseudoLocalizeShapes(shapes, ids), true);
  }, [selectedIds, selectedShape, shapes, applyShapes, onToast]);

  const handleAlign = useCallback(
    (alignment: AlignMode) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      const targets = activePageShapes.filter((s) => ids.includes(s.id));
      if (targets.length === 0) return;
      const parent = targets[0].parentId ? shapes.find((s) => s.id === targets[0].parentId) : null;
      const { ref, margin } = alignReference(
        targets.map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height })),
        parent ? { x: parent.x, y: parent.y, width: parent.width, height: parent.height } : null,
        viewport,
        alignTarget
      );
      applyShapes(applyDeltas(shapes, alignDeltas(shapes, ids, alignment, ref, margin)), true);
    },
    [selectedIds, selectedShape, activePageShapes, shapes, applyShapes, viewport, alignTarget]
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

  const handleCreateVariable = useCallback((kind: 'color' | 'number' | 'text' | 'boolean' = 'color') => {
    if (!selectedShape) return;
    const id = crypto.randomUUID();
    if (kind !== 'color') {
      const initial = kind === 'number' ? String(Math.round(selectedShape.width)) : kind === 'text' ? selectedShape.text || 'Texto' : String(selectedShape.visible !== false);
      commitVariables([...variables, createTypedVariable(kind, id, `${{ number: 'Número', text: 'Texto', boolean: 'Booleana' }[kind]} ${variables.length + 1}`, initial, modes)], activeModeId);
      return;
    }
    const first = selectedShape.fills && selectedShape.fills.length > 0 ? selectedShape.fills[0] : null;
    const v = createColorVariable(id, `Variável ${variables.length + 1}`, first?.color || selectedShape.fill || '#D9D9D9', modes);
    commitVariables([...variables, v], activeModeId);
    applyShapes(shapes.map((s) => (s.id === selectedShape.id ? { ...s, fillVariableId: id } : s)), true);
  }, [selectedShape, variables, modes, activeModeId, shapes, applyShapes, commitVariables]);

  // Liga uma variável de número/texto/booleana a uma propriedade dos elementos selecionados (ou desliga com `prop` vazio)
  const handleBindTypedVariable = useCallback(
    (variableId: string, prop: string | undefined) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      applyShapes(
        shapes.map((s) => {
          if (!ids.includes(s.id)) return s;
          const rest = Object.fromEntries(Object.entries(s.variableBindings || {}).filter(([, v]) => v !== variableId));
          const next = prop ? { ...rest, [prop]: variableId } : rest;
          return { ...s, variableBindings: Object.keys(next).length ? next : undefined };
        }),
        true
      );
    },
    [selectedIds, selectedShape, shapes, applyShapes]
  );

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
      applyShapes(
        shapes.map((s) => {
          if (s.fillVariableId !== variableId && !Object.values(s.variableBindings || {}).includes(variableId)) return s;
          const rest = Object.fromEntries(Object.entries(s.variableBindings || {}).filter(([, v]) => v !== variableId));
          return { ...s, fillVariableId: s.fillVariableId === variableId ? undefined : s.fillVariableId, variableBindings: Object.keys(rest).length ? rest : undefined };
        }),
        true
      );
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
    (kind: StyleKind) => {
      if (!selectedShape) return;
      const id = crypto.randomUUID();
      const count = styles.filter((s) => s.kind === kind).length + 1;
      const label = { color: 'Cor', text: 'Texto', effect: 'Efeito', grid: 'Grade' }[kind];
      const style = styleFromShape(kind, selectedShape, id, `${label} ${count}`);
      commitStyles([...styles, style]);
      applyShapes(shapes.map((s) => (s.id === selectedShape.id ? { ...s, [STYLE_FIELD[kind]]: id } : s)), true);
    },
    [selectedShape, styles, shapes, applyShapes, commitStyles]
  );

  const handleApplyStyle = useCallback(
    (style: DesignStyle) => {
      const ids = selectedIds.length > 0 ? selectedIds : selectedShape ? [selectedShape.id] : [];
      applyShapes(
        shapes.map((s) => (ids.includes(s.id) ? { ...s, [STYLE_FIELD[style.kind]]: style.id } : s)),
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
      const fresh = styleFromShape(old.kind, selectedShape, styleId, old.name);
      commitStyles(styles.map((s) => (s.id === styleId ? fresh : s)));
      applyShapes(shapes, true); // propaga o valor novo para todos os shapes ligados
    },
    [selectedShape, styles, shapes, applyShapes, commitStyles]
  );

  const handleRenameStyle = useCallback((styleId: string, name: string) => commitStyles(styles.map((s) => (s.id === styleId ? { ...s, name } : s))), [styles, commitStyles]);

  const handleDeleteStyle = useCallback(
    (styleId: string) => {
      commitStyles(styles.filter((s) => s.id !== styleId));
      applyShapes(shapes.map((s) => (s.fillStyleId === styleId || s.textStyleId === styleId || s.effectStyleId === styleId || s.gridStyleId === styleId ? { ...s, fillStyleId: s.fillStyleId === styleId ? undefined : s.fillStyleId, textStyleId: s.textStyleId === styleId ? undefined : s.textStyleId, effectStyleId: s.effectStyleId === styleId ? undefined : s.effectStyleId, gridStyleId: s.gridStyleId === styleId ? undefined : s.gridStyleId } : s)), true);
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

  // Comparar uma versão salva com o design atual
  const [diffView, setDiffView] = useState<{ label: string; diff: ShapesDiff } | null>(null);
  const handleCompareVersion = useCallback(async (v: VersionEntry) => {
    if (!workspacePath) return;
    const snap = await loadVersion(workspacePath, v.id);
    if (!snap) return onToast?.('Versão não encontrada');
    setDiffView({ label: v.label, diff: diffShapes(snap.shapes, shapes) });
  }, [workspacePath, shapes, onToast]);

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

  const codeText = useMemo(() => (codeShape ? generateCodeAny(codeTarget, activePageShapes, codeShape) : ''), [codeShape, codeTarget, activePageShapes]);

  const handleSaveCodeToProject = useCallback(async () => {
    if (!codeShape || !workspacePath) return;
    const ext = { react: 'tsx', html: 'html', flutter: 'dart', swiftui: 'swift', compose: 'kt' }[codeTarget];
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
    const label = { react: 'React (TSX)', html: 'HTML', flutter: 'Flutter', swiftui: 'SwiftUI', compose: 'Jetpack Compose' }[codeTarget];
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

  // Assets: insere uma instância do componente no centro da área visível
  const handleInsertComponent = useCallback(
    (componentId: string) => {
      const comp = shapes.find((s) => s.id === componentId);
      if (!comp) return;
      const cx = viewport.x + viewport.width / 2;
      const cy = viewport.y + viewport.height / 2;
      const inst = createInstance(shapes, componentId, { x: Math.round(cx - comp.x - comp.width / 2), y: Math.round(cy - comp.y - comp.height / 2) }).map((s) => ({ ...s, pageId: selectedPageId }));
      if (inst.length === 0) return;
      applyShapes([...shapes, ...inst], true);
      setSelectedIds([inst[0].id]);
      setSelectedId(inst[0].id);
    },
    [shapes, viewport, applyShapes, selectedPageId]
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
  const keyActionsRef = useRef({ handleAlign, handleDistribute, handleBoolean, handleTidy });
  keyActionsRef.current = { handleAlign, handleDistribute, handleBoolean, handleTidy };


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
  const [aiReview, setAiReview] = useState<AiReviewEntry[]>([]);

  // Usar o contexto do projeto da header nas gerações (README, docs, arquivos). Desligado: só o pedido e as imagens.
  const [useProjectContext, setUseProjectContext] = useState<boolean>(() => {
    try { return localStorage.getItem('design_use_project_context') !== '0'; } catch { return true; }
  });
  const toggleProjectContext = useCallback((v: boolean) => {
    setUseProjectContext(v);
    try { localStorage.setItem('design_use_project_context', v ? '1' : '0'); } catch {}
  }, []);
  // Modo rápido: usa a variante "(Low)" do modelo para gerar (nos testes, 12–25s contra ~100s com "(High)" e layout equivalente)
  const [fastMode, setFastMode] = useState<boolean>(() => {
    try { return localStorage.getItem('design_fast_mode') !== '0'; } catch { return true; }
  });
  const toggleFastMode = useCallback((v: boolean) => {
    setFastMode(v);
    try { localStorage.setItem('design_fast_mode', v ? '1' : '0'); } catch {}
  }, []);
  /** pasta neutra para a CLI quando o contexto está desligado (não "enxerga" o projeto pelo diretório de trabalho) */
  const NEUTRAL_CWD = '/tmp';

  // O processo principal do Electron só atualiza ao reiniciar o app: sem isso, imagens de referência e fotos da IA falham em silêncio
  const [mainOutdated, setMainOutdated] = useState(false);
  useEffect(() => {
    const caps = (window as any).electronAPI?.fs?.getCapabilities;
    if (!caps) { setMainOutdated(true); return; }
    caps().then((c: any) => setMainOutdated(!(c?.designAi >= 3))).catch(() => setMainOutdated(true));
  }, []);

  // modelo que a CLI do provedor ativo aceita (o "selecionado" global pode ser de outro provedor)
  const cliModel = useMemo(() => resolveCliModel(selectedAiProvider, selectedModel, activeModels), [selectedAiProvider, selectedModel, activeModels]);
  const genModel = useMemo(() => (fastMode ? lowEffortModel(selectedAiProvider, cliModel, activeModels) : cliModel), [fastMode, selectedAiProvider, cliModel, activeModels]);

  // ---------------- Design de um projeto (aberto ou não) ----------------
  // A geração por IA pertence ao projeto em que foi pedida: continua se o usuário trocar de projeto e grava lá.
  const workspaceRef = useRef(workspacePath);
  workspaceRef.current = workspacePath;
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  /** O projeto está aberto no Design e já carregado: as mudanças vão direto para a tela */
  const isVisible = (ws: string) => workspaceRef.current === ws && !isLoadingRef.current;
  /** Todas as shapes do projeto: da tela se estiver aberto; senão do arquivo salvo */
  const currentDoc = async (ws: string): Promise<Shape[]> => (isVisible(ws) ? shapesRef.current : readProjectShapes(ws));
  /** tokens do projeto `ws` (o aberto, ou lidos do arquivo quando a geração roda em outro projeto) */
  const getTokens = async (ws: string): Promise<DesignTokens | null> => {
    const t = isVisible(ws) ? designTokensRef.current : normalizeTokens(await readProjectTokens(ws));
    return t && t.enabled !== false ? t : null; // tokens desligados ("IA segue" off): a IA não os usa
  };
  /** Aplica a mudança no projeto: na tela se estiver aberto; senão direto no arquivo (só ao confirmar) */
  const applyDoc = useCallback(
    (ws: string, fn: (all: Shape[]) => Shape[], commit: boolean) => {
      if (isVisible(ws)) {
        setShapesRaw((prev) => {
          const next = fn(prev);
          const out = commit ? relayoutAll(applyTextResize(syncInstances(applyVariables(applyStyles(next, stylesRef.current), variablesRef.current.list, variablesRef.current.modeId)))) : next;
          room.broadcast(out);
          if (commit) {
            const h = historyRef.current;
            h.stack = h.stack.slice(0, h.index + 1);
            h.stack.push(out);
            h.index = h.stack.length - 1;
          }
          return out;
        });
      } else if (commit) {
        updateProjectShapes(ws, (all) => relayoutAll(fn(all))).catch(() => {});
      }
    },
    [room]
  );

  /** Brain do projeto + resumo dos arquivos (README, package.json, estrutura, cores) do projeto indicado */
  const getProjectContext = useCallback(
    async (ws: string) => {
      const digest = await buildProjectDigest(ws).catch(() => '');
      let brainText = '';
      try {
        const brain = ws ? getActiveBrainContextSync(ws) : null;
        brainText = brain ? generateBrainAiContext(brain).replace(/\s+/g, ' ').slice(0, 1500) : '';
      } catch {}
      const name = ws === workspacePath ? repoName : ws.split('/').filter(Boolean).pop();
      return [name ? `Projeto: ${name}.` : '', brainText, digest].filter(Boolean).join('\n').slice(0, 9500) || undefined;
    },
    [workspacePath, repoName]
  );

  /** Gera telas em tempo real no projeto `ws`: cada elemento aparece no canvas (se o projeto estiver aberto) assim que a IA o descreve. */
  const runScreenGeneration = useCallback(
    async (o: { useCtx?: boolean; referenceSpec?: string; previousEntry?: AiReviewEntry; ws: string; pageId: string; signal?: { cancelled: boolean }; prompt: string; basePrompt: string; referenceImages?: string[]; startX: number; startY: number; onProgress?: (m: string) => void; replaceFrameId?: string; maxScreens?: number; placeholderIds?: string[]; quiet?: boolean; inspiration?: string[] }) => {
      const { ws, pageId } = o;
      const icons = await loadIcons().catch(() => undefined);
      const useCtx = o.useCtx !== false;
      const cwd = useCtx ? ws : NEUTRAL_CWD;
      const projectContext = useCtx ? await getProjectContext(ws) : undefined;
      const projTokens = await getTokens(ws);
      const projectAssets = useCtx ? await listProjectAssets(ws).catch(() => []) : []; // logos e ícones do projeto (só com o contexto ligado)
      const aiReq = { tokens: projTokens, projectAssets: projectAssets.length ? projectAssets : undefined, prompt: o.prompt, pageId, startX: o.startX, startY: o.startY, accentColor, isDark: isEffectiveDark, icons, projectContext, // com imagens de referência a IA não explora o projeto: cada ferramenta/leitura extra é uma volta lenta do modelo
        canReadProject: useCtx && !!ws && !(o.referenceImages?.length || o.referenceSpec), useProjectContext: useCtx, maxScreens: o.maxScreens, referenceImages: o.referenceImages, referenceSpec: o.referenceSpec, inspirationImages: o.inspiration };

      // o que a regeração substitui (guardado para restaurar se cancelar)
      const doc0 = await currentDoc(ws);
      const removedShapes = o.replaceFrameId ? doc0.filter((s) => s.id === o.replaceFrameId || descendantIds(doc0, o.replaceFrameId!).includes(s.id)) : [];
      const removed = new Set(removedShapes.map((s) => s.id));
      let live: Shape[] = [];
      // ids que o builder já emitiu em algum momento: o que ele descartou depois (ex.: gráfico refeito no tamanho final) sai do documento
      const emitted = new Set<string>();
      const compose = (all: Shape[]) => {
        live.forEach((s) => emitted.add(s.id));
        return [...all.filter((s) => !removed.has(s.id) && !emitted.has(s.id)), ...live.map((s) => (s.pageId === pageId ? s : { ...s, pageId }))];
      };
      const apply = (commit = false) => applyDoc(ws, compose, commit);

      const builder = new ScreenBuilder(aiReq);
      const stream = new AiJsonStream();
      const queue: AiStreamEvent[] = [];
      let streamDone = false;
      let screenCount = 0;
      const imageJobs: Promise<void>[] = [];
      let imgFailed = 0;
      let imgError = '';
      let imgStarted = 0;
      const startImages = () => {
        while (imgStarted < builder.pending.length) {
          const job = builder.pending[imgStarted++];
          if (job.assetPath) {
            // logo/ícone do projeto: lê o arquivo (sem Unsplash)
            imageJobs.push(
              Promise.resolve((window as any).electronAPI?.fs?.readFileDataUrl?.(job.assetPath))
                .then((r: any) => {
                  if (o.signal?.cancelled || !r?.dataUrl) return;
                  builder.patch(job.id, { imageUrl: r.dataUrl });
                  live = builder.all;
                  apply(false);
                })
                .catch(() => {})
            );
            continue;
          }
          imageJobs.push(
            fetchStockImage(job.query, job.width, job.height)
              .then((r) => {
                if (!r) { imgFailed++; return; }
                if (o.signal?.cancelled) return;
                const cur = builder.all.find((s) => s.id === job.id);
                builder.patch(job.id, { imageUrl: r.dataUrl, name: r.credit ? `${cur?.name || 'Foto'} · Foto: ${r.credit} (Unsplash)` : cur?.name });
                live = builder.all;
                apply(false);
              })
              .catch((e) => { imgFailed++; imgError = String(e?.message || e); })
          );
        }
      };
      const handle = (ev: AiStreamEvent) => {
        if (ev.kind === 'screen') {
          o.placeholderIds?.forEach((id) => removed.add(id)); // a tela de verdade substitui o frame provisório
          const shapes = builder.startScreen(ev.header);
          if (!shapes.length) return;
          live = builder.all;
          apply(false);
          screenCount++;
          o.onProgress?.(`Criando a tela "${shapes[0].name}"…`);
          if (screenCount === 1 && isVisible(ws) && !o.quiet) {
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
      // Consumidor orientado a eventos: sem polling por timer (com a janela em segundo plano os timers são
      // estrangulados pelo navegador) e as pausas "de animação" só existem com a janela visível
      let wake: (() => void) | null = null;
      const poke = () => {
        const w = wake;
        wake = null;
        w?.();
      };
      const pause = (ms: number) => (document.visibilityState === 'visible' ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());
      const consumer = (async () => {
        while (!o.signal?.cancelled) {
          const ev = queue.shift();
          if (!ev) {
            if (streamDone) break;
            await new Promise<void>((r) => {
              wake = r;
              if (queue.length || streamDone || o.signal?.cancelled) poke();
            });
            continue;
          }
          handle(ev);
          await pause(queue.length > 10 ? 12 : ev.kind === 'item' ? 45 : 150);
        }
      })();

      o.onProgress?.(`Pedindo o layout para ${selectedAiProvider || 'a IA'}${useCtx && ws ? ' (analisando o projeto)' : ''}...`);
      let final = '';
      let failure: any = null;
      // enquanto a IA pensa (ainda sem nada para desenhar), mostra que está viva
      const startedAt = Date.now();
      const waitTimer = setInterval(() => {
        if (builder.itemCount === 0 && screenCount === 0) o.onProgress?.(`${selectedAiProvider || 'A IA'} está ${o.referenceImages?.length ? `analisando ${o.referenceImages.length} imagem(ns) e ` : ''}pensando no layout… ${Math.round((Date.now() - startedAt) / 1000)}s`);
      }, 1000);
      try {
        const ask = () => requestAiScreenRaw(buildAiScreenPrompt(aiReq), selectedAiProvider, genModel, cwd || undefined, 480000, (chunk) => { queue.push(...stream.push(chunk)); poke(); }, (o.referenceImages || []).map((p) => p.slice(0, p.lastIndexOf('/'))), 150000);
        // CLI sem nenhum texto em 150s = travada: uma nova tentativa quase sempre responde em ~1 min
        final = await ask().catch((e) => {
          if (!/^STALL/.test(String(e?.message)) || o.signal?.cancelled || builder.itemCount > 0) throw e;
          o.onProgress?.('A IA travou; tentando de novo…');
          return ask();
        });
        // CLIs que só devolvem no fim: o que não chegou em tempo real entra agora (aparece em sequência)
        if (stream.consumed === 0 && final) queue.push(...stream.push(final));
      } catch (err) {
        failure = err;
      }
      clearInterval(waitTimer);
      streamDone = true;
      poke();
      await consumer;
      if (o.signal?.cancelled) {
        // cancelado: descarta o que foi criado e restaura o que seria substituído
        const liveIds = new Set(live.map((s) => s.id));
        applyDoc(ws, (all) => [...all.filter((s) => !liveIds.has(s.id)), ...removedShapes.filter((r) => !all.some((s) => s.id === r.id))], false);
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
      if (imgFailed && !o.signal?.cancelled && isVisible(ws)) {
        onToast?.(/No handler registered/i.test(imgError) ? 'As fotos da IA precisam que você reinicie o app (o download de imagens ainda não está ativo)' : `${imgFailed} foto(s) não carregaram (ficaram como placeholder cinza)`);
      }

      const frameIds = builder.frameIds.length ? builder.frameIds : live.filter((s) => s.type === 'frame' && !s.parentId).map((s) => s.id);
      if (live.length === 0) {
        // sem layout da IA não inventamos um modelo fixo: avisa o usuário
        setAiReview((prev) => prev.map((r) => (r.id === o.replaceFrameId ? { ...r, busy: false } : r)));
        throw new Error(failure?.message || 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.');
      } else if (failure && isVisible(ws)) {
        onToast?.(`${failure?.message || 'A IA parou antes do fim'}; mantive o que já foi criado`);
      }
      builder.all = fixContrast(builder.all); // título escuro em fundo escuro etc.: corrige o contraste do que a IA desenhou
      live = builder.all;
      apply(true); // confirma: na tela (se o projeto estiver aberto) ou direto no arquivo do projeto
      setAiReview((prev) => [...prev.filter((r) => r.id !== o.replaceFrameId), ...frameIds.map((id) => { const sc = builder.screens_.find((x) => x.rootId === id); const base = { id, prompt: o.basePrompt, w: sc?.width, h: sc?.height, refs: o.referenceImages, refSpec: o.referenceSpec, useCtx }; return o.replaceFrameId ? withPrevious(base, removedShapes, o.previousEntry) : base; })]);
      if (isVisible(ws)) {
        if (!o.quiet) handleSelectSingle(frameIds[0] || null);
        if (!o.replaceFrameId && frameIds.length > 1) {
          const frames = live.filter((s) => frameIds.includes(s.id));
          const minX = Math.min(...frames.map((f) => f.x));
          const maxX = Math.max(...frames.map((f) => f.x + f.width));
          const z = Math.max(0.1, Math.min(0.65, (viewport.width * zoom * 0.9) / (maxX - minX)));
          setZoom(z);
          setTargetCamera({ x: (minX + maxX) / 2, y: frames[0].y + frames[0].height / 2, zoom: z, timestamp: Date.now() });
        }
      }
      return frameIds.length;
    },
    [accentColor, isEffectiveDark, selectedAiProvider, genModel, getProjectContext, applyDoc, handleSelectSingle, onToast, viewport, zoom]
  );

  const handlePrototypeWithAi = useCallback(
    async (prompt: string, onProgress?: (msg: string) => void, images?: string[], selection?: string[], signal?: { cancelled: boolean }, target?: { ws: string; pageId: string; useCtx?: boolean }) => {
      const clean = prompt.trim();
      if (!clean) return { success: false, error: 'O prompt não pode estar vazio.' };
      const ws = target?.ws ?? workspacePath;
      const pageId = target?.pageId ?? selectedPageId;
      const useCtx = (target?.useCtx ?? useProjectContext) !== false;
      const cwd = useCtx ? ws : NEUTRAL_CWD; // sem contexto, a CLI roda fora da pasta do projeto
      const onPage = (all: Shape[]) => all.filter((s) => (s.pageId || 'page-1') === pageId);
      // troca só a página do projeto, mantendo as demais
      const replacePage = (next: Shape[]) => (all: Shape[]) => [...all.filter((s) => (s.pageId || 'page-1') !== pageId), ...next.map((s) => (s.pageId === pageId ? s : { ...s, pageId }))];

      const projTokens = await getTokens(ws);
      let phIds: Set<string> | null = null; // frame provisório ("brilhando") enquanto a IA ainda não desenhou
      let phSpot: { x: number; y: number } | null = null;
      let glowRoot: string | null = null;
      let glowRoots: string[] = [];
      try {
        // imagens de referência: viram arquivos temporários que a CLI de IA abre pelo caminho
        const refs: string[] = [];
        for (const dataUrl of images || []) {
          const save = (window as any).electronAPI?.fs?.saveTempImage;
          if (!save) break;
          const r = await save(dataUrl.split(',')[1], 'jpg').catch(() => null);
          if (r?.path) refs.push(r.path);
        }
        if ((images?.length || 0) > refs.length) {
          // sem a imagem a IA geraria um design genérico: melhor parar e dizer o motivo
          return { success: false, error: 'Não consegui salvar as imagens de referência (a função não existe neste processo). Reinicie o app e envie de novo.' };
        }
        let refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];
        // só conta o que realmente existe e está visível nesta página (ids antigos/de outra página não são seleção)
        const pageShapes = onPage(await currentDoc(ws));
        const sel = selection ?? selectedIds; // seleção do momento em que o pedido foi enviado
        const liveIds = sel.filter((id) => pageShapes.some((s) => s.id === id && s.visible !== false));
        const firstSel = pageShapes.find((s) => s.id === liveIds[0]);
        const selFrame = firstSel ? (firstSel.type === 'frame' ? firstSel : pageShapes.find((s) => s.id === firstSel.parentId && s.type === 'frame') || null) : null;
        // aparelho selecionado: o alvo é a tela dentro dele
        const genTarget0 = selFrame ? pageShapes.find((s) => s.parentId === selFrame.id && s.deviceScreen) || selFrame : null;
        const hasContent = !!genTarget0 && pageShapes.some((s) => s.parentId === genTarget0.id && !s.deviceChrome);
        // Com tela(s) selecionada(s), o pedido pode ser CRIAR outras telas desse sistema seguindo o padrão delas (não editar)
        const fromSelection = liveIds.length > 0 && wantsNewScreens(clean);
        const genTarget = fromSelection ? null : genTarget0;
        let baseDims: { w: number; h: number } | null = null;
        let baseRight = 0, baseTop = 0;
        if (fromSelection) {
          const byIdS = new Map(pageShapes.map((x) => [x.id, x]));
          const rootIds = new Set<string>();
          for (const id of liveIds) { let cur = byIdS.get(id); while (cur?.parentId && byIdS.get(cur.parentId)) cur = byIdS.get(cur.parentId); if (cur) rootIds.add(cur.id); }
          const roots = [...rootIds].map((id) => byIdS.get(id)!).sort((a, b) => a.x - b.x).slice(0, 3);
          onProgress?.('Lendo a tela selecionada como guia de estilo…');
          for (const r of roots) {
            const screen = pageShapes.find((x) => x.parentId === r.id && x.deviceScreen) || r;
            if (!baseDims) baseDims = { w: Math.round(screen.width), h: Math.round(screen.height) };
            baseRight = Math.max(baseRight, r.x + r.width);
            baseTop = baseTop || r.y;
            try {
              const { blob } = await exportShape(shapesRef.current, screen, { id: 'ref', format: 'PNG', scale: '1x' });
              const b64 = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
              const saved = await (window as any).electronAPI?.fs?.saveTempImage?.(b64, 'png');
              if (saved?.path) refs.push(saved.path);
            } catch {}
          }
          if (!refs.length) return { success: false, error: 'Não consegui ler a tela selecionada como referência. Reinicie o app e tente de novo.' };
          refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];
        }

        // Biblioteca local de referências: o que você anexa é guardado (com etiquetas do pedido); sem anexo, as mais parecidas voltam como inspiração
        const refFs = (window as any).electronAPI?.fs;
        let inspiration: string[] = [];
        if (ws && refFs?.readFile && refFs?.writeFile) {
          if (images?.length) {
            saveRefs(ws, images, clean, refFs).then((l) => l.length && onToast?.(`${l.length} referência(s) na biblioteca`)).catch(() => {});
          } else if (!refs.length) {
            try {
              const hits = matchRefs(await listRefs(ws, refFs), clean, 2);
              for (const h of hits) {
                const url = await readRef(ws, h, refFs);
                const r = url && (await refFs.saveTempImage?.(url.split(',')[1], 'jpg').catch(() => null));
                if (r?.path) inspiration.push(r.path);
              }
              if (inspiration.length) refDirs = [...new Set([...refDirs, ...inspiration.map((p) => p.slice(0, p.lastIndexOf('/')))])];
            } catch {}
          }
        }

        // Tela nova (nada selecionado para editar): o frame já aparece e fica brilhando enquanto a IA analisa/pensa
        const editsSelection = !fromSelection && liveIds.length > 0 && (!selFrame || liveIds.length > 1 || hasContent);
        const aspect = images?.[0] ? await new Promise<number | undefined>((res) => { const im = new Image(); im.onload = () => res(im.width / (im.height || 1)); im.onerror = () => res(undefined); im.src = images[0]; }) : undefined;
        const fmt = baseDims ? { mobile: baseDims.w <= 500 && baseDims.h >= 600, width: baseDims.w, height: baseDims.h } : guessScreenFormat(clean, aspect);
        let hintedClean = clean;
        if (!editsSelection && !genTarget) {
          const visible0 = isVisible(ws);
          const spot0 = baseDims
            ? findFreeSpot(pageShapes, baseRight + 160, baseTop, baseDims.w + 80, baseDims.h + 80) // à direita da tela de referência
            : findFreeSpot(pageShapes, visible0 ? Math.round(viewport.x + viewport.width * 0.1) || 100 : 100, visible0 ? Math.round(viewport.y + 60) || 100 : 100, 460, 920);
          const dev = buildDevice(
            { name: 'Gerando…', width: fmt.width, height: fmt.height, kind: fmt.mobile ? 'iphone-island' : 'plain', radius: fmt.mobile ? 55 : 0 },
            { idGen: () => crypto.randomUUID(), pageId, x: spot0.x, y: spot0.y, z: 1, isDark: isEffectiveDark, name: 'Gerando…', icons: await loadIcons().catch(() => undefined) }
          );
          phIds = new Set(dev.shapes.map((x) => x.id));
          phSpot = spot0;
          applyDoc(ws, (all) => [...all, ...dev.shapes], false);
          setGlowIds((g) => new Set([...g, dev.rootId]));
          glowRoot = dev.rootId;
          if (baseDims) hintedClean = `${clean}\n\n${STYLE_MODE_MARK} As imagens anexadas são telas JÁ EXISTENTES deste sistema/app; crie as telas pedidas no MESMO padrão de design delas. Tamanho: ${baseDims.w}x${baseDims.h} (${fmt.mobile ? 'MOBILE' : 'DESKTOP'}); escreva exatamente esse width/height.`;
          else if (!aspect) hintedClean = `${clean}\n\n(Formato detectado: ${fmt.mobile ? 'MOBILE 393x852' : 'DESKTOP 1440x900'}. Use esse tamanho em "width"/"height".)`;
          if (visible0) {
            const z = fmt.mobile ? 0.65 : 0.48;
            setZoom(z);
            setTargetCamera({ x: spot0.x + dev.rootWidth / 2, y: spot0.y + dev.rootHeight / 2, zoom: z, timestamp: Date.now() });
          }
        } else if (genTarget) {
          glowRoot = selFrame?.id ?? genTarget.id;
          setGlowIds((g) => new Set([...g, glowRoot!]));
        }
        // Etapa 1: uma chamada só para olhar as imagens e descrever a interface (a geração recebe isso como regra)
        let spec: string | undefined;
        if (refs.length) {
          onProgress?.(`Analisando ${refs.length} imagem(ns) de referência…`);
          spec = await analyzeReferenceImages(refs, selectedAiProvider, visionModel(selectedAiProvider, cliModel, activeModels), cwd || undefined, refDirs).catch(() => undefined);
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          if (!spec) onProgress?.('Não consegui resumir as imagens; vou anexá-las direto…');
        }
        const specRefs = refs; // fidelidade máxima: a IA recebe a análise E as imagens originais para conferir

        // Seleção existente (que não seja um frame vazio): a IA EDITA o que está selecionado
        if (editsSelection) {
          const icons = await loadIcons().catch(() => undefined);
          // várias telas selecionadas: a mesma instrução é aplicada em CADA tela (uma chamada por tela, em paralelo)
          const byIdP = new Map(pageShapes.map((x) => [x.id, x]));
          const rootOf = (id: string) => { let cur = byIdP.get(id); while (cur?.parentId && byIdP.get(cur.parentId)) cur = byIdP.get(cur.parentId); return cur?.id ?? id; };
          const groups = new Map<string, string[]>();
          for (const id of liveIds) { const r = rootOf(id); groups.set(r, [...(groups.get(r) || []), id]); }
          if (groups.size >= 2) {
            const list = [...groups.entries()].sort((a, b) => (byIdP.get(a[0])?.x ?? 0) - (byIdP.get(b[0])?.x ?? 0));
            const N = list.length;
            let done = 0, changedTotal = 0, next = 0;
            const errors: string[] = [];
            let chain: Promise<void> = Promise.resolve(); // aplica uma tela por vez sobre o estado mais recente (sem sobrescrever as outras)
            const worker = async () => {
              while (next < N && !signal?.cancelled) {
                const [rootId, ids] = list[next++];
                const label = byIdP.get(rootId)?.name || 'tela';
                try {
                  const scope0 = editScope(pageShapes, ids);
                  const raw = await requestAiScreenRaw(
                    buildAiEditPrompt({ prompt: `${clean}\n\n(Esta é uma das ${N} telas selecionadas: aplique exatamente esta mudança nesta tela, de forma coerente com as demais.)`, accentColor, isDark: isEffectiveDark, referenceImages: specRefs, referenceSpec: spec, tokens: projTokens }, scope0, ids),
                    selectedAiProvider, genModel, cwd || undefined, 480000, undefined, refDirs
                  );
                  if (signal?.cancelled) return;
                  let pendingImgs: Array<{ id: string; query: string; width: number; height: number }> = [];
                  await (chain = chain.then(async () => {
                    const fresh = onPage(await currentDoc(ws));
                    const edited = applyAiEdits(raw, fresh, editScope(fresh, ids), ids, { pageId, isDark: isEffectiveDark, accentColor, icons, tokens: projTokens });
                    if (!edited) throw new Error('sem alterações válidas');
                    applyDoc(ws, replacePage(edited.shapes), true);
                    changedTotal += edited.changed + edited.added + edited.removed;
                    pendingImgs = edited.pending as any;
                    await new Promise((r) => setTimeout(r, 80)); // deixa o estado refletir antes da próxima tela
                  }));
                  if (pendingImgs.length) {
                    const imgs = await Promise.all(pendingImgs.map((j) => fetchStockImage(j.query, j.width, j.height).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
                    applyDoc(ws, (all) => all.map((x) => { const hit = imgs.find(([id]) => id === x.id)?.[1]; return hit ? { ...x, imageUrl: hit.dataUrl } : x; }), true);
                  }
                } catch (e: any) {
                  errors.push(`${label}: ${e?.message || 'falhou'}`);
                } finally {
                  done++;
                  onProgress?.(`Editando as telas selecionadas: ${done} de ${N}…`);
                }
              }
            };
            onProgress?.(`Aplicando a mudança em ${N} telas…`);
            await Promise.all(Array.from({ length: Math.min(3, N) }, worker));
            if (signal?.cancelled) return { success: false, error: 'cancelado' };
            if (errors.length === N) return { success: false, error: 'A IA não devolveu alterações válidas em nenhuma tela. Tente descrever a mudança de outra forma.' };
            if (isVisible(ws)) onToast?.(errors.length ? `IA: ${N - errors.length} de ${N} telas alteradas (${errors.map((x) => x.split(':')[0]).join(', ')} falharam)` : `IA: ${N} telas alteradas`);
            onAiTaskDone?.({ ok: true, message: errors.length ? `${N - errors.length} de ${N} telas alteradas` : `Alterações aplicadas em ${N} telas`, workspace: ws });
            return { success: true };
          }
          const scope0 = editScope(pageShapes, liveIds);
          onProgress?.(`Pedindo para ${selectedAiProvider || 'a IA'} editar ${liveIds.length} elemento(s) selecionado(s)...`);
          const raw = await requestAiScreenRaw(
            buildAiEditPrompt({ prompt: clean, accentColor, isDark: isEffectiveDark, referenceImages: specRefs, referenceSpec: spec, tokens: projTokens }, scope0, liveIds),
            selectedAiProvider, genModel, cwd || undefined, 480000, undefined, refDirs
          );
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          // aplica sobre o estado de AGORA (o usuário pode ter editado enquanto a IA respondia)
          const fresh = onPage(await currentDoc(ws));
          const scope = editScope(fresh, liveIds);
          const edited = applyAiEdits(raw, fresh, scope, liveIds, { pageId, isDark: isEffectiveDark, accentColor, icons, tokens: projTokens });
          if (!edited) { return { success: false, error: 'A IA não devolveu alterações válidas. Tente descrever a mudança de outra forma.' }; }
          let editedShapes = edited.shapes;
          if (edited.pending.length) {
            const imgs = await Promise.all(edited.pending.map((j) => fetchStockImage(j.query, j.width, j.height).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
            editedShapes = editedShapes.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; });
          }
          applyDoc(ws, replacePage(editedShapes), true);
          if (isVisible(ws)) onToast?.(`IA: ${edited.changed} alterado(s), ${edited.added} adicionado(s), ${edited.removed} removido(s)`);
          onAiTaskDone?.({ ok: true, message: 'Alterações aplicadas à seleção', workspace: ws });
          return { success: true };
        }

        // Frame vazio selecionado: gera o conteúdo dentro dele (sem tempo real)
        if (genTarget) {
          const icons = await loadIcons().catch(() => undefined);
          const aiReq = { tokens: projTokens, prompt: clean, pageId, startX: genTarget.x, startY: genTarget.y, accentColor, isDark: isEffectiveDark, targetFrame: genTarget, icons, canReadProject: useCtx && !!ws && !refs.length, useProjectContext: useCtx, referenceImages: specRefs, referenceSpec: spec, inspirationImages: inspiration };
          onProgress?.(`Pedindo o layout para ${selectedAiProvider || 'a IA'}...`);
          const generated = parseAiScreenResponse(await requestAiScreenRaw(buildAiScreenPrompt(aiReq), selectedAiProvider, genModel, cwd || undefined, 480000, undefined, refDirs), aiReq);
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          if (!generated) { return { success: false, error: 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.' }; }
          const fresh = onPage(await currentDoc(ws));
          // troca o conteúdo da tela (e tudo dentro dele), mantendo as peças do aparelho
          const inside = new Set(descendantIds(fresh, genTarget.id));
          const others = fresh.filter((s) => s.id !== genTarget.id && (!inside.has(s.id) || s.deviceChrome));
          const content = generated.shapes.filter((s) => s.id !== genTarget.id);
          let next = [...others, genTarget, ...content];
          if (generated.pending.length) {
            const imgs = await Promise.all(generated.pending.map((j) => fetchStockImage(j.query, j.width, j.height).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
            next = next.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; });
          }
          applyDoc(ws, replacePage(next), true);
          if (isVisible(ws)) handleSelectSingle(genTarget.id);
          onAiTaskDone?.({ ok: true, message: 'Conteúdo da tela gerado', workspace: ws });
          return { success: true };
        }

        // Pedido de várias telas (fluxo / app completo): planeja as telas + design system e gera UMA tela por chamada, em paralelo
        if (phIds && (looksMultiScreen(clean) || (fromSelection && /(telas|sequ[eê]ncia|fluxo|jornada|outras|pr[oó]ximas|etapas)/i.test(clean)))) {
          onProgress?.('Planejando as telas do app…');
          const planRaw = await requestAiScreenRaw(buildPlanPrompt(clean, useCtx ? await getProjectContext(ws) : undefined, spec, projTokens), selectedAiProvider, genModel, cwd || undefined, 120000).catch(() => null);
          if (signal?.cancelled) return { success: false, error: 'cancelado' };
          const plan = planRaw ? parsePlan(planRaw) : null;
          if (plan && baseDims) { plan.width = baseDims.w; plan.height = baseDims.h; } // as telas novas têm o tamanho da referência
          if (plan && plan.screens.length >= 2) {
            const N = plan.screens.length;
            const mobile = plan.width <= 500 && plan.height >= 600;
            // troca o frame provisório único por um por tela, lado a lado
            const old1 = phIds;
            const base = phSpot!;
            const groups: Array<{ ids: string[]; root: string; x: number }> = [];
            const all: Shape[] = [];
            let rowW = 0;
            const icons0 = await loadIcons().catch(() => undefined);
            for (let i = 0; i < N; i++) {
              const dev = buildDevice(
                { name: plan.screens[i].name, width: plan.width, height: plan.height, kind: mobile ? 'iphone-island' : 'plain', radius: mobile ? 55 : 0 },
                { idGen: () => crypto.randomUUID(), pageId, x: base.x + rowW, y: base.y, z: 1, isDark: isEffectiveDark, name: plan.screens[i].name, icons: icons0 }
              );
              // buildDevice posiciona em o.x/o.y; o próximo começa depois desta largura + espaço
              groups.push({ ids: dev.shapes.map((x) => x.id), root: dev.rootId, x: base.x + rowW });
              all.push(...dev.shapes);
              rowW += dev.rootWidth + 120;
            }
            phIds = new Set(groups.flatMap((g) => g.ids));
            applyDoc(ws, (cur) => [...cur.filter((x) => !old1.has(x.id)), ...all], false);
            setGlowIds((g) => { const n = new Set(g); if (glowRoot) n.delete(glowRoot); groups.forEach((x) => n.add(x.root)); return n; });
            glowRoot = null;
            glowRoots = groups.map((g) => g.root);
            if (isVisible(ws)) {
              const z = Math.max(0.1, Math.min(0.65, (viewport.width * zoom * 0.9) / Math.max(1, rowW - 120)));
              setZoom(z);
              setTargetCamera({ x: base.x + (rowW - 120) / 2, y: base.y + (mobile ? 436 : 450), zoom: z, timestamp: Date.now() });
            }
            let done = 0;
            const errors: string[] = [];
            let next = 0;
            const worker = async () => {
              while (next < N && !signal?.cancelled) {
                const i = next++;
                const g = groups[i];
                try {
                  await runScreenGeneration({
                    ws, pageId, useCtx, prompt: screenPrompt(hintedClean, plan, i), basePrompt: screenPrompt(hintedClean, plan, i), placeholderIds: g.ids,
                    referenceImages: specRefs, referenceSpec: spec, inspiration, startX: g.x, startY: base.y, maxScreens: 1, quiet: true, signal,
                    onProgress: (m) => onProgress?.(`Tela ${Math.min(done + 1, N)} de ${N} · ${m}`),
                  });
                } catch (e: any) {
                  errors.push(`${plan.screens[i].name}: ${e?.message || 'falhou'}`);
                } finally {
                  done++;
                  setGlowIds((gl) => { const n = new Set(gl); n.delete(g.root); return n; });
                }
              }
            };
            await Promise.all(Array.from({ length: Math.min(3, N) }, worker));
            if (signal?.cancelled) return { success: false, error: 'cancelado' };
            const okCount = N - errors.length;
            if (okCount === 0) return { success: false, error: errors[0] || 'A IA não gerou nenhuma tela.' };
            if (isVisible(ws) && errors.length) onToast?.(`${errors.length} tela(s) falharam: ${errors.map((x) => x.split(':')[0]).join(', ')}`);
            onAiTaskDone?.({ ok: true, message: errors.length ? `${okCount} de ${N} telas geradas (${errors.length} falharam)` : `${N} telas geradas e prontas para revisar`, workspace: ws });
            return { success: true };
          }
        }

        // Nada selecionado: cria telas novas, em tempo real
        const visible = isVisible(ws);
        const spot = phSpot || findFreeSpot(pageShapes, visible ? Math.round(viewport.x + viewport.width * 0.1) || 100 : 100, visible ? Math.round(viewport.y + 60) || 100 : 100, 460, 920);
        const count = await runScreenGeneration({ ws, pageId, useCtx, prompt: hintedClean, basePrompt: hintedClean, placeholderIds: phIds ? [...phIds] : undefined, referenceImages: specRefs, referenceSpec: spec, inspiration, startX: spot.x, startY: spot.y, onProgress, signal });
        if (signal?.cancelled) return { success: false, error: 'cancelado' };
        onAiTaskDone?.({ ok: true, message: count === 1 ? 'Tela gerada e pronta para revisar' : `${count} telas geradas e prontas para revisar`, workspace: ws });
        return { success: true };
      } catch (err: any) {
        if (signal?.cancelled) return { success: false, error: 'cancelado' };
        console.error('Erro ao prototipar com IA:', err);
        return { success: false, error: err?.message || 'Falha ao processar protótipo com IA. Tente novamente.' };
      } finally {
        if (phIds) {
          const ids = phIds;
          applyDoc(ws, (all) => all.filter((x) => !ids.has(x.id)), false);
        }
        if (glowRoot || glowRoots.length) setGlowIds((g) => { const n = new Set(g); if (glowRoot) n.delete(glowRoot); glowRoots.forEach((x) => n.delete(x)); return n; });
      }
    },
    [viewport, zoom, getProjectContext, selectedPageId, accentColor, isEffectiveDark, selectedAiProvider, genModel, cliModel, workspacePath, applyDoc, selectedIds, handleSelectSingle, onToast, onAiTaskDone, runScreenGeneration, useProjectContext, activeModels]
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
          buildProposalPrompt({ ...o, projectContext: await getProjectContext(workspacePath), frames }),
          selectedAiProvider, cliModel, workspacePath || undefined, 240000
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
    [proposalFrames, shapes, selectedAiProvider, cliModel, workspacePath, getProjectContext, accentColor]
  );

  /** Volta para a tela de antes da regeração (a nova versão sai e a antiga é restaurada) */
  const handleAiUndo = useCallback(
    (id: string) => {
      const entry = aiReview.find((r) => r.id === id);
      if (!entry?.previous?.length || entry.busy) return;
      const previous = entry.previous;
      applyDoc(workspacePath, (all) => restorePrevious(all, id, previous), true);
      // a tela antiga volta com os botões Aceitar/Regerar (se ela era uma tela gerada por IA)
      setAiReview((prev) => reviewAfterUndo(prev, entry));
      const root = previous.find((s) => !s.parentId) || previous[0];
      handleSelectSingle(root.id);
      onToast?.('Versão anterior restaurada');
    },
    [aiReview, applyDoc, workspacePath, handleSelectSingle, onToast]
  );

  const handleAiAccept = useCallback((id: string) => {
    setAiReview((prev) => prev.filter((r) => r.id !== id));
    onToast?.('Tela aceita');
  }, [onToast]);

  // "Corrigir": ajusta espaçamentos, tamanhos, posições e sobreposições das telas selecionadas (sem IA, instantâneo)
  const selectedRoots = useMemo(() => {
    const byId = new Map(activePageShapes.map((x) => [x.id, x]));
    const roots = new Set<string>();
    for (const id of selectedIds) {
      let cur = byId.get(id);
      while (cur?.parentId && byId.get(cur.parentId)) cur = byId.get(cur.parentId);
      if (cur) roots.add(cur.id);
    }
    return [...roots];
  }, [selectedIds, activePageShapes]);
  const pendingAcceptCount = aiReview.filter((r) => !r.busy).length;
  const handleAcceptAllAi = useCallback(() => {
    const n = aiReview.filter((r) => !r.busy).length;
    setAiReview((prev) => prev.filter((r) => r.busy));
    onToast?.(`${n} telas aceitas`);
  }, [aiReview, onToast]);

  // ---------------- Fila de gerações da IA (por projeto: uma por vez em cada projeto) ----------------
  interface AiJob {
    id: string;
    kind: 'prompt' | 'regen';
    /** projeto e página onde o pedido foi feito: a geração é gravada ali, mesmo que o usuário troque de projeto */
    ws: string;
    pageId: string;
    prompt: string;
    label: string;
    images: string[];
    selection: string[];
    frameId?: string;
    status: 'queued' | 'running' | 'error';
    progress?: string;
    signal: { cancelled: boolean };
    /** usar o contexto do projeto (valor do momento do envio) */
    useCtx?: boolean;
  }
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set()); // frames em que a IA está trabalhando (brilho)
  const [aiQueue, setAiQueue] = useState<AiJob[]>([]);
  const runningWsRef = useRef<Set<string>>(new Set());

  const patchJob = useCallback((id: string, patch: Partial<AiJob>) => setAiQueue((q) => q.map((j) => (j.id === id ? { ...j, ...patch } : j))), []);

  // a barra de prompt só mostra os pedidos do projeto aberto
  const projectQueue = useMemo(() => aiQueue.filter((j) => j.ws === workspacePath), [aiQueue, workspacePath]);
  useEffect(() => {
    setIsGeneratingAi(projectQueue.some((j) => j.status === 'running'));
  }, [projectQueue]);

  const handleEnqueueAi = useCallback(
    (prompt: string, images: string[], label?: string) => {
      const job: AiJob = { id: crypto.randomUUID(), kind: 'prompt', ws: workspacePath, pageId: selectedPageId, prompt, label: label || prompt, images, selection: selectedIds, status: 'queued', signal: { cancelled: false }, useCtx: useProjectContext };
      setAiQueue((q) => [...q, job]);
    },
    [selectedIds, workspacePath, selectedPageId, useProjectContext]
  );

  // "Corrigir": ajuste automático imediato (grade de 4px, tamanhos iguais, itens para dentro, sem sobreposição) + um pedido para a IA
  // corrigir layout, espaçamento e padronização das telas selecionadas (a IA enxerga a seleção como qualquer outro pedido)
  const handleFixLayout = useCallback(() => {
    if (!selectedRoots.length) return;
    const probe = fixLayout(shapesRef.current, selectedRoots);
    if (probe.fixes) applyDoc(workspacePath, (all) => fixLayout(all, selectedRoots).shapes, true);
    handleEnqueueAi(
      'Corrija problemas de layout nas telas selecionadas, mantendo o design, as cores e os textos: alinhe os elementos (mesma margem lateral em todos os blocos e telas), padronize os espaçamentos (grade de 4px, mesmo espaço entre itens iguais), use o mesmo tamanho para componentes iguais (cards, botões, campos, chips, ícones, avatares), ajuste posições e tamanhos para não haver textos sobrepostos, cortados ou elementos fora da tela, e deixe as telas consistentes entre si (cabeçalho, barra de navegação e alinhamentos nos mesmos lugares). Altere só x, y, width e height e o que for necessário para corrigir.',
      [],
      `Corrigir layout (${selectedRoots.length} tela${selectedRoots.length > 1 ? 's' : ''})`
    );
  }, [selectedRoots, applyDoc, workspacePath, handleEnqueueAi]);

  // Design tokens: gerar com IA (texto e/ou imagens de outro projeto), extrair do design atual e editar à mão
  const handleGenerateTokens = useCallback(
    async (o: { prompt: string; images: string[] }): Promise<string | null> => {
      try {
        const refs: string[] = [];
        for (const d of o.images) {
          const r = await (window as any).electronAPI?.fs?.saveTempImage?.(d.split(',')[1], 'jpg')?.catch?.(() => null);
          if (r?.path) refs.push(r.path);
        }
        if (o.images.length > refs.length) return 'Não consegui salvar as imagens de referência. Reinicie o app e tente de novo.';
        const refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];
        const ctx = useProjectContext && workspacePath && !refs.length ? await getProjectContext(workspacePath) : undefined;
        const raw = await requestAiScreenRaw(
          buildTokensGenPrompt({ prompt: o.prompt, imagePaths: refs, projectContext: ctx, current: designTokensRef.current }),
          selectedAiProvider, genModel, NEUTRAL_CWD, 240000, undefined, refDirs
        );
        const parsed = parseTokens(raw);
        if (!parsed) return 'A IA não devolveu tokens válidos. Tente de novo ou descreva melhor o estilo.';
        const t = applyModeScope(o.prompt, designTokensRef.current, parsed); // respeita "só o modo claro/escuro" e o modo ativo
        setTokensUndo({ previous: designTokensRef.current, label: 'Tokens gerados com IA', section: 'all' });
        setDesignTokens(t);
        onToast?.('Design tokens gerados');
        return null;
      } catch (e: any) {
        return e?.message || 'Falha ao gerar os tokens';
      }
    },
    [useProjectContext, workspacePath, getProjectContext, selectedAiProvider, genModel, onToast]
  );
  // nova versão de UMA seção (tipografia, espaçamentos ou raios) pela IA; o resto dos tokens não muda
  const handleAiTokensSection = useCallback(
    async (section: TokenSection): Promise<string | null> => {
      const cur = designTokensRef.current;
      if (!cur) return null;
      try {
        const raw = await requestAiScreenRaw(buildTokensSectionPrompt(section, cur), selectedAiProvider, genModel, NEUTRAL_CWD, 180000);
        const next = applyTokensSection(section, cur, raw);
        if (!next) return 'A IA não devolveu uma proposta válida. Tente de novo.';
        setTokensUndo({ previous: cur, label: 'Gerado com IA', section });
        setDesignTokens(next);
        return null;
      } catch (e: any) {
        return e?.message || 'Falha ao gerar com a IA';
      }
    },
    [selectedAiProvider, genModel]
  );
  const handleReplaceTokens = useCallback((next: DesignTokens, label: string, section: 'all' | 'colors' | TokenSection = 'all') => {
    setTokensUndo({ previous: designTokensRef.current, label, section });
    setDesignTokens(next);
  }, []);
  const handleExtractTokens = useCallback(() => {
    const t = tokensFromShapes(shapesRef.current);
    if (!t) return false;
    setTokensUndo({ previous: designTokensRef.current, label: 'Tokens extraídos do design', section: 'all' });
    setDesignTokens(t);
    onToast?.('Tokens extraídos do design atual');
    return true;
  }, [onToast]);

  // Ações de projeto (antes no menu do projeto; agora em "Configurações do design")
  const handleExportJson = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ pages, selectedPageId, shapes, pageViewports }, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${docTitle || 'design'}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [pages, selectedPageId, shapes, pageViewports, docTitle]);
  const handleGenerateProposalOpen = useCallback(() => {
    if (proposalFrames.length === 0) onToast?.('Selecione uma ou mais telas (frames) para gerar a proposta');
    else setIsProposalOpen(true);
  }, [proposalFrames, onToast]);
  const handleClearGuides = useCallback(() => {
    setGuidesByPage((prev) => ({ ...prev, [selectedPageId]: [] }));
    onToast?.('Guias da página removidas');
  }, [selectedPageId, onToast]);

  // "Cores da seleção" (como o Selection colors do Figma): frames/grupos/várias camadas listam as cores de tudo que têm dentro
  const selectionColors = useMemo(() => {
    if (!selectedIds.length) return [];
    const first = activePageShapes.find((x) => x.id === selectedIds[0]);
    const container = selectedIds.length > 1 || first?.type === 'frame' || first?.type === 'group' || first?.type === 'section';
    return container ? collectSelectionColors(activePageShapes, selectedIds) : [];
  }, [selectedIds, activePageShapes]);
  const handleReplaceSelectionColor = useCallback(
    (from: { hex: string; opacity: number }, to: { hex: string; opacity: number }) => {
      applyActivePageShapes(replaceSelectionColor(activePageShapes, selectedIds, from, to), true);
    },
    [activePageShapes, selectedIds, applyActivePageShapes]
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
        (window as any).electronAPI?.ai?.cancel?.(undefined, (job.useCtx === false ? NEUTRAL_CWD : job.ws) || undefined); // encerra a CLI daquele projeto
      }
    },
    [aiQueue, patchJob, NEUTRAL_CWD]
  );

  /** Sobe um pedido na fila do projeto, nunca acima do que já está sendo gerado */
  const handleMoveAiJobUp = useCallback((id: string) => {
    setAiQueue((q) => {
      const job = q.find((j) => j.id === id);
      if (!job || job.status !== 'queued') return q;
      const sameWs = q.filter((j) => j.ws === job.ws);
      const i = sameWs.findIndex((j) => j.id === id);
      const firstQueued = sameWs.findIndex((j) => j.status === 'queued');
      if (i <= 0 || i <= firstQueued) return q;
      const prev = sameWs[i - 1];
      const next = q.slice();
      const a = next.findIndex((j) => j.id === prev.id);
      const b = next.findIndex((j) => j.id === id);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }, []);

  /**
   * Regera uma tela com IA. Telas geradas por IA reaproveitam o pedido original; qualquer outro frame de topo
   * (feito à mão ou importado) é refeito a partir do que está escrito nele.
   */
  const handleAiRegenerate = useCallback(
    (id: string) => {
      const frame = activePageShapes.find((s) => s.id === id);
      if (!frame) return;
      let entry = aiReview.find((r) => r.id === id);
      if (entry?.busy) return;
      if (!entry) {
        const screen = activePageShapes.find((s) => s.parentId === id && s.deviceScreen);
        const ctx = collectFrameContext(activePageShapes, frame);
        const texts = ctx.texts.length ? ` Conteúdo atual (textos): ${ctx.texts.slice(0, 40).join(' | ')}.` : '';
        entry = {
          id,
          prompt: `Refaça a tela "${frame.name}" mantendo o propósito e o conteúdo dela, como um app/sistema coerente, com um layout novo e melhor.${texts}`,
          w: Math.round(screen?.width ?? frame.width),
          h: Math.round(screen?.height ?? frame.height),
        };
        const created = entry;
        setAiReview((prev) => [...prev.filter((r) => r.id !== id), { ...created, busy: true }]);
      } else {
        setAiReview((prev) => prev.map((r) => (r.id === id ? { ...r, busy: true } : r)));
      }
      setAiQueue((q) => [...q, { id: crypto.randomUUID(), kind: 'regen', ws: workspacePath, pageId: selectedPageId, prompt: entry!.prompt, label: `Regerar a tela "${frame.name}"`, images: [], selection: [], frameId: id, status: 'queued', signal: { cancelled: false }, useCtx: useProjectContext }]); // o interruptor que o usuário vê agora (não o do pedido original)
    },
    [aiReview, activePageShapes, workspacePath, selectedPageId, useProjectContext]
  );

  const runRegenJob = useCallback(
    async (job: AiJob): Promise<string | null> => {
      const entry = aiReview.find((r) => r.id === job.frameId);
      const doc = await currentDoc(job.ws);
      const frame = doc.find((s) => s.id === job.frameId);
      if (!entry || !frame) return 'A tela original não existe mais';
      // identidade visual da tela atual: a nova versão muda a composição, não o estilo
      const styleScreen = doc.find((s) => s.parentId === frame.id && s.deviceScreen) || frame;
      const currentStyle = describeScreenStyle(doc, styleScreen);
      const currentTexts = collectFrameContext(doc, styleScreen).texts.slice(0, 40).join(' | ');
      setGlowIds((g) => new Set([...g, job.frameId!]));
      try {
        await runScreenGeneration({
          ws: job.ws,
          pageId: job.pageId,
          prompt: `${entry.prompt}\n\nGere APENAS ${job.useCtx === false ? 'uma tela' : `a tela "${frame.name}"`} (${Math.round(entry.w ?? frame.width)}x${Math.round(entry.h ?? frame.height)} px, escreva exatamente esse width/height): UMA única tela.

REGERAR = MESMO PADRÃO DE DESIGN. Mantenha EXATAMENTE a identidade visual da versão atual (fundo e degradês, paleta, fonte e escala tipográfica, raios, vidro/sombras/granulado, estilo dos componentes e o conteúdo/textos) e use a tela atual só como base: o objetivo é uma composição/layout melhor e corrigir desalinhamentos, espaçamentos e tamanhos inconsistentes (grade de 4px, margens laterais iguais, itens iguais com mesmo tamanho, sem texto sobreposto, sem vazios estranhos). NÃO invente outra paleta, outro fundo nem outro estilo.
PADRÃO DE DESIGN ATUAL (obrigatório manter):
${currentStyle}
Textos atuais (reaproveite): ${currentTexts}`,
          basePrompt: entry.prompt,
          referenceImages: entry.refs,
          referenceSpec: entry.refSpec,
          useCtx: job.useCtx,
          startX: frame.x,
          startY: frame.y,
          replaceFrameId: job.frameId,
          previousEntry: entry,
          maxScreens: 1,
          signal: job.signal,
          onProgress: (m) => patchJob(job.id, { progress: m }),
        });
        if (!job.signal.cancelled) onAiTaskDone?.({ ok: true, message: `Nova versão da tela "${frame.name}" gerada`, workspace: job.ws });
        return null;
      } catch (err: any) {
        return job.signal.cancelled ? null : err?.message || 'Falha ao regerar a tela';
      } finally {
        setGlowIds((g) => { const n = new Set(g); n.delete(job.frameId!); return n; });
        setAiReview((prev) => prev.map((r) => (r.id === job.frameId ? { ...r, busy: false } : r)));
      }
    },
    [aiReview, runScreenGeneration, patchJob, onAiTaskDone]
  );

  // devolve a mensagem de erro (ou null): o card fica na fila com o erro até o usuário dispensar ou tentar de novo
  const runJobRef = useRef<(job: AiJob) => Promise<string | null>>(async () => null);
  runJobRef.current = async (job) => {
    try {
      if (job.kind === 'regen') return await runRegenJob(job);
      const res = await handlePrototypeWithAi(job.prompt, (m) => patchJob(job.id, { progress: m }), job.images, job.selection, job.signal, { ws: job.ws, pageId: job.pageId, useCtx: job.useCtx });
      if (res && res.success === false && !job.signal.cancelled) return res.error || 'Erro ao gerar com IA';
      return null;
    } catch (err: any) {
      return job.signal.cancelled ? null : err?.message || 'Erro ao gerar com IA';
    }
  };
  // Processa a fila: um pedido por vez em cada projeto (projetos diferentes geram em paralelo, cada um no seu)
  useEffect(() => {
    for (const next of aiQueue) {
      if (next.status !== 'queued' || runningWsRef.current.has(next.ws)) continue;
      runningWsRef.current.add(next.ws);
      setAiQueue((q) => q.map((j) => (j.id === next.id ? { ...j, status: 'running' } : j)));
      runJobRef.current(next).then((error) => {
        runningWsRef.current.delete(next.ws);
        if (error) {
          if (isVisible(next.ws)) onToast?.(error);
          onAiTaskDone?.({ ok: false, message: error, workspace: next.ws });
          setAiQueue((q) => q.map((j) => (j.id === next.id ? { ...j, status: 'error', progress: error } : j)));
        } else setAiQueue((q) => q.filter((j) => j.id !== next.id));
      });
    }
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
                onOpenAssets={() => setIsAssetsOpen(true)}
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
                onSelectMany={handleSelectMultiple}
                onReorder={(dragId, targetId, pos) => {
                  const next = reorderLayers(activePageShapes, dragId, targetId, pos);
                  if (next) applyActivePageShapes(next, true);
                  else onToast?.('Não dá para soltar a camada aí');
                }}
                onSelect={(id) => {
                  handleSelectSingle(id);
                  if (id) focusOnShape(id); // clicar numa camada leva o canvas até ela
                }}
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

        {/* Canto superior direito do canvas: zoom (+ reabrir o painel quando oculto) */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 40, display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isRightPanelOpen && (
            <button
              type="button"
              onClick={() => toggleRightPanel(true)}
              style={{ background: tokens.bgCardElevated, border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`, borderRadius: 6, color: tokens.textSecondary, cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', boxShadow: isEffectiveDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)' }}
              title="Mostrar painel de propriedades"
            >
              <PanelRight size={15} />
            </button>
          )}
          <div style={{ background: tokens.bgCardElevated, border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`, borderRadius: 6, boxShadow: isEffectiveDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)' }}>
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
                <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsZoomMenuOpen(false)} />
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
                    minWidth: 154,
                    zIndex: 100,
                  }}
                >
                  {/* Barra de arrastar: zoom contínuo (escala logarítmica de 2% a 500%) */}
                  <div style={{ padding: '6px 12px 8px', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      step={1}
                      value={Math.round((1000 * Math.log(Math.max(0.02, Math.min(5, zoom)) / 0.02)) / Math.log(250))}
                      onChange={(e) => setZoom(Number((0.02 * Math.pow(250, Number(e.target.value) / 1000)).toFixed(3)))}
                      title="Arraste para ajustar o zoom"
                      style={{ width: 130, accentColor: accentColor, cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ height: 1, background: tokens.border, margin: '0 0 4px' }} />
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
                </>
              )}
            </div>
          </div>
        </div>

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
            const all = Array.from(e.dataTransfer?.files || []);
            const svgFiles = all.filter((f) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name));
            const files = all.filter((f) => f.type.startsWith('image/') && !svgFiles.includes(f));
            if ((files.length === 0 && svgFiles.length === 0) || readOnly) return;
            e.preventDefault();
            // SVG vira shapes editáveis (frame com retângulos, formas, caminhos e textos), não uma imagem
            if (svgFiles.length) {
              const svgEl = (e.target as Element).closest('svg');
              const r = svgEl?.getBoundingClientRect();
              const at = r ? { x: viewport.x + (e.clientX - r.left) / zoom, y: viewport.y + (e.clientY - r.top) / zoom } : { x: viewport.x + 80, y: viewport.y + 80 };
              svgFiles.forEach((f, i) => importSvgFile(f, { x: at.x + i * 40, y: at.y + i * 40 }));
            }
            if (files.length === 0) return;
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
          aiReview={aiReview.map((r) => ({ id: r.id, busy: r.busy, canUndo: !!r.previous?.length }))}
          onAiUndo={handleAiUndo}
          onAiAccept={handleAiAccept}
          onAiRegenerate={handleAiRegenerate}
          glowIds={glowIds}
          onFrameRegenerate={handleAiRegenerate}
          isEffectiveDark={isEffectiveDark}
          onFrameDelete={(id) => {
            const f = shapes.find((x) => x.id === id);
            if (f) handleRequestDelete(f);
          }}
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
          redlines={rightPanelMode === 'dev'}
          outlineMode={outlineMode}
          colorBlind={colorBlind || undefined}
          pixelSnap={viewPrefs.pixelSnap}
          pixelGrid={viewPrefs.pixelGrid}
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
          aiQueue={projectQueue.map((j) => ({ id: j.id, label: j.label, images: j.images, prompt: j.kind === 'prompt' ? j.prompt : undefined, status: j.status, progress: j.progress }))}
          onEnqueueAi={handleEnqueueAi}
          onCancelAiJob={handleCancelAiJob}
          useProjectContext={useProjectContext}
          mainOutdated={mainOutdated}
          onToggleProjectContext={toggleProjectContext}
          selectedScreensCount={selectedRoots.length}
          hasDesignTokens={!!designTokens}
          tokensFollowing={!!designTokens && designTokens.enabled !== false}
          onToggleTokens={() => {
            if (!designTokens) { openTokensPanel(); return; }
            const on = designTokens.enabled === false;
            setDesignTokens({ ...designTokens, enabled: on });
            onToast?.(on ? 'Design tokens ligados: a IA segue os tokens' : 'Design tokens desligados: a IA ignora os tokens');
          }}
          canFixLayout={selectedRoots.length > 0}
          onFixLayout={handleFixLayout}
          fastMode={fastMode}
          onToggleFastMode={toggleFastMode}
          pendingAcceptCount={pendingAcceptCount}
          onAcceptAllAi={handleAcceptAllAi}
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
              fillType={activeColorPicker.target === 'fill' ? activeFillItem?.type : (activeStrokeItem?.type as any)}
              gradientStops={activeColorPicker.target === 'fill' ? activeFillItem?.gradientStops : activeStrokeItem?.gradientStops}
              gradientAngle={activeColorPicker.target === 'fill' ? activeFillItem?.gradientAngle : activeStrokeItem?.gradientAngle}
              onGradientChange={
                activeColorPicker.target !== 'fill'
                  ? (patch) => {
                      const targetId = activeStrokeItem?.id;
                      const updated = strokes.map((st) =>
                        isAllStrokes || st.id === targetId
                          ? { ...st, ...(patch as any), color: patch.gradientStops?.[0]?.color ?? st.color }
                          : st
                      );
                      applyShapes(shapes.map((s) => (s.id === selectedShape.id ? { ...s, strokes: updated } : s)), false);
                    }
                  : activeColorPicker.target === 'fill'
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
                {(['react', 'html', 'flutter', 'swiftui', 'compose'] as CodeTarget[]).map((t) => (
                  <button key={t} type="button" onClick={() => setCodeTarget(t)} style={{ background: codeTarget === t ? `${accentColor}33` : 'transparent', border: `1px solid ${codeTarget === t ? accentColor : tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>
                    {{ react: 'React', html: 'HTML', flutter: 'Flutter', swiftui: 'SwiftUI', compose: 'Compose' }[t]}
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

        {isVariantMatrixOpen && selectedShape?.isComponent && (
          <VariantMatrixPopup
            tokens={tokens}
            accentColor={accentColor}
            componentName={selectedShape.name || 'Componente'}
            hasGroup={!!selectedShape.variantGroup}
            onClose={() => setIsVariantMatrixOpen(false)}
            onCreate={(axes) => {
              const r = createVariantMatrix(shapes, selectedShape.id, axes);
              if (!r) return onToast?.('Não foi possível criar as variantes');
              applyShapes(r.shapes, true);
              onToast?.(`${r.shapes.filter((s) => s.isComponent && s.variantGroup === r.group).length} variantes no grupo "${r.group}"`);
            }}
            onArrange={() => selectedShape.variantGroup && applyShapes(arrangeVariants(shapes, selectedShape.variantGroup), true)}
          />
        )}

        {diffView && (
          <div style={{ position: 'relative', zIndex: 100001 }}>
          <DiffPopup
            tokens={tokens}
            accentColor={accentColor}
            label={diffView.label}
            diff={diffView.diff}
            existingIds={new Set(shapes.map((s) => s.id))}
            onClose={() => setDiffView(null)}
            onSelect={(id) => {
              setSelectedIds([id]);
              setSelectedId(id);
            }}
          />
          </div>
        )}

        {isAuditOpen && (
          <AuditPopup
            tokens={tokens}
            accentColor={accentColor}
            shapes={activePageShapes}
            styles={styles}
            variables={variables}
            modeId={activeModeId}
            names={Object.fromEntries(activePageShapes.map((s) => [s.id, s.name || s.type]))}
            onClose={() => setIsAuditOpen(false)}
            onSelect={(id) => {
              setSelectedIds([id]);
              setSelectedId(id);
              const s = activePageShapes.find((x) => x.id === id);
              if (s) setViewport((prev) => ({ ...prev, x: Math.round(prev.width / 2 - (s.x + s.width / 2) * zoom), y: Math.round(prev.height / 2 - (s.y + s.height / 2) * zoom) }));
            }}
            onFix={(list) => {
              let next = shapes;
              for (const issue of list) next = applyAuditFix(next, issue);
              applyShapes(next, true);
              onToast?.(`${list.length} ${list.length === 1 ? 'correção aplicada' : 'correções aplicadas'}`);
            }}
          />
        )}

        {isAssetsOpen && (
          <AssetsPopup
            tokens={tokens}
            accentColor={accentColor}
            components={shapes.filter((s) => s.isComponent)}
            onClose={() => setIsAssetsOpen(false)}
            onInsert={handleInsertComponent}
          />
        )}

        <input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importSvgFile(f); }} />

        {isRenameOpen && selectedIds.length > 0 && (
          <RenamePopup
            tokens={tokens}
            accentColor={accentColor}
            items={shapes.filter((s) => selectedIds.includes(s.id)).sort((a, b) => a.y - b.y || a.x - b.x).map((s) => ({ id: s.id, name: s.name || '' }))}
            onClose={() => setIsRenameOpen(false)}
            onApply={(names) => applyShapes(shapes.map((s) => (names.has(s.id) ? { ...s, name: names.get(s.id)! } : s)), true)}
          />
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
                    <button type="button" onClick={() => handleCompareVersion(v)} title="Comparar esta versão com o design atual" style={{ background: 'transparent', border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>Comparar</button>
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
          ...(isRightPanelOpen ? {} : { display: 'none' }),
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
          display: isRightPanelOpen ? 'flex' : 'none',
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
            {/* Seletor do que mostrar no painel de baixo */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsPanelMenuOpen((v) => !v)}
                title="O que mostrar no painel"
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: tokens.textPrimary, fontFamily: "'Poppins', sans-serif", fontSize: 11.5, fontWeight: 500, padding: '4px 6px', borderRadius: 6, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{rightPanelMode === 'tokens' ? 'Design tokens' : rightPanelMode === 'settings' ? 'Configurações' : rightPanelMode === 'dev' ? 'Modo Dev' : 'Propriedades'}</span>
                <ChevronDown size={11} color={tokens.textSecondary} />
              </button>
              {isPanelMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsPanelMenuOpen(false)} />
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: tokens.bgCardElevated, borderRadius: 8, boxShadow: isEffectiveDark ? '0 8px 24px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.15)', padding: 0, overflow: 'hidden', minWidth: 200, whiteSpace: 'nowrap', zIndex: 100 }}>
                    {([['properties', 'Propriedades'], ['dev', 'Modo Dev (Shift+D)'], ['tokens', 'Design tokens'], ['settings', 'Configurações do design']] as const).map(([mode, label]) => (
                      <div
                        key={mode}
                        onClick={() => { setRightPanelMode(mode); setIsPanelMenuOpen(false); }}
                        style={{ padding: '8px 12px', fontSize: 11, fontFamily: "'Poppins', sans-serif", color: rightPanelMode === mode ? accentColor : tokens.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${tokens.border}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 12 }}>{rightPanelMode === mode ? '✓' : ''}</span>
                        <span>{label}{mode === 'tokens' && designTokens ? ' ✓' : ''}</span>
                      </div>
                    ))}
                    {([['Exportar JSON', handleExportJson], ['Salvar versão', handleSaveVersion], ['Histórico de versões', handleOpenVersions], ['Importar do Figma', () => setIsFigmaImportOpen(true)], ...activePageShapes.filter((f) => f.flowStart && f.type === 'frame' && !f.parentId).map((f) => [`▶ Fluxo: ${f.flowName || f.name || 'Frame'}`, () => setPresentFrameId(f.id)] as [string, () => void]), ['Importar SVG…', () => svgInputRef.current?.click()], ['Revisar design', () => setIsAuditOpen(true)], ...(['', ...Object.keys(COLOR_BLIND)] as string[]).map((k) => [k ? `${colorBlind === k ? '✓ ' : ''}Simular: ${COLOR_BLIND[k].label}` : colorBlind ? 'Simular: desligar daltonismo' : 'Simular daltonismo ↓', () => setColorBlind(k)] as [string, () => void]), ['Pseudolocalizar seleção', () => handlePseudoLoc(false)], ['Restaurar textos da seleção', () => handlePseudoLoc(true)], ['Gerar proposta com IA', handleGenerateProposalOpen]] as Array<[string, () => void]>).map(([label, run], i, arr) => (
                      <div
                        key={label}
                        onClick={() => { setIsPanelMenuOpen(false); run(); }}
                        style={{ padding: '8px 12px 8px 32px', fontSize: 11, fontFamily: "'Poppins', sans-serif", color: tokens.textPrimary, cursor: 'pointer', borderBottom: i < arr.length - 1 ? `1px solid ${tokens.border}` : 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* divisória entre o seletor do painel e o compartilhar */}
            <div style={{ width: 1, height: 16, background: tokens.border, flexShrink: 0 }} />
            {/* Compartilhar (iniciar LAN) */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              title="Compartilhar projeto via LAN"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Share2 size={18} color={accentColor} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => toggleRightPanel(false)}
              title="Ocultar painel de propriedades"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = tokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <PanelRight size={18} color={accentColor} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Properties Panel (Abaixo da top div) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 10,
            overflow: 'hidden',
            position: 'relative',
            background: tokens.bgCard,
            border: '1px solid ' + tokens.border,
          }}
        >
          {rightPanelMode === 'tokens' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
              <DesignTokensPanel tokens={tokens} accentColor={accentColor} value={designTokens} onChange={(t) => { setTokensUndo(null); setDesignTokens(t); }} undoInfo={tokensUndo ? { label: tokensUndo.label, hadBefore: !!tokensUndo.previous, section: tokensUndo.section } : null} onUndo={() => { if (tokensUndo) { setDesignTokens(tokensUndo.previous); setTokensUndo(null); onToast?.('Tokens revertidos'); } }} onDismissUndo={() => setTokensUndo(null)} onReplace={handleReplaceTokens} onAiSection={handleAiTokensSection} onExtract={handleExtractTokens} onBack={() => setRightPanelMode('properties')} isDark={isEffectiveDark} />
            </div>
          )}
          {rightPanelMode === 'dev' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: tokens.bgCard }}>
              <DevPanel
                tokens={tokens}
                accentColor={accentColor}
                shape={selectedShape}
                shapes={activePageShapes}
                styles={styles}
                variables={variables}
                modeId={activeModeId}
                onShowCode={(sh) => setCodeShape(sh)}
                onStatus={(sh, status) => applyShapes(shapes.map((x) => (x.id === sh.id ? { ...x, devStatus: status } : x)), true)}
                onToast={onToast}
              />
            </div>
          )}
          {rightPanelMode === 'settings' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
              <DesignSettingsPanel tokens={tokens} accentColor={accentColor} viewPrefs={viewPrefs} onToggleView={toggleViewPref} fastMode={fastMode} onToggleFast={toggleFastMode} useProjectContext={useProjectContext} onToggleContext={toggleProjectContext} onUnsplashSaved={(has) => onToast?.(has ? 'Chave do Unsplash salva' : 'Chave removida: a IA usará fotos do picsum.photos')} onClearGuides={handleClearGuides} />
            </div>
          )}
          <PropertiesPanel
            selectionColors={selectionColors}
            onReplaceSelectionColor={handleReplaceSelectionColor}
            shape={selectedShape}
            themeTokens={tokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            mixed={multiSelected.length > 1 ? mixedKeys(multiSelected) : undefined}
            onChange={(patch: Partial<Shape>) => {
              if (!selectedShape) return;
              // Seleção múltipla: a edição vale para todos os selecionados
              if (multiSelected.length > 1 && multiSelected.some((s) => s.id === selectedShape.id)) {
                applyShapes(applyPatchToSelection(shapes, multiSelected.map((s) => s.id), selectedShape.id, patch), true);
                return;
              }
              // Editar a cor/tipografia à mão desliga o estilo do documento naquele elemento
              if (selectedShape.fillStyleId && ('fills' in patch || 'fill' in patch) && !('fillStyleId' in patch)) patch = { ...patch, fillStyleId: undefined };
              if (selectedShape.effectStyleId && 'effects' in patch && !('effectStyleId' in patch)) patch = { ...patch, effectStyleId: undefined };
              if (selectedShape.gridStyleId && 'layoutGrids' in patch && !('gridStyleId' in patch)) patch = { ...patch, gridStyleId: undefined };
              if (selectedShape.textStyleId && ['fontSize', 'fontFamily', 'fontWeight', 'letterSpacing', 'lineHeight'].some((k) => k in patch) && !('textStyleId' in patch)) patch = { ...patch, textStyleId: undefined };
              // Alterar uma instância registra o que foi sobrescrito (o componente não reverte essas propriedades)
              if (selectedShape.sourceId) {
                const keys = Object.keys(patch).filter((k) => k !== 'x' && k !== 'y' && k !== 'overrides');
                if (keys.length > 0) patch = { ...patch, overrides: Array.from(new Set([...(selectedShape.overrides || []), ...keys])) };
              }
              let next = shapes.map((s) => (s.id === selectedShape.id ? { ...s, ...patch } : s));
              // Editar X/Y de um frame/grupo leva todos os descendentes junto
              const dx = typeof patch.x === 'number' ? patch.x - selectedShape.x : 0;
              const dy = typeof patch.y === 'number' ? patch.y - selectedShape.y : 0;
              if (dx !== 0 || dy !== 0) {
                const kids = descendantIds(shapes, selectedShape.id).map((id) => [id, { dx, dy }] as const);
                if (kids.length > 0) next = applyDeltas(next, new Map(kids));
              }
              // Editar W/H de um frame: os filhos acompanham pelas restrições (como ao arrastar a alça); com auto layout, ele reflui
              const resized = (typeof patch.width === 'number' && patch.width !== selectedShape.width) || (typeof patch.height === 'number' && patch.height !== selectedShape.height);
              if (resized && !selectedShape.hasAutoLayout && (selectedShape.type === 'frame' || selectedShape.type === 'group' || selectedShape.type === 'section')) {
                const after = next.find((s) => s.id === selectedShape.id)!;
                const ids = new Set(descendantIds(shapes, selectedShape.id));
                const patches = resizeDescendants(
                  [selectedShape, ...shapes.filter((s) => ids.has(s.id))],
                  selectedShape.id,
                  { x: selectedShape.x, y: selectedShape.y, width: selectedShape.width, height: selectedShape.height },
                  { x: after.x, y: after.y, width: after.width, height: after.height },
                  'constraints'
                );
                if (patches.size > 0) next = next.map((s) => (patches.has(s.id) ? { ...s, ...patches.get(s.id) } : s));
              }
              applyShapes(next, true);
            }}
            onAlign={handleAlign}
            alignTarget={alignTarget}
            onAlignTargetChange={changeAlignTarget}
            onDistribute={handleDistribute}
            onTidy={handleTidy}
            selectionCount={selectedIds.length}
            onBoolean={handleBoolean}
            onFitSelection={handleFitSelection}
            onCreateInstance={handleCreateInstance}
            variantOptions={selectedShape?.instanceOf ? variantsOf(activePageShapes, selectedShape.instanceOf).map((c) => ({ id: c.id, name: c.variantName || c.name || 'Variante' })) : []}
            onSwitchVariant={handleSwitchVariant}
            onOpenVariantMatrix={() => setIsVariantMatrixOpen(true)}
            onRemoveBackground={handleRemoveBackground}
            onToastMessage={onToast}
            pathTargets={selectedShape?.type === 'text-path' ? activePageShapes.filter((s) => s.id !== selectedShape.id && PATH_TARGET_TYPES.includes(s.type)).map((s) => ({ id: s.id, name: s.name || s.type })) : []}
            swapOptions={selectedShape?.instanceOf ? shapes.filter((s) => s.isComponent && s.id !== selectedShape.instanceOf).map((c) => ({ id: c.id, name: c.variantGroup ? `${c.variantGroup} / ${c.variantName || c.name}` : c.name || 'Componente' })) : []}
            propTargets={selectedShape?.isComponent ? propTargets(activePageShapes, selectedShape.id) : []}
            instanceProps={selectedShape?.instanceOf ? (activePageShapes.find((c) => c.id === selectedShape.instanceOf)?.componentProps || []).map((p) => ({ prop: p, fallback: defaultPropValue(activePageShapes, p) })) : []}
            onShowCode={(sh) => setCodeShape(sh)}
            prototypeFrames={activePageShapes.filter((s) => s.type === 'frame').map((s) => ({ id: s.id, name: s.name || 'Frame' }))}
            onPresent={(id) => setPresentFrameId(id)}
            variables={variables}
            modes={modes}
            activeModeId={activeModeId}
            onCreateVariable={handleCreateVariable}
            onBindVariable={handleBindVariable}
            onBindTypedVariable={handleBindTypedVariable}
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
        {rightPanelMode === 'tokens' && (
          <div style={{ flexShrink: 0 }}>
            <DesignTokensComposer tokens={tokens} accentColor={accentColor} hasTokens={!!designTokens} onGenerate={handleGenerateTokens} isDark={isEffectiveDark} selectedAiProvider={selectedAiProvider} selectedModel={selectedModel} activeModels={activeModels} installedClis={installedClis} onSelectAiProvider={onSelectAiProvider} onSelectModel={onSelectModel} onInstallAiCli={onInstallAiCli} />
          </div>
        )}
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
        onSelectParent={(shape) => {
          if (!shape.parentId) return;
          setSelectedIds([shape.parentId]);
          setSelectedId(shape.parentId);
        }}
        onSelectChildren={(shape) => {
          const kids = activePageShapes.filter((s) => s.parentId === shape.id).map((s) => s.id);
          if (kids.length === 0) return;
          setSelectedIds(kids);
          setSelectedId(kids[0]);
        }}
        onSelectSimilar={(shape, kind) => {
          const ids = selectSimilar(activePageShapes, shape, kind);
          if (ids.length === 0) return;
          setSelectedIds(ids);
          setSelectedId(ids[0]);
          onToast?.(`${ids.length} elementos selecionados`);
        }}
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

