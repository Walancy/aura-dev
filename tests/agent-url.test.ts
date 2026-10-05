import { describe, expect, it } from 'bun:test';
import { extractAgentOpenUrl, withScheme } from '../src/utils/agentUrl';

const prompt = 'Informe a URL (ex: http://<nome-app>.localhost:1355 ou http://localhost:PORTA). Finalize com DEVFLOW_OPEN_URL=<url completa>';

describe('agentUrl', () => {
  it('ignora URLs de exemplo do eco do prompt', () => {
    expect(extractAgentOpenUrl(prompt, prompt)).toBeNull();
  });
  it('usa o marcador explícito, mesmo com o eco do prompt antes', () => {
    expect(extractAgentOpenUrl(`${prompt}\nPronto.\nDEVFLOW_OPEN_URL=http://localhost:5173`, prompt)).toBe('http://localhost:5173');
  });
  it('sem marcador, pega a última URL local fora do prompt', () => {
    expect(extractAgentOpenUrl(`${prompt}\nrodando em http://localhost:3000/ e depois localhost:5173.`, prompt)).toBe('http://localhost:5173');
  });
  it('aceita *.localhost (portless) e ignora links externos de documentação', () => {
    expect(extractAgentOpenUrl('veja https://vitejs.dev e abra http://meuapp.localhost:1355', '')).toBe('http://meuapp.localhost:1355');
    expect(extractAgentOpenUrl('veja https://vitejs.dev', '')).toBeNull();
  });
  it('withScheme usa http para localhost e https para o resto', () => {
    expect(withScheme('localhost:3000')).toBe('http://localhost:3000');
    expect(withScheme('app.localhost:1355')).toBe('http://app.localhost:1355');
    expect(withScheme('apple.com')).toBe('https://apple.com');
  });
});
