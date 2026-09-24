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
  Hand,
  Hash,
  ChevronDown,
  ChevronRight,
  Check,
  Maximize2,
  Sparkles,
  X,
  Loader2,
  SquareTerminal,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { ToolId, Shape } from './types';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { AI_PROVIDERS, DEFAULT_AI_QUOTAS } from '../../constants/ai';

export interface DesignToolbarProps {
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
  isDevMode?: boolean;
  onToggleDevMode?: () => void;
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models?: Array<{ id: string; label: string }> }>;
  onPrototypeWithAi?: (
    prompt: string,
    onProgress?: (msg: string) => void
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

  const handleSendAi = async () => {
    if (!aiPromptText.trim() || isGeneratingAi) return;
    const p = aiPromptText;
    setAiStatusType('info');
    setAiStatusMessage(
      selectedFrame
        ? `Modificando frame "${selectedFrame.name}" com ${currentProviderObj.name}...`
        : `Conectando ao modelo ${activeModelDisplay} e gerando protótipo...`
    );

    try {
      const res = await onPrototypeWithAi?.(p, (progressMsg: string) => {
        setAiStatusMessage(progressMsg);
      });

      if (res && res.success === false) {
        setAiStatusType('error');
        setAiStatusMessage(res.error || 'Erro ao gerar protótipo com IA.');
      } else {
        setAiStatusType('success');
        setAiStatusMessage(
          selectedFrame
            ? `Frame "${selectedFrame.name}" modificado com sucesso!`
            : 'Tela prototipada com sucesso! ✨'
        );
        setAiPromptText('');
      }
    } catch (err: any) {
      setAiStatusType('error');
      setAiStatusMessage(
        err?.message || 'Falha ao processar protótipo com IA. Tente novamente.'
      );
    }
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
                title={`Frame selecionado: ${selectedFrame.name}`}
              >
                <Hash size={12} color={accentColor} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFrame.name}
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

          {/* Campo de Digitação de Prompt com Altura Vertical Expandida */}
          <div
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
            <textarea
              id="design-ai-prompt-input"
              ref={aiTextareaRef}
              rows={3}
              value={aiPromptText}
              onChange={(e) => {
                setAiPromptText(e.target.value);
                if (aiStatusType === 'error' || aiStatusType === 'success') {
                  setAiStatusType(null);
                  setAiStatusMessage(null);
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
                selectedFrame
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

            {/* Feedback / Status da IA */}
            {aiStatusMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  background:
                    aiStatusType === 'error'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : aiStatusType === 'success'
                      ? 'rgba(34, 197, 94, 0.12)'
                      : 'rgba(59, 130, 246, 0.12)',
                  border:
                    aiStatusType === 'error'
                      ? '1px solid rgba(239, 68, 68, 0.25)'
                      : aiStatusType === 'success'
                      ? '1px solid rgba(34, 197, 94, 0.25)'
                      : '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color:
                    aiStatusType === 'error'
                      ? '#ef4444'
                      : aiStatusType === 'success'
                      ? '#22c55e'
                      : '#60a5fa',
                  boxSizing: 'border-box',
                }}
              >
                {aiStatusType === 'error' && <AlertCircle size={14} style={{ flexShrink: 0 }} />}
                {aiStatusType === 'success' && <CheckCircle2 size={14} style={{ flexShrink: 0 }} />}
                {aiStatusType === 'info' && <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>{aiStatusMessage}</span>
                {aiStatusType !== 'info' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiStatusMessage(null);
                      setAiStatusType(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      opacity: 0.7,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
              <span style={{ fontSize: 11, color: themeTokens.textMuted, userSelect: 'none' }}>
                Pressione <strong style={{ color: themeTokens.textSecondary }}>Enter</strong> para {selectedFrame ? 'modificar' : 'prototipar'} ou <strong style={{ color: themeTokens.textSecondary }}>Shift+Enter</strong> para pular linha
              </span>

              <button
                id="design-ai-prompt-submit"
                type="button"
                disabled={!aiPromptText.trim() || isGeneratingAi}
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
                  cursor: aiPromptText.trim() && !isGeneratingAi ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{selectedFrame ? 'Modificando...' : 'Gerando...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{selectedFrame ? 'Modificar' : 'Prototipar'}</span>
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

            {/* 1.5 MÃO / PAN (H) */}
            <button
              type="button"
              onClick={() => onSelectTool('hand')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 32,
                minWidth: 32,
                padding: '0 7px',
                borderRadius: 8,
                border: 'none',
                background: tool === 'hand' ? accentColor : 'transparent',
                color: tool === 'hand' ? '#ffffff' : themeTokens.textPrimary,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              title="Mão / Pan (H)"
              onMouseEnter={(e) => {
                if (tool !== 'hand') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                if (tool !== 'hand') e.currentTarget.style.background = 'transparent';
              }}
            >
              <Hand size={16} />
            </button>

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderAiIcon(selectedAiProvider || 'claude', 22)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
