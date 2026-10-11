import { describe, expect, it } from 'bun:test';
import { currentFrame, evalCondition, initialState, interactionsOf, matching, runActions } from '../src/components/design2/prototype';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'frame', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);
const frames = [mk({ id: 'a' }), mk({ id: 'b' }), mk({ id: 'c' })];

describe('modelo do protótipo', () => {
  it('prototypeLink antigo vira uma interação de clique', () => {
    const s = mk({ id: 'btn', type: 'rect' as any, prototypeLink: { targetId: 'b' } });
    expect(interactionsOf(s)).toEqual([{ id: 'legacy-btn', trigger: 'click', actions: [{ type: 'navigate', targetId: 'b' }] }]);
  });

  it('não duplica quando já existe interação equivalente', () => {
    const s = mk({ id: 'x', prototypeLink: { targetId: 'b' }, interactions: [{ id: 'i1', trigger: 'click', actions: [{ type: 'navigate', targetId: 'b' }] }] });
    expect(interactionsOf(s)).toHaveLength(1);
  });

  it('matching filtra por gatilho e, no teclado, pela tecla', () => {
    const s = mk({ id: 'x', interactions: [
      { id: '1', trigger: 'click', actions: [] },
      { id: '2', trigger: 'key', key: 'Enter', actions: [] },
      { id: '3', trigger: 'key', actions: [] },
    ] });
    expect(matching(s, 'click').map((i) => i.id)).toEqual(['1']);
    expect(matching(s, 'key', 'Enter').map((i) => i.id)).toEqual(['2', '3']);
    expect(matching(s, 'key', 'a').map((i) => i.id)).toEqual(['3']);
  });
});

describe('máquina de estados do protótipo', () => {
  it('navegar empilha e voltar desempilha, com efeitos', () => {
    let st = initialState('a');
    let r = runActions(st, [{ type: 'navigate', targetId: 'b', transition: { type: 'push', direction: 'left' } }], frames);
    expect(currentFrame(r.state)).toBe('b');
    expect(r.effects[0]).toMatchObject({ kind: 'navigate', from: 'a', to: 'b', back: false });
    r = runActions(r.state, [{ type: 'back' }], frames);
    expect(currentFrame(r.state)).toBe('a');
    expect(r.effects[0]).toMatchObject({ kind: 'navigate', from: 'b', to: 'a', back: true });
    // voltar na raiz não faz nada
    expect(runActions(r.state, [{ type: 'back' }], frames).effects).toEqual([]);
  });

  it('navegar para o frame atual ou inexistente é ignorado', () => {
    const st = initialState('a');
    expect(runActions(st, [{ type: 'navigate', targetId: 'a' }], frames).effects).toEqual([]);
    expect(runActions(st, [{ type: 'navigate', targetId: 'nao-existe' }], frames).effects).toEqual([]);
  });

  it('overlay abre por cima, não duplica e fecha o de cima; navegar fecha os overlays', () => {
    let r = runActions(initialState('a'), [{ type: 'overlay', targetId: 'b', position: 'bottom' }], frames);
    expect(r.state.overlays).toEqual([{ frameId: 'b', position: 'bottom', dim: true, closeOnOutside: true }]);
    expect(runActions(r.state, [{ type: 'overlay', targetId: 'b' }], frames).effects).toEqual([]);
    expect(runActions(r.state, [{ type: 'close-overlay' }], frames).state.overlays).toEqual([]);
    expect(runActions(r.state, [{ type: 'navigate', targetId: 'c' }], frames).state.overlays).toEqual([]);
  });

  it('variáveis: set, toggle e add', () => {
    let st = initialState('a', { n: 1 });
    st = runActions(st, [{ type: 'set-variable', name: 'x', op: 'set', value: 'oi' }, { type: 'set-variable', name: 'on', op: 'toggle' }, { type: 'set-variable', name: 'n', op: 'add', value: 2 }], frames).state;
    expect(st.vars).toEqual({ n: 3, x: 'oi', on: true });
    st = runActions(st, [{ type: 'set-variable', name: 'on', op: 'toggle' }], frames).state;
    expect(st.vars.on).toBe(false);
  });

  it('condicional escolhe o ramo pelas variáveis', () => {
    const act = [{ type: 'conditional' as const, when: { variable: 'logado', op: '==' as const, value: true }, then: [{ type: 'navigate' as const, targetId: 'b' }], else: [{ type: 'navigate' as const, targetId: 'c' }] }];
    expect(currentFrame(runActions(initialState('a', { logado: true }), act, frames).state)).toBe('b');
    expect(currentFrame(runActions(initialState('a', { logado: false }), act, frames).state)).toBe('c');
  });

  it('comparações numéricas e de texto', () => {
    expect(evalCondition({ variable: 'n', op: '>', value: 2 }, { n: 3 })).toBe(true);
    expect(evalCondition({ variable: 'n', op: '<', value: 2 }, { n: 3 })).toBe(false);
    expect(evalCondition({ variable: 't', op: '!=', value: 'a' }, { t: 'b' })).toBe(true);
    expect(evalCondition({ variable: 'ausente', op: '==', value: 'x' }, {})).toBe(false);
  });

  it('URL e rolagem viram efeitos, sem mudar o estado', () => {
    const r = runActions(initialState('a'), [{ type: 'url', url: 'https://x.com' }, { type: 'scroll-to', targetId: 'b' }], frames);
    expect(r.effects).toEqual([{ kind: 'url', url: 'https://x.com' }, { kind: 'scroll', targetId: 'b' }]);
    expect(r.state.stack).toEqual(['a']);
  });

  it('o estado original não é alterado', () => {
    const st = initialState('a');
    runActions(st, [{ type: 'navigate', targetId: 'b' }], frames);
    expect(st.stack).toEqual(['a']);
  });
});
