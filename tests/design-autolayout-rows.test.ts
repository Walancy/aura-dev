import { describe, expect, it } from 'bun:test';
import { readingOrder, relayoutAll } from '../src/components/design2/autoLayout';
import { generateHtml, generateFlutter } from '../src/components/design2/codegen';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', widthMode: 'fixed', heightMode: 'fixed', ...o });

const frame = (extra: any = {}) =>
  mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 250, height: 100, hasAutoLayout: true, layoutFlow: 'freeform', layoutGap: 10, independentPadding: true, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, layoutAlign: 'top-left', ...extra });
let slot = 0;
// posição inicial escalonada na ordem de criação (o motor ordena os filhos pela posição atual)
const box = (id: string, w = 100, h = 40, extra: any = {}) => mk({ id, type: 'rect', parentId: 'f', x: (slot++ % 50) * 3, y: 0, width: w, height: h, ...extra });
const get = (all: any[], id: string) => all.find((s) => s.id === id);

describe('auto layout: wrap', () => {
  it('quebra a linha quando não cabe na largura', () => {
    const out = relayoutAll([frame(), box('a'), box('b', 100, 40), box('c')] as any);
    // 100 + 10 + 100 = 210 cabe; o terceiro (100) estoura 250 → próxima linha
    expect([get(out, 'a').x, get(out, 'a').y]).toEqual([0, 0]);
    expect([get(out, 'b').x, get(out, 'b').y]).toEqual([110, 0]);
    expect([get(out, 'c').x, get(out, 'c').y]).toEqual([0, 50]);
  });

  it('espaço entre linhas próprio (layoutCounterGap) e frame hug em altura', () => {
    const out = relayoutAll([frame({ layoutCounterGap: 30, heightMode: 'hug' }), box('a'), box('b'), box('c')] as any);
    expect(get(out, 'c').y).toBe(70); // 40 + 30
    expect(get(out, 'f').height).toBe(110); // 40 + 30 + 40
  });

  it('hug em largura não quebra: uma linha só', () => {
    const out = relayoutAll([frame({ widthMode: 'hug', heightMode: 'hug' }), box('a'), box('b'), box('c')] as any);
    expect(get(out, 'f').width).toBe(320);
    expect(get(out, 'c').y).toBe(0);
  });

  it('alinhamento ao centro centraliza cada linha', () => {
    const out = relayoutAll([frame({ layoutAlign: 'top-center' }), box('a'), box('b'), box('c')] as any);
    expect(get(out, 'a').x).toBe(20); // (250 - 210) / 2
    expect(get(out, 'c').x).toBe(75); // (250 - 100) / 2
  });
});

describe('auto layout: grid', () => {
  it('distribui em colunas iguais com gap e altura de linha pelo maior', () => {
    const out = relayoutAll([frame({ layoutFlow: 'grid', gridCols: 2, width: 210, layoutCounterGap: 20 }), box('a', 50, 40), box('b', 50, 60), box('c', 50, 30)] as any);
    // coluna = (210 - 10) / 2 = 100
    expect([get(out, 'a').x, get(out, 'a').y]).toEqual([0, 0]);
    expect([get(out, 'b').x, get(out, 'b').y]).toEqual([110, 0]);
    expect([get(out, 'c').x, get(out, 'c').y]).toEqual([0, 80]); // linha 1 tem 60 + 20
  });

  it('célula "fill" ocupa a coluna inteira', () => {
    const out = relayoutAll([frame({ layoutFlow: 'grid', gridCols: 2, width: 210 }), box('a', 50, 40, { widthMode: 'fill' }), box('b')] as any);
    expect(get(out, 'a').width).toBe(100);
  });

  it('hug mede as colunas pelo maior de cada uma', () => {
    const out = relayoutAll([frame({ layoutFlow: 'grid', gridCols: 2, widthMode: 'hug', heightMode: 'hug' }), box('a', 50, 40), box('b', 80, 40), box('c', 70, 40), box('d', 30, 40)] as any);
    expect(get(out, 'f').width).toBe(70 + 80 + 10);
    expect(get(out, 'f').height).toBe(40 + 10 + 40);
    expect(get(out, 'b').x).toBe(80);
  });
});

