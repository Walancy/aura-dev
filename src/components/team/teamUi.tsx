import React from 'react';
import type { LoadLevel, RepoRole } from './teamTypes';

export interface TeamUiCtx {
  theme: any;
  accentColor: string;
  accentContrastText: string;
  isEffectiveDark: boolean;
}

export const LOAD_META: Record<LoadLevel, { label: string; color: string }> = {
  idle: { label: 'Ocioso', color: '#a3a3a3' },
  ok: { label: 'Equilibrado', color: '#22c55e' },
  high: { label: 'Alto', color: '#f59e0b' },
  overloaded: { label: 'Sobrecarga', color: '#ef4444' },
};

export const ROLE_COLOR: Record<RepoRole, string> = {
  admin: '#ef4444',
  maintain: '#f59e0b',
  write: '#3b82f6',
  triage: '#a855f7',
  read: '#a3a3a3',
};

export const SEVERITY_COLOR = { critical: '#ef4444', warning: '#f59e0b', info: '#3b82f6' } as const;

export const openUrl = (url?: string) => {
  if (url) window.electronAPI?.shell?.openExternal?.(url);
};

export const Panel: React.FC<{ ctx: TeamUiCtx; title?: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode; style?: React.CSSProperties; children: React.ReactNode }> = ({
  ctx,
  title,
  icon,
  right,
  style,
  children,
}) => (
  <div
    style={{
      background: ctx.isEffectiveDark ? '#161616' : '#ffffff',
      borderRadius: 8,
      padding: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 0,
      boxSizing: 'border-box',
      border: 'none',
      boxShadow: 'none',
      ...style,
    }}
  >
    {(title || right) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 400, color: ctx.theme.textPrimary }}>
          {icon}
          {title}
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);

export const Avatar: React.FC<{ ctx: TeamUiCtx; login: string; url?: string; size?: number; ring?: string; title?: string }> = ({ ctx, login, url, size = 24, ring, title }) => (
  <div
    title={title || `@${login}`}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      background: ctx.theme.controlBg,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.42,
      fontWeight: 400,
      color: ctx.theme.textSecondary,
      boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
    }}
  >
    <img
      src={url || `https://github.com/${login}.png?size=${size * 2}`}
      alt={login}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  </div>
);

export const Pill: React.FC<{ color: string; children: React.ReactNode; title?: string; onClick?: () => void; solid?: boolean }> = ({ color, children, title, onClick, solid }) => (
  <span
    title={title}
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10.5,
      fontWeight: 400,
      padding: '2px 7px',
      borderRadius: 10,
      color: solid ? '#fff' : color,
      background: solid ? color : `${color}22`,
      whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : undefined,
      lineHeight: 1.4,
    }}
  >
    {children}
  </span>
);

export const StatTile: React.FC<{ ctx: TeamUiCtx; label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: string; onClick?: () => void }> = ({
  ctx,
  label,
  value,
  hint,
  icon,
  tone,
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      background: ctx.isEffectiveDark ? '#1a1a1a' : '#ffffff',
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
      cursor: onClick ? 'pointer' : undefined,
      border: 'none',
      boxShadow: 'none',
      transition: 'background 0.15s ease',
    }}
    onMouseEnter={(e) => {
      if (onClick) e.currentTarget.style.background = ctx.isEffectiveDark ? '#222222' : '#f5f5f5';
    }}
    onMouseLeave={(e) => {
      if (onClick) e.currentTarget.style.background = ctx.isEffectiveDark ? '#1a1a1a' : '#ffffff';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: ctx.theme.textSecondary }}>
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 400, color: tone || ctx.theme.textPrimary, lineHeight: 1.1 }}>{value}</div>
    {hint && <div style={{ fontSize: 11, color: ctx.theme.textSecondary }}>{hint}</div>}
  </div>
);

export const Sparkline: React.FC<{ values: number[]; color: string; width?: number; height?: number; muted: string }> = ({ values, color, width = 110, height = 28, muted }) => {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`).join(' ');
  const last = values[values.length - 1] ?? 0;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <line x1={0} y1={height - 3} x2={width} y2={height - 3} stroke={muted} strokeWidth={1} opacity={0.4} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length - 1) * step} cy={height - 3 - (last / max) * (height - 6)} r={2.4} fill={color} />
    </svg>
  );
};

export const Bar: React.FC<{ ctx: TeamUiCtx; value: number; max: number; color: string; height?: number }> = ({ ctx, value, max, color, height = 6 }) => (
  <div style={{ flex: 1, height, borderRadius: height, background: ctx.isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden', minWidth: 30 }}>
    <div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, height: '100%', background: color, borderRadius: height, transition: 'width 0.3s ease' }} />
  </div>
);

export const EmptyState: React.FC<{ ctx: TeamUiCtx; icon?: React.ReactNode; text: React.ReactNode }> = ({ ctx, icon, text }) => (
  <div style={{ padding: '22px 12px', textAlign: 'center', color: ctx.theme.textSecondary, fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    {icon}
    <span style={{ maxWidth: 420, lineHeight: 1.45 }}>{text}</span>
  </div>
);

export const SmallButton: React.FC<{
  ctx: TeamUiCtx;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}> = ({ ctx, onClick, children, primary, danger, disabled, title }) => {
  const bg = primary
    ? ctx.accentColor
    : danger
    ? 'rgba(239, 68, 68, 0.16)'
    : (ctx.isEffectiveDark ? '#1c1c1c' : ctx.theme.controlBg);
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 28,
        padding: '0 10px',
        borderRadius: 6,
        border: 'none',
        background: bg,
        color: primary ? ctx.accentContrastText : danger ? '#ef4444' : ctx.theme.textPrimary,
        fontSize: 11.5,
        fontWeight: 400,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !primary && !danger) {
          e.currentTarget.style.background = ctx.isEffectiveDark ? '#242424' : ctx.theme.controlHoverBg;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !primary && !danger) {
          e.currentTarget.style.background = bg;
        }
      }}
    >
      {children}
    </button>
  );
};

export const selectStyle = (ctx: TeamUiCtx): React.CSSProperties => ({
  background: ctx.theme.modalInputBg || (ctx.isEffectiveDark ? '#1c1c1c' : ctx.theme.controlBg),
  color: ctx.theme.textPrimary,
  border: 'none',
  borderRadius: 6,
  height: 28,
  padding: '0 8px',
  fontSize: 12,
  fontWeight: 400,
  fontFamily: 'inherit',
  outline: 'none',
  minWidth: 0,
  boxShadow: 'none',
});

export const inputStyle = (ctx: TeamUiCtx): React.CSSProperties => ({
  ...selectStyle(ctx),
  width: '100%',
  boxSizing: 'border-box',
});

export const rowHover = (ctx: TeamUiCtx) => ({
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = ctx.isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.025)';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = 'transparent';
  },
});
