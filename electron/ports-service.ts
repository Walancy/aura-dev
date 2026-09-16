import { exec } from 'node:child_process';

export interface OpenPort {
  port: number;
  protocol: string;
  command: string;
  pid: string;
  user: string;
  url: string;
  status: 'online' | 'unreachable';
  serviceName?: string;
}

export class NativePortsService {
  async scan(): Promise<OpenPort[]> {
    return new Promise((resolve) => {
      exec('lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null', (err, stdout) => {
        if (err || !stdout) {
          resolve([]);
          return;
        }

        const lines = stdout.trim().split('\n');
        const portMap = new Map<number, OpenPort>();

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length < 9) continue;

          const command = parts[0];
          const pid = parts[1];
          const user = parts[2];
          const name = parts[8];

          const match = name.match(/:(\d+)$/);
          if (match) {
            const port = parseInt(match[1], 10);
            if (!portMap.has(port)) {
              let service = command;
              if (port === 3000 || port === 3010) service = 'Backend API (NestJS)';
              else if (port === 5173) service = 'Wireframe (Vite)';
              else if (port === 5174) service = 'Admin Web (Vite)';
              else if (port === 5180) service = 'Project Hub Web';
              else if (port === 5432) service = 'PostgreSQL';

              portMap.set(port, {
                port,
                protocol: 'HTTP/TCP',
                command,
                pid,
                user,
                url: `http://localhost:${port}`,
                status: 'online',
                serviceName: service,
              });
            }
          }
        }

        resolve(Array.from(portMap.values()).sort((a, b) => a.port - b.port));
      });
    });
  }
}
