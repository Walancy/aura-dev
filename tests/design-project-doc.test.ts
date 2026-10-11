import { test, expect, beforeEach } from 'bun:test';
import { readProjectShapes, updateProjectShapes, waitWrites } from '../src/components/design2/projectDoc';

const files = new Map<string, string>();
let delay = 0;
beforeEach(() => {
  files.clear();
  delay = 0;
  (globalThis as any).window = {
    electronAPI: {
      fs: {
        readFile: async (p: string) => (files.has(p) ? { content: files.get(p) } : { content: '' }),
        writeFile: async (p: string, c: string) => {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          files.set(p, c);
        },
      },
    },
  };
});
const sh = (id: string, extra: any = {}) => ({ id, type: 'rect', name: id, x: 0, y: 0, width: 1, height: 1, rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, ...extra }) as any;
const path = '/proj/.devflow/design2/design.json';

test('projeto sem arquivo: cria só com as shapes novas', async () => {
  await updateProjectShapes('/proj', (all) => [...all, sh('a')]);
  const doc = JSON.parse(files.get(path)!);
  expect(doc.shapes.map((s: any) => s.id)).toEqual(['a']);
  expect(doc.shapes[0].pageId).toBeUndefined(); // gravado como veio; a leitura normaliza
  expect((await readProjectShapes('/proj'))[0].pageId).toBe('page-1');
});

test('preserva páginas, estilos e demais campos do documento', async () => {
  files.set(path, JSON.stringify({ shapes: [sh('x', { pageId: 'page-2' })], pages: [{ id: 'page-2', name: 'Tela' }], selectedPageId: 'page-2', styles: [{ id: 's1' }], guides: { g: [] } }));
  await updateProjectShapes('/proj', (all) => [...all, sh('y', { pageId: 'page-2' })]);
  const doc = JSON.parse(files.get(path)!);
  expect(doc.shapes.map((s: any) => s.id)).toEqual(['x', 'y']);
  expect(doc.pages).toEqual([{ id: 'page-2', name: 'Tela' }]);
  expect(doc.selectedPageId).toBe('page-2');
  expect(doc.styles).toEqual([{ id: 's1' }]);
});

test('gravações do mesmo projeto são serializadas (sem perder nenhuma) e a leitura espera', async () => {
  delay = 15;
  const ws = '/proj';
  const writes = [1, 2, 3, 4].map((n) => updateProjectShapes(ws, (all) => [...all, sh(`s${n}`)]));
  // leitura iniciada com gravações em andamento enxerga todas
  const read = readProjectShapes(ws);
  await Promise.all(writes);
  expect((await read).map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
  await waitWrites(ws);
  expect(JSON.parse(files.get(path)!).shapes).toHaveLength(4);
});

test('projetos diferentes não se misturam', async () => {
  await updateProjectShapes('/a', (all) => [...all, sh('a1')]);
  await updateProjectShapes('/b', (all) => [...all, sh('b1')]);
  expect((await readProjectShapes('/a')).map((s) => s.id)).toEqual(['a1']);
  expect((await readProjectShapes('/b')).map((s) => s.id)).toEqual(['b1']);
});
