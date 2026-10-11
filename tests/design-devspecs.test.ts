import { describe, expect, it } from 'bun:test';
import { cssOf, specsOf } from '../src/components/design2/devSpecs';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#112233', ...p } as Shape);

describe('especificações do Modo Dev', () => {
  const parent = mk({ id: 'p', type: 'frame' as any, x: 100, y: 200, width: 400, height: 300, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 12, independentPadding: false, paddingHorizontal: 16, paddingVertical: 8 });
  const btn = mk({ id: 'b', parentId: 'p', x: 120, y: 210, width: 120, height: 44, cornerRadius: 8, opacity: 0.9, strokeWidth: 2, stroke: '#ff0000', effects: [{ id: 'e', type: 'drop-shadow', x: 0, y: 4, blur: 8, spread: 0, color: '#00000040', visible: true, opacity: 0.25 }] as any });

  it('posição é relativa ao pai e traz tamanho, raio e opacidade', () => {
    const s = specsOf(btn, [parent, btn]);
    expect(s.find((x) => x.label === 'Posição')!.value).toBe('20, 10');
    expect(s.find((x) => x.label === 'Tamanho')!.value).toBe('120 × 44');
    expect(s.find((x) => x.label === 'Raio')!.copy).toBe('border-radius: 8px;');
    expect(s.find((x) => x.label === 'Opacidade')!.value).toBe('90%');
  });

  it('cor com o nome do estilo ou da variável de design', () => {
    const styles = [{ id: 'st', name: 'Primária', kind: 'color', color: '#112233', opacity: 1 }] as any;
    expect(specsOf({ ...btn, fillStyleId: 'st' }, [btn], styles).find((x) => x.label === 'Cor')).toMatchObject({ value: '#112233', token: 'Primária' });
    const vars = [{ id: 'v', name: 'Fundo', kind: 'color', values: { light: '#ffffff', dark: '#000000' } }] as any;
    const dark = specsOf({ ...btn, fillVariableId: 'v' }, [btn], [], vars, 'dark').find((x) => x.label === 'Cor')!;
    expect(dark).toMatchObject({ value: '#000000', token: 'Fundo' });
  });

  it('auto layout: gap e padding; traço e sombra com CSS', () => {
    const s = specsOf(parent, [parent]);
    expect(s.find((x) => x.label === 'Espaçamento')!.copy).toBe('gap: 12px;');
    expect(s.find((x) => x.label === 'Padding')!.value).toBe('8 / 16 / 8 / 16');
    const b = specsOf(btn, [parent, btn]);
    expect(b.find((x) => x.section === 'Traço')!.copy).toBe('border: 2px solid #ff0000;');
    expect(b.find((x) => x.label === 'Sombra')!.copy).toContain('box-shadow: 0px 4px 8px 0px');
  });

  it('texto: fonte, tamanho e cor viram tipografia', () => {
    const t = mk({ id: 't', type: 'text' as any, fontFamily: 'Poppins', fontWeight: 600, fontSize: 18, fill: '#222222', lineHeight: 1.4 } as any);
    const s = specsOf(t, [t]);
    expect(s.find((x) => x.label === 'Fonte')!.value).toBe('Poppins · 600');
    expect(s.find((x) => x.label === 'Cor do texto')!.section).toBe('Tipografia');
    expect(s.find((x) => x.label === 'Entrelinha')!.copy).toBe('line-height: 1.4;');
  });

  it('cssOf junta as declarações copiáveis sem posição', () => {
    const css = cssOf(specsOf(btn, [parent, btn]));
    expect(css).toContain('width: 120px; height: 44px;');
    expect(css).not.toContain('left:');
  });
});
