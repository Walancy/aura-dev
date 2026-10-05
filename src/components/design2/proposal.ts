import type { Shape } from './types';
import { extractJson } from './aiScreenFromLlm';
import { collectSubtree } from './exportDesign';

export interface ProposalScreen { frameId: string; title: string; description: string; highlights: string[] }
export interface Proposal {
  title: string;
  subtitle: string;
  intro: string;
  objectives: string[];
  screens: ProposalScreen[];
  features: Array<{ title: string; description: string }>;
  included: string[];
  notIncluded: string[];
  timeline: Array<{ phase: string; duration: string; deliverables: string }>;
  investment: string;
  nextSteps: string[];
  closing: string;
}

export interface FrameContext { id: string; name: string; width: number; height: number; texts: string[]; icons: string[]; images: number; elements: number }

/** O que a IA "enxerga" de cada tela: textos, ícones e contagem de elementos. */
export function collectFrameContext(all: Shape[], frame: Shape): FrameContext {
  const items = collectSubtree(all, frame).filter((s) => s.id !== frame.id && s.visible !== false && !s.deviceChrome);
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    id: frame.id,
    name: frame.name,
    width: Math.round(frame.width),
    height: Math.round(frame.height),
    texts: ordered.filter((s) => s.type === 'text' && s.text).map((s) => String(s.text).replace(/\s+/g, ' ').trim()).slice(0, 60),
    icons: [...new Set(ordered.filter((s) => s.iconName).map((s) => s.iconName!))].slice(0, 20),
    images: items.filter((s) => s.type === 'image').length,
    elements: items.length,
  };
}

export interface ProposalRequest { client?: string; company?: string; notes?: string; projectContext?: string; frames: FrameContext[] }

export function buildProposalPrompt(r: ProposalRequest): string {
  return `Você é um consultor de produto e designer sênior escrevendo uma PROPOSTA COMERCIAL em português do Brasil para um possível cliente, com base nas telas de um protótipo. Responda SOMENTE com JSON válido (sem markdown).

${r.client ? `CLIENTE: ${r.client}\n` : ''}${r.company ? `EMPRESA PROPONENTE: ${r.company}\n` : ''}${r.notes ? `OBSERVAÇÕES DO USUÁRIO: ${r.notes}\n` : ''}${r.projectContext ? `CONTEXTO DO PROJETO:\n${r.projectContext}\n` : ''}
TELAS DO PROTÓTIPO (analise textos, ícones e estrutura para entender o produto, o público e o fluxo):
${JSON.stringify(r.frames.map((f) => ({ frameId: f.id, nome: f.name, tamanho: `${f.width}x${f.height}`, textos: f.texts, icones: f.icons, fotos: f.images, elementos: f.elements })))}

FORMATO:
{"title":"Título da proposta","subtitle":"Frase de valor curta","intro":"Parágrafo de apresentação e entendimento do problema/oportunidade",
 "objectives":["..."],
 "screens":[{"frameId":"<frameId exato, na ordem do fluxo>","title":"Nome claro da tela","description":"2-3 frases sobre o que a tela resolve para o usuário e o negócio","highlights":["destaque 1","destaque 2"]}],
 "features":[{"title":"Funcionalidade","description":"benefício"}],
 "included":["escopo incluído"],"notIncluded":["fora do escopo"],
 "timeline":[{"phase":"Descoberta","duration":"1 semana","deliverables":"..."}],
 "investment":"texto sobre o investimento","nextSteps":["..."],"closing":"parágrafo final"}

REGRAS:
- Inclua UMA entrada em "screens" para CADA tela listada, com o frameId exato.
- Seja específico ao produto das telas (nomes, fluxos, benefícios reais); tom profissional, persuasivo e claro; sem jargão desnecessário.
- NÃO invente valores monetários, prazos contratuais exatos nem números de clientes: em "investment" explique que o valor será definido conforme escopo e prioridades (pode citar fatores que influenciam). Prazos em "timeline" são estimativas por fase.
- Deduza funcionalidades somente do que as telas mostram; o que for suposição deve aparecer como "sugestão".`;
}

const arr = (v: unknown, max = 12): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, max) : []);
const str = (v: unknown, max = 1200) => String(v ?? '').trim().slice(0, max);

