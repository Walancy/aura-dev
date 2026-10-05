import { useEffect, useRef, useState } from 'react';
import type { Shape, Page, DesignStyle, DesignVariable, DesignMode } from './types';
import type { RulerGuide } from './rulers';

export interface DocVariables {
  list: DesignVariable[];
  modes: DesignMode[];
  activeModeId: string;
}

const SAVE_DEBOUNCE_MS = 500;

function getDesignFilePath(workspacePath: string): string {
  return `${workspacePath}/.devflow/design2/design.json`;
}

export function usePersistedDesign(
  workspacePath: string,
  shapes: Shape[],
  pages: Page[],
  selectedPageId: string,
  pageViewports: Record<string, { x: number; y: number; zoom: number }>,
  skipSave: boolean,
  styles: DesignStyle[] = [],
  variables?: DocVariables,
  guides: Record<string, RulerGuide[]> = {}
) {
  const [loadedShapes, setLoadedShapes] = useState<Shape[] | null>(null);
  const [loadedPages, setLoadedPages] = useState<Page[] | null>(null);
  const [loadedSelectedPageId, setLoadedSelectedPageId] = useState<string | null>(null);
  const [loadedPageViewports, setLoadedPageViewports] = useState<Record<string, { x: number; y: number; zoom: number }> | null>(null);
  const [loadedStyles, setLoadedStyles] = useState<DesignStyle[] | null>(null);
  const [loadedVariables, setLoadedVariables] = useState<DocVariables | null>(null);
  const [loadedGuides, setLoadedGuides] = useState<Record<string, RulerGuide[]> | null>(null);
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

    (async () => {
      try {
        const filePath = getDesignFilePath(workspacePath);
        const result = await (window as any).electronAPI?.fs?.readFile?.(filePath);
        if (cancelled) return;
        const parsed = result?.content ? JSON.parse(result.content) : null;
        if (Array.isArray(parsed?.shapes)) {
          const normalized = parsed.shapes.map((s: Shape) => ({
            ...s,
            pageId: s.pageId || 'page-1',
          }));
          setLoadedShapes(normalized);
        } else {
          setLoadedShapes([]);
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

  useEffect(() => {
    if (isLoading || skipSave) return;
    if (lastLoadedPathRef.current !== workspacePath) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const filePath = getDesignFilePath(workspacePath);
      const payload = JSON.stringify(
        {
          shapes,
          pages,
          selectedPageId,
          pageViewports,
          styles,
          variables,
          guides,
          updatedAt: Date.now(),
        },
        null,
        2
      );
      (window as any).electronAPI?.fs?.writeFile?.(filePath, payload).catch(() => {});
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [shapes, pages, selectedPageId, pageViewports, styles, variables, guides, workspacePath, isLoading, skipSave]);

  return {
    loadedShapes,
    loadedPages,
    loadedSelectedPageId,
    loadedPageViewports,
    loadedStyles,
    loadedVariables,
    loadedGuides,
    isLoading,
  };
}
