import { test, expect } from 'bun:test';
import { reorderLayers } from '../src/components/design2/layersOrder';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, pageId: 'p', x: 0, y: 0, width: 10, height: 10, ...o });
const base = () => [
  mk({ id: 'tela', type: 'frame', zIndex: 10 }),
  mk({ id: 'a', parentId: 'tela', type: 'rect', zIndex: 11 }),
  mk({ id: 'card', parentId: 'tela', type: 'frame', zIndex: 12 }),
  mk({ id: 'c1', parentId: 'card', type: 'rect', zIndex: 13 }),
  mk({ id: 'b', parentId: 'tela', type: 'rect', zIndex: 14 }),
  mk({ id: 'outro', type: 'rect', zIndex: 15 }),
] as any[];
const order = (r: any[], parent: string) => r.filter((s) => s.parentId === parent).map((s) => s.id);
const zMonotone = (r: any[], ids: string[]) => ids.every((id, i) => i === 0 || r.find((s) => s.id === id)!.zIndex > r.find((s) => s.id === ids[i - 1])!.zIndex);

test('reordenar irmãos: array e zIndex ficam coerentes, nada fora do pai muda', () => {
  const r = reorderLayers(base(), 'b', 'a', 'before')!;
  expect(order(r, 'tela')).toEqual(['b', 'a', 'card']);
  expect(zMonotone(r, r.map((s) => s.id).filter((id) => ['tela', 'b', 'a', 'card', 'c1'].includes(id)))).toBe(true);
  expect(r.find((s) => s.id === 'outro')!.zIndex).toBe(15);
  expect(r.find((s) => s.id === 'tela')!.zIndex).toBe(10);
});

test('arrastar para DENTRO de um frame leva a camada (e os filhos) e muda o pai', () => {
  const r = reorderLayers(base(), 'a', 'card', 'inside')!;
  expect(r.find((s) => s.id === 'a')!.parentId).toBe('card');
  expect(order(r, 'card')).toEqual(['c1', 'a']);
  // arrastar o card (com o c1) para antes do 'a'
  const r2 = reorderLayers(base(), 'card', 'a', 'before')!;
  expect(order(r2, 'tela')).toEqual(['card', 'a', 'b']);
  expect(r2.find((s) => s.id === 'c1')!.parentId).toBe('card');
  expect(r2.findIndex((s) => s.id === 'c1')).toBe(r2.findIndex((s) => s.id === 'card') + 1);
});

test('movimentos inválidos: ciclo, nível raiz, peça do aparelho, soltar em não-contêiner', () => {
  expect(reorderLayers(base(), 'card', 'c1', 'before')).toBeNull(); // para dentro de si mesmo
  expect(reorderLayers(base(), 'a', 'outro', 'before')).toBeNull(); // alvo no nível raiz
  expect(reorderLayers(base(), 'a', 'b', 'inside')).toBeNull(); // b não é contêiner
  const chrome = [...base(), mk({ id: 'ilha', parentId: 'tela', type: 'rect', zIndex: 16, deviceChrome: true })] as any[];
  expect(reorderLayers(chrome, 'ilha', 'a', 'before')).toBeNull();
});
