import type { LayoutGrid } from './layoutGrid';
import type { Handles } from './vector';
import type { CapKind } from './caps';
import type { ImageAdjust } from './imageFilter';
import type { Interaction } from './prototype';
import type { TextRun } from './richText';
import type { PatternKind } from './pattern';
import type { WidthProfile } from './widthProfile';
import type { ComponentProp } from './componentProps';
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
  | 'measurement'
  | 'path';

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

export interface GradientStop {
  position: number; // 0 a 1
  color: string;
  opacity: number; // 0 a 1
}

/** Estilo reutilizável do documento (cor ou texto). Mudar o estilo atualiza todos os shapes que o usam. */
export type DesignStyle =
  | { id: string; name: string; kind: 'color'; color: string; opacity: number }
  | { id: string; name: string; kind: 'text'; fontFamily?: string; fontSize?: number; fontWeight?: number | string; letterSpacing?: number | string; lineHeight?: number | string }
  | { id: string; name: string; kind: 'effect'; effects: EffectItem[] }
  | { id: string; name: string; kind: 'grid'; grids: LayoutGrid[] };

/** Modo de variáveis (ex.: Claro/Escuro). Variáveis de cor guardam um valor por modo. */
export interface DesignMode {
  id: string;
  name: string;
}

export interface DesignVariable {
  id: string;
  name: string;
  /** cor (hex), número, texto ou booleana; os valores ficam como texto por modo ("true"/"false" na booleana) */
  kind: 'color' | 'number' | 'text' | 'boolean';
  values: Record<string, string>;
}

export interface FillItem {
  id: string;
  color: string;
  opacity: number; // 0 to 1
  visible: boolean;
  type?: 'solid' | 'linear' | 'radial' | 'angular' | 'diamond' | 'image' | 'pattern';
  /** Padrão: desenho que se repete (cor do desenho em `color`, fundo opcional em `patternBg`) */
  patternKind?: PatternKind;
  patternScale?: number;
  patternAngle?: number;
  patternBg?: string;
  /** Modo de mesclagem desta camada de preenchimento (CSS mix-blend-mode) */
  blendMode?: string;
  /** Gradiente linear/radial: paradas de cor (ordenadas por position) */
  gradientStops?: GradientStop[];
  /** Linear: ângulo estilo CSS (90 = da esquerda para a direita) */
  gradientAngle?: number;
  /** Radial: centro (0..1 da caixa do shape; padrão 0.5/0.5) */
  gradientCenter?: { x: number; y: number };
  /** Radial: raio como fração da caixa (padrão 0.5 = círculo inscrito; >0.5 cobre mais área) */
  gradientRadius?: number;
}

