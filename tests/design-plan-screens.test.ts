import { test, expect } from 'bun:test';
import { looksMultiScreen, buildPlanPrompt, parsePlan, screenPrompt } from '../src/components/design2/appPlan';
import { wantsNewScreens } from '../src/components/design2/screenFlow';

const frases = ['crie uma tela de login e crie o restante das telas do app', 'crie o restante das telas', 'faça as demais telas do sistema', 'crie as outras telas a partir desta'];
test('reconhece pedido de várias telas', () => {
  for (const f of frases) { expect(looksMultiScreen(f) || wantsNewScreens(f)).toBe(true); }
  expect(wantsNewScreens('crie o restante das telas')).toBe(true);
  expect(wantsNewScreens('adicione um botão na tela')).toBe(false);
  expect(looksMultiScreen('mude a cor da tela')).toBe(false);
});
test('plano conhece as telas existentes e o prompt de cada tela não repete o pedido', () => {
  const ex = [{ name: 'Home', summary: '393x852; textos: Dashboard | Active Flatcars | Containers' }];
  const pp = buildPlanPrompt('crie o restante das telas do app', undefined, undefined, null, undefined, ex);
  expect(pp).toContain('TELAS QUE JÁ EXISTEM');
  expect(pp).toContain('Active Flatcars');
  expect(pp).toContain('"app"');
  const plan = parsePlan(JSON.stringify({ app: 'Gestão logística de vagões', width: 393, height: 852, style: 'x', screens: [{ name: 'Detalhe', brief: 'detalhe do vagão' }, { name: 'Mapa', brief: 'mapa' }] }))!;
  expect(plan.app).toContain('logística');
  const sp = screenPrompt('crie o restante das telas do app\n\n(Formato detectado: MOBILE)', plan, 1, { request: 'crie o restante das telas do app', existing: ex });
  expect(sp).toContain('APP: Gestão logística');
  expect(sp).toContain('NÃO recrie nem copie');
  expect(sp).toContain('TELA 2 DE 2: "Mapa"');
  expect(sp.match(/crie o restante das telas do app/g)!.length).toBe(1); // só dentro do contexto citado
});
