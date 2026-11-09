import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Panel, Pill, SmallButton } from '../../team/teamUi';
import { Notice, ghSettings, textareaStyle, type SettingsCtx } from '../settingsUi';

// Bloco gerenciado pelo Aura Dev dentro de um arquivo: troca o conteúdo entre os marcadores ou acrescenta no fim
export const upsertBlock = (text: string, key: string, content: string): string => {
  const start = `<!-- aura:${key}:start -->`;
  const end = `<!-- aura:${key}:end -->`;
  const block = `${start}\n${content.trim()}\n${end}`;
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i >= 0 && j > i) return text.slice(0, i) + block + text.slice(j + end.length);
  return `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}\n`;
};

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
  block?: { key: string; content: string }; // bloco do Aura Dev que o botão "Atualizar bloco" grava no texto
  presets?: Array<{ label: string; content: string }>; // modelos que substituem o texto
}

// Edita um arquivo do repositório via Contents API (cada salvamento vira um commit na branch padrão)
export const RepoFileEditor: React.FC<Props> = ({ ctx, owner, repo, path, title, hint, template, canEdit, showToast, onDelete, onSaved, minHeight = 180, right, block, presets }) => {
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
        message: `${file ? 'chore: atualiza' : 'chore: cria'} ${path} via Aura Dev`,
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
          {canEdit &&
            presets?.map((p) => (
              <SmallButton key={p.label} ctx={ctx} onClick={() => setText(p.content)}>
                {p.label}
              </SmallButton>
            ))}
          {canEdit && block && (
            <SmallButton ctx={ctx} disabled={text === upsertBlock(text, block.key, block.content)} onClick={() => setText(upsertBlock(text, block.key, block.content))}>
              Atualizar bloco do Aura
            </SmallButton>
          )}
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
