import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ghSettings } from '../settings/settingsUi';
import { logSystemActivity } from '../../utils/brainService';

export interface RepoLabel {
  name: string;
  color: string;
  description: string;
}

interface Props {
  owner: string;
  repo: string;
  labels: RepoLabel[] | null;
  onChanged: () => void;
  onBack: () => void;
  showToast?: (msg: string) => void;
  isDark: boolean;
  accentColor: string;
  accentContrastText: string;
  textPrimary: string;
  textSecondary: string;
  fieldBg: string;
  hoverBg: string;
  divider: string;
}

const PRESETS = ['d73a4a', 'f59e0b', 'eab308', '22c55e', '0ea5e9', '3b82f6', '8b5cf6', 'ec4899', '6b7280'];

const randomColor = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

// Lista e edição de labels do repositório dentro do popup de labels da issue
export const IssueLabelsManager: React.FC<Props> = ({ owner, repo, labels, onChanged, onBack, showToast, isDark, accentColor, accentContrastText, textPrimary, textSecondary, fieldBg, hoverBg, divider }) => {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<RepoLabel>({ name: '', color: randomColor(), description: '' });
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!labels) onChanged();
  }, []);

  const open = (l: RepoLabel | null) => {
    setDraft(l ? { ...l } : { name: '', color: randomColor(), description: '' });
    setEditing(l ? l.name : 'new');
  };

  const save = async () => {
    const color = draft.color.replace('#', '');
    if (!draft.name.trim() || !/^[0-9a-f]{6}$/i.test(color)) {
      showToast?.('Informe um nome e uma cor válida.');
      return;
    }
    setBusy(true);
    try {
      if (editing && editing !== 'new') {
        await ghSettings('updateLabel', { owner, repo, name: editing, patch: { new_name: draft.name.trim(), color, description: draft.description } });
      } else {
        await ghSettings('createLabel', { owner, repo, name: draft.name.trim(), color, description: draft.description });
      }
      logSystemActivity('tarefas', editing === 'new' ? 'criar_label' : 'atualizar_label', `${owner}/${repo}`, { name: draft.name.trim(), color });
      showToast?.(editing === 'new' ? 'Label criada.' : 'Label atualizada.');
      setEditing(null);
      onChanged();
    } catch (e: any) {
      showToast?.(`Falhou: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: RepoLabel) => {
    setBusy(true);
    try {
      await ghSettings('deleteLabel', { owner, repo, name: l.name });
      logSystemActivity('tarefas', 'excluir_label', `${owner}/${repo}`, { name: l.name });
      showToast?.('Label excluída.');
      onChanged();
    } catch (e: any) {
      showToast?.(`Falhou: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const iconBtn: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 6, color: textSecondary, cursor: 'pointer', transition: 'background-color 150ms ease, color 150ms ease' };
  const btn: React.CSSProperties = { height: 30, padding: '0 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease, background-color 150ms ease' };
  const field: React.CSSProperties = { height: 30, background: fieldBg, border: 'none', outline: 'none', borderRadius: 6, padding: '0 8px', fontSize: 12, fontWeight: 400, color: textPrimary, fontFamily: 'inherit', minWidth: 0 };
  const hexOf = (c: string) => `#${c.replace('#', '')}`;

  return (
    <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <button type="button" title="Voltar" onClick={onBack} style={iconBtn}>
          <ArrowLeft size={14} />
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: textPrimary }}>Edit labels{labels ? ` (${labels.length})` : ''}</span>
        <button
          type="button"
          onClick={() => open(null)}
          style={{ height: 28, display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', background: accentColor, color: accentContrastText, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 400, cursor: 'pointer' }}
        >
          <Plus size={12} /> New label
        </button>
      </div>
      <div style={{ borderBottom: `1px solid ${divider}` }} />

      {editing && (
        <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderBottom: `1px solid ${divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label title="Escolher cor" style={{ position: 'relative', width: 30, height: 30, flexShrink: 0, borderRadius: 6, background: hexOf(draft.color), cursor: 'pointer', transition: 'background-color 150ms ease' }}>
              <input type="color" value={hexOf(draft.color)} onChange={(e) => setDraft({ ...draft, color: e.target.value.slice(1) })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </label>
            <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Label name" style={{ ...field, flex: 1 }} />
          </div>
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Description (optional)" style={field} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={`#${c}`}
                onClick={() => setDraft({ ...draft, color: c })}
                style={{ width: 18, height: 18, borderRadius: '50%', background: `#${c}`, border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, opacity: draft.color.replace('#', '').toLowerCase() === c ? 1 : 0.55, transform: draft.color.replace('#', '').toLowerCase() === c ? 'scale(1.15)' : 'scale(1)', transition: 'opacity 150ms ease, transform 150ms var(--ease-out)' }}
              />
            ))}
            <button type="button" title="Cor aleatória" onClick={() => setDraft({ ...draft, color: randomColor() })} style={iconBtn}>
              <RefreshCw size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={() => setEditing(null)} style={{ ...btn, background: fieldBg, color: textSecondary }}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={save} style={{ ...btn, background: accentColor, color: accentContrastText, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {editing === 'new' ? 'Create label' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxHeight: 250, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {labels === null ? (
          <div style={{ padding: 14, fontSize: 12, color: textSecondary, textAlign: 'center' }}>Carregando labels…</div>
        ) : labels.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: textSecondary, textAlign: 'center' }}>Nenhuma label no repositório.</div>
        ) : (
          labels.map((l) => (
            <div
              key={l.name}
              onMouseEnter={() => setHovered(l.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: hovered === l.name ? hoverBg : 'transparent', transition: 'background-color 120ms ease' }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: hexOf(l.color), flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 400, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                {l.description && <span style={{ fontSize: 11.5, color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</span>}
              </div>
              <button type="button" title="Editar" onClick={() => open(l)} style={iconBtn}>
                <Pencil size={12} />
              </button>
              <button type="button" title="Excluir" disabled={busy} onClick={() => remove(l)} style={iconBtn}>
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
