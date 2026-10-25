import { logSystemActivity } from './brainService';

export interface DesignTypographyToken {
  family: string;
  size: number;
  weight: number | string;
}

export interface DesignScreenSpec {
  id: string;
  slug: string;
  name: string;
  pageId: string;
  pageName: string;
  width: number;
  height: number;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'component';
  backgroundHex: string;
  colors: string[];
  fonts: DesignTypographyToken[];
  texts: string[];
  elementCount: number;
  previewDataUrl?: string;
  imageRelPath: string;
  imageAbsPath: string;
  layoutTreeMarkdown: string;
  jsxBlueprint: string;
  updatedAt: string;
}

export interface DesignBridgeManifest {
  workspacePath: string;
  projectName: string;
  updatedAt: string;
  colorPalette: string[];
  typographyScale: DesignTypographyToken[];
  screens: DesignScreenSpec[];
  selectedScreenIds?: string[];
}

const STORAGE_KEY_PREFIX = 'devflow_design_bridge_v1:';
const memoryManifestCache: Record<string, DesignBridgeManifest> = {};

function toSlug(input: string, fallbackIndex: number): string {
  const base = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `screen-${fallbackIndex + 1}`;
}

function rgbChannelToHex(val: number): string {
  const normalized = val <= 1 && val >= 0 ? Math.round(val * 255) : Math.round(val);
  return Math.max(0, Math.min(255, normalized)).toString(16).padStart(2, '0');
}

function extractColorHex(colorObj: any): string | null {
  if (!colorObj) return null;
  if (typeof colorObj === 'string') {
    if (colorObj.startsWith('#')) return colorObj.toUpperCase();
    return null;
  }
  if (typeof colorObj.color === 'string' && colorObj.color.startsWith('#')) {
    return colorObj.color.toUpperCase();
  }
  const c = colorObj.color && typeof colorObj.color === 'object' ? colorObj.color : colorObj;
  if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
    return `#${rgbChannelToHex(c.r)}${rgbChannelToHex(c.g)}${rgbChannelToHex(c.b)}`.toUpperCase();
  }
  return null;
}

function extractPrimaryFillHex(node: any): string | null {
  if (!node) return null;
  if (typeof node.fill === 'string' && node.fill.startsWith('#')) {
    return node.fill.toUpperCase();
  }
  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill && fill.visible !== false) {
        const hex = extractColorHex(fill);
        if (hex) return hex;
      }
    }
  }
  if (typeof node.background === 'string' && node.background.startsWith('#')) {
    return node.background.toUpperCase();
  }
  return null;
}

function extractPrimaryStrokeHex(node: any): string | null {
  if (!node) return null;
  if (typeof node.stroke === 'string' && node.stroke.startsWith('#')) {
    return node.stroke.toUpperCase();
  }
  if (Array.isArray(node.strokes)) {
    for (const stroke of node.strokes) {
      if (stroke && stroke.visible !== false) {
        const hex = extractColorHex(stroke);
        if (hex) return hex;
      }
    }
  }
  return null;
}

function inferDeviceType(width: number, height: number): 'mobile' | 'tablet' | 'desktop' | 'component' {
  if (width >= 1024) return 'desktop';
  if (width >= 600 && width < 1024) return 'tablet';
  if (width >= 280 && height >= 480) return 'mobile';
  return 'component';
}

function findInnerFrame(n: any, d = 0): any | null {
  if (!n) return null;
  if (n.type === 'FRAME' || n.type === 'COMPONENT') return n;
  if (d > 4) return null;
  for (const c of n.children || []) {
    const found = findInnerFrame(c, d + 1);
    if (found) return found;
  }
  return null;
}

function nodeContainsId(n: any, targetId: number | string): boolean {
  if (!n) return false;
  if (String(n.id) === String(targetId)) return true;
  return Array.isArray(n.children) && n.children.some((c: any) => nodeContainsId(c, targetId));
}

function extractScreensFromPage(page: any): any[] {
  const children = Array.isArray(page?.children) ? page.children : [];
  const screens: any[] = [];
  for (const child of children) {
    if (!child || child.visible === false || child.type === 'SLICE' || child.type === 'SECTION') continue;
    if (child.type === 'FRAME' || child.type === 'COMPONENT') {
      screens.push({
        ...child,
        name: String(child.name || 'Tela').replace(/^Moldura:\s*/i, '').trim() || 'Tela',
        _topNode: child,
      });
    } else if (child.type === 'GROUP') {
      const innerFrame = findInnerFrame(child);
      const cleanTopName = String(child.name || '').replace(/^Moldura:\s*/i, '').trim();
      if (innerFrame) {
        const cleanInnerName = String(innerFrame.name || '').replace(/^Moldura:\s*/i, '').trim();
        screens.push({
          ...innerFrame,
          name:
            cleanInnerName && cleanInnerName !== 'Screen' && cleanInnerName !== 'Frame'
              ? cleanInnerName
              : cleanTopName || cleanInnerName || 'Tela',
          width: innerFrame.width ?? innerFrame.w ?? child.width ?? child.w ?? 390,
          height: innerFrame.height ?? innerFrame.h ?? child.height ?? child.h ?? 844,
          _topNode: child,
        });
      } else {
        screens.push({
          ...child,
          name: cleanTopName || 'Tela',
          _topNode: child,
        });
      }
    }
  }
  return screens;
}

