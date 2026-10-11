import { describe, expect, it } from 'bun:test';
import { filterLayers } from '../src/components/design2/layersFilter';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

const doc = [
  mk({ id: '1', name: 'Botão primário', fill: '#FF0000' }),
  mk({ id: '2', type: 'text' as any, name: 'Título', text: 'Bem-vindo' }),
  mk({ id: '3', type: 'frame' as any, name: 'Tela de login' }),
  mk({ id: '4', type: 'ellipse' as any, name: 'Avatar', fill: '#00ff00' }),
];

describe('buscar camadas', () => {
  it('vazio devolve todas', () => {
    expect(filterLayers(doc, '  ')).toHaveLength(4);
  });
  it('por nome, sem diferenciar caixa', () => {
    expect(filterLayers(doc, 'BOTÃO').map((s) => s.id)).toEqual(['1']);
  });
  it('por tipo em português ou inglês', () => {
    expect(filterLayers(doc, 'texto').map((s) => s.id)).toEqual(['2']);
    expect(filterLayers(doc, 'frame').map((s) => s.id)).toEqual(['3']);
    expect(filterLayers(doc, 'elipse').map((s) => s.id)).toEqual(['4']);
  });
  it('por conteúdo do texto e por cor', () => {
    expect(filterLayers(doc, 'bem-vindo').map((s) => s.id)).toEqual(['2']);
    expect(filterLayers(doc, '#ff0000').map((s) => s.id)).toEqual(['1']);
    expect(filterLayers(doc, '#0').map((s) => s.id)).toEqual(['4']);
  });
});

describe('filtro por status de dev', () => {
  it('"pronto" e "implementado" filtram pelo status', () => {
    const list = [mk({ id: 'a', name: 'A', devStatus: 'ready' } as any), mk({ id: 'b', name: 'B', devStatus: 'done' } as any), mk({ id: 'c', name: 'C' })];
    expect(filterLayers(list, 'pronto').map((s) => s.id)).toEqual(['a']);
    expect(filterLayers(list, 'Implementado').map((s) => s.id)).toEqual(['b']);
  });
});
