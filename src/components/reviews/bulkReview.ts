import { ghSettings } from '../settings/settingsUi';
import type { TeamAiProvider } from '../team/TeamAiPanel';
import { buildAiPrompt, loadDetail, OTHERS_KEY, writeSavedReview, type OtherPr } from './PullRequestDetail';
import { logSystemActivity } from '../../utils/brainService';

export type BulkEvent = 'APPROVE' | 'REQUEST_CHANGES';
export interface BulkItem {
  number: number;
  title: string;
  status: 'pending' | 'running' | 'done' | 'error';
  decision?: BulkEvent;
  note?: string;
}

export const friendlyReviewError = (m: string) =>
  /own pull request/i.test(m) ? 'O GitHub não permite revisar o próprio pull request.' : /can not approve|cannot approve/i.test(m) ? 'Sem permissão para aprovar.' : /review.*(pending|already)/i.test(m) ? 'Já existe uma review pendente sua.' : m;

/** Envia a mesma decisão (aprovar ou pedir alterações) para um PR. */
export async function submitDecision(repo: string, number: number, event: BulkEvent, body?: string) {
  const [owner, name] = repo.split('/');
  await ghSettings('submitReview', { owner, repo: name, number, event, body: body?.trim() || undefined });
  logSystemActivity('review', 'enviar_review_em_massa', `${repo}#${number}`, { event });
}

const DECISION_RULE = `

IMPORTANTE: a ÚLTIMA linha da resposta deve ser exatamente "DECISÃO: APROVAR" ou "DECISÃO: SOLICITAR ALTERAÇÕES". Só aprove se não houver bug, falha de segurança ou problema que bloqueie o merge.`;
const DECISION_RE = /^\s*\**\s*DECIS[ÃA]O:\s*(APROVAR|SOLICITAR)[^\n]*$/gim;

/** A IA revisa o PR, decide e a review é enviada ao GitHub com o texto dela. */
export async function aiReviewAndSubmit(repo: string, number: number, provider: TeamAiProvider, run: { id: string; cancelled: boolean }): Promise<{ decision: BulkEvent; note?: string }> {
  const api = window.electronAPI?.ai;
  if (!api?.runCli || !provider.cliCommand) throw new Error(`A IA ${provider.name} não tem CLI configurada.`);
  const [owner, name] = repo.split('/');
  const data = await loadDetail(owner, name, number);
  let others: OtherPr[] = [];
  let withOthers = false;
  try { withOthers = localStorage.getItem(OTHERS_KEY) === '1'; } catch {}
  if (withOthers) {
    try {
      const list = await ghSettings<any[]>('listPulls', { owner, repo: name });
      const open = list.filter((x) => x.state === 'open' && x.number !== number).slice(0, 8);
      const details = await Promise.all(open.map((x) => loadDetail(owner, name, x.number).catch(() => null)));
      others = details.flatMap((d, i) => (d ? [{ number: open[i].number, title: open[i].title, head: `${d.pr.head} -> ${d.pr.base}`, files: d.files.map((f) => ({ filename: f.filename, patch: f.patch })) }] : []));
    } catch {}
  }
  const prompt = buildAiPrompt(data, others) + DECISION_RULE;
  const startedAt = Date.now();
  let lastErr = '';
  for (const model of provider.model ? [provider.model, undefined] : [undefined]) {
    let res: any;
    try {
      res = await api.runCli({ cliCmd: provider.cliCommand, prompt, model, cwd: provider.cwd, streamId: run.id });
    } catch (e: any) {
      lastErr = e?.message || String(e);
      continue;
    }
    if (run.cancelled || res?.cancelled) throw new Error('cancelado');
    const out = (res?.stdout || '').trim();
    if (!out || res?.exitCode !== 0 || out.startsWith('Error:') || out.includes('[claude-code:unrecognized_model]')) {
      lastErr = (res?.stderr || out || `a CLI saiu com código ${res?.exitCode}`).trim().slice(-300);
      continue;
    }
    const m = [...out.matchAll(DECISION_RE)].pop();
    if (!m) throw new Error('A IA não indicou a decisão. Revise este PR individualmente.');
    const decision: BulkEvent = /APROVAR/i.test(m[1]) ? 'APPROVE' : 'REQUEST_CHANGES';
    const text = out.replace(DECISION_RE, '').trim();
    writeSavedReview(repo, number, { text, providerId: provider.id, providerName: provider.name, model: model || undefined, savedAt: new Date().toISOString(), headSha: data.commitList[data.commitList.length - 1]?.sha, files: data.files.length, kb: Math.round(prompt.length / 1024), seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) });
    logSystemActivity('review', 'revisar_com_ia', `${repo}#${number}`, { provider: provider.id, bulk: true });
    await submitDecision(repo, number, decision, text);
    return { decision };
  }
  throw new Error(lastErr || 'A IA não respondeu.');
}
