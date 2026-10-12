import React, { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Link2, PlayCircle, RefreshCw, Webhook } from 'lucide-react';
import { EmptyState, Panel, Pill, SmallButton, inputStyle, openUrl } from '../../team/teamUi';
import { relativeTime } from '../../team/teamTypes';
import { Field, Notice, ghSettings, type SectionProps } from '../settingsUi';
import { logSystemActivity } from '../../../utils/brainService';

export interface CustomLink {
  id: string;
  label: string;
  url: string;
  category?: string;
  [k: string]: any;
}

const DEFAULT_LINKS = [
  { slot: 'figma', label: 'Figma', placeholder: 'https://figma.com/file/…', category: 'design' },
  { slot: 'staging', label: 'Staging', placeholder: 'https://staging.…', category: 'ambiente' },
  { slot: 'producao', label: 'Produção', placeholder: 'https://…', category: 'ambiente' },
  { slot: 'sentry', label: 'Sentry', placeholder: 'https://sentry.io/organizations/…', category: 'monitoramento' },
  { slot: 'docs', label: 'Documentação', placeholder: 'https://notion.so/…', category: 'docs' },
];

const RUN_COLOR: Record<string, string> = { success: '#22c55e', failure: '#ef4444', cancelled: '#a3a3a3', skipped: '#a3a3a3', timed_out: '#ef4444', action_required: '#f59e0b' };

