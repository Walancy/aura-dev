import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Tags, Trash2, Wand2 } from 'lucide-react';
import { EmptyState, Panel, Pill, SmallButton, inputStyle } from '../../team/teamUi';
import { Notice, ghSettings, type SectionProps } from '../settingsUi';
import { logSystemActivity } from '../../../utils/brainService';

interface Label {
  name: string;
  color: string;
  description: string;
}

// Labels que o DevFlow lê para prioridade, tag e status (ver mapGithubIssueToProjectIssue)
const DEVFLOW_LABELS: Array<Label & { group: string }> = [
  { group: 'Prioridade', name: 'priority: baixa', color: '22c55e', description: 'Prioridade baixa' },
  { group: 'Prioridade', name: 'priority: média', color: 'f59e0b', description: 'Prioridade média' },
  { group: 'Prioridade', name: 'priority: alta', color: 'ef4444', description: 'Prioridade alta' },
  { group: 'Prioridade', name: 'priority: urgente', color: 'dc2626', description: 'Prioridade urgente' },
  { group: 'Status', name: 'em-progresso', color: '0ea5e9', description: 'Em desenvolvimento' },
  { group: 'Tag', name: 'Backend', color: 'a855f7', description: '' },
  { group: 'Tag', name: 'Frontend', color: '3b82f6', description: '' },
  { group: 'Tag', name: 'Design', color: 'ec4899', description: '' },
  { group: 'Tag', name: 'DevOps', color: 'ea580c', description: '' },
  { group: 'Tag', name: 'QA', color: '10b981', description: '' },
  { group: 'Tag', name: 'Research', color: '3b82f6', description: '' },
  { group: 'Tag', name: 'Release', color: 'f59e0b', description: '' },
  { group: 'Tag', name: 'bug', color: 'd73a4a', description: 'Algo não está funcionando' },
];

const categoryOf = (name: string) => {
  const l = name.toLowerCase();
  if (l.startsWith('priority:')) return 'Prioridade';
  if (/progress|andamento/.test(l)) return 'Status';
  if (l.startsWith('sprint')) return 'Sprint';
  return 'Tag';
};

const randomColor = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

