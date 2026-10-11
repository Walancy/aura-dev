import type { Shape } from './types';
import type { EasingKind } from './easing';

export type Trigger = 'click' | 'hover' | 'drag' | 'key' | 'after-delay';
export type TransitionType = 'instant' | 'dissolve' | 'smart-animate' | 'move-in' | 'move-out' | 'push' | 'slide-in' | 'slide-out';
export type Direction = 'left' | 'right' | 'up' | 'down';
export type OverlayPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface Transition {
  type: TransitionType;
  direction?: Direction;
  durationMs?: number;
  easing?: EasingKind;
}

export type VarValue = string | number | boolean;

export interface Condition {
  variable: string;
  op: '==' | '!=' | '>' | '<';
  value: VarValue;
}

export type Action =
  | { type: 'navigate'; targetId: string; transition?: Transition }
  | { type: 'back'; transition?: Transition }
  | { type: 'overlay'; targetId: string; position?: OverlayPosition; dim?: boolean; closeOnOutside?: boolean; transition?: Transition }
  | { type: 'close-overlay'; transition?: Transition }
  | { type: 'scroll-to'; targetId: string }
  | { type: 'url'; url: string }
  | { type: 'set-variable'; name: string; op: 'set' | 'toggle' | 'add'; value?: VarValue }
  | { type: 'conditional'; when: Condition; then: Action[]; else?: Action[] };

export interface Interaction {
  id: string;
  trigger: Trigger;
  /** trigger "key": tecla (event.key, ex.: "Enter", "ArrowRight") */
  key?: string;
  /** trigger "after-delay": espera em ms depois de o frame aparecer */
  delayMs?: number;
  actions: Action[];
}

export const TRIGGER_LABEL: Record<Trigger, string> = { click: 'Ao clicar', hover: 'Ao passar o mouse', drag: 'Ao arrastar', key: 'Ao pressionar tecla', 'after-delay': 'Depois de um tempo' };
export const TRANSITION_LABEL: Record<TransitionType, string> = {
  instant: 'Instantâneo',
  dissolve: 'Dissolver',
  'smart-animate': 'Smart animate',
  'move-in': 'Entrar',
  'move-out': 'Sair',
  push: 'Empurrar',
  'slide-in': 'Deslizar (entra)',
  'slide-out': 'Deslizar (sai)',
};

/** Interações do shape; o `prototypeLink` antigo (clicar → ir para) vira uma interação equivalente. */
export function interactionsOf(s: Shape): Interaction[] {
  const list = s.interactions ? [...s.interactions] : [];
  if (s.prototypeLink?.targetId && !list.some((i) => i.trigger === 'click' && i.actions.some((a) => a.type === 'navigate' && a.targetId === s.prototypeLink!.targetId))) {
    list.unshift({ id: `legacy-${s.id}`, trigger: 'click', actions: [{ type: 'navigate', targetId: s.prototypeLink.targetId }] });
  }
  return list;
}

export const hasInteractions = (s: Shape) => interactionsOf(s).length > 0;

export function matching(s: Shape, trigger: Trigger, key?: string): Interaction[] {
  return interactionsOf(s).filter((i) => i.trigger === trigger && (trigger !== 'key' || !i.key || i.key === key));
}

export interface OverlayState {
  frameId: string;
  position: OverlayPosition;
  dim: boolean;
  closeOnOutside: boolean;
}

export interface ProtoState {
  /** pilha de frames navegados (o último é o atual) */
  stack: string[];
  overlays: OverlayState[];
  vars: Record<string, VarValue>;
}

export type Effect =
  | { kind: 'navigate'; from: string; to: string; transition?: Transition; back: boolean }
  | { kind: 'overlay-open'; overlay: OverlayState; transition?: Transition }
  | { kind: 'overlay-close'; overlay: OverlayState; transition?: Transition }
  | { kind: 'url'; url: string }
  | { kind: 'scroll'; targetId: string };

export const initialState = (startId: string, vars: Record<string, VarValue> = {}): ProtoState => ({ stack: [startId], overlays: [], vars: { ...vars } });
export const currentFrame = (st: ProtoState) => st.stack[st.stack.length - 1];

export function evalCondition(c: Condition, vars: Record<string, VarValue>): boolean {
  const v = vars[c.variable];
  const a = typeof c.value === 'number' ? Number(v) : v;
  switch (c.op) {
    case '==': return String(v) === String(c.value);
    case '!=': return String(v) !== String(c.value);
    case '>': return Number(a) > Number(c.value);
    case '<': return Number(a) < Number(c.value);
  }
}

/** Executa as ações sobre o estado e devolve o novo estado e os efeitos a animar/abrir. */
export function runActions(state: ProtoState, actions: Action[], shapes: Shape[]): { state: ProtoState; effects: Effect[] } {
  let st = { ...state, stack: [...state.stack], overlays: [...state.overlays], vars: { ...state.vars } };
  const effects: Effect[] = [];
  const exists = (id: string) => shapes.some((s) => s.id === id);
  const run = (list: Action[]) => {
    for (const a of list) {
      switch (a.type) {
        case 'navigate': {
          if (!exists(a.targetId) || a.targetId === currentFrame(st)) break;
          effects.push({ kind: 'navigate', from: currentFrame(st), to: a.targetId, transition: a.transition, back: false });
          st.stack.push(a.targetId);
          st.overlays = [];
          break;
        }
        case 'back': {
          if (st.stack.length <= 1) break;
          const from = st.stack.pop()!;
          effects.push({ kind: 'navigate', from, to: currentFrame(st), transition: a.transition, back: true });
          st.overlays = [];
          break;
        }
        case 'overlay': {
          if (!exists(a.targetId) || st.overlays.some((o) => o.frameId === a.targetId)) break;
          const overlay: OverlayState = { frameId: a.targetId, position: a.position || 'center', dim: a.dim ?? true, closeOnOutside: a.closeOnOutside ?? true };
          st.overlays.push(overlay);
          effects.push({ kind: 'overlay-open', overlay, transition: a.transition });
          break;
        }
        case 'close-overlay': {
          const top = st.overlays.pop();
          if (top) effects.push({ kind: 'overlay-close', overlay: top, transition: a.transition });
          break;
        }
        case 'scroll-to':
          if (exists(a.targetId)) effects.push({ kind: 'scroll', targetId: a.targetId });
          break;
        case 'url':
          if (a.url) effects.push({ kind: 'url', url: a.url });
          break;
        case 'set-variable': {
          const cur = st.vars[a.name];
          if (a.op === 'toggle') st.vars[a.name] = !(cur === true || cur === 'true');
          else if (a.op === 'add') st.vars[a.name] = (Number(cur) || 0) + (Number(a.value) || 0);
          else if (a.value !== undefined) st.vars[a.name] = a.value;
          break;
        }
        case 'conditional':
          run(evalCondition(a.when, st.vars) ? a.then : a.else || []);
          break;
      }
    }
  };
  run(actions);
  return { state: st, effects };
}
