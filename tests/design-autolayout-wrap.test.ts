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

const frame = (id: string, extra: any = {}) =>
  mk({ id, type: 'frame', x: 0, y: 0, width: 300, height: 100, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 0, independentPadding: true, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, ...extra });
const box = (id: string, parentId: string, extra: any = {}) => mk({ id, type: 'rect', parentId, x: 0, y: 0, width: 50, height: 40, ...extra });
const txt = (id: string, parentId: string, text: string, extra: any = {}) => mk({ id, type: 'text', parentId, x: 0, y: 0, width: 10, height: 10, text, fontSize: 16, fontWeight: 400, ...extra });

test('Figma: texto no auto layout se ajusta ao conteúdo; mudar a fonte reflui irmãos e o pai (hug)', () => {
  const base = [frame('f', { widthMode: 'hug', heightMode: 'hug', layoutGap: 10 }), txt('t', 'f', 'Olá mundo', { widthMode: 'hug' }), box('b', 'f')] as any[];
  const a = relayoutAll(base);
  const ta = a.find((s) => s.id === 't')!;
  expect(ta.width).toBeGreaterThan(30);
  expect(ta.height).toBe(20); // 16 * 1.25
  const bigger = relayoutAll(a.map((s) => (s.id === 't' ? { ...s, fontSize: 32 } : s)) as any);
  const tb = bigger.find((s) => s.id === 't')!;
  expect(tb.width).toBeGreaterThan(ta.width * 1.7);
  expect(tb.height).toBe(40);
  // o irmão foi empurrado para a direita e o frame (hug) cresceu em largura e altura
  expect(bigger.find((s) => s.id === 'b')!.x).toBe(tb.width + 10);
  const f = bigger.find((s) => s.id === 'f')!;
  expect(f.width).toBe(tb.width + 10 + 50);
  expect(f.height).toBe(40);
});

test('Figma: texto "fill" quebra pela largura do pai e re-quebra quando o pai muda', () => {
  const long = 'Um texto bem longo que precisa quebrar em várias linhas dentro do card';
  const mkAll = (w: number) => [frame('f', { layoutFlow: 'vertical', width: w, height: 10, heightMode: 'hug' }), txt('t', 'f', long, { widthMode: 'fill' })] as any[];
  const narrow = relayoutAll(mkAll(160));
  const tn = narrow.find((s) => s.id === 't')!;
  expect(tn.text!.split('\n').length).toBeGreaterThan(2);
  expect(tn.width).toBe(160);
  expect(narrow.find((s) => s.id === 'f')!.height).toBe(tn.height); // hug acompanha as linhas
  // alarga o frame mantendo o texto já quebrado: re-quebra a partir do texto original
  const wide = relayoutAll(narrow.map((s) => (s.id === 'f' ? { ...s, width: 900 } : s)) as any);
  const tw = wide.find((s) => s.id === 't')!;
  expect(tw.text!.split('\n').length).toBe(1);
  expect(tw.height).toBe(20);
  expect(wide.find((s) => s.id === 'f')!.height).toBe(20); // e o frame encolheu junto
});

test('Figma: espaçamento automático (space between)', () => {
  const all = [frame('f', { layoutGapAuto: true, widthMode: 'fixed' }), box('a', 'f'), box('b', 'f'), box('c', 'f')] as any[];
  const out = relayoutAll(all);
  const xs = ['a', 'b', 'c'].map((id) => out.find((s) => s.id === id)!.x);
  expect(xs).toEqual([0, 125, 250]); // 300 - 3*50 = 150 livres / 2 espaços = 75
});

test('Figma: definir largura fixa num filho "fill" faz o irmão "fill" ocupar o resto', () => {
  const both = [frame('f'), box('a', 'f', { widthMode: 'fill' }), box('b', 'f', { widthMode: 'fill' })] as any[];
  const even = relayoutAll(both);
  expect(even.find((s) => s.id === 'a')!.width).toBe(150);
  const fixedA = relayoutAll(even.map((s) => (s.id === 'a' ? { ...s, width: 100, widthMode: 'fixed' } : s)) as any);
  expect(fixedA.find((s) => s.id === 'a')!.width).toBe(100);
  expect(fixedA.find((s) => s.id === 'b')!.width).toBe(200);
  expect(fixedA.find((s) => s.id === 'b')!.x).toBe(100);
});

