import { describe, expect, it } from 'bun:test';
import { backupBeforeSave } from '../src/components/design2/usePersistedDesign';

const fsWith = (content: string | undefined) => {
  const writes: Array<[string, string]> = [];
  return { writes, readFile: async () => ({ content }), writeFile: async (p: string, c: string) => { writes.push([p, c]); } };
};

describe('backup rotativo do design', () => {
  it('guarda o conteúdo atual numa vaga e não repete antes de 10 minutos', async () => {
    const fs = fsWith('{"antigo":1}');
    const t0 = 1_000_000_000_000;
    await backupBeforeSave('/p/.devflow/design2/a.json', '{"novo":1}', fs, t0);
    expect(fs.writes).toHaveLength(1);
    expect(fs.writes[0][0]).toMatch(/\/p\/\.devflow\/design2\/backup\/design-[0-5]\.json$/);
    expect(fs.writes[0][1]).toBe('{"antigo":1}');
    await backupBeforeSave('/p/.devflow/design2/a.json', '{"novo":2}', fs, t0 + 60_000);
    expect(fs.writes).toHaveLength(1);
    await backupBeforeSave('/p/.devflow/design2/a.json', '{"novo":3}', fs, t0 + 11 * 60_000);
    expect(fs.writes).toHaveLength(2);
  });

  it('não faz backup se o arquivo não existe ou não mudou', async () => {
    const none = fsWith(undefined);
    await backupBeforeSave('/x/b.json', 'a', none, 5_000_000_000_000);
    expect(none.writes).toHaveLength(0);
    const same = fsWith('igual');
    await backupBeforeSave('/x/c.json', 'igual', same, 5_000_000_000_000);
    expect(same.writes).toHaveLength(0);
  });

  it('falha de leitura não derruba o salvamento', async () => {
    await backupBeforeSave('/x/d.json', 'a', { readFile: async () => { throw new Error('x'); } }, 6_000_000_000_000);
  });
});