export interface StrokeItem {
  id: string;
  color: string;
  opacity: number; // 0 to 1
  visible: boolean;
  width?: number;
  /** Modo de mesclagem desta camada de traço (CSS mix-blend-mode) */
  blendMode?: string;
  /** Traço com gradiente (mesmos campos do preenchimento) */
  type?: 'solid' | 'linear' | 'radial';
  gradientStops?: GradientStop[];
  gradientAngle?: number;
  gradientCenter?: { x: number; y: number };
  gradientRadius?: number;
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
  /** Progressivo: lado onde o blur é mais forte (padrão: embaixo) */
  blurDir?: 'bottom' | 'top' | 'left' | 'right';
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
  format: 'PNG' | 'JPG' | 'WEBP' | 'AVIF' | 'SVG' | 'PDF';
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
  /** Estilo por trecho do texto (negrito, cor, tamanho, link…) */
  runs?: TextRun[];
  textCase?: 'none' | 'uppercase' | 'lowercase' | 'title' | 'small-caps';
  verticalTrim?: 'standard' | 'cap-height';
  listStyle?: 'none' | 'bullet' | 'numbered';
  paragraphSpacing?: number;
  textTruncate?: 'none' | 'truncate';
  /** Texto original antes da pseudolocalização (para restaurar) */
  l10nOriginal?: string;
  /** Fontes variáveis: valor por eixo (wght, wdth, slnt, opsz…) */
  fontVariations?: Record<string, number>;
  /** Recursos OpenType ligados (liga, tnum, smcp…) */
  fontFeatures?: string[];
  /** Corte vertical: a caixa começa na altura das maiúsculas e termina na linha de base (sem o respiro da entrelinha) */
  textVerticalTrim?: 'standard' | 'cap-height';
  /** Caixa do texto: acompanha o conteúdo (largura ou altura automática) ou fica fixa */
  textResize?: 'auto-width' | 'auto-height' | 'fixed';
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
  /** Design 3: frame que define um componente reutilizável da biblioteca (nome do componente) */
  fcDef?: string;
  /** Design 3: raiz de uma instância de componente da biblioteca (os textos/ícones que mudam em relação ao componente) */
  fcInst?: { name: string; text?: Record<string, string>; icon?: Record<string, string> };
  /** Design 3: camada dentro de uma instância (id do shape raiz): o FigCraft desenha só a instância, não estas camadas */
  fcInside?: string;
  flipX?: boolean;
  flipY?: boolean;
  isMask?: boolean;
  /** Nome do ícone Material quando o path veio do seletor de ícones */
  iconName?: string;
  /** Peça do aparelho (barra de status, ilha, botões…): não conta como conteúdo da tela */
  deviceChrome?: boolean;
  /** Texto original (sem as quebras de linha inseridas) de um texto com largura "fill" */
  wrapSource?: string;
  /** Frame interno que representa a tela do aparelho (recebe o conteúdo; sem rótulo próprio) */
  deviceScreen?: boolean;

  // Layout & Dimensions
  constrainProportions?: boolean;

  // Auto layout
  hasAutoLayout?: boolean;
  layoutFlow?: 'freeform' | 'vertical' | 'horizontal' | 'grid';
  /** Fora do fluxo do auto layout do pai (sobreposto, como "ignorar auto layout" do Figma): badges, pontos de notificação, botões flutuantes */
  layoutAbsolute?: boolean;
  /** Wrap/Grid: espaço entre as linhas (padrão: o mesmo do gap) */
  layoutCounterGap?: number;
  /** Grid: quantidade de colunas (padrão 3) */
  gridCols?: number;
  /** Tamanho mínimo/máximo dentro de um auto layout (e do próprio frame com hug) */
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  /** Status de entrega para desenvolvimento (rascunho é o padrão) */
  devStatus?: 'ready' | 'done';
  /** Frame raiz: começa um fluxo do protótipo (aparece na lista de fluxos ao apresentar) */
  flowStart?: boolean;
  flowName?: string;
  /** Protótipo: este elemento fica fixo (não rola) quando o frame pai tem rolagem */
  fixedOnScroll?: boolean;
  /** Frame: rolagem do conteúdo no modo apresentação do protótipo */
  scrollMode?: 'none' | 'vertical' | 'horizontal' | 'both';
  /** Auto layout: o primeiro filho fica por cima na pilha (em vez do último) */
  layoutStackFirstOnTop?: boolean;
  /** Posição presa a um canto do pai (refeita depois do layout): dx/dy = quanto sai para fora do canto, em px */
  overlayAnchor?: { anchor: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'top-center' | 'bottom-center'; dx: number; dy: number };
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
  /** Espaçamento automático (space between): o espaço livre é dividido entre os itens */
  layoutGapAuto?: boolean;
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
  /** Padrão de tracejado livre (ex.: "8 4 2 4"); vale no lugar de dash/gap quando válido */
  strokeDashArray?: string;
  strokeGap?: number;
  strokeJoin?: 'miter' | 'bevel' | 'round';
  strokeMiterAngle?: number;

