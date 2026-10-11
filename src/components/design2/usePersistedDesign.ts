import { useEffect, useRef, useState } from 'react';
import type { Shape, Page, DesignStyle, DesignVariable, DesignMode } from './types';
import type { RulerGuide } from './rulers';
import { normalizeTokens, type DesignTokens } from './designTokens';
import { designFilePath, trackWrite, waitWrites } from './projectDoc';

export interface DocVariables {
  list: DesignVariable[];
  modes: DesignMode[];
  activeModeId: string;
}

const SAVE_DEBOUNCE_MS = 500;

const getDesignFilePath = designFilePath;

export function usePersistedDesign(
  workspacePath: string,
  shapes: Shape[],
  pages: Page[],
  selectedPageId: string,
  pageViewports: Record<string, { x: number; y: number; zoom: number }>,
  skipSave: boolean,
  styles: DesignStyle[] = [],
  variables?: DocVariables,
  guides: Record<string, RulerGuide[]> = {},
  designTokens: DesignTokens | null = null
) {
  const [loadedShapes, setLoadedShapes] = useState<Shape[] | null>(null);
  const [loadedPages, setLoadedPages] = useState<Page[] | null>(null);
  const [loadedSelectedPageId, setLoadedSelectedPageId] = useState<string | null>(null);
  const [loadedPageViewports, setLoadedPageViewports] = useState<Record<string, { x: number; y: number; zoom: number }> | null>(null);
  const [loadedStyles, setLoadedStyles] = useState<DesignStyle[] | null>(null);
  const [loadedVariables, setLoadedVariables] = useState<DocVariables | null>(null);
  const [loadedGuides, setLoadedGuides] = useState<Record<string, RulerGuide[]> | null>(null);
  const [loadedTokens, setLoadedTokens] = useState<DesignTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedPathRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadedShapes(null);
    setLoadedPages(null);
    setLoadedSelectedPageId(null);
    setLoadedPageViewports(null);
    setLoadedStyles(null);
    setLoadedVariables(null);
    setLoadedGuides(null);
    setLoadedTokens(null);

    (async () => {
      try {
        const filePath = getDesignFilePath(workspacePath);
        await waitWrites(workspacePath); // uma geração de IA pode estar gravando este projeto agora
        const result = await (window as any).electronAPI?.fs?.readFile?.(filePath);
        if (cancelled) return;
        const parsed = result?.content ? JSON.parse(result.content) : null;
        if (Array.isArray(parsed?.shapes)) {
          const normalized = parsed.shapes.map((s: Shape) => ({
            ...s,
            pageId: s.pageId || 'page-1',
          }));
          // inclusive lista vazia: se o usuário apagou tudo, é isso que deve voltar
          setLoadedShapes(normalized);
        } else {
          setLoadedShapes([]); // projeto sem design salvo: começa vazio (não herda o do projeto anterior)
        }

        if (Array.isArray(parsed?.pages) && parsed.pages.length > 0) {
          setLoadedPages(parsed.pages);
        }
        if (parsed?.selectedPageId && typeof parsed.selectedPageId === 'string') {
          setLoadedSelectedPageId(parsed.selectedPageId);
        }
        if (parsed?.guides && typeof parsed.guides === 'object') {
          setLoadedGuides(parsed.guides);
        }
        if (parsed?.variables && Array.isArray(parsed.variables.list)) {
          setLoadedVariables(parsed.variables);
        }
        if (Array.isArray(parsed?.styles)) {
          setLoadedStyles(parsed.styles);
        }
        if (parsed?.designTokens && typeof parsed.designTokens === 'object') {
          setLoadedTokens(normalizeTokens(parsed.designTokens)); // aceita o formato antigo (cor com um valor só)
        }
        if (parsed?.pageViewports && typeof parsed.pageViewports === 'object') {
          setLoadedPageViewports(parsed.pageViewports);
        }
      } catch {
        if (!cancelled) setLoadedShapes([]);
      } finally {
        if (!cancelled) {
          lastLoadedPathRef.current = workspacePath;
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  // Último salvamento ainda não gravado (o debounce pode ser interrompido por reload, troca de projeto ou fechar o app)
  const pendingRef = useRef<{ ws: string; filePath: string; payload: string } | null>(null);
  const flush = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    trackWrite(p.ws, async () => {
      const fs = (window as any).electronAPI?.fs;
      await backupBeforeSave(p.filePath, p.payload, fs);
      await fs?.writeFile?.(p.filePath, p.payload);
    }).catch(() => {});
  };

  useEffect(() => {
    if (isLoading || skipSave) return;
    if (lastLoadedPathRef.current !== workspacePath) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingRef.current = {
      ws: workspacePath,
      filePath: getDesignFilePath(workspacePath),
      payload: JSON.stringify(
        {
          shapes,
          pages,
          selectedPageId,
          pageViewports,
          styles,
          variables,
          guides,
          designTokens,
          updatedAt: Date.now(),
        },
        null,
        2
      ),
    };
    saveTimerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [shapes, pages, selectedPageId, pageViewports, styles, variables, guides, designTokens, workspacePath, isLoading, skipSave]);

  // Reload/fechar a janela: grava na hora o que ainda estava esperando o debounce
  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Trocar de projeto (ou desmontar): grava o projeto anterior antes de sair
  useEffect(() => () => flush(), [workspacePath]);

  return {
    loadedShapes,
    loadedPages,
    loadedSelectedPageId,
    loadedPageViewports,
    loadedStyles,
    loadedVariables,
    loadedGuides,
    loadedTokens,
    isLoading,
  };
}

// Backup rotativo: antes de sobrescrever, guarda o arquivo atual em `backup/design-N.json` (no máximo a cada 10 min,
// 6 vagas = 1 hora de histórico). Se o design for corrompido ou alterado sem querer, dá para recuperar.
const lastBackup = new Map<string, number>();
export async function backupBeforeSave(filePath: string, nextPayload: string, fs: any, now = Date.now()): Promise<void> {
  try {
    if (now - (lastBackup.get(filePath) ?? 0) < 10 * 60 * 1000) return;
    const cur = await fs?.readFile?.(filePath);
    if (!cur?.content || cur.content === nextPayload) return;
    lastBackup.set(filePath, now);
    const slot = Math.floor(now / (10 * 60 * 1000)) % 6;
    await fs.writeFile(filePath.replace(/[^/]+$/, `backup/design-${slot}.json`), cur.content);
  } catch {}
}
