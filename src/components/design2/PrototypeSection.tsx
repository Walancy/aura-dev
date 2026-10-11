import { Plus, X } from 'lucide-react';
import { EASING_LABEL, type EasingKind } from './easing';
import { interactionsOf, TRANSITION_LABEL, TRIGGER_LABEL, type Action, type Interaction, type OverlayPosition, type Transition, type TransitionType, type Trigger } from './prototype';
import { DEFAULT_DURATION } from './transition';
import type { Shape } from './types';

interface Props {
  shape: Shape;
  frames: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<Shape>) => void;
  onPresent?: (frameId: string) => void;
  presentFrameId?: string;
  themeTokens: any;
  accentColor: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  bgSecondary: string;
  inputBorder: string;
}

const ACTION_LABEL: Record<Action['type'], string> = {
  navigate: 'Ir para',
  back: 'Voltar',
  overlay: 'Abrir overlay',
  'close-overlay': 'Fechar overlay',
  'scroll-to': 'Rolar até',
  url: 'Abrir URL',
  'set-variable': 'Definir variável',
  conditional: 'Se variável…',
};

const defaultAction = (type: Action['type'], firstFrame?: string): Action => {
  switch (type) {
    case 'navigate': return { type, targetId: firstFrame || '' };
    case 'overlay': return { type, targetId: firstFrame || '' };
    case 'scroll-to': return { type, targetId: firstFrame || '' };
    case 'url': return { type, url: 'https://' };
    case 'set-variable': return { type, name: 'estado', op: 'set', value: 'ativo' };
    case 'conditional': return { type, when: { variable: 'estado', op: '==', value: 'ativo' }, then: [{ type: 'navigate', targetId: firstFrame || '' }], else: [] };
    case 'back': return { type };
    case 'close-overlay': return { type };
  }
};

