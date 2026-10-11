import { describe, expect, it } from 'bun:test';
import { adjustRuns, applyRunStyle, isFullyStyled, lineSegments, normalizeRuns, toggleRunStyle } from '../src/components/design2/richText';

describe('texto com estilo por trecho', () => {
  it('negrito numa palavra do meio da frase', () => {
    const runs = applyRunStyle(undefined, 4, 9, { fontWeight: 700 });
    expect(runs).toEqual([{ start: 4, end: 9, fontWeight: 700 }]);
    const segs = lineSegments('Olá mundo cruel', runs)[0];
    expect(segs.map((s) => [s.text, s.style.fontWeight])).toEqual([['Olá ', undefined], ['mundo', 700], [' cruel', undefined]]);
  });

  it('aplicar sobre trechos existentes mescla propriedades e divide nas bordas', () => {
    let runs = applyRunStyle(undefined, 0, 10, { fill: '#f00' });
    runs = applyRunStyle(runs, 5, 15, { fontWeight: 700 });
    expect(runs).toEqual([
      { start: 0, end: 5, fill: '#f00' },
      { start: 5, end: 10, fill: '#f00', fontWeight: 700 },
      { start: 10, end: 15, fontWeight: 700 },
    ]);
  });

  it('trechos vizinhos com o mesmo estilo se juntam; sem estilo somem', () => {
    expect(normalizeRuns([{ start: 0, end: 3, fontWeight: 700 }, { start: 3, end: 6, fontWeight: 700 }, { start: 6, end: 8 }])).toEqual([{ start: 0, end: 6, fontWeight: 700 }]);
  });

  it('toggle: aplica quando falta e remove quando todo o intervalo já tem', () => {
    const on = toggleRunStyle(undefined, 0, 5, 'fontStyle', 'italic');
    expect(isFullyStyled(on, 0, 5, 'fontStyle', 'italic')).toBe(true);
    expect(toggleRunStyle(on, 0, 5, 'fontStyle', 'italic')).toEqual([]);
    // parcialmente estilizado: aplica no intervalo todo
    const partial = toggleRunStyle(on, 0, 8, 'fontStyle', 'italic');
    expect(partial).toEqual([{ start: 0, end: 8, fontStyle: 'italic' }]);
  });

  it('linhas: o estilo atravessa quebras de linha', () => {
    const runs = [{ start: 2, end: 8, fontWeight: 700 }];
    const lines = lineSegments('ab cd\nef gh', runs);
    expect(lines[0].map((s) => s.text)).toEqual(['ab', ' cd']);
    expect(lines[1].map((s) => [s.text, s.style.fontWeight])).toEqual([['ef', 700], [' gh', undefined]]);
  });

  it('edição: inserir antes desloca; inserir dentro de um trecho o herda; apagar encolhe', () => {
    const runs = [{ start: 4, end: 9, fontWeight: 700 }];
    // "Olá mundo" -> "Oi, Olá mundo" (insere 4 antes)
    expect(adjustRuns(runs, 'Olá mundo', 'Oi, Olá mundo')).toEqual([{ start: 8, end: 13, fontWeight: 700 }]);
    // digitar "X" dentro de "mundo"
    expect(adjustRuns(runs, 'Olá mundo', 'Olá munXdo')).toEqual([{ start: 4, end: 10, fontWeight: 700 }]);
    // apagar "und" de "mundo"
    expect(adjustRuns(runs, 'Olá mundo', 'Olá mo')).toEqual([{ start: 4, end: 6, fontWeight: 700 }]);
  });

  it('apagar todo o texto de um trecho remove o trecho', () => {
    expect(adjustRuns([{ start: 4, end: 9, fontWeight: 700 }], 'Olá mundo', 'Olá ')).toEqual([]);
  });
});
