import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, KanbanSquare, RefreshCw, Workflow, Zap } from 'lucide-react';
import { Panel, Pill, SmallButton, inputStyle, openUrl, selectStyle } from '../../team/teamUi';
import { formatSprintName, guessStatusFromName, type IssueStatus } from '../projectSettingsStore';
import { Field, NumberInput, Notice, Segmented, WEEKDAYS, ghSettings, type SectionProps } from '../settingsUi';

const STATUS_COLORS: Record<IssueStatus, string> = { 'A Fazer': '#94a3b8', 'Em Progresso': '#f59e0b', Concluído: '#22c55e' };

export const WorkflowSection: React.FC<SectionProps & { onDataConfigChanged?: () => void }> = ({ ctx, owner, settings, update, showToast, onDataConfigChanged }) => {
  const { theme, accentColor } = ctx;
  const wf = settings.workflow;
  const [projects, setProjects] = useState<Array<{ number: number; title: string; closed: boolean; url: string }>>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [fields, setFields] = useState<any[] | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  useEffect(() => {
    ghSettings<any[]>('listOwnerProjects', { owner })
      .then(setProjects)
      .catch((e) => setProjectsError(e.message));
  }, [owner]);

  const loadFields = (number: number) => {
    setFieldsLoading(true);
    setFieldsError(null);
    ghSettings<any>('fetchProjectFields', { owner: wf.linkedProject?.owner || owner, number })
      .then((p) => setFields(p?.fields?.nodes?.filter(Boolean) || []))
      .catch((e) => {
        setFields(null);
        setFieldsError(e.message);
      })
      .finally(() => setFieldsLoading(false));
  };

  useEffect(() => {
    if (wf.linkedProject?.number) loadFields(wf.linkedProject.number);
    else setFields(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf.linkedProject?.number]);

  const singleSelects = (fields || []).filter((f) => Array.isArray(f.options));
  const numberFields = (fields || []).filter((f) => f.dataType === 'NUMBER');
  const iterationFields = (fields || []).filter((f) => f.dataType === 'ITERATION');
  const statusField = singleSelects.find((f) => f.name.toLowerCase() === (wf.statusFieldName || 'status').toLowerCase()) || singleSelects[0];

  const setWf = (patch: Partial<typeof wf>, notify = true) => {
    update((s) => ({ ...s, workflow: { ...s.workflow, ...patch } }));
    if (notify) onDataConfigChanged?.();
  };

  const sprintPreview = useMemo(() => {
    const now = new Date();
    const diff = (settings.sprint.startWeekday - now.getDay() + 7) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const end = new Date(start.getTime() + (settings.sprint.durationDays - 1) * 86400000);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return formatSprintName(settings.sprint.namePattern, 7, iso(start), iso(end));
  }, [settings.sprint]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<KanbanSquare size={14} color={accentColor} />} title="Project V2 vinculado">
        <Field ctx={ctx} label="Project do GitHub" hint="Quando definido, o DevFlow usa só este Project para status, sprints e estimativas — sem adivinhar pelo nome do repositório.">
          <select
            value={wf.linkedProject?.number ?? ''}
            onChange={(e) => {
              const n = e.target.value ? Number(e.target.value) : null;
              const p = projects.find((x) => x.number === n);
              setWf({ linkedProject: n ? { number: n, title: p?.title, owner } : null });
              showToast(n ? `Project "${p?.title}" vinculado. Os dados do projeto serão recarregados.` : 'Detecção automática de Project reativada.');
            }}
            style={{ ...selectStyle(ctx), maxWidth: 280 }}
          >
            <option value="">Detectar automaticamente</option>
            {projects.map((p) => (
              <option key={p.number} value={p.number}>
                #{p.number} {p.title}
                {p.closed ? ' (fechado)' : ''}
              </option>
            ))}
          </select>
          {wf.linkedProject && (
            <SmallButton ctx={ctx} onClick={() => loadFields(wf.linkedProject!.number)} title="Recarregar campos">
              <RefreshCw size={11} />
            </SmallButton>
          )}
          {wf.linkedProject && projects.find((p) => p.number === wf.linkedProject!.number)?.url && (
            <SmallButton ctx={ctx} onClick={() => openUrl(projects.find((p) => p.number === wf.linkedProject!.number)!.url)}>
              Abrir
            </SmallButton>
          )}
        </Field>
        {projectsError && <Notice ctx={ctx} tone="warning">{projectsError}</Notice>}
        {fieldsError && <Notice ctx={ctx} tone="warning">{fieldsError}</Notice>}
        {fieldsLoading && <span style={{ fontSize: 11.5, color: theme.textMuted }}>Carregando campos do Project…</span>}
        {fields && (
          <>
            <Field ctx={ctx} label="Campo de status" hint="Single select que representa a coluna do Kanban.">
              <select value={statusField?.name || ''} onChange={(e) => setWf({ statusFieldName: e.target.value })} style={selectStyle(ctx)}>
                {singleSelects.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field ctx={ctx} label="Campo de estimativa" hint="Número usado como pontos/horas na carga do time.">
              <select value={wf.estimateFieldName || ''} onChange={(e) => setWf({ estimateFieldName: e.target.value || undefined })} style={selectStyle(ctx)}>
                <option value="">Qualquer campo numérico</option>
                {numberFields.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field ctx={ctx} label="Campo de sprint" hint="Iteração usada como sprint.">
              <select value={wf.iterationFieldName || ''} onChange={(e) => setWf({ iterationFieldName: e.target.value || undefined })} style={selectStyle(ctx)}>
                <option value="">Qualquer iteração</option>
                {iterationFields.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </Panel>

      <Panel
        ctx={ctx}
        icon={<Workflow size={14} color={accentColor} />}
        title="Mapeamento de status"
        right={
          Object.keys(wf.statusMapping).length > 0 ? (
            <SmallButton ctx={ctx} onClick={() => setWf({ statusMapping: {} })}>
              Voltar ao automático
            </SmallButton>
          ) : undefined
        }
      >
        <div style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 1.45 }}>
          Diz ao DevFlow o que cada coluna do Project significa. Sem mapeamento, o status é deduzido pelo nome ("progress", "review", "done"…), o que falha com nomes como "Homologação" ou "Aguardando cliente".
        </div>
        {!statusField ? (
          <Notice ctx={ctx}>Vincule um Project acima para listar as colunas.</Notice>
        ) : (
          statusField.options.map((opt: any) => {
            const guess = guessStatusFromName(opt.name);
            const value = wf.statusMapping[opt.name];
            const effective = value || guess;
            return (
              <Field
                key={opt.id}
                ctx={ctx}
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {opt.name}
                    {!value && (guess ? <Pill color={theme.textMuted}>auto: {guess}</Pill> : <Pill color="#f59e0b">não reconhecido</Pill>)}
                  </span>
                }
              >
                <Segmented
                  ctx={ctx}
                  value={effective || ''}
                  options={(['A Fazer', 'Em Progresso', 'Concluído'] as IssueStatus[]).map((s) => ({ id: s, label: s }))}
                  onChange={(v) => setWf({ statusMapping: { ...wf.statusMapping, [opt.name]: v as IssueStatus } })}
                />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: effective ? STATUS_COLORS[effective] : theme.textMuted }} />
              </Field>
            );
          })
        )}
      </Panel>

      <Panel ctx={ctx} icon={<Zap size={14} color={accentColor} />} title="Sprints">
        <Field ctx={ctx} label="Duração padrão" hint="Pré-preenchida ao criar uma sprint.">
          <NumberInput ctx={ctx} value={settings.sprint.durationDays} min={1} max={60} suffix="dias" onChange={(v) => update((s) => ({ ...s, sprint: { ...s.sprint, durationDays: v } }))} />
        </Field>
        <Field ctx={ctx} label="Dia de início" hint="A próxima sprint começa neste dia da semana.">
          <select value={settings.sprint.startWeekday} onChange={(e) => update((s) => ({ ...s, sprint: { ...s.sprint, startWeekday: Number(e.target.value) } }))} style={selectStyle(ctx)}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field ctx={ctx} label="Padrão de nome" hint={<>Use {'{n}'}, {'{inicio}'} e {'{fim}'}. Prévia: <b>{sprintPreview}</b></>}>
          <input value={settings.sprint.namePattern} onChange={(e) => update((s) => ({ ...s, sprint: { ...s.sprint, namePattern: e.target.value } }))} style={{ ...inputStyle(ctx), width: 220 }} />
        </Field>
        <Field ctx={ctx} label="Issues não concluídas ao fechar" hint="Ao encerrar uma sprint pelo DevFlow.">
          <Segmented
            ctx={ctx}
            value={settings.sprint.carryOver}
            options={[
              { id: 'next', label: 'Mover para a próxima' },
              { id: 'keep', label: 'Manter na sprint' },
            ]}
            onChange={(v) => update((s) => ({ ...s, sprint: { ...s.sprint, carryOver: v as any } }))}
          />
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<Gauge size={14} color={accentColor} />} title="Estimativas e capacidade">
        <Field ctx={ctx} label="Unidade">
          <Segmented
            ctx={ctx}
            value={settings.estimates.unit}
            options={[
              { id: 'points', label: 'Pontos' },
              { id: 'hours', label: 'Horas' },
              { id: 'tshirt', label: 'P / M / G' },
            ]}
            onChange={(v) => update((s) => ({ ...s, estimates: { ...s.estimates, unit: v as any } }))}
          />
        </Field>
        <Field ctx={ctx} label="Capacidade por pessoa na sprint" hint="Acima disso a pessoa aparece como sobrecarregada na aba Time. Com P/M/G, conta P=1, M=3, G=5.">
          <NumberInput
            ctx={ctx}
            value={settings.estimates.capacityPerPerson}
            min={1}
            max={500}
            suffix={settings.estimates.unit === 'hours' ? 'h' : 'pts'}
            onChange={(v) => update((s) => ({ ...s, estimates: { ...s.estimates, capacityPerPerson: v } }))}
          />
        </Field>
      </Panel>
    </div>
  );
};