function formatPadding(node: any): string {
  const pt = Math.round(Number(node?.paddingTop || node?.padding || 0));
  const pr = Math.round(Number(node?.paddingRight || node?.padding || 0));
  const pb = Math.round(Number(node?.paddingBottom || node?.padding || 0));
  const pl = Math.round(Number(node?.paddingLeft || node?.padding || 0));
  if (!pt && !pr && !pb && !pl) return '';
  if (pt === pr && pr === pb && pb === pl) return `${pt}px`;
  if (pt === pb && pl === pr) return `${pt}px ${pr}px`;
  return `${pt}px ${pr}px ${pb}px ${pl}px`;
}

function buildLayoutTreeAndTokens(rootNode: any): {
  colors: string[];
  fonts: DesignTypographyToken[];
  texts: string[];
  elementCount: number;
  layoutTreeMarkdown: string;
  jsxBlueprint: string;
} {
  const colorSet = new Set<string>();
  const fontMap = new Map<string, DesignTypographyToken>();
  const texts: string[] = [];
  let elementCount = 0;
  const treeLines: string[] = [];
  const jsxLines: string[] = [];

  const walk = (node: any, depth: number) => {
    if (!node || node.visible === false) return;
    elementCount += 1;

    const fillHex = extractPrimaryFillHex(node);
    const strokeHex = extractPrimaryStrokeHex(node);
    if (fillHex) colorSet.add(fillHex);
    if (strokeHex) colorSet.add(strokeHex);

    const indent = '  '.repeat(Math.min(depth, 8));
    const type = String(node.type || 'NODE').toUpperCase();
    const name = String(node.name || type).trim();
    const w = Math.round(Number(node.width || 0));
    const h = Math.round(Number(node.height || 0));
    const x = Math.round(Number(node.x || 0));
    const y = Math.round(Number(node.y || 0));
    const radius = Math.round(Number(node.cornerRadius || 0));
    const gap = Math.round(Number(node.itemSpacing || node.gap || 0));
    const pad = formatPadding(node);
    const layoutMode = node.layoutMode && node.layoutMode !== 'NONE' ? String(node.layoutMode) : '';

    const rawText = typeof node.characters === 'string'
      ? node.characters.trim()
      : typeof node.text === 'string'
      ? node.text.trim()
      : '';

    if (rawText) {
      if (!texts.includes(rawText)) {
        texts.push(rawText);
      }
      const family = String(node.fontFamily || node.fontName?.family || 'Inter');
      const size = Math.round(Number(node.fontSize || 14));
      const weight = node.fontWeight || node.fontName?.style || 400;
      const key = `${family}:${size}:${weight}`;
      if (!fontMap.has(key)) {
        fontMap.set(key, { family, size, weight });
      }
    }

    if (treeLines.length < 120) {
      const metaParts: string[] = [];
      if (w > 0 && h > 0) metaParts.push(`${w}x${h}`);
      if (depth > 0 && !layoutMode) metaParts.push(`pos:${x},${y}`);
      if (layoutMode) metaParts.push(`flex:${layoutMode === 'HORIZONTAL' ? 'row' : 'column'}`);
      if (gap > 0) metaParts.push(`gap:${gap}px`);
      if (pad) metaParts.push(`pad:${pad}`);
      if (fillHex) metaParts.push(`bg:${fillHex}`);
      if (strokeHex) metaParts.push(`border:${strokeHex}`);
      if (radius > 0) metaParts.push(`radius:${radius}px`);
      if (rawText) {
        const fontSize = Math.round(Number(node.fontSize || 14));
        const fontWeight = node.fontWeight || 400;
        metaParts.push(`font:${fontSize}px/${fontWeight}`);
      }

      const textPreview = rawText ? ` -> "${rawText.replace(/\s+/g, ' ').slice(0, 80)}"` : '';
      treeLines.push(`${indent}- [${type}] **${name}** (${metaParts.join(' | ')})${textPreview}`);
    }

    if (jsxLines.length < 140) {
      const styleProps: string[] = [];
      if (layoutMode) {
        styleProps.push(`display: 'flex'`);
        styleProps.push(`flexDirection: '${layoutMode === 'HORIZONTAL' ? 'row' : 'column'}'`);
      }
      if (gap > 0) styleProps.push(`gap: ${gap}`);
      if (pad) styleProps.push(`padding: '${pad}'`);
      if (w > 0 && depth === 0) styleProps.push(`width: ${w}, minHeight: ${h}`);
      else if (w > 0 && h > 0 && !layoutMode && type !== 'TEXT') styleProps.push(`width: ${w}, height: ${h}`);
      if (fillHex && type !== 'TEXT') styleProps.push(`background: '${fillHex}'`);
      if (fillHex && type === 'TEXT') styleProps.push(`color: '${fillHex}'`);
      if (radius > 0) styleProps.push(`borderRadius: ${radius}`);

      if (type === 'TEXT' || rawText) {
        const fontSize = Math.round(Number(node.fontSize || 14));
        styleProps.push(`fontSize: ${fontSize}`);
        if (node.fontWeight) styleProps.push(`fontWeight: ${Number(node.fontWeight) || 400}`);
        jsxLines.push(
          `${indent}<span data-node="${name.replace(/"/g, '')}" style={{ ${styleProps.join(', ')} }}>${rawText.replace(/\n/g, ' ')}</span>`
        );
      } else {
        const children = Array.isArray(node.children) ? node.children.filter((c: any) => c && c.visible !== false) : [];
        const tag =
          /button|btn|cta/i.test(name)
            ? 'button'
            : /input|search|field/i.test(name)
            ? 'input'
            : /header|nav|topbar/i.test(name)
            ? 'header'
            : /sidebar|aside/i.test(name)
            ? 'aside'
            : 'div';

        if (children.length === 0 || depth >= 5 || tag === 'input') {
          jsxLines.push(`${indent}<${tag} data-node="${name.replace(/"/g, '')}" style={{ ${styleProps.join(', ')} }} />`);
        } else {
          jsxLines.push(`${indent}<${tag} data-node="${name.replace(/"/g, '')}" style={{ ${styleProps.join(', ')} }}>`);
          for (const child of children.slice(0, 24)) {
            walk(child, depth + 1);
          }
          jsxLines.push(`${indent}</${tag}>`);
          return;
        }
      }
    }

    const children = Array.isArray(node.children) ? node.children : [];
    if (depth < 6) {
      for (const child of children.slice(0, 24)) {
        walk(child, depth + 1);
      }
    }
  };

  walk(rootNode, 0);

  return {
    colors: Array.from(colorSet).slice(0, 24),
    fonts: Array.from(fontMap.values()).sort((a, b) => b.size - a.size).slice(0, 16),
    texts: texts.slice(0, 50),
    elementCount,
    layoutTreeMarkdown: treeLines.join('\n'),
    jsxBlueprint: jsxLines.join('\n'),
  };
}