export function parseProposal(raw: string, frames: FrameContext[]): Proposal | null {
  const d = extractJson(raw);
  if (!d || typeof d !== 'object' || !str(d.title)) return null;
  const known = new Set(frames.map((f) => f.id));
  const screens: ProposalScreen[] = (Array.isArray(d.screens) ? d.screens : [])
    .filter((s: any) => s && known.has(s.frameId))
    .map((s: any) => ({ frameId: s.frameId, title: str(s.title, 120), description: str(s.description), highlights: arr(s.highlights, 6) }));
  // telas que a IA esqueceu entram só com o nome
  for (const f of frames) if (!screens.some((s) => s.frameId === f.id)) screens.push({ frameId: f.id, title: f.name, description: '', highlights: [] });
  return {
    title: str(d.title, 140),
    subtitle: str(d.subtitle, 240),
    intro: str(d.intro),
    objectives: arr(d.objectives),
    screens,
    features: (Array.isArray(d.features) ? d.features : []).slice(0, 12).map((f: any) => ({ title: str(f?.title, 100), description: str(f?.description, 400) })).filter((f: any) => f.title),
    included: arr(d.included, 14),
    notIncluded: arr(d.notIncluded, 10),
    timeline: (Array.isArray(d.timeline) ? d.timeline : []).slice(0, 8).map((t: any) => ({ phase: str(t?.phase, 100), duration: str(t?.duration, 60), deliverables: str(t?.deliverables, 300) })).filter((t: any) => t.phase),
    investment: str(d.investment),
    nextSteps: arr(d.nextSteps, 8),
    closing: str(d.closing),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const para = (s: string) => s.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('');
const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

export interface ProposalHtmlOptions { accent: string; client?: string; company?: string; date?: string }

/** HTML A4 da proposta (imagens como data URL), pronto para printToPDF. */
export function buildProposalHtml(p: Proposal, images: Record<string, string>, frames: FrameContext[], o: ProposalHtmlOptions): string {
  const frameById = new Map(frames.map((f) => [f.id, f]));
  const section = (title: string, body: string) => (body ? `<section class="block"><h2>${esc(title)}</h2>${body}</section>` : '');
  const screens = p.screens
    .map((s) => {
      const f = frameById.get(s.frameId);
      const img = images[s.frameId];
      const portrait = f ? f.height / f.width > 1.2 : false;
      return `<section class="screen ${portrait ? 'portrait' : 'wide'}">
        ${img ? `<div class="shot"><img src="${img}" /></div>` : ''}
        <div class="txt"><h3>${esc(s.title)}</h3>${para(s.description)}${list(s.highlights)}</div>
      </section>`;
    })
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: -apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #18181B; font-size: 12.5px; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .cover { height: 297mm; padding: 28mm 22mm; background: linear-gradient(160deg, ${o.accent} 0%, #18181B 100%); color: #fff; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always }
  .cover h1 { font-size: 40px; line-height: 1.1; margin: 0 0 14px; max-width: 150mm } .cover .sub { font-size: 17px; opacity: .9; max-width: 140mm }
  .cover .meta { font-size: 12px; opacity: .85 } .cover .tag { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; opacity: .8 }
  .page { padding: 20mm 20mm 16mm } h2 { font-size: 20px; margin: 0 0 8px; color: ${o.accent} } h3 { font-size: 16px; margin: 0 0 6px }
  .block { margin: 0 0 18px; page-break-inside: avoid } p { margin: 0 0 8px } ul { margin: 4px 0 8px; padding-left: 18px } li { margin-bottom: 3px }
  .screen { display: flex; gap: 8mm; margin: 0 0 14mm; page-break-inside: avoid; align-items: flex-start }
  .screen.wide { flex-direction: column } .screen .shot img { width: 100%; border-radius: 10px; border: 1px solid #E4E4E7; display: block }
  .screen.portrait .shot { width: 62mm; flex: none } .screen.portrait .txt { flex: 1; padding-top: 4mm } .screen.wide .shot { width: 100% }
  .features { display: grid; grid-template-columns: 1fr 1fr; gap: 8px } .feat { border: 1px solid #E4E4E7; border-radius: 10px; padding: 10px 12px } .feat b { display: block; margin-bottom: 2px }
  table { width: 100%; border-collapse: collapse } th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #E4E4E7; vertical-align: top } th { background: #F4F4F5; font-size: 11px; text-transform: uppercase; letter-spacing: .05em }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px } .note { background: #F4F4F5; border-left: 4px solid ${o.accent}; border-radius: 6px; padding: 10px 12px }
  </style></head><body>
  <div class="cover"><div class="tag">Proposta${o.company ? ` · ${esc(o.company)}` : ''}</div><div><h1>${esc(p.title)}</h1><div class="sub">${esc(p.subtitle)}</div></div><div class="meta">${o.client ? `Preparada para ${esc(o.client)}<br>` : ''}${esc(o.date || new Date().toLocaleDateString('pt-BR'))}</div></div>
  <div class="page">
    ${section('Apresentação', para(p.intro))}
    ${section('Objetivos', list(p.objectives))}
    <h2>O produto, tela a tela</h2>${screens}
    ${p.features.length ? section('Funcionalidades', `<div class="features">${p.features.map((f) => `<div class="feat"><b>${esc(f.title)}</b>${esc(f.description)}</div>`).join('')}</div>`) : ''}
    ${p.included.length || p.notIncluded.length ? section('Escopo', `<div class="two"><div><h3>Incluído</h3>${list(p.included)}</div><div><h3>Fora do escopo</h3>${list(p.notIncluded)}</div></div>`) : ''}
    ${p.timeline.length ? section('Cronograma estimado', `<table><tr><th>Fase</th><th>Duração</th><th>Entregas</th></tr>${p.timeline.map((t) => `<tr><td>${esc(t.phase)}</td><td>${esc(t.duration)}</td><td>${esc(t.deliverables)}</td></tr>`).join('')}</table>`) : ''}
    ${section('Investimento', p.investment ? `<div class="note">${para(p.investment)}</div>` : '')}
    ${section('Próximos passos', list(p.nextSteps))}
    ${section('', para(p.closing)).replace('<h2></h2>', '')}
  </div></body></html>`;
}