describe('auto layout: mínimo/máximo e pilha', () => {
  it('máximo limita um filho "fill" na linha', () => {
    const f = mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 400, height: 50, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 0, independentPadding: true, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, layoutAlign: 'top-left' });
    const out = relayoutAll([f, box('a', 10, 50, { widthMode: 'fill', maxW: 120 })] as any);
    expect(get(out, 'a').width).toBe(120);
  });

  it('mínimo segura um filho que seria menor; frame hug respeita máximo', () => {
    const f = mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 10, height: 10, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 0, independentPadding: true, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, layoutAlign: 'top-left', widthMode: 'hug', heightMode: 'hug', maxW: 150 });
    const out = relayoutAll([f, box('a', 20, 20, { minW: 90 }), box('b', 100, 20)] as any);
    expect(get(out, 'a').width).toBe(90);
    expect(get(out, 'f').width).toBe(150); // 90 + 100 = 190, limitado a 150
  });

  it('primeiro filho por cima inverte o z entre os filhos', () => {
    const out = relayoutAll([frame({ layoutStackFirstOnTop: true }), box('a', 100, 40, { zIndex: 1 }), box('b', 100, 40, { zIndex: 2 })] as any);
    expect(get(out, 'a').zIndex).toBeGreaterThan(get(out, 'b').zIndex);
  });
});

describe('readingOrder', () => {
  it('ordena por linhas e depois por x', () => {
    const items = [
      { id: 'd', x: 120, y: 52, width: 100, height: 40 },
      { id: 'a', x: 0, y: 2, width: 100, height: 40 },
      { id: 'c', x: 0, y: 50, width: 100, height: 40 },
      { id: 'b', x: 110, y: 0, width: 100, height: 40 },
    ];
    expect(readingOrder(items).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('código gerado para wrap e grid', () => {
  const all: any[] = [frame({ layoutFlow: 'grid', gridCols: 4, layoutGap: 8, layoutCounterGap: 16, widthMode: 'fixed' }), box('a'), box('b')];
  it('HTML usa display grid com colunas e gaps', () => {
    const html = generateHtml(all as any, all[0] as any);
    expect(html).toContain('display: grid');
    expect(html).toContain('repeat(4, 1fr)');
    expect(html).toContain('16px 8px');
  });
  it('wrap vira flex-wrap', () => {
    const html = generateHtml([{ ...all[0], layoutFlow: 'freeform' }, all[1], all[2]] as any, { ...all[0], layoutFlow: 'freeform' } as any);
    expect(html).toContain('flex-wrap: wrap');
  });
  it('Flutter: Wrap e GridView', () => {
    expect(generateFlutter([{ ...all[0], layoutFlow: 'freeform' }, all[1], all[2]] as any, { ...all[0], layoutFlow: 'freeform' } as any)).toContain('Wrap(');
    expect(generateFlutter(all as any, all[0] as any)).toContain('GridView.count(');
  });
});

describe('posição absoluta', () => {
  it('fica fora do fluxo e segue a restrição direita quando o frame cresce', () => {
    const f = frame({ layoutFlow: 'horizontal', widthMode: 'hug', heightMode: 'fixed', width: 100, height: 100 });
    const badge = box('badge', 20, 20, { layoutAbsolute: true, x: 80, y: 0, constraintH: 'end' });
    const out = relayoutAll([f, box('a', 100, 40), box('b', 100, 40), badge] as any);
    expect(get(out, 'f').width).toBe(210); // só a e b contam: 100 + 10 + 100
    expect(get(out, 'badge').x).toBe(190); // 80 + (210 - 100): preso à direita
    expect(get(out, 'badge').y).toBe(0);
  });
});