  // Effects
  effects?: EffectItem[];
  /** Grades de layout do frame (colunas, linhas, grade quadrada) */
  layoutGrids?: LayoutGrid[];
  /** Como o shape reage quando o frame pai é redimensionado */
  constraintH?: 'start' | 'end' | 'center' | 'stretch' | 'scale';
  constraintV?: 'start' | 'end' | 'center' | 'stretch' | 'scale';
  /** Pen/pencil: desenha o traço como curva suave passando pelos nós */
  smooth?: boolean;
  /** Pen/linha: perfil de largura do traço (afinar, fino-grosso-fino…); desenha o traço como polígono preenchido */
  widthProfile?: WidthProfile;
  /** Máscara: 'outline' recorta pelo contorno (padrão); 'alpha' e 'luminance' usam o preenchimento da máscara */
  maskType?: 'outline' | 'alpha' | 'luminance';
  /** Pontas da linha/caminho (início e fim) */
  startCap?: CapKind;
  endCap?: CapKind;
  /** Pen: alças Bézier por nó (deslocamentos a partir do nó) e caminho fechado (preenchível) */
  pathHandles?: Handles;
  closed?: boolean;
  /** Imagem: modo de ajuste e recorte (frações 0..1 da imagem original) */
  imageFit?: 'fill' | 'fit' | 'stretch';
  /** produto recortado que sai pelo topo do card: o app o dimensiona pela largura do card */
  popOut?: boolean;
  imageCrop?: { x: number; y: number; w: number; h: number };
  /** Vídeo como preenchimento (data URL; toca em laço, mudo, no canvas e no protótipo) */
  videoUrl?: string;
  /** Ajustes da imagem (exposição, contraste, saturação, temperatura, matiz) */
  imageAdjust?: ImageAdjust;
  /** Protótipo: ao clicar neste elemento no modo apresentação, vai para o frame de destino (formato antigo; vira uma interação de clique) */
  prototypeLink?: { targetId: string };
  /** Protótipo: gatilhos e ações deste elemento (clique, hover, arrastar, tecla, tempo) */
  interactions?: Interaction[];
  /** Issue do GitHub à qual este design (frame) está ligado */
  linkedIssue?: number;
  /** Variável de cor ligada ao preenchimento (muda com o modo ativo) */
  fillVariableId?: string;
  /** Variáveis (número/texto/booleana) ligadas a propriedades do shape: propriedade → id da variável */
  variableBindings?: Record<string, string>;
  /** Estilos do documento aplicados ao shape */
  fillStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
  gridStyleId?: string;
  /** Componente: grupo de variantes (componentes com o mesmo grupo são variantes um do outro) e nome da variante */
  variantGroup?: string;
  variantName?: string;
  /** Componente principal: propriedades expostas às instâncias (mostrar/ocultar camada, texto) */
  componentProps?: ComponentProp[];
  /** Instância (raiz): valores das propriedades do componente, por id da propriedade */
  propValues?: Record<string, boolean | string>;
  /** Instância: id do componente principal (no shape raiz da instância) */
  instanceOf?: string;
  /** Filho de instância: id do shape correspondente no componente principal */
  sourceId?: string;
  /** Propriedades alteradas na instância (não são sobrescritas quando o componente muda) */
  overrides?: string[];
  /** Resultado de operação booleana / flatten: caminho SVG em coordenadas locais (origem 0,0) e seu tamanho original */
  pathD?: string;
  pathW?: number;
  pathH?: number;
  /** Imagem recortada por uma forma (máscara): caminho SVG numa caixa 100x100 */
  maskPathD?: string;
  /** Imagem em mosaico (textura): a imagem tem N vezes o tamanho em que aparece (escala 1/N) */
  imageTile?: number;
  /** text-path: curvatura do arco (positivo sobe, negativo desce) */
  pathCurve?: number;
  /** text-path: id de outro shape cujo contorno serve de caminho (em vez do arco) */
  pathTargetId?: string;

  // Exports
  exports?: ExportItem[];

  // Elipse como arco, fatia ou anel
  arcStart?: number;
  arcEnd?: number;
  arcInner?: number; // 0 a 1 (fração do raio externo)

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
