import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  FlipHorizontal,
  FlipVertical,
  Link,
  Unlink,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Grid2x2,
  Sparkles,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Droplet,
  Check,
  X,
  RotateCw,
  SlidersHorizontal,
  MoreHorizontal,
} from 'lucide-react';
import type { Shape, FillItem, StrokeItem, EffectItem, ExportItem, EffectType } from './types';
import FigmaColorPicker from './FigmaColorPicker';
import FigmaEffectSettingsModal, {
  getEffectIcon,
  getEffectLabel,
} from './FigmaEffectSettingsModal';
import ScrubbableNumberInput from './ScrubbableNumberInput';

export interface ActiveColorPickerInfo {
  target: 'fill' | 'stroke';
  id: string;
}

// ---------------------------------------------------------------------------
// FIGMA SVG ICONS (Alignment, Focus, Rotation, Flip, Angle)
// ---------------------------------------------------------------------------
const FigmaFocusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 5.5V3.5A1 1 0 0 1 3.5 2.5H5.5" />
    <path d="M10.5 2.5h2a1 1 0 0 1 1 1v2" />
    <path d="M13.5 10.5v2a1 1 0 0 1-1 1h-2" />
    <path d="M5.5 13.5H3.5a1 1 0 0 1-1-1v-2" />
    <rect x="5.5" y="5.5" width="5" height="5" rx="1" strokeWidth="1.3" />
  </svg>
);

const FigmaAlignLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="1.5" height="12" rx="0.5" />
    <rect x="4.5" y="4" width="7" height="2.5" rx="0.75" />
    <rect x="4.5" y="9.5" width="4.5" height="2.5" rx="0.75" />
  </svg>
);

const FigmaAlignCenterHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="7.25" y="2" width="1.5" height="12" rx="0.5" />
    <rect x="3.5" y="4" width="9" height="2.5" rx="0.75" />
    <rect x="5" y="9.5" width="6" height="2.5" rx="0.75" />
  </svg>
);

const FigmaAlignRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="12.5" y="2" width="1.5" height="12" rx="0.5" />
    <rect x="4.5" y="4" width="7" height="2.5" rx="0.75" />
    <rect x="7" y="9.5" width="4.5" height="2.5" rx="0.75" />
  </svg>
);

const FigmaAlignTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="12" height="1.5" rx="0.5" />
    <rect x="4" y="4.5" width="2.5" height="7" rx="0.75" />
    <rect x="9.5" y="4.5" width="2.5" height="4.5" rx="0.75" />
  </svg>
);

const FigmaAlignCenterVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="7.25" width="12" height="1.5" rx="0.5" />
    <rect x="4" y="3.5" width="2.5" height="9" rx="0.75" />
    <rect x="9.5" y="5" width="2.5" height="6" rx="0.75" />
  </svg>
);

const FigmaAlignBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="12.5" width="12" height="1.5" rx="0.5" />
    <rect x="4" y="4.5" width="2.5" height="7" rx="0.75" />
    <rect x="9.5" y="7" width="2.5" height="4.5" rx="0.75" />
  </svg>
);

const FigmaAngleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3.5v9h9" />
    <path d="M8.5 12.5A5.5 5.5 0 0 0 3 7" strokeWidth="1.25" />
  </svg>
);

const FigmaRotateDiamondIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5.2" y="5.2" width="5.6" height="5.6" rx="0.8" transform="rotate(45 8 8)" />
    <path d="M4.5 4.8A4.2 4.2 0 0 1 11.5 4.8" />
    <path d="M10 3.2l2 1.6-2 1.6" />
  </svg>
);

const FigmaFlipHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="2" x2="8" y2="14" />
    <path d="M2.5 5L6.5 8L2.5 11Z" />
    <path d="M13.5 5L9.5 8L13.5 11Z" />
  </svg>
);

const FigmaFlipVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="8" x2="14" y2="8" />
    <path d="M5 2.5L8 6.5L11 2.5Z" />
    <path d="M5 13.5L8 9.5L11 13.5Z" />
  </svg>
);

const FigmaStyleLibraryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="5" r="1.5" />
    <circle cx="11" cy="5" r="1.5" />
    <circle cx="5" cy="11" r="1.5" />
    <circle cx="11" cy="11" r="1.5" />
  </svg>
);

const FigmaLineHeightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <line x1="2" y1="2" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <text x="8" y="11" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fontFamily="sans-serif">A</text>
  </svg>
);

const FigmaLetterSpacingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="14" y1="3" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <text x="8" y="11" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fontFamily="sans-serif">A</text>
  </svg>
);

const FigmaTextLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="2.5" y1="4" x2="13.5" y2="4" />
    <line x1="2.5" y1="8" x2="9.5" y2="8" />
    <line x1="2.5" y1="12" x2="11.5" y2="12" />
  </svg>
);

const FigmaTextCenterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="2.5" y1="4" x2="13.5" y2="4" />
    <line x1="4.5" y1="8" x2="11.5" y2="8" />
    <line x1="3.5" y1="12" x2="12.5" y2="12" />
  </svg>
);

const FigmaTextRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="2.5" y1="4" x2="13.5" y2="4" />
    <line x1="6.5" y1="8" x2="13.5" y2="8" />
    <line x1="4.5" y1="12" x2="13.5" y2="12" />
  </svg>
);

const FigmaVerticalTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2.5" x2="14" y2="2.5" />
    <line x1="8" y1="13.5" x2="8" y2="6" />
    <polyline points="5 8.5 8 5.5 11 8.5" />
  </svg>
);

const FigmaVerticalMiddleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="8" x2="14" y2="8" />
    <line x1="8" y1="2.5" x2="8" y2="5" />
    <polyline points="6 4 8 5.5 10 4" />
    <line x1="8" y1="13.5" x2="8" y2="11" />
    <polyline points="6 12 8 10.5 10 12" />
  </svg>
);

const FigmaVerticalBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="13.5" x2="14" y2="13.5" />
    <line x1="8" y1="2.5" x2="8" y2="10" />
    <polyline points="5 7.5 8 10.5 11 7.5" />
  </svg>
);

const FigmaTypeSettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="4.5" y1="2" x2="4.5" y2="14" />
    <circle cx="4.5" cy="10" r="1.8" fill="currentColor" />
    <line x1="11.5" y1="2" x2="11.5" y2="14" />
    <circle cx="11.5" cy="6" r="1.8" fill="currentColor" />
  </svg>
);

const FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'system-ui',
];

const FONT_WEIGHTS = [
  { label: 'Thin', value: 100 },
  { label: 'Extra Light', value: 200 },
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semi Bold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Extra Bold', value: 800 },
  { label: 'Black', value: 900 },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

const FigmaAutoLayoutHeaderIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <line x1="7" y1="2.5" x2="7" y2="13.5" />
    <polyline points="9 8 10.5 9.5 12.5 6.5" strokeWidth="1.4" />
  </svg>
);

const FigmaFlowWrapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="6.5" y="2.5" width="3.2" height="3.2" rx="0.8" />
    <rect x="3" y="9.5" width="3.2" height="3.2" rx="0.8" />
    <rect x="10" y="9.5" width="3.2" height="3.2" rx="0.8" />
  </svg>
);

const FigmaFlowVerticalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="2.5" width="4.5" height="11" rx="1.2" />
    <line x1="11.5" y1="3" x2="11.5" y2="13" />
    <polyline points="9.5 11 11.5 13 13.5 11" />
  </svg>
);

const FigmaFlowHorizontalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="3" width="11" height="4.5" rx="1.2" />
    <line x1="3" y1="11.5" x2="13" y2="11.5" />
    <polyline points="11 9.5 13 11.5 11 13.5" />
  </svg>
);

const FigmaFlowGridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="3" y="3" width="3.8" height="3.8" rx="0.8" />
    <rect x="9.2" y="3" width="3.8" height="3.8" rx="0.8" />
    <rect x="3" y="9.2" width="3.8" height="3.8" rx="0.8" />
    <rect x="9.2" y="9.2" width="3.8" height="3.8" rx="0.8" />
  </svg>
);

const FigmaGapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="2.5" y1="4" x2="13.5" y2="4" />
    <line x1="2.5" y1="12" x2="13.5" y2="12" />
    <line x1="8" y1="7" x2="8" y2="9" />
    <polyline points="6.5 8 8 6.5 9.5 8" />
    <polyline points="6.5 8 8 9.5 9.5 8" />
  </svg>
);

const FigmaPadHorizontalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <line x1="6" y1="5.5" x2="6" y2="10.5" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="5.5" x2="10" y2="10.5" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FigmaPadVerticalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <line x1="5.5" y1="6" x2="10.5" y2="6" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="5.5" y1="10" x2="10.5" y2="10" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FigmaIndependentPaddingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="6" height="6" rx="1" />
    <path d="M2.5 5.5V3a0.5 0.5 0 0 1 0.5-0.5h2.5" />
    <path d="M10.5 2.5H13a0.5 0.5 0 0 1 0.5 0.5v2.5" />
    <path d="M13.5 10.5V13a0.5 0.5 0 0 1-0.5 0.5h-2.5" />
    <path d="M5.5 13.5H3a0.5 0.5 0 0 1-0.5-0.5v-2.5" />
  </svg>
);

const FigmaResizingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="M6 7.5L8.5 5" />
    <polyline points="6 5 8.5 5 8.5 7.5" />
    <path d="M10 8.5L7.5 11" />
    <polyline points="10 11 7.5 11 7.5 8.5" />
  </svg>
);


const FigmaCornerRadiusIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M3 6.5V5A2 2 0 0 1 5 3H6.5" />
    <path d="M9.5 3H11A2 2 0 0 1 13 5V6.5" />
    <path d="M13 9.5V11A2 2 0 0 1 11 13H9.5" />
    <path d="M6.5 13H5A2 2 0 0 1 3 11V9.5" />
  </svg>
);

const FigmaOpacityIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <circle cx="5.2" cy="10.8" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="7.7" cy="10.8" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="10.8" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="5.2" cy="8.3" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="7.7" cy="8.3" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="5.2" cy="5.8" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

const FigmaColorStylesIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <circle cx="5" cy="5" r="2.2" />
    <circle cx="11" cy="5" r="2.2" />
    <circle cx="5" cy="11" r="2.2" />
    <circle cx="11" cy="11" r="2.2" />
  </svg>
);

const getFigmaSwatchBackground = (color: string, opacity: number) => {
  if (opacity >= 1) return color;
  const hexAlpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
  return `linear-gradient(to right, ${color} 50%, transparent 50%), linear-gradient(to right, transparent 50%, ${color}${hexAlpha} 50%), repeating-conic-gradient(#888888 0% 25%, #444444 0% 50%) 50% / 5px 5px`;
};




const FigmaCornerTopLeftIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M3.5 12.5V6A2.5 2.5 0 0 1 6 3.5H12.5" />
  </svg>
);

const FigmaCornerTopRightIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M3.5 3.5H10A2.5 2.5 0 0 1 12.5 6V12.5" />
  </svg>
);

const FigmaCornerBottomLeftIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M3.5 3.5V10A2.5 2.5 0 0 0 6 12.5H12.5" />
  </svg>
);

const FigmaCornerBottomRightIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.35"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M3.5 12.5H10A2.5 2.5 0 0 0 12.5 10V3.5" />
  </svg>
);


// ---------------------------------------------------------------------------
// SEGMENT BUTTON (for pill containers)
// ---------------------------------------------------------------------------
const SegmentButton: React.FC<{
  onClick?: () => void;
  title?: string;
  isEffectiveDark?: boolean;
  children: React.ReactNode;
  width?: number | string;
}> = ({ onClick, title, isEffectiveDark = true, children, width }) => {
  const [hovered, setHovered] = useState(false);
  const baseBg = isEffectiveDark ? '#2c2c2c' : '#f0f0f0';
  const hoverBg = isEffectiveDark ? '#383838' : '#e4e4e4';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: width ? 'none' : 1,
        width: width || 'auto',
        minWidth: width ? undefined : 24,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 0, // Sem border radius no botão! Fica na div pai
        background: hovered ? hoverBg : baseBg,
        color: hovered ? '#ffffff' : '#8e8e8e',
        cursor: 'pointer',
        padding: '0 4px',
        margin: 0,
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
      title={title}
    >
      {children}
    </button>
  );
};


interface PropertiesPanelProps {
  shape: Shape | null;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  onChange: (patch: Partial<Shape>) => void;
  onAlign?: (alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => void;
  onFocusSelection?: () => void;
  activeColorPicker?: ActiveColorPickerInfo | null;
  onActiveColorPickerChange?: (picker: ActiveColorPickerInfo | null) => void;
  isStrokeSettingsOpen?: boolean;
  onStrokeSettingsOpenChange?: (open: boolean) => void;
  activeEffectId?: string | null;
  onActiveEffectIdChange?: (id: string | null) => void;
  isTypeSettingsOpen?: boolean;
  onTypeSettingsOpenChange?: (open: boolean) => void;
}

export default function PropertiesPanel({
  shape,
  themeTokens,
  accentColor = '#007acc',
  isEffectiveDark = true,
  onChange,
  onAlign,
  onFocusSelection,
  activeColorPicker: propActiveColorPicker,
  onActiveColorPickerChange,
  isStrokeSettingsOpen: propStrokeSettingsOpen,
  onStrokeSettingsOpenChange,
  activeEffectId: propActiveEffectId,
  onActiveEffectIdChange,
  isTypeSettingsOpen: propTypeSettingsOpen,
  onTypeSettingsOpenChange,
}: PropertiesPanelProps) {
  // Popovers & Flyouts States
  const [internalColorPicker, setInternalColorPicker] = useState<ActiveColorPickerInfo | null>(null);
  const activeColorPicker = propActiveColorPicker !== undefined ? propActiveColorPicker : internalColorPicker;
  const setActiveColorPicker = onActiveColorPickerChange || setInternalColorPicker;
  const [isCornerSmoothingOpen, setIsCornerSmoothingOpen] = useState(false);
  const [internalStrokeSettingsOpen, setInternalStrokeSettingsOpen] = useState(false);
  const isStrokeSettingsOpen = propStrokeSettingsOpen !== undefined ? propStrokeSettingsOpen : internalStrokeSettingsOpen;
  const setIsStrokeSettingsOpen = onStrokeSettingsOpenChange || setInternalStrokeSettingsOpen;
  const [internalTypeSettingsOpen, setInternalTypeSettingsOpen] = useState(false);
  const isTypeSettingsOpen = propTypeSettingsOpen !== undefined ? propTypeSettingsOpen : internalTypeSettingsOpen;
  const setIsTypeSettingsOpen = onTypeSettingsOpenChange || setInternalTypeSettingsOpen;
  const [internalActiveEffectId, setInternalActiveEffectId] = useState<string | null>(null);
  const activeEffectId = propActiveEffectId !== undefined ? propActiveEffectId : internalActiveEffectId;
  const setActiveEffectId = onActiveEffectIdChange || setInternalActiveEffectId;
  const [isStrokeSidesMenuOpen, setIsStrokeSidesMenuOpen] = useState(false);
  const [isBlendModeOpen, setIsBlendModeOpen] = useState(false);
  const [isBooleanMenuOpen, setIsBooleanMenuOpen] = useState(false);
  const [isEffectsMenuOpen, setIsEffectsMenuOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [strokeSettingsTab, setStrokeSettingsTab] = useState<'basic' | 'dynamic' | 'brush'>('basic');

  const textPrimary = themeTokens?.textPrimary || '#ffffff';
  const textSecondary = themeTokens?.textSecondary || '#888888';
  const textMuted = themeTokens?.textMuted || '#555555';
  const bgCard = themeTokens?.bgCard || '#101010';
  const bgSecondary = themeTokens?.bgCardSecondary || (isEffectiveDark ? '#2c2c2c' : '#f0f0f0');
  const bgElevated = themeTokens?.bgCardElevated || '#1f1f1f';
  const hoverBg = themeTokens?.hoverBg || 'rgba(255, 255, 255, 0.05)';
  const divider = themeTokens?.borderSubtle && themeTokens.borderSubtle !== 'transparent'
    ? themeTokens.borderSubtle
    : isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const inputBorder = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  if (!shape) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: bgCard,
          color: textSecondary,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontFamily: "'Poppins', sans-serif",
          padding: 20,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span>Selecione um elemento para inspecionar</span>
      </div>
    );
  }

  // Quais seções fazem sentido pra cada tipo de shape (evita mostrar
  // campo de raio de canto numa linha, auto layout num texto, etc.)
  const hasFill = !['line', 'arrow', 'pen', 'pencil', 'comment', 'annotation', 'measurement', 'slice'].includes(shape.type);
  const hasStroke = !['comment', 'annotation', 'measurement', 'group', 'text', 'text-path'].includes(shape.type);
  const hasCornerRadius = ['rect', 'frame', 'section', 'image'].includes(shape.type);
  // Capacidade de Auto layout (frames e seções)
  const isAutoLayoutCapable = shape.type === 'frame' || shape.type === 'section';
  const isTextShape = shape.type === 'text' || shape.type === 'text-path';
  const isPolygon = shape.type === 'polygon';
  const isStar = shape.type === 'star';

  // Fills & Strokes normalizados
  const fills: FillItem[] = shape.fills && shape.fills.length > 0
    ? shape.fills
    : [{ id: 'fill-1', color: shape.fill || '#D9D9D9', opacity: shape.opacity ?? 1, visible: true, type: 'solid' }];

  const strokes: StrokeItem[] = shape.strokes && shape.strokes.length > 0
    ? shape.strokes
    : [{ id: 'stroke-1', color: shape.stroke && shape.stroke !== 'transparent' ? shape.stroke : '#000000', opacity: 1, visible: true }];

  const effects: EffectItem[] = shape.effects || [];
  const exportsList: ExportItem[] = shape.exports && shape.exports.length > 0
    ? shape.exports
    : [{ id: 'exp-1', scale: '1x', format: 'PNG' }];

  // Auto Layout defaults
  const hasAutoLayout = shape.hasAutoLayout ?? false;
  const flow = shape.layoutFlow ?? 'vertical';
  const layoutAlign = shape.layoutAlign ?? 'top-left';
  const gap = shape.layoutGap ?? 10;
  const padH = shape.paddingHorizontal ?? 10;
  const padV = shape.paddingVertical ?? 10;
  const independentPad = shape.independentPadding ?? false;
  const clipContent = shape.clipContent ?? false;

  // Helpers de atualização
  const updateFills = (newFills: FillItem[]) => {
    const activeFirst = newFills.find((f) => f.visible) || newFills[0];
    onChange({
      fills: newFills,
      fill: activeFirst ? activeFirst.color : 'transparent',
    });
  };

  const updateStrokes = (newStrokes: StrokeItem[]) => {
    const activeFirst = newStrokes.find((s) => s.visible) || newStrokes[0];
    onChange({
      strokes: newStrokes,
      stroke: activeFirst ? activeFirst.color : 'transparent',
    });
  };

  const handleRotate90 = () => {
    const nextRot = ((shape.rotation || 0) + 90) % 360;
    onChange({ rotation: nextRot });
  };

  const handleFlipH = () => {
    onChange({ flipX: !shape.flipX });
  };

