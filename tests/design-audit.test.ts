import { describe, expect, it } from 'bun:test';
import { applyAuditFix, auditDesign, contrastRatio, isLargeText, parseColor } from '../src/components/design2/audit';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 200, height: 60, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#ffffff', ...p } as Shape);

describe('contraste WCAG', () => {
  it('razões conhecidas', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('transparent', '#fff')).toBeNull();
  });
  it('parseColor e texto grande', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0]);
    expect(parseColor('#00ff0080')).toEqual([0, 255, 0]);
    expect(parseColor('rgb(1,2,3)')).toBeNull();
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(19, 700)).toBe(true);
    expect(isLargeText(16, 700)).toBe(false);
  });
});

describe('revisão do design', () => {
  const bg = mk({ id: 'bg', type: 'frame' as any, fill: '#ffffff', zIndex: 1 });
  const text = (extra: any = {}) => mk({ id: 't', type: 'text' as any, x: 20, y: 10, width: 100, height: 20, fill: '#bbbbbb', fontSize: 16, zIndex: 2, ...extra });

  it('texto com baixo contraste vira erro e sugere preto ou branco', () => {
    const issues = auditDesign([bg, text()]);
    const c = issues.find((i) => i.kind === 'contrast')!;
    expect(c.severity).toBe('error');
    expect(c.fix).toMatchObject({ type: 'set', patch: { fill: '#000000' } });
    expect(applyAuditFix([bg, text()], c).find((s) => s.id === 't')!.fill).toBe('#000000');
  });

  it('texto grande aceita 3:1; texto com bom contraste não é apontado', () => {
    expect(auditDesign([bg, text({ fill: '#888888', fontSize: 28 })]).some((i) => i.kind === 'contrast')).toBe(false);
    expect(auditDesign([bg, text({ fill: '#222222' })]).some((i) => i.kind === 'contrast')).toBe(false);
  });

  it('fundo escuro: sugere branco', () => {
    const dark = { ...bg, fill: '#101010' };
    const c = auditDesign([dark, text({ fill: '#202020' })]).find((i) => i.kind === 'contrast')!;
    expect(c.fix).toMatchObject({ patch: { fill: '#FFFFFF' } });
  });

  it('texto pequeno e alvo de toque', () => {
    const issues = auditDesign([bg, text({ fill: '#000', fontSize: 9 }), mk({ id: 'b', width: 30, height: 30, prototypeLink: { targetId: 'bg' }, zIndex: 3 } as any)]);
    expect(issues.find((i) => i.kind === 'small-text')!.fix).toMatchObject({ patch: { fontSize: 12 } });
    expect(issues.find((i) => i.kind === 'touch')!.fix).toMatchObject({ patch: { width: 44, height: 44 } });
  });

  it('desvio de cor: igual → vincular; parecida → aviso; distante → nada', () => {
    const styles = [{ id: 'st', name: 'Primária', kind: 'color', color: '#3366ff', opacity: 1 }] as any;
    const run = (fill: string) => auditDesign([mk({ id: 'x', fill })], styles).filter((i) => i.kind === 'drift-color');
    expect(run('#3366ff')[0]).toMatchObject({ severity: 'info', fix: { type: 'bind-fill-style', styleId: 'st' } });
    expect(run('#3568f0')[0].severity).toBe('warning');
    expect(run('#ff0000')).toHaveLength(0);
    // já vinculada: nada
    expect(auditDesign([mk({ id: 'x', fill: '#3366ff', fillStyleId: 'st' })], styles)).toHaveLength(0);
  });

  it('variável de cor entra na paleta do sistema', () => {
    const vars = [{ id: 'v', name: 'Fundo', kind: 'color', values: { light: '#102030', dark: '#000000' } }] as any;
    const out = auditDesign([mk({ id: 'x', fill: '#102030' })], [], vars, 'light');
    expect(out[0].fix).toMatchObject({ type: 'bind-fill-variable', variableId: 'v' });
  });

  it('tipografia igual a um estilo de texto, não vinculada', () => {
    const styles = [{ id: 'ts', name: 'Título', kind: 'text', fontFamily: 'Inter', fontSize: 24, fontWeight: 700 }] as any;
    const t = mk({ id: 'h', type: 'text' as any, fontFamily: 'Inter', fontSize: 24, fontWeight: 700, fill: '#000', zIndex: 2 });
    const out = auditDesign([bg, t], styles);
    expect(out.find((i) => i.kind === 'drift-font')!.fix).toMatchObject({ type: 'bind-text-style', styleId: 'ts' });
  });
});

describe('contraste corrigido sozinho (resultado da IA)', () => {
  const { fixContrast } = require('../src/components/design2/audit');
  const bg = mk({ id: 'bg', type: 'frame' as any, fill: '#0b0b1a', zIndex: 1 });
  it('título escuro em fundo escuro vira branco', () => {
    const t = mk({ id: 't', type: 'text' as any, x: 20, y: 10, width: 100, height: 20, fill: '#1a1a3a', fontSize: 28, fontWeight: 800, zIndex: 2 });
    const out = fixContrast([bg, t]);
    expect(out.find((s: any) => s.id === 't').fill).toBe('#FFFFFF');
    expect(out.find((s: any) => s.id === 'bg')).toBe(bg);
  });
  it('fundo em degradê é desconhecido: não mexe, mesmo com algo preto embaixo', () => {
    const bezel = mk({ id: 'bz', type: 'frame' as any, fill: '#000000', zIndex: 1 });
    const grad = mk({ id: 'g', type: 'frame' as any, zIndex: 2, fills: [{ id: 'f', color: '#ffffff', opacity: 1, visible: true, type: 'linear', gradientStops: [{ position: 0, color: '#ffffff', opacity: 1 }, { position: 1, color: '#eeeeee', opacity: 1 }] }] } as any);
    const t = mk({ id: 't', type: 'text' as any, x: 20, y: 10, width: 100, height: 20, fill: '#222222', zIndex: 3 });
    expect(fixContrast([bezel, grad, t]).find((s: any) => s.id === 't').fill).toBe('#222222');
  });
});
