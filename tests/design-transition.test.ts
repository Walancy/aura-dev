import { describe, expect, it } from 'bun:test';
import { oppositeDirection, transitionPoses } from '../src/components/design2/transition';

describe('transições de protótipo', () => {
  it('push para a esquerda: a tela atual sai para a esquerda e a nova entra pela direita', () => {
    expect(transitionPoses('push', 'left', 0)).toEqual({ from: { tx: 0, ty: 0, opacity: 1 }, to: { tx: 1, ty: 0, opacity: 1 } });
    const mid = transitionPoses('push', 'left', 0.5);
    expect(mid.from.tx).toBeCloseTo(-0.5);
    expect(mid.to.tx).toBeCloseTo(0.5);
    const end = transitionPoses('push', 'left', 1);
    expect(end.from.tx).toBeCloseTo(-1);
    expect(end.to.tx).toBeCloseTo(0);
  });

  it('move-in: só a nova se move; a atual fica parada', () => {
    const t = transitionPoses('move-in', 'up', 0.25);
    expect(t.from).toEqual({ tx: 0, ty: 0, opacity: 1 });
    expect(t.to.ty).toBeCloseTo(0.75); // entra por baixo
  });

  it('move-out: a atual sai e a nova já está embaixo', () => {
    const t = transitionPoses('move-out', 'right', 0.5);
    expect(t.from.tx).toBeCloseTo(0.5);
    expect(t.to).toEqual({ tx: 0, ty: 0, opacity: 1 });
  });

  it('slide-in move a atual um pouco (30%) junto', () => {
    const t = transitionPoses('slide-in', 'left', 1);
    expect(t.from.tx).toBeCloseTo(-0.3);
    expect(t.to.tx).toBeCloseTo(0);
  });

  it('dissolver troca a opacidade; instantâneo troca logo no primeiro quadro', () => {
    expect(transitionPoses('dissolve', 'left', 0.25)).toEqual({ from: { tx: 0, ty: 0, opacity: 0.75 }, to: { tx: 0, ty: 0, opacity: 0.25 } });
    expect(transitionPoses('instant', 'left', 0).to.opacity).toBe(0);
    expect(transitionPoses('instant', 'left', 0.01).to.opacity).toBe(1);
  });

  it('direção oposta (usada ao voltar)', () => {
    expect(oppositeDirection('left')).toBe('right');
    expect(oppositeDirection('up')).toBe('down');
  });
});
