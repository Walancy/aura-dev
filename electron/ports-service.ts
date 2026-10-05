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
              if (port === 3000 || port === 3001 || port === 3010) service = 'Backend API (NestJS/Node)';
              else if (port === 3333) service = 'API Server (Adonis/Fastify)';
              else if (port === 4000 || port === 4001) service = 'GraphQL / Node API';
              else if (port === 5000) service = 'AirPlay / Python API';
              else if (port === 5173) service = 'Vite Frontend';
              else if (port === 5174) service = 'Vite Admin';
              else if (port === 5175 || port === 5176 || port === 5180 || port === 5185) service = 'Vite Dev Server';
              else if (port === 5432 || port === 5433) service = 'PostgreSQL';
              else if (port === 6379) service = 'Redis Server';
              else if (port === 7000) service = 'Control Center (AirPlay)';
              else if (port === 8000 || port === 8080 || port === 8888) service = 'Web Application Server';
              else if (port === 9000 || port === 9001) service = 'MinIO / Storage Service';
              else if (port === 27017) service = 'MongoDB';
              else if (command.toLowerCase().includes('docke')) service = `${command} (Docker)`;
              else if (command === 'node') service = 'Node.js Service';
              else if (command === 'bun') service = 'Bun Service';
              else if (command.startsWith('python')) service = 'Python Server';

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

  async kill(pid: string | number): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!pid) {
        resolve({ success: false, error: 'PID invalido' });
        return;
      }
      exec(`kill -9 ${pid}`, (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}
