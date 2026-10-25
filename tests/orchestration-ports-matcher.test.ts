import { test, expect } from 'bun:test';
import { extractPortFromContent, extractPortFromUrl, frameworkDefaultPort } from '../src/utils/projectDevUrl';
import { findProjectsInText, isProjectOpenIntent } from '../src/utils/projectMatcher';

test('porta do server, ignorando a do proxy dentro do bloco', () => {
  const vite = `export default { server: { proxy: { '/api': { target: 'http://localhost:3333' } }, port: 5174 } }`;
  expect(extractPortFromContent(vite, 'vite.config.ts')).toBe(5174);
});

test('localhost solto (API/banco) não vira a porta do dev', () => {
  expect(extractPortFromContent('DATABASE_URL=postgres://localhost:5432/db\nVITE_API_URL=http://localhost:3333', '.env')).toBeNull();
  expect(extractPortFromContent('{"scripts":{"dev":"vite --port 5199"}}', 'package.json')).toBe(5199);
  expect(extractPortFromContent('PORT=4010\n', '.env')).toBe(4010);
});

test('porta padrão pelo framework', () => {
  expect(frameworkDefaultPort('{"dependencies":{"next":"14"}}')).toBe(3000);
  expect(frameworkDefaultPort('{"devDependencies":{"vite":"5"}}')).toBe(5173);
  expect(frameworkDefaultPort('{"dependencies":{"@angular/core":"17"}}')).toBe(4200);
  expect(frameworkDefaultPort('{"dependencies":{"express":"4"}}')).toBeNull();
});

test('porta da URL, não o primeiro ":número" da string', () => {
  expect(extractPortFromUrl('http://localhost:5173')).toBe(5173);
  expect(extractPortFromUrl('localhost:3000/app')).toBe(3000);
  expect(extractPortFromUrl('http://user:8080@example.com/x')).toBeNull();
  expect(extractPortFromUrl('https://example.com/a:123')).toBeNull();
  expect(extractPortFromUrl('')).toBeNull();
});

const cands = [
  { id: 'api', name: 'estancia-bahia-api', devUrl: 'http://localhost:3001' },
  { id: 'painel', name: 'estancia-bahia-painel-interno', devUrl: 'http://localhost:3002' },
  { id: 'aura', name: 'aura-dev', devUrl: 'http://localhost:5173' },
];

test('projeto irmão mais específico vence', () => {
  const r = findProjectsInText('abre o projeto estancia-bahia-painel-interno', cands);
  expect(r.map((p) => p.id)).toEqual(['painel']);
});

test('dois projetos citados separadamente abrem os dois, na ordem do texto', () => {
  const r = findProjectsInText('abre o aura-dev e depois o estancia-bahia-api', cands);
  expect(r.map((p) => p.id)).toEqual(['aura', 'api']);
});

test('formas coloquiais de "abrir" contam como intenção', () => {
  for (const t of ['abre o projeto estancia bahia', 'roda o app', 'mostra o painel', 'sobe o servidor']) expect(isProjectOpenIntent(t)).toBe(true);
  expect(isProjectOpenIntent('escreva um poema')).toBe(false);
});
