import { test, expect, beforeEach } from 'bun:test';
import {
  hasSeenScreenTutorial,
  markScreenTutorialSeen,
  resetAllScreenTutorials,
  resolveStepsForScreen,
  SCREEN_TUTORIAL_LABELS,
  type TutorialScreenId,
} from '../src/components/tutorial/tutorialStore';

const ALL_SCREENS: TutorialScreenId[] = [
  'projetos',
  'orchestration',
  'daily',
  'ide',
  'cli',
  'design',
];

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
});

test('primeira visita: cada tela começa como não vista e persiste após visualização', () => {
  for (const screen of ALL_SCREENS) {
    expect(hasSeenScreenTutorial(screen)).toBe(false);
  }

  markScreenTutorialSeen('projetos');
  expect(hasSeenScreenTutorial('projetos')).toBe(true);
  expect(hasSeenScreenTutorial('ide')).toBe(false);

  markScreenTutorialSeen('ide');
  expect(hasSeenScreenTutorial('ide')).toBe(true);

  resetAllScreenTutorials();
  expect(hasSeenScreenTutorial('projetos')).toBe(false);
  expect(hasSeenScreenTutorial('ide')).toBe(false);
});

test('todas as telas retornam passos válidos e sem emojis', () => {
  const emojiRegex = /\p{Extended_Pictographic}/u;

  for (const screen of ALL_SCREENS) {
    expect(SCREEN_TUTORIAL_LABELS[screen].length).toBeGreaterThan(0);
    const steps = resolveStepsForScreen(screen);
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
