import { test, expect } from 'bun:test';
import { collectSelectionColors, replaceSelectionColor } from '../src/components/design2/selectionColors';

const mk = (o: any) => ({ rotation: 0, fill: '#000000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', x: 0, y: 0, width: 10, height: 10, ...o });

test('lista as cores de fill, traço e sombra de todas as camadas inferiores, por uso', () => {
  const all = [
    mk({ id: 'f', type: 'frame', fill: '#FFFFFF' }),
    mk({ id: 'a', parentId: 'f', type: 'rect', fill: '#212121' }),
    mk({ id: 'b', parentId: 'f', type: 'rect', fill: '#212121', stroke: '#808080', strokeWidth: 1 }),
    mk({ id: 'c', parentId: 'f', type: 'text', fill: '#FFFFFF', fills: [{ id: 'x', color: '#FFFFFF', opacity: 0.2, visible: true, type: 'solid' }] }),
    mk({ id: 'd', parentId: 'f', type: 'rect', fill: '#111111', effects: [{ id: 'e', type: 'drop-shadow', color: '#000000', opacity: 0.2, visible: true }] }),
    mk({ id: 'out', type: 'rect', fill: '#FF0000' }),
  ] as any[];
  const colors = collectSelectionColors(all, ['f']);
  expect(colors[0]).toMatchObject({ hex: '#212121', opacity: 100, count: 2 });
  const keys = colors.map((c) => c.key);
  expect(keys).toContain('#808080@100');
  expect(keys).toContain('#FFFFFF@20');
  expect(keys).toContain('#000000@20'); // sombra
  expect(keys).not.toContain('#FF0000@100'); // fora da seleção
});

test('as peças do aparelho (deviceChrome) também entram na lista de cores', () => {
  const all = [
    mk({ id: 'tela', type: 'frame', fill: '#1D1B1B' }),
    mk({ id: 'hora', parentId: 'tela', type: 'text', fill: '#FFFFFF', deviceChrome: true }),
    mk({ id: 'ilha', parentId: 'tela', type: 'rect', fill: '#000000', deviceChrome: true }),
  ] as any[];
  const keys = collectSelectionColors(all, ['tela']).map((c) => c.key);
  expect(keys).toContain('#FFFFFF@100');
  expect(keys).toContain('#000000@100');
});

test('trocar uma cor altera todas as ocorrências (fill, traço, sombra) só dentro da seleção', () => {
  const all = [
    mk({ id: 'f', type: 'frame', fill: '#FFFFFF' }),
    mk({ id: 'a', parentId: 'f', type: 'rect', fill: '#212121', stroke: '#212121', strokeWidth: 1 }),
    mk({ id: 'd', parentId: 'f', type: 'rect', fill: '#111111', effects: [{ id: 'e', type: 'drop-shadow', color: '#212121', opacity: 1, visible: true }] }),
    mk({ id: 'out', type: 'rect', fill: '#212121' }),
  ] as any[];
  const r = replaceSelectionColor(all, ['f'], { hex: '#212121', opacity: 100 }, { hex: '#FF6A00', opacity: 100 });
  expect(r.find((s) => s.id === 'a')!.fill).toBe('#FF6A00');
  expect(r.find((s) => s.id === 'a')!.stroke).toBe('#FF6A00');
  expect(r.find((s) => s.id === 'd')!.effects![0].color).toBe('#FF6A00');
  expect(r.find((s) => s.id === 'out')!.fill).toBe('#212121');
  // mudar só a opacidade
  const o = replaceSelectionColor(all, ['f'], { hex: '#212121', opacity: 100 }, { hex: '#212121', opacity: 40 });
  expect((o.find((s) => s.id === 'a')!.fills![0] as any).opacity).toBeCloseTo(0.4);
});

test('reparentDropped: camada criada/solta dentro de um frame vira filha do frame mais interno; fora, perde o pai', async () => {
  const { reparentDropped } = await import('../src/components/design2/constraints');
  const all = [
    mk({ id: 'tela', type: 'frame', x: 0, y: 0, width: 400, height: 800 }),
    mk({ id: 'card', parentId: 'tela', type: 'frame', x: 20, y: 100, width: 200, height: 150 }),
    mk({ id: 'r1', type: 'rect', x: 40, y: 120, width: 60, height: 30 }), // dentro do card
    mk({ id: 'r2', type: 'rect', x: 300, y: 500, width: 40, height: 40 }), // dentro da tela, fora do card
    mk({ id: 'r3', parentId: 'card', type: 'rect', x: 600, y: 900, width: 20, height: 20 }), // arrastado para fora de tudo
    mk({ id: 'outroRoot', type: 'frame', x: 0, y: 0, width: 400, height: 800, parentId: undefined }),
  ] as any[];
  const r = reparentDropped(all, ['r1', 'r2', 'r3'], 'create');
  expect(r.find((s) => s.id === 'r1')!.parentId).toBe('card');
  expect(r.find((s) => s.id === 'r2')!.parentId).not.toBe('card');
  expect(['tela', 'outroRoot']).toContain(r.find((s) => s.id === 'r2')!.parentId as string);
  expect(r.find((s) => s.id === 'r3')!.parentId).toBeUndefined();
  // frame de topo movido por cima de outro não aninha
  const mv = reparentDropped([mk({ id: 'a', type: 'frame', x: 0, y: 0, width: 100, height: 100 }), mk({ id: 'b', type: 'frame', x: 10, y: 10, width: 50, height: 50 })] as any[], ['b'], 'move');
  expect(mv.find((s) => s.id === 'b')!.parentId).toBeUndefined();
  // não vira pai de si mesmo / de um ancestral
  const cyc = reparentDropped([mk({ id: 'p', type: 'frame', x: 0, y: 0, width: 200, height: 200 }), mk({ id: 'c', parentId: 'p', type: 'frame', x: 10, y: 10, width: 50, height: 50 })] as any[], ['p'], 'create');
  expect(cyc.find((s) => s.id === 'p')!.parentId).toBeUndefined();
});
