import { describe, expect, it } from 'bun:test';
import { renameMany, renameOne } from '../src/components/design2/renameBulk';

describe('renomear em massa', () => {
  it('sequência com {n}, início e zeros à esquerda', () => {
    expect(renameMany(['a', 'b', 'c'], { pattern: 'Card {n}' })).toEqual(['Card 1', 'Card 2', 'Card 3']);
    expect(renameMany(['a', 'b'], { pattern: 'Item-{n}', start: 8, pad: 3 })).toEqual(['Item-008', 'Item-009']);
  });

  it('{nome} reaproveita o nome atual; padrão vazio mantém o nome', () => {
    expect(renameOne('Botão', 0, { pattern: '{nome} / hover' })).toBe('Botão / hover');
    expect(renameOne('Botão', 0, { pattern: '' })).toBe('Botão');
  });

  it('localizar e substituir (texto e regex)', () => {
    expect(renameOne('Frame 12 copy', 0, { pattern: '{nome}', find: ' copy', replace: '' })).toBe('Frame 12');
    expect(renameOne('Frame 12', 0, { pattern: '{nome}', find: '\\d+', replace: 'N', useRegex: true })).toBe('Frame N');
  });

  it('regex inválida não muda o nome', () => {
    expect(renameOne('abc', 0, { pattern: '{nome}', find: '(', replace: 'x', useRegex: true })).toBe('abc');
  });
});
