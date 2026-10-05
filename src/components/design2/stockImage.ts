const KEY = 'design_unsplash_key';
export const getUnsplashKey = (): string => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};
export const setUnsplashKey = (v: string) => {
  try { v.trim() ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY); } catch {}
};

const used = new Map<string, number>();
/** Foto como data URL (Unsplash com chave; picsum sem chave). Consultas repetidas variam o resultado (rostos/fotos diferentes). */
export async function fetchStockImage(query: string, width: number, height: number): Promise<{ dataUrl: string; credit?: string } | null> {
  const api = (window as any).electronAPI?.fs;
  if (!api?.stockImage) return null;
  const n = used.get(query) || 0;
  used.set(query, n + 1);
  const r = await api.stockImage({ query, width, height, key: getUnsplashKey() || undefined, index: n });
  return r?.dataUrl ? { dataUrl: r.dataUrl, credit: r.source === 'unsplash' ? r.credit : undefined } : null;
}
