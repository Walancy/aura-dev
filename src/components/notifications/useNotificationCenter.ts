import { useCallback, useEffect, useMemo, useState } from 'react';
import { addNotification, clearRead, loadNotifications, markAllRead, markRead, removeNotification, saveNotifications, unreadCount, STORAGE_KEY, type CenterNotification } from './notificationStore';

/** Centro de notificações: lista persistida no armazenamento local (notificações novas + histórico das lidas). */
export function useNotificationCenter() {
  const [items, setItems] = useState<CenterNotification[]>(() => loadNotifications());

  useEffect(() => {
    saveNotifications(items);
  }, [items]);

  // outra janela/aba alterou o armazenamento
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(loadNotifications());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((input: Parameters<typeof addNotification>[1]) => setItems((l) => addNotification(l, input)), []);
  const read = useCallback((id: string) => setItems((l) => markRead(l, id)), []);
  const readAll = useCallback(() => setItems((l) => markAllRead(l)), []);
  const remove = useCallback((id: string) => setItems((l) => removeNotification(l, id)), []);
  const clearHistory = useCallback(() => setItems((l) => clearRead(l)), []);
  const unread = useMemo(() => unreadCount(items), [items]);

  return { items, unread, add, read, readAll, remove, clearHistory };
}
