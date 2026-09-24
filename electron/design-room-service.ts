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

  // discovery state
  private discoverySocket: dgram.Socket | null = null;
  private discoveredRooms: Map<string, DesignRoomInfo> = new Map();
  private discoveryCleanupTimer: ReturnType<typeof setInterval> | null = null;

  // viewer (client) state
  private clientWs: WebSocket | null = null;

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private send(channel: string, payload: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  async hostRoom(roomName: string): Promise<DesignRoomInfo> {
    this.stopHosting();
    this.roomId = crypto.randomUUID();
    this.roomName = roomName;

    this.httpServer = http.createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => {
      this.viewers.add(ws);
      this.send('design-room:viewers-changed', this.viewers.size);
      ws.send(JSON.stringify({ type: 'full-state', shapes: this.lastShapes }));
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

  broadcastState(shapes: unknown[]) {
    this.lastShapes = shapes;
    if (!this.viewers.size) return;
    const payload = JSON.stringify({ type: 'state-update', shapes });
    for (const ws of this.viewers) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
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
        if (msg?.type === 'full-state' || msg?.type === 'state-update') {
          this.send('design-room:state-update', msg.shapes);
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
  }

  dispose() {
    this.stopHosting();
    this.stopDiscovery();
    this.leaveRoom();
  }
}
