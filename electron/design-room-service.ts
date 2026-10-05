import { BrowserWindow } from 'electron';
import * as dgram from 'node:dgram';
import * as http from 'node:http';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const DISCOVERY_PORT = 41234;
const BROADCAST_INTERVAL_MS = 2000;
const ROOM_TTL_MS = 6000;
const MAGIC = 'devflow-design-room';

export interface DesignRoomInfo {
  id: string;
  name: string;
  host: string;
  ip: string;
  port: number;
  updatedAt: number;
}

function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

export class DesignRoomService {
  private mainWindow: BrowserWindow | null = null;

  // hosting state
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private viewers: Set<WebSocket> = new Set();
  private broadcastSocket: dgram.Socket | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private roomId: string | null = null;
  private roomName = '';
  private hostPort = 0;
  private lastShapes: unknown[] = [];
  private canEdit = true;
  private hostName = os.userInfo().username;

  // discovery state
  private discoverySocket: dgram.Socket | null = null;
  private discoveredRooms: Map<string, DesignRoomInfo> = new Map();
  private discoveryCleanupTimer: ReturnType<typeof setInterval> | null = null;

  // viewer (client) state
  private clientWs: WebSocket | null = null;
  private clientCanEdit = false;
  private clientId = '';

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private send(channel: string, payload: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  async hostRoom(roomName: string, canEdit = true): Promise<DesignRoomInfo> {
    this.stopHosting();
    this.roomId = crypto.randomUUID();
    this.roomName = roomName;
    this.canEdit = canEdit;

    this.httpServer = http.createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => {
      this.viewers.add(ws);
      const clientId = crypto.randomUUID().slice(0, 8);
      this.send('design-room:viewers-changed', this.viewers.size);
      ws.send(JSON.stringify({ type: 'room-info', clientId, canEdit: this.canEdit, hostName: this.hostName }));
      ws.send(JSON.stringify({ type: 'full-state', shapes: this.lastShapes }));
      // Mensagens do participante: edição (se permitida) e cursor, repassadas ao anfitrião e aos demais
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg?.type === 'state' && this.canEdit && Array.isArray(msg.shapes)) {
            this.lastShapes = msg.shapes;
            this.send('design-room:state-update', msg.shapes);
            this.fanOut({ type: 'state-update', shapes: msg.shapes }, ws);
          } else if (msg?.type === 'cursor') {
            const cursor = { ...msg.cursor, id: clientId };
            this.send('design-room:cursor', cursor);
            this.fanOut({ type: 'cursor', cursor }, ws);
          }
        } catch {}
      });
      ws.on('close', () => {
        this.viewers.delete(ws);
        this.send('design-room:viewers-changed', this.viewers.size);
      });
      ws.on('error', () => {
        this.viewers.delete(ws);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(0, '0.0.0.0', () => resolve());
    });
    this.hostPort = (this.httpServer.address() as any).port;

    this.broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    await new Promise<void>((resolve) => {
      this.broadcastSocket!.bind(() => {
        this.broadcastSocket!.setBroadcast(true);
        resolve();
      });
    });

    const announce = () => {
      const payload = Buffer.from(
        JSON.stringify({
          type: MAGIC,
          id: this.roomId,
          name: this.roomName,
          host: os.userInfo().username,
          ip: getLocalIp(),
          port: this.hostPort,
        })
      );
      this.broadcastSocket?.send(payload, 0, payload.length, DISCOVERY_PORT, '255.255.255.255');
    };
    announce();
    this.broadcastTimer = setInterval(announce, BROADCAST_INTERVAL_MS);

    return {
      id: this.roomId,
      name: this.roomName,
      host: os.userInfo().username,
      ip: getLocalIp(),
      port: this.hostPort,
      updatedAt: Date.now(),
    };
  }

  private fanOut(message: unknown, except?: WebSocket) {
    const payload = JSON.stringify(message);
    for (const ws of this.viewers) {
      if (ws !== except && ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  /** Anfitrião: envia o estado a todos. Participante com permissão: envia a edição ao anfitrião. */
  broadcastState(shapes: unknown[]) {
    if (this.clientWs) {
      if (this.clientCanEdit && this.clientWs.readyState === this.clientWs.OPEN) this.clientWs.send(JSON.stringify({ type: 'state', shapes }));
      return;
    }
    this.lastShapes = shapes;
    if (!this.viewers.size) return;
    this.fanOut({ type: 'state-update', shapes });
  }

  /** Posição do ponteiro (coordenadas do canvas) para os outros verem. */
  sendCursor(cursor: { x: number; y: number; name: string; color: string }) {
    if (this.clientWs) {
      if (this.clientWs.readyState === this.clientWs.OPEN) this.clientWs.send(JSON.stringify({ type: 'cursor', cursor }));
      return;
    }
    if (this.viewers.size) this.fanOut({ type: 'cursor', cursor: { ...cursor, id: 'host' } });
  }

  stopHosting() {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    this.broadcastTimer = null;
    try {
      this.broadcastSocket?.close();
    } catch {}
    this.broadcastSocket = null;
    for (const ws of this.viewers) {
      try {
        ws.close();
      } catch {}
    }
    this.viewers.clear();
    try {
      this.wss?.close();
    } catch {}
    this.wss = null;
    try {
      this.httpServer?.close();
    } catch {}
    this.httpServer = null;
    this.roomId = null;
    this.lastShapes = [];
  }

  startDiscovery() {
    if (this.discoverySocket) return;
    this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.discoverySocket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data?.type !== MAGIC) return;
        this.discoveredRooms.set(data.id, {
          id: data.id,
          name: data.name,
          host: data.host,
          ip: data.ip,
          port: data.port,
          updatedAt: Date.now(),
        });
        this.send('design-room:rooms-updated', Array.from(this.discoveredRooms.values()));
      } catch {}
    });
    this.discoverySocket.on('error', () => {});
    this.discoverySocket.bind(DISCOVERY_PORT, () => {
      try {
        this.discoverySocket?.setBroadcast(true);
      } catch {}
    });

    this.discoveryCleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, room] of this.discoveredRooms) {
        if (now - room.updatedAt > ROOM_TTL_MS) {
          this.discoveredRooms.delete(id);
          changed = true;
        }
      }
      if (changed) this.send('design-room:rooms-updated', Array.from(this.discoveredRooms.values()));
    }, 2000);
  }

  stopDiscovery() {
    if (this.discoveryCleanupTimer) clearInterval(this.discoveryCleanupTimer);
    this.discoveryCleanupTimer = null;
    try {
      this.discoverySocket?.close();
    } catch {}
    this.discoverySocket = null;
    this.discoveredRooms.clear();
  }

  joinRoom(ip: string, port: number) {
    this.leaveRoom();
    this.clientWs = new WebSocket(`ws://${ip}:${port}`);
    this.clientWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg?.type === 'room-info') {
          this.clientCanEdit = Boolean(msg.canEdit);
          this.clientId = msg.clientId || '';
          this.send('design-room:permissions', { canEdit: this.clientCanEdit, hostName: msg.hostName || '' });
        } else if (msg?.type === 'full-state' || msg?.type === 'state-update') {
          this.send('design-room:state-update', msg.shapes);
        } else if (msg?.type === 'cursor') {
          this.send('design-room:cursor', msg.cursor);
        }
      } catch {}
    });
    this.clientWs.on('close', () => this.send('design-room:disconnected', null));
    this.clientWs.on('error', () => this.send('design-room:disconnected', null));
  }

  leaveRoom() {
    if (this.clientWs) {
      try {
        this.clientWs.removeAllListeners();
        this.clientWs.close();
      } catch {}
    }
    this.clientWs = null;
    this.clientCanEdit = false;
  }

  dispose() {
    this.stopHosting();
    this.stopDiscovery();
    this.leaveRoom();
  }
}