test('texto "fill" nunca colapsa para 0: fica com a largura da maior palavra mesmo com irmãos fixos largos', () => {
  const all = [
    frame('f', { width: 300, height: 40 }),
    txt('t', 'f', 'Meus Cartões', { widthMode: 'fill', fontSize: 18 }),
    box('b', 'f', { width: 300, widthMode: 'fixed' }), // irmão fixo ocupa a linha toda
  ] as any[];
  const out = relayoutAll(all);
  const t = out.find((s) => s.id === 't')!;
  expect(t.width).toBeGreaterThan(40); // antes: 0 (o título sumia atrás do vizinho)
  expect(out.find((s) => s.id === 'b')!.x).toBeGreaterThanOrEqual(t.width - 0.5);
});

test('texto hug mais largo que a coluna quebra linha em vez de virar coluna estreita', () => {
  const frame = mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 345, height: 100, hasAutoLayout: true, layoutFlow: 'vertical', widthMode: 'fixed', heightMode: 'hug', layoutAlign: 'top-center' });
  const t = mk({ id: 't', type: 'text', parentId: 'f', x: 0, y: 0, width: 143, height: 330, fontSize: 22, widthMode: 'hug', heightMode: 'hug', text: 'Quais são os\nlotes\nconfirmados', wrapSource: 'Quais são os lotes confirmados para a transmissão ao vivo de hoje?' });
  const out = relayoutAll([frame, t] as any[]);
  const r = out.find((s) => s.id === 't')!;
  expect(r.width).toBeGreaterThan(250);
  expect(r.height).toBeLessThan(120);
});

test('texto hug que foi quebrado numa coluna estreita volta a uma linha quando a coluna cresce', () => {
  const mk2 = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
  const frame = mk2({ id: 'f', type: 'frame', x: 0, y: 0, width: 600, height: 100, hasAutoLayout: true, layoutFlow: 'vertical', widthMode: 'fixed', heightMode: 'hug' });
  const t = mk2({ id: 't', type: 'text', parentId: 'f', x: 0, y: 0, width: 55, height: 80, fontSize: 26, fontWeight: 700, widthMode: 'hug', heightMode: 'hug', text: 'Visão\nGeral\nde Vendas', wrapSource: 'Visão Geral de Vendas' });
  const r = relayoutAll([frame, t] as any[]).find((s: any) => s.id === 't')!;
  expect(r.text).toBe('Visão Geral de Vendas');
  expect(r.height).toBeLessThan(40);
});

test('rótulo curto hug ("Ver tudo", "Inscrever Treinador") nunca é quebrado em coluna estreita', () => {
  const mk3 = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
  const frame = mk3({ id: 'f', type: 'frame', x: 0, y: 0, width: 40, height: 40, hasAutoLayout: true, layoutFlow: 'vertical', widthMode: 'fixed', heightMode: 'hug' });
  const t = mk3({ id: 't', type: 'text', parentId: 'f', x: 0, y: 0, width: 90, height: 20, fontSize: 14, widthMode: 'hug', heightMode: 'hug', text: 'Inscrever Treinador' });
  const r = relayoutAll([frame, t] as any[]).find((s: any) => s.id === 't')!;
  expect(r.text).toBe('Inscrever Treinador');
  expect(r.height).toBeLessThan(30);
});

test('Shift+A com um retângulo maior contendo outro: o maior vira o frame, com o fundo e os paddings exatos', () => {
  const mk4 = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
  const all = [
    mk4({ id: 'bg', type: 'rect', x: 0, y: 0, width: 428, height: 56, fill: '#D9D9D9', zIndex: 1 }),
    mk4({ id: 'btn', type: 'rect', x: 60, y: 18, width: 200, height: 20, fill: '#CC4444', zIndex: 2 }),
  ] as any[];
  const r = addAutoLayout(all, ['bg', 'btn'], () => 'novo')!;
  const f = r.shapes.find((s) => s.id === 'bg')!;
  expect(r.selectId).toBe('bg');
  expect(f.type).toBe('frame');
  expect(f.fill).toBe('#D9D9D9');
  expect(f.hasAutoLayout).toBe(true);
  expect([f.paddingLeft, f.paddingTop, f.paddingRight, f.paddingBottom]).toEqual([60, 18, 168, 18]);
  expect(f.width).toBe(428);
  expect(f.height).toBe(56);
  const k = r.shapes.find((s) => s.id === 'btn')!;
  expect(k.parentId).toBe('bg');
  expect([k.x, k.y]).toEqual([60, 18]); // continua exatamente no mesmo lugar
  expect(r.shapes.some((s) => s.id === 'novo')).toBe(false); // não criou um frame extra
});
