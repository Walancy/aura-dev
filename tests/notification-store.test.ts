import { test, expect } from 'bun:test';
import { addNotification, clearRead, loadNotifications, markAllRead, markRead, MAX_NOTIFICATIONS, removeNotification, saveNotifications, STORAGE_KEY, timeAgo, unreadCount, type CenterNotification } from '../src/components/notifications/notificationStore';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test('adiciona no topo, ignora duplicata imediata e conta não lidas', () => {
  let l: CenterNotification[] = [];
  l = addNotification(l, { kind: 'ai', title: 'A', body: 'x' }, 1000);
  l = addNotification(l, { kind: 'ai', title: 'A', body: 'x' }, 1500); // duplicata < 1,5 s
  l = addNotification(l, { kind: 'info', title: 'B', read: true }, 5000);
  expect(l.map((n) => n.title)).toEqual(['B', 'A']);
  expect(unreadCount(l)).toBe(1);
});

test('ler, ler tudo, remover e limpar histórico (só as lidas)', () => {
  let l: CenterNotification[] = [];
  l = addNotification(l, { kind: 'ai', title: '1' }, 1000);
  l = addNotification(l, { kind: 'ai', title: '2' }, 2000);
  l = addNotification(l, { kind: 'error', title: '3' }, 3000);
  l = markRead(l, l[0].id);
  expect(unreadCount(l)).toBe(2);
  expect(clearRead(l).map((n) => n.title)).toEqual(['2', '1']); // '3' estava lida e sai do histórico
  l = markAllRead(l);
  expect(unreadCount(l)).toBe(0);
  expect(clearRead(l)).toHaveLength(0); // tudo lido = histórico apagado
  expect(removeNotification(l, l[0].id)).toHaveLength(2);
});

test('persiste no armazenamento local e recarrega; dados inválidos são ignorados', () => {
  const st = mem();
  let l: CenterNotification[] = [];
  l = addNotification(l, { kind: 'design', title: 'Tela gerada', projectPath: '/p', source: 'design' }, 1000);
  saveNotifications(l, st);
  expect(loadNotifications(st)).toEqual(l);
  st.setItem(STORAGE_KEY, '{lixo');
  expect(loadNotifications(st)).toEqual([]);
  st.setItem(STORAGE_KEY, JSON.stringify([{ id: 1 }, { id: 'ok', title: 't', kind: 'info', read: false, timestamp: 1 }]));
  expect(loadNotifications(st).map((n) => n.id)).toEqual(['ok']);
});

test('limita o tamanho do histórico', () => {
  let l: CenterNotification[] = [];
  for (let i = 0; i < MAX_NOTIFICATIONS + 20; i++) l = addNotification(l, { kind: 'info', title: `n${i}` }, i * 10000);
  expect(l).toHaveLength(MAX_NOTIFICATIONS);
  expect(l[0].title).toBe(`n${MAX_NOTIFICATIONS + 19}`);
});

test('tempo relativo', () => {
  const now = 10_000_000_000;
  expect(timeAgo(now - 10_000, now)).toBe('agora');
  expect(timeAgo(now - 5 * 60_000, now)).toBe('há 5 min');
  expect(timeAgo(now - 3 * 3_600_000, now)).toBe('há 3 h');
  expect(timeAgo(now - 30 * 3_600_000, now)).toBe('ontem');
  expect(timeAgo(now - 3 * 86_400_000, now)).toBe('há 3 dias');
});
