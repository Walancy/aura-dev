import { describe, expect, it } from 'bun:test';
import { interpolateFrames, lerpColor, matchLayers, normalizedSubtree } from '../src/components/design2/smartAnimate';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#000000', ...p } as Shape);

const doc = [
  mk({ id: 'fa', type: 'frame' as any, name: 'A', x: 500, y: 100, width: 300, height: 600 }),
  mk({ id: 'a-btn', parentId: 'fa', name: 'Botão', x: 520, y: 150, width: 100, height: 40, fill: '#000000', zIndex: 2 } as any),
  mk({ id: 'a-only', parentId: 'fa', name: 'Só na A', x: 520, y: 300, zIndex: 3 } as any),
  mk({ id: 'fb', type: 'frame' as any, name: 'B', x: 1000, y: 0, width: 300, height: 600 }),
  mk({ id: 'b-btn', parentId: 'fb', name: 'Botão', x: 1100, y: 250, width: 200, height: 80, fill: '#ffffff', zIndex: 2 } as any),
  mk({ id: 'b-only', parentId: 'fb', name: 'Só na B', x: 1010, y: 20, zIndex: 3 } as any),
];

describe('smart animate', () => {
  const from = normalizedSubtree(doc, 'fa');
  const to = normalizedSubtree(doc, 'fb');

  it('o frame vai para a origem e os filhos acompanham', () => {
    expect(from.find((s) => s.id === 'a-btn')).toMatchObject({ x: 20, y: 50 });
    expect(to.find((s) => s.id === 'b-btn')).toMatchObject({ x: 100, y: 250 });
  });

  it('casa por nome e tipo; a raiz casa com a raiz; sem par fica de fora', () => {
    const m = matchLayers(from, to);
    expect(m.get('fa')).toBe('fb');
    expect(m.get('a-btn')).toBe('b-btn');
    expect(m.has('a-only')).toBe(false);
  });

  it('no meio do caminho: posição, tamanho e cor no ponto médio', () => {
    const out = interpolateFrames(from, to, 0.5);
    const btn = out.find((s) => s.id === 'a-btn')!;
    expect(btn).toMatchObject({ x: 60, y: 150, width: 150, height: 60 });
    expect(btn.fill).toBe('#808080');
  });

  it('camadas sem par dissolvem: some na origem, aparece no destino', () => {
    const out = interpolateFrames(from, to, 0.25);
    expect(out.find((s) => s.id === 'a-only')!.opacity).toBeCloseTo(0.75);
    expect(out.find((s) => s.id === 'in-b-only')!.opacity).toBeCloseTo(0.25);
    expect(interpolateFrames(from, to, 1).find((s) => s.id === 'a-only')!.opacity).toBe(0);
  });

  it('t=0 reproduz a origem e t=1 chega no destino', () => {
    expect(interpolateFrames(from, to, 0).find((s) => s.id === 'a-btn')).toMatchObject({ x: 20, y: 50, width: 100 });
    expect(interpolateFrames(from, to, 1).find((s) => s.id === 'a-btn')).toMatchObject({ x: 100, y: 250, width: 200 });
  });

  it('lerpColor mistura hex e troca no meio quando não é hex', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColor('transparent', '#ffffff', 0.4)).toBe('transparent');
    expect(lerpColor('transparent', '#ffffff', 0.6)).toBe('#ffffff');
  });
});
