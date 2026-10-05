import { test, expect } from 'bun:test';
import { buildProposalHtml, buildProposalPrompt, collectFrameContext, parseProposal } from '../src/components/design2/proposal';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
const all = [
  mk({ id: 'f1', type: 'frame', name: 'Home', x: 0, y: 0, width: 393, height: 852 }),
  mk({ id: 't1', type: 'text', name: 'T', parentId: 'f1', x: 10, y: 20, width: 100, height: 20, text: 'Agende   seu\nhorário' }),
  mk({ id: 'i1', type: 'path', name: 'Ic', parentId: 'f1', x: 10, y: 60, width: 24, height: 24, iconName: 'Search' }),
  mk({ id: 'f2', type: 'frame', name: 'Resumo', x: 500, y: 0, width: 393, height: 852 }),
] as any[];

test('contexto das telas', () => {
  const c = collectFrameContext(all, all[0]);
  expect(c.texts).toEqual(['Agende seu horário']);
  expect(c.icons).toEqual(['Search']);
  expect(c.elements).toBe(2);
});

test('parse, completa telas esquecidas e gera HTML escapado', () => {
  const frames = [collectFrameContext(all, all[0]), collectFrameContext(all, all[3])];
  expect(buildProposalPrompt({ client: 'ACME', frames })).toContain('ACME');
  const raw = JSON.stringify({ title: 'App <Salão>', subtitle: 's', intro: 'Olá\nmundo', screens: [{ frameId: 'f1', title: 'Início', description: 'd', highlights: ['a'] }, { frameId: 'zzz', title: 'x' }], timeline: [{ phase: 'F1', duration: '1 sem', deliverables: 'x' }], investment: 'a definir' });
  const p = parseProposal(raw, frames)!;
  expect(p.screens.map((s) => s.frameId)).toEqual(['f1', 'f2']);
  const html = buildProposalHtml(p, { f1: 'data:image/jpeg;base64,AA' }, frames, { accent: '#EA1D2C', client: 'ACME' });
  expect(html).toContain('App &lt;Salão&gt;');
  expect(html).toContain('data:image/jpeg;base64,AA');
  expect(html).toContain('Preparada para ACME');
  expect(parseProposal('lixo', frames)).toBeNull();
});
