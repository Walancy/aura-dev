import { test, expect } from 'bun:test';
import { resolveCliModel } from '../src/components/design2/aiModel';

const gemini = ['Gemini 3.8 Flash (High)', 'Gemini 3.1 Pro (Low)', 'Claude Sonnet 5.5 (High)'];
const claude = ['Sonnet 5', 'Opus 5.5', 'Haiku 4.5'];

test('modelo ativo do provedor tem prioridade', () => {
  expect(resolveCliModel('antigravity', 'sonnet', { antigravity: { currentModel: 'Gemini 3.8 Flash (High)' } }, gemini)).toBe('Gemini 3.8 Flash (High)');
});

test('modelo de OUTRO provedor ("sonnet" com Antigravity) não vaza para a CLI', () => {
  expect(resolveCliModel('antigravity', 'sonnet', {}, ['Gemini 3.8 Flash (High)', 'Gemini 3.1 Pro (Low)'])).toBeUndefined();
  expect(resolveCliModel('antigravity', 'sonnet', undefined, ['Gemini 3.8 Flash (High)'])).toBeUndefined();
});

test('modelo selecionado que pertence ao provedor é mantido (Claude continua funcionando)', () => {
  expect(resolveCliModel('claude', 'sonnet', {}, claude)).toBe('sonnet');
  expect(resolveCliModel('claude', 'Opus 5.5', {}, claude)).toBe('Opus 5.5');
  expect(resolveCliModel('claude', undefined, {}, claude)).toBeUndefined();
  expect(resolveCliModel(undefined, 'sonnet', {}, claude)).toBeUndefined();
});

import { lowEffortModel } from '../src/components/design2/aiModel';

test('variante (Low) só quando existe para o provedor', () => {
  const list = ['Gemini 3.8 Flash (High)', 'Gemini 3.8 Flash (Low)', 'GPT-OSS 120B (Medium)'];
  expect(lowEffortModel('antigravity', 'Gemini 3.8 Flash (High)', {}, list)).toBe('Gemini 3.8 Flash (Low)');
  expect(lowEffortModel('antigravity', 'GPT-OSS 120B (Medium)', {}, list)).toBe('GPT-OSS 120B (Medium)'); // não existe "(Low)": mantém
  expect(lowEffortModel('antigravity', 'Gemini 3.8 Flash (Low)', {}, list)).toBe('Gemini 3.8 Flash (Low)');
  expect(lowEffortModel('claude', 'sonnet', {}, ['Sonnet 5'])).toBe('sonnet');
  expect(lowEffortModel('antigravity', undefined, {}, list)).toBeUndefined();
  // lista vinda dos modelos ativos do provedor
  expect(lowEffortModel('antigravity', 'Gemini 3.1 Pro (High)', { antigravity: { models: [{ id: 'x', label: 'Gemini 3.1 Pro (Low)' }] } }, [])).toBe('Gemini 3.1 Pro (Low)');
});

test('apelido de outro provedor ("sonnet") não casa com o rótulo parecido do Antigravity', () => {
  expect(resolveCliModel('antigravity', 'sonnet', undefined, ['Gemini 3.8 Flash (High)', 'Claude Sonnet 5.5 (High)'])).toBeUndefined();
  expect(resolveCliModel('antigravity', 'Claude Sonnet 5.5 (High)', undefined, ['Claude Sonnet 5.5 (High)'])).toBe('Claude Sonnet 5.5 (High)');
});

test('visionModel prefere o Claude Sonnet (Low) do provedor para analisar imagens; senão a variante Low', async () => {
  const { visionModel } = await import('../src/components/design2/aiModel');
  const models = ['Gemini 3.8 Flash (High)', 'Gemini 3.8 Flash (Low)', 'Claude Sonnet 5.5 (Low)', 'Claude Sonnet 5.5 (High)'];
  expect(visionModel('antigravity', 'Gemini 3.8 Flash (High)', undefined, models)).toBe('Claude Sonnet 5.5 (Low)');
  expect(visionModel('antigravity', 'Gemini 3.8 Flash (High)', undefined, ['Gemini 3.8 Flash (High)', 'Gemini 3.8 Flash (Low)'])).toBe('Gemini 3.8 Flash (Low)');
  expect(visionModel(undefined, 'x')).toBe('x');
});
