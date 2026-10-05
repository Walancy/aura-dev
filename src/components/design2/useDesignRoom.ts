import { useCallback, useEffect, useState } from 'react';
import type { RoomInfo, RoomRole, Shape } from './types';

export interface RemoteCursor {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  at?: number;
}

export function useDesignRoom(setShapes: (s: Shape[]) => void) {
  const [role, setRole] = useState<RoomRole>('idle');
  const [hostedRoom, setHostedRoom] = useState<RoomInfo | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});

  const api = (window as any).electronAPI?.designRoom;

  useEffect(() => {
    if (!api) return;
    const offRooms = api.onRoomsUpdated((rooms: RoomInfo[]) => setAvailableRooms(rooms));
    const offState = api.onStateUpdate((incoming: Shape[]) => setShapes(incoming || []));
    const offViewers = api.onViewersChanged((count: number) => setViewerCount(count));
    const offDisconnected = api.onDisconnected(() => {
      setRole('idle');
      setRemoteCursors({});
    });
    const offPermissions = api.onPermissions?.((p: { canEdit: boolean }) => setCanEdit(p.canEdit));
    const offCursor = api.onCursor?.((c: RemoteCursor) => setRemoteCursors((prev) => ({ ...prev, [c.id]: { ...c, at: Date.now() } })));
    // cursores parados há mais de 8s somem
    const sweep = setInterval(() => setRemoteCursors((prev) => Object.fromEntries(Object.entries(prev).filter(([, c]) => Date.now() - (c.at || 0) < 8000))), 3000);
    return () => {
      offRooms();
      offState();
      offViewers();
      offDisconnected();
      offPermissions?.();
      offCursor?.();
      clearInterval(sweep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const startBrowsing = useCallback(() => {
    api?.startDiscovery();
    setIsBrowsing(true);
  }, [api]);

  const stopBrowsing = useCallback(() => {
    api?.stopDiscovery();
    setIsBrowsing(false);
    setAvailableRooms([]);
  }, [api]);

  const hostRoom = useCallback(
    async (roomName: string, currentShapes: Shape[], allowEdit = true) => {
      if (!api) return;
      const info = await api.host(roomName, allowEdit);
      setHostedRoom(info);
      setRole('hosting');
      api.broadcastState(currentShapes);
    },
    [api]
  );

  const stopHosting = useCallback(async () => {
    if (!api) return;
    await api.stopHosting();
    setHostedRoom(null);
    setRole('idle');
  }, [api]);

  const joinRoom = useCallback(
    async (room: RoomInfo) => {
      if (!api) return;
      setCanEdit(false); // até o anfitrião informar a permissão
      await api.join(room.ip, room.port);
      setRole('viewing');
      stopBrowsing();
    },
    [api, stopBrowsing]
  );

  const leaveRoom = useCallback(async () => {
    if (!api) return;
    await api.leave();
    setRole('idle');
  }, [api]);

  const broadcast = useCallback(
    (nextShapes: Shape[]) => {
      if (role === 'hosting' || (role === 'viewing' && canEdit)) api?.broadcastState(nextShapes);
    },
    [api, role, canEdit]
  );

  const sendCursor = useCallback(
    (cursor: { x: number; y: number; name: string; color: string }) => {
      if (role !== 'idle') api?.sendCursor?.(cursor);
    },
    [api, role]
  );

  return {
    role,
    hostedRoom,
    viewerCount,
    availableRooms,
    isBrowsing,
    startBrowsing,
    stopBrowsing,
    hostRoom,
    stopHosting,
    joinRoom,
    leaveRoom,
    broadcast,
    canEdit,
    remoteCursors,
    sendCursor,
  };
}
