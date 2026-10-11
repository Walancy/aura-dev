import { describe, expect, it } from 'bun:test';
import { generateCodeAny, generateCompose, generateSwiftUI } from '../src/components/design2/codegenNative';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#ffffff', ...p } as Shape);

const card = mk({ id: 'card', type: 'frame' as any, name: 'Cartão', width: 300, height: 120, fill: '#112233', cornerRadius: 16, hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: 8, independentPadding: true, paddingTop: 12, paddingRight: 16, paddingBottom: 12, paddingLeft: 16, effects: [{ id: 'e', type: 'drop-shadow', color: '#000000', opacity: 0.3, x: 0, y: 4, blur: 12, spread: 0, visible: true }] as any });
const title = mk({ id: 't', type: 'text' as any, parentId: 'card', text: 'Olá', fontSize: 20, fontWeight: 700, fill: '#ffffff', width: 200, height: 24, zIndex: 2 } as any);
const dot = mk({ id: 'd', type: 'ellipse' as any, parentId: 'card', x: 20, y: 30, width: 10, height: 10, fill: '#ff0000', zIndex: 3 } as any);
const all = [card, title, dot];

describe('código SwiftUI', () => {
  const code = generateSwiftUI(all, card);
  it('estrutura: struct View, VStack com espaçamento e padding', () => {
    expect(code).toContain('struct Cartao: View');
    expect(code).toContain('VStack(alignment: .leading, spacing: 8)');
    expect(code).toContain('.padding(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))');
  });
  it('estilo: fundo, raio, sombra, texto e elipse', () => {
    expect(code).toContain('RoundedRectangle(cornerRadius: 16).fill(Color(hex: "#112233"))');
    expect(code).toContain('.shadow(color:');
    expect(code).toContain('.font(.system(size: 20, weight: .bold))');
    expect(code).toContain('Ellipse().fill(Color(hex: "#FF0000"))');
    expect(code).toContain('extension Color');
  });
});

describe('código Jetpack Compose', () => {
  const code = generateCompose(all, card);
  it('estrutura: Composable, Column com spacedBy e padding', () => {
    expect(code).toContain('@Composable\nfun Cartao()');
    expect(code).toContain('Column(');
    expect(code).toContain('Arrangement.spacedBy(8.dp)');
    expect(code).toContain('.padding(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 12.dp)');
  });
  it('estilo: fundo com forma, sombra, texto e círculo', () => {
    expect(code).toContain('.background(Color(0xFF112233), RoundedCornerShape(16.dp))');
    expect(code).toContain('.shadow(elevation = 6.dp');
    expect(code).toContain('fontSize = 20.sp');
    expect(code).toContain('fontWeight = FontWeight.W700');
    expect(code).toContain('CircleShape');
  });
});

describe('seletor de destinos', () => {
  it('generateCodeAny roteia SwiftUI e Compose e mantém os demais', () => {
    expect(generateCodeAny('swiftui', all, card)).toContain('import SwiftUI');
    expect(generateCodeAny('compose', all, card)).toContain('androidx.compose');
    expect(generateCodeAny('html', all, card)).toContain('<div');
  });
});
