import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Lightbulb, Loader2, Sparkles, UserPlus } from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import { formatHours, relativeTime, type AssignmentSuggestion, type DailySnapshot, type MemberStats, type RepoTeamLocalData, type TeamAlert, type TeamInsightsRaw, type TeamMetrics } from './teamTypes';
import { Avatar, EmptyState, Panel, Pill, SEVERITY_COLOR, SmallButton, openUrl, rowHover, selectStyle, type TeamUiCtx } from './teamUi';

export interface TeamAiProvider {
  id: string;
  name: string;
  cliCommand?: string;
  model?: string;
  cwd?: string;
  contextNotes?: string;
}

// Mesmo fluxo das outras telas: CLI configurado → retry sem modelo → ai.prompt direto
async function callAi(provider: TeamAiProvider, rawPrompt: string): Promise<string> {
  const api = window.electronAPI?.ai;
  const prompt = provider.contextNotes?.trim() ? `Contexto do projeto:\n${provider.contextNotes.trim()}\n\n${rawPrompt}` : rawPrompt;
  const isBad = (res: any) => {
    const out = res?.stdout?.trim() || '';
    return !out || res?.exitCode !== 0 || out.includes("There's an issue with the selected model") || out.includes('[claude-code:unrecognized_model]') || out.startsWith('Error:');
  };
  if (api?.runCli && provider.cliCommand) {
    for (const model of [provider.model, undefined]) {
      try {
        const res = await api.runCli({ cliCmd: provider.cliCommand, prompt, model, cwd: provider.cwd });
        if (!isBad(res)) return res.stdout.trim();
      } catch {}
      if (!provider.model) break;
    }
  }
  if (api?.prompt) {
    const res = await api.prompt(prompt, provider.id, provider.cwd);
    if (res?.response?.trim()) return res.response.trim();
  }
  throw new Error('Nenhum provedor de IA respondeu.');
}

const renderMarkdownLite = (text: string, color: string, muted: string) =>
  text.split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: 6 }} />;
    const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    const content = (heading?.[1] || bullet?.[1] || trimmed).split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} style={{ color, fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
    if (heading) return <div key={idx} style={{ fontSize: 12.5, fontWeight: 600, color, marginTop: 4 }}>{content}</div>;
    if (bullet)
      return (
        <div key={idx} style={{ display: 'flex', gap: 6, paddingLeft: 4 }}>
          <span style={{ color: muted }}>•</span>
          <span>{content}</span>
        </div>
      );
    return <div key={idx}>{content}</div>;
  });

interface Props {
  ctx: TeamUiCtx;
  repoFullName: string;
  raw: TeamInsightsRaw;
  members: MemberStats[];
  issues: ProjectIssue[];
  metrics: TeamMetrics;
  alerts: TeamAlert[];
  daily: Record<string, DailySnapshot>;
  suggestions: AssignmentSuggestion[];
  repoData: RepoTeamLocalData;
  provider: TeamAiProvider;
  canAssign: boolean;
  suggestionsEnabled?: boolean;
  autoWeekly?: { weekday: number };
  pendingAction: string | null;
  onSaveSummary: (summary: RepoTeamLocalData['aiSummary']) => void;
  onAssign: (issueNumber: number, login: string) => void;
  onOpenMember: (login: string) => void;
  showToast: (msg: string) => void;
}

