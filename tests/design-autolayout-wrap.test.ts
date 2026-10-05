import { test, expect } from 'bun:test';
import { addAutoLayout, inferFlow, relayoutAll } from '../src/components/design2/autoLayout';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
let n = 0;
const id = () => `new${++n}`;

test('infere direção e espaçamento', () => {
  const row = [mk({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40 }), mk({ id: 'b', type: 'rect', x: 56, y: 5, width: 40, height: 30 }), mk({ id: 'c', type: 'rect', x: 112, y: 0, width: 40, height: 40 })] as any[];
  expect(inferFlow(row)).toEqual({ flow: 'horizontal', gap: 16 });
  const col = row.map((s, i) => ({ ...s, x: 0, y: i * 60 }));
  expect(inferFlow(col)).toEqual({ flow: 'vertical', gap: 20 });
});

test('Shift+A envolve a seleção num frame com auto layout (hug)', () => {
  const all = [mk({ id: 'a', type: 'rect', x: 100, y: 100, width: 40, height: 40 }), mk({ id: 'b', type: 'rect', x: 156, y: 100, width: 60, height: 40 }), mk({ id: 'out', type: 'rect', x: 500, y: 0, width: 10, height: 10 })] as any[];
  const r = addAutoLayout(all, ['a', 'b'], id)!;
  const frame = r.shapes.find((s) => s.id === r.selectId)!;
  expect(frame.hasAutoLayout).toBe(true);
  expect(frame.layoutFlow).toBe('horizontal');
  expect(frame.layoutGap).toBe(16);
  expect(frame.widthMode).toBe('hug');
  expect(frame.width).toBe(116); // 40 + 16 + 60
  expect(r.shapes.find((s) => s.id === 'a')!.parentId).toBe(frame.id);
  expect(r.shapes.find((s) => s.id === 'out')!.parentId).toBeUndefined();
});

test('frame existente: liga e desliga mantendo tamanho', () => {
  const all = [
    mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 200 }),
    mk({ id: 'a', type: 'rect', parentId: 'f', x: 20, y: 20, width: 100, height: 40 }),
    mk({ id: 'b', type: 'rect', parentId: 'f', x: 20, y: 80, width: 100, height: 40 }),
  ] as any[];
  const on = addAutoLayout(all, ['f'], id)!;
  const f = on.shapes.find((s) => s.id === 'f')!;
  expect(f.layoutFlow).toBe('vertical');
  expect(f.layoutGap).toBe(20);
  expect(f.paddingLeft).toBe(20);
  expect(f.width).toBe(300);
  const off = addAutoLayout(on.shapes, ['f'], id)!;
  expect(off.shapes.find((s) => s.id === 'f')!.hasAutoLayout).toBe(false);
});

test('redimensionar um filho empurra os irmãos e o pai (hug) cresce', () => {
  const wrapped = addAutoLayout([mk({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40 }), mk({ id: 'b', type: 'rect', x: 56, y: 0, width: 40, height: 40 })] as any[], ['a', 'b'], id)!;
  const grown = wrapped.shapes.map((s) => (s.id === 'a' ? { ...s, width: 100, widthMode: 'fixed' } : s));
  const out = relayoutAll(grown as any);
  const frame = out.find((s) => s.id === wrapped.selectId)!;
  expect(out.find((s) => s.id === 'b')!.x).toBe(116); // 100 + gap 16
  expect(frame.width).toBe(156);
});

test('fill em vários níveis: cada filho ocupa o espaço do pai já resolvido (de fora para dentro)', () => {
  const fr = (id: string, parentId: string | undefined, extra: any) =>
    mk({ id, type: 'frame', parentId, x: 0, y: 0, width: 40, height: 40, hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 0, independentPadding: true, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, ...extra });
  const all = [
    fr('root', undefined, { width: 400, height: 800, paddingLeft: 10, paddingRight: 10 }),
    fr('a', 'root', { widthMode: 'fill', heightMode: 'hug', paddingLeft: 20, paddingRight: 20 }),
    fr('b', 'a', { widthMode: 'fill', heightMode: 'hug', layoutFlow: 'horizontal' }),
    fr('c', 'b', { widthMode: 'fill', heightMode: 'hug', paddingLeft: 5, paddingRight: 5 }),
    mk({ id: 't', type: 'text', parentId: 'c', x: 0, y: 0, width: 40, height: 20, widthMode: 'fill', heightMode: 'hug' }),
  ] as any[];
  const out = relayoutAll(all);
  const w = (id: string) => out.find((s) => s.id === id)!.width;
  expect(w('a')).toBe(380); // 400 - 2*10
  expect(w('b')).toBe(340); // 380 - 2*20
  expect(w('c')).toBe(340); // único filho "fill" da linha
  expect(w('t')).toBe(330); // 340 - 2*5
});
