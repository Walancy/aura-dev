export const SHARED_SIDEBAR_WIDTH_KEY = 'sprint_sidebar_width';

/** Largura da div esquerda das tabs de projeto, compartilhada com a lista de Sprints. */
export function readSharedSidebarWidth(): number {
  try {
    const v = parseInt(localStorage.getItem(SHARED_SIDEBAR_WIDTH_KEY) || '', 10);
    if (Number.isFinite(v) && v >= 160 && v <= 600) return v;
  } catch {}
  return 240;
}
