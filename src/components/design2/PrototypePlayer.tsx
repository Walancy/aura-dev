import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boundsOfShapes, svgFromShapes, uniquifySvgIds } from './exportDesign';
import { ease, type EasingKind } from './easing';
import { currentFrame, initialState, interactionsOf, matching, runActions, type Direction, type Effect, type OverlayState, type ProtoState, type Transition, type TransitionType, type Trigger } from './prototype';
import { interpolateFrames, normalizedSubtree } from './smartAnimate';
import { DEFAULT_DURATION, oppositeDirection, transitionPoses } from './transition';
import type { Shape } from './types';

interface PrototypePlayerProps {
  shapes: Shape[];
  startFrameId: string;
  accentColor: string;
  onClose: () => void;
}

interface FrameLayers {
  shapes: Shape[]; // frame na origem
  width: number;
  height: number;
  /** origem da área desenhada (inclui sombras e peças que passam da borda do frame) */
  ox: number;
  oy: number;
  staticSvg: string;
  scrollSvg: string | null;
  contentW: number;
  contentH: number;
  mode: 'none' | 'vertical' | 'horizontal' | 'both';
}

interface Anim {
  from: string;
  to: string;
  type: TransitionType;
  direction: Direction;
  durationMs: number;
  easing: EasingKind;
  t0: number;
}

const rootOf = (list: Shape[]) => list.find((s) => !s.parentId || !list.some((x) => x.id === s.parentId))!;

