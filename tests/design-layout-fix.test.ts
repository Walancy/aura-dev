import { test, expect } from 'bun:test';
import { fixLayout } from '../src/components/design2/layoutFix';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });

test('ajusta gap/padding para a grade de 4px', () => {
  const all = [mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 100, hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 13, paddingHorizontal: 17, paddingVertical: 9 })] as any[];
  const r = fixLayout(all, ['f']);
  const f = r.shapes.find((s) => s.id === 'f')!;
  expect([f.layoutGap, f.paddingHorizontal, f.paddingVertical]).toEqual([12, 16, 8]);
  expect(r.fixes).toBe(3);
});

test('iguala a altura de cards quase iguais na mesma fileira', () => {
  const all = [
    mk({ id: 'row', type: 'frame', x: 0, y: 0, width: 400, height: 120, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 12, widthMode: 'fixed', heightMode: 'fixed' }),
    mk({ id: 'a', parentId: 'row', type: 'frame', x: 0, y: 0, width: 100, height: 100, widthMode: 'fixed', heightMode: 'fixed' }),
    mk({ id: 'b', parentId: 'row', type: 'frame', x: 112, y: 0, width: 100, height: 92, widthMode: 'fixed', heightMode: 'fixed' }),
  ] as any[];
  const r = fixLayout(all, ['row']);
  expect(r.shapes.find((s) => s.id === 'b')!.height).toBe(100);
});

test('traz para dentro um elemento que vaza do pai e separa textos sobrepostos', () => {
  const all = [
    mk({ id: 's', type: 'frame', x: 0, y: 0, width: 300, height: 600 }),
    mk({ id: 'btn', parentId: 's', type: 'frame', x: 250, y: 500, width: 100, height: 40 }),
    mk({ id: 't1', parentId: 's', type: 'text', x: 20, y: 100, width: 200, height: 30, text: 'Título' }),
    mk({ id: 't2', parentId: 's', type: 'text', x: 20, y: 112, width: 200, height: 30, text: 'Subtítulo' }),
  ] as any[];
  const r = fixLayout(all, ['s']);
  const btn = r.shapes.find((s) => s.id === 'btn')!;
  expect(btn.x + btn.width).toBeLessThanOrEqual(300);
  const t1 = r.shapes.find((s) => s.id === 't1')!;
  const t2 = r.shapes.find((s) => s.id === 't2')!;
  expect(t2.y).toBeGreaterThanOrEqual(t1.y + t1.height);
});

test('não mexe no que está fora do escopo', () => {
  const all = [mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 100, hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 13 }), mk({ id: 'g', type: 'frame', x: 400, y: 0, width: 300, height: 100, hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 13 })] as any[];
  const r = fixLayout(all, ['f']);
  expect(r.shapes.find((s) => s.id === 'g')!.layoutGap).toBe(13);
});