export function extractDesignManifestFromInspect(
  inspectData: any,
  workspacePath: string,
  projectName?: string,
  previewsByFrameId?: Record<string, string>
): DesignBridgeManifest {
  const cleanWorkspace = (workspacePath || '').replace(/\/+$/, '');
  const resolvedProjectName =
    projectName || cleanWorkspace.split('/').filter(Boolean).pop() || 'Projeto';
  const pages = Array.isArray(inspectData?.pages) ? inspectData.pages : [];
  const usedSlugs = new Set<string>();
  const globalColors = new Set<string>();
  const globalFonts = new Map<string, DesignTypographyToken>();
  const screens: DesignScreenSpec[] = [];
  const nowIso = new Date().toISOString();

  const selectedIdsRaw: Array<number | string> = Array.isArray(inspectData?.selection) ? inspectData.selection : [];
  const selectedScreenIdSet = new Set<string>();

  pages.forEach((page: any, pIdx: number) => {
    const pageScreens = extractScreensFromPage(page);
    pageScreens.forEach((frame: any, sIdx: number) => {
      const name = String(frame.name || `Tela ${sIdx + 1}`).trim();
      let slug = toSlug(name, screens.length);
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${screens.length + 1}`;
      }
      usedSlugs.add(slug);

      const width = Math.max(1, Math.round(Number(frame.width || 1440)));
      const height = Math.max(1, Math.round(Number(frame.height || 900)));
      const bgHex =
        extractPrimaryFillHex(frame) ||
        extractColorHex(page?.background) ||
        '#0D0E12';

      const parsed = buildLayoutTreeAndTokens(frame);
      if (bgHex) globalColors.add(bgHex);
      parsed.colors.forEach((c) => globalColors.add(c));
      parsed.fonts.forEach((f) => {
        const key = `${f.family}:${f.size}:${f.weight}`;
        if (!globalFonts.has(key)) globalFonts.set(key, f);
      });

      const imageRelPath = `.devflow/design/screens/${slug}.jpg`;
      const imageAbsPath = cleanWorkspace ? `${cleanWorkspace}/${imageRelPath}` : imageRelPath;
      const previewDataUrl = previewsByFrameId?.[frame.id];
      const screenId = String(frame.id || `screen-${pIdx}-${sIdx}`);

      const topNode = frame._topNode || frame;
      const isCurrentPage =
        inspectData?.currentPage == null ||
        String(page?.id) === String(inspectData.currentPage);
      if (isCurrentPage) {
        for (const selId of selectedIdsRaw) {
          if (nodeContainsId(topNode, selId)) {
            selectedScreenIdSet.add(screenId);
            break;
          }
        }
      }

      screens.push({
        id: screenId,
        slug,
        name,
        pageId: String(page?.id || `page-${pIdx}`),
        pageName: String(page?.name || `Página ${pIdx + 1}`),
        width,
        height,
        deviceType: inferDeviceType(width, height),
        backgroundHex: bgHex,
        colors: parsed.colors.length > 0 ? parsed.colors : [bgHex],
        fonts: parsed.fonts,
        texts: parsed.texts,
        elementCount: parsed.elementCount,
        previewDataUrl,
        imageRelPath,
        imageAbsPath,
        layoutTreeMarkdown: parsed.layoutTreeMarkdown,
        jsxBlueprint: parsed.jsxBlueprint,
        updatedAt: nowIso,
      });
    });
  });

  return {
    workspacePath: cleanWorkspace,
    projectName: resolvedProjectName,
    updatedAt: nowIso,
    colorPalette: Array.from(globalColors).slice(0, 32),
    typographyScale: Array.from(globalFonts.values()).sort((a, b) => b.size - a.size).slice(0, 20),
    screens,
    selectedScreenIds: Array.from(selectedScreenIdSet),
  };
}

export function generateDesignIndexMarkdown(manifest: DesignBridgeManifest): string {
  const lines: string[] = [];
  lines.push(`# Especificação Oficial de Design (${manifest.projectName})`);
  lines.push(`> Sincronizado automaticamente da aba Design do Aura Dev em ${new Date(manifest.updatedAt).toLocaleString('pt-BR')}`);
  lines.push('');
  lines.push('## Como Replicar estes Designs com Fidelidade');
  lines.push('- Cada tela abaixo representa uma especificação visual criada no canvas de Design do projeto.');
  lines.push('- Para inspeção visual exata (layout, proporções, alinhamento e estética), visualize o arquivo de imagem renderizado em `.devflow/design/screens/<slug>.jpg`.');
  lines.push('- Utilize exatamente os tokens de cores Hex, tipografia, textos, estrutura Flexbox (`row`/`column`), `padding`, `gap` e `borderRadius` descritos na árvore estrutural de cada tela.');
  lines.push('');

  if (manifest.colorPalette.length > 0) {
    lines.push('## Paleta de Cores Global do Design');
    lines.push(manifest.colorPalette.map((c) => `\`${c}\``).join(' · '));
    lines.push('');
  }

  if (manifest.typographyScale.length > 0) {
    lines.push('## Escala Tipográfica Detectada');
    for (const font of manifest.typographyScale) {
      lines.push(`- **${font.family}** — \`${font.size}px\` (peso \`${font.weight}\`)`);
    }
    lines.push('');
  }

  lines.push(`## Telas e Componentes (${manifest.screens.length})`);
  lines.push('');

  for (const screen of manifest.screens) {
    lines.push(`### Tela: ${screen.name} (\`@design:${screen.name}\`)`);
    lines.push(`- **Slug**: \`${screen.slug}\``);
    lines.push(`- **Página**: ${screen.pageName}`);
    lines.push(`- **Dimensões**: \`${screen.width}x${screen.height}px\` (${screen.deviceType})`);
    lines.push(`- **Background Principal**: \`${screen.backgroundHex}\``);
    lines.push(`- **Preview Renderizado (Imagem)**: \`${screen.imageAbsPath}\` (relativo: \`${screen.imageRelPath}\`)`);
    lines.push(`- **Cores da Tela**: ${screen.colors.map((c) => `\`${c}\``).join(', ')}`);
    if (screen.fonts.length > 0) {
      lines.push(
        `- **Tipografia da Tela**: ${screen.fonts.map((f) => `${f.family} ${f.size}px/${f.weight}`).join(', ')}`
      );
    }
    if (screen.texts.length > 0) {
      lines.push(`- **Textos e Rótulos Visíveis**: ${screen.texts.map((t) => `"${t}"`).join(' | ')}`);
    }
    lines.push('');
    lines.push('#### Árvore de Layout e Tokens da Tela');
    lines.push('```markdown');
    lines.push(screen.layoutTreeMarkdown || `- [FRAME] ${screen.name} (${screen.width}x${screen.height})`);
    lines.push('```');
    lines.push('');
    lines.push('#### Blueprint Estrutural JSX');
    lines.push('```tsx');
    lines.push(screen.jsxBlueprint || `<div data-node="${screen.name}" />`);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

export function normalizeImageDataUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('data:image/')) return null;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return null;
  const payload = trimmed.slice(commaIdx + 1).trim();
  if (!payload) return null;
  // Handle case where a UTF-8 "data:image/..." string on disk was base64-encoded again by readFileDataUrl
  if (payload.startsWith('ZGF0YTppbWFnZS')) {
    try {
      const decoded = atob(payload).trim();
      if (decoded.startsWith('data:image/')) {
        return decoded;
      }
    } catch {}
  }
  return trimmed;
}

async function readScreenImageFromDisk(fsApi: any, absPath: string): Promise<string | null> {
  if (!fsApi || !absPath) return null;
  if (fsApi.readFileDataUrl) {
    try {
      const res = await fsApi.readFileDataUrl(absPath, 15 * 1024 * 1024);
      const norm = normalizeImageDataUrl(res?.dataUrl);
      if (norm) return norm;
    } catch {}
  }
  if (fsApi.readFile) {
    try {
      const res = await fsApi.readFile(absPath);
      const norm = normalizeImageDataUrl(res?.content);
      if (norm) return norm;
    } catch {}
  }
  return null;
}

const lastSyncedSignatureByWorkspace: Record<string, string> = {};

function buildManifestContentSignature(manifest: DesignBridgeManifest): string {
  return JSON.stringify({
    projectName: manifest.projectName,
    screens: manifest.screens.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      pageName: s.pageName,
      width: s.width,
      height: s.height,
      x: s.x,
      y: s.y,
      backgroundHex: s.backgroundHex,
      elementCount: s.elementCount,
      texts: s.texts,
      colors: s.colors,
      components: s.components,
      previewLen: s.previewDataUrl ? s.previewDataUrl.length : 0,
      previewTail: s.previewDataUrl ? s.previewDataUrl.slice(-64) : '',
    })),
  });
}

