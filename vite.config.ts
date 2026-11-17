import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// a versão do app entra no build (no CI o `npm version` roda antes do build, então vem da tag)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 5185,
  },
  build: {
    outDir: 'dist',
  },
});
