import { extractJson } from '../design2/aiScreenFromLlm';

export type DocStyle = 'proposta' | 'briefing' | 'especificacao' | 'historias' | 'handoff' | 'ux' | 'testes' | 'relatorio' | 'executivo' | 'manual' | 'designsystem' | 'release';

export const DOC_STYLES: { id: DocStyle; label: string; description: string; sections: string[]; tone: string; cover: CoverVariant }[] = [
  {
    id: 'proposta',
    label: 'Proposta comercial',
    description: 'Capa, escopo, cronograma e próximos passos para apresentar ao cliente',
    sections: ['Objetivos', 'Funcionalidades', 'Escopo (incluído e fora do escopo)', 'Cronograma estimado', 'Investimento', 'Próximos passos'],
    tone: 'persuasivo e claro, voltado a um possível cliente',
    cover: 'gradient',
  },
  {
    id: 'briefing',
    label: 'Briefing de projeto',
    description: 'Contexto, público, objetivos, referências e restrições para alinhar o time',
    sections: ['Contexto', 'Objetivos do projeto', 'Público-alvo', 'Escopo e entregáveis', 'Referências e inspirações', 'Restrições e premissas', 'Prazos e responsáveis sugeridos'],
    tone: 'conciso e alinhador, voltado ao time e a stakeholders no início do projeto',
    cover: 'solid',
  },
  {
    id: 'especificacao',
    label: 'Especificação de produto',
    description: 'PRD com problema, público, requisitos, regras de negócio e fluxos',
    sections: ['Visão geral e problema', 'Público e personas', 'Objetivos e métricas de sucesso', 'Requisitos funcionais', 'Requisitos não funcionais', 'Regras de negócio', 'Fluxos principais', 'Riscos e perguntas em aberto'],
    tone: 'objetivo e preciso, voltado ao time de produto e engenharia',
    cover: 'bar',
  },
  {
    id: 'historias',
    label: 'Histórias de usuário',
    description: 'Épicos e histórias com critérios de aceite, derivados de cada tela',
    sections: ['Personas', 'Épicos', 'Histórias de usuário (Como... quero... para...)', 'Critérios de aceite', 'Dependências', 'Priorização sugerida (MoSCoW)'],
    tone: 'ágil e orientado a valor, voltado a product owners e desenvolvedores',
    cover: 'split',
  },
  {
    id: 'handoff',
    label: 'Handoff para desenvolvimento',
    description: 'Componentes, estados, estilos, comportamentos e critérios de aceite',
    sections: ['Visão técnica', 'Componentes reutilizáveis', 'Estados e interações', 'Estrutura e layout', 'Estilos (cores e tipografia)', 'Comportamento responsivo', 'Acessibilidade', 'Critérios de aceite'],
    tone: 'técnico e direto, voltado a quem vai implementar as telas',
    cover: 'grid',
  },
  {
    id: 'ux',
    label: 'Guia de UX e fluxo',
    description: 'Jornada do usuário, fluxo tela a tela e pontos de usabilidade',
    sections: ['Resumo da experiência', 'Jornada do usuário', 'Fluxo tela a tela', 'Pontos de atenção de usabilidade', 'Sugestões de melhoria'],
    tone: 'claro e centrado no usuário, voltado a designers e stakeholders',
    cover: 'circle',
  },
  {
    id: 'testes',
    label: 'Plano de testes (QA)',
    description: 'Cenários, casos de teste, dados e checklist de usabilidade por tela',
    sections: ['Escopo dos testes', 'Cenários principais', 'Casos de teste (passos e resultado esperado)', 'Casos de borda e erros', 'Checklist de usabilidade e acessibilidade', 'Critérios de saída'],
    tone: 'metódico e verificável, voltado a QA e desenvolvedores',
    cover: 'band-bottom',
  },
  {
    id: 'relatorio',
    label: 'Relatório de design',
    description: 'Resumo do que foi desenhado, decisões, pendências e recomendações',
    sections: ['Resumo executivo', 'O que foi entregue', 'Decisões de design', 'Consistência visual (cores, tipografia, componentes)', 'Pendências e riscos', 'Recomendações e próximos passos'],
    tone: 'analítico e transparente, voltado a gestores e clientes que acompanham o andamento',
    cover: 'band-top',
  },
  {
    id: 'executivo',
    label: 'Resumo executivo',
    description: 'Uma visão curta do produto para decisores: problema, solução e valor',
    sections: ['Problema', 'Solução proposta', 'Principais telas e fluxos', 'Valor para o negócio', 'Decisões necessárias'],
    tone: 'direto e sintético, voltado a diretores e investidores com pouco tempo',
    cover: 'minimal',
  },
  {
    id: 'manual',
    label: 'Manual do usuário',
    description: 'Passo a passo de uso de cada tela, com dicas e perguntas frequentes',
    sections: ['Introdução', 'Primeiros passos', 'Como usar cada recurso', 'Dicas e boas práticas', 'Perguntas frequentes', 'Suporte'],
    tone: 'didático, simples e acolhedor, voltado ao usuário final',
    cover: 'duo',
  },
  {
    id: 'designsystem',
    label: 'Guia de design system',
    description: 'Cores, tipografia, espaçamentos e componentes identificados nas telas',
    sections: ['Princípios de design', 'Cores', 'Tipografia', 'Espaçamento e grid', 'Componentes e variações', 'Padrões de interação', 'Boas práticas de uso'],
    tone: 'sistemático e prescritivo, voltado a designers e desenvolvedores front-end',
    cover: 'frame',
  },
  {
    id: 'release',
    label: 'Notas de versão',
    description: 'Novidades, melhorias e correções para comunicar uma entrega',
    sections: ['Destaques da versão', 'Novas funcionalidades', 'Melhorias', 'Correções', 'Mudanças que exigem atenção', 'O que vem a seguir'],
    tone: 'objetivo e positivo, voltado a clientes e equipe interna',
    cover: 'gradient',
  },
];

