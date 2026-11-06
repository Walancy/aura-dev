import { test, expect, beforeEach } from 'bun:test';
import {
  ALL_TUTORIAL_CONTEXT_IDS,
  countSeenTutorials,
  hasSeenScreenTutorial,
  markScreenTutorialSeen,
  pushTutorialOverlay,
  removeTutorialOverlay,
  requestTutorialStart,
  resetAllScreenTutorials,
  resetTutorialRuntimeState,
  resolveActiveTutorialContext,
  resolveStepsForScreen,
  SCREEN_TUTORIAL_LABELS,
  setProjectSubflowContext,
  subscribeTutorialRequests,
  type TutorialContextId,
} from '../src/components/tutorial/tutorialStore';

const memoryStorage = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, val: string) => {
        memoryStorage.set(key, String(val));
      },
      removeItem: (key: string) => {
        memoryStorage.delete(key);
      },
      clear: () => {
        memoryStorage.clear();
      },
    },
    configurable: true,
  });
}

beforeEach(() => {
  memoryStorage.clear();
  resetAllScreenTutorials();
  resetTutorialRuntimeState();
});

test('primeira visita: cada tela, modal e subfluxo começa como não visto e persiste após visualização', () => {
  expect(countSeenTutorials()).toEqual({ seen: 0, total: ALL_TUTORIAL_CONTEXT_IDS.length });

  for (const ctxId of ALL_TUTORIAL_CONTEXT_IDS) {
    expect(hasSeenScreenTutorial(ctxId)).toBe(false);
  }

  markScreenTutorialSeen('projetos');
  markScreenTutorialSeen('modal_skills');
  markScreenTutorialSeen('projeto_riscos');

  expect(hasSeenScreenTutorial('projetos')).toBe(true);
  expect(hasSeenScreenTutorial('modal_skills')).toBe(true);
  expect(hasSeenScreenTutorial('projeto_riscos')).toBe(true);
  expect(hasSeenScreenTutorial('ide')).toBe(false);
  expect(hasSeenScreenTutorial('modal_settings')).toBe(false);
  expect(countSeenTutorials().seen).toBe(3);

  resetAllScreenTutorials();
  expect(hasSeenScreenTutorial('projetos')).toBe(false);
  expect(hasSeenScreenTutorial('modal_skills')).toBe(false);
  expect(countSeenTutorials().seen).toBe(0);
});

test('prioridade de contexto: overlays prevalecem sobre subfluxos e subfluxos respeitam a visão inicial de Projetos', () => {
  expect(resolveActiveTutorialContext('projetos')).toBe('projetos');

  setProjectSubflowContext('projeto_sprints');
  // Antes de ver Projetos pela primeira vez, prioriza o guia geral; modo manual (preferSubflow) aponta para Sprints
  expect(resolveActiveTutorialContext('projetos')).toBe('projetos');
  expect(resolveActiveTutorialContext('projetos', { preferSubflow: true })).toBe('projeto_sprints');

  // Depois que Projetos foi visto, o subfluxo ativo passa a ser resolvido automaticamente
  markScreenTutorialSeen('projetos');
  expect(resolveActiveTutorialContext('projetos')).toBe('projeto_sprints');

  // Se o usuário abrir o modal de Skills ou Configurações por cima, o overlay assume prioridade máxima
  pushTutorialOverlay('modal_skills');
  expect(resolveActiveTutorialContext('projetos')).toBe('modal_skills');

  pushTutorialOverlay('modal_settings');
  expect(resolveActiveTutorialContext('projetos')).toBe('modal_settings');

  removeTutorialOverlay('modal_settings');
  expect(resolveActiveTutorialContext('projetos')).toBe('modal_skills');

  removeTutorialOverlay('modal_skills');
  expect(resolveActiveTutorialContext('projetos')).toBe('projeto_sprints');

  setProjectSubflowContext(null);
  expect(resolveActiveTutorialContext('projetos')).toBe('projetos');
});

test('barramento de solicitação manual dispara listeners com o contexto informado', () => {
  const received: Array<TutorialContextId | undefined> = [];
  const unsubscribe = subscribeTutorialRequests((ctx) => {
    received.push(ctx);
  });

  requestTutorialStart('modal_skills');
  requestTutorialStart('popup_theme');
  requestTutorialStart();
  unsubscribe();
  requestTutorialStart('modal_brain');

  expect(received).toEqual(['modal_skills', 'popup_theme', undefined]);
});

test('todos os 23 contextos retornam passos válidos e sem emojis', () => {
  const emojiRegex = /\p{Extended_Pictographic}/u;

  expect(ALL_TUTORIAL_CONTEXT_IDS.length).toBe(23);

  for (const ctxId of ALL_TUTORIAL_CONTEXT_IDS) {
    expect(SCREEN_TUTORIAL_LABELS[ctxId].length).toBeGreaterThan(0);
    expect(emojiRegex.test(SCREEN_TUTORIAL_LABELS[ctxId])).toBe(false);

    const steps = resolveStepsForScreen(ctxId);
    expect(steps.length).toBeGreaterThanOrEqual(1);

    for (const step of steps) {
      expect(step.skipBeacon).toBe(true);
      expect(typeof step.title).toBe('string');
      expect(typeof step.content).toBe('string');
      expect(emojiRegex.test(String(step.title))).toBe(false);
      expect(emojiRegex.test(String(step.content))).toBe(false);
    }
  }
});
