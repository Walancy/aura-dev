import { describe, expect, it } from 'bun:test';
import { removeBackground, type RemoveBgDeps } from '../src/components/design2/removeBg';

const deps = (over: Partial<RemoveBgDeps> = {}): RemoveBgDeps & { cmds: string[] } => {
  const cmds: string[] = [];
  return {
    cmds,
    saveTempImage: async (_b64, ext) => ({ path: `/tmp/img-1.${ext}` }),
    exec: async (c) => { cmds.push(c); return { stdout: '', stderr: '', exitCode: 0 }; },
    readDataUrl: async () => ({ dataUrl: 'data:image/png;base64,RESULT' }),
    ...over,
  };
};

describe('remover fundo', () => {
  it('salva, roda o rembg e devolve o PNG resultante', async () => {
    const d = deps();
    const r = await removeBackground('data:image/jpeg;base64,AAAA', d);
    expect(r).toEqual({ dataUrl: 'data:image/png;base64,RESULT' });
    expect(d.cmds[0]).toBe("rembg i '/tmp/img-1.jpg' '/tmp/img-1-sem-fundo.png'");
  });

  it('sem o rembg instalado explica como instalar', async () => {
    const r = await removeBackground('data:image/png;base64,AAAA', deps({ exec: async () => ({ stdout: '', stderr: 'zsh: command not found: rembg', exitCode: 127 }) }));
    expect(r.error).toContain('pip install');
  });

  it('erro do rembg vira mensagem; URL que não é data URL é recusada', async () => {
    const r = await removeBackground('data:image/png;base64,AAAA', deps({ exec: async () => ({ stdout: '', stderr: 'x\nModelo corrompido', exitCode: 1 }) }));
    expect(r.error).toBe('rembg falhou: Modelo corrompido');
    expect((await removeBackground('https://x.com/a.png', deps())).error).toContain('data URL');
  });

  it('falha ao ler o resultado', async () => {
    const r = await removeBackground('data:image/png;base64,AAAA', deps({ readDataUrl: async () => ({ error: 'sumiu' }) }));
    expect(r.error).toBe('sumiu');
  });
});
