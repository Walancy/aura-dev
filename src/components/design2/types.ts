export type ShapeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'star'
  | 'text'
  | 'text-path'
  | 'pen'
  | 'pencil'
  | 'frame'
  | 'section'
  | 'slice'
  | 'group'
  | 'image'
  | 'comment'
  | 'annotation'
  | 'measurement';

export type ToolId =
  | 'select'
  | 'scale'
  | 'frame'
  | 'section'
  | 'slice'
  | 'rect'
  | 'line'
  | 'arrow'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'image'
  | 'pen'
  | 'pencil'
  | 'text'
  | 'text-path'
  | 'hand'
  | 'comment'
  | 'annotation'
  | 'measurement';

export interface Point {
  x: number;
  y: number;
}

export interface FillItem {
  id: string;
  color: string;
  opacity: number; // 0 to 1
  visible: boolean;
  type?: 'solid' | 'linear' | 'radial' | 'angular' | 'diamond' | 'image';
}

export interface StrokeItem {
  id: string;
  color: string;
  opacity: number; // 0 to 1
  visible: boolean;
  width?: number;
}

export type EffectType =
  | 'drop-shadow'
  | 'inner-shadow'
  | 'layer-blur'
  | 'background-blur'
  | 'noise';

export interface EffectItem {
  id: string;
  type: EffectType;
  color: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
  spread: number;
  visible: boolean;
  blendMode?: string;
  // Blur especifico:
  blurMode?: 'uniform' | 'progressive';
  blurStart?: number;
  blurEnd?: number;
  // Noise especifico:
  noiseMode?: 'mono' | 'duo' | 'multi';
  noiseSizeX?: number;
  noiseSizeY?: number;
  density?: number;
  color2?: string;
  opacity2?: number;
}

export interface ExportItem {
  id: string;
  format: 'PNG' | 'JPG' | 'SVG' | 'PDF';
  scale: '0.5x' | '1x' | '1.5x' | '2x' | '3x' | '4x';
  suffix?: string;
}

export interface Shape {
  id: string;
  name?: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textAlignVertical?: 'top' | 'middle' | 'bottom';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textCase?: 'none' | 'uppercase' | 'lowercase' | 'title' | 'small-caps';
  verticalTrim?: 'standard' | 'cap-height';
  listStyle?: 'none' | 'bullet' | 'numbered';
  paragraphSpacing?: number;
  textTruncate?: 'none' | 'truncate';
  wrapStyle?: 'auto' | 'balance';
  slant?: number;
  imageUrl?: string;
  points?: Point[];
  zIndex: number;
  visible?: boolean;
  locked?: boolean;
  parentId?: string;
  pageId?: string;
  isComponent?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  isMask?: boolean;

  // Layout & Dimensions
  constrainProportions?: boolean;

  // Auto layout
  hasAutoLayout?: boolean;
  layoutFlow?: 'freeform' | 'vertical' | 'horizontal' | 'grid';
  layoutAlign?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  layoutGap?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  independentPadding?: boolean;
  clipContent?: boolean;
  widthMode?: 'fixed' | 'hug' | 'fill';
  heightMode?: 'fixed' | 'hug' | 'fill';

  // Appearance
  blendMode?: string;
  independentCorners?: boolean;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomLeftRadius?: number;
  bottomRightRadius?: number;
  cornerSmoothing?: number; // 0 to 100%

  // Multi-fills
  fills?: FillItem[];

  // Multi-strokes & Advanced Stroke
  strokes?: StrokeItem[];
  strokePosition?: 'inside' | 'center' | 'outside';
  strokeSides?: 'all' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  strokeCustomSides?: { top: number; right: number; bottom: number; left: number };
  strokeStyle?: 'solid' | 'dashed';
  strokeDash?: number;
  strokeGap?: number;
  strokeJoin?: 'miter' | 'bevel' | 'round';
  strokeMiterAngle?: number;

  // Effects
  effects?: EffectItem[];

  // Exports
  exports?: ExportItem[];

  // Polygon / Star
  polygonSides?: number;
  starPoints?: number;
  starInnerRatio?: number; // 0 to 1
}

export interface Page {
  id: string;
  name: string;
  viewport?: { x: number; y: number };
  zoom?: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  host: string;
  ip: string;
  port: number;
  updatedAt: number;
}

export type RoomRole = 'idle' | 'hosting' | 'viewing';
