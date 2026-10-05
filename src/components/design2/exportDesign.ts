import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignCanvas from './DesignCanvas';
import type { ExportItem, Shape } from './types';

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** O shape e todos os descendentes (por parentId). */
export function collectSubtree(all: Shape[], root: Shape): Shape[] {
  const out: Shape[] = [root];
  const queue = [root.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const s of all) {
      if (s.parentId === id) {
        out.push(s);
        queue.push(s.id);
      }
    }
  }
  return out;
}

function shapeBox(s: Shape) {
  if ((s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length > 0) {
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  return { x: s.x, y: s.y, width: s.width, height: s.height };
}

/** Área ocupada pelos shapes, com folga para traço e sombras/blur. */
export function boundsOfShapes(shapes: Shape[]): ExportBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    if (s.visible === false) continue;
    const b = shapeBox(s);
    let margin = (s.strokeWidth || 0) / 2;
    for (const e of s.effects || []) {
      if (!e.visible) continue;
      if (e.type === 'drop-shadow') margin = Math.max(margin, (e.blur || 0) * 2 + Math.max(Math.abs(e.x || 0), Math.abs(e.y || 0)) + (e.spread || 0));
      if (e.type === 'layer-blur') margin = Math.max(margin, (e.blur || 0) * 2);
    }
    minX = Math.min(minX, b.x - margin);
    minY = Math.min(minY, b.y - margin);
    maxX = Math.max(maxX, b.x + b.width + margin);
    maxY = Math.max(maxY, b.y + b.height + margin);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: Math.floor(minX), y: Math.floor(minY), width: Math.max(1, Math.ceil(maxX - minX)), height: Math.max(1, Math.ceil(maxY - minY)) };
}

/**
 * SVG autônomo do shape (com descendentes). Reaproveita o próprio DesignCanvas renderizado sem seleção,
 * então a exportação sempre sai igual ao que aparece na tela.
 */
export function buildExportSvg(all: Shape[], target: Shape, scale = 1): { svg: string; bounds: ExportBounds } {
  const subtree = collectSubtree(all, target);
  const bounds = boundsOfShapes(subtree);
  const markup = renderToStaticMarkup(
    React.createElement(DesignCanvas, {
      shapes: subtree,
      selectedId: null,
      tool: 'select',
      readOnly: true,
      zoom: 1,
      onSelect: () => {},
      onShapesChange: () => {},
      onToolUsed: () => {},
    })
  );
  // Conteúdo do <g transform="translate(pan) scale(zoom)"> raiz (pan inicial do canvas = 120,80)
  const open = markup.indexOf('<g transform="translate(');
  const inner = open >= 0 ? markup.slice(markup.indexOf('>', open) + 1, markup.lastIndexOf('</g>')) : '';
  const w = Math.round(bounds.width * scale);
  const h = Math.round(bounds.height * scale);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">` +
    inner +
    `</svg>`;
  return { svg, bounds };
}

export function scaleValue(scale: ExportItem['scale']): number {
  return parseFloat(scale) || 1;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível rasterizar o SVG'));
    img.src = url;
  });
}

async function rasterize(svg: string, width: number, height: number, mime: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (mime === 'image/jpeg') {
    // JPG/PDF não têm transparência: fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), mime, quality));
}

/** PDF de uma página com a imagem JPEG embutida (sem dependências). */
export function buildPdfFromJpeg(jpeg: Uint8Array, imgW: number, imgH: number, pageW: number, pageH: number): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach((b) => push(b));
    push('\nendobj\n');
  };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, [enc.encode(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc.encode('\nendstream')]);
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xrefAt = length;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export function exportFileName(shape: Shape, item: ExportItem): string {
  const base = (shape.name || 'export').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'export';
  const scaleTag = item.scale !== '1x' ? `@${item.scale}` : '';
  return `${base}${item.suffix || ''}${scaleTag}.${item.format.toLowerCase()}`;
}

export async function exportShape(all: Shape[], shape: Shape, item: ExportItem): Promise<{ blob: Blob; filename: string }> {
  const scale = scaleValue(item.scale);
  const { svg, bounds } = buildExportSvg(all, shape, scale);
  const w = Math.max(1, Math.round(bounds.width * scale));
  const h = Math.max(1, Math.round(bounds.height * scale));
  const filename = exportFileName(shape, item);
  if (item.format === 'SVG') return { blob: new Blob([svg], { type: 'image/svg+xml' }), filename };
  if (item.format === 'PNG') return { blob: await rasterize(svg, w, h, 'image/png'), filename };
  if (item.format === 'JPG') return { blob: await rasterize(svg, w, h, 'image/jpeg'), filename };
  const jpeg = new Uint8Array(await (await rasterize(svg, w, h, 'image/jpeg')).arrayBuffer());
  return { blob: new Blob([buildPdfFromJpeg(jpeg, w, h, bounds.width, bounds.height) as BlobPart], { type: 'application/pdf' }), filename };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