export async function syncDesignBridgeToWorkspace(manifest: DesignBridgeManifest): Promise<void> {
  if (!manifest.workspacePath) return;
  const cleanWorkspace = manifest.workspacePath.replace(/\/+$/, '');
  const previous = memoryManifestCache[cleanWorkspace];
  const fsApi = (window as any).electronAPI?.fs;

  // Preserve or hydrate previewDataUrl for every screen so real renders are never lost
  const hydratedScreens: DesignScreenSpec[] = [];
  for (const screen of manifest.screens) {
    let preview = normalizeImageDataUrl(screen.previewDataUrl);
    if (!preview && previous?.screens) {
      const prevMatch = previous.screens.find((p) => p.id === screen.id || p.slug === screen.slug);
      preview = normalizeImageDataUrl(prevMatch?.previewDataUrl);
    }
    if (!preview && fsApi) {
      const relPath = screen.imageRelPath || `.devflow/design/screens/${screen.slug}.jpg`;
      const absPath = screen.imageAbsPath || `${cleanWorkspace}/${relPath.replace(/^\/+/, '')}`;
      preview = await readScreenImageFromDisk(fsApi, absPath);
    }
    hydratedScreens.push({
      ...screen,
      previewDataUrl: preview || undefined,
    });
  }

  const hydratedManifest: DesignBridgeManifest = {
    ...manifest,
    screens: hydratedScreens,
  };

  const contentSig = buildManifestContentSignature(hydratedManifest);
  if (lastSyncedSignatureByWorkspace[cleanWorkspace] === contentSig && memoryManifestCache[cleanWorkspace]) {
    memoryManifestCache[cleanWorkspace] = {
      ...memoryManifestCache[cleanWorkspace],
      selectedScreenIds: hydratedManifest.selectedScreenIds,
    };
    return;
  }
  lastSyncedSignatureByWorkspace[cleanWorkspace] = contentSig;
  memoryManifestCache[cleanWorkspace] = hydratedManifest;

  try {
    const serialized = JSON.stringify(hydratedManifest);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanWorkspace}`, serialized);
    } catch {
      const compactManifest: DesignBridgeManifest = {
        ...hydratedManifest,
        screens: hydratedManifest.screens.map((s) => ({ ...s, previewDataUrl: undefined })),
      };
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanWorkspace}`, JSON.stringify(compactManifest));
    }
  } catch {}

  try {
    if (fsApi?.writeFile) {
      const designDir = `${cleanWorkspace}/.devflow/design`;
      const indexMd = generateDesignIndexMarkdown(hydratedManifest);
      await fsApi.writeFile(`${designDir}/index.md`, indexMd);

      for (const screen of hydratedManifest.screens) {
        if (screen.previewDataUrl && screen.previewDataUrl.startsWith('data:image/')) {
          await fsApi.writeFile(`${designDir}/screens/${screen.slug}.jpg`, screen.previewDataUrl);
        }
      }

      await fsApi.writeFile(`${designDir}/manifest.json`, JSON.stringify(hydratedManifest, null, 2));
    }
  } catch (err) {
    console.warn('[DesignBridge] Failed to write .devflow/design files:', err);
  }

  try {
    window.dispatchEvent(new CustomEvent('devflow-design-bridge-updated', { detail: hydratedManifest }));
  } catch {}

  try {
    logSystemActivity(
      cleanWorkspace,
      'file_edit',
      `Design Bridge sincronizado (${hydratedManifest.screens.length} tela${hydratedManifest.screens.length === 1 ? '' : 's'})`,
      `Especificação atualizada em .devflow/design/index.md: ${hydratedManifest.screens.map((s) => s.name).join(', ') || 'Sem telas'}`,
      { screenCount: hydratedManifest.screens.length, screens: hydratedManifest.screens.map((s) => s.name) }
    );
  } catch {}
}

