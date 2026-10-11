import { test, expect } from 'bun:test';
import { effectsFromItem, gradientToFill, parseColorAlpha, snapDimension, snapIconSize, snapSpacing, styleFromItem, textStyleFromItem } from '../src/components/design2/aiStyle';
import { parseAiScreenResponse } from '../src/components/design2/aiScreenFromLlm';
import icons from '../src/components/design2/materialIcons.json';

const req = { pageId: 'p', startX: 0, startY: 0, isDark: true, accentColor: '#f90', icons: icons as any };

test('cores com alfa', () => {
  expect(parseColorAlpha('#FFFFFF1F', '#000')).toEqual({ hex: '#FFFFFF', alpha: 0x1f / 255 });
  expect(parseColorAlpha('rgba(255, 128, 0, 0.5)', '#000')).toEqual({ hex: '#FF8000', alpha: 0.5 });
  expect(parseColorAlpha('transparent', '#123456').alpha).toBe(0);
  expect(parseColorAlpha('lixo', '#123456')).toEqual({ hex: '#123456', alpha: 1 });
});

test('degradê radial com centro e raio; alfa 0 herda a cor do outro extremo', () => {
  const g = gradientToFill({ type: 'radial', from: '#FF7A2F', to: '#2A0E0500', center: [0.5, 0.15], radius: 0.9 })!;
  expect(g.type).toBe('radial');
  expect(g.gradientCenter).toEqual({ x: 0.5, y: 0.15 });
  expect(g.gradientRadius).toBe(0.9);
  expect(g.gradientStops![1].opacity).toBe(0);
  expect(g.gradientStops![1].color).toBe('#FF7A2F'); // sem cinza no meio
});

test('vidro, neomorfismo, blur e ruído viram efeitos do Design', () => {
  const glass = styleFromItem({ fill: '#FFFFFF1A', stroke: '#FFFFFF33', strokeWidth: 1, backdropBlur: 24 });
  expect(glass.fills![0].opacity).toBeCloseTo(0.1, 1);
  expect(glass.strokes![0].opacity).toBeCloseTo(0.2, 1);
  expect(glass.effects![0].type).toBe('background-blur');
  expect(glass.effects![0].blur).toBe(24);
  const neo = effectsFromItem({ effects: [{ type: 'shadow', x: 8, y: 8, blur: 16, color: '#A3B1C680' }, { type: 'shadow', x: -8, y: -8, blur: 16, color: '#FFFFFFCC' }] });
  expect(neo).toHaveLength(2);
  expect(neo[0].opacity).toBeCloseTo(0.5, 1);
  expect(neo[1].x).toBe(-8);
  const fx = effectsFromItem({ blur: 80, noise: { density: 0.35 }, effects: [{ type: 'inner-shadow', y: 2, blur: 4, color: '#00000066' }] });
  expect(fx.map((e) => e.type).sort()).toEqual(['inner-shadow', 'layer-blur', 'noise']);
  // camadas: a IA descreve de baixo para cima, o canvas desenha o índice 0 por cima
  const layered = styleFromItem({ fills: ['#111111', { gradient: { from: '#FFFFFF33', to: '#FFFFFF00', angle: 180 } }] });
  expect(layered.fills![0].type).toBe('linear'); // topo
  expect(layered.fills![1].color).toBe('#111111'); // base
  expect(styleFromItem({ radii: [24, 24, 0, 0] }).topLeftRadius).toBe(24);
  expect(textStyleFromItem({ letterSpacing: -1.5, textCase: 'upper', italic: true })).toMatchObject({ letterSpacing: -1.5, textCase: 'uppercase', fontStyle: 'italic' });
});

test('régua de medidas: gap/padding na grade de 4, ícones na escala, dimensões pares', () => {
  expect([snapSpacing(0), snapSpacing(1), snapSpacing(2), snapSpacing(5), snapSpacing(10), snapSpacing(13), snapSpacing(18), snapSpacing(54)]).toEqual([0, 0, 2, 4, 12, 12, 20, 56]);
  expect([snapIconSize(17), snapIconSize(23), snapIconSize(26), snapIconSize(30)]).toEqual([16, 24, 24, 28]);
  expect(snapDimension(43)).toBe(44);
});

