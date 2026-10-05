import { describe, expect, it } from 'bun:test';
import {
  extractPortFromContent,
  extractPortFromUrl,
  allocateUniqueDevUrl,
  deduplicateProjectNodesDevUrls,
  isDevUrlDuplicated,
  normalizeDevUrl,
} from '../src/utils/projectDevUrl';

describe('projectDevUrl utility', () => {
  describe('extractPortFromContent', () => {
    it('extracts port from vite.config.ts server: { port: 5185 }', () => {
      const viteConfig = `
        import { defineConfig } from 'vite';
        export default defineConfig({
          server: {
            port: 5185,
          },
        });
      `;
      expect(extractPortFromContent(viteConfig, 'vite.config.ts')).toBe(5185);
    });

    it('extracts port from .env file PORT=3333', () => {
      const envContent = `
        NODE_ENV=development
        PORT=3333
        DATABASE_URL=postgres://...
      `;
      expect(extractPortFromContent(envContent, '.env')).toBe(3333);
    });

    it('extracts port from VITE_PORT in .env.local', () => {
      const envContent = `VITE_PORT=5174`;
      expect(extractPortFromContent(envContent, '.env.local')).toBe(5174);
    });

    it('extracts port from package.json dev script with --port 5176', () => {
      const pkgJson = JSON.stringify({
        scripts: {
          dev: 'vite --port 5176',
        },
      });
      expect(extractPortFromContent(pkgJson, 'package.json')).toBe(5176);
    });

    it('extracts port from package.json script with -p 3001', () => {
      const pkgJson = JSON.stringify({
        scripts: {
          start: 'next start -p 3001',
        },
      });
      expect(extractPortFromContent(pkgJson, 'package.json')).toBe(3001);
    });

    it('returns null when no port is specified', () => {
      const viteConfig = `
        import { defineConfig } from 'vite';
        export default defineConfig({
          plugins: [],
        });
      `;
      expect(extractPortFromContent(viteConfig, 'vite.config.ts')).toBeNull();
    });
  });

  describe('extractPortFromUrl', () => {
    it('extracts port from standard localhost url', () => {
      expect(extractPortFromUrl('http://localhost:5173')).toBe(5173);
      expect(extractPortFromUrl('http://localhost:8080/')).toBe(8080);
      expect(extractPortFromUrl('http://127.0.0.1:3000/app')).toBe(3000);
    });

    it('returns null for url without port or invalid url', () => {
      expect(extractPortFromUrl('http://localhost')).toBeNull();
      expect(extractPortFromUrl('')).toBeNull();
      expect(extractPortFromUrl(undefined)).toBeNull();
    });
  });

  describe('allocateUniqueDevUrl', () => {
    it('allocates fallback base port 5173 when no existing urls and no preferred port', () => {
      const url = allocateUniqueDevUrl([]);
      expect(url).toBe('http://localhost:5173');
    });

    it('allocates preferred port when it is not used', () => {
      const url = allocateUniqueDevUrl(['http://localhost:5173'], 5185);
      expect(url).toBe('http://localhost:5185');
    });

    it('allocates next port when preferred port is already used', () => {
      const url = allocateUniqueDevUrl(['http://localhost:5173'], 5173);
      expect(url).toBe('http://localhost:5174');
    });

    it('skips multiple already used ports sequentially', () => {
      const existing = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ];
      const url = allocateUniqueDevUrl(existing, 5173);
      expect(url).toBe('http://localhost:5176');
    });

    it('allocates next available fallback port when preferred port is null', () => {
      const existing = ['http://localhost:5173'];
      const url = allocateUniqueDevUrl(existing, null);
      expect(url).toBe('http://localhost:5174');
    });
  });

  describe('deduplicateProjectNodesDevUrls', () => {
    it('leaves nodes alone if they already have different ports', () => {
      const nodes = [
        { id: 'p1', type: 'project', config: { devUrl: 'http://localhost:5173' } },
        { id: 'p2', type: 'project', config: { devUrl: 'http://localhost:5174' } },
        { id: 'm1', type: 'model', config: {} },
      ];
      const res = deduplicateProjectNodesDevUrls(nodes);
      expect(res.hasChanges).toBe(false);
      expect(res.nodes[0].config.devUrl).toBe('http://localhost:5173');
      expect(res.nodes[1].config.devUrl).toBe('http://localhost:5174');
    });

    it('disambiguates duplicate devUrls among project nodes', () => {
      const nodes = [
        { id: 'p1', type: 'project', config: { devUrl: 'http://localhost:5173' } },
        { id: 'p2', type: 'project', config: { devUrl: 'http://localhost:5173' } },
        { id: 'p3', type: 'project', config: { devUrl: 'http://localhost:5173' } },
      ];
      const res = deduplicateProjectNodesDevUrls(nodes);
      expect(res.hasChanges).toBe(true);
      expect(res.nodes[0].config.devUrl).toBe('http://localhost:5173');
      expect(res.nodes[1].config.devUrl).toBe('http://localhost:5174');
      expect(res.nodes[2].config.devUrl).toBe('http://localhost:5175');
    });
  });

  describe('isDevUrlDuplicated', () => {
    const nodes = [
      { id: 'p1', type: 'project', config: { devUrl: 'http://localhost:5173' } },
      { id: 'p2', type: 'project', config: { devUrl: 'http://localhost:5174' } },
    ];

    it('returns true when another node has the same port', () => {
      expect(isDevUrlDuplicated('http://localhost:5173', 'p2', nodes)).toBe(true);
    });

    it('returns false when checking own node id', () => {
      expect(isDevUrlDuplicated('http://localhost:5173', 'p1', nodes)).toBe(false);
    });

    it('returns false for an unused port', () => {
      expect(isDevUrlDuplicated('http://localhost:5175', 'p1', nodes)).toBe(false);
    });
  });
});
