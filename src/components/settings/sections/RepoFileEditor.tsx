import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Panel, Pill, SmallButton } from '../../team/teamUi';
import { Notice, ghSettings, textareaStyle, type SettingsCtx } from '../settingsUi';

interface Props {
  ctx: SettingsCtx;
  owner: string;
  repo: string;
  path: string;
  title?: React.ReactNode;
  hint?: React.ReactNode;
  template?: string;
  canEdit: boolean;
  showToast: (msg: string) => void;
  onDelete?: (sha: string) => void;
  onSaved?: () => void;
  minHeight?: number;
  right?: React.ReactNode;
}

// Edita um arquivo do repositório via Contents API (cada salvamento vira um commit na branch padrão)
export const RepoFileEditor: React.FC<Props> = ({ ctx, owner, repo, path, title, hint, template, canEdit, showToast, onDelete, onSaved, minHeight = 180, right }) => {
  const { theme, accentColor } = ctx;
  const [file, setFile] = useState<{ sha: string; content: string } | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFile(undefined);
    setError(null);
    ghSettings<{ sha: string; content: string } | null>('getFile', { owner, repo, path })
      .then((f) => {
        if (cancelled) return;
        setFile(f);
        setText(f?.content ?? '');
      })
      .catch((e) => !cancelled && (setError(e.message), setFile(null)));
    return () => {
      cancelled = true;
    };
  }, [owner, repo, path]);

  const dirty = file === null ? text.length > 0 : file !== undefined && text !== file.content;

  const save = async () => {
    setSaving(true);
    try {
      const res = await ghSettings<any>('putFile', {
        owner,
        repo,
        path,
        content: text,
        sha: file?.sha,
        message: `${file ? 'chore: atualiza' : 'chore: cria'} ${path} via DevFlow`,
      });
      setFile({ sha: res?.content?.sha, content: text });
      showToast(`${path} salvo (commit na branch padrão).`);
      onSaved?.();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      ctx={ctx}
      icon={<FileText size={14} color={accentColor} />}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {title || path}
          {file === null && <Pill color={theme.textMuted}>não existe</Pill>}
          {dirty && <Pill color="#f59e0b">não salvo</Pill>}
        </span>
      }
      right={
        <div style={{ display: 'flex', gap: 4 }}>
          {right}
          {file === null && template && !text && canEdit && (
            <SmallButton ctx={ctx} onClick={() => setText(template)}>
              Usar modelo
            </SmallButton>
          )}
          {file && onDelete && canEdit && (
            <SmallButton ctx={ctx} danger onClick={() => onDelete(file.sha)}>
              Excluir
            </SmallButton>
          )}
          {canEdit && (
            <SmallButton ctx={ctx} primary disabled={!dirty || saving} onClick={save}>
              {saving ? 'Salvando…' : file ? 'Salvar' : 'Criar arquivo'}
            </SmallButton>
          )}
        </div>
      }
    >
      {hint && <div style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 1.45 }}>{hint}</div>}
      {error && <Notice ctx={ctx} tone="warning">{error}</Notice>}
      {file === undefined ? (
        <span style={{ fontSize: 11.5, color: theme.textMuted }}>Carregando…</span>
      ) : (
        <textarea value={text} readOnly={!canEdit} onChange={(e) => setText(e.target.value)} spellCheck={false} style={textareaStyle(ctx, minHeight)} placeholder={file === null ? 'Arquivo ainda não existe. Escreva aqui ou use o modelo.' : ''} />
      )}
    </Panel>
  );
};