test('na geração: gap/padding/ícones padronizados e cards lado a lado com a mesma altura', () => {
  const F = (id: string, parent: string, name: string, o: any) => ({ type: 'frame', id, parent, name, ...o });
  const raw = JSON.stringify({ name: 'T', width: 393, height: 852, background: '#101010', backgroundFills: [{ gradient: { type: 'radial', from: '#FF7A2F', to: '#2A0E05', center: [0.5, 0.1], radius: 1 } }], backgroundNoise: { density: 0.3 }, shapes: [
    F('raiz', 'root', 'Conteúdo', { layout: 'vertical', gap: 18, padding: [56, 22, 34, 22], x: 0, y: 0, width: 393, height: 852 }),
    F('linha', 'raiz', 'Linha', { layout: 'horizontal', gap: 10, width: 'fill', height: 'hug' }),
    F('c1', 'linha', 'Card 1', { layout: 'vertical', gap: 6, padding: 13, width: 'fill', height: 'hug', fill: '#FFFFFF1A', stroke: '#FFFFFF33', strokeWidth: 1, backdropBlur: 20, cornerRadius: 20 }),
    { type: 'text', parent: 'c1', text: 'Deploy autonomous agent for the whole team today', width: 'fill', fontSize: 15, fontWeight: 500, letterSpacing: -0.2 },
    F('c2', 'linha', 'Card 2', { layout: 'vertical', gap: 6, padding: 13, width: 'fill', height: 'hug', fill: '#FFFFFF1A', cornerRadius: 20 }),
    { type: 'text', parent: 'c2', text: 'Short', width: 'fill', fontSize: 15 },
    { type: 'icon', parent: 'c2', name: 'Add', size: 23, fill: '#FFFFFF' },
  ] });
  const r = parseAiScreenResponse(raw, req)!;
  const by = (n: string) => r.shapes.find((s) => s.name === n)!;
  const screen = r.shapes.find((s) => s.name === 'Tela')!;
  // fundo da tela: degradê radial + ruído (camadas da IA), tema escuro deduzido do degradê
  expect(screen.fills![0].type).toBe('radial');
  expect(screen.effects!.some((e) => e.type === 'noise')).toBe(true);
  // grade de 4px: gap 18 -> 20, padding 22 -> 24, 13 -> 12
  const raiz = by('Conteúdo');
  expect(raiz.layoutGap).toBe(20);
  expect(raiz.paddingLeft).toBe(24);
  expect(by('Card 1').paddingTop).toBe(12);
  // ícone 23 -> 24
  expect(r.shapes.find((s) => s.iconName === 'Add')!.width).toBe(24);
  // vidro no card
  expect(by('Card 1').effects![0].type).toBe('background-blur');
  // cards lado a lado: mesma altura (o menor estica até o maior)
  expect(by('Card 2').height).toBe(by('Card 1').height);
  // texto fiel: tamanho e espaçamento entre letras exatos
  const t = r.shapes.find((s) => s.type === 'text' && (s.text || '').startsWith('Deploy'))!;
  expect(t.fontSize).toBe(15);
  expect(t.letterSpacing).toBe(-0.2);
});

test('atalho glass expande para vidro completo e respeita sobrescritas', () => {
  const g = styleFromItem({ glass: true });
  expect(g.fills?.length).toBe(1);
  expect(g.strokes?.length).toBe(1);
  expect(g.effects?.some((e: any) => e.type === 'background-blur')).toBe(true);
  const own = styleFromItem({ glass: true, fill: '#FF000080' });
  expect(own.fills?.[0].color).toBe('#FF0000');
});

test('guessScreenFormat: mobile por padrão, desktop quando o pedido indica', async () => {
  const { guessScreenFormat } = await import('../src/components/design2/aiScreenFromLlm');
  expect(guessScreenFormat('tela de login').mobile).toBe(true);
  expect(guessScreenFormat('dashboard web de vendas').mobile).toBe(false);
  expect(guessScreenFormat('app mobile com dashboard').mobile).toBe(true);
  expect(guessScreenFormat('qualquer coisa', 1.8).mobile).toBe(false);
});