export function getDesignBridgeManifestSync(workspacePath?: string): DesignBridgeManifest | null {
  if (!workspacePath) return null;
  const cleanWorkspace = workspacePath.replace(/\/+$/, '');
  if (memoryManifestCache[cleanWorkspace]) {
    return memoryManifestCache[cleanWorkspace];
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${cleanWorkspace}`);
    if (raw) {
      const parsed = JSON.parse(raw) as DesignBridgeManifest;
      if (parsed && Array.isArray(parsed.screens)) {
        parsed.screens = parsed.screens.map((s) => ({
          ...s,
          previewDataUrl: normalizeImageDataUrl(s.previewDataUrl) || undefined,
        }));
      }
      memoryManifestCache[cleanWorkspace] = parsed;
      return parsed;
    }
  } catch {}
  return null;
}

export async function loadDesignBridgeManifest(workspacePath?: string): Promise<DesignBridgeManifest | null> {
  if (!workspacePath) return null;
  const cleanWorkspace = workspacePath.replace(/\/+$/, '');
  const cached = getDesignBridgeManifestSync(cleanWorkspace);
  const fsApi = (window as any).electronAPI?.fs;

  let baseManifest: DesignBridgeManifest | null = cached;

  try {
    if (fsApi?.readFile) {
      const res = await fsApi.readFile(`${cleanWorkspace}/.devflow/design/manifest.json`);
      if (res?.content) {
        const diskManifest = JSON.parse(res.content) as DesignBridgeManifest;
        if (diskManifest && Array.isArray(diskManifest.screens) && diskManifest.screens.length > 0) {
          baseManifest = diskManifest;
        }
      }
    }
  } catch {}

  if (!baseManifest || !Array.isArray(baseManifest.screens)) {
    return cached;
  }

  const hydratedScreens: DesignScreenSpec[] = [];
  for (const screen of baseManifest.screens) {
    let preview = normalizeImageDataUrl(screen.previewDataUrl);
    if (!preview && cached?.screens) {
      const cachedMatch = cached.screens.find((c) => c.id === screen.id || c.slug === screen.slug);
      preview = normalizeImageDataUrl(cachedMatch?.previewDataUrl);
    }
    if (!preview && fsApi) {
      const relPath = screen.imageRelPath || `.devflow/design/screens/${screen.slug}.jpg`;
      const absPath = screen.imageAbsPath || `${cleanWorkspace}/${relPath.replace(/^\/+/, '')}`;
      preview = await readScreenImageFromDisk(fsApi, absPath);
    }
    hydratedScreens.push({
      ...screen,
      previewDataUrl: preview || undefined,
    });
  }

  const finalManifest: DesignBridgeManifest = {
    ...baseManifest,
    screens: hydratedScreens,
  };

  memoryManifestCache[cleanWorkspace] = finalManifest;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanWorkspace}`, JSON.stringify(finalManifest));
  } catch {}

  return finalManifest;
}

