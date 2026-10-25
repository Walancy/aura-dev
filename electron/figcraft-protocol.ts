import { app, protocol, net } from 'electron';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

// Serve o build web do FigCraft (public/figcraft -> dist/figcraft) em figcraft://app/.
// Esquema próprio porque o wasm precisa de fetch + MIME correto, o que file:// não dá.
export function registerFigcraftScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'figcraft', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ]);
}

export function handleFigcraftScheme() {
  const fs = require('node:fs');
  const pubRoot = path.join(__dirname, '../public/figcraft');
  const distRoot = path.join(__dirname, '../dist/figcraft');
  const root = fs.existsSync(pubRoot) ? pubRoot : distRoot;
  protocol.handle('figcraft', async (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root)) return new Response('forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
}
