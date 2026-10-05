import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';

// Ritmo do projeto: issues criadas × concluídas por período.
// Responde "o time está dando conta ou o backlog está crescendo?" — algo que os KPIs pontuais não mostram.

type TimeRange = 'all' | '7d' | '14d' | '30d';

interface Props {
  issues: ProjectIssue[];
  timeRange: TimeRange;
  isEffectiveDark: boolean;
  c: { card: string; cardSecondary: string; textPrimary: string; textSecondary: string; textMuted: string; borderSubtle: string; pillActive: string };
}

// Paleta categórica de referência, validada (contraste, CVD e separação) nos dois modos sobre as superfícies do app
const SERIES = {
  light: { created: '#2a78d6', done: '#eb6834' },
  dark: { created: '#3987e5', done: '#d95926' },
};

const DAY = 86400000;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

interface Bucket {
  start: number;
  end: number;
  label: string;
  longLabel: string;
  created: number;
  done: number;
}

function buildBuckets(issues: ProjectIssue[], range: TimeRange): Bucket[] {
  const today = startOfDay(Date.now());
  const daily = range === '7d' || range === '14d';
  const count = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 5 : 12;
  const size = daily ? DAY : 7 * DAY;
  const fmt = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const end = today + DAY - i * size;
    const start = end - size;
    buckets.push({
      start,
      end,
      label: daily ? new Date(start).toLocaleDateString('pt-BR', { day: '2-digit' }) : fmt(start),
      longLabel: cap(daily ? new Date(start).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : `${fmt(start)} – ${fmt(end - DAY)}`),
      created: 0,
      done: 0,
    });
  }
  const place = (iso: string | undefined, key: 'created' | 'done') => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) b[key]++;
  };
  issues.forEach((i) => {
    place(i.createdAtIso, 'created');
    if (i.status === 'Concluído') place(i.closedAtIso, 'done');
  });
  return buckets;
}

