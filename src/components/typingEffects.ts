import type { Terminal } from '@xterm/xterm';

export type TypingEffectId = 'none' | 'sparks' | 'ripple' | 'shake' | 'click';

export const TYPING_EFFECTS: { id: TypingEffectId; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'sparks', label: 'Faíscas' },
  { id: 'ripple', label: 'Onda no cursor' },
  { id: 'shake', label: 'Tremor' },
  { id: 'click', label: 'Som de tecla' },
];

const KEY = 'ide_terminal_typing_effect';
const read = (): TypingEffectId => {
  try {
    const v = localStorage.getItem(KEY) as TypingEffectId;
    return TYPING_EFFECTS.some((e) => e.id === v) ? v : 'none';
  } catch {
    return 'none';
  }
};
// lido a cada tecla: guardado em memória para não bater no localStorage
let current = read();
export const getTypingEffect = () => current;
export const setTypingEffect = (id: TypingEffectId) => {
  current = id;
  try { localStorage.setItem(KEY, id); } catch {}
};

let audio: AudioContext | null = null;
const click = () => {
  audio ||= new AudioContext();
  const len = Math.floor(audio.sampleRate * 0.025);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.value = 0.18;
  src.buffer = buf;
  src.connect(gain).connect(audio.destination);
  src.start();
};

/** Chamado a cada tecla digitada: `host` é o elemento (position: absolute/relative) que contém o xterm */
export const playTypingEffect = (term: Terminal, host: HTMLElement, data: string) => {
  const fx = current;
  if (fx === 'none' || data.length > 8) return; // colagens grandes não disparam efeito
  if (fx === 'click') return click();
  if (fx === 'shake') {
    const dx = (Math.random() - 0.5) * 4, dy = (Math.random() - 0.5) * 4;
    host.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 90, easing: 'ease-out' });
    return;
  }
  const screen = term.element?.querySelector('.xterm-screen') as HTMLElement | null;
  if (!screen) return;
  const r = screen.getBoundingClientRect(), h = host.getBoundingClientRect();
  const cw = r.width / term.cols, ch = r.height / term.rows;
  // o eco ainda não chegou: um caractere imprimível deixa o cursor uma célula à frente
  const col = term.buffer.active.cursorX + (data >= ' ' && data !== '\x7f' ? 1 : 0);
  const x = r.left - h.left + col * cw, y = r.top - h.top + (term.buffer.active.cursorY + 0.5) * ch;
  const color = term.options.theme?.cursor || '#ffffff';
  const spawn = (size: number, style: Partial<CSSStyleDeclaration>, frames: Keyframe[], ms: number) => {
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, pointerEvents: 'none', zIndex: '5', ...style });
    host.appendChild(el);
    el.animate(frames, { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
  };
  if (fx === 'ripple') {
    spawn(10, { border: `1.5px solid ${color}`, borderRadius: '50%' }, [{ transform: 'scale(0.4)', opacity: 0.9 }, { transform: 'scale(3)', opacity: 0 }], 380);
    return;
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 16;
    spawn(3, { background: color, borderRadius: '50%', boxShadow: `0 0 4px ${color}` }, [{ transform: 'translate(0, 0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 6}px)`, opacity: 0 }], 420);
  }
};
