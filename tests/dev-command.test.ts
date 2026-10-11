import { test, expect } from 'bun:test';
import { detectDevCommand } from '../src/utils/devCommand';

const pkg = (o: any) => JSON.stringify(o);

test('gerenciador pelo campo packageManager e depois pelo lockfile', () => {
  expect(detectDevCommand({ rootFiles: ['package-lock.json'], packageJsonText: pkg({ scripts: { dev: 'vite' } }) })?.command).toBe('npm run dev');
  expect(detectDevCommand({ rootFiles: ['bun.lock'], packageJsonText: pkg({ scripts: { dev: 'vite' } }) })?.command).toBe('bun run dev');
  expect(detectDevCommand({ rootFiles: ['yarn.lock'], packageJsonText: pkg({ scripts: { start: 'node .' } }) })?.command).toBe('yarn start');
  expect(detectDevCommand({ rootFiles: ['package-lock.json'], packageJsonText: pkg({ packageManager: 'pnpm@9.1.0', scripts: { dev: 'x' } }) })?.command).toBe('pnpm dev');
  expect(detectDevCommand({ rootFiles: [], packageJsonText: pkg({ scripts: { start: 'node .' } }) })?.command).toBe('npm start');
});

test('prioriza dev e start:dev; outras stacks', () => {
  expect(detectDevCommand({ rootFiles: [], packageJsonText: pkg({ scripts: { start: 'a', 'start:dev': 'b' } }) })?.command).toBe('npm run start:dev');
  expect(detectDevCommand({ rootFiles: ['manage.py'] })?.command).toBe('python manage.py runserver');
  expect(detectDevCommand({ rootFiles: ['Makefile'], makefileText: 'build:\n\tx\ndev:\n\ty' })?.command).toBe('make dev');
  expect(detectDevCommand({ rootFiles: ['deno.json'], denoJsonText: '{"tasks":{"dev":"deno run x"}}' })?.command).toBe('deno task dev');
  expect(detectDevCommand({ rootFiles: [] })).toBeNull();
});

test('vários locks: vale o gerenciador do lock mais recente; Flutter usa flutter run', () => {
  const p = JSON.stringify({ scripts: { dev: 'vite' } });
  expect(detectDevCommand({ rootFiles: ['bun.lock', 'package-lock.json'], packageJsonText: p, lockMtimes: { 'bun.lock': 100, 'package-lock.json': 200 } })?.command).toBe('npm run dev');
  expect(detectDevCommand({ rootFiles: ['bun.lock', 'package-lock.json'], packageJsonText: p, lockMtimes: { 'bun.lock': 300, 'package-lock.json': 200 } })?.command).toBe('bun run dev');
  expect(detectDevCommand({ rootFiles: ['pubspec.yaml', 'pubspec.lock'] })?.command).toBe('flutter run');
});

test('empate de datas nos locks: o que os scripts citam decide', () => {
  const same = { 'bun.lock': 5, 'package-lock.json': 5 };
  expect(detectDevCommand({ rootFiles: ['bun.lock', 'package-lock.json'], packageJsonText: JSON.stringify({ scripts: { dev: 'vite', build: 'npm run lint && vite build' } }), lockMtimes: same })?.command).toBe('npm run dev');
  expect(detectDevCommand({ rootFiles: ['bun.lock', 'package-lock.json'], packageJsonText: JSON.stringify({ scripts: { dev: 'vite' } }), lockMtimes: same })?.command).toBe('bun run dev');
});

import { scriptCommand } from '../src/utils/devCommand';
test('scriptCommand: --force repassado ao script em cada gerenciador', () => {
  expect(scriptCommand('npm', 'dev')).toBe('npm run dev');
  expect(scriptCommand('npm', 'dev', true)).toBe('npm run dev -- --force');
  expect(scriptCommand('npm', 'start', true)).toBe('npm start -- --force');
  expect(scriptCommand('bun', 'dev', true)).toBe('bun run dev --force');
  expect(scriptCommand('yarn', 'dev', true)).toBe('yarn dev --force');
  expect(scriptCommand('pnpm', 'dev', true)).toBe('pnpm dev --force');
});
