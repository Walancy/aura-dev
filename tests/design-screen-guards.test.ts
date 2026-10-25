import { test, expect } from 'bun:test';
import { ScreenBuilder } from '../src/components/design2/aiScreenFromLlm';
import { isEntryScreen, parsePlan, screenPrompt } from '../src/components/design2/appPlan';

const mk = (name: string) => { const b = new ScreenBuilder({ pageId: 'p', startX: 0, startY: 0, isDark: true, accentColor: '#C6F432', plainDevice: true, maxScreens: 1 } as any); b.startScreen({ name, width: 393, height: 852, background: '#0B0D10' }); return b; };
const root = { type: 'frame', id: 'raiz', name: 'Conteúdo', layout: 'vertical', gap: 12, padding: [60, 16, 20, 16], x: 0, y: 0, width: 393, height: 852, fill: 'transparent' };
const nav = [
  { type: 'frame', id: 'nav', name: 'Barra de navegação', pin: 'bottom', layout: 'horizontal', width: 393, height: 80, fill: '#111' },
  { type: 'icon', parent: 'nav', name: 'Home', size: 24, fill: '#fff' },
];

test('navbar some na tela de login e fica nas telas principais', () => {
  const icons = { Home: 'M0 0' } as any;
  const a = mk('Login'); (a as any).req.icons = icons;
  for (const it of [root, ...nav]) { if (a.addItem(it)) a.settle(); }
  expect(a.all.some((s) => /navega/i.test(s.name || ''))).toBe(false);
  expect(a.all.some((s) => s.type === 'path')).toBe(false);
  const b = mk('Início'); (b as any).req.icons = icons;
  for (const it of [root, ...nav]) { if (b.addItem(it)) b.settle(); }
  expect(b.all.some((s) => /navega/i.test(s.name || ''))).toBe(true);
});

test('botão gigante volta a se ajustar ao conteúdo', () => {
  const b = mk('Treinos');
  for (const it of [root,
    { type: 'frame', id: 'btn', parent: 'raiz', name: 'Entrar', layout: 'horizontal', align: 'center', padding: 60, width: 'fill', height: 200, fill: '#C6F432', cornerRadius: 16 },
    { type: 'text', parent: 'btn', text: 'Entrar', fontSize: 16, fill: '#000' }]) { if (b.addItem(it)) b.settle(); }
  const btn = b.all.find((s) => s.name === 'Entrar' && s.type === 'frame')!;
  expect(btn.height).toBeLessThanOrEqual(64);
});

test('plano marca telas de entrada sem navbar', () => {
  expect(isEntryScreen('Login')).toBe(true);
  expect(isEntryScreen('Recuperar senha')).toBe(true);
  expect(isEntryScreen('Treinos')).toBe(false);
  const plan = parsePlan(JSON.stringify({ app: 'x', style: 's', screens: [{ name: 'Login', brief: 'b', nav: true }, { name: 'Início', brief: 'b', nav: true }] }))!;
  expect(plan.screens[0].nav).toBe(false);
  expect(screenPrompt('p', plan, 0)).toContain('Barra de navegação inferior: NÃO');
  expect(screenPrompt('p', plan, 1)).toContain('Barra de navegação inferior: SIM');
});