export const IntegrationsSection: React.FC<SectionProps & { customLinks: CustomLink[]; onSaveCustomLinks: (links: CustomLink[]) => void }> = ({
  ctx,
  owner,
  repo,
  isAdmin,
  showToast,
  customLinks,
  onSaveCustomLinks,
}) => {
  const { theme, accentColor } = ctx;
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<any[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<any[] | null>(null);
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [hooksError, setHooksError] = useState<string | null>(null);

  const bySlot = (slot: string) => customLinks.find((l) => l.defaultSlot === slot);

  useEffect(() => {
    const d: Record<string, string> = {};
    DEFAULT_LINKS.forEach((s) => (d[s.slot] = bySlot(s.slot)?.url || ''));
    setLinkDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLinks]);

  const loadRuns = () =>
    ghSettings<any[]>('listWorkflowRuns', { owner, repo, perPage: 15 })
      .then((r) => (setRuns(r), setRunsError(null)))
      .catch((e) => (setRuns([]), setRunsError(e.message)));

  useEffect(() => {
    loadRuns();
    ghSettings<any[]>('listSecrets', { owner, repo }).then(setSecrets).catch(() => setSecrets(null));
    ghSettings<any[]>('listHooks', { owner, repo })
      .then(setHooks)
      .catch((e) => (setHooks([]), setHooksError(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  const saveLinks = () => {
    let next = [...customLinks];
    DEFAULT_LINKS.forEach((s) => {
      const url = (linkDraft[s.slot] || '').trim();
      const existing = next.find((l) => l.defaultSlot === s.slot);
      if (!url && existing) next = next.filter((l) => l !== existing);
      else if (url && existing) next = next.map((l) => (l === existing ? { ...l, url } : l));
      else if (url) next.push({ id: `${Date.now()}_${s.slot}`, label: s.label, url, category: s.category, defaultSlot: s.slot });
    });
    logSystemActivity('configuracoes_projeto', 'salvar_links', `${owner}/${repo}`, { count: next.length });
    onSaveCustomLinks(next);
    showToast('Links salvos — aparecem na aba Links.');
  };

  const linksDirty = DEFAULT_LINKS.some((s) => (linkDraft[s.slot] || '').trim() !== (bySlot(s.slot)?.url || ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<Link2 size={14} color={accentColor} />} title="Links do projeto" right={linksDirty ? <SmallButton ctx={ctx} primary onClick={saveLinks}>Salvar links</SmallButton> : undefined}>
        {DEFAULT_LINKS.map((s) => (
          <Field key={s.slot} ctx={ctx} label={s.label}>
            <input value={linkDraft[s.slot] || ''} onChange={(e) => setLinkDraft({ ...linkDraft, [s.slot]: e.target.value })} placeholder={s.placeholder} style={{ ...inputStyle(ctx), width: 220 }} />
            <SmallButton ctx={ctx} disabled={!linkDraft[s.slot]} onClick={() => openUrl(linkDraft[s.slot])}>
              <ExternalLink size={11} />
            </SmallButton>
          </Field>
        ))}
      </Panel>

      <Panel ctx={ctx} icon={<KeyRound size={14} color={accentColor} />} title="Secrets do Actions" right={<SmallButton ctx={ctx} onClick={() => openUrl(`https://github.com/${owner}/${repo}/settings/secrets/actions`)}>Gerenciar</SmallButton>}>
            {secrets === null ? (
              <span style={{ fontSize: 11.5, color: theme.textMuted }}>{isAdmin ? 'Carregando…' : 'Somente admins podem listar os secrets.'}</span>
            ) : secrets.length === 0 ? (
              <EmptyState ctx={ctx} text="Nenhum secret configurado." />
            ) : (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {secrets.map((s) => (
                  <Pill key={s.name} color={theme.textSecondary} title={`Atualizado ${relativeTime(s.updatedAt)}`}>
                    {s.name}
                  </Pill>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: theme.textMuted }}>O GitHub nunca expõe os valores — só os nomes.</div>
          </Panel>

          <Panel ctx={ctx} icon={<Webhook size={14} color={accentColor} />} title="Webhooks" right={<SmallButton ctx={ctx} onClick={() => openUrl(`https://github.com/${owner}/${repo}/settings/hooks`)}>Gerenciar</SmallButton>}>
            {hooksError && <Notice ctx={ctx} tone="warning">{hooksError}</Notice>}
            {hooks && hooks.length === 0 && !hooksError && <EmptyState ctx={ctx} text="Nenhum webhook configurado." />}
            {hooks?.map((h) => {
              const code = h.lastResponse?.code;
              const ok = code && code >= 200 && code < 300;
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${theme.tableBorder}`, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: !h.active ? theme.textMuted : ok ? '#22c55e' : code ? '#ef4444' : '#a3a3a3', flexShrink: 0 }} />
                  <code style={{ flex: 1, minWidth: 0, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>{h.url}</code>
                  <span style={{ fontSize: 10.5, color: theme.textMuted }}>{(h.events || []).slice(0, 3).join(', ')}{h.events?.length > 3 ? '…' : ''}</span>
                  {code && <Pill color={ok ? '#22c55e' : '#ef4444'}>{code}</Pill>}
                  <SmallButton
                    ctx={ctx}
                    onClick={async () => {
                      try {
                        await ghSettings('pingHook', { owner, repo, hookId: h.id });
                        logSystemActivity('configuracoes_projeto', 'ping_webhook', `${owner}/${repo}`, { hookId: h.id });
                        showToast('Ping enviado.');
                      } catch (e: any) {
                        showToast(`Falhou: ${e.message}`);
                      }
                    }}
                  >
                    Testar
                  </SmallButton>
                </div>
              );
            })}
          </Panel>

      <Panel
        ctx={ctx}
        icon={<PlayCircle size={14} color={accentColor} />}
        title="GitHub Actions"
        right={
          <div style={{ display: 'flex', gap: 4 }}>
            <SmallButton ctx={ctx} onClick={loadRuns}>
              <RefreshCw size={11} />
            </SmallButton>
            <SmallButton ctx={ctx} onClick={() => openUrl(`https://github.com/${owner}/${repo}/actions`)}>
              <ExternalLink size={11} /> Abrir
            </SmallButton>
          </div>
        }
      >
        {runsError && <Notice ctx={ctx} tone="warning">{runsError}</Notice>}
        {runs === null ? (
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>Carregando…</span>
        ) : runs.length === 0 ? (
          <EmptyState ctx={ctx} text="Nenhum workflow executado. Crie um em .github/workflows para ter CI." />
        ) : (
          runs.map((r) => {
            const state = r.status !== 'completed' ? r.status : r.conclusion;
            const color = r.status !== 'completed' ? '#3b82f6' : RUN_COLOR[r.conclusion] || theme.textSecondary;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${theme.tableBorder}`, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span onClick={() => openUrl(r.url)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 400 }}>{r.name}</span> <span style={{ color: theme.textSecondary }}>{r.title}</span>
                </span>
                <Pill color={theme.textSecondary}>{r.branch}</Pill>
                <Pill color={color}>{state}</Pill>
                <span style={{ fontSize: 10.5, color: theme.textMuted, width: 56, textAlign: 'right' }}>{relativeTime(r.createdAt)}</span>
                {r.status === 'completed' && r.conclusion !== 'success' && (
                  <SmallButton
                    ctx={ctx}
                    onClick={async () => {
                      try {
                        await ghSettings('rerunWorkflow', { owner, repo, runId: r.id });
                        showToast('Workflow reexecutado.');
                        setTimeout(loadRuns, 2000);
                      } catch (e: any) {
                        showToast(`Falhou: ${e.message}`);
                      }
                    }}
                  >
                    Reexecutar
                  </SmallButton>
                )}
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
};