/** Modo apresentação: navega entre frames com gatilhos, transições animadas, overlays, rolagem e variáveis. */
export default function PrototypePlayer({ shapes, startFrameId, accentColor, onClose }: PrototypePlayerProps) {
  const [proto, setProto] = useState<ProtoState>(() => initialState(startFrameId));
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [anim, setAnim] = useState<Anim | null>(null);
  const [progress, setProgress] = useState(0);
  const [scroll, setScroll] = useState<Record<string, { x: number; y: number }>>({});
  const protoRef = useRef(proto);
  protoRef.current = proto;
  const cache = useRef(new Map<string, FrameLayers>());
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // camadas de cada frame (SVG estático + SVG que rola), em cache
  const layersOf = useCallback(
    (frameId: string): FrameLayers | null => {
      const hit = cache.current.get(frameId);
      if (hit) return hit;
      const list = normalizedSubtree(shapes, frameId);
      if (!list.length) return null;
      const root = rootOf(list);
      const mode = root.scrollMode || 'none';
      const bounds = boundsOfShapes(list);
      const uid = `pp${cache.current.size}`;
      let staticList = list;
      let scrollList: Shape[] = [];
      if (mode !== 'none') {
        const byId = new Map(list.map((s) => [s.id, s]));
        const isFixed = (s: Shape) => {
          for (let cur: Shape | undefined = s; cur && cur.id !== root.id; cur = cur.parentId ? byId.get(cur.parentId) : undefined) if (cur.fixedOnScroll) return true;
          return false;
        };
        staticList = list.filter((s) => s.id === root.id || isFixed(s));
        scrollList = list.filter((s) => s.id !== root.id && !isFixed(s));
      }
      const layers: FrameLayers = {
        shapes: list,
        width: bounds.width,
        height: bounds.height,
        ox: bounds.x,
        oy: bounds.y,
        staticSvg: uniquifySvgIds(svgFromShapes(staticList, bounds), `${uid}s`),
        scrollSvg: scrollList.length ? uniquifySvgIds(svgFromShapes(scrollList, bounds), `${uid}c`) : null,
        contentW: Math.max(bounds.width, ...scrollList.map((s) => s.x + s.width - bounds.x)),
        contentH: Math.max(bounds.height, ...scrollList.map((s) => s.y + s.height - bounds.y)),
        mode,
      };
      cache.current.set(frameId, layers);
      return layers;
    },
    [shapes]
  );

  const startAnim = useCallback((eff: Extract<Effect, { kind: 'navigate' }>) => {
    const t = eff.transition || { type: 'instant' as const };
    const dur = t.durationMs ?? DEFAULT_DURATION[t.type];
    if (dur <= 0 || t.type === 'instant') return;
    const dir = t.direction || 'left';
    setProgress(0);
    setAnim({ from: eff.from, to: eff.to, type: t.type, direction: eff.back ? oppositeDirection(dir) : dir, durationMs: dur, easing: t.easing || 'ease-in-out', t0: performance.now() });
  }, []);

  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - anim.t0) / anim.durationMs);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setAnim(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim]);

  // executa as ações de uma interação e trata os efeitos
  const fire = useCallback(
    (shape: Shape, trigger: Trigger, key?: string) => {
      if (anim) return;
      const list = matching(shape, trigger, key);
      if (!list.length) return;
      let st = protoRef.current;
      const effects: Effect[] = [];
      for (const it of list) {
        const r = runActions(st, it.actions, shapes);
        st = r.state;
        effects.push(...r.effects);
      }
      protoRef.current = st;
      setProto(st);
      for (const e of effects) {
        if (e.kind === 'navigate') startAnim(e);
        else if (e.kind === 'url') window.open(e.url, '_blank');
        else if (e.kind === 'scroll') {
          const frameId = currentFrame(st);
          const target = shapes.find((s) => s.id === e.targetId);
          const root = shapes.find((s) => s.id === frameId);
          if (target && root) setScroll((sc) => ({ ...sc, [frameId]: { x: 0, y: Math.max(0, target.y - root.y) } }));
        }
      }
    },
    [anim, shapes, startAnim]
  );

  const restart = useCallback(() => {
    const st = initialState(startFrameId);
    protoRef.current = st;
    setProto(st);
    setAnim(null);
    setScroll({});
  }, [startFrameId]);

  const goBack = useCallback(() => {
    const r = runActions(protoRef.current, [{ type: 'back' }], shapes);
    protoRef.current = r.state;
    setProto(r.state);
    r.effects.forEach((e) => e.kind === 'navigate' && startAnim(e));
  }, [shapes, startAnim]);

  const frameId = currentFrame(proto);
  const base = layersOf(frameId);
  const visibleIds = useMemo(() => [frameId, ...proto.overlays.map((o) => o.frameId)], [frameId, proto.overlays]);

  // gatilhos de teclado e de tempo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key === 'r' || e.key === 'R') return restart();
      if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && protoRef.current.stack.length > 1 && !protoRef.current.overlays.length) return goBack();
      for (const id of visibleIds) {
        const l = layersOf(id);
        l?.shapes.forEach((s) => matching(s, 'key', e.key).length && fire(shapes.find((x) => x.id === s.id) || s, 'key', e.key));
      }
    };
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose, restart, goBack, visibleIds, layersOf, fire, shapes]);

  useEffect(() => {
    if (anim) return;
    const timers: number[] = [];
    for (const id of visibleIds) {
      layersOf(id)?.shapes.forEach((s) => {
        interactionsOf(s)
          .filter((i) => i.trigger === 'after-delay')
          .forEach((i) => {
            const orig = shapes.find((x) => x.id === s.id);
            if (orig) timers.push(window.setTimeout(() => fire({ ...orig, interactions: [i], prototypeLink: undefined }, 'after-delay'), Math.max(0, i.delayMs ?? 1000)));
          });
      });
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // reinicia os temporizadores quando a tela visível muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds.join('|'), anim ? 1 : 0]);

  if (!base) return null;
  const k = Math.min((size.w - 80) / base.width, (size.h - 100) / base.height, 3);
  const W = base.width;
  const H = base.height;

  const renderLayer = (id: string, key: string, style?: React.CSSProperties, interactive = true, overlay?: OverlayState) => {
    const l = layersOf(id);
    if (!l) return null;
    const sc = scroll[id] || { x: 0, y: 0 };
    const maxY = Math.max(0, l.contentH - l.height);
    const maxX = Math.max(0, l.contentW - l.width);
    const oy = l.mode === 'vertical' || l.mode === 'both' ? Math.min(maxY, Math.max(0, sc.y)) : 0;
    const ox = l.mode === 'horizontal' || l.mode === 'both' ? Math.min(maxX, Math.max(0, sc.x)) : 0;
    const hot = l.shapes.filter((s) => interactionsOf(s).length > 0 && s.visible !== false);
    const fixedIds = new Set(l.shapes.filter((s) => s.fixedOnScroll).map((s) => s.id));
    return (
      <div key={key} style={{ position: 'absolute', left: 0, top: 0, width: l.width, height: l.height, overflow: 'hidden', ...style }}
        onWheel={(e) => {
          if (l.mode === 'none') return;
          setScroll((cur) => {
            const c = cur[id] || { x: 0, y: 0 };
            return { ...cur, [id]: { x: Math.min(maxX, Math.max(0, c.x + (l.mode !== 'vertical' ? e.deltaX : 0))), y: Math.min(maxY, Math.max(0, c.y + (l.mode !== 'horizontal' ? e.deltaY : 0))) } };
          });
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: l.staticSvg }} />
        {l.scrollSvg && <div style={{ position: 'absolute', left: -ox, top: -oy }} dangerouslySetInnerHTML={{ __html: l.scrollSvg }} />}
        {interactive &&
          hot.map((s) => {
            const fixed = fixedIds.has(s.id) || s.id === rootOf(l.shapes).id;
            return (
              <div
                key={s.id}
                title={interactionsOf(s).map((i) => i.trigger).join(', ')}
                onClick={() => { const o = shapes.find((x) => x.id === s.id); if (o) fire(o, 'click'); }}
                onMouseEnter={() => { const o = shapes.find((x) => x.id === s.id); if (o) fire(o, 'hover'); }}
                onPointerDown={(e) => { dragStart.current = { x: e.clientX, y: e.clientY }; }}
                onPointerUp={(e) => {
                  const st = dragStart.current;
                  dragStart.current = null;
                  if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 24) { const o = shapes.find((x) => x.id === s.id); if (o) fire(o, 'drag'); }
                }}
                style={{ position: 'absolute', left: s.x - l.ox - (fixed ? 0 : ox), top: s.y - l.oy - (fixed ? 0 : oy), width: s.width, height: s.height, cursor: 'pointer', borderRadius: s.cornerRadius || 0, outline: `${2 / k}px solid ${accentColor}55` }}
              />
            );
          })}
        {overlay && null}
      </div>
    );
  };

  // durante a transição: smart animate monta um SVG interpolado; as demais, duas camadas com poses
  let stage: React.ReactNode;
  if (anim) {
    const p = ease(progress, anim.easing);
    if (anim.type === 'smart-animate') {
      const a = layersOf(anim.from);
      const b = layersOf(anim.to);
      if (a && b) {
        const w = a.width + (b.width - a.width) * p;
        const h = a.height + (b.height - a.height) * p;
        const mixed = interpolateFrames(a.shapes, b.shapes, p);
        const ob = boundsOfShapes(mixed);
        const svg = uniquifySvgIds(svgFromShapes(mixed, { x: ob.x, y: ob.y, width: Math.max(1, w), height: Math.max(1, h) }), 'pa');
        stage = <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: svg }} />;
      }
    } else {
      const poses = transitionPoses(anim.type, anim.direction, p);
      const pose = (x: { tx: number; ty: number; opacity: number }): React.CSSProperties => ({ transform: `translate(${x.tx * W}px, ${x.ty * H}px)`, opacity: x.opacity });
      stage = (
        <>
          {renderLayer(anim.from, 'from', pose(poses.from), false)}
          {renderLayer(anim.to, 'to', pose(poses.to), false)}
        </>
      );
    }
  } else {
    stage = (
      <>
        {renderLayer(frameId, 'base')}
        {proto.overlays.map((o, i) => {
          const l = layersOf(o.frameId);
          if (!l) return null;
          const pos: React.CSSProperties =
            o.position === 'top' ? { left: (W - l.width) / 2, top: 0 } : o.position === 'bottom' ? { left: (W - l.width) / 2, top: H - l.height } : o.position === 'left' ? { left: 0, top: (H - l.height) / 2 } : o.position === 'right' ? { left: W - l.width, top: (H - l.height) / 2 } : { left: (W - l.width) / 2, top: (H - l.height) / 2 };
          const last = i === proto.overlays.length - 1;
          return (
            <React.Fragment key={`ov-${o.frameId}`}>
              {o.dim && (
                <div
                  onClick={() => {
                    if (last && o.closeOnOutside) {
                      const r = runActions(protoRef.current, [{ type: 'close-overlay' }], shapes);
                      protoRef.current = r.state;
                      setProto(r.state);
                    }
                  }}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', animation: 'proto-fade 0.2s ease' }}
                />
              )}
              {renderLayer(o.frameId, `ovl-${o.frameId}`, { ...pos, animation: `proto-pop-${o.position} 0.25s ease`, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }, last)}
            </React.Fragment>
          );
        })}
      </>
    );
  }

  const frameName = shapes.find((s) => s.id === frameId)?.name || 'Frame';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(8,8,8,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes proto-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes proto-pop-center { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
        @keyframes proto-pop-top { from { transform: translateY(-100%) } to { transform: translateY(0) } }
        @keyframes proto-pop-bottom { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes proto-pop-left { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes proto-pop-right { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
      <div style={{ position: 'absolute', top: 14, left: 18, right: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#d4d4d4', fontFamily: "'Poppins', sans-serif", fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{frameName}</span>
        <span style={{ opacity: 0.6 }}>Clique nos elementos destacados • ← volta • R reinicia • Esc sai</span>
        <span style={{ flex: 1 }} />
        {Object.keys(proto.vars).length > 0 && <span style={{ opacity: 0.6 }}>{Object.entries(proto.vars).map(([n, v]) => `${n}=${String(v)}`).join('  ')}</span>}
        {proto.stack.length > 1 && (
          <button type="button" onClick={goBack} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 6, color: '#ddd', padding: '4px 10px', cursor: 'pointer' }}>Voltar</button>
        )}
        <button type="button" onClick={restart} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 6, color: '#ddd', padding: '4px 10px', cursor: 'pointer' }}>Reiniciar</button>
        <button type="button" onClick={onClose} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', padding: '4px 12px', cursor: 'pointer' }}>Sair</button>
      </div>
      <div style={{ position: 'relative', width: W * k, height: H * k, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${k})`, transformOrigin: '0 0', overflow: 'hidden' }}>{stage}</div>
      </div>
    </div>
  );
}
