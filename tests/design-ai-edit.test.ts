import { test, expect } from 'bun:test';
import { applyAiEdits, editScope } from '../src/components/design2/aiEdit';
import { parseAiScreenResponse } from '../src/components/design2/aiScreenFromLlm';
import { resolveIconName, searchIcons } from '../src/components/design2/icons';
import icons from '../src/components/design2/materialIcons.json';

const cat = icons as Record<string, string>;
const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
const ctx = { pageId: 'p', isDark: true, accentColor: '#f90', icons: cat };

test('busca e resolução de ícones', () => {
  expect(searchIcons(cat, 'home')[0]).toBe('Home');
  expect(searchIcons(cat, 'add photo').length).toBeGreaterThan(0);
  expect(resolveIconName(cat, 'home_outlined')).toBe('Home');
  expect(resolveIconName(cat, 'search')).toBe('Search');
  expect(resolveIconName(cat, 'naoExiste123')).toBeNull();
});

test('várias telas e ícones', () => {
  const raw = JSON.stringify({ screens: [
    { name: 'A', width: 390, height: 844, shapes: [{ type: 'icon', name: 'Home', x: 10, y: 10, size: 24 }, { type: 'icon', name: 'Zzz999', x: 0, y: 0 }] },
    { name: 'B', width: 390, height: 844, shapes: [{ type: 'text', text: 'Oi', x: 0, y: 0, width: 100, height: 20 }] },
  ] });
  const r = parseAiScreenResponse(raw, { pageId: 'p', startX: 0, startY: 0, isDark: true, accentColor: '#f90', icons: cat })!;
  expect(r.shapes.filter((s) => s.type === 'frame' && !s.parentId)).toHaveLength(2);
  expect(r.shapes.filter((s) => s.iconName === 'Home')).toHaveLength(1);
  expect(r.shapes.some((s) => s.iconName === 'Zzz999')).toBe(false);
  const [f1, f2] = r.shapes.filter((s) => s.type === 'frame' && !s.parentId);
  expect(f2.x).toBeGreaterThan(f1.x + f1.width);
  expect(f1.parentId).toBeUndefined();
  expect(r.width).toBe((390 + 28) * 2 + 120); // largura do corpo do aparelho (tela + bordas)
});

test('edição da seleção respeita o escopo', () => {
  const all = [
    mk({ id: 'f', type: 'frame', name: 'F', x: 0, y: 0, width: 200, height: 200 }),
    mk({ id: 't', type: 'text', name: 'T', parentId: 'f', x: 10, y: 10, width: 100, height: 20, text: 'a', fontSize: 14 }),
    mk({ id: 'out', type: 'rect', name: 'Fora', x: 500, y: 0, width: 10, height: 10 }),
  ] as any[];
  const scope = editScope(all, ['f']);
  expect(scope.map((s) => s.id)).toEqual(['f', 't']);
  const raw = JSON.stringify({
    edits: [{ id: 't', set: { fill: '#ff0000', text: 'novo', evil: 1 } }, { id: 'out', set: { fill: '#00ff00' } }, { id: 'f', set: { x: 50 } }],
    add: [{ type: 'icon', name: 'Search', parentId: 'f', x: 5, y: 5, size: 20 }],
    remove: ['f', 't'],
  });
  const r = applyAiEdits(raw, all, scope, ['f'], ctx)!;
  expect(r.shapes.find((s) => s.id === 'out')!.fill).toBe('#000');
  expect(r.shapes.find((s) => s.id === 'f')).toBeTruthy(); // raiz não é removida
  expect(r.removed).toBe(1);
  expect(r.added).toBe(1);
  expect(r.shapes.find((s) => s.id === 't')).toBeUndefined();
  const icon = r.shapes.find((s) => s.iconName === 'Search')!;
  expect(icon.x).toBe(50 + 5);
  expect(applyAiEdits('lixo', all, scope, ['f'], ctx)).toBeNull();
});

test('busca em pt-BR e por contexto', () => {
  const has = (q: string, n: string) => searchIcons(cat, q, 300).includes(n);
  expect(has('casa', 'Home')).toBe(true);
  expect(has('viagem', 'Luggage')).toBe(true);
  expect(has('viagem', 'Flight')).toBe(true);
  expect(has('viagem', 'DirectionsCar')).toBe(true);
  expect(has('avião', 'Flight')).toBe(true);
  expect(has('configurações', 'Settings')).toBe(true);
  expect(has('viag', 'Luggage')).toBe(true);
  expect(has('seta direita', 'ArrowForward') || has('seta direita', 'ArrowRight')).toBe(true);
  expect(searchIcons(cat, 'zzzxxx')).toEqual([]);
});
