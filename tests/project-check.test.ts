import { test, expect } from 'bun:test';
import { parseEslintJson, parseJsonLoose, parseOxlintJson, parseTscOutput, planChecks } from '../src/utils/projectCheck';

test('planChecks: tsconfig de referências (Vite) roda cada referência; eslint e oxlint só se configurados', () => {
  const plans = planChecks({
    tsconfigText: '{ // solution\n "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" },] }',
    packageJsonText: JSON.stringify({ devDependencies: { eslint: '9', oxlint: '1' } }),
    rootFiles: ['eslint.config.mjs', '.oxlintrc.json', 'tsconfig.json'],
  });
  expect(plans.map((p) => p.kind)).toEqual(['tsc', 'tsc', 'eslint', 'oxlint']);
  expect(plans[0].command).toContain('-p "./tsconfig.app.json"');
});

test('planChecks: sem lint configurado roda só os tipos', () => {
  const plans = planChecks({ tsconfigText: '{}', packageJsonText: '{}', rootFiles: ['tsconfig.json'] });
  expect(plans.map((p) => p.kind)).toEqual(['tsc']);
  expect(plans[0].command).not.toContain(' -p ');
});

test('parsers de tsc, eslint e oxlint', () => {
  expect(parseTscOutput('src/a.ts(3,5): error TS2322: Tipo errado.\nx', '/ws')[0]).toMatchObject({ filePath: '/ws/src/a.ts', line: 3, column: 5, code: 'TS2322', source: 'tsc' });
  const es = parseEslintJson('aviso\n' + JSON.stringify([{ filePath: '/ws/src/b.ts', messages: [{ ruleId: 'no-unused-vars', severity: 2, message: 'x', line: 1, column: 2 }] }]), '/ws')!;
  expect(es[0]).toMatchObject({ severity: 'error', code: 'no-unused-vars', source: 'eslint', relPath: 'src/b.ts' });
  const ox = parseOxlintJson(JSON.stringify({ diagnostics: [{ message: 'm', code: 'eslint(no-debugger)', severity: 'warning', filename: 'src/c.ts', labels: [{ span: { line: 4, column: 1 } }] }] }), '/ws')!;
  expect(ox[0]).toMatchObject({ severity: 'warning', line: 4, source: 'oxlint', filePath: '/ws/src/c.ts' });
  expect(parseEslintJson('sem json', '/ws')).toBeNull();
  expect(parseJsonLoose('{"a":1,}')).toEqual({ a: 1 });
});
