import { requestAiScreenRaw, extractJson } from '../design2/aiScreenFromLlm';
import type { FigcraftCall } from './figcraftAi';

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** O pedido quer protótipo clicável (fluxo de navegação entre telas)? */
export function wantsPrototype(prompt: string): boolean {
  const p = norm(prompt);
  return /\b(prototip\w*|clicavel|clicaveis|fluxo de cliques?|fluxo de navegacao|fluxo de prototip\w*|navegacao entre (as )?telas|interac(ao|oes) entre (as )?telas|ligar as telas|conectar as telas|liga(r|cao) (das )?telas)\b/.test(p);
}

interface Cand { id: number; label: string; name: string; box: string }
const CLICK_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'GROUP', 'VECTOR', 'ELLIPSE', 'RECTANGLE']);
const CLICK_NAME = /bot|button|btn|tab|nav|menu|icon|arrow|back|voltar|card|link|cta|item|avatar|chip|toggle|close|fechar|search|busca/i;

const textOf = (n: any, d = 0): string => (n.type === 'TEXT' ? String(n.characters || '') : d < 4 ? (n.children || []).map((c: any) => textOf(c, d + 1)).filter(Boolean).join(' ') : '');

/** Elementos que um usuário toca (botões, abas, itens de navegação, cards, ícones), com o texto que mostram. */
function candidates(root: any): Cand[] {
  const out: Cand[] = [];
  const area = Math.max(1, (root.width || 1) * (root.height || 1));
  const walk = (n: any) => {
    for (const c of n.children || []) {
      if (out.length >= 60) return;
      const w = c.width || 0, h = c.height || 0;
      const label = textOf(c).replace(/\s+/g, ' ').trim().slice(0, 40);
      if (CLICK_TYPES.has(String(c.type)) && w * h <= area * 0.6 && w >= 16 && h >= 16 && (label || CLICK_NAME.test(String(c.name)))) {
        out.push({ id: c.id, label, name: String(c.name || '').slice(0, 30), box: `${Math.round(c.x ?? 0)},${Math.round(c.y ?? 0)},${Math.round(w)}x${Math.round(h)}` });
      }
      walk(c);
    }
  };
  walk(root);
  return out;
}

const TRANSITIONS = new Set(['instant', 'dissolve', 'smartAnimate', 'moveIn', 'moveOut', 'push', 'slideIn', 'slideOut']);
const DIRECTIONS = new Set(['left', 'right', 'top', 'bottom']);

/**
 * Pede à IA os cliques do protótipo (qual elemento leva a qual tela, com a transição) e cria as interações e o ponto de partida do
 * fluxo no FigCraft. `roots` são os quadros (telas) em ordem de leitura. Devolve quantas interações foram criadas.
 */
export async function buildPrototypeFlow(
  call: FigcraftCall,
  roots: any[],
  o: { request: string; provider: string; model?: string; cwd?: string; onProgress: (m: string) => void }
): Promise<number> {
  if (roots.length < 2) return 0;
  const screens = roots.map((r, i) => ({ i, id: r.id as number, name: String(r.name || `Tela ${i + 1}`), cands: candidates(r) }));
  o.onProgress(`Montando o fluxo de protótipo entre ${screens.length} telas…`);
  const list = screens.map((s) => `TELA ${s.i} "${s.name}" — elementos clicáveis:\n${s.cands.map((c) => `  [${c.id}] "${c.label}" (${c.name}; ${c.box})`).join('\n') || '  (nenhum)'}`).join('\n\n');
  const raw = await requestAiScreenRaw(
    `Você é um designer de UX montando um PROTÓTIPO CLICÁVEL com as telas abaixo. Responda SOMENTE JSON minificado (sem markdown):
{"start":<índice da tela inicial>,"links":[{"from":<índice da tela>,"el":<id do elemento clicável dessa tela>,"to":<índice da tela de destino>|"back","transition":"slideIn|push|moveIn|dissolve|smartAnimate|instant","direction":"left|right|top|bottom"}]}
Regras: use SOMENTE ids de elementos da própria tela "from"; cada botão/aba/item de navegação/card que naturalmente leva a outra tela vira um link (CTA principal avança no fluxo; abas e barra inferior vão para a tela correspondente; setas/"Voltar"/"Fechar" usam "back"; login/entrar vai para a home; cards de lista abrem o detalhe); não invente destinos que não existem; no máximo um link por elemento; navegação para frente usa push/slideIn com direction "left", voltar usa direction "right"; abas e troca entre seções usam dissolve ou instant; mantenha o fluxo coerente com o pedido.

PEDIDO DO USUÁRIO: ${o.request.slice(0, 600)}

${list}`.slice(0, 30000),
    o.provider, o.model, o.cwd || '/tmp', 150000
  );
  const plan = extractJson(raw);
  const links: any[] = Array.isArray(plan?.links) ? plan.links : [];
  const start = Number.isInteger(plan?.start) && screens[plan.start] ? plan.start : 0;
  let made = 0;
  const used = new Set<number>();
  for (const l of links) {
    const from = screens[l?.from];
    const el = Number(l?.el);
    if (!from || used.has(el) || !from.cands.some((c) => c.id === el)) continue;
    const back = l.to === 'back';
    const to = back ? null : screens[l?.to];
    if (!back && (!to || to.id === from.id)) continue;
    const transition = TRANSITIONS.has(l.transition) ? { type: l.transition, ...(DIRECTIONS.has(l.direction) && l.transition !== 'dissolve' && l.transition !== 'instant' && l.transition !== 'smartAnimate' ? { direction: l.direction } : {}) } : { type: 'dissolve' };
    const rich = { id: el, trigger: { type: 'onClick' }, action: back ? { type: 'back' } : { type: 'navigate', dest: to!.id }, transition };
    try {
      await call('engine.execute', { command: 'proto.interaction.add', params: rich });
      made++; used.add(el);
    } catch {
      if (back) continue;
      try { await call('engine.execute', { command: 'proto.interaction.add', params: { id: el, dest: to!.id } }); made++; used.add(el); } catch { /* elemento sem suporte a interação */ }
    }
  }
  if (made) await call('engine.execute', { command: 'proto.flow.add', params: { start: screens[start].id, name: 'Fluxo principal' } }).catch(() => {});
  return made;
}