  const handleFlipV = () => {
    onChange({ flipY: !shape.flipY });
  };

  // Cantos independentes
  const independent = shape.independentCorners ?? false;
  const radius = shape.cornerRadius ?? 0;
  const tl = shape.topLeftRadius ?? radius;
  const tr = shape.topRightRadius ?? radius;
  const bl = shape.bottomLeftRadius ?? radius;
  const br = shape.bottomRightRadius ?? radius;
  const smoothing = shape.cornerSmoothing ?? 0;

  // Swatch selecionado para o Color Picker
  const activeFillItem = activeColorPicker?.target === 'fill'
    ? (activeColorPicker.id === 'all' ? fills[0] : (fills.find((f) => f.id === activeColorPicker.id) || fills[0]))
    : null;
  const activeStrokeItem = activeColorPicker?.target === 'stroke'
    ? (activeColorPicker.id === 'all' ? strokes[0] : (strokes.find((s) => s.id === activeColorPicker.id) || strokes[0]))
    : null;

  const inputStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: bgSecondary,
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '2px 6px',
    height: 26,
    boxSizing: 'border-box',
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: textPrimary,
    fontSize: 11,
    fontFamily: "'Poppins', sans-serif",
    padding: 0,
  };

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderRadius: 5,
    color: textSecondary,
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.12s ease',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: bgCard,
        color: textPrimary,
        display: 'flex',
        flexDirection: 'column',
        fontSize: 11,
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* ----------------------------------------------------------------- */}
      {/* 1. HEADER: ELEMENT TYPE + ACTION ICONS (COMPONENT, MASK, BOOLEAN) */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px 8px 12px',
          borderBottom: `1px solid ${divider}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
          {shape.name || (shape.type === 'rect' ? 'Rectangle' : shape.type.toUpperCase())}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textSecondary }}>
          {/* Criar Componente */}
          <button
            type="button"
            style={btnStyle}
            title="Criar componente"
            onClick={() => onChange({ isComponent: !shape.isComponent })}
          >
            <Sparkles size={13} color={shape.isComponent ? accentColor : textSecondary} />
          </button>

          {/* Usar como máscara (ainda não implementado) */}
          <button type="button" disabled style={{ ...btnStyle, opacity: 0.35, cursor: 'not-allowed' }} title="Usar como máscara (em breve)">
            <span style={{ fontSize: 13, lineHeight: 1 }}>◑</span>
          </button>

          {/* Grupos Booleanos (exige seleção múltipla, ainda não suportada) */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', opacity: 0.35 }} title="Selecione 2 ou mais elementos (em breve)">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isBooleanMenuOpen ? `${accentColor}22` : 'transparent',
                borderRadius: 5,
                padding: 1,
              }}
            >
              <button
                type="button"
                disabled
                style={{ ...btnStyle, padding: '3px 4px', cursor: 'not-allowed' }}
                title="Operações booleanas (selecione 2+ elementos)"
              >
                <Maximize2 size={13} color={textSecondary} />
              </button>
              <button
                type="button"
                disabled
                style={{
                  ...btnStyle,
                  padding: '3px 2px',
                  color: textSecondary,
                  borderRadius: 4,
                  cursor: 'not-allowed',
                }}
              >
                <ChevronDown size={10} />
              </button>
            </div>

            {/* DROPDOWN DAS OPERAÇÕES BOOLEANAS */}
            {isBooleanMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 6,
                  background: bgElevated,
                  border: `1px solid ${divider}`,
                  borderRadius: 8,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                  padding: '6px 0',
                  minWidth: 170,
                  zIndex: 250,
                }}
              >
                {[
                  { id: 'union', label: 'Union', icon: '◫', shortcut: '⌥⇧U' },
                  { id: 'subtract', label: 'Subtract', icon: '◧', shortcut: '⌥⇧S' },
                  { id: 'intersect', label: 'Intersect', icon: '⧉', shortcut: '⌥⇧I' },
                  { id: 'exclude', label: 'Exclude', icon: '⧇', shortcut: '⌥⇧E' },
                  { id: 'flatten', label: 'Flatten', icon: '⤓', shortcut: '⌥⇧F' },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsBooleanMenuOpen(false);
                      if (item.id === 'union') {
                        onChange({ name: `${shape.name || 'Rectangle'} (Union)` });
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: textPrimary,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: textSecondary, width: 14 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 10, color: textMuted, fontFamily: 'monospace' }}>
                      {item.shortcut}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" disabled style={{ ...btnStyle, opacity: 0.35, cursor: 'not-allowed' }} title="Ajustar seleção (em breve)">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. SEÇÃO: POSITION & ALIGNMENT                                    */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${divider}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Header da Seção: Position e ícone Focus no canto direito */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary, letterSpacing: '-0.01em' }}>
            Position
          </span>
          <button
            type="button"
            style={{
              ...btnStyle,
              width: 24,
              height: 24,
              padding: 0,
              color: textSecondary,
            }}
            title="Focar na seleção"
            onClick={() => {
              if (onFocusSelection) {
                onFocusSelection();
              } else {
                onAlign?.('center-x');
              }
            }}
          >
            <FigmaFocusIcon />
          </button>
        </div>

        {/* 1. Alignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: textSecondary, letterSpacing: '0.01em' }}>
            Alignment
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center', paddingRight: 30 }}>
            {/* Pill 1: Alinhamento Horizontal (Left, Center H, Right) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isEffectiveDark ? '#1a1a1a' : '#dedede',
                border: `1px solid ${inputBorder}`,
                borderRadius: 5,
                height: 24,
                overflow: 'hidden',
                gap: 1,
                padding: 0,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('left')} title="Alinhar à esquerda">
                <FigmaAlignLeftIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('center-x')} title="Centralizar horizontalmente">
                <FigmaAlignCenterHIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('right')} title="Alinhar à direita">
                <FigmaAlignRightIcon />
              </SegmentButton>
            </div>

            {/* Pill 2: Alinhamento Vertical (Top, Center V, Bottom) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isEffectiveDark ? '#1a1a1a' : '#dedede',
                border: `1px solid ${inputBorder}`,
                borderRadius: 5,
                height: 24,
                overflow: 'hidden',
                gap: 1,
                padding: 0,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('top')} title="Alinhar ao topo">
                <FigmaAlignTopIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('center-y')} title="Centralizar verticalmente">
                <FigmaAlignCenterVIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={() => onAlign?.('bottom')} title="Alinhar à base">
                <FigmaAlignBottomIcon />
              </SegmentButton>
            </div>
          </div>
        </div>

        {/* 2. Position (X e Y) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: textSecondary, letterSpacing: '0.01em' }}>
            Position
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingRight: 30 }}>
            <ScrubbableNumberInput
              label="X"
              value={shape.x}
              onChange={(x) => onChange({ x })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
            />
            <ScrubbableNumberInput
              label="Y"
              value={shape.y}
              onChange={(y) => onChange({ y })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
            />
          </div>
        </div>

        {/* 3. Dimensions (W e H - Largura e Altura) */}
        {shape.type !== 'pen' && shape.type !== 'pencil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: textSecondary, letterSpacing: '0.01em' }}>
              Dimensions
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              {/* Container dos inputs W e H com animação de conector (grudados) estilo Figma */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ScrubbableNumberInput
                    label="W"
                    value={shape.width}
                    min={1}
                    onChange={(newW) => {
                      const safeW = Math.max(1, newW);
                      if (shape.constrainProportions && shape.width > 0) {
                        const ratio = shape.height / shape.width;
                        onChange({ width: safeW, height: Math.max(1, Math.round(safeW * ratio)) });
                      } else {
                        onChange({ width: safeW });
                      }
                    }}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    style={{
                      borderTopRightRadius: shape.constrainProportions ? 0 : 5,
                      borderBottomRightRadius: shape.constrainProportions ? 0 : 5,
                      transition: 'border-radius 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>

                {/* Conector Bridge (Figma dumbbell connector) */}
                <div
                  style={{
                    width: shape.constrainProportions ? 6 : 8,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: shape.constrainProportions ? 1 : 0,
                      transform: shape.constrainProportions ? 'scale(1)' : 'scale(0.3)',
                      transition: 'opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="6" height="24" viewBox="0 0 6 24" fill="none" style={{ display: 'block' }}>
                      <path
                        d="M 0 0 C 0 6, 6 6, 6 0 L 6 24 C 6 18, 0 18, 0 24 Z"
                        fill={bgSecondary}
                      />
                    </svg>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <ScrubbableNumberInput
                    label="H"
                    value={shape.height}
                    min={1}
                    onChange={(newH) => {
                      const safeH = Math.max(1, newH);
                      if (shape.constrainProportions && shape.height > 0) {
                        const ratio = shape.width / shape.height;
                        onChange({ height: safeH, width: Math.max(1, Math.round(safeH * ratio)) });
                      } else {
                        onChange({ height: safeH });
                      }
                    }}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    style={{
                      borderTopLeftRadius: shape.constrainProportions ? 0 : 5,
                      borderBottomLeftRadius: shape.constrainProportions ? 0 : 5,
                      transition: 'border-radius 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
              </div>

              {/* Botão de Link / Proporções à direita dos inputs (sem fundo) */}
              <button
                type="button"
                onClick={() => onChange({ constrainProportions: !shape.constrainProportions })}
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  color: shape.constrainProportions ? accentColor : textSecondary,
                  transition: 'color 0.18s ease',
                }}
                title={shape.constrainProportions ? 'Desbloquear proporções' : 'Travar proporções'}
              >
                {shape.constrainProportions ? <Link size={13} strokeWidth={1.8} /> : <Unlink size={13} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        )}

        {/* 4. Rotation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: textSecondary, letterSpacing: '0.01em' }}>
            Rotation
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center', paddingRight: 30 }}>
            <ScrubbableNumberInput
              label={<FigmaAngleIcon />}
              value={shape.rotation || 0}
              suffix="°"
              onChange={(newRot) => {
                let rot = Math.round(newRot);
                rot = ((rot % 360) + 360) % 360;
                if (rot > 180) rot -= 360;
                onChange({ rotation: rot });
              }}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
            />

            {/* Pill de Rotação 90° e Flip: preenchendo a largura da coluna à direita */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isEffectiveDark ? '#1a1a1a' : '#dedede',
                border: `1px solid ${inputBorder}`,
                borderRadius: 5,
                height: 24,
                overflow: 'hidden',
                gap: 1,
                padding: 0,
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={handleRotate90} title="Girar 90°">
                <FigmaRotateDiamondIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={handleFlipH} title="Espelhar horizontalmente">
                <FigmaFlipHIcon />
              </SegmentButton>
              <SegmentButton isEffectiveDark={isEffectiveDark} onClick={handleFlipV} title="Espelhar verticalmente">
                <FigmaFlipVIcon />
              </SegmentButton>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SEÇÃO: TIPOGRAFIA FIGMA (só para text / text-path)                */}
      {/* ----------------------------------------------------------------- */}
      {isTextShape && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Header Typography com Style Library Icon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Typography</span>
            <button
              type="button"
              title="Style library"
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
              }}
            >
              <FigmaStyleLibraryIcon />
            </button>
          </div>

          {/* Campo de edição do conteúdo de texto */}
          <textarea
            value={shape.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={2}
            placeholder="Texto..."
            style={{
              ...fieldStyle,
              width: '100%',
              resize: 'vertical',
              background: bgSecondary,
              border: `1px solid ${inputBorder}`,
              borderRadius: 6,
              padding: '5px 7px',
              boxSizing: 'border-box',
              fontSize: 11,
            }}
          />

          {/* Linha 1: Font Family Dropdown */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: bgSecondary,
              borderRadius: 6,
              height: 28,
              border: `1px solid ${inputBorder}`,
              boxSizing: 'border-box',
            }}
          >
            <select
              value={shape.fontFamily || 'Inter'}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              style={{
                width: '100%',
                height: '100%',
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                color: textPrimary,
                fontSize: 11,
                fontWeight: 500,
                padding: '0 24px 0 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ background: bgElevated, color: textPrimary }}>
                  {font}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              color={textSecondary}
              style={{ position: 'absolute', right: 8, pointerEvents: 'none' }}
            />
          </div>

          {/* Linha 2: Font Weight (Regular) + Font Size (12) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6 }}>
            {/* Weight dropdown */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: bgSecondary,
                borderRadius: 6,
                height: 28,
                border: `1px solid ${inputBorder}`,
                boxSizing: 'border-box',
              }}
            >
              <select
                value={
                  typeof shape.fontWeight === 'number'
                    ? shape.fontWeight
                    : shape.fontWeight === 'Bold'
                    ? 700
                    : 400
                }
                onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
                style={{
                  width: '100%',
                  height: '100%',
                  appearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  color: textPrimary,
                  fontSize: 11,
                  padding: '0 20px 0 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value} style={{ background: bgElevated, color: textPrimary }}>
                    {w.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                color={textSecondary}
                style={{ position: 'absolute', right: 6, pointerEvents: 'none' }}
              />
            </div>

            {/* Size input/dropdown */}
            <ScrubbableNumberInput
              value={shape.fontSize ?? 12}
              onChange={(fontSize) => onChange({ fontSize: Math.max(1, fontSize) })}
              min={1}
              max={200}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
              rightElement={
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) onChange({ fontSize: Number(e.target.value) });
                    }}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 16,
                      height: 20,
                      cursor: 'pointer',
                      right: 0,
                    }}
                  >
                    <option value="" disabled>Presets</option>
                    {FONT_SIZES.map((sz) => (
                      <option key={sz} value={sz} style={{ background: bgElevated, color: textPrimary }}>
                        {sz}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} color={textSecondary} style={{ pointerEvents: 'none' }} />
                </div>
              }
            />
          </div>

          {/* Linha 3: Line height + Letter spacing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {/* Line height */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>Line height</span>
              <ScrubbableNumberInput
                label={<FigmaLineHeightIcon />}
                value={shape.lineHeight !== undefined ? shape.lineHeight : 'Auto'}
                onChange={(lineHeight) => onChange({ lineHeight })}
                onStringChange={(lineHeight) => onChange({ lineHeight })}
                min={0}
                placeholder="Auto"
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
              />
            </div>

            {/* Letter spacing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>Letter spacing</span>
              <ScrubbableNumberInput
                label={<FigmaLetterSpacingIcon />}
                value={
                  typeof shape.letterSpacing === 'string'
                    ? shape.letterSpacing
                    : shape.letterSpacing !== undefined
                    ? `${shape.letterSpacing}%`
                    : '0%'
                }
                onChange={(val) => onChange({ letterSpacing: `${val}%` })}
                onStringChange={(letterSpacing) => onChange({ letterSpacing })}
                placeholder="0%"
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
              />
            </div>
          </div>

          {/* Linha 4: Alignment & Type Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: textSecondary }}>Alignment</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              {/* Grupo Horizontal (Left, Center, Right) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: bgSecondary,
                  borderRadius: 5,
                  padding: 2,
                  gap: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onChange({ textAlign: 'left' })}
                  title="Align text left"
                  style={{
                    background: (shape.textAlign || 'left') === 'left' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: (shape.textAlign || 'left') === 'left' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaTextLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ textAlign: 'center' })}
                  title="Align text center"
                  style={{
                    background: shape.textAlign === 'center' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: shape.textAlign === 'center' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaTextCenterIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ textAlign: 'right' })}
                  title="Align text right"
                  style={{
                    background: shape.textAlign === 'right' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: shape.textAlign === 'right' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaTextRightIcon />
                </button>
              </div>

              {/* Grupo Vertical (Top, Middle, Bottom) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: bgSecondary,
                  borderRadius: 5,
                  padding: 2,
                  gap: 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onChange({ textAlignVertical: 'top' })}
                  title="Align top"
                  style={{
                    background: (shape.textAlignVertical || 'top') === 'top' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: (shape.textAlignVertical || 'top') === 'top' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaVerticalTopIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ textAlignVertical: 'middle' })}
                  title="Align middle"
                  style={{
                    background: shape.textAlignVertical === 'middle' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: shape.textAlignVertical === 'middle' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaVerticalMiddleIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ textAlignVertical: 'bottom' })}
                  title="Align bottom"
                  style={{
                    background: shape.textAlignVertical === 'bottom' ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    color: shape.textAlignVertical === 'bottom' ? textPrimary : textSecondary,
                    height: 24,
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <FigmaVerticalBottomIcon />
                </button>
              </div>

              {/* Botão Type Settings (Sliders) com destaque ativo */}
              <button
                type="button"
                onClick={() => setIsTypeSettingsOpen(!isTypeSettingsOpen)}
                title="Type settings"
                style={{
                  background: isTypeSettingsOpen ? '#273a52' : bgSecondary,
                  border: isTypeSettingsOpen ? '1px solid #3b82f6' : '1px solid transparent',
                  color: isTypeSettingsOpen ? '#60a5fa' : textSecondary,
                  borderRadius: 6,
                  height: 28,
                  width: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <FigmaTypeSettingsIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SEÇÃO: POLÍGONO / ESTRELA                                        */}
      {/* ----------------------------------------------------------------- */}
      {(isPolygon || isStar) && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>{isPolygon ? 'Polygon' : 'Star'}</span>
          <div style={{ display: 'grid', gridTemplateColumns: isStar ? '1fr 1fr' : '1fr', gap: 6 }}>
            <ScrubbableNumberInput
              label={isPolygon ? 'Sides' : 'Points'}
              min={3}
              max={20}
              value={isPolygon ? (shape.polygonSides ?? 3) : (shape.starPoints ?? 5)}
              onChange={(v) => onChange(isPolygon ? { polygonSides: v } : { starPoints: v })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
            />
            {isStar && (
              <ScrubbableNumberInput
                label="Ratio"
                min={0}
                max={1}
                step={0.05}
                allowDecimals={true}
                value={shape.starInnerRatio ?? 0.5}
                onChange={(v) => onChange({ starInnerRatio: v })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
              />
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. SEÇÃO: AUTO LAYOUT (frames e seções)                           */}
      {/* ----------------------------------------------------------------- */}
      {isAutoLayoutCapable && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header Auto layout */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Auto layout</span>
            <button
              type="button"
              onClick={() => onChange({ hasAutoLayout: !hasAutoLayout })}
              style={{
                background: hasAutoLayout ? '#25364e' : 'transparent',
                border: hasAutoLayout ? '1px solid #3b82f6' : '1px solid transparent',
                color: hasAutoLayout ? '#60a5fa' : textSecondary,
                padding: '3px 6px',
                borderRadius: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title={hasAutoLayout ? 'Desativar Auto layout' : 'Ativar Auto layout'}
            >
              <FigmaAutoLayoutHeaderIcon />
            </button>
          </div>

          {hasAutoLayout && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Flow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: textSecondary }}>Flow</span>
                <div style={{ display: 'flex', background: bgSecondary, borderRadius: 6, padding: 2, gap: 2 }}>
                  {[
                    { id: 'freeform', icon: <FigmaFlowWrapIcon />, title: 'Wrap' },
                    { id: 'vertical', icon: <FigmaFlowVerticalIcon />, title: 'Vertical' },
                    { id: 'horizontal', icon: <FigmaFlowHorizontalIcon />, title: 'Horizontal' },
                    { id: 'grid', icon: <FigmaFlowGridIcon />, title: 'Grid' },
                  ].map((item) => {
                    const isActive = flow === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange({ layoutFlow: item.id as any })}
                        title={item.title}
                        style={{
                          flex: 1,
                          height: 28,
                          background: isActive ? (isEffectiveDark ? '#2e2e2e' : '#e0e0e0') : 'transparent',
                          color: isActive ? textPrimary : textSecondary,
                          border: isActive ? `1px solid ${divider}` : 'none',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {item.icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resizing (W & H) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: textSecondary }}>Resizing</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                  {/* W */}
                  <ScrubbableNumberInput
                    label="W"
                    value={Math.round(shape.width || 0)}
                    min={1}
                    onChange={(width) => onChange({ width: Math.max(1, width) })}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}`, flex: 1 }}
                    rightElement={
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                          value={shape.widthMode || 'fixed'}
                          onChange={(e) => onChange({ widthMode: e.target.value as any })}
                          style={{
                            position: 'absolute',
                            right: 0,
                            opacity: 0,
                            width: 16,
                            height: 20,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="fixed" style={{ background: bgElevated, color: textPrimary }}>Fixed width</option>
                          <option value="hug" style={{ background: bgElevated, color: textPrimary }}>Hug contents</option>
                          <option value="fill" style={{ background: bgElevated, color: textPrimary }}>Fill container</option>
                        </select>
                        <ChevronDown size={11} color={textSecondary} style={{ pointerEvents: 'none' }} />
                      </div>
                    }
                  />

                  {/* H */}
                  <ScrubbableNumberInput
                    label="H"
                    value={Math.round(shape.height || 0)}
                    min={1}
                    onChange={(height) => onChange({ height: Math.max(1, height) })}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}`, flex: 1 }}
                    rightElement={
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 10, color: textSecondary, pointerEvents: 'none' }}>
                          {shape.heightMode === 'hug' ? 'Hug' : shape.heightMode === 'fill' ? 'Fill' : ''}
                        </span>
                        <select
                          value={shape.heightMode || 'hug'}
                          onChange={(e) => onChange({ heightMode: e.target.value as any })}
                          style={{
                            position: 'absolute',
                            right: 0,
                            opacity: 0,
                            width: 32,
                            height: 20,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="hug" style={{ background: bgElevated, color: textPrimary }}>Hug contents</option>
                          <option value="fixed" style={{ background: bgElevated, color: textPrimary }}>Fixed height</option>
                          <option value="fill" style={{ background: bgElevated, color: textPrimary }}>Fill container</option>
                        </select>
                        <ChevronDown size={11} color={textSecondary} style={{ pointerEvents: 'none' }} />
                      </div>
                    }
                  />

                  {/* Botão Resizing Constraints */}
                  <button
                    type="button"
                    title="Resizing constraints"
                    style={{
                      background: bgSecondary,
                      border: `1px solid ${inputBorder}`,
                      borderRadius: 6,
                      height: 28,
                      width: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    <FigmaResizingIcon />
                  </button>
                </div>
              </div>

              {/* Alignment & Gap */}
              <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'flex-start' }}>
                {/* Alignment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: textSecondary }}>Alignment</span>
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      background: bgSecondary,
                      borderRadius: 8,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gridTemplateRows: 'repeat(3, 1fr)',
                      padding: 6,
                      boxSizing: 'border-box',
                    }}
                  >
                    {[
                      'top-left', 'top-center', 'top-right',
                      'left', 'center', 'right',
                      'bottom-left', 'bottom-center', 'bottom-right',
                    ].map((pos) => {
                      const isCurrent = layoutAlign === pos;
                      return (
                        <div
                          key={pos}
                          onClick={() => onChange({ layoutAlign: pos as any })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            width: '100%',
                            height: '100%',
                            borderRadius: 4,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrent) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {isCurrent ? (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2.5,
                              }}
                            >
                              <div
                                style={{
                                  width: 11,
                                  height: 2,
                                  background: '#38bdf8',
                                  borderRadius: 1,
                                }}
                              />
                              <div
                                style={{
                                  width: 6.5,
                                  height: 2,
                                  background: '#38bdf8',
                                  borderRadius: 1,
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 3.5,
                                height: 3.5,
                                borderRadius: '50%',
                                background: '#555555',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Gap */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: textSecondary }}>Gap</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ScrubbableNumberInput
                      label={<FigmaGapIcon />}
                      value={gap}
                      min={0}
                      onChange={(layoutGap) => onChange({ layoutGap })}
                      themeTokens={themeTokens}
                      accentColor={accentColor}
                      isEffectiveDark={isEffectiveDark}
                      style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}`, flex: 1 }}
                      rightElement={
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) onChange({ layoutGap: Number(e.target.value) });
                            }}
                            style={{
                              position: 'absolute',
                              right: 0,
                              opacity: 0,
                              width: 14,
                              height: 20,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="" disabled>Presets</option>
                            {[0, 4, 8, 10, 12, 16, 20, 24, 32, 48].map((g) => (
                              <option key={g} value={g} style={{ background: bgElevated, color: textPrimary }}>
                                {g}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={10} color={textSecondary} style={{ pointerEvents: 'none' }} />
                        </div>
                      }
                    />

                    <button
                      type="button"
                      style={{
                        background: bgSecondary,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 6,
                        height: 28,
                        width: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: textSecondary,
                        cursor: 'pointer',
                      }}
                      title="Advanced layout settings"
                    >
                      <FigmaTypeSettingsIcon />
                    </button>
                  </div>
                </div>
              </div>

              {/* Padding */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: textSecondary }}>Padding</span>
                {!independentPad ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, alignItems: 'center' }}>
                    {/* Horizontal pad */}
                    <ScrubbableNumberInput
                      label={<FigmaPadHorizontalIcon />}
                      value={padH}
                      min={0}
                      onChange={(paddingHorizontal) => onChange({ paddingHorizontal })}
                      themeTokens={themeTokens}
                      accentColor={accentColor}
                      isEffectiveDark={isEffectiveDark}
                      style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                    />

                    {/* Vertical pad */}
                    <ScrubbableNumberInput
                      label={<FigmaPadVerticalIcon />}
                      value={padV}
                      min={0}
                      onChange={(paddingVertical) => onChange({ paddingVertical })}
                      themeTokens={themeTokens}
                      accentColor={accentColor}
                      isEffectiveDark={isEffectiveDark}
                      style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                    />

                    {/* Independent padding toggle */}
                    <button
                      type="button"
                      onClick={() => onChange({ independentPadding: true })}
                      style={{
                        background: bgSecondary,
                        border: `1px solid ${inputBorder}`,
                        borderRadius: 6,
                        height: 28,
                        width: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: textSecondary,
                        cursor: 'pointer',
                      }}
                      title="Paddings independentes"
                    >
                      <FigmaIndependentPaddingIcon />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <ScrubbableNumberInput
                        label="Top"
                        value={shape.paddingTop ?? padV}
                        min={0}
                        onChange={(paddingTop) => onChange({ paddingTop })}
                        themeTokens={themeTokens}
                        accentColor={accentColor}
                        isEffectiveDark={isEffectiveDark}
                        style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                      />
                      <ScrubbableNumberInput
                        label="Right"
                        value={shape.paddingRight ?? padH}
                        min={0}
                        onChange={(paddingRight) => onChange({ paddingRight })}
                        themeTokens={themeTokens}
                        accentColor={accentColor}
                        isEffectiveDark={isEffectiveDark}
                        style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 4, alignItems: 'center' }}>
                      <ScrubbableNumberInput
                        label="Bottom"
                        value={shape.paddingBottom ?? padV}
                        min={0}
                        onChange={(paddingBottom) => onChange({ paddingBottom })}
                        themeTokens={themeTokens}
                        accentColor={accentColor}
                        isEffectiveDark={isEffectiveDark}
                        style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                      />
                      <ScrubbableNumberInput
                        label="Left"
                        value={shape.paddingLeft ?? padH}
                        min={0}
                        onChange={(paddingLeft) => onChange({ paddingLeft })}
                        themeTokens={themeTokens}
                        accentColor={accentColor}
                        isEffectiveDark={isEffectiveDark}
                        style={{ height: 28, borderRadius: 6, border: `1px solid ${inputBorder}` }}
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ independentPadding: false })}
                        style={{
                          background: '#273a52',
                          border: '1px solid #3b82f6',
                          borderRadius: 6,
                          height: 28,
                          width: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#60a5fa',
                          cursor: 'pointer',
                        }}
                        title="Paddings uniformes"
                      >
                        <FigmaIndependentPaddingIcon />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Checkbox: Clip content estilizado Figma */}
              <div
                onClick={() => onChange({ clipContent: !clipContent })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 3,
                    border: clipContent ? `1px solid ${accentColor}` : '1.5px solid #4a4a4a',
                    background: clipContent ? accentColor : (isEffectiveDark ? '#262626' : '#ffffff'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {clipContent && <Check size={11} strokeWidth={3} color="#ffffff" />}
                </div>
                <span style={{ fontSize: 11, color: textPrimary }}>Clip content</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. SEÇÃO: APPEARANCE (OPACITY + CORNER RADIUS + CORNER SMOOTHING) */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Appearance</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => onChange({ visible: shape.visible === false ? true : false })}
              style={btnStyle}
              title={shape.visible === false ? 'Mostrar' : 'Ocultar'}
            >
              {shape.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsBlendModeOpen((prev) => !prev)}
                style={{
                  ...btnStyle,
                  color: shape.blendMode && shape.blendMode !== 'normal' ? accentColor : textSecondary,
                }}
                title="Modo de mesclagem"
              >
                <Droplet size={13} />
              </button>

              {isBlendModeOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: bgElevated,
                    border: `1px solid ${divider}`,
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    padding: '4px 0',
                    minWidth: 130,
                    zIndex: 100,
                  }}
                >
                  {['Pass through', 'Normal', 'Darken', 'Multiply', 'Lighten', 'Screen', 'Overlay'].map((mode) => (
                    <div
                      key={mode}
                      onClick={() => {
                        onChange({ blendMode: mode.toLowerCase() });
                        setIsBlendModeOpen(false);
                      }}
                      style={{
                        padding: '5px 12px',
                        fontSize: 11,
                        cursor: 'pointer',
                        color: (shape.blendMode || 'normal') === mode.toLowerCase() ? accentColor : textPrimary,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {mode}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: hasCornerRadius ? '1fr 1fr 26px' : '1fr', gap: 6 }}>
          <span style={{ fontSize: 11, color: textSecondary }}>Opacity</span>
          {hasCornerRadius && <span style={{ fontSize: 11, color: textSecondary }}>Corner radius</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: hasCornerRadius ? '1fr 1fr 26px' : '1fr', gap: 6, alignItems: 'center' }}>
          <ScrubbableNumberInput
            label={<FigmaOpacityIcon />}
            value={Math.round((shape.opacity ?? 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(val) => onChange({ opacity: Math.max(0, Math.min(100, val)) / 100 })}
            themeTokens={themeTokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            style={{ height: 26 }}
          />

          {hasCornerRadius && (
            <>
              <ScrubbableNumberInput
                label={<FigmaCornerRadiusIcon />}
                value={Math.round(radius)}
                min={0}
                onChange={(newRadius) => {
                  const r = Math.max(0, newRadius);
                  onChange({
                    cornerRadius: r,
                    topLeftRadius: r,
                    topRightRadius: r,
                    bottomLeftRadius: r,
                    bottomRightRadius: r,
                  });
                }}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26 }}
              />

              <button
                type="button"
                onClick={() => onChange({ independentCorners: !independent })}
                onMouseEnter={(e) => {
                  if (!independent) e.currentTarget.style.background = isEffectiveDark ? '#383838' : '#e4e4e4';
                }}
                onMouseLeave={(e) => {
                  if (!independent) e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  ...btnStyle,
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  background: independent ? (isEffectiveDark ? '#2c384a' : '#d0e4ff') : 'transparent',
                  color: independent ? (isEffectiveDark ? '#63a9ff' : '#0066cc') : textSecondary,
                  border: 'none',
                  padding: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                }}
                title={independent ? 'Cantos uniformes' : 'Cantos independentes'}
              >
                <FigmaCornerRadiusIcon />
              </button>
            </>
          )}
        </div>

        {hasCornerRadius && independent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 26px', gap: 6, alignItems: 'center' }}>
              <ScrubbableNumberInput
                label={<FigmaCornerTopLeftIcon />}
                value={Math.round(tl)}
                min={0}
                onChange={(v) => onChange({ topLeftRadius: Math.max(0, v) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26 }}
              />
              <ScrubbableNumberInput
                label={<FigmaCornerTopRightIcon />}
                value={Math.round(tr)}
                min={0}
                onChange={(v) => onChange({ topRightRadius: Math.max(0, v) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26 }}
              />
              <div style={{ width: 26, height: 26 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 26px', gap: 6, alignItems: 'center' }}>
              <ScrubbableNumberInput
                label={<FigmaCornerBottomLeftIcon />}
                value={Math.round(bl)}
                min={0}
                onChange={(v) => onChange({ bottomLeftRadius: Math.max(0, v) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26 }}
              />
              <ScrubbableNumberInput
                label={<FigmaCornerBottomRightIcon />}
                value={Math.round(br)}
                min={0}
                onChange={(v) => onChange({ bottomRightRadius: Math.max(0, v) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26 }}
              />

              <button
                type="button"
                onClick={() => setIsCornerSmoothingOpen((prev) => !prev)}
                onMouseEnter={(e) => {
                  if (!isCornerSmoothingOpen) e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  if (!isCornerSmoothingOpen) e.currentTarget.style.color = textSecondary;
                }}
                style={{
                  ...btnStyle,
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  background: isCornerSmoothingOpen ? (isEffectiveDark ? '#2c384a' : '#d0e4ff') : 'transparent',
                  color: isCornerSmoothingOpen ? (isEffectiveDark ? '#63a9ff' : '#0066cc') : textSecondary,
                  border: 'none',
                  padding: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                }}
                title="Corner smoothing (iOS)"
              >
                <SlidersHorizontal size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. SEÇÃO: FILL                                                    */}
      {/* ----------------------------------------------------------------- */}
      {hasFill && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Fill</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => {
                  if (fills.length === 0) {
                    const newFill: FillItem = {
                      id: `fill-${Date.now()}`,
                      color: '#000000',
                      opacity: 0.2,
                      visible: true,
                      type: 'solid',
                    };
                    updateFills([newFill]);
                  }
                  setActiveColorPicker(
                    activeColorPicker?.target === 'fill' && activeColorPicker?.id === 'all'
                      ? null
                      : { target: 'fill', id: 'all' }
                  );
                }}
                style={{
                  ...btnStyle,
                  width: 24,
                  height: 24,
                  padding: 0,
                  color: activeColorPicker?.target === 'fill' && activeColorPicker?.id === 'all' ? accentColor : textSecondary,
                  background: activeColorPicker?.target === 'fill' && activeColorPicker?.id === 'all' ? `${accentColor}26` : 'transparent',
                }}
                title="Alterar todas as camadas de cor (Fill)"
              >
                <FigmaColorStylesIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  const newFill: FillItem = {
                    id: `fill-${Date.now()}`,
                    color: '#000000',
                    opacity: 0.2,
                    visible: true,
                    type: 'solid',
                  };
                  updateFills([newFill, ...fills]);
                }}
                style={btnStyle}
                title="Adicionar preenchimento (+)"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fills.map((fillItem) => {
              const hexClean = fillItem.color.replace('#', '').toUpperCase();
              const isSwatchActive = activeColorPicker?.target === 'fill' && (activeColorPicker.id === fillItem.id || activeColorPicker.id === 'all');
              return (
                <div key={fillItem.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: bgSecondary,
                      border: isSwatchActive ? `1px solid ${accentColor}` : '1px solid transparent',
                      borderRadius: 5,
                      height: 26,
                      flex: 1,
                      minWidth: 0,
                      padding: '0 6px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.12s ease',
                    }}
                  >
                    <div
                      onClick={() =>
                        setActiveColorPicker(
                          activeColorPicker?.id === fillItem.id ? null : { target: 'fill', id: fillItem.id }
                        )
                      }
                      style={{
                        position: 'relative',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: getFigmaSwatchBackground(fillItem.color, fillItem.opacity),
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Abrir seletor de cor"
                    />

                    <input
                      type="text"
                      value={hexClean}
                      onClick={() => {
                        if (activeColorPicker?.id !== fillItem.id) {
                          setActiveColorPicker({ target: 'fill', id: fillItem.id });
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value.trim().toUpperCase();
                        updateFills(
                          fills.map((f) => (f.id === fillItem.id ? { ...f, color: `#${val}` } : f))
                        );
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: textPrimary,
                        fontSize: 11,
                        fontFamily: "'Poppins', sans-serif",
                        textTransform: 'uppercase',
                        padding: '0 8px',
                        letterSpacing: '0.5px',
                      }}
                    />

                    <div
                      style={{
                        width: 1,
                        height: 14,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        flexShrink: 0,
                      }}
                    />

                    <ScrubbableNumberInput
                      value={Math.round(fillItem.opacity * 100)}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(val) => {
                        const op = Math.max(0, Math.min(100, val)) / 100;
                        updateFills(
                          fills.map((f) => (f.id === fillItem.id ? { ...f, opacity: op } : f))
                        );
                      }}
                      themeTokens={themeTokens}
                      accentColor={accentColor}
                      isEffectiveDark={isEffectiveDark}
                      style={{
                        width: 50,
                        height: 22,
                        background: 'transparent',
                        padding: '0 4px',
                        border: 'none',
                        flexShrink: 0,
                      }}
                      inputStyle={{ textAlign: 'right' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateFills(
                        fills.map((f) => (f.id === fillItem.id ? { ...f, visible: !f.visible } : f))
                      )
                    }
                    style={{
                      ...btnStyle,
                      width: 24,
                      height: 26,
                      padding: 0,
                      color: fillItem.visible ? textSecondary : textMuted,
                    }}
                    title={fillItem.visible ? 'Ocultar' : 'Mostrar'}
                  >
                    {fillItem.visible ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateFills(fills.filter((f) => f.id !== fillItem.id))}
                    style={{
                      ...btnStyle,
                      width: 24,
                      height: 26,
                      padding: 0,
                      color: textSecondary,
                    }}
                    title="Remover preenchimento"
                  >
                    <Minus size={13} strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. SEÇÃO: STROKE                                                  */}
      {/* ----------------------------------------------------------------- */}
      {hasStroke && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Stroke</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => {
                  if (strokes.length === 0) {
                    const newStroke: StrokeItem = {
                      id: `stroke-${Date.now()}`,
                      color: '#000000',
                      opacity: 1,
                      visible: true,
                    };
                    updateStrokes([newStroke]);
                  }
                  setActiveColorPicker(
                    activeColorPicker?.target === 'stroke' && activeColorPicker?.id === 'all'
                      ? null
                      : { target: 'stroke', id: 'all' }
                  );
                }}
                style={{
                  ...btnStyle,
                  width: 24,
                  height: 24,
                  padding: 0,
                  color: activeColorPicker?.target === 'stroke' && activeColorPicker?.id === 'all' ? accentColor : textSecondary,
                  background: activeColorPicker?.target === 'stroke' && activeColorPicker?.id === 'all' ? `${accentColor}26` : 'transparent',
                }}
                title="Alterar todas as camadas de contorno (Stroke)"
              >
                <FigmaColorStylesIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  const newStroke: StrokeItem = {
                    id: `stroke-${Date.now()}`,
                    color: '#000000',
                    opacity: 1,
                    visible: true,
                  };
                  updateStrokes([...strokes, newStroke]);
                }}
                style={btnStyle}
                title="Adicionar contorno (+)"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {strokes.map((strokeItem) => {
            const hexClean = strokeItem.color.replace('#', '').toUpperCase();
            const isSwatchActive = activeColorPicker?.target === 'stroke' && (activeColorPicker.id === strokeItem.id || activeColorPicker.id === 'all');
            return (
              <div key={strokeItem.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: bgSecondary,
                    border: isSwatchActive ? `1px solid ${accentColor}` : '1px solid transparent',
                    borderRadius: 5,
                    height: 26,
                    flex: 1,
                    minWidth: 0,
                    padding: '0 6px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.12s ease',
                  }}
                >
                  <div
                    onClick={() =>
                      setActiveColorPicker(
                        activeColorPicker?.id === strokeItem.id ? null : { target: 'stroke', id: strokeItem.id }
                      )
                    }
                    style={{
                      position: 'relative',
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: getFigmaSwatchBackground(strokeItem.color, strokeItem.opacity),
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title="Abrir seletor de cor"
                  />

                  <input
                    type="text"
                    value={hexClean}
                    onClick={() => {
                      if (activeColorPicker?.id !== strokeItem.id) {
                        setActiveColorPicker({ target: 'stroke', id: strokeItem.id });
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.trim().toUpperCase();
                      updateStrokes(
                        strokes.map((s) => (s.id === strokeItem.id ? { ...s, color: `#${val}` } : s))
                      );
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: textPrimary,
                      fontSize: 11,
                      fontFamily: "'Poppins', sans-serif",
                      textTransform: 'uppercase',
                      padding: '0 8px',
                      letterSpacing: '0.5px',
                    }}
                  />

                  <div
                    style={{
                      width: 1,
                      height: 14,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      flexShrink: 0,
                    }}
                  />

                  <ScrubbableNumberInput
                    value={Math.round(strokeItem.opacity * 100)}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(val) => {
                      const op = Math.max(0, Math.min(100, val)) / 100;
                      updateStrokes(
                        strokes.map((s) => (s.id === strokeItem.id ? { ...s, opacity: op } : s))
                      );
                    }}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    style={{
                      width: 50,
                      height: 22,
                      background: 'transparent',
                      padding: '0 4px',
                      border: 'none',
                      flexShrink: 0,
                    }}
                    inputStyle={{ textAlign: 'right' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateStrokes(
                      strokes.map((s) => (s.id === strokeItem.id ? { ...s, visible: !s.visible } : s))
                    )
                  }
                  style={{
                    ...btnStyle,
                    width: 24,
                    height: 26,
                    padding: 0,
                    color: strokeItem.visible ? textSecondary : textMuted,
                  }}
                  title={strokeItem.visible ? 'Ocultar' : 'Mostrar'}
                >
                  {strokeItem.visible ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />}
                </button>

                <button
                  type="button"
                  onClick={() => updateStrokes(strokes.filter((s) => s.id !== strokeItem.id))}
                  style={{
                    ...btnStyle,
                    width: 24,
                    height: 26,
                    padding: 0,
                    color: textSecondary,
                  }}
                  title="Remover contorno"
                >
                  <Minus size={13} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Position</span>
            <span style={{ fontSize: 11, color: textSecondary }}>Weight</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                position: 'relative',
                flex: '1.2 1 0',
                background: bgSecondary,
                border: `1px solid ${inputBorder}`,
                borderRadius: 6,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                padding: '0 6px',
              }}
            >
              <select
                value={shape.strokePosition || 'inside'}
                onChange={(e) => onChange({ strokePosition: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: textPrimary,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <option value="inside" style={{ background: bgCard }}>Inside</option>
                <option value="center" style={{ background: bgCard }}>Center</option>
                <option value="outside" style={{ background: bgCard }}>Outside</option>
              </select>
            </div>

            <ScrubbableNumberInput
              label="≡"
              value={shape.strokeWidth ?? 1}
              min={0}
              onChange={(strokeWidth) => onChange({ strokeWidth: Math.max(0, strokeWidth) })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 26, borderRadius: 6, border: `1px solid ${inputBorder}`, flex: '1 1 0' }}
            />

            <button
              type="button"
              onClick={() => setIsStrokeSettingsOpen((prev) => !prev)}
              style={{
                ...btnStyle,
                width: 26,
                height: 26,
                borderRadius: 5,
                background: isStrokeSettingsOpen ? `${accentColor}22` : 'transparent',
                color: isStrokeSettingsOpen ? accentColor : textSecondary,
                border: isStrokeSettingsOpen ? `1px solid ${accentColor}` : 'none',
              }}
              title="Configurações avançadas de contorno"
            >
              <SlidersHorizontal size={13} />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsStrokeSidesMenuOpen((prev) => !prev)}
                style={{
                  ...btnStyle,
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  background: isStrokeSidesMenuOpen || shape.strokeSides ? `${accentColor}22` : 'transparent',
                  color: isStrokeSidesMenuOpen || shape.strokeSides ? accentColor : textSecondary,
                  border: isStrokeSidesMenuOpen ? `1px solid ${accentColor}` : 'none',
                }}
                title="Lados do contorno"
              >
                <span style={{ fontSize: 14 }}>回</span>
              </button>

              {isStrokeSidesMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 4,
                    background: bgElevated,
                    border: `1px solid ${divider}`,
                    borderRadius: 8,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    padding: '6px 0',
                    minWidth: 140,
                    zIndex: 150,
                  }}
                >
                  {[
                    { id: 'all', label: 'All', icon: '🔲' },
                    { id: 'top', label: 'Top', icon: '▔' },
                    { id: 'bottom', label: 'Bottom', icon: ' ' },
                    { id: 'left', label: 'Left', icon: '▏' },
                    { id: 'right', label: 'Right', icon: '▕' },
                  ].map((side) => {
                    const isActive = (shape.strokeSides || 'all') === side.id;
                    return (
                      <div
                        key={side.id}
                        onClick={() => {
                          onChange({ strokeSides: side.id as any });
                          setIsStrokeSidesMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: 11,
                          color: textPrimary,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 14, color: textSecondary }}>{side.icon}</span>
                          <span>{side.label}</span>
                        </div>
                        {isActive && <Check size={12} color={accentColor} />}
                      </div>
                    );
                  })}

                  <div style={{ height: 1, background: divider, margin: '4px 0' }} />

                  <div
                    onClick={() => {
                      onChange({ strokeSides: 'custom' });
                      setIsStrokeSidesMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: textPrimary,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <SlidersHorizontal size={12} color={textSecondary} />
                    <span>Custom</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 7. SEÇÃO: EFFECTS                                                 */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Effects</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              style={{
                ...btnStyle,
                color: textSecondary,
              }}
              title="Estilos de efeito"
            >
              <FigmaColorStylesIcon />
            </button>
            <button
              type="button"
              onClick={() => setIsEffectsMenuOpen((prev) => !prev)}
              style={{
                ...btnStyle,
                color: isEffectsMenuOpen ? accentColor : textSecondary,
                background: isEffectsMenuOpen ? `${accentColor}26` : 'transparent',
              }}
              title="Adicionar efeito (+)"
            >
              <Plus size={12} />
            </button>
          </div>

          {isEffectsMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                background: bgElevated,
                border: `1px solid ${divider}`,
                borderRadius: 8,
                boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                padding: '6px 0',
                minWidth: 170,
                zIndex: 220,
              }}
            >
              {[
                { type: 'drop-shadow' as const, label: 'Drop shadow' },
                { type: 'inner-shadow' as const, label: 'Inner shadow' },
                { type: 'layer-blur' as const, label: 'Layer blur' },
                { type: 'background-blur' as const, label: 'Background blur' },
                { type: 'noise' as const, label: 'Noise' },
              ].map((item) => (
                <div
                  key={item.type}
                  onClick={() => {
                    const newEff: EffectItem = {
                      id: `effect-${Date.now()}`,
                      type: item.type,
                      color: '#000000',
                      opacity: item.type === 'noise' ? 0.25 : item.type.includes('blur') ? 1 : 0.25,
                      x: 0,
                      y: 4,
                      blur: 4,
                      spread: 0,
                      visible: true,
                      blurMode: 'uniform',
                      noiseMode: 'mono',
                      noiseSizeX: 4,
                      noiseSizeY: 4,
                      density: 100,
                    };
                    onChange({ effects: [...effects, newEff] });
                    setActiveEffectId(newEff.id);
                    setIsEffectsMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: textPrimary,
                    fontFamily: "'Poppins', sans-serif",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: textSecondary, display: 'flex', alignItems: 'center', width: 14 }}>
                    {getEffectIcon(item.type, 13)}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {effects.map((eff) => (
          <div
            key={eff.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
            }}
          >
            {/* Pill Container do Efeito (Screenshot 1) */}
            <div
              onClick={() => setActiveEffectId(activeEffectId === eff.id ? null : eff.id)}
              style={{
                flex: 1,
                height: 26,
                border: `1px solid ${
                  activeEffectId === eff.id
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.12)'
                }`,
                borderRadius: 5,
                background:
                  activeEffectId === eff.id
                    ? isEffectiveDark
                      ? '#2c2c2c'
                      : '#eaeaea'
                    : 'transparent',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                gap: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (activeEffectId !== eff.id) {
                  e.currentTarget.style.borderColor = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.25)'
                    : 'rgba(0, 0, 0, 0.25)';
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(0, 0, 0, 0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeEffectId !== eff.id) {
                  e.currentTarget.style.borderColor = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.12)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title="Configurações do efeito"
            >
              <span
                style={{
                  color: activeEffectId === eff.id ? accentColor : textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {getEffectIcon(eff.type, 13)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: textPrimary,
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 400,
                  userSelect: 'none',
                }}
              >
                {getEffectLabel(eff.type)}
              </span>
            </div>

            {/* Botão de Visibilidade (Eye/EyeOff) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({
                  effects: effects.map((e) => (e.id === eff.id ? { ...e, visible: !e.visible } : e)),
                });
              }}
              style={{
                ...btnStyle,
                width: 24,
                height: 26,
                color: eff.visible ? textSecondary : `${textSecondary}66`,
              }}
              title={eff.visible ? 'Ocultar efeito' : 'Exibir efeito'}
            >
              {eff.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>

            {/* Botão de Remoção (Minus) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (activeEffectId === eff.id) setActiveEffectId(null);
                onChange({ effects: effects.filter((e) => e.id !== eff.id) });
              }}
              style={{
                ...btnStyle,
                width: 24,
                height: 26,
                color: textSecondary,
              }}
              title="Remover efeito"
            >
              <Minus size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 8. SEÇÃO: EXPORT                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Export</span>
          <button
            type="button"
            onClick={() => {
              const newExp: ExportItem = {
                id: `export-${Date.now()}`,
                format: 'PNG',
                scale: '1x',
              };
              onChange({ exports: [...exportsList, newExp] });
            }}
            style={btnStyle}
            title="Adicionar formato de exportação (+)"
          >
            <Plus size={12} />
          </button>
        </div>

        {exportsList.map((exp) => (
          <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ ...inputStyle, width: 54, padding: '2px 6px' }}>
              <select
                value={exp.scale}
                onChange={(e) =>
                  onChange({
                    exports: exportsList.map((x) => (x.id === exp.id ? { ...x, scale: e.target.value as any } : x)),
                  })
                }
                style={{ width: '100%', background: 'transparent', border: 'none', color: textPrimary, fontSize: 11, cursor: 'pointer' }}
              >
                <option value="0.5x" style={{ background: bgCard }}>0.5x</option>
                <option value="1x" style={{ background: bgCard }}>1x</option>
                <option value="1.5x" style={{ background: bgCard }}>1.5x</option>
                <option value="2x" style={{ background: bgCard }}>2x</option>
                <option value="3x" style={{ background: bgCard }}>3x</option>
                <option value="4x" style={{ background: bgCard }}>4x</option>
              </select>
            </div>

            <div style={{ ...inputStyle, flex: 1, padding: '2px 6px' }}>
              <select
                value={exp.format}
                onChange={(e) =>
                  onChange({
                    exports: exportsList.map((x) => (x.id === exp.id ? { ...x, format: e.target.value as any } : x)),
                  })
                }
                style={{ width: '100%', background: 'transparent', border: 'none', color: textPrimary, fontSize: 11, cursor: 'pointer' }}
              >
                <option value="PNG" style={{ background: bgCard }}>PNG</option>
                <option value="JPG" style={{ background: bgCard }}>JPG</option>
                <option value="SVG" style={{ background: bgCard }}>SVG</option>
                <option value="PDF" style={{ background: bgCard }}>PDF</option>
              </select>
            </div>

            <button type="button" style={btnStyle} title="Mais opções">
              <MoreHorizontal size={13} />
            </button>

            <button
              type="button"
              onClick={() => onChange({ exports: exportsList.filter((x) => x.id !== exp.id) })}
              style={btnStyle}
            >
              <Minus size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            const exp = exportsList[0] || { scale: '1x', format: 'PNG' };
            const shapeName = shape.name || 'Rectangle 148';
            alert(`Exportando ${shapeName} (${exp.scale}, ${exp.format})...`);
          }}
          style={{
            background: bgSecondary,
            border: `1px solid ${inputBorder}`,
            borderRadius: 6,
            color: textPrimary,
            padding: '7px 12px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = bgSecondary)}
        >
          <span>Export {shape.name || 'Rectangle 148'}</span>
        </button>

        <div style={{ marginTop: 2 }}>
          <div
            onClick={() => setIsPreviewOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              color: textSecondary,
              fontSize: 11,
              padding: '2px 0',
            }}
          >
            {isPreviewOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>Preview</span>
          </div>

          {isPreviewOpen && (
            <div
              style={{
                marginTop: 6,
                padding: 10,
                background: bgSecondary,
                borderRadius: 6,
                border: `1px solid ${inputBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 55,
                  background: shape.fill || '#D9D9D9',
                  borderRadius: shape.cornerRadius || 0,
                  border: `${shape.strokeWidth || 1}px solid ${shape.stroke || '#000'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* POPOVER: CORNER SMOOTHING (SCREENSHOT 2)                          */}
      {/* ================================================================= */}
      {isCornerSmoothingOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 240,
            right: 250,
            width: 240,
            background: bgElevated,
            border: `1px solid ${divider}`,
            borderRadius: 8,
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            padding: 12,
            zIndex: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Corner smoothing</span>
            <button
              type="button"
              onClick={() => setIsCornerSmoothingOpen(false)}
              style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="range"
                min={0}
                max={100}
                value={smoothing}
                onChange={(e) => onChange({ cornerSmoothing: Number(e.target.value) })}
                style={{ width: '100%', accentColor, cursor: 'pointer' }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '60%',
                  top: '100%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginTop: 2,
                }}
              >
                <span style={{ fontSize: 9, color: textSecondary }}>iOS</span>
              </div>
            </div>

            <div
              style={{
                background: bgSecondary,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                color: textPrimary,
                minWidth: 36,
                textAlign: 'center',
              }}
            >
              {`${smoothing}%`}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* POPOVER: STROKE SETTINGS (SCREENSHOT 4)                           */}
      {/* ================================================================= */}
      {isStrokeSettingsOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 360,
            right: 250,
            width: 250,
            background: bgElevated,
            border: `1px solid ${divider}`,
            borderRadius: 8,
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            padding: 12,
            zIndex: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Stroke settings</span>
            <button
              type="button"
              onClick={() => setIsStrokeSettingsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', background: bgSecondary, borderRadius: 6, padding: 2 }}>
            {(['basic', 'dynamic', 'brush'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStrokeSettingsTab(t)}
                style={{
                  flex: 1,
                  background: strokeSettingsTab === t ? bgCard : 'transparent',
                  color: strokeSettingsTab === t ? textPrimary : textSecondary,
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 0',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Style</span>
            <div style={{ ...inputStyle, width: 140 }}>
              <select
                value={shape.strokeStyle || 'solid'}
                onChange={(e) => onChange({ strokeStyle: e.target.value as any })}
                style={{ width: '100%', background: 'transparent', border: 'none', color: textPrimary, fontSize: 11, cursor: 'pointer' }}
              >
                <option value="solid" style={{ background: bgCard }}>— Solid</option>
                <option value="dashed" style={{ background: bgCard }}>--- Dashed</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Width profile</span>
            <div style={{ ...inputStyle, width: 140, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ height: 4, width: 80, background: textPrimary, borderRadius: 2 }} />
              <button type="button" style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 0 }}>
                <FlipHorizontal size={11} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Join</span>
            <div style={{ display: 'flex', background: bgSecondary, borderRadius: 6, padding: 2, gap: 2 }}>
              {[
                { id: 'miter', icon: '⌝' },
                { id: 'bevel', icon: '◿' },
                { id: 'round', icon: '◜' },
              ].map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => onChange({ strokeJoin: j.id as any })}
                  style={{
                    background: (shape.strokeJoin || 'miter') === j.id ? bgCard : 'transparent',
                    color: (shape.strokeJoin || 'miter') === j.id ? accentColor : textSecondary,
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                  title={j.id}
                >
                  {j.icon}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Miter angle</span>
            <ScrubbableNumberInput
              label="∠"
              suffix="°"
              value={shape.strokeMiterAngle ?? 28.96}
              min={0}
              step={0.5}
              allowDecimals={true}
              onChange={(val) => onChange({ strokeMiterAngle: val })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ width: 140, height: 26, borderRadius: 5, border: `1px solid ${inputBorder}` }}
            />
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* FIGMA COLOR PICKER FLUTUANTE (se não houver handler externo)       */}
      {/* ================================================================= */}
      {activeColorPicker && !onActiveColorPickerChange && (
        <FigmaColorPicker
          color={
            activeColorPicker.target === 'fill'
              ? activeFillItem?.color || shape.fill || '#D9D9D9'
              : activeStrokeItem?.color || shape.stroke || '#000000'
          }
          opacity={
            activeColorPicker.target === 'fill'
              ? activeFillItem?.opacity ?? 1
              : activeStrokeItem?.opacity ?? 1
          }
          themeTokens={themeTokens}
          accentColor={accentColor}
          onChange={(newColor, newOpacity) => {
            if (activeColorPicker.target === 'fill') {
              const isAll = activeColorPicker.id === 'all';
              updateFills(
                fills.map((f) =>
                  isAll || f.id === activeColorPicker.id ? { ...f, color: newColor, opacity: newOpacity } : f
                )
              );
            } else {
              const isAll = activeColorPicker.id === 'all';
              updateStrokes(
                strokes.map((s) =>
                  isAll || s.id === activeColorPicker.id ? { ...s, color: newColor, opacity: newOpacity } : s
                )
              );
            }
          }}
          onClose={() => setActiveColorPicker(null)}
        />
      )}
    </div>
  );
}