/** Seção "Protótipo" do painel: gatilhos e ações do elemento, transições, overlays, variáveis e fluxo */
export default function PrototypeSection({ shape, frames, onChange, onPresent, presentFrameId, accentColor, divider, textPrimary, textSecondary, bgSecondary, inputBorder }: Props) {
  const list = interactionsOf(shape);
  const commit = (next: Interaction[]) => onChange({ interactions: next.length ? next : undefined, prototypeLink: undefined });
  const patchOne = (id: string, p: Partial<Interaction>) => commit(list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const first = frames.find((f) => f.id !== shape.id)?.id;
  const sel: React.CSSProperties = { background: bgSecondary, border: `1px solid ${inputBorder}`, borderRadius: 5, color: textPrimary, fontSize: 11, height: 24, padding: '0 4px', minWidth: 0 };
  const input: React.CSSProperties = { ...sel, padding: '0 6px' };

  const frameSelect = (value: string, onVal: (id: string) => void) => (
    <select value={value} onChange={(e) => onVal(e.target.value)} style={sel}>
      <option value="">— frame —</option>
      {frames.filter((f) => f.id !== shape.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
    </select>
  );

  const transitionEditor = (t: Transition | undefined, onT: (t: Transition | undefined) => void) => {
    const cur = t || { type: 'instant' as TransitionType };
    const moves = cur.type !== 'instant' && cur.type !== 'dissolve' && cur.type !== 'smart-animate';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <select value={cur.type} onChange={(e) => onT({ ...cur, type: e.target.value as TransitionType, durationMs: undefined })} style={sel} title="Transição">
          {(Object.keys(TRANSITION_LABEL) as TransitionType[]).map((k) => <option key={k} value={k}>{TRANSITION_LABEL[k]}</option>)}
        </select>
        {moves ? (
          <select value={cur.direction || 'left'} onChange={(e) => onT({ ...cur, direction: e.target.value as Transition['direction'] })} style={sel} title="Direção do movimento">
            <option value="left">← esquerda</option>
            <option value="right">→ direita</option>
            <option value="up">↑ cima</option>
            <option value="down">↓ baixo</option>
          </select>
        ) : <span />}
        {cur.type !== 'instant' && (
          <>
            <input type="number" min={50} step={50} value={cur.durationMs ?? DEFAULT_DURATION[cur.type]} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onT({ ...cur, durationMs: Math.max(0, Number(e.target.value) || 0) })} style={input} title="Duração (ms)" />
            <select value={cur.easing || 'ease-in-out'} onChange={(e) => onT({ ...cur, easing: e.target.value as EasingKind })} style={sel} title="Curva">
              {(Object.keys(EASING_LABEL) as EasingKind[]).map((k) => <option key={k} value={k}>{EASING_LABEL[k]}</option>)}
            </select>
          </>
        )}
      </div>
    );
  };

  const actionEditor = (a: Action, onA: (a: Action) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <select value={a.type} onChange={(e) => onA(defaultAction(e.target.value as Action['type'], first))} style={sel}>
        {(Object.keys(ACTION_LABEL) as Action['type'][]).map((k) => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
      </select>
      {(a.type === 'navigate' || a.type === 'overlay' || a.type === 'scroll-to') && frameSelect(a.targetId, (id) => onA({ ...a, targetId: id }))}
      {a.type === 'overlay' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={a.position || 'center'} onChange={(e) => onA({ ...a, position: e.target.value as OverlayPosition })} style={sel}>
            <option value="center">Centro</option>
            <option value="top">Topo</option>
            <option value="bottom">Embaixo</option>
            <option value="left">Esquerda</option>
            <option value="right">Direita</option>
          </select>
          <label style={{ fontSize: 10.5, color: textSecondary, display: 'flex', gap: 3, alignItems: 'center' }}><input type="checkbox" checked={a.dim ?? true} onChange={(e) => onA({ ...a, dim: e.target.checked })} />Escurecer fundo</label>
          <label style={{ fontSize: 10.5, color: textSecondary, display: 'flex', gap: 3, alignItems: 'center' }}><input type="checkbox" checked={a.closeOnOutside ?? true} onChange={(e) => onA({ ...a, closeOnOutside: e.target.checked })} />Fechar ao clicar fora</label>
        </div>
      )}
      {a.type === 'url' && <input value={a.url} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onA({ ...a, url: e.target.value })} style={input} placeholder="https://" />}
      {a.type === 'set-variable' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr', gap: 4 }}>
          <input value={a.name} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onA({ ...a, name: e.target.value })} style={input} placeholder="nome" />
          <select value={a.op} onChange={(e) => onA({ ...a, op: e.target.value as 'set' | 'toggle' | 'add' })} style={sel}>
            <option value="set">=</option>
            <option value="toggle">alternar</option>
            <option value="add">+</option>
          </select>
          {a.op !== 'toggle' && <input value={String(a.value ?? '')} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onA({ ...a, value: a.op === 'add' ? Number(e.target.value) || 0 : e.target.value })} style={input} placeholder="valor" />}
        </div>
      )}
      {a.type === 'conditional' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 1fr', gap: 4 }}>
            <input value={a.when.variable} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onA({ ...a, when: { ...a.when, variable: e.target.value } })} style={input} placeholder="variável" />
            <select value={a.when.op} onChange={(e) => onA({ ...a, when: { ...a.when, op: e.target.value as '==' | '!=' | '>' | '<' } })} style={sel}>
              <option value="==">=</option>
              <option value="!=">≠</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
            </select>
            <input value={String(a.when.value)} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onA({ ...a, when: { ...a.when, value: e.target.value === 'true' ? true : e.target.value === 'false' ? false : isNaN(Number(e.target.value)) || e.target.value === '' ? e.target.value : Number(e.target.value) } })} style={input} placeholder="valor" />
          </div>
          <span style={{ fontSize: 10.5, color: textSecondary }}>Então ir para</span>
          {frameSelect((a.then[0] as { targetId?: string } | undefined)?.targetId || '', (id) => onA({ ...a, then: [{ type: 'navigate', targetId: id }] }))}
          <span style={{ fontSize: 10.5, color: textSecondary }}>Senão ir para</span>
          {frameSelect((a.else?.[0] as { targetId?: string } | undefined)?.targetId || '', (id) => onA({ ...a, else: id ? [{ type: 'navigate', targetId: id }] : [] }))}
        </>
      )}
      {(a.type === 'navigate' || a.type === 'back' || a.type === 'overlay' || a.type === 'close-overlay') && transitionEditor(a.transition, (t) => onA({ ...a, transition: t } as Action))}
    </div>
  );

  const isFrame = shape.type === 'frame';
  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary, flex: 1 }}>Protótipo</span>
        <button type="button" title="Adicionar interação" onClick={() => commit([...list, { id: `i-${Date.now().toString(36)}`, trigger: 'click', actions: [defaultAction('navigate', first)] }])} style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}>
          <Plus size={12} />
        </button>
        {presentFrameId && (
          <button type="button" onClick={() => onPresent?.(presentFrameId)} style={{ background: accentColor, border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
            ▶ Apresentar
          </button>
        )}
      </div>

      {list.map((it) => (
        <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, borderRadius: 6, background: `${accentColor}0f` }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={it.trigger} onChange={(e) => patchOne(it.id, { trigger: e.target.value as Trigger })} style={{ ...sel, flex: 1 }}>
              {(Object.keys(TRIGGER_LABEL) as Trigger[]).map((k) => <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>)}
            </select>
            {it.trigger === 'key' && <input value={it.key || ''} placeholder="tecla" onKeyDown={(e) => { e.preventDefault(); e.stopPropagation(); patchOne(it.id, { key: e.key }); }} readOnly style={{ ...input, width: 70 }} title="Clique e pressione a tecla" />}
            {it.trigger === 'after-delay' && <input type="number" min={0} step={100} value={it.delayMs ?? 1000} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => patchOne(it.id, { delayMs: Math.max(0, Number(e.target.value) || 0) })} style={{ ...input, width: 70 }} title="Espera (ms)" />}
            <button type="button" title="Remover interação" onClick={() => commit(list.filter((i) => i.id !== it.id))} style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={12} /></button>
          </div>
          {actionEditor(it.actions[0] || defaultAction('navigate', first), (a) => patchOne(it.id, { actions: [a, ...it.actions.slice(1)] }))}
        </div>
      ))}
      {list.length === 0 && <span style={{ fontSize: 10.5, color: textSecondary }}>Sem interações. Use + para ligar este elemento a outro frame.</span>}

      {!isFrame && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: textSecondary, cursor: 'pointer' }} title="Não rola junto com o conteúdo do frame (ex.: barra de navegação)">
          <input type="checkbox" checked={!!shape.fixedOnScroll} onChange={(e) => onChange({ fixedOnScroll: e.target.checked || undefined })} />
          Fixo ao rolar
        </label>
      )}
      {isFrame && !shape.parentId && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: textSecondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!shape.flowStart} onChange={(e) => onChange({ flowStart: e.target.checked || undefined })} />
            Ponto de partida de um fluxo
          </label>
          {shape.flowStart && <input value={shape.flowName || ''} placeholder="Nome do fluxo" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => onChange({ flowName: e.target.value || undefined })} style={input} />}
        </>
      )}
    </div>
  );
}