export function matchDesignScreensForRequest(
  manifest: DesignBridgeManifest | null,
  userPrompt: string,
  explicitMentions: string[] = []
): { matchedScreens: DesignScreenSpec[]; isDesignRequest: boolean } {
  if (!manifest || !Array.isArray(manifest.screens) || manifest.screens.length === 0) {
    return { matchedScreens: [], isDesignRequest: false };
  }

  const cleanPrompt = (userPrompt || '').toLowerCase();
  const designMentions = explicitMentions.filter((m) => /^@?design(?::.+)?$/i.test(m.trim()));

  const matchedById = new Map<string, DesignScreenSpec>();

  // 1. Explicit @design or @design:<ScreenName> mentions
  for (const mention of designMentions) {
    const cleaned = mention.replace(/^@+/, '').trim();
    if (cleaned.toLowerCase() === 'design') {
      manifest.screens.forEach((s) => matchedById.set(s.id, s));
    } else if (cleaned.toLowerCase().startsWith('design:')) {
      const target = cleaned.slice('design:'.length).trim().toLowerCase();
      for (const s of manifest.screens) {
        if (
          s.name.toLowerCase() === target ||
          s.slug.toLowerCase() === target ||
          s.name.toLowerCase().includes(target)
        ) {
          matchedById.set(s.id, s);
        }
      }
    }
  }

  if (matchedById.size > 0) {
    return { matchedScreens: Array.from(matchedById.values()), isDesignRequest: true };
  }

  // 2. Natural-language detection (zero-click): user asks to implement/replicate/use the design/protótipo/canvas or names a screen from Design
  const hasDesignIntentKeyword =
    /\b(design|designs|prot[oó]tipo|prot[oó]tipos|figcraft|canvas|wireframe|mockup|layout\s+da\s+aba|aba\s+de?\s*design|tela\s+criada|telas\s+criadas|replicar|replique|implemente\s+a\s+tela|implementar\s+a\s+tela|igual\s+ao\s+design|conforme\s+o\s+design|baseado\s+no\s+design)\b/i.test(
      cleanPrompt
    );

  // Check if any specific screen name from the Design tab is mentioned in the prompt
  for (const screen of manifest.screens) {
    const screenNameLower = screen.name.toLowerCase().trim();
    const screenSlugLower = screen.slug.toLowerCase().trim();
    if (
      screenNameLower.length >= 3 &&
      (cleanPrompt.includes(screenNameLower) || cleanPrompt.includes(screenSlugLower))
    ) {
      if (
        hasDesignIntentKeyword ||
        /\b(tela|screen|p[aá]gina|page|componente|view|modal|implement|crie|criar|fa[cç]a|fazer|ajust|replic)\b/i.test(
          cleanPrompt
        )
      ) {
        matchedById.set(screen.id, screen);
      }
    }
  }

  if (matchedById.size > 0) {
    return { matchedScreens: Array.from(matchedById.values()), isDesignRequest: true };
  }

  if (hasDesignIntentKeyword) {
    return { matchedScreens: manifest.screens, isDesignRequest: true };
  }

  return { matchedScreens: [], isDesignRequest: false };
}