// Barra com cantos de 4px só no topo, base reta no eixo
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export const ThroughputTrendCard: React.FC<Props> = ({ issues, timeRange, isEffectiveDark, c }) => {
  const colors = isEffectiveDark ? SERIES.dark : SERIES.light;
  const buckets = useMemo(() => buildBuckets(issues, timeRange), [issues, timeRange]);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(520);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const totals = buckets.reduce((a, b) => ({ created: a.created + b.created, done: a.done + b.done }), { created: 0, done: 0 });
  const net = totals.created - totals.done;
  const hasClosedDates = issues.some((i) => i.closedAtIso);
  const unit = timeRange === '7d' || timeRange === '14d' ? 'dia' : 'semana';

  // Geometria
  const height = 132;
  const padTop = 10;
  const padBottom = 20;
  const padLeft = 22;
  const plotH = height - padTop - padBottom;
  const plotW = width - padLeft;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.created, b.done)));
  const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const slot = plotW / buckets.length;
  const gap = 2; // espaço de superfície entre as duas barras do par
  const barW = Math.max(3, Math.min(14, (slot * 0.62 - gap) / 2));
  const y = (v: number) => padTop + plotH - (v / niceMax) * plotH;
  const labelEvery = buckets.length > 8 ? Math.ceil(buckets.length / 6) : 1;
  const hovered = hover != null ? buckets[hover] : null;

  const NetIcon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus;
  const netText = net > 0 ? `backlog cresceu ${net}` : net < 0 ? `backlog diminuiu ${-net}` : 'backlog estável';

  return (
    <div style={{ background: c.card, borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={13} color={colors.done} />
          <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>Ritmo: criadas × concluídas</span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                background: view === v ? c.pillActive : 'transparent',
                color: view === v ? c.textPrimary : c.textMuted,
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 9.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {v === 'chart' ? 'Gráfico' : 'Tabela'}
            </button>
          ))}
        </div>
      </div>

      {/* Resumo + legenda (identidade nunca só pela cor: rótulo ao lado de cada swatch) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 11, color: c.textSecondary }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: colors.created }} />
          Criadas <b style={{ color: c.textPrimary, fontWeight: 600 }}>{totals.created}</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: colors.done }} />
          Concluídas <b style={{ color: c.textPrimary, fontWeight: 600 }}>{totals.done}</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: c.textPrimary }}>
          <NetIcon size={12} color={c.textSecondary} />
          {netText}
        </span>
      </div>

      {!hasClosedDates && totals.done === 0 && (
        <div style={{ fontSize: 10.5, color: c.textMuted }}>Sem datas de fechamento ainda — atualize o projeto para carregar o histórico de conclusões.</div>
      )}

      {view === 'chart' ? (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHover(null)}>
          <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`Issues criadas e concluídas por ${unit}`}>
            {/* Grade recessiva */}
            {[0, 0.5, 1].map((f) => {
              const v = Math.round(niceMax * f);
              return (
                <g key={f}>
                  <line x1={padLeft} x2={width} y1={y(v)} y2={y(v)} stroke={c.borderSubtle} strokeWidth={1} />
                  <text x={padLeft - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill={c.textMuted}>
                    {v}
                  </text>
                </g>
              );
            })}
            {buckets.map((b, i) => {
              const cx = padLeft + slot * i + slot / 2;
              const x1 = cx - gap / 2 - barW;
              const x2 = cx + gap / 2;
              const dim = hover != null && hover !== i;
              return (
                <g key={b.start} opacity={dim ? 0.45 : 1}>
                  <path d={barPath(x1, y(b.created), barW, padTop + plotH - y(b.created))} fill={colors.created} />
                  <path d={barPath(x2, y(b.done), barW, padTop + plotH - y(b.done))} fill={colors.done} />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={height - 5} textAnchor="middle" fontSize={9} fill={hover === i ? c.textPrimary : c.textMuted}>
                      {b.label}
                    </text>
                  )}
                  {/* Alvo de hover maior que a barra: a coluna inteira */}
                  <rect x={padLeft + slot * i} y={padTop} width={slot} height={plotH + padBottom} fill="transparent" onMouseEnter={() => setHover(i)} />
                </g>
              );
            })}
          </svg>

          {hovered && hover != null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: Math.min(Math.max(0, padLeft + slot * hover + slot / 2 - 70), width - 140),
                width: 140,
                pointerEvents: 'none',
                background: isEffectiveDark ? '#1f1f1f' : '#ffffff',
                boxShadow: isEffectiveDark ? '0 6px 18px rgba(0,0,0,0.6)' : '0 6px 18px rgba(0,0,0,0.12)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 10.5,
                color: c.textSecondary,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ color: c.textPrimary, fontWeight: 600}}>{hovered.longLabel}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: colors.created }} /> Criadas
                <b style={{ marginLeft: 'auto', color: c.textPrimary }}>{hovered.created}</b>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: colors.done }} /> Concluídas
                <b style={{ marginLeft: 'auto', color: c.textPrimary }}>{hovered.done}</b>
              </span>
              <span style={{ display: 'flex', borderTop: `1px solid ${c.borderSubtle}`, paddingTop: 2, marginTop: 1 }}>
                Saldo
                <b style={{ marginLeft: 'auto', color: c.textPrimary }}>
                  {hovered.created - hovered.done > 0 ? '+' : ''}
                  {hovered.created - hovered.done}
                </b>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: c.textMuted, textAlign: 'right' }}>
                <th style={{ textAlign: 'left', fontWeight: 500, padding: '3px 4px' }}>Período</th>
                <th style={{ fontWeight: 500, padding: '3px 4px' }}>Criadas</th>
                <th style={{ fontWeight: 500, padding: '3px 4px' }}>Concluídas</th>
                <th style={{ fontWeight: 500, padding: '3px 4px' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((b) => (
                <tr key={b.start} style={{ borderTop: `1px solid ${c.borderSubtle}`, color: c.textPrimary, textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', padding: '3px 4px', color: c.textSecondary}}>{b.longLabel}</td>
                  <td style={{ padding: '3px 4px' }}>{b.created}</td>
                  <td style={{ padding: '3px 4px' }}>{b.done}</td>
                  <td style={{ padding: '3px 4px' }}>
                    {b.created - b.done > 0 ? '+' : ''}
                    {b.created - b.done}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