export type CoverVariant = 'gradient' | 'solid' | 'bar' | 'split' | 'grid' | 'circle' | 'band-bottom' | 'band-top' | 'minimal' | 'duo' | 'frame';
export const COVER_VARIANTS: { id: CoverVariant; label: string }[] = [
  { id: 'gradient', label: 'Degradê' }, { id: 'solid', label: 'Cor sólida' }, { id: 'bar', label: 'Barra lateral' }, { id: 'split', label: 'Diagonal' },
  { id: 'grid', label: 'Malha' }, { id: 'circle', label: 'Círculo' }, { id: 'band-bottom', label: 'Faixa inferior' }, { id: 'band-top', label: 'Faixa superior' },
  { id: 'minimal', label: 'Minimalista' }, { id: 'duo', label: 'Duas colunas' }, { id: 'frame', label: 'Moldura' },
];

export const DOC_FONTS: { id: string; label: string; css: string }[] = [
  { id: 'inter', label: 'Inter', css: "'Inter', -apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { id: 'poppins', label: 'Poppins', css: "'Poppins', 'Inter', -apple-system, Arial, sans-serif" },
  { id: 'helvetica', label: 'Helvetica', css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: 'georgia', label: 'Georgia (serifada)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'palatino', label: 'Palatino (serifada)', css: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { id: 'mono', label: 'Monoespaçada', css: "'SF Mono', Menlo, 'Courier New', monospace" },
];

export interface DocTheme {
  font: string; fontSize: number; lineHeight: number; headingScale: number; headingWeight: number;
  margin: number; blockGap: number; imageRadius: number; accent: string;
  coverVariant: CoverVariant; coverAlign: 'left' | 'center'; coverBg: string; coverFg: string;
  showIntro: boolean; showScreens: boolean; customCss: string;
}

export const defaultTheme = (style: DocStyle, accent: string): DocTheme => ({
  font: 'inter', fontSize: 12.5, lineHeight: 1.55, headingScale: 1, headingWeight: 600, margin: 20, blockGap: 18, imageRadius: 10, accent,
  coverVariant: (DOC_STYLES.find((d) => d.id === style) || DOC_STYLES[0]).cover, coverAlign: 'left', coverBg: '', coverFg: '', showIntro: true, showScreens: true, customCss: '',
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Valida o que a IA (ou o usuario) devolveu: so valores conhecidos entram no tema. */
export function sanitizeTheme(p: any, base: DocTheme): DocTheme {
  if (!p || typeof p !== 'object') return base;
  const t = { ...base };
  if (DOC_FONTS.some((f) => f.id === p.font)) t.font = p.font;
  if (p.fontSize != null) t.fontSize = num(p.fontSize, 9, 18, t.fontSize);
  if (p.lineHeight != null) t.lineHeight = num(p.lineHeight, 1.2, 2.2, t.lineHeight);
  if (p.headingScale != null) t.headingScale = num(p.headingScale, 0.7, 1.8, t.headingScale);
  if (p.headingWeight != null) t.headingWeight = [400, 500, 600, 700].reduce((a, b) => (Math.abs(b - Number(p.headingWeight)) < Math.abs(a - Number(p.headingWeight)) ? b : a));
  if (p.margin != null) t.margin = num(p.margin, 8, 36, t.margin);
  if (p.blockGap != null) t.blockGap = num(p.blockGap, 4, 48, t.blockGap);
  if (p.imageRadius != null) t.imageRadius = num(p.imageRadius, 0, 32, t.imageRadius);
  if (HEX.test(p.accent)) t.accent = p.accent;
  if (COVER_VARIANTS.some((c) => c.id === p.coverVariant)) t.coverVariant = p.coverVariant;
  if (p.coverAlign === 'left' || p.coverAlign === 'center') t.coverAlign = p.coverAlign;
  if (p.coverBg === '' || HEX.test(p.coverBg)) t.coverBg = p.coverBg;
  if (p.coverFg === '' || HEX.test(p.coverFg)) t.coverFg = p.coverFg;
  if (typeof p.showIntro === 'boolean') t.showIntro = p.showIntro;
  if (typeof p.showScreens === 'boolean') t.showScreens = p.showScreens;
  if (typeof p.customCss === 'string') {
    t.customCss = p.customCss.replace(/<[^>]*>?/g, '').replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?\s*(?!data:)[^)]*\)/gi, 'none').replace(/expression\s*\(/gi, '').slice(0, 4000);
  }
  return t;
}

export function buildThemePrompt(request: string, theme: DocTheme, styleLabel: string, title: string): string {
  return `Você é um diretor de arte criando o VISUAL de um documento A4 (${styleLabel}: "${title}"). Responda SOMENTE com JSON válido (sem markdown) contendo apenas as propriedades que quer alterar.

PEDIDO DO USUÁRIO: ${request}

TEMA ATUAL: ${JSON.stringify(theme)}

PROPRIEDADES PERMITIDAS:
- font: ${DOC_FONTS.map((f) => `"${f.id}"`).join(' | ')}
- fontSize (9-18), lineHeight (1.2-2.2), headingScale (0.7-1.8), headingWeight (400|500|600|700)
- margin (mm, 8-36), blockGap (px, 4-48), imageRadius (px, 0-32)
- accent (hex #RRGGBB, cor de destaque dos títulos e da capa)
- coverVariant: ${COVER_VARIANTS.map((c) => `"${c.id}"`).join(' | ')}
- coverAlign: "left" | "center"; coverBg e coverFg (hex #RRGGBB ou "" para o padrão do layout)
- showIntro, showScreens (booleanos)
- customCss: CSS extra opcional (seletores: .cover, .cover h1, .cover .sub, .cover .tag, .page, h2, h3, p, ul, li, .block, .screen, .shot img). Sem @import nem url() externo.
Escolha cores com bom contraste (texto legível sobre o fundo). Evite tons pastel.`;
}

/** Conteudo de exemplo para a previa antes de gerar com a IA. */
export function sampleDoc(styleId: DocStyle, frames: { id: number; name: string }[]): DocResult {
  const st = DOC_STYLES.find((d) => d.id === styleId) || DOC_STYLES[0];
  const lorem = 'Texto de exemplo para mostrar como o documento fica. Gere a documentação com a IA para preencher com o conteúdo real das suas telas.';
  return {
    title: st.label,
    subtitle: 'Prévia com conteúdo de exemplo',
    intro: lorem,
    screens: frames.map((f) => ({ frameId: f.id, title: f.name, description: lorem, highlights: ['Destaque de exemplo', 'Outro destaque de exemplo'] })),
    sections: st.sections.map((h) => ({ heading: h, body: lorem, bullets: ['Primeiro item de exemplo', 'Segundo item de exemplo'] })),
    closing: '',
  };
}

/** A capa de cada layout (a do PDF e a miniatura do painel usam o mesmo CSS). `grid` e o tamanho da malha; `bg`/`fg` sobrepoem as cores do layout. */
export function coverCss(variant: CoverVariant, accent: string, grid = '8mm', bg = '', fg = ''): { background: string; color: string; shadow: string } {
  const lines = (c: string) => `linear-gradient(${c} 1px, transparent 1px) 0 0 / ${grid} ${grid}, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / ${grid} ${grid}`;
  const pick = (base: string, color: string, shadow = 'none', background?: string) => ({ background: background ?? base, color: fg || color, shadow });
  switch (variant) {
    case 'bar': { const base = bg || '#18181B'; return pick(base, '#fff', `inset 9mm 0 0 ${accent}`); }
    case 'grid': { const base = bg || '#0F172A'; return pick(base, '#E2E8F0', 'none', `${lines('rgba(255,255,255,.07)')}, ${base}`); }
    case 'circle': { const base = bg || '#FFFFFF'; return pick(base, '#18181B', 'none', `radial-gradient(circle at 84% 14%, ${accent} 0, ${accent} 26%, transparent 26.6%), ${base}`); }
    case 'solid': return pick(bg || accent, '#fff');
    case 'split': { const base = bg || '#18181B'; return pick(base, '#fff', 'none', `linear-gradient(135deg, ${base} 0 62%, ${accent} 62% 100%)`); }
    case 'band-bottom': return pick(bg || '#FFFFFF', '#18181B', `inset 0 -9mm 0 ${accent}`);
    case 'band-top': return pick(bg || '#F4F4F5', '#18181B', `inset 0 9mm 0 ${accent}`);
    case 'minimal': return pick(bg || '#FFFFFF', '#18181B', `inset 0 -1px 0 #E4E4E7`);
    case 'duo': { const base = bg || '#FFFFFF'; return pick(base, '#18181B', 'none', `linear-gradient(90deg, ${accent} 0 34%, ${base} 34% 100%)`); }
    case 'frame': { const base = bg || '#FFFFFF'; return pick(base, '#18181B', `inset 0 0 0 5mm ${base}, inset 0 0 0 6mm ${accent}`); }
    default: return pick(accent, '#fff', 'none', bg || `linear-gradient(160deg, ${accent} 0%, #18181B 100%)`);
  }
}

export interface FrameInfo { id: number; name: string; width: number; height: number; texts: string[]; elements: number; images: number }

/** O que a IA "enxerga" de cada tela: textos e quantidade de elementos (a partir do documento do FigCraft). */
export function collectFrameInfo(node: any): FrameInfo {
  const texts: string[] = [];
  let elements = 0;
  let images = 0;
  const walk = (n: any, root: boolean) => {
    if (!root) {
      elements++;
      if (n.type === 'TEXT' && n.characters) texts.push(String(n.characters).replace(/\s+/g, ' ').trim());
      if ((n.fills || []).some((f: any) => f.type === 'image')) images++;
    }
    (n.children || []).forEach((c: any) => walk(c, false));
  };
  walk(node, true);
  return { id: node.id, name: node.name, width: Math.round(node.width), height: Math.round(node.height), texts: texts.slice(0, 60), elements, images };
}

export interface DocRequest { style: DocStyle; frames: FrameInfo[]; notes?: string; projectName?: string; projectContext?: string }

export function buildDocPrompt(r: DocRequest): string {
  const st = DOC_STYLES.find((s) => s.id === r.style) || DOC_STYLES[0];
  return `Você é um consultor de produto e designer sênior escrevendo uma DOCUMENTAÇÃO do tipo "${st.label}" em português do Brasil, com base nas telas de um protótipo. Tom: ${st.tone}. Responda SOMENTE com JSON válido (sem markdown).

${r.projectName ? `PROJETO: ${r.projectName}\n` : ''}${r.notes ? `INSTRUÇÕES DO USUÁRIO: ${r.notes}\n` : ''}${r.projectContext ? `CONTEXTO DO PROJETO:\n${r.projectContext}\n` : ''}
TELAS DO PROTÓTIPO (analise textos e estrutura para entender o produto, o público e o fluxo):
${JSON.stringify(r.frames.map((f) => ({ frameId: f.id, nome: f.name, tamanho: `${f.width}x${f.height}`, textos: f.texts, fotos: f.images, elementos: f.elements })))}

FORMATO:
{"title":"Título do documento","subtitle":"Frase curta que resume o documento","intro":"Parágrafo de apresentação",
 "screens":[{"frameId":<frameId exato, na ordem do fluxo>,"title":"Nome claro da tela","description":"2-3 frases sobre o que a tela resolve","highlights":["destaque 1","destaque 2"]}],
 "sections":[{"heading":"Título da seção","body":"texto corrido","bullets":["item 1","item 2"]}],
 "closing":"parágrafo final"}

REGRAS:
- "sections" deve conter EXATAMENTE estas seções, nesta ordem: ${st.sections.map((s) => `"${s}"`).join(', ')}.
- Inclua UMA entrada em "screens" para CADA tela listada, com o frameId exato (número).
- Seja específico ao produto das telas (nomes, fluxos, benefícios reais); sem jargão desnecessário.
- Deduza apenas do que as telas mostram; o que for suposição deve aparecer como "sugestão". NÃO invente valores monetários, métricas nem números de clientes.`;
}

export interface DocResult {
  title: string;
  subtitle: string;
  intro: string;
  screens: { frameId: number; title: string; description: string; highlights: string[] }[];
  sections: { heading: string; body: string; bullets: string[] }[];
  closing: string;
}

const str = (v: unknown, max = 1600) => String(v ?? '').trim().slice(0, max);
const arr = (v: unknown, max = 10): string[] => (Array.isArray(v) ? v.map((x) => str(x, 400)).filter(Boolean).slice(0, max) : []);

export function parseDoc(raw: string, frames: FrameInfo[]): DocResult | null {
  const d = extractJson(raw);
  if (!d || typeof d !== 'object' || !str(d.title)) return null;
  const known = new Set(frames.map((f) => f.id));
  const screens = (Array.isArray(d.screens) ? d.screens : [])
    .filter((s: any) => s && known.has(Number(s.frameId)))
    .map((s: any) => ({ frameId: Number(s.frameId), title: str(s.title, 120), description: str(s.description), highlights: arr(s.highlights, 6) }));
  // telas que a IA esqueceu entram só com o nome
  for (const f of frames) if (!screens.some((s: any) => s.frameId === f.id)) screens.push({ frameId: f.id, title: f.name, description: '', highlights: [] });
  return {
    title: str(d.title, 140),
    subtitle: str(d.subtitle, 240),
    intro: str(d.intro),
    screens,
    sections: (Array.isArray(d.sections) ? d.sections : []).slice(0, 14).map((s: any) => ({ heading: str(s?.heading, 120), body: str(s?.body), bullets: arr(s?.bullets) })).filter((s: any) => s.heading),
    closing: str(d.closing),
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const para = (s: string) => s.split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

/** HTML A4 do documento (imagens como data URL), pronto para virar PDF ou previa. */
export function buildDocHtml(doc: DocResult, images: Record<number, string>, frames: FrameInfo[], o: { style: DocStyle; project?: string; theme: DocTheme; preview?: boolean }): string {
  const st = DOC_STYLES.find((s) => s.id === o.style) || DOC_STYLES[0];
  const th = o.theme;
  const cv = coverCss(th.coverVariant, th.accent, '8mm', th.coverBg, th.coverFg);
  const font = (DOC_FONTS.find((f) => f.id === th.font) || DOC_FONTS[0]).css;
  const byId = new Map(frames.map((f) => [f.id, f]));
  const screens = th.showScreens
    ? doc.screens
        .map((s) => {
          const f = byId.get(s.frameId);
          const portrait = f ? f.height / f.width > 1.2 : true;
          const img = images[s.frameId];
          return `<section class="screen ${portrait ? 'portrait' : 'wide'}">${img ? `<div class="shot"><img src="${img}" /></div>` : ''}<div class="txt"><h3>${esc(s.title)}</h3>${para(s.description)}${list(s.highlights)}</div></section>`;
        })
        .join('')
    : '';
  const sections = doc.sections.map((s) => `<section class="block"><h2>${esc(s.heading)}</h2>${para(s.body)}${list(s.bullets)}</section>`).join('');
  const center = th.coverAlign === 'center';
  const coverLeft = th.coverVariant === 'bar' ? '32mm' : th.coverVariant === 'duo' ? '82mm' : th.coverVariant === 'frame' ? '28mm' : '22mm';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: ${font}; color: #18181B; font-size: ${th.fontSize}px; line-height: ${th.lineHeight}; -webkit-print-color-adjust: exact; print-color-adjust: exact${o.preview ? '; background: #fff' : ''} }
  ${o.preview ? 'html { overflow: hidden }' : ''}
  .cover { height: 297mm; padding: 28mm 22mm 28mm ${coverLeft}; background: ${cv.background}; color: ${cv.color}; box-shadow: ${cv.shadow}; display: flex; flex-direction: column; justify-content: space-between; ${center ? 'text-align: center; align-items: center;' : ''} page-break-after: always }
  .cover h1 { font-size: ${Math.round(40 * th.headingScale)}px; font-weight: ${th.headingWeight}; line-height: 1.1; margin: 0 0 14px; max-width: ${th.coverVariant === 'duo' ? '100mm' : '150mm'} } .cover .sub { font-size: ${Math.round(17 * th.headingScale)}px; opacity: .9; max-width: ${th.coverVariant === 'duo' ? '100mm' : '140mm'} }
  .cover .meta { font-size: 12px; opacity: .85 } .cover .tag { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; opacity: .8 }
  .page { padding: ${th.margin}mm ${th.margin}mm ${Math.round(th.margin * 0.8)}mm } h2 { font-size: ${Math.round(20 * th.headingScale)}px; font-weight: ${th.headingWeight}; margin: 0 0 8px; color: ${th.accent} } h3 { font-size: ${Math.round(16 * th.headingScale)}px; font-weight: ${th.headingWeight}; margin: 0 0 6px }
  .block { margin: 0 0 ${th.blockGap}px; page-break-inside: avoid } p { margin: 0 0 8px } ul { margin: 4px 0 8px; padding-left: 18px } li { margin-bottom: 3px }
  .screen { display: flex; gap: 8mm; margin: 0 0 ${Math.round(th.blockGap * 0.8)}mm; page-break-inside: avoid; align-items: flex-start }
  .screen.wide { flex-direction: column } .screen .shot img { width: 100%; border-radius: ${th.imageRadius}px; border: 1px solid #E4E4E7; display: block }
  .screen.portrait .shot { width: 62mm; flex: none } .screen.portrait .txt { flex: 1; padding-top: 4mm } .screen.wide .shot { width: 100% }
  ${th.customCss}
  </style></head><body>
  <div class="cover"><div class="tag">${esc(st.label)}${o.project ? ` · ${esc(o.project)}` : ''}</div><div><h1>${esc(doc.title)}</h1><div class="sub">${esc(doc.subtitle)}</div></div><div class="meta">${esc(new Date().toLocaleDateString('pt-BR'))}</div></div>
  <div class="page">
    ${th.showIntro && doc.intro ? `<section class="block"><h2>Apresentação</h2>${para(doc.intro)}</section>` : ''}
    ${screens ? `<h2>O produto, tela a tela</h2>${screens}` : ''}
    ${sections}
    ${doc.closing ? `<section class="block">${para(doc.closing)}</section>` : ''}
  </div></body></html>`;
}
