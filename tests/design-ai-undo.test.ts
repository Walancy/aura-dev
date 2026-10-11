import { test, expect } from 'bun:test';
import { restorePrevious, reviewAfterUndo, withPrevious, type AiReviewEntry } from '../src/components/design2/aiReviewUndo';

const mk = (id: string, extra: any = {}) => ({ id, type: 'frame', name: id, x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...extra }) as any;

test('regerar guarda a versão substituída; desfazer troca a nova pela antiga (com os filhos)', () => {
  const oldTree = [mk('old'), mk('old-child', { parentId: 'old' })];
  const other = mk('other');
  const entry = withPrevious({ id: 'new', prompt: 'p' }, oldTree, { id: 'old', prompt: 'p0', busy: true });
  expect(entry.previous).toHaveLength(2);
  expect(entry.prevEntry).toEqual({ id: 'old', prompt: 'p0', busy: false, previous: undefined, prevEntry: undefined });
  // documento atual: a nova versão (com filhos) no lugar da antiga
  const doc = [other, mk('new'), mk('new-a', { parentId: 'new' }), mk('new-b', { parentId: 'new-a' })];
  const back = restorePrevious(doc, 'new', entry.previous!);
  expect(back.map((s) => s.id).sort()).toEqual(['old', 'old-child', 'other']);
  // a restauração é idempotente (não duplica)
  expect(restorePrevious(back, 'new', entry.previous!).map((s) => s.id).sort()).toEqual(['old', 'old-child', 'other']);
});

test('depois de desfazer, a entrada da tela antiga volta (Aceitar/Regerar) e a da nova sai', () => {
  const prevEntry: AiReviewEntry = { id: 'old', prompt: 'p0', w: 393, h: 852 };
  const entry = withPrevious({ id: 'new', prompt: 'p' }, [mk('old')], prevEntry);
  const list: AiReviewEntry[] = [entry, { id: 'x', prompt: 'outra' }];
  const after = reviewAfterUndo(list, entry);
  expect(after.map((r) => r.id).sort()).toEqual(['old', 'x']);
  expect(after.find((r) => r.id === 'old')!.previous).toBeUndefined(); // sem desfazer em cadeia
});

test('frame feito à mão (sem entrada anterior): desfazer restaura e não cria revisão', () => {
  const entry = withPrevious({ id: 'new', prompt: 'p' }, [mk('manual')]);
  expect(entry.prevEntry).toBeUndefined();
  expect(reviewAfterUndo([entry], entry)).toEqual([]);
});

test('geração nova (nada substituído) não tem desfazer', () => {
  const entry = withPrevious({ id: 'n', prompt: 'p' }, []);
  expect(entry.previous).toBeUndefined();
});
