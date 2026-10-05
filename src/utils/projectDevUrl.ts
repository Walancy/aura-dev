/**
 * Project Dev URL & Port Resolution Utility
 * Ensures that each project node on the Orchestration Canvas has a unique dev URL,
 * detecting configured ports from project files (vite.config, package.json, .env)
 * and preventing port collisions between multiple projects.
 */

export interface PortExtractionOptions {
  fallbackBasePort?: number;
}

/**
 * Extracts a port number from file content (vite.config, package.json, .env, etc.)
 */
export function extractPortFromContent(content: string, filename = ''): number | null {
  if (!content || typeof content !== 'string') return null;

  // 1. .env files: PORT=3000, VITE_PORT=5174, NEXT_PUBLIC_PORT=3000, etc.
  const envMatch = content.match(/^(?:PORT|VITE_PORT|NEXT_PUBLIC_PORT|DEV_PORT|APP_PORT|SERVER_PORT)\s*=\s*['"]?(\d+)['"]?/m);
  if (envMatch) {
    const port = parseInt(envMatch[1], 10);
    if (isValidPort(port)) return port;
  }

  // 2. vite.config / webpack: server: { port: 5185 } or preview: { port: 4173 }
  const serverPortMatch = content.match(/(?:server|preview|devServer)\s*:\s*\{[^}]*?\bport\s*:\s*(\d+)/s);
  if (serverPortMatch) {
    const port = parseInt(serverPortMatch[1], 10);
    if (isValidPort(port)) return port;
  }

  // 3. package.json scripts: --port 5174, -p 3000, PORT=3333
  const scriptPortMatch =
    content.match(/(?:--port|-p)\s+['"]?(\d+)['"]?/i) ||
    content.match(/\bPORT=(\d+)/i) ||
    content.match(/localhost:(\d{4,5})/i);
  if (scriptPortMatch) {
    const port = parseInt(scriptPortMatch[1], 10);
    if (isValidPort(port)) return port;
  }

  // 4. angular.json: "port": 4200
  if (filename.includes('angular')) {
    const angMatch = content.match(/"port"\s*:\s*(\d+)/);
    if (angMatch) {
      const port = parseInt(angMatch[1], 10);
      if (isValidPort(port)) return port;
    }
  }

  // 5. General config: port: 1234
  if (
    filename.includes('vite') ||
    filename.includes('webpack') ||
    filename.includes('nuxt') ||
    filename.includes('astro') ||
    filename.includes('config')
  ) {
    const generalPortMatch = content.match(/\bport\s*:\s*(\d+)/i);
    if (generalPortMatch) {
      const port = parseInt(generalPortMatch[1], 10);
      if (isValidPort(port)) return port;
    }
  }

  return null;
}

/**
 * Validates whether a number is a usable TCP port
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 80 && port <= 65535;
}

/**
 * Extracts a port number from a URL string like 'http://localhost:5173'
 */
export function extractPortFromUrl(url?: string | null): number | null {
  if (!url) return null;
  const match = url.match(/:(\d+)/);
  if (match) {
    const port = parseInt(match[1], 10);
    if (isValidPort(port)) return port;
  }
  return null;
}

/**
 * Normalizes a URL to standard http://localhost:{port} format if it is a localhost URL
 */
export function normalizeDevUrl(url?: string | null, fallbackPort = 5173): string {
  if (!url || !url.trim()) return `http://localhost:${fallbackPort}`;
  const trimmed = url.trim();
  const port = extractPortFromUrl(trimmed);
  if (port) {
    // If it's a localhost / 127.0.0.1 url, return clean standard format
    if (/^(http:\/\/)?(localhost|127\.0\.0\.1)/i.test(trimmed)) {
      return `http://localhost:${port}`;
    }
  }
  return trimmed;
}

/**
 * Allocates a unique dev URL ensuring no collisions with existingUrls.
 *
 * Rules:
 * 1. If preferredPort is provided and NOT used, uses http://localhost:${preferredPort}.
 * 2. If preferredPort is used, increments sequentially (preferredPort + 1, + 2...) until an unused port is found.
 * 3. If preferredPort is not provided, starts checking from fallbackBasePort (default 5173).
 */
/**
 * Scans the local system for ports currently listening (via Electron ports API).
 */
export async function scanSystemOccupiedPorts(): Promise<number[]> {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.ports?.scan) {
      const res = await (window as any).electronAPI.ports.scan();
      if (res && Array.isArray(res.ports)) {
        return res.ports
          .map((p: any) => p.port)
          .filter((p: any) => typeof p === 'number' && isValidPort(p));
      }
    }
  } catch {}
  return [];
}

/**
 * Allocates a unique dev URL ensuring no collisions with existingUrls or active system ports.
 *
 * Rules:
 * 1. If preferredPort is provided and NOT used, uses http://localhost:${preferredPort}.
 * 2. If preferredPort is used, increments sequentially (preferredPort + 1, + 2...) until an unused port is found.
 * 3. If preferredPort is not provided, starts checking from fallbackBasePort (default 5173).
 */
export function allocateUniqueDevUrl(
  existingUrls: (string | undefined | null)[],
  preferredPort?: number | null,
  fallbackBasePort = 5173,
  systemPorts: number[] = []
): string {
  const usedPorts = new Set<number>();
  existingUrls.forEach((u) => {
    const p = extractPortFromUrl(u);
    if (p) usedPorts.add(p);
  });
  systemPorts.forEach((p) => {
    if (isValidPort(p)) usedPorts.add(p);
  });

  if (preferredPort && isValidPort(preferredPort)) {
    if (!usedPorts.has(preferredPort)) {
      return `http://localhost:${preferredPort}`;
    }
    // Preferred port is already used, find next available port starting from preferredPort + 1
    let port = preferredPort + 1;
    while (usedPorts.has(port)) {
      port++;
    }
    return `http://localhost:${port}`;
  }

  // Fallback to searching from fallbackBasePort
  let port = fallbackBasePort;
  while (usedPorts.has(port)) {
    port++;
  }
  return `http://localhost:${port}`;
}

/**
 * Detects the port of a local project by inspecting its configuration files.
 */
export async function detectProjectPort(projectPath?: string): Promise<number | null> {
  if (!projectPath || typeof window === 'undefined' || !window.electronAPI?.fs?.readFile) {
    return null;
  }

  const cleanPath = projectPath.replace(/\/+$/, '');
  const candidateFiles = [
    // 1. Vite configs (highest priority for modern frontends)
    `${cleanPath}/vite.config.ts`,
    `${cleanPath}/vite.config.js`,
    `${cleanPath}/vite.config.mjs`,
    // 2. Package.json
    `${cleanPath}/package.json`,
    // 3. Environment files
    `${cleanPath}/.env`,
    `${cleanPath}/.env.local`,
    `${cleanPath}/.env.development`,
    // 4. Other frameworks
    `${cleanPath}/angular.json`,
    `${cleanPath}/astro.config.mjs`,
    `${cleanPath}/nuxt.config.ts`,
    // 5. Common monorepo / subproject locations (Turborepo, Nx, pnpm workspaces)
    `${cleanPath}/apps/client/vite.config.ts`,
    `${cleanPath}/apps/client/vite.config.js`,
    `${cleanPath}/apps/client/package.json`,
    `${cleanPath}/apps/web/vite.config.ts`,
    `${cleanPath}/apps/web/vite.config.js`,
    `${cleanPath}/apps/web/package.json`,
    `${cleanPath}/apps/frontend/vite.config.ts`,
    `${cleanPath}/apps/frontend/package.json`,
    `${cleanPath}/apps/admin/vite.config.ts`,
    `${cleanPath}/apps/admin/vite.config.js`,
    `${cleanPath}/apps/admin/package.json`,
    `${cleanPath}/apps/wireframe/vite.config.ts`,
    `${cleanPath}/apps/wireframe/package.json`,
    `${cleanPath}/apps/app/vite.config.ts`,
    `${cleanPath}/apps/app/package.json`,
    `${cleanPath}/EB360_Comercial/vite.config.ts`,
    `${cleanPath}/EB360_Comercial/package.json`,
    `${cleanPath}/frontend/vite.config.ts`,
    `${cleanPath}/frontend/package.json`,
    `${cleanPath}/client/vite.config.ts`,
    `${cleanPath}/client/package.json`,
    `${cleanPath}/web/vite.config.ts`,
    `${cleanPath}/web/package.json`,
    `${cleanPath}/api/.env`,
  ];

  for (const filePath of candidateFiles) {
    try {
      const res = await window.electronAPI.fs.readFile(filePath);
      if (res && res.content) {
        const filename = filePath.split('/').pop() || '';
        const port = extractPortFromContent(res.content, filename);
        if (port) {
          return port;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

export interface DetectedProjectApp {
  name: string;
  port: number;
  url: string;
  path: string;
}

/**
 * Detects all runnable web apps inside a monorepo or standard project
 */
export async function detectProjectApps(projectPath?: string): Promise<DetectedProjectApp[]> {
  if (!projectPath || typeof window === 'undefined' || !window.electronAPI?.fs?.readFile) {
    return [];
  }

  const cleanPath = projectPath.replace(/\/+$/, '');
  const candidateApps = [
    { name: 'client', file: `${cleanPath}/apps/client/vite.config.ts`, path: `${cleanPath}/apps/client` },
    { name: 'web', file: `${cleanPath}/apps/web/vite.config.ts`, path: `${cleanPath}/apps/web` },
    { name: 'frontend', file: `${cleanPath}/apps/frontend/vite.config.ts`, path: `${cleanPath}/apps/frontend` },
    { name: 'admin', file: `${cleanPath}/apps/admin/vite.config.ts`, path: `${cleanPath}/apps/admin` },
    { name: 'wireframe', file: `${cleanPath}/apps/wireframe/vite.config.ts`, path: `${cleanPath}/apps/wireframe` },
    { name: 'app', file: `${cleanPath}/apps/app/vite.config.ts`, path: `${cleanPath}/apps/app` },
    { name: 'root', file: `${cleanPath}/vite.config.ts`, path: cleanPath },
  ];

  const results: DetectedProjectApp[] = [];
  const seenPorts = new Set<number>();

  for (const app of candidateApps) {
    try {
      const res = await window.electronAPI.fs.readFile(app.file);
      if (res && res.content) {
        const filename = app.file.split('/').pop() || '';
        const port = extractPortFromContent(res.content, filename);
        if (port && !seenPorts.has(port)) {
          seenPorts.add(port);
          results.push({
            name: app.name,
            port,
            url: `http://localhost:${port}`,
            path: app.path,
          });
        }
      }
    } catch {}
  }

  return results;
}

/**
 * Automatically disambiguates and assigns unique devUrls to any project nodes
 * that share identical URLs or lack one.
 */
export function deduplicateProjectNodesDevUrls<T extends { id: string; type: string; config?: any; title?: string }>(
  nodes: T[],
  fallbackBasePort = 5173
): { nodes: T[]; hasChanges: boolean } {
  let hasChanges = false;
  const usedPorts = new Set<number>();

  const updatedNodes = nodes.map((node) => {
    if (node.type !== 'project') return node;

    const currentDevUrl = node.config?.devUrl;
    const currentPort = extractPortFromUrl(currentDevUrl);

    if (currentPort && !usedPorts.has(currentPort)) {
      usedPorts.add(currentPort);
      return node;
    }

    // Collision or missing port! Allocate next available
    let port = currentPort ? currentPort + 1 : fallbackBasePort;
    while (usedPorts.has(port)) {
      port++;
    }
    usedPorts.add(port);
    hasChanges = true;

    const newDevUrl = `http://localhost:${port}`;
    return {
      ...node,
      config: {
        ...node.config,
        devUrl: newDevUrl,
      },
    };
  });

  return { nodes: updatedNodes, hasChanges };
}

/**
 * Checks if a specific devUrl is already in use by another project node
 */
export function isDevUrlDuplicated(
  targetUrl: string,
  nodeId: string,
  nodes: Array<{ id: string; type: string; config?: any }>
): boolean {
  if (!targetUrl) return false;
  const targetPort = extractPortFromUrl(targetUrl);
  if (!targetPort) return false;

  return nodes.some((n) => {
    if (n.id === nodeId || n.type !== 'project') return false;
    const otherPort = extractPortFromUrl(n.config?.devUrl);
    return otherPort === targetPort;
  });
}
