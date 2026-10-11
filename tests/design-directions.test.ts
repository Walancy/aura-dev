import { describe, expect, it } from 'bun:test';
import { DIRECTIONS, directionBlock, inspirationBlock, pick } from '../src/components/design2/designDirections';

describe('direções criativas', () => {
  it('pick usa o índice pela semente, sem estourar nas pontas', () => {
    expect(pick(['a', 'b', 'c', 'd'], 0)).toBe('a');
    expect(pick(['a', 'b', 'c', 'd'], 0.99)).toBe('d');
    expect(pick(['a', 'b', 'c', 'd'], 1)).toBe('d');
  });

  it('sementes diferentes dão direções diferentes (variedade)', () => {
    const blocks = new Set([0, 0.1, 0.3, 0.5, 0.7, 0.9].map((s) => directionBlock('tela de dashboard', s)));
    expect(blocks.size).toBeGreaterThan(3);
  });

  it('login ganha um conceito de composição; outras telas não', () => {
    expect(directionBlock('tela de login', 0.1, 0.1)).toContain('COMPOSIÇÃO sugerida');
    expect(directionBlock('tela de produtos', 0.1, 0.1)).not.toContain('COMPOSIÇÃO sugerida');
  });

  it('exige contraste e proíbe o modelo genérico', () => {
    const b = directionBlock('login', 0.2);
    expect(b).toContain('4.5:1');
    expect(b).toContain('EVITE o modelo genérico');
  });

  it('há direções suficientes e todas têm descrição', () => {
    expect(DIRECTIONS.length).toBeGreaterThanOrEqual(10);
    expect(DIRECTIONS.every((d) => d.brief.length > 80)).toBe(true);
  });

  it('inspiração lista os arquivos e some sem imagens', () => {
    expect(inspirationBlock(['/tmp/a.jpg'])).toContain('/tmp/a.jpg');
    expect(inspirationBlock([])).toBe('');
  });
});

describe('no prompt de geração', () => {
  const { buildAiScreenPrompt } = require('../src/components/design2/aiScreenFromLlm');
  const base = { prompt: 'tela de login', pageId: 'p', startX: 0, startY: 0, accentColor: '#f60', isDark: true };
  it('tela nova recebe a direção criativa; duas gerações saem diferentes', () => {
    const a = buildAiScreenPrompt(base);
    expect(a).toContain('DIREÇÃO CRIATIVA DESTA GERAÇÃO');
    const set = new Set(Array.from({ length: 12 }, () => (buildAiScreenPrompt(base).match(/Direção de arte: ([^—]+)/) || [])[1]));
    expect(set.size).toBeGreaterThan(1);
  });
  it('com imagem de referência anexada não sorteia direção (a referência manda)', () => {
    expect(buildAiScreenPrompt({ ...base, referenceImages: ['/tmp/a.jpg'] })).not.toContain('DIREÇÃO CRIATIVA DESTA GERAÇÃO');
  });
  it('inspiração da biblioteca entra como bloco próprio', () => {
    expect(buildAiScreenPrompt({ ...base, inspirationImages: ['/tmp/ins.jpg'] })).toContain('INSPIRAÇÃO DA BIBLIOTECA');
  });
});
