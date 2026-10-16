const KEY = 'design_unsplash_key';
export const getUnsplashKey = (): string => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};
export const setUnsplashKey = (v: string) => {
  try { v.trim() ? localStorage.setItem(KEY, v.trim()) : localStorage.removeItem(KEY); } catch {}
};

const PEXELS = 'design_pexels_key';
export const getPexelsKey = (): string => {
  try { return localStorage.getItem(PEXELS) || ''; } catch { return ''; }
};
export const setPexelsKey = (v: string) => {
  try { v.trim() ? localStorage.setItem(PEXELS, v.trim()) : localStorage.removeItem(PEXELS); } catch {}
};

/** A consulta (em inglês) descreve uma pessoa? Avatares, retratos, equipe, clientes, profissionais. */
export function isPersonQuery(q: string): boolean {
  return /\b(person|people|man|men|woman|women|boy|girl|kid|child|children|baby|toddler|teen|teenager|adult|senior|elderly|lady|guy|male|female|portrait|headshot|selfie|face|faces|avatar|profile|model|couple|family|friends|team|crowd|customer|client|user|patient|doctor|nurse|dentist|teacher|student|professor|athlete|runner|dancer|musician|singer|artist|designer|developer|engineer|manager|ceo|founder|entrepreneur|businessman|businesswoman|stylist|hairdresser|barber|chef|cook|waiter|driver|farmer|worker|trainer|coach|therapist|esthetician|beautician|makeup artist|influencer|creator|youtuber|podcaster)\b/i.test(q);
}

const used = new Map<string, number>();
/** Foto como data URL (Unsplash com chave; picsum sem chave). Consultas repetidas variam o resultado (rostos/fotos diferentes). */
export async function fetchStockImage(query: string, width: number, height: number, opts: { person?: boolean } = {}): Promise<{ dataUrl: string; credit?: string } | null> {
  const api = (window as any).electronAPI?.fs;
  if (!api?.stockImage) return null;
  const n = used.get(query) || 0;
  used.set(query, n + 1);
  const people = opts.person ?? isPersonQuery(query);
  const r = await api.stockImage({ query, width, height, key: getUnsplashKey() || undefined, index: n, people, pexelsKey: people ? getPexelsKey() || undefined : undefined });
  return r?.dataUrl ? { dataUrl: r.dataUrl, credit: r.source === 'unsplash' || r.source === 'pexels' ? r.credit : undefined } : null;
}