export const TeamAiPanel: React.FC<Props> = ({ ctx, repoFullName, raw, members, issues, metrics, alerts, daily, suggestions, repoData, provider, canAssign, suggestionsEnabled = true, autoWeekly, pendingAction, onSaveSummary, onAssign, onOpenMember, showToast }) => {
  const { theme, accentColor } = ctx;
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [aiPicks, setAiPicks] = useState<Record<number, { login: string; reason: string }>>({});
  const [severity, setSeverity] = useState<'all' | TeamAlert['severity']>('all');

  const weekAgo = Date.now() - 7 * 86400000;
  const weekData = useMemo(() => {
    const closed = issues.filter((i) => i.closedAtIso && new Date(i.closedAtIso).getTime() > weekAgo);
    const merged = raw.closedPulls.filter((p) => p.mergedAt && new Date(p.mergedAt).getTime() > weekAgo);
    const opened = issues.filter((i) => new Date(i.createdAtIso).getTime() > weekAgo);
    return { closed, merged, opened };
  }, [issues, raw.closedPulls, weekAgo]);

  const buildSummaryPrompt = () => {
    const memberLines = members
      .map(
        (m) =>
          `- @${m.login} (${m.role}${m.teams.length ? `, times: ${m.teams.join('/')}` : ''}): ${m.openAssigned.length} issues abertas (${m.inProgress} em progresso), ${m.openPulls.length} PRs abertos, ${m.reviewQueue.length} reviews pendentes, ${m.closedLast14d} fechadas em 14d, carga=${m.loadLevel}, última atividade ${relativeTime(m.lastActivityAt)}`,
      )
      .join('\n');
    const blockers = Object.entries(daily)
      .flatMap(([login, d]) => d.blockers.map((b) => `- @${login}: ${b.title}`))
      .join('\n');
    return `Você é um líder técnico. Escreva um RESUMO SEMANAL do time do repositório ${repoFullName} em português do Brasil, em Markdown curto (máx. 250 palavras), com as seções:
## Entregas
## Em andamento
## Riscos e bloqueios
## Quem precisa de ajuda
## Recomendações (3 ações concretas)

Use somente os dados abaixo; não invente nomes nem números.

ÚLTIMOS 7 DIAS
Issues fechadas (${weekData.closed.length}):
${weekData.closed.slice(0, 25).map((i) => `- ${i.id} ${i.title} [${i.assignees.map((a) => '@' + a.name).join(', ') || 'sem responsável'}]`).join('\n') || '- nenhuma'}
PRs mergeados (${weekData.merged.length}):
${weekData.merged.slice(0, 20).map((p) => `- #${p.number} ${p.title} (@${p.author})`).join('\n') || '- nenhum'}
Issues novas: ${weekData.opened.length}
Lead time médio de PR: ${formatHours(metrics.leadTimeHours)}
Throughput semanal (8 semanas, mais antiga primeiro): ${metrics.weeklyThroughput.join(', ')}

MEMBROS
${memberLines || '- sem membros'}

PRs ABERTOS (${raw.openPulls.length}):
${raw.openPulls.slice(0, 15).map((p) => `- #${p.number} ${p.title} (@${p.author}, aberto ${relativeTime(p.createdAt)}, reviews: ${p.reviews.length}, aguardando: ${p.requestedReviewers.join(', ') || 'ninguém'})`).join('\n') || '- nenhum'}

BLOQUEIOS DA DAILY:
${blockers || '- nenhum'}

ALERTAS AUTOMÁTICOS:
${alerts.slice(0, 12).map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`).join('\n') || '- nenhum'}`;
  };

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const text = await callAi(provider, buildSummaryPrompt());
      onSaveSummary({ text, generatedAt: new Date().toISOString(), provider: provider.name });
      showToast('Resumo semanal gerado.');
    } catch (e: any) {
      showToast(`Não foi possível gerar o resumo: ${e?.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  const refineWithAi = async () => {
    if (suggestions.length === 0) return;
    setRefining(true);
    try {
      const prompt = `Distribua as issues abaixo entre os membros do time considerando experiência (issues parecidas), habilidades, carga atual e disponibilidade.
Responda APENAS com JSON válido no formato [{"issue": 123, "login": "usuario", "reason": "motivo curto em português"}], sem texto extra.

MEMBROS:
${members
  .filter((m) => m.role !== 'read')
  .map((m) => `- ${m.login}: carga=${m.loadLevel} (${m.openAssigned.length} issues, ${m.openPulls.length} PRs), experiência: ${Object.entries(m.tags).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t}(${n})`).join(', ') || 'sem histórico'}`)
  .join('\n')}

ISSUES SEM RESPONSÁVEL:
${suggestions.map((s) => `- #${s.issue.githubNumber} [${s.issue.priority}] ${s.issue.title} (labels: ${(s.issue.rawLabels || []).join(', ') || s.issue.tag})`).join('\n')}`;
      const out = await callAi(provider, prompt);
      const json = out.match(/\[[\s\S]*\]/)?.[0];
      const parsed: Array<{ issue: number; login: string; reason: string }> = json ? JSON.parse(json) : [];
      const valid = new Set(members.map((m) => m.login.toLowerCase()));
      const picks: Record<number, { login: string; reason: string }> = {};
      parsed.forEach((p) => {
        const member = members.find((m) => m.login.toLowerCase() === String(p.login).toLowerCase());
        if (member && valid.has(member.login.toLowerCase()) && p.issue) picks[Number(p.issue)] = { login: member.login, reason: p.reason };
      });
      setAiPicks(picks);
      showToast(`IA sugeriu responsáveis para ${Object.keys(picks).length} issue(s).`);
    } catch (e: any) {
      showToast(`Falha ao refinar com IA: ${e?.message || e}`);
    } finally {
      setRefining(false);
    }
  };

  // Resumo semanal automático (Configurações → IA): gera no dia escolhido se o último tiver 6+ dias
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoWeekly || autoRan.current || generating) return;
    if (new Date().getDay() !== autoWeekly.weekday) return;
    const last = repoData.aiSummary?.generatedAt ? new Date(repoData.aiSummary.generatedAt).getTime() : 0;
    if (Date.now() - last < 6 * 86400000) return;
    autoRan.current = true;
    generateSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWeekly?.weekday, repoData.aiSummary?.generatedAt]);

  const memberByLogin = new Map(members.map((m) => [m.login.toLowerCase(), m]));
  const visibleAlerts = alerts.filter((a) => severity === 'all' || a.severity === severity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {/* Resumo semanal */}
      <Panel
        ctx={ctx}
        icon={<Sparkles size={14} color={accentColor} />}
        title="Resumo semanal do time"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {repoData.aiSummary && (
              <span style={{ fontSize: 11, color: theme.textMuted }}>
                {repoData.aiSummary.provider ? `${repoData.aiSummary.provider} • ` : ''}
                {relativeTime(repoData.aiSummary.generatedAt)}
              </span>
            )}
            <SmallButton ctx={ctx} primary onClick={generateSummary} disabled={generating}>
              {generating ? <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
              {generating ? 'Gerando…' : repoData.aiSummary ? 'Gerar novamente' : `Gerar com ${provider.name}`}
            </SmallButton>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill color="#22c55e">{weekData.closed.length} issues fechadas</Pill>
          <Pill color="#3b82f6">{weekData.merged.length} PRs mergeados</Pill>
          <Pill color={theme.textSecondary}>{weekData.opened.length} issues novas</Pill>
          <Pill color="#f59e0b">{alerts.length} alertas</Pill>
        </div>
        {repoData.aiSummary ? (
          <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderMarkdownLite(repoData.aiSummary.text, theme.textPrimary, theme.textMuted)}
          </div>
        ) : (
          <EmptyState ctx={ctx} text="Gere um resumo com entregas, riscos, quem está travado e recomendações — baseado nos dados reais dos últimos 7 dias." />
        )}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 5 }}>
        {/* Sugestão de atribuição */}
        <Panel
          ctx={ctx}
          icon={<Lightbulb size={14} color={accentColor} />}
          title={`Sugestões de atribuição (${suggestions.length})`}
          right={
            suggestions.length > 0 ? (
              <SmallButton ctx={ctx} onClick={refineWithAi} disabled={refining}>
                {refining ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                {refining ? 'Analisando…' : 'Refinar com IA'}
              </SmallButton>
            ) : undefined
          }
        >
          {suggestions.length === 0 ? (
            <EmptyState ctx={ctx} text={suggestionsEnabled ? 'Todas as issues abertas já têm responsável.' : 'Sugestões de responsável desativadas em Configurações → IA.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {suggestions.map(({ issue, candidates }, idx) => {
                const ai = issue.githubNumber ? aiPicks[issue.githubNumber] : undefined;
                const list = ai ? [{ login: ai.login, score: 999, reasons: [ai.reason] }, ...candidates.filter((c) => c.login.toLowerCase() !== ai.login.toLowerCase())].slice(0, 3) : candidates;
                return (
                  <div key={issue.id} style={{ padding: '7px 0', borderTop: idx === 0 ? 'none' : `1px solid ${theme.tableBorder}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div onClick={() => openUrl(issue.htmlUrl)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: issue.priorityColor, flexShrink: 0 }} />
                      <span style={{ color: theme.textMuted }}>{issue.id}</span>
                      <span style={{ color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{issue.title}</span>
                      <Pill color={issue.priorityColor}>{issue.priority}</Pill>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {list.map((c, i) => {
                        const isAi = ai && i === 0;
                        const m = memberByLogin.get(c.login.toLowerCase());
                        return (
                          <div
                            key={c.login}
                            title={c.reasons.join(' • ')}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: theme.controlBg, borderRadius: 6, padding: '3px 4px 3px 6px', boxShadow: isAi ? `0 0 0 1px ${accentColor}` : undefined, maxWidth: '100%' }}
                          >
                            <span onClick={() => onOpenMember(c.login)} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', minWidth: 0 }}>
                              <Avatar ctx={ctx} login={c.login} url={m?.avatarUrl} size={16} />
                              <span style={{ fontSize: 11.5, color: theme.textPrimary }}>{c.login}</span>
                              {isAi && <Sparkles size={10} color={accentColor} />}
                              <span style={{ fontSize: 10.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{c.reasons[0] || 'disponível'}</span>
                            </span>
                            {canAssign && issue.githubNumber && (
                              <button
                                type="button"
                                title={`Atribuir a @${c.login}`}
                                disabled={pendingAction === `assign-${issue.githubNumber}`}
                                onClick={() => onAssign(issue.githubNumber!, c.login)}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: accentColor, display: 'flex', padding: 2 }}
                              >
                                <UserPlus size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Alertas */}
        <Panel
          ctx={ctx}
          icon={<AlertTriangle size={14} color={accentColor} />}
          title={`Alertas (${alerts.length})`}
          right={
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} style={selectStyle(ctx)}>
              <option value="all">Todos</option>
              <option value="critical">Críticos</option>
              <option value="warning">Atenção</option>
              <option value="info">Informativos</option>
            </select>
          }
        >
          {visibleAlerts.length === 0 ? (
            <EmptyState ctx={ctx} text="Nenhum alerta neste filtro." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleAlerts.map((a) => (
                <div
                  key={a.id}
                  {...rowHover(ctx)}
                  onClick={() => (a.url ? openUrl(a.url) : a.login ? onOpenMember(a.login) : undefined)}
                  style={{ display: 'flex', gap: 8, padding: '6px 4px', borderRadius: 6, cursor: a.url || a.login ? 'pointer' : 'default', alignItems: 'flex-start' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_COLOR[a.severity], marginTop: 5, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: theme.textPrimary }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 }}>{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
