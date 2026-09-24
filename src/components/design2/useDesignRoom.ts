import { useCallback, useEffect, useState } from 'react';
import type { RoomInfo, RoomRole, Shape } from './types';

export function useDesignRoom(setShapes: (s: Shape[]) => void) {
  const [role, setRole] = useState<RoomRole>('idle');
  const [hostedRoom, setHostedRoom] = useState<RoomInfo | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [availableRooms, setAvailableRooms] = useState<RoomInfo[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);

  const api = (window as any).electronAPI?.designRoom;

  useEffect(() => {
    if (!api) return;
    const offRooms = api.onRoomsUpdated((rooms: RoomInfo[]) => setAvailableRooms(rooms));
    const offState = api.onStateUpdate((incoming: Shape[]) => setShapes(incoming || []));
    const offViewers = api.onViewersChanged((count: number) => setViewerCount(count));
    const offDisconnected = api.onDisconnected(() => setRole('idle'));
    return () => {
      offRooms();
      offState();
      offViewers();
      offDisconnected();
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
    async (roomName: string, currentShapes: Shape[]) => {
      if (!api) return;
      const info = await api.host(roomName);
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
      if (role === 'hosting') api?.broadcastState(nextShapes);
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
  };
}
