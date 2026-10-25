import { test, expect } from 'bun:test';
import { resolveBrowserUrlFromInput } from '../src/utils/browserUrl';

test('URL explícita no texto vence tudo', () => {
  expect(resolveBrowserUrlFromInput('Abra https://example.com no componente de navegador.')).toBe('https://example.com');
  expect(resolveBrowserUrlFromInput('veja localhost:5173/app')).toBe('http://localhost:5173/app');
});

test('nome de serviço solto na saída crua do terminal NÃO abre o site', () => {
  const ruido = '◐ medium · /effort ❯ nd✳✢ thinking g1 ethinking x claude apple maps thinking';
  expect(resolveBrowserUrlFromInput(ruido)).not.toContain('g1.globo.com');
  expect(resolveBrowserUrlFromInput(ruido)).not.toBe('https://x.com');
  expect(resolveBrowserUrlFromInput(ruido)).not.toBe('https://claude.ai');
  expect(resolveBrowserUrlFromInput('o Claude sugeriu x e y')).not.toBe('https://claude.ai');
});

test('com intenção de abrir, o serviço abre', () => {
  expect(resolveBrowserUrlFromInput('Abra o youtube no navegador.')).toBe('https://www.youtube.com');
  expect(resolveBrowserUrlFromInput('acesse o github')).toBe('https://www.github.com');
  expect(resolveBrowserUrlFromInput('ir para o g1')).toBe('https://g1.globo.com');
  expect(resolveBrowserUrlFromInput('abra o youtube e busque rock')).toContain('results?search_query=rock');
});

test('busca direcionada a um serviço continua funcionando', () => {
  expect(resolveBrowserUrlFromInput('pesquisar rock no youtube')).toContain('results?search_query=rock');
  expect(resolveBrowserUrlFromInput('buscar react no github')).toContain('github.com/search?q=react');
});
