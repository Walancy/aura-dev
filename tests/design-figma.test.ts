import { test, expect } from 'bun:test';
import { applyImageUrls, convertFigmaDocument, figmaColor, linearAngleFromHandles, parseFigmaUrl } from '../src/components/design2/figmaImport';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
let n = 0;
const idGen = () => `id${++n}`;

const file = {
  document: {
    type: 'DOCUMENT',
    children: [
      {
        id: '0:1', type: 'CANVAS', name: 'Home',
        children: [
          {
            id: '1:1', type: 'FRAME', name: 'Tela', absoluteBoundingBox: box(0, 0, 400, 300), size: { x: 400, y: 300 }, clipsContent: true,
            layoutMode: 'VERTICAL', itemSpacing: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'MIN',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
            reactions: [{ action: { destinationId: '1:3' } }],
            children: [
              { id: '1:2', type: 'TEXT', name: 'T', characters: 'Olá', absoluteBoundingBox: box(16, 12, 50, 20), size: { x: 50, y: 20 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }], style: { fontSize: 14, fontFamily: 'Inter', textAlignHorizontal: 'CENTER', textCase: 'UPPER' } },
              { id: '1:4', type: 'RECTANGLE', name: 'R', absoluteBoundingBox: box(16, 40, 100, 50), size: { x: 100, y: 50 }, rectangleCornerRadii: [1, 2, 3, 4], strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }], strokeWeight: 2, strokeAlign: 'OUTSIDE', effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 1, y: 2 }, radius: 4 }], constraints: { horizontal: 'LEFT_RIGHT', vertical: 'TOP' } },
              { id: '1:5', type: 'RECTANGLE', name: 'Img', absoluteBoundingBox: box(0, 100, 50, 50), size: { x: 50, y: 50 }, fills: [{ type: 'IMAGE', imageRef: 'abc', scaleMode: 'FIT' }] },
              { id: '1:6', type: 'VECTOR', name: 'V', absoluteBoundingBox: box(0, 0, 10, 10), size: { x: 10, y: 10 }, fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }], fillGeometry: [{ path: 'M0 0L10 0L10 10Z' }] },
              { id: '1:7', type: 'STICKY', name: 'S' },
            ],
          },
          { id: '1:3', type: 'COMPONENT', name: 'Alvo', absoluteBoundingBox: box(500, 0, 100, 100), size: { x: 100, y: 100 } },
        ],
      },
      { id: '0:2', type: 'CANVAS', name: 'Outra', children: [] },
    ],
  },
};

test('helpers', () => {
  expect(figmaColor({ r: 1, g: 0.5, b: 0 })).toBe('#FF8000');
  expect(linearAngleFromHandles([{ x: 0, y: 0 }, { x: 1, y: 0 }], 100, 100)).toBe(90);
  expect(linearAngleFromHandles([{ x: 0, y: 1 }, { x: 0, y: 0 }], 100, 100)).toBe(0);
  expect(parseFigmaUrl('https://www.figma.com/design/AbC123/Nome?node-id=12-345&t=x')).toEqual({ fileKey: 'AbC123', nodeId: '12:345' });
  expect(parseFigmaUrl('https://example.com')).toBeNull();
});

test('converte arquivo completo', () => {
  const r = convertFigmaDocument(file, { idGen });
  expect(r.pages.map((p) => p.name)).toEqual(['Home', 'Outra']);
  const by = (name: string) => r.shapes.find((s) => s.name === name)!;
  const frame = by('Tela');
  expect(frame.type).toBe('frame');
  expect(frame.hasAutoLayout).toBe(true);
  expect(frame.layoutAlign).toBe('left');
  expect(frame.clipContent).toBe(true);
  expect(frame.fill).toBe('#FF0000');
  expect(frame.prototypeLink?.targetId).toBe(by('Alvo').id);
  expect(by('Alvo').isComponent).toBe(true);
  expect(by('T').parentId).toBe(frame.id);
  expect(by('T').textCase).toBe('uppercase');
  expect(by('T').textAlign).toBe('center');
  const rect = by('R');
  expect(rect.independentCorners).toBe(true);
  expect(rect.strokePosition).toBe('outside');
  expect(rect.effects?.[0].type).toBe('drop-shadow');
  expect(rect.constraintH).toBe('stretch');
  expect(by('V').type).toBe('path');
  expect(by('V').pathD).toBe('M0 0L10 0L10 10Z');
  expect(r.warnings.some((w) => w.includes('STICKY'))).toBe(true);
  expect(r.stats.skipped).toBe(1);
  // imagens
  const img = by('Img');
  expect(img.type).toBe('image');
  expect(r.imageRefs[img.id]).toBe('abc');
  const { shapes, missing } = applyImageUrls(r, { abc: 'data:image/png;base64,AA' });
  expect(missing).toBe(0);
  expect(shapes.find((s) => s.id === img.id)!.imageUrl).toContain('data:image');
  expect(applyImageUrls(r, {}).missing).toBe(1);
});

test('nó solto e resposta /nodes', () => {
  const single = convertFigmaDocument({ id: '9:9', type: 'RECTANGLE', name: 'X', absoluteBoundingBox: box(5, 5, 10, 10) }, { idGen });
  expect(single.shapes).toHaveLength(1);
  const nodes = convertFigmaDocument({ nodes: { '1:1': { document: { id: '1:1', type: 'RECTANGLE', name: 'Y', absoluteBoundingBox: box(0, 0, 4, 4) } } } }, { idGen });
  expect(nodes.pages).toHaveLength(1);
  expect(convertFigmaDocument({ foo: 1 }).warnings).toHaveLength(1);
});

test('rotação usa size e centro do bbox', () => {
  const r = convertFigmaDocument({ id: '1:1', type: 'RECTANGLE', name: 'Rot', rotation: Math.PI / 2, size: { x: 100, y: 20 }, absoluteBoundingBox: box(40, 0, 20, 100) }, { idGen });
  const s = r.shapes[0];
  expect(s.width).toBe(100);
  expect(s.x).toBe(0);
  expect(s.y).toBe(40);
  expect(s.rotation).toBe(-90);
});
