import { expect, test } from 'bun:test';
import { markLegacyGeminiModels, type AiModelItem } from '../electron/model-service';

const m = (id: string): AiModelItem => ({ id, label: id });

test('só a versão mais recente de cada linha do Gemini fica visível', () => {
  const out = markLegacyGeminiModels(
    ['gemini-4-argon-high', 'gemini-3.8-flash-high', 'gemini-3.7-flash-high', 'gemini-3.6-flash-low', 'gemini-3.1-pro-high', 'gemini-3.0-pro-low', 'claude-opus-5-5-high'].map(m),
  );
  const legacy = out.filter((x) => x.legacy).map((x) => x.id);
  expect(legacy).toEqual(['gemini-3.7-flash-high', 'gemini-3.6-flash-low', 'gemini-3.0-pro-low']);
});

test('modelos que não são do Gemini nunca viram legacy', () => {
  expect(markLegacyGeminiModels([m('claude-sonnet-5-5-high'), m('gpt-oss-120b-medium')]).some((x) => x.legacy)).toBe(false);
});
