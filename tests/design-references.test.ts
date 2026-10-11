import { describe, expect, it } from 'bun:test';
import { listRefs, matchRefs, readRef, saveRefs, tagsFrom, type RefFs } from '../src/components/design2/references';

const memFs = (): RefFs & { files: Map<string, string> } => {
  const files = new Map<string, string>();
  return { files, readFile: async (p) => (files.has(p) ? { content: files.get(p) } : { error: 'nao existe' }), writeFile: async (p, c) => { files.set(p, c); } };
};
const img = (n: string) => `data:image/jpeg;base64,${'A'.repeat(40)}${n}`;

describe('biblioteca local de referências', () => {
  it('etiquetas: sem acento, sem palavras vazias, únicas', () => {
    expect(tagsFrom('Crie uma tela de LOGIN para o app de saúde, login moderno')).toEqual(['login', 'saude', 'moderno']);
  });

  it('salva a imagem e o índice no projeto, e lista depois', async () => {
    const fs = memFs();
    const r = await saveRefs('/p', [img('x')], 'tela de login escura', fs, 1000);
    expect(r).toHaveLength(1);
    expect([...fs.files.keys()].some((k) => k.startsWith('/p/.devflow/design2/references/ref-') && k.endsWith('.txt'))).toBe(true);
    expect((await listRefs('/p', fs))[0].tags).toEqual(['login', 'escura']);
  });

  it('a mesma imagem não entra duas vezes', async () => {
    const fs = memFs();
    await saveRefs('/p', [img('x')], 'login', fs, 1);
    expect(await saveRefs('/p', [img('x')], 'login', fs, 2)).toHaveLength(1);
  });

  it('só guarda imagens (data URL) e mantém no máximo 60', async () => {
    const fs = memFs();
    expect(await saveRefs('/p', ['https://x.com/a.png', 'texto'], 'login', fs)).toEqual([]);
    for (let i = 0; i < 65; i++) await saveRefs('/p', [img(String(i))], 'login', fs, i + 1);
    expect(await listRefs('/p', fs)).toHaveLength(60);
  });

  it('matchRefs escolhe as com mais etiquetas em comum; empate pela mais recente', () => {
    const list = [
      { id: 'a', file: 'a.txt', tags: ['login', 'escuro'], addedAt: 1 },
      { id: 'b', file: 'b.txt', tags: ['login'], addedAt: 5 },
      { id: 'c', file: 'c.txt', tags: ['dashboard'], addedAt: 9 },
    ];
    expect(matchRefs(list, 'tela de login escuro').map((e) => e.id)).toEqual(['a', 'b']);
    expect(matchRefs(list, 'tela de login', 1).map((e) => e.id)).toEqual(['b']);
    expect(matchRefs(list, 'algo sem relação')).toEqual([]);
  });

  it('readRef devolve a imagem ou null', async () => {
    const fs = memFs();
    const [e] = await saveRefs('/p', [img('y')], 'login', fs, 1);
    expect(await readRef('/p', e, fs)).toBe(img('y'));
    expect(await readRef('/p', { ...e, file: 'sumiu.txt' }, fs)).toBeNull();
  });
});
