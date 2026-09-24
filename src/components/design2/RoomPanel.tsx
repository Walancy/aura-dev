import React, { useState } from 'react';
import { Radio, Users, Wifi, X } from 'lucide-react';
import type { RoomInfo, RoomRole } from './types';

interface RoomPanelProps {
  role: RoomRole;
  hostedRoom: RoomInfo | null;
  viewerCount: number;
  availableRooms: RoomInfo[];
  isBrowsing: boolean;
  accentColor: string;
  themeTokens: { textPrimary: string; textSecondary: string; bgCard: string; bgCardSecondary: string; border: string; hoverBg: string };
  onHost: (name: string) => void;
  onStopHosting: () => void;
  onStartBrowsing: () => void;
  onStopBrowsing: () => void;
  onJoin: (room: RoomInfo) => void;
  onLeave: () => void;
}

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  fontFamily: 'Poppins',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default function RoomPanel({
  role,
  hostedRoom,
  viewerCount,
  availableRooms,
  isBrowsing,
  accentColor,
  themeTokens,
  onHost,
  onStopHosting,
  onStartBrowsing,
  onStopBrowsing,
  onJoin,
  onLeave,
}: RoomPanelProps) {
  const [showHostForm, setShowHostForm] = useState(false);
  const [roomName, setRoomName] = useState('Minha sala de design');

  if (role === 'hosting' && hostedRoom) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
          <Radio size={13} />
          {hostedRoom.name}
        </div>
        <div style={{ fontSize: 11, color: themeTokens.textSecondary, fontFamily: 'Poppins' }}>
          {hostedRoom.ip}:{hostedRoom.port}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: themeTokens.textSecondary }}>
          <Users size={12} /> {viewerCount}
        </div>
        <button onClick={onStopHosting} style={{ ...btnBase, background: themeTokens.bgCardSecondary, color: themeTokens.textPrimary }}>
          <X size={12} /> Parar sala
        </button>
      </div>
    );
  }

  if (role === 'viewing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
          <Wifi size={13} />
          Visualizando ao vivo
        </div>
        <button onClick={onLeave} style={{ ...btnBase, background: themeTokens.bgCardSecondary, color: themeTokens.textPrimary }}>
          <X size={12} /> Sair da sala
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {!showHostForm ? (
        <button
          onClick={() => setShowHostForm(true)}
          style={{ ...btnBase, background: accentColor, color: '#fff' }}
        >
          <Radio size={12} /> Criar sala
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            autoFocus
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && roomName.trim()) {
                onHost(roomName.trim());
                setShowHostForm(false);
              }
            }}
            style={{
              fontSize: 12,
              fontFamily: 'Poppins',
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: themeTokens.bgCardSecondary,
              color: themeTokens.textPrimary,
              width: 180,
            }}
          />
          <button
            onClick={() => {
              if (roomName.trim()) {
                onHost(roomName.trim());
                setShowHostForm(false);
              }
            }}
            style={{ ...btnBase, background: accentColor, color: '#fff' }}
          >
            Iniciar
          </button>
        </div>
      )}

      <button
        onClick={() => (isBrowsing ? onStopBrowsing() : onStartBrowsing())}
        style={{ ...btnBase, background: isBrowsing ? accentColor + '22' : themeTokens.bgCardSecondary, color: isBrowsing ? accentColor : themeTokens.textPrimary }}
      >
        <Wifi size={12} /> {isBrowsing ? 'Buscando na rede…' : 'Entrar em sala'}
      </button>

      {isBrowsing && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            minWidth: 260,
            maxHeight: 220,
            overflowY: 'auto',
            background: themeTokens.bgCard,
            border: '1px solid ' + themeTokens.border,
            borderRadius: 10,
            padding: 5,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {availableRooms.length === 0 && (
            <div style={{ fontSize: 12, color: themeTokens.textSecondary, padding: 8, fontFamily: 'Poppins' }}>
              Nenhuma sala encontrada na rede ainda…
            </div>
          )}
          {availableRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => onJoin(room)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 12, fontFamily: 'Poppins', fontWeight: 500, color: themeTokens.textPrimary }}>{room.name}</span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                {room.host} · {room.ip}:{room.port}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