export const LabelsSection: React.FC<SectionProps> = ({ ctx, owner, repo, isAdmin, showToast, confirm }) => {
  const { theme, accentColor } = ctx;
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Label>({ name: '', color: randomColor(), description: '' });
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    ghSettings<Label[]>('listLabels', { owner, repo })
      .then(setLabels)
      .catch((e) => setError(e.message));
  };
  useEffect(load, [owner, repo]);

  const missing = useMemo(() => (labels ? DEVFLOW_LABELS.filter((d) => !labels.some((l) => l.name.toLowerCase() === d.name.toLowerCase())) : []), [labels]);
  const filtered = (labels || []).filter((l) => !query || l.name.toLowerCase().includes(query.toLowerCase()) || l.description.toLowerCase().includes(query.toLowerCase()));
  const grouped = filtered.reduce<Record<string, Label[]>>((acc, l) => {
    (acc[categoryOf(l.name)] ||= []).push(l);
    return acc;
  }, {});

  const save = async (original: string | null) => {
    const color = draft.color.replace('#', '');
    if (!draft.name.trim() || !/^[0-9a-f]{6}$/i.test(color)) {
      showToast('Informe um nome e uma cor hexadecimal válida.');
      return;
    }
    setBusy(true);
    try {
      if (original) await ghSettings('updateLabel', { owner, repo, name: original, patch: { new_name: draft.name.trim(), color, description: draft.description } });
      else await ghSettings('createLabel', { owner, repo, name: draft.name.trim(), color, description: draft.description });
      logSystemActivity('configuracoes_projeto', original ? 'atualizar_label' : 'criar_label', `${owner}/${repo}`, { name: draft.name.trim(), color });
      showToast(original ? 'Label atualizada.' : 'Label criada.');
      setEditing(null);
      setCreating(false);
      setDraft({ name: '', color: randomColor(), description: '' });
      load();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const createMissing = async () => {
    setBusy(true);
    let ok = 0;
    for (const l of missing) {
      try {
        await ghSettings('createLabel', { owner, repo, name: l.name, color: l.color, description: l.description });
        ok++;
      } catch {}
    }
    logSystemActivity('configuracoes_projeto', 'criar_labels_padrao', `${owner}/${repo}`, { count: ok });
    showToast(`${ok} label(s) padrão criadas.`);
    setBusy(false);
    load();
  };

  const editor = (original: string | null) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0', flexWrap: 'wrap' }}>
      <input type="color" value={`#${draft.color.replace('#', '')}`} onChange={(e) => setDraft({ ...draft, color: e.target.value.slice(1) })} style={{ width: 30, height: 28, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} />
      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="nome" style={{ ...inputStyle(ctx), width: 180 }} autoFocus />
      <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="descrição (opcional)" style={{ ...inputStyle(ctx), flex: 1, width: 'auto', minWidth: 160 }} />
      <SmallButton ctx={ctx} onClick={() => setDraft({ ...draft, color: randomColor() })} title="Cor aleatória">
        <RefreshCw size={11} />
      </SmallButton>
      <SmallButton ctx={ctx} onClick={() => { setEditing(null); setCreating(false); }}>
        Cancelar
      </SmallButton>
      <SmallButton ctx={ctx} primary disabled={busy} onClick={() => save(original)}>
        Salvar
      </SmallButton>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {missing.length > 0 && isAdmin && (
        <Panel ctx={ctx} icon={<Wand2 size={14} color={accentColor} />} title="Labels do Aura Dev" right={<SmallButton ctx={ctx} primary disabled={busy} onClick={createMissing}>Criar {missing.length} faltando</SmallButton>}>
          <div style={{ fontSize: 11.5, color: theme.textSecondary }}>O Aura Dev usa estas labels para prioridade, tag e status das tarefas:</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {missing.map((l) => (
              <Pill key={l.name} color={`#${l.color}`}>
                {l.name}
              </Pill>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        ctx={ctx}
        icon={<Tags size={14} color={accentColor} />}
        title={`Labels (${labels?.length ?? '…'})`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 6, padding: '0 8px', height: 26 }}>
              <Search size={12} color={theme.textSecondary} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" style={{ ...inputStyle(ctx), background: 'transparent', padding: 0, width: 120, height: 24 }} />
            </div>
            {isAdmin && (
              <SmallButton ctx={ctx} primary onClick={() => { setCreating(true); setEditing(null); setDraft({ name: '', color: randomColor(), description: '' }); }}>
                <Plus size={11} /> Nova label
              </SmallButton>
            )}
          </div>
        }
      >
        {error && <Notice ctx={ctx} tone="warning">{error}</Notice>}
        {creating && editor(null)}
        {labels && labels.length === 0 && <EmptyState ctx={ctx} text="Nenhuma label neste repositório." />}
        {Object.entries(grouped).map(([group, list]) => (
          <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 400, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0 2px' }}>{group}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {list.map((l) =>
                editing === l.name ? (
                  <React.Fragment key={l.name}>
                    {editor(l.name)}
                  </React.Fragment>
                ) : (
                  <div
                    key={l.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'all 0.15s ease',
                      minWidth: 0,
                    }}
                  >
                    <Pill color={`#${l.color}`} solid>
                      {l.name}
                    </Pill>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.description}
                    </span>
                    <code style={{ fontSize: 10, color: theme.textMuted, flexShrink: 0 }}>#{l.color}</code>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <SmallButton ctx={ctx} onClick={() => { setEditing(l.name); setCreating(false); setDraft({ ...l }); }}>
                          Editar
                        </SmallButton>
                        <SmallButton
                          ctx={ctx}
                          danger
                          onClick={() =>
                            confirm({
                              title: 'Excluir label',
                              message: `Excluir a label "${l.name}"?`,
                              itemDescription: 'Ela será removida de todas as issues e PRs.',
                              confirmLabel: 'Excluir',
                              onConfirm: async () => {
                                try {
                                  await ghSettings('deleteLabel', { owner, repo, name: l.name });
                                  logSystemActivity('configuracoes_projeto', 'excluir_label', `${owner}/${repo}`, { name: l.name });
                                  showToast('Label excluída.');
                                  load();
                                } catch (e: any) {
                                  showToast(`Falhou: ${e.message}`);
                                }
                              },
                            })
                          }
                        >
                          <Trash2 size={11} />
                        </SmallButton>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
};
