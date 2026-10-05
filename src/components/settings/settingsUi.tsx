import React from 'react';
import type { TeamUiCtx } from '../team/teamUi';
import type { ProjectSettings } from './projectSettingsStore';

export type { TeamUiCtx as SettingsCtx } from '../team/teamUi';

export interface ConfirmRequest {
  title: string;
  message: string;
  itemDescription?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

export interface SectionProps {
  ctx: TeamUiCtx;
  repoFullName: string;
  owner: string;
  repo: string;
  repoInfo: any | null; // GET /repos/{owner}/{repo}
  isAdmin: boolean;
  reloadRepo: () => Promise<void>;
  settings: ProjectSettings;
  update: (fn: (prev: ProjectSettings) => ProjectSettings) => void;
  showToast: (msg: string) => void;
  confirm: (req: ConfirmRequest) => void;
}

// Chamada às ações de configuração do GitHub (github:settings)
export async function ghSettings<T = any>(action: string, payload: any): Promise<T> {
  const fn = window.electronAPI?.github?.settings;
  if (!fn) throw new Error('API do GitHub indisponível.');
  const res = await fn(action, payload);
  if (!res?.success) throw new Error(res?.error || 'Falha na chamada ao GitHub.');
  return res.data as T;
}

// PATCH no repositório conferindo o que o GitHub realmente aplicou: alguns campos são ignorados
// sem erro (ex.: Wiki em repositório privado no plano gratuito)
export async function patchRepoVerified(owner: string, repo: string, patch: Record<string, any>): Promise<{ ignored: string[] }> {
  const updated = await ghSettings<any>('updateRepo', { owner, repo, patch });
  const ignored = Object.keys(patch).filter((k) => typeof patch[k] === 'boolean' && updated && k in updated && updated[k] !== patch[k]);
  return { ignored };
}

export const REPO_FIELD_LABEL: Record<string, string> = {
  has_wiki: 'Wiki',
  has_issues: 'Issues',
  has_projects: 'Projects',
  has_discussions: 'Discussions',
  allow_squash_merge: 'Squash merge',
  allow_merge_commit: 'Merge commit',
  allow_rebase_merge: 'Rebase merge',
  delete_branch_on_merge: 'Apagar branch após o merge',
  allow_auto_merge: 'Auto-merge',
  allow_update_branch: 'Sugerir atualizar a branch',
};

export const ignoredMessage = (ignored: string[]) =>
  `O GitHub não aplicou: ${ignored.map((k) => REPO_FIELD_LABEL[k] || k).join(', ')}. Provavelmente exige outro plano (ex.: Wiki e auto-merge em repositório privado precisam do GitHub Pro).`;

export const Field: React.FC<{ ctx: TeamUiCtx; label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; wide?: boolean }> = ({ ctx, label, hint, children, wide }) => (
  <div
    style={{
      display: 'flex',
      alignItems: wide ? 'stretch' : 'center',
      flexDirection: wide ? 'column' : 'row',
      justifyContent: 'space-between',
      gap: wide ? 6 : 16,
      padding: '8px 0',
      borderTop: `1px solid ${ctx.theme.tableBorder}`,
    }}
  >
    <div style={{ minWidth: 0, flex: wide ? undefined : 1 }}>
      <div style={{ fontSize: 12.5, color: ctx.theme.textPrimary, fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: ctx.theme.textSecondary, lineHeight: 1.4, marginTop: 1 }}>{hint}</div>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'flex-end' }}>{children}</div>
  </div>
);

export const Toggle: React.FC<{ ctx: TeamUiCtx; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ ctx, checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    style={{
      width: 34,
      height: 19,
      borderRadius: 10,
      border: 'none',
      padding: 2,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      background: checked ? ctx.accentColor : ctx.isEffectiveDark ? '#333' : '#cbd5e1',
      display: 'flex',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      transition: 'background 0.15s ease',
      flexShrink: 0,
    }}
  >
    <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
  </button>
);

export const Segmented: React.FC<{ ctx: TeamUiCtx; value: string; options: Array<{ id: string; label: string }>; onChange: (v: string) => void; disabled?: boolean }> = ({
  ctx,
  value,
  options,
  onChange,
  disabled,
}) => (
  <div style={{ display: 'flex', background: ctx.theme.controlBg, borderRadius: 7, padding: 2, gap: 2 }}>
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        disabled={disabled}
        onClick={() => onChange(o.id)}
        style={{
          border: 'none',
          borderRadius: 5,
          padding: '0 10px',
          height: 24,
          fontSize: 11.5,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: value === o.id ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e2e8f0') : 'transparent',
          color: value === o.id ? ctx.theme.textPrimary : ctx.theme.textSecondary,
          fontWeight: value === o.id ? 500 : 400,
        }}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const NumberInput: React.FC<{ ctx: TeamUiCtx; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; width?: number }> = ({
  ctx,
  value,
  onChange,
  min = 0,
  max = 9999,
  suffix,
  width = 70,
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      style={{
        width,
        height: 28,
        border: 'none',
        borderRadius: 6,
        padding: '0 8px',
        fontSize: 12,
        fontFamily: 'inherit',
        background: ctx.theme.modalInputBg || ctx.theme.controlBg,
        color: ctx.theme.textPrimary,
        outline: 'none',
      }}
    />
    {suffix && <span style={{ fontSize: 11.5, color: ctx.theme.textSecondary }}>{suffix}</span>}
  </span>
);

export const Notice: React.FC<{ ctx: TeamUiCtx; tone?: 'warning' | 'info' | 'danger'; children: React.ReactNode }> = ({ ctx, tone = 'info', children }) => {
  const color = tone === 'warning' ? '#f59e0b' : tone === 'danger' ? '#ef4444' : '#3b82f6';
  return <div style={{ fontSize: 11.5, color, background: `${color}14`, borderRadius: 6, padding: '6px 10px', lineHeight: 1.45 }}>{children}</div>;
};

export const textareaStyle = (ctx: TeamUiCtx, minHeight = 140): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  minHeight,
  resize: 'vertical',
  border: 'none',
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.5,
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  background: ctx.theme.modalInputBg || ctx.theme.controlBg,
  color: ctx.theme.textPrimary,
  outline: 'none',
});

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
