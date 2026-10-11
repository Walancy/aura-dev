import { test, expect } from 'bun:test';
import { looksMultiScreen, parsePlan, screenPrompt } from '../src/components/design2/appPlan';

test('detecta pedidos de várias telas', () => {
  expect(looksMultiScreen('crie o fluxo de cadastro do app')).toBe(true);
  expect(looksMultiScreen('app de delivery com 6 telas')).toBe(true);
  expect(looksMultiScreen('as telas de login e cadastro')).toBe(true);
  expect(looksMultiScreen('uma tela de login moderna')).toBe(false);
  expect(looksMultiScreen('crie 1 tela de perfil')).toBe(false);
});

test('parsePlan lê telas e estilo, ignora lixo e limita', () => {
  const p = parsePlan('```json\n{"width":393,"height":852,"style":"laranja","screens":[{"name":"Login","brief":"campos"},{"name":""},{"name":"Home","brief":"lista"}]}\n```')!;
  expect(p.screens.map((s) => s.name)).toEqual(['Login', 'Home']);
  expect(p.style).toBe('laranja');
  expect(parsePlan('nada')).toBeNull();
  expect(parsePlan(JSON.stringify({ screens: Array.from({ length: 30 }, (_, i) => ({ name: `T${i}` })) }))!.screens.length).toBe(12);
});

test('screenPrompt pede só a tela e repete o design system', () => {
  const plan = parsePlan('{"style":"fundo #111","screens":[{"name":"Login","brief":"a"},{"name":"Home","brief":"b"}]}')!;
  const t = screenPrompt('app x', plan, 1);
  expect(t).toContain('TELA 2 DE 2');
  expect(t).toContain('"Home"');
  expect(t).toContain('fundo #111');
  expect(t).toContain('1. Login | 2. Home');
});

test('com maxScreens=1 o prompt pede uma única tela (sem o formato de várias)', async () => {
  const { buildAiScreenPrompt } = await import('../src/components/design2/aiScreenFromLlm');
  const base = { prompt: 'x', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: true } as any;
  expect(buildAiScreenPrompt({ ...base, maxScreens: 1 })).not.toContain('VÁRIAS TELAS');
  expect(buildAiScreenPrompt(base)).toContain('VÁRIAS TELAS');
});
