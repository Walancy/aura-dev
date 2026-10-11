export type NotificationKind = 'ai' | 'design' | 'info' | 'error';

export interface CenterNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  projectPath?: string;
  projectName?: string;
  provider?: string;
  /** de onde veio: usado para abrir o lugar certo ao clicar */
  source?: 'ide' | 'cli' | 'design';
  timestamp: number;
  read: boolean;
}

export const STORAGE_KEY = 'devflow_notification_center_v1';
export const MAX_NOTIFICATIONS = 300;

export function loadNotifications(storage: Pick<Storage, 'getItem'> = localStorage): CenterNotification[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((n) => n && typeof n.id === 'string' && typeof n.title === 'string').slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(list: CenterNotification[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // armazenamento cheio/indisponível: o centro continua funcionando em memória
  }
}

/** Adiciona no topo (mais recente primeiro); ignora repetição idêntica em menos de 1,5 s. */
export function addNotification(list: CenterNotification[], input: Omit<CenterNotification, 'id' | 'timestamp' | 'read'> & { read?: boolean }, now = Date.now()): CenterNotification[] {
  const dup = list.find((n) => n.title === input.title && (n.body || '') === (input.body || '') && now - n.timestamp < 1500);
  if (dup) return list;
  const item: CenterNotification = { ...input, read: input.read ?? false, id: `n_${now}_${Math.random().toString(36).slice(2, 8)}`, timestamp: now };
  return [item, ...list].slice(0, MAX_NOTIFICATIONS);
}

export const markRead = (list: CenterNotification[], id: string) => list.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n));
export const markAllRead = (list: CenterNotification[]) => list.map((n) => (n.read ? n : { ...n, read: true }));
export const removeNotification = (list: CenterNotification[], id: string) => list.filter((n) => n.id !== id);
export const clearRead = (list: CenterNotification[]) => list.filter((n) => !n.read);
export const unreadCount = (list: CenterNotification[]) => list.reduce((c, n) => c + (n.read ? 0 : 1), 0);

/** "agora", "há 5 min", "há 2 h", "ontem", "12 de out." */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
