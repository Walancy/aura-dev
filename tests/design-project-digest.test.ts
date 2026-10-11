import { test, expect } from 'bun:test';
import { cleanMarkdown, docScore, pickDocs } from '../src/components/design2/projectDigest';
import { buildAiScreenPrompt, isVaguePrompt } from '../src/components/design2/aiScreenFromLlm';

const f = (name: string, path = `/p/${name}`) => ({ name, path, isDirectory: false });
const d = (name: string, children: any[]) => ({ name, path: `/p/${name}`, isDirectory: true, children });

test('escolhe e ordena os .md que descrevem o produto', () => {
  const tree = [
    f('README.md'), f('CHANGELOG.md'), f('LICENSE.md'), f('CLAUDE.md'), f('package.json'),
    d('docs', [f('PRD.md', '/p/docs/PRD.md'), f('notas.md', '/p/docs/notas.md'), f('ARQUITETURA.md', '/p/docs/ARQUITETURA.md'), d('api', [f('endpoints.md', '/p/docs/api/endpoints.md')])]),
    d('src', [f('LEIAME.md', '/p/src/LEIAME.md')]), // fora de pasta de documentação: ignorado
  ];
  const picked = pickDocs(tree as any);
  expect(picked[0]).toBe('/p/README.md');
  expect(picked.slice(0, 3)).toEqual(['/p/README.md', '/p/CLAUDE.md', '/p/docs/PRD.md']);
  expect(picked).not.toContain('/p/CHANGELOG.md');
  expect(picked).not.toContain('/p/LICENSE.md');
  expect(picked).not.toContain('/p/src/LEIAME.md');
  expect(picked).toContain('/p/docs/api/endpoints.md');
  expect(docScore('/x/PRODUTO.md')).toBeGreaterThan(docScore('/x/notas.md'));
});

test('limpa markdown: imagens, badges, html e código longo', () => {
  const md = '# App\n\n[![CI](a.svg)](b)\n\n![logo](x.png)\n\n<div align="center">Texto</div>\n\n```js\n' + 'x'.repeat(400) + '\n```\n\nSistema de gestão de leilões.\n\n\n\nFim';
  const out = cleanMarkdown(md, 500);
  expect(out).toContain('Sistema de gestão de leilões.');
  expect(out).not.toContain('logo');
  expect(out).not.toContain('<div');
  expect(out).toContain('```…```');
  expect(cleanMarkdown('a'.repeat(100), 10)).toHaveLength(10);
});

test('pedido sem assunto usa o projeto; pedido com assunto não', () => {
  for (const p of ['crie a tela inicial do app', 'gere uma tela mobile', 'faça o dashboard do sistema', 'crie uma tela de login', 'monte a home em dark mode']) expect(isVaguePrompt(p)).toBe(true);
  for (const p of ['tela inicial de um app de agendamento de salão', 'dashboard financeiro com gráfico de vendas', 'app de delivery de comida']) expect(isVaguePrompt(p)).toBe(false);
  const vague = buildAiScreenPrompt({ prompt: 'crie a tela inicial do app', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, canReadProject: true, projectContext: 'README: sistema de leilão de gado' });
  expect(vague).toContain('O PEDIDO NÃO DIZ SOBRE O QUE É O APP/SISTEMA');
  expect(vague).toContain('6 arquivos');
  expect(vague).toContain('leilão de gado');
  const specific = buildAiScreenPrompt({ prompt: 'app de agendamento de salão de beleza', pageId: 'p', startX: 0, startY: 0, accentColor: '#f90', isDark: false, canReadProject: true });
  expect(specific).not.toContain('O PEDIDO NÃO DIZ');
  expect(specific).toContain('4 arquivos pequenos');
});