export function formatDesignContextBlockForAi(
  manifest: DesignBridgeManifest,
  screens: DesignScreenSpec[]
): string {
  const targetScreens = screens.length > 0 ? screens : manifest.screens;
  if (targetScreens.length === 0) return '';

  const lines: string[] = [];
  lines.push('[Ponte Dinâmica Design <-> Código (Aura Dev Design Bridge)]:');
  lines.push(`- Arquivo Mestre de Especificação no Projeto: ${manifest.workspacePath}/.devflow/design/index.md`);
  lines.push(`- Paleta Global do Design: ${manifest.colorPalette.join(', ') || 'Padrão'}`);
  if (manifest.typographyScale.length > 0) {
    lines.push(
      `- Escala Tipográfica: ${manifest.typographyScale
        .slice(0, 8)
        .map((f) => `${f.family} ${f.size}px/${f.weight}`)
        .join(', ')}`
    );
  }
  lines.push(
    '- DIRETRIZ DE REPLICAÇÃO FIEL: Replique fielmente a estrutura visual, cores Hex, tipografia, textos, espaçamentos (padding/gap), alinhamentos Flexbox e proporções das telas abaixo. Você também pode inspecionar visualmente os arquivos `.jpg` renderizados em `.devflow/design/screens/` para conferir cada detalhe visual.'
  );

  for (const screen of targetScreens) {
    lines.push('');
    lines.push(`### Especificação da Tela "${screen.name}" (${screen.width}x${screen.height}px - ${screen.deviceType})`);
    lines.push(`- Imagem Renderizada da Tela: ${screen.imageAbsPath}`);
    lines.push(`- Background: ${screen.backgroundHex}`);
    lines.push(`- Cores: ${screen.colors.join(', ')}`);
    if (screen.fonts.length > 0) {
      lines.push(`- Fontes: ${screen.fonts.map((f) => `${f.family} ${f.size}px (${f.weight})`).join(', ')}`);
    }
    if (screen.texts.length > 0) {
      lines.push(`- Textos Visíveis: ${screen.texts.map((t) => `"${t}"`).join(' | ')}`);
    }
    lines.push('- Hierarquia e Tokens de Layout:');
    lines.push(screen.layoutTreeMarkdown);
    lines.push('- Blueprint JSX de Referência:');
    lines.push('```tsx');
    lines.push(screen.jsxBlueprint);
    lines.push('```');
  }

  return lines.join('\n');
}

