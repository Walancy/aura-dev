import { test, expect } from 'bun:test';
import { describeScreenStyle } from '../src/components/design2/screenStyle';

const mk = (o: any) => ({ rotation: 0, fill: '#000', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });

test('resume fundo, paleta, fonte e efeitos da tela atual', () => {
  const all = [
    mk({ id: 's', type: 'frame', width: 393, height: 852, fill: '#1A0A05', fills: [{ id: 'f', type: 'radial', color: '#E8742A', opacity: 1, visible: true, gradientCenter: { x: 0.5, y: 0.2 }, gradientRadius: 0.8, gradientStops: [{ color: '#E8742A', position: 0, opacity: 1 }, { color: '#1A0A05', position: 1, opacity: 1 }] }] }),
    mk({ id: 't', parentId: 's', type: 'text', text: 'Olá', fontSize: 28, fontWeight: 600, fontFamily: 'Poppins', fill: '#FFFFFF' }),
    mk({ id: 'c', parentId: 's', type: 'frame', cornerRadius: 24, fill: '#FFFFFF', effects: [{ id: 'e', type: 'background-blur', visible: true }] }),
  ] as any[];
  const d = describeScreenStyle(all, all[0]);
  expect(d).toContain('radial');
  expect(d).toContain('#E8742A@0%');
  expect(d).toContain('Poppins');
  expect(d).toContain('28');
  expect(d).toContain('24');
  expect(d).toContain('1 componente(s) com vidro');
});
