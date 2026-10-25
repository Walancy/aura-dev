import { test, expect } from 'bun:test';
import { stripTerminalControl } from '../electron/env-utils';

test('cursor para a direita vira espaço (palavras não colam)', () => {
  expect(stripTerminalControl('github.com\x1b[1Cno\x1b[1Ccard\x1b[3Cfim')).toBe('github.com no card   fim');
  expect(stripTerminalControl('\x1b[CA\x1b[C B')).toBe(' A  B');
});

test('cursor para baixo vira quebra de linha e o resto das sequências some', () => {
  expect(stripTerminalControl('linha1\x1b[1Blinha2\x1b[2Elinha3')).toBe('linha1\nlinha2\n\nlinha3');
  expect(stripTerminalControl('\x1b[1;38;2;255;106;0mcor\x1b[0m \x1b]0;titulo\x07ok\x07')).toBe('cor ok');
});
