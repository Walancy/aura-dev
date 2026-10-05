import { describe, expect, it } from 'bun:test';
import { componentName, generateFlutter, generateHtml, generateReact } from '../src/components/design2/codegen';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, ...p }) as Shape;

const shapes = [
  mk({ id: 'f', type: 'frame', name: 'Tela de Login', x: 100, y: 100, width: 400, height: 300, fill: '#101010' }),
  mk({ id: 'c', parentId: 'f', name: 'Card', x: 120, y: 140, width: 200, height: 100, fill: '#222222', cornerRadius: 12, zIndex: 2, effects: [{ id: 'e', type: 'drop-shadow', color: '#000000', opacity: 0.3, x: 0, y: 4, blur: 8, spread: 0, visible: true }] }),
  mk({ id: 't', parentId: 'c', type: 'text', x: 130, y: 150, width: 80, height: 20, text: 'Olá {mundo}', fontSize: 18, fontWeight: 600, fill: '#ffffff', zIndex: 3 }),
];

describe('codegen', () => {
  it('nome de componente em PascalCase sem acentos', () => {
    expect(componentName('Tela de Início')).toBe('TelaDeInicio');
    expect(componentName('2 colunas')).toBe('Tela2Colunas');
  });

  it('React: posições relativas ao pai, estilo e texto escapado', () => {
    const code = generateReact(shapes, shapes[0]);
    expect(code).toContain('export function TelaDeLogin()');
    expect(code).toContain('background: "#101010"');
    expect(code).toContain('left: "20px", top: "40px"'); // card relativo ao frame
    expect(code).toContain('borderRadius: "12px"');
    expect(code).toContain('boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.3)"');
    expect(code).toContain("Olá {'{'}mundo{'}'}");
  });

  it('HTML usa estilos inline kebab-case', () => {
    const html = generateHtml(shapes, shapes[0]);
    expect(html).toContain('border-radius: 12px');
    expect(html).toContain('position: relative');
  });

  it('Flutter: Stack/Positioned, BoxDecoration e Text', () => {
    const dart = generateFlutter(shapes, shapes[0]);
    expect(dart).toContain('class TelaDeLogin extends StatelessWidget');
    expect(dart).toContain('Positioned(left: 20, top: 40');
    expect(dart).toContain('BorderRadius.circular(12)');
    expect(dart).toContain('BoxShadow(');
    expect(dart).toContain('Text("Olá {mundo}"');
    expect(dart).toContain('Color(0xFF101010)');
  });

  it('auto layout vira flex (web) e Row/Column (Flutter)', () => {
    const auto = [
      mk({ id: 'f', type: 'frame', name: 'Linha', width: 200, height: 50, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 8, paddingHorizontal: 12, paddingVertical: 4, layoutAlign: 'center' }),
      mk({ id: 'a', parentId: 'f', width: 20, height: 20, zIndex: 2 }),
      mk({ id: 'b', parentId: 'f', width: 30, height: 20, zIndex: 3 }),
    ];
    const react = generateReact(auto, auto[0]);
    expect(react).toContain('display: "flex"');
    expect(react).toContain('gap: "8px"');
    expect(react).toContain('padding: "4px 12px 4px 12px"');
    expect(react).not.toContain('position: "absolute"');
    const dart = generateFlutter(auto, auto[0]);
    expect(dart).toContain('Row(');
    expect(dart).toContain('SizedBox(width: 8)');
  });
});
