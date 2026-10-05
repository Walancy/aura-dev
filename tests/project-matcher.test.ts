import { describe, expect, it } from 'bun:test';
import {
  findProjectsInText,
  isProjectOpenIntent,
  normalizeTextForMatching,
  resolveTargetProjectsForNode,
  ProjectCandidate,
} from '../src/utils/projectMatcher';

describe('projectMatcher utility', () => {
  const sampleProjects: ProjectCandidate[] = [
    {
      id: 'node-proj-devflow',
      name: 'devflow-desktop',
      projectName: 'devflow-desktop',
      title: 'Aura Dev',
      fullName: 'Walancy/aura-dev',
      projectPath: '/Users/walancy/Documents/codes/devflow-desktop',
      devUrl: 'http://localhost:5185',
    },
    {
      id: 'node-proj-estancia',
      name: 'estancia-bahia-painel-interno',
      projectName: 'estancia-bahia-painel-interno',
      title: 'Estância Bahia',
      fullName: 'Walancy/estancia-bahia-painel-interno',
      projectPath: '/Users/walancy/Documents/codes/estancia bahia/estancia-bahia-painel-interno',
      devUrl: 'http://localhost:5178',
    },
    {
      id: 'node-proj-coopera',
      name: 'cooperaagro-app',
      projectName: 'cooperaagro-app',
      title: 'Coopera Agro',
      fullName: 'Walancy/cooperaagro-app',
      projectPath: '/Users/walancy/Documents/codes/cooperaagro-app',
      devUrl: 'http://localhost:5174',
    },
  ];

  it('normalizes text ignoring accents and delimiters', () => {
    expect(normalizeTextForMatching('Estância-Bahia / Painel Interno!')).toBe('estancia bahia painel interno');
    expect(normalizeTextForMatching('DevFlow_Desktop')).toBe('devflow desktop');
  });

  it('detects intent to open or run a project/dev url in browser', () => {
    expect(isProjectOpenIntent('Abra o projeto estancia bahia no navegador')).toBe(true);
    expect(isProjectOpenIntent('Rode o dev url do projeto')).toBe(true);
    expect(isProjectOpenIntent('Execute a aplicacao no localhost')).toBe(true);
    expect(isProjectOpenIntent('Teste o site no browser')).toBe(true);
    expect(isProjectOpenIntent('Pesquise como fazer um loop em zsh')).toBe(false);
    expect(isProjectOpenIntent('Qual a capital do Brasil')).toBe(false);
  });

  it('accurately identifies a single project mentioned in the prompt', () => {
    const text1 = 'Abra o projeto estancia bahia no navegador e teste a autenticação';
    const matches1 = findProjectsInText(text1, sampleProjects);
    expect(matches1.length).toBe(1);
    expect(matches1[0].id).toBe('node-proj-estancia');
    expect(matches1[0].devUrl).toBe('http://localhost:5178');

    const text2 = 'Rode os testes no projeto devflow-desktop';
    const matches2 = findProjectsInText(text2, sampleProjects);
    expect(matches2.length).toBe(1);
    expect(matches2[0].id).toBe('node-proj-devflow');

    const text3 = 'Abra o projeto coopera agro';
    const matches3 = findProjectsInText(text3, sampleProjects);
    expect(matches3.length).toBe(1);
    expect(matches3[0].id).toBe('node-proj-coopera');
  });

  it('identifies 2 or more projects when requested in the prompt', () => {
    const multiText = 'Abra os projetos estancia bahia e devflow no navegador';
    const matches = findProjectsInText(multiText, sampleProjects);
    expect(matches.length).toBe(2);
    expect(matches[0].id).toBe('node-proj-estancia');
    expect(matches[1].id).toBe('node-proj-devflow');
  });

  it('handles reverse order of projects in prompt', () => {
    const multiText = 'Abra o devflow e depois o coopera agro';
    const matches = findProjectsInText(multiText, sampleProjects);
    expect(matches.length).toBe(2);
    expect(matches[0].id).toBe('node-proj-devflow');
    expect(matches[1].id).toBe('node-proj-coopera');
  });

  it('identifies generic "abra os projetos" or "abra os 2 projetos"', () => {
    const genericText = 'Abra os 2 projetos no navegador';
    const matches = findProjectsInText(genericText, sampleProjects.slice(0, 2));
    expect(matches.length).toBe(2);
  });

  it('resolveTargetProjectsForNode prioritizes explicit match over index 0', () => {
    // Canvas has devflow at index 0 and estancia at index 1
    const canvasProjects = [sampleProjects[0], sampleProjects[1]];
    const prompt = 'Trabalhe no projeto estancia bahia e abra o dev server';

    const resolution = resolveTargetProjectsForNode(prompt, [], canvasProjects);
    expect(resolution.isExplicitMatch).toBe(true);
    expect(resolution.primaryProject?.id).toBe('node-proj-estancia');
    expect(resolution.matchedProjects[0].id).toBe('node-proj-estancia');
  });

  it('resolveTargetProjectsForNode falls back cleanly when no project is mentioned', () => {
    const canvasProjects = [sampleProjects[0], sampleProjects[1]];
    const prompt = 'Pesquise sobre as novas APIs no Google';

    const resolution = resolveTargetProjectsForNode(prompt, [], canvasProjects);
    expect(resolution.isExplicitMatch).toBe(false);
    expect(resolution.primaryProject?.id).toBe('node-proj-devflow');
  });

  it('projeto conectado por cabo vence menção a outro projeto no texto', () => {
    const [devflow, estancia] = sampleProjects;
    const res = resolveTargetProjectsForNode('Corrija o login do estancia bahia', [devflow], [], sampleProjects);
    expect(res.primaryProject?.id).toBe(devflow.id);
    expect(res.matchedProjects.length).toBe(1);
  });

  it('entre vários conectados, o texto desambigua', () => {
    const [devflow, estancia] = sampleProjects;
    const res = resolveTargetProjectsForNode('Corrija o login do estancia bahia', [devflow, estancia], [], sampleProjects);
    expect(res.primaryProject?.id).toBe(estancia.id);
  });
});
