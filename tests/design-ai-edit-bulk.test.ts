import { test, expect } from 'bun:test';
import { applyAiEdits, editScope } from '../src/components/design2/aiEdit';

const mk = (id: string, o: any): any => ({ id, type: 'frame', name: id, x: 0, y: 0, width: 100, height: 50, rotation: 0, fill: '#FFFFFF', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, pageId: 'p', visible: true, ...o });
const stroke = { stroke: '#CCCCCC', strokeWidth: 1, strokes: [{ id: 's', color: '#CCCCCC', opacity: 1, visible: true, width: 1 }] };
const shapes = [
  mk('screen', { width: 393, height: 852, cornerRadius: 55 }),
  mk('content', { parentId: 'screen', hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 31, paddingTop: 5, paddingRight: 5, paddingBottom: 5, paddingLeft: 5, independentPadding: true }),
  mk('card1', { parentId: 'content', cornerRadius: 16, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 7, fills: [{ id: 'f', color: '#FFFFFF', opacity: 1, visible: true, type: 'solid' }], ...stroke }),
  mk('t1', { parentId: 'card1', type: 'text', text: 'Oi', fontSize: 14 }),
  mk('t2', { parentId: 'card1', type: 'text', text: 'Ola', fontSize: 14 }),
  mk('chip', { parentId: 'content', cornerRadius: 20, width: 60, height: 24, ...stroke }),
];
const scope = editScope(shapes, ['content']);
const ctx = { pageId: 'p', isDark: false, accentColor: '#2563EB' };

test('bulk: remove borda, raio dos cards, espaçamento, e cor via fills', () => {
  const raw = JSON.stringify({ bulk: [
    { where: { hasStroke: true }, set: { stroke: 'none' } },
    { where: { type: 'frame', hasRadius: true, minChildren: 2 }, set: { cornerRadius: 0 } },
    { where: { hasAutoLayout: true }, set: { gap: 12, padding: [16, 16, 16, 16] } },
  ], edits: [{ id: 'chip', set: { fill: '#FF0000' } }] });
  const r = applyAiEdits(raw, shapes, scope, ['content'], ctx)!;
  const g = (id: string) => r.shapes.find((s) => s.id === id)!;
  expect(g('card1').strokes).toEqual([]);
  expect(g('card1').stroke).toBe('none');
  expect(g('chip').strokes).toEqual([]);
  expect(g('card1').cornerRadius).toBe(0);
  expect(g('chip').cornerRadius).toBe(20); // chip não é card (sem filhos)
  expect(g('content').layoutGap).toBe(12);
  expect(g('content').paddingTop).toBe(16);
  expect(g('card1').layoutGap).toBe(12);
  expect(g('screen').cornerRadius).toBe(55); // raiz intacta
  expect(g('chip').fills).toEqual([{ id: 'f0', color: '#FF0000', opacity: 1, visible: true, type: 'solid' }]);
  expect(r.changed).toBeGreaterThan(2);
});
