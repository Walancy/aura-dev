import { describe, expect, it } from 'bun:test';
import { dashArrayOf, parseDashPattern } from '../src/components/design2/dash';

describe('padrão de tracejado', () => {
  it('aceita espaço ou vírgula e normaliza', () => {
    expect(parseDashPattern('8 4 2 4')).toBe('8,4,2,4');
    expect(parseDashPattern(' 8,  4 ')).toBe('8,4');
    expect(parseDashPattern('1.234 2')).toBe('1.23,2');
  });
  it('rejeita lixo, negativo, tudo zero e vazio', () => {
    expect(parseDashPattern('a b')).toBeUndefined();
    expect(parseDashPattern('4 -2')).toBeUndefined();
    expect(parseDashPattern('0 0')).toBeUndefined();
    expect(parseDashPattern('')).toBeUndefined();
    expect(parseDashPattern(undefined)).toBeUndefined();
  });
  it('só vale tracejado quando o estilo é "dashed"; padrão livre ganha do simples', () => {
    expect(dashArrayOf({ strokeStyle: 'solid', strokeDashArray: '4 2' })).toBeUndefined();
    expect(dashArrayOf({ strokeStyle: 'dashed' })).toBe('6,6');
    expect(dashArrayOf({ strokeStyle: 'dashed', strokeDash: 3, strokeGap: 9 })).toBe('3,9');
    expect(dashArrayOf({ strokeStyle: 'dashed', strokeDash: 3, strokeGap: 9, strokeDashArray: '10 2 2 2' })).toBe('10,2,2,2');
    expect(dashArrayOf({ strokeStyle: 'dashed', strokeDashArray: 'lixo' })).toBe('6,6');
  });
});
