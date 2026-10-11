import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Square,
  Minus,
  ArrowUpRight,
  Circle,
  Triangle,
  Star,
  Image as ImageIcon,
  Pencil,
  Type,
  Hash,
  ChevronDown,
  ArrowUp,
  ChevronRight,
  Check,
  Maximize2,
  Sparkles,
  X,
  Loader2,
  SquareTerminal,
  AlertCircle,
  CheckCircle2,
  Shapes,
  MonitorSmartphone,
  Paperclip,
  RotateCcw,
  Info,
  Zap,
  Wand2,
  Palette,
} from 'lucide-react';
import type { ToolId, Shape } from './types';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { AI_PROVIDERS, DEFAULT_AI_QUOTAS } from '../../constants/ai';

/** Item da fila de gerações da IA (o processamento fica no Design Studio) */
export interface AiQueueItem {
  id: string;
  label: string;
  /** imagens de referência anexadas ao pedido (data URLs) */
  images?: string[];
  /** texto original do pedido: o X devolve para a caixa de texto */
  prompt?: string;
  status: 'queued' | 'running' | 'error';
  progress?: string;
}

export interface DesignToolbarProps {
  aiQueue?: AiQueueItem[];
  onEnqueueAi?: (prompt: string, images: string[], label?: string) => void;
  /** Usar o contexto do projeto da header (README, docs, arquivos) nas gerações com IA */
  useProjectContext?: boolean;
  /** o processo principal do app está desatualizado (precisa reiniciar) */
  mainOutdated?: boolean;
  onToggleProjectContext?: (value: boolean) => void;
  /** Telas geradas aguardando aceite (prontas, não em geração) e ação de aceitar todas */
  /** Modo rápido: gera com a variante (Low) do modelo */
  /** Há telas selecionadas: mostra o botão Corrigir (ajusta espaçamentos, tamanhos e posições) */
  /** quantas telas (frames de topo) estão selecionadas */
  selectedScreensCount?: number;
  /** O projeto tem design tokens definidos (a IA os segue) e abre o painel deles */
  hasDesignTokens?: boolean;
  /** tokens existem e a IA os segue (liga/desliga pelo botão); sem tokens, o botão abre o painel para criá-los */
  tokensFollowing?: boolean;
  onToggleTokens?: () => void;
  canFixLayout?: boolean;
  onFixLayout?: () => void;
  fastMode?: boolean;
  onToggleFastMode?: (value: boolean) => void;
  pendingAcceptCount?: number;
  onAcceptAllAi?: () => void;
  onCancelAiJob?: (id: string) => void;
  /** Sobe o item uma posição na fila (nunca acima do que já está sendo gerado) */
  onMoveAiJobUp?: (id: string) => void;
  /** Tenta de novo um pedido que falhou */
  onRetryAiJob?: (id: string) => void;
  tool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  accentColor: string;
  isEffectiveDark: boolean;
  themeTokens: {
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
  onInsertImage?: (file: File) => void;
  onOpenIcons?: () => void;
  onOpenFrames?: () => void;
  isDevMode?: boolean;
  onToggleDevMode?: () => void;
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models?: Array<{ id: string; label: string }> }>;
  /** Instala a CLI de IA que ainda não está instalada (abre o terminal com o guia de instalação) */
  onInstallAiCli?: (provider: any) => void;
  onPrototypeWithAi?: (
    prompt: string,
    onProgress?: (msg: string) => void,
    /** imagens de referência anexadas (data URLs JPEG) */
    images?: string[]
  ) => Promise<{ success: boolean; error?: string } | void> | void;
  isGeneratingAi?: boolean;
  selectedFrame?: Shape | null;
}

type DropdownId = 'select' | 'frame' | 'shapes' | 'pen' | 'text' | 'comment' | 'resources' | null;

// ============================================================================
// CUSTOM PIXEL-PERFECT SVG ICONS (FIGMA ACCURATE)
// ============================================================================

function SliceIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.8 2.8L6.2 12.2L3.2 10.7L11.3 1.3L12.8 2.8Z" />
      <path d="M6.2 12.2L3.5 15" />
    </svg>
  );
}

function SectionIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="11" height="9" rx="1.5" strokeDasharray="2.5 1.5" />
      <path d="M2.5 7H13.5" />
      <path d="M2.5 4.5V2.8C2.5 2.36 2.86 2 3.3 2H6.5L8 4.5" />
    </svg>
  );
}

function TextOnPathIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 3H11.5M8 3V10" />
      <path d="M2 13C5 10.5 11 10.5 14 13" />
    </svg>
  );
}

function AnnotationIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="12" height="9.5" rx="2" />
      <path d="M5 5.5H11M5 8.5H9" />
      <circle cx="3" cy="14" r="1.3" fill={color} />
      <path d="M3 12.7V12" />
    </svg>
  );
}

function MeasurementIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="9" width="12" height="4.5" rx="1" transform="rotate(-45 8 8)" />
      <path d="M5.5 7.5L7 9M8.5 4.5L10 6M11.5 1.5L13 3" strokeWidth="1.2" />
    </svg>
  );
}

function ResourcesIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="3.5" height="3.5" rx="0.5" transform="rotate(45 4.25 4.25)" />
      <circle cx="11.5" cy="4.25" r="2.25" />
      <rect x="2.5" y="9.5" width="4" height="4" rx="0.8" />
      <path d="M11.5 9V14M9 11.5H14" strokeWidth="1.6" />
    </svg>
  );
}

function SquiggleIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 10.5C4 5.5 6 5.5 8 9.5C10 13.5 12 11.5 13.5 6.5" />
    </svg>
  );
}

function InspectMeasureIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V2H14" />
      <path d="M2 5H4.5M2 8H4.5M2 11H4.5M5 2V4.5M8 2V4.5M11 2V4.5" strokeWidth="1.2" />
      <path d="M8 8L13 13M13 13L10 13M13 13L13 10" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ComponentDiamondIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L14 8L8 14L2 8Z" />
      <path d="M8 5L11 8L8 11L5 8Z" />
    </svg>
  );
}

function FigmaPenIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 2.5L13.5 3.5L6.5 13.5L2.5 13.5L2.5 9.5L12.5 2.5Z" />
      <circle cx="5" cy="11" r="0.8" fill={color} />
      <path d="M8 7L10 9" />
    </svg>
  );
}

function CommentBubbleIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5C4.4 2.5 2 4.9 2 8C2 9.8 3 11.4 4.6 12.3L4.2 14.5L6.8 13.3C7.2 13.4 7.6 13.5 8 13.5C11.6 13.5 14 11.1 14 8C14 4.9 11.6 2.5 8 2.5Z" />
    </svg>
  );
}

export default function DesignToolbar({
  tool,
  onSelectTool,
  accentColor,
  isEffectiveDark,
  themeTokens,
  onInsertImage,
  isDevMode = false,
  onToggleDevMode,
  selectedAiProvider,
  selectedModel,
  onSelectAiProvider,
  onSelectModel,
  installedClis,
  activeModels,
  onInstallAiCli,
  onPrototypeWithAi,
  aiQueue = [],
  onEnqueueAi,
  useProjectContext = true,
  mainOutdated = false,
  onToggleProjectContext,
  selectedScreensCount = 0,
  hasDesignTokens = false,
  tokensFollowing = false,
  onToggleTokens,
  canFixLayout = false,
  onFixLayout,
  fastMode = true,
  onToggleFastMode,
  pendingAcceptCount = 0,
  onAcceptAllAi,
  onCancelAiJob,
  onMoveAiJobUp,
  onRetryAiJob,
  onOpenIcons,
  onOpenFrames,
  isGeneratingAi = false,
  selectedFrame,
}: DesignToolbarProps) {
  // Selected sub-tools (determines which icon is displayed on each tool group)
  const [selectedSelectTool, setSelectedSelectTool] = useState<ToolId>('select');
  const [selectedFrameTool, setSelectedFrameTool] = useState<ToolId>('frame');
  const [selectedShapeTool, setSelectedShapeTool] = useState<ToolId>('rect');
  const [selectedPenTool, setSelectedPenTool] = useState<ToolId>('pen');
  const [selectedTextTool, setSelectedTextTool] = useState<ToolId>('text');
  const [selectedCommentTool, setSelectedCommentTool] = useState<ToolId>('comment');

  // AI Prompt Bar State
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiImages, setAiImages] = useState<string[]>([]);
  const aiFileRef = useRef<HTMLInputElement>(null);
  /** Anexa imagens de referência, reduzidas a no máximo 1600px (JPEG) para a IA ler rápido */
  const addAiImages = (files: File[]) => {
    files.filter((f) => f.type.startsWith('image/')).slice(0, 6).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1280 / Math.max(img.width, img.height)); // menor = a IA lê mais rápido (os modelos reduzem imagens grandes de qualquer jeito)
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          setAiImages((prev) => (prev.length >= 6 ? prev : [...prev, c.toDataURL('image/jpeg', 0.8)]));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  };
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [hoveredProviderId, setHoveredProviderId] = useState<string>(selectedAiProvider || 'claude');
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAiPromptOpen) {
      setTimeout(() => aiTextareaRef.current?.focus(), 60);
    } else {
      setIsModelPickerOpen(false);
    }
  }, [isAiPromptOpen]);

  useEffect(() => {
    if (selectedAiProvider) {
      setHoveredProviderId(selectedAiProvider);
    }
  }, [selectedAiProvider]);

  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [aiStatusType, setAiStatusType] = useState<'info' | 'success' | 'error' | null>(null);

  // "Enviado": feedback rápido no botão; o trabalho segue na fila
  const [justSent, setJustSent] = useState(false);
  const [showSendHint, setShowSendHint] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const sentTimer = useRef<any>(null);
  const handleSendAi = () => {
    if (!aiPromptText.trim()) return;
    onEnqueueAi?.(aiPromptText.trim(), aiImages);
    setAiPromptText('');
    setAiImages([]);
    setJustSent(true);
    clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setJustSent(false), 1400);
  };

  const getActiveModelName = (provId: string) => {
    const activeInfo = activeModels?.[provId];
    if (activeInfo?.currentModel) return activeInfo.currentModel;
    if (provId === selectedAiProvider && selectedModel) {
      const p = AI_PROVIDERS.find((item) => item.id === provId);
      const match = p?.models?.find(
        (m) =>
          m.toLowerCase() === selectedModel.toLowerCase() ||
          m.toLowerCase().includes(selectedModel.toLowerCase()) ||
          selectedModel.toLowerCase().includes(m.toLowerCase())
      );
      if (match) return match;
      return selectedModel;
    }
    const p = AI_PROVIDERS.find((item) => item.id === provId);
    return p?.models?.[0] || 'Default';
  };

  const currentProviderObj = AI_PROVIDERS.find((p) => p.id === (selectedAiProvider || 'claude')) || AI_PROVIDERS[0];
  const activeModelDisplay = getActiveModelName(currentProviderObj.id);

  const targetHoveredProvider = AI_PROVIDERS.find((p) => p.id === hoveredProviderId) || currentProviderObj;
  const hoveredDynamicList = activeModels?.[targetHoveredProvider.id]?.models || [];
  const hoveredFallbackList = (targetHoveredProvider.models || []).map((mName) => ({
    id: mName,
    label: mName,
  }));
  const hoveredModelList = hoveredDynamicList.length > 0 ? hoveredDynamicList : hoveredFallbackList;

  // Open dropdown flyout
  const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);

  // File input ref for Image/video... tool
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModelPickerOpen) {
          setIsModelPickerOpen(false);
        } else {
          setActiveDropdown(null);
        }
      }
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isModelPickerOpen]);

  // Update selected sub-tool based on global tool prop
  useEffect(() => {
    if (tool === 'select' || tool === 'scale') setSelectedSelectTool(tool);
    else if (tool === 'frame' || tool === 'section' || tool === 'slice') setSelectedFrameTool(tool);
    else if (
      tool === 'rect' ||
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'ellipse' ||
      tool === 'polygon' ||
      tool === 'star' ||
      tool === 'image'
    )
      setSelectedShapeTool(tool);
    else if (tool === 'pen' || tool === 'pencil') setSelectedPenTool(tool);
    else if (tool === 'text' || tool === 'text-path') setSelectedTextTool(tool);
    else if (tool === 'comment' || tool === 'annotation' || tool === 'measurement') setSelectedCommentTool(tool);
  }, [tool]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onInsertImage) {
      onInsertImage(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Check if a tool group is currently active
  const isSelectActive = tool === 'select' || tool === 'scale';
  const isFrameActive = tool === 'frame' || tool === 'section' || tool === 'slice';
  const isShapeActive =
    tool === 'rect' ||
    tool === 'line' ||
    tool === 'arrow' ||
    tool === 'ellipse' ||
    tool === 'polygon' ||
    tool === 'star' ||
    tool === 'image';
  const isPenActive = tool === 'pen' || tool === 'pencil';
  const isTextActive = tool === 'text' || tool === 'text-path';
  const isCommentActive = tool === 'comment' || tool === 'annotation' || tool === 'measurement';

  // Flyout styles
  const flyoutStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 10px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: themeTokens.bgCardElevated,
    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
    borderRadius: 12,
    boxShadow: isEffectiveDark
      ? '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)'
      : '0 12px 36px rgba(0, 0, 0, 0.15)',
    padding: '6px 4px',
    minWidth: 175,
    zIndex: 100,
    userSelect: 'none',
  };

  const renderMenuItem = (
    id: ToolId,
    label: string,
    icon: React.ReactNode,
    shortcut?: string,
    onCustomClick?: () => void
  ) => {
    const isCurrent = tool === id;
    return (
      <div
        key={id}
        onClick={(e) => {
          e.stopPropagation();
          if (onCustomClick) {
            onCustomClick();
          } else {
            onSelectTool(id);
          }
          setActiveDropdown(null);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 10px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'Poppins', sans-serif",
          color: themeTokens.textPrimary,
          transition: 'background 0.1s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
          {isCurrent && <Check size={13} strokeWidth={2.5} color={themeTokens.textPrimary} />}
        </div>
        <div style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          {icon}
        </div>
        <span style={{ fontWeight: 400, flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
        {shortcut && (
          <span style={{ fontSize: 11, color: themeTokens.textMuted, marginLeft: 16, fontFamily: "'Poppins', sans-serif" }}>
            {shortcut}
          </span>
        )}
      </div>
    );
  };

  // Render current icon for Shape Group
  const getShapeIcon = (sz = 17) => {
    switch (selectedShapeTool) {
      case 'line':
        return <Minus size={sz} />;
      case 'arrow':
        return <ArrowUpRight size={sz} />;
      case 'ellipse':
        return <Circle size={sz} />;
      case 'polygon':
        return <Triangle size={sz} />;
      case 'star':
        return <Star size={sz} />;
      case 'image':
        return <ImageIcon size={sz} />;
      default:
        return <Square size={sz} />;
    }
  };

  // Render current icon for Frame Group
  const getFrameIcon = (sz = 17) => {
    switch (selectedFrameTool) {
      case 'section':
        return <SectionIcon size={sz} />;
      case 'slice':
        return <SliceIcon size={sz} />;
      default:
        return <Hash size={sz} />;
    }
  };

  // Render current icon for Pen Group
  const getPenIcon = (sz = 17) => {
    switch (selectedPenTool) {
      case 'pencil':
        return <Pencil size={sz} />;
      default:
        return <FigmaPenIcon size={sz} />;
    }
  };

  // Render current icon for Text Group
  const getTextIcon = (sz = 17) => {
    switch (selectedTextTool) {
      case 'text-path':
        return <TextOnPathIcon size={sz} />;
      default:
        return <Type size={sz} />;
    }
  };

  // Render current icon for Comment Group
  const getCommentIcon = (sz = 17) => {
    switch (selectedCommentTool) {
      case 'annotation':
        return <AnnotationIcon size={sz} />;
      case 'measurement':
        return <MeasurementIcon size={sz} />;
      default:
        return <CommentBubbleIcon size={sz} />;
    }
  };

  const renderSplitToolGroup = ({
    toolId,
    isActive,
    title,
    icon,
    dropdownId,
    flyout,
  }: {
    toolId: ToolId;
    isActive: boolean;
    title: string;
    icon: React.ReactNode;
    dropdownId: DropdownId;
    flyout: React.ReactNode;
  }) => {
    const isDropdownOpen = activeDropdown === dropdownId;
    const dividerBg = isActive
      ? 'rgba(0, 0, 0, 0.22)'
      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)');

    return (
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          background: isActive ? accentColor : 'transparent',
          borderRadius: 8,
          border: 'none',
          overflow: 'visible',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Botão Principal da Ferramenta */}
        <button
          type="button"
          onClick={() => onSelectTool(toolId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 32,
            minWidth: 32,
            padding: '0 6px',
            borderRadius: isActive ? '7px 0 0 7px' : 7,
            border: 'none',
            background: 'transparent',
            color: isActive ? '#ffffff' : themeTokens.textPrimary,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title={title}
          onMouseEnter={(e) => {
            if (!isActive) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
          }}
          onMouseLeave={(e) => {
            if (!isActive) e.currentTarget.style.background = 'transparent';
          }}
        >
          {icon}
        </button>

        {/* Linha Divisória entre a ferramenta e a seta */}
        <div
          style={{
            width: 1,
            height: 18,
            background: dividerBg,
            flexShrink: 0,
          }}
        />

        {/* Botão de seta com fundo transparente */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveDropdown(isDropdownOpen ? null : dropdownId);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 32,
            width: 18,
            padding: 0,
            border: 'none',
            borderRadius: '0 7px 7px 0',
            background: 'transparent',
            color: isActive ? '#ffffff' : themeTokens.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          title="Mais opções da ferramenta"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isActive
              ? 'rgba(0, 0, 0, 0.18)'
              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ChevronDown size={11} strokeWidth={2.4} />
        </button>

        {isDropdownOpen && flyout}
      </div>
    );
  };

  return (
    <>
      {/* Hidden File Input for Image/Video upload */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ===================================================================== */}
      {/* SE O PROMPT DE IA ESTIVER ABERTO: MOSTRA A DIV DE PROMPT DE IA        */}
      {/* ===================================================================== */}
      {isAiPromptOpen ? (
        <div
          id="design-ai-prompt-bar"
          ref={containerRef}
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(640px, 94vw)',
            background: themeTokens.bgCard,
            border: 'none',
            borderRadius: 12,
            boxShadow: 'none',
            padding: '8px 8px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 60,
            fontFamily: "'Poppins', sans-serif",
            userSelect: 'none',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Fila de gerações: cards fora da barra, 5px acima dela; o que foi enviado fica aqui com loading e os próximos esperam */}
          {aiQueue.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 5px)', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 'min(320px, 50vh)', overflowY: 'auto', zIndex: 110 }}>
              {aiQueue.map((job, idx) => {
                const running = job.status === 'running';
                const failed = job.status === 'error';
                const canMoveUp = job.status === 'queued' && idx > 1; // nunca acima do que já está sendo gerado
                const expanded = !!expandedJobs[job.id];
                const iconBtn: React.CSSProperties = { width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: themeTokens.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 };
                return (
                  <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: themeTokens.bgCard, backdropFilter: 'blur(16px)', borderRadius: 10, borderLeft: `3px solid ${failed ? '#ef4444' : running ? accentColor : themeTokens.border}` }}>
                    <button
                      type="button"
                      title={expanded ? 'Recolher' : 'Expandir o prompt'}
                      onClick={() => setExpandedJobs((m) => ({ ...m, [job.id]: !m[job.id] }))}
                      style={{ ...iconBtn, alignSelf: expanded ? 'flex-start' : 'center' }}
                    >
                      <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {!expanded && (job.images?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }} title={`${job.images!.length} imagem(ns) de referência`}>
                        {job.images!.slice(0, 3).map((src, i) => (
                          <img key={i} src={src} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: `1px solid ${themeTokens.border}` }} />
                        ))}
                        {job.images!.length > 3 && <span style={{ fontSize: 10, color: themeTokens.textMuted }}>+{job.images!.length - 3}</span>}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        title={expanded ? undefined : job.label}
                        style={{ fontSize: 12, color: themeTokens.textPrimary, lineHeight: 1.4, ...(expanded ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}
                      >{job.label}</div>
                      {expanded && (job.images?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {job.images!.map((src, i) => (
                            <img key={i} src={src} alt={`Referência ${i + 1}`} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: `1px solid ${themeTokens.border}` }} />
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: themeTokens.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {failed ? <span style={{ color: '#f87171' }} title={job.progress}>Falhou: {job.progress}</span> : running ? job.progress || 'Iniciando…' : `Na fila · ${idx}º`}
                      </div>
                    </div>
                    {failed && (
                      <button type="button" title="Tentar de novo" onClick={() => onRetryAiJob?.(job.id)} style={iconBtn}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {job.status === 'queued' && (
                      <button type="button" title="Subir na fila" disabled={!canMoveUp} onClick={() => onMoveAiJobUp?.(job.id)} style={{ ...iconBtn, opacity: canMoveUp ? 1 : 0.3, cursor: canMoveUp ? 'pointer' : 'default' }}>
                        <ArrowUp size={14} />
                      </button>
                    )}
                    <button type="button" title={running ? 'Cancelar geração' : failed ? 'Dispensar' : 'Remover da fila'} onClick={() => {
                      if (job.prompt) { // não perde o que foi escrito: volta para a caixa de texto
                        setAiPromptText((t) => (t.trim() ? `${t}\n${job.prompt}` : job.prompt!));
                        if (job.images?.length) setAiImages((im) => (im.length ? im : job.images!));
                      }
                      onCancelAiJob?.(job.id);
                    }} style={iconBtn}>
                      <X size={14} />
                    </button>
                    {running && <Loader2 size={15} className="animate-spin" style={{ flexShrink: 0, color: accentColor }} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal / Popover de Seleção de IA e Modelo (ancorado acima da div de prompt) */}
          {isModelPickerOpen && (
            <div
              ref={modelPickerRef}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 10px)',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                zIndex: 120,
                userSelect: 'none',
              }}
            >
              {/* Coluna da Esquerda: Modelos da IA Hovered/Ativa */}
              <div
                style={{
                  background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: 'none',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 175,
                  maxWidth: 220,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    padding: '4px 8px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: themeTokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: 'none',
                    marginBottom: 3,
                  }}
                >
                  Modelos {targetHoveredProvider.name}
                </div>
                {hoveredModelList.map((m) => {
                  const currentId = activeModels?.[targetHoveredProvider.id]?.currentModelId;
                  const currentLabel = activeModels?.[targetHoveredProvider.id]?.currentModel;
                  const isCurrent =
                    targetHoveredProvider.id === selectedAiProvider &&
                    (currentId === m.id ||
                      currentLabel === m.label ||
                      (selectedModel && (selectedModel === m.id || selectedModel === m.label || getActiveModelName(targetHoveredProvider.id) === m.label)));

                  return (
                    <div
                      key={m.id}
                      data-testid={`ai-model-row-${m.id}`}
                      onClick={() => {
                        onSelectAiProvider?.(targetHoveredProvider.id);
                        onSelectModel?.(m, targetHoveredProvider.id);
                        setIsModelPickerOpen(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: isCurrent ? (isEffectiveDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.12)') : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: isCurrent ? '#22c55e' : themeTokens.textPrimary,
                          fontWeight: isCurrent ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.label}
                      </span>
                      {isCurrent && <Check size={13} color="#22c55e" />}
                    </div>
                  );
                })}
              </div>

              {/* Coluna da Direita: Selecionar IA & Modelo */}
              <div
                style={{
                  background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: 'none',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 260,
                }}
              >
                <div
                  style={{
                    padding: '4px 8px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: themeTokens.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: 'none',
                    marginBottom: 3,
                  }}
                >
                  Selecionar IA & Modelo
                </div>
                {AI_PROVIDERS.map((p) => {
                  const isInstalled = installedClis?.[p.id] ?? true;
                  const isSelected = selectedAiProvider === p.id;
                  const isHovered = hoveredProviderId === p.id;
                  const pQuota = DEFAULT_AI_QUOTAS[p.id] || { dailyPercent: 100, weeklyPercent: 100 };
                  const currentModelName = getActiveModelName(p.id);

                  return (
                    <div
                      key={p.id}
                      data-testid={`ai-provider-row-${p.id}`}
                      onClick={() => {
                        if (!isInstalled) {
                          onInstallAiCli?.(p);
                          return;
                        }
                        setHoveredProviderId(p.id);
                        onSelectAiProvider?.(p.id);
                        if (hoveredModelList.length === 0) {
                          setIsModelPickerOpen(false);
                        }
                      }}
                      onMouseEnter={() => {
                        setHoveredProviderId(p.id);
                      }}
                      style={{
                        padding: '7px 10px',
                        color: themeTokens.textPrimary,
                        fontSize: 12,
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        background: isSelected
                          ? (isEffectiveDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.12)')
                          : isHovered
                          ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        {/* Porcentagem de uso D% / S% */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            lineHeight: 1.05,
                            flexShrink: 0,
                            minWidth: 32,
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <span style={{ fontSize: 7.5, fontWeight: 700, color: '#22c55e' }}>D</span>
                            <span style={{ fontSize: 8.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                              {pQuota.dailyPercent}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <span style={{ fontSize: 7.5, fontWeight: 700, color: '#22c55e' }}>S</span>
                            <span style={{ fontSize: 8.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                              {pQuota.weeklyPercent}%
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {renderAiIcon(p.id, 16)}
                        </div>

                        <span style={{ color: isSelected ? '#22c55e' : themeTokens.textPrimary }}>{p.name}</span>
                        {isSelected && currentModelName && (
                          <span style={{ fontSize: 11, color: themeTokens.textSecondary, opacity: 0.8, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            • {currentModelName}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isInstalled ? (
                          <>
                            {isSelected && <Check size={13} color="#22c55e" />}
                            <ChevronRight size={13} color={themeTokens.textSecondary} />
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInstallAiCli?.(p);
                            }}
                            style={{
                              fontSize: 10,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: '#22c55e',
                              border: 'none',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            <SquareTerminal size={10} />
                            <span>Instalar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header com ícone da IA e Modelo selecionados centralizados */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '2px 4px',
              minHeight: 28,
            }}
          >
            {/* Lado Esquerdo: Nome do Frame Selecionado se houver */}
            {selectedFrame && (
              <div
                style={{
                  position: 'absolute',
                  left: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: themeTokens.textPrimary,
                  fontSize: 11,
                  fontWeight: 500,
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={selectedScreensCount > 1 ? `${selectedScreensCount} telas selecionadas: a IA aplica o pedido em todas` : `Frame selecionado: ${selectedFrame.name}`}
              >
                <Hash size={12} color={accentColor} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedScreensCount > 1 ? `${selectedScreensCount} telas` : selectedFrame.name}
                </span>
              </div>
            )}

            {/* Botão de seleção de IA & Modelo no Centro */}
            <button
              id="design-ai-model-selector-btn"
              type="button"
              onClick={() => setIsModelPickerOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isModelPickerOpen
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
                  : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                border: 'none',
                borderRadius: 8,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                color: themeTokens.textPrimary,
              }}
              title="Clique para alternar IA e modelo"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {renderAiIcon(selectedAiProvider || 'claude', 16)}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                {currentProviderObj.name}
              </span>
              {activeModelDisplay && (
                <>
                  <span style={{ fontSize: 11, color: themeTokens.textMuted }}>•</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textSecondary }}>
                    {activeModelDisplay}
                  </span>
                </>
              )}
              <ChevronDown
                size={13}
                color={themeTokens.textMuted}
                style={{
                  transition: 'transform 0.2s',
                  transform: isModelPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {/* Botão de Fechar / Voltar para Ferramentas Pinned na Direita */}
            <button
              id="design-ai-prompt-close"
              type="button"
              onClick={() => {
                setIsModelPickerOpen(false);
                setIsAiPromptOpen(false);
              }}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: themeTokens.textMuted,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = themeTokens.textPrimary;
                e.currentTarget.style.background = themeTokens.hoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = themeTokens.textMuted;
                e.currentTarget.style.background = 'transparent';
              }}
              title="Voltar para ferramentas (Esc)"
            >
              <X size={15} />
            </button>
          </div>

          {mainOutdated && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#fbbf24', fontSize: 11.5, lineHeight: 1.45 }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <span><strong>Reinicie o app.</strong> O processo principal está desatualizado: imagens de referência, fotos da IA e outros recursos novos não funcionam até reiniciar.</span>
            </div>
          )}

          {/* Campo de Digitação de Prompt com Altura Vertical Expandida */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer.files || []);
              if (files.some((f) => f.type.startsWith('image/'))) {
                e.preventDefault();
                addAiImages(files);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 10px',
              gap: 8,
            }}
          >
            {aiImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {aiImages.map((src, i) => (
                  <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: `1px solid ${themeTokens.border}` }}>
                    <img src={src} alt={`Referência ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      title="Remover imagem"
                      onClick={() => setAiImages((prev) => prev.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: '16px', padding: 0 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              id="design-ai-prompt-input"
              ref={aiTextareaRef}
              rows={3}
              value={aiPromptText}
              onChange={(e) => {
                setAiPromptText(e.target.value);
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
                if (files.length) {
                  e.preventDefault();
                  addAiImages(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAi();
                } else if (e.key === 'Escape') {
                  if (isModelPickerOpen) {
                    setIsModelPickerOpen(false);
                  } else {
                    setIsAiPromptOpen(false);
                  }
                }
              }}
              placeholder={
                selectedScreensCount > 1
                  ? `Modificar as ${selectedScreensCount} telas selecionadas com IA... Ex: 'Troque a cor primária para azul'`
                  : selectedFrame
                  ? `Modificar "${selectedFrame.name}" com IA... Ex: 'Adicionar barra de busca e 3 cards de métricas'`
                  : "Descreva a tela para a IA prototipar... Ex: 'Tela de login moderna com dark mode e botão Google'"
              }
              style={{
                width: '100%',
                minHeight: 72,
                maxHeight: 180,
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: "'Poppins', sans-serif",
                padding: 0,
                boxSizing: 'border-box',
              }}
            />

            {/* Linha Divisória */}
            <div
              style={{
                height: 1,
                width: '100%',
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                margin: '2px 0',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
              <input ref={aiFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addAiImages(Array.from(e.target.files || [])); e.target.value = ''; }} />
              <button
                type="button"
                title="Anexar imagens"
                onClick={() => aiFileRef.current?.click()}
                style={{ background: 'transparent', border: 'none', color: aiImages.length ? accentColor : themeTokens.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 6px', marginRight: 6, flexShrink: 0 }}
              >
                <Paperclip size={14} />{aiImages.length > 0 && aiImages.length}
              </button>
              <button
                type="button"
                onClick={() => onToggleTokens?.()}
                title={!hasDesignTokens ? 'Design tokens (criar)' : tokensFollowing ? 'Design tokens: ligado' : 'Design tokens: desligado'}
                style={{ width: 28, height: 28, border: 'none', borderRadius: 8, padding: 0, marginRight: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokensFollowing ? accentColor + '26' : 'transparent', color: tokensFollowing ? accentColor : themeTokens.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
              >
                <Palette size={14} />
              </button>
              {canFixLayout && (
                <button
                  type="button"
                  onClick={() => onFixLayout?.()}
                  title="Corrigir layout"
                  style={{ width: 28, height: 28, border: 'none', borderRadius: 8, padding: 0, marginRight: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: themeTokens.textSecondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                >
                  <Wand2 size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggleFastMode?.(!fastMode)}
                title={fastMode ? 'Modo rápido: ligado' : 'Modo rápido: desligado'}
                style={{ width: 28, height: 28, border: 'none', borderRadius: 8, padding: 0, marginRight: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fastMode ? accentColor + '26' : 'transparent', color: fastMode ? accentColor : themeTokens.textMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
              >
                <Zap size={14} />
              </button>
              {pendingAcceptCount > 1 && (
                <button
                  type="button"
                  onClick={() => onAcceptAllAi?.()}
                  title="Aceitar todas as telas geradas que estão aguardando revisão"
                  style={{ height: 24, border: 'none', borderRadius: 7, padding: '0 10px', marginRight: 8, flexShrink: 0, background: accentColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
                >
                  ✓ Aceitar tudo ({pendingAcceptCount})
                </button>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={useProjectContext}
                onClick={() => onToggleProjectContext?.(!useProjectContext)}
                title={useProjectContext ? 'Contexto do projeto: ligado' : 'Contexto do projeto: desligado'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', marginRight: 8, flexShrink: 0, color: useProjectContext ? themeTokens.textPrimary : themeTokens.textMuted, fontSize: 11, fontFamily: "'Poppins', sans-serif" }}
              >
                <span style={{ position: 'relative', width: 26, height: 15, borderRadius: 8, background: useProjectContext ? accentColor : (isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'), transition: 'background 0.15s ease', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: useProjectContext ? 13 : 2, width: 11, height: 11, borderRadius: 6, background: '#fff', transition: 'left 0.15s ease' }} />
                </span>
                Contexto do projeto
              </button>
              <div style={{ flex: 1 }} />

              {/* ⓘ: atalhos de envio em um tooltip (antes era um texto fixo na barra) */}
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: 8, flexShrink: 0 }}
                onMouseEnter={() => setShowSendHint(true)}
                onMouseLeave={() => setShowSendHint(false)}
              >
                <button
                  type="button"
                  aria-label="Atalhos de envio"
                  tabIndex={-1}
                  onFocus={() => setShowSendHint(true)}
                  onBlur={() => setShowSendHint(false)}
                  style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'help', color: showSendHint ? themeTokens.textPrimary : themeTokens.textMuted, display: 'flex', alignItems: 'center', transition: 'color 0.12s ease' }}
                >
                  <Info size={15} />
                </button>
                {showSendHint && (
                  <div
                    role="tooltip"
                    style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', whiteSpace: 'nowrap', padding: '7px 11px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.5, fontFamily: "'Poppins', sans-serif", color: isEffectiveDark ? '#f1f1f1' : '#1e293b', background: isEffectiveDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, boxShadow: isEffectiveDark ? '0 10px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)' : '0 10px 25px rgba(0,0,0,0.15)', pointerEvents: 'none', zIndex: 130 }}
                  >
                    <strong>Enter</strong> para {selectedFrame ? 'modificar' : 'gerar'}
                    <br />
                    <strong>Shift+Enter</strong> para pular linha
                  </div>
                )}
              </div>

              <button
                id="design-ai-prompt-submit"
                type="button"
                disabled={!aiPromptText.trim()}
                onClick={handleSendAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: aiPromptText.trim()
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.08)',
                  color: aiPromptText.trim() ? '#ffffff' : themeTokens.textMuted,
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: aiPromptText.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {justSent ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Enviado</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{selectedFrame ? 'Modificar' : 'Gerar'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* SE NÃO ESTIVER EM MODO IA: BARRA DE FERRAMENTAS + DIV DE IA À DIREITA */
        /* ===================================================================== */
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            zIndex: 50,
            userSelect: 'none',
          }}
        >
          {/* BARRA DE FERRAMENTAS COM DIVISÓRIAS E COR DE FUNDO NAS SETAS */}
          <div
            id="design-tools-bar"
            style={{
              height: 44,
              boxSizing: 'border-box',
              background: themeTokens.bgCard,
              border: 'none',
              borderRadius: 12,
              boxShadow: 'none',
              display: 'flex',
              alignItems: 'center',
              padding: 5,
              gap: 5,
            }}
          >
            {/* 1. SELEÇÃO / MOVER (MOVE & SCALE) */}
            {renderSplitToolGroup({
              toolId: selectedSelectTool,
              isActive: isSelectActive,
              title: selectedSelectTool === 'scale' ? 'Redimensionar (K)' : 'Mover (V)',
              icon: selectedSelectTool === 'scale' ? <Maximize2 size={16} /> : <MousePointer2 size={16} />,
              dropdownId: 'select',
              flyout: (
                <div style={flyoutStyle}>
                  {renderMenuItem('select', 'Move', <MousePointer2 size={14} />, 'V')}
                  {renderMenuItem('scale', 'Scale', <Maximize2 size={14} />, 'K')}
                </div>
              ),
            })}

            {/* 2. FRAME / SECTION / SLICE */}
            {renderSplitToolGroup({
              toolId: selectedFrameTool,
              isActive: isFrameActive,
              title: selectedFrameTool === 'section' ? 'Seção (⇧S)' : selectedFrameTool === 'slice' ? 'Fatia (S)' : 'Frame (F)',
              icon: getFrameIcon(16),
              dropdownId: 'frame',
              flyout: (
                <div style={flyoutStyle}>
                  {renderMenuItem('frame', 'Frame', <Hash size={14} />, 'F')}
                  {renderMenuItem('section', 'Section', <SectionIcon size={14} />, '⇧S')}
                  {renderMenuItem('slice', 'Slice', <SliceIcon size={14} />, 'S')}
                </div>
              ),
            })}

            {/* 3. FORMAS / SHAPES */}
            {renderSplitToolGroup({
              toolId: selectedShapeTool,
              isActive: isShapeActive,
              title: 'Formas',
              icon: getShapeIcon(16),
              dropdownId: 'shapes',
              flyout: (
                <div style={{ ...flyoutStyle, minWidth: 195 }}>
                  {renderMenuItem('rect', 'Rectangle', <Square size={14} />, 'R')}
                  {renderMenuItem('line', 'Line', <Minus size={14} />, 'L')}
                  {renderMenuItem('arrow', 'Arrow', <ArrowUpRight size={14} />, '⇧L')}
                  {renderMenuItem('ellipse', 'Ellipse', <Circle size={14} />, 'O')}
                  {renderMenuItem('polygon', 'Polygon', <Triangle size={14} />)}
                  {renderMenuItem('star', 'Star', <Star size={14} />)}
                  {renderMenuItem(
                    'image',
                    'Image/video...',
                    <ImageIcon size={14} />,
                    '⇧⌘K',
                    () => fileInputRef.current?.click()
                  )}
                </div>
              ),
            })}

            {/* 4. CANETA / LÁPIS */}
            {renderSplitToolGroup({
              toolId: selectedPenTool,
              isActive: isPenActive,
              title: selectedPenTool === 'pencil' ? 'Lápis (⇧P)' : 'Caneta (P)',
              icon: getPenIcon(16),
              dropdownId: 'pen',
              flyout: (
                <div style={flyoutStyle}>
                  {renderMenuItem('pen', 'Pen', <FigmaPenIcon size={14} />, 'P')}
                  {renderMenuItem('pencil', 'Pencil', <Pencil size={14} />, '⇧P')}
                </div>
              ),
            })}

            {/* 5. TEXTO */}
            {renderSplitToolGroup({
              toolId: selectedTextTool,
              isActive: isTextActive,
              title: selectedTextTool === 'text-path' ? 'Texto no caminho' : 'Texto (T)',
              icon: getTextIcon(16),
              dropdownId: 'text',
              flyout: (
                <div style={flyoutStyle}>
                  {renderMenuItem('text', 'Text', <Type size={14} />, 'T')}
                  {renderMenuItem('text-path', 'Text on path', <TextOnPathIcon size={14} />)}
                </div>
              ),
            })}

            {/* 6. COMENTÁRIOS / ANOTAÇÕES / MEDIDAS */}
            {renderSplitToolGroup({
              toolId: selectedCommentTool,
              isActive: isCommentActive,
              title:
                selectedCommentTool === 'annotation'
                  ? 'Anotação (Y)'
                  : selectedCommentTool === 'measurement'
                  ? 'Medição (⇧M)'
                  : 'Comentário (C)',
              icon: getCommentIcon(16),
              dropdownId: 'comment',
              flyout: (
                <div style={{ ...flyoutStyle, minWidth: 185 }}>
                  {renderMenuItem('comment', 'Comment', <CommentBubbleIcon size={14} />, 'C')}
                  {renderMenuItem('annotation', 'Annotation', <AnnotationIcon size={14} />, 'Y')}
                  {renderMenuItem('measurement', 'Measurement', <MeasurementIcon size={14} />, '⇧M')}
                </div>
              ),
            })}
          </div>

          {onOpenFrames && (
            <div
              role="button"
              tabIndex={0}
              title="Frames de dispositivos (celular, tablet, desktop)"
              onClick={onOpenFrames}
              style={{ width: 44, height: 44, boxSizing: 'border-box', borderRadius: 12, background: themeTokens.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: themeTokens.textPrimary }}
            >
              <MonitorSmartphone size={18} />
            </div>
          )}
          {onOpenIcons && (
            <div
              role="button"
              tabIndex={0}
              title="Ícones (Material)"
              onClick={onOpenIcons}
              style={{ width: 44, height: 44, boxSizing: 'border-box', borderRadius: 12, background: themeTokens.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: themeTokens.textPrimary }}
            >
              <Shapes size={18} />
            </div>
          )}

          {/* DIV À DIREITA COM ÍCONE DE IA SELECIONADA NA HEADER */}
          <div
            id="design-ai-trigger-btn"
            data-testid="design-ai-trigger-btn"
            role="button"
            tabIndex={0}
            onClick={() => setIsAiPromptOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsAiPromptOpen(true);
              }
            }}
            style={{
              width: 44,
              height: 44,
              boxSizing: 'border-box',
              padding: 0,
              borderRadius: 12,
              background: themeTokens.bgCard,
              border: 'none',
              boxShadow: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              color: themeTokens.textPrimary,
            }}
            title="Prototipar com IA"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {renderAiIcon(selectedAiProvider || 'claude', 22)}
              {aiQueue.length > 0 && (
                <span style={{ position: 'absolute', top: -8, right: -10, minWidth: 16, height: 16, borderRadius: 8, background: accentColor, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{aiQueue.length}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
