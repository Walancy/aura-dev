import { test, expect } from 'bun:test';
import { wantsNewScreens } from '../src/components/design2/screenFlow';

test('detecta pedido de novas telas a partir da selecionada, e não confunde com edição', () => {
  for (const p of [
    'crie as outras telas desse sistema',
    'gere uma sequência de telas para o fluxo de pagamento',
    'faça 4 telas de cadastro de leilão seguindo esta tela',
    'crie uma tela de perfil',
    'monte o fluxo de checkout',
    'a partir desta tela crie as telas de relatório',
    'crie as próximas telas do onboarding',
  ]) expect(wantsNewScreens(p)).toBe(true);
  for (const p of [
    'troque a cor do botão para verde',
    'adicione um botão na tela',
    'mude o título desta tela',
    'aumente o espaçamento da tela',
    'remova o card de métricas',
    'deixe a tela mais compacta',
  ]) expect(wantsNewScreens(p)).toBe(false);
});