export function buildDesignImplementationPrompt(
  manifest: DesignBridgeManifest,
  screens?: DesignScreenSpec[],
  customInstruction?: string
): string {
  const targetScreens = screens && screens.length > 0 ? screens : manifest.screens;
  const mentions =
    targetScreens.length === manifest.screens.length
      ? '@[design]'
      : targetScreens.map((s) => `@[design:${s.name}]`).join(' ');

  const screenNames = targetScreens.map((s) => `"${s.name}" (${s.width}x${s.height}px)`).join(', ');
  const imagePaths = targetScreens.map((s) => s.imageRelPath).join(', ');

  if (customInstruction && customInstruction.trim()) {
    return `${mentions} ${customInstruction.trim()}`;
  }

  return `${mentions} Implemente no código do projeto ${
    targetScreens.length === 1 ? `a tela ${screenNames}` : `as telas ${screenNames}`
  } geradas na aba Design, mantendo fidelidade visual absoluta às cores, tipografia, textos, estrutura Flexbox, paddings e gaps especificados em .devflow/design/index.md e nas imagens renderizadas (${imagePaths}).`;
}

export function buildCliTerminalDesignPrompt(
  manifest: DesignBridgeManifest,
  screens?: DesignScreenSpec[]
): string {
  const targetScreens = screens && screens.length > 0 ? screens : manifest.screens;
  const screenSummary = targetScreens
    .map((s) => `"${s.name}" (${s.width}x${s.height}px, imagem: ${s.imageRelPath}, cores: ${s.colors.slice(0, 6).join(' ')})`)
    .join('; ');

  return `Analise a especificação completa do design em .devflow/design/index.md e visualize as imagens renderizadas das telas (${targetScreens
    .map((s) => s.imageRelPath)
    .join(', ')}). Implemente no projeto ${
    targetScreens.length === 1 ? 'a tela' : 'as telas'
  }: ${screenSummary}. Siga fielmente o layout, hierarquia Flexbox, padding, gap, tipografia, textos e paleta de cores definidos no design.`;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildScreenSvgFallbackDataUrl(screen: DesignScreenSpec): string {
  const w = Math.max(320, Number(screen.width) || 1440);
  const h = Math.max(240, Number(screen.height) || 900);
  const bg = screen.backgroundHex || '#101010';
  const isLightBg = /^#([fF]|[eE]|[dD])/.test(bg);
  const fgPrimary = isLightBg ? '#0F172A' : '#FFFFFF';
  const fgMuted = isLightBg ? '#64748B' : '#888888';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${escapeXml(bg)}" />
    <text x="${Math.round(w / 2)}" y="${Math.round(h / 2) - 8}" font-family="Poppins, sans-serif" font-size="${Math.max(16, Math.round(Math.min(w, h) * 0.035))}" font-weight="400" fill="${fgPrimary}" text-anchor="middle">${escapeXml(screen.name)}</text>
    <text x="${Math.round(w / 2)}" y="${Math.round(h / 2) + 22}" font-family="Poppins, sans-serif" font-size="${Math.max(12, Math.round(Math.min(w, h) * 0.022))}" font-weight="400" fill="${fgMuted}" text-anchor="middle">${w} × ${h}px</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function resolveDesignScreenPreviewUrl(
  workspacePath: string,
  screen: DesignScreenSpec
): Promise<string> {
  const normalizedExisting = normalizeImageDataUrl(screen.previewDataUrl);
  if (normalizedExisting) {
    screen.previewDataUrl = normalizedExisting;
    return normalizedExisting;
  }

  const fsApi = (window as any)?.electronAPI?.fs;
  const cleanWs = (workspacePath || '').replace(/\/+$/, '');
  const relPath = (screen as any).imageRelPath || (screen as any).previewRelativePath || `.devflow/design/screens/${screen.slug}.jpg`;
  const absPath = screen.imageAbsPath || (cleanWs ? `${cleanWs}/${relPath.replace(/^\/+/, '')}` : '');

  const diskUrl = await readScreenImageFromDisk(fsApi, absPath);
  if (diskUrl) {
    screen.previewDataUrl = diskUrl;
    return diskUrl;
  }

  return buildScreenSvgFallbackDataUrl(screen);
}


