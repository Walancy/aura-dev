import { removeBackground, type RemoveBgDeps } from '../design2/removeBg';

/** `rembg` costuma ficar em ~/.local/bin ou no Homebrew, fora do PATH do app. */
const PATH_FIX = 'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; ';

function deps(): RemoveBgDeps | null {
  const api = (window as any).electronAPI;
  if (!api?.fs?.saveTempImage || !api?.shell?.exec || !api?.fs?.readFileDataUrl) return null;
  return {
    saveTempImage: (b64, ext) => api.fs.saveTempImage(b64, ext),
    exec: (cmd) => api.shell.exec(PATH_FIX + cmd),
    readDataUrl: (path) => api.fs.readFileDataUrl(path),
  };
}

/** Remove o fundo de uma imagem (data URL); em falha devolve o motivo. */
export async function cutout(dataUrl: string): Promise<{ dataUrl?: string; error?: string }> {
  const d = deps();
  return d ? removeBackground(dataUrl, d) : { error: 'Remoção de fundo indisponível neste ambiente' };
}

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** O pedido é remover/recortar o fundo de uma imagem? */
export function wantsRemoveBg(prompt: string): boolean {
  const p = norm(prompt);
  return /\b(remov(a|er|e)|tir(a|e|ar)|retir(a|e|ar)|apag(a|ue|ar)|delet(e|ar)|elimin(e|ar)|sem)\b[^.]{0,24}\b(o\s+|do\s+|de\s+)?(fundo|background)\b/.test(p)
    || /\b(recort(e|a|ar)|isol(e|a|ar)|png transparente|fundo transparente|transparente)\b/.test(p) && /\b(imagem|foto|figura|pessoa|produto|logo|ilustracao|objeto|elemento)\b/.test(p)
    || /\bremove\s*bg\b|\bsem fundo\b/.test(p);
}

type Call = (method: string, params?: Record<string, unknown>) => Promise<any>;

/** Imagem (fundo removido) no lugar do preenchimento de imagem da camada: posição, tamanho, cantos e pilha ficam como estavam. */
export async function setImageFill(call: Call, id: number, dataUrl: string): Promise<boolean> {
  const placed = await call('engine.execute', { command: 'image.place', params: { data: dataUrl.slice(dataUrl.indexOf(',') + 1), x: -20000, y: -20000, mode: 'fit' } }).catch(() => null);
  const pid = placed?.id ?? placed?.ids?.[0];
  if (pid === undefined) return false;
  try {
    const nd = await call('node.get', { id: pid, depth: 0 });
    const hash = nd?.fills?.find((f: any) => f.type === 'image')?.image;
    if (!hash) return false;
    await call('engine.execute', { command: 'node.set', params: { ids: [id], props: { fills: [{ type: 'image', image: hash, scale_mode: 'fit', opacity: 1 }] } } });
    return true;
  } finally {
    await call('engine.execute', { command: 'edit.delete', params: { ids: [pid] } }).catch(() => {});
  }
}

/** Camada renderizada em PNG (data URL), em 2x. */
export async function exportNodePng(call: Call, id: number): Promise<string | null> {
  const e = await call('engine.execute', { command: 'file.export', params: { ids: [id], format: 'png', scale: 2 } }).catch(() => null);
  return e?.data ? `data:image/png;base64,${e.data}` : null;
}

/**
 * Mantém só o objeto central (o que cobre o centro da imagem): pedaços de objetos vizinhos que o recorte do fundo deixou
 * (outra cadeira, uma etiqueta) ficam transparentes. Partes soltas dentro da caixa do objeto (pernas finas) são mantidas.
 */
function keepCentralObject(d: Uint8ClampedArray, w: number, h: number): void {
  const label = new Int32Array(w * h);
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] || d[i * 4 + 3] <= 24) continue;
    const id = comps.length + 1;
    const c = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    label[i] = id; stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      c.area++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !label[q] && d[q * 4 + 3] > 24) { label[q] = id; stack.push(q); }
      }
    }
    comps.push(c);
  }
  if (comps.length < 2) return;
  const cx = w / 2, cy = h / 2;
  // o maior pedaço que cobre (ou fica mais perto de) o centro
  let best = 0, bestScore = -1;
  comps.forEach((c, i) => {
    const dx = cx < c.x0 ? c.x0 - cx : cx > c.x1 ? cx - c.x1 : 0, dy = cy < c.y0 ? c.y0 - cy : cy > c.y1 ? cy - c.y1 : 0;
    const score = c.area / (1 + (dx * dx + dy * dy) / 400);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  const m = comps[best];
  const padX = (m.x1 - m.x0) * 0.04, padY = (m.y1 - m.y0) * 0.04;
  const keep = new Set<number>([best + 1]);
  comps.forEach((c, i) => { if (i !== best && c.area < m.area * 0.25 && c.x0 >= m.x0 - padX && c.x1 <= m.x1 + padX && c.y0 >= m.y0 - padY && c.y1 <= m.y1 + padY) keep.add(i + 1); });
  for (let i = 0; i < w * h; i++) if (label[i] && !keep.has(label[i])) d[i * 4 + 3] = 0;
}

/** Corta as bordas transparentes (o objeto recortado passa a ocupar a imagem toda). */
export function trimTransparent(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      if (!g) return resolve(dataUrl);
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      keepCentralObject(d, cv.width, cv.height);
      g.putImageData(new ImageData(d, cv.width, cv.height), 0, 0);
      let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return resolve(dataUrl);
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d')?.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      resolve(out.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Recorta o fundo e já tira as bordas vazias; em falha devolve o motivo. */
export async function cutoutTrimmed(dataUrl: string): Promise<{ dataUrl?: string; error?: string }> {
  const r = await cutout(dataUrl);
  return r.dataUrl ? { dataUrl: await trimTransparent(r.dataUrl) } : r;
}
