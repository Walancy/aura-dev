import { describe, expect, it } from 'bun:test';
import { measureBetween } from '../src/components/design2/measure';

describe('measureBetween', () => {
  it('boxes lado a lado: vão horizontal na altura do trecho em comum', () => {
    const m = measureBetween({ x: 0, y: 0, width: 100, height: 100 }, { x: 150, y: 50, width: 100, height: 100 });
    const h = m.find((k) => k.axis === 'x')!;
    expect(h).toMatchObject({ from: 100, to: 150, value: 50, cross: 75 });
  });

  it('um dentro do outro: quatro distâncias até as bordas', () => {
    const m = measureBetween({ x: 0, y: 0, width: 200, height: 200 }, { x: 20, y: 40, width: 100, height: 100 });
    expect(m.filter((k) => k.axis === 'x').map((k) => k.value).sort((a, b) => a - b)).toEqual([20, 80]);
    expect(m.filter((k) => k.axis === 'y').map((k) => k.value).sort((a, b) => a - b)).toEqual([40, 60]);
  });

  it('boxes alinhados não geram marca para distância zero', () => {
    const m = measureBetween({ x: 0, y: 0, width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(m).toEqual([]);
  });

  it('boxes na diagonal: um vão em cada eixo', () => {
    const m = measureBetween({ x: 0, y: 0, width: 10, height: 10 }, { x: 30, y: 40, width: 10, height: 10 });
    expect(m.map((k) => [k.axis, k.value])).toEqual([['x', 20], ['y', 30]]);
  });
});
