import { extractJson } from './aiScreenFromLlm';
import { tokensPromptBlock, type DesignTokens } from './designTokens';

export interface PlannedScreen { name: string; brief: string; /** a tela mostra a barra de navegação inferior do app? */ nav?: boolean }

/** Telas de entrada ou em tela cheia (login, cadastro, splash, onboarding, recuperar senha, verificação): não têm barra de navegação. */
export const isEntryScreen = (name: string): boolean => /\b(login|log in|entrar|acesso|cadastro|registr\w*|criar conta|splash|abertura|boas[- ]vindas|bem[- ]vind\w*|onboarding|introdu\w*|recuper\w*|esqueci|redefin\w*|senha|verifica\w*|c[oó]digo|otp|sign ?(in|up)|welcome)\b/i.test(name);
export interface AppPlan { width: number; height: number; style: string; /** o que é o app (assunto, público, objetivo): contexto de todas as telas */ app: string; screens: PlannedScreen[] }
/** Tela que já existe no canvas: nome e um resumo do que ela mostra (textos principais). */
export interface ExistingScreen { name: string; summary: string }

/** O pedido parece pedir várias telas (fluxo, app completo, "5 telas"...)? Só então vale gastar uma chamada de planejamento. */
export function looksMultiScreen(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (/\b(sequ[eê]ncia de telas|etapas|fluxo|jornada|app completo|aplicativo completo|sistema completo|todas as telas|todas telas|v[aá]rias telas|telas do app|telas do aplicativo|principais telas|conjunto de telas|(restante|resto|demais|outras) (d?as )?telas|telas (restantes|que faltam))\b/.test(p)) return true;
  const n = /\b(\d{1,2}|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+telas\b/.exec(p);
  if (n) return !/^(1|um|uma)$/.test(n[1]);
  return /\btelas\b/.test(p) && /\b(login|cadastro|home|perfil|configura)/.test(p) && / e |, /.test(p);
}

export function buildPlanPrompt(prompt: string, projectContext?: string, referenceSpec?: string, tokens?: DesignTokens | null, prd?: string, existing?: ExistingScreen[]): string {
  const have = existing?.length ? `TELAS QUE JÁ EXISTEM NO CANVAS (são parte deste app; NÃO as recrie nem as liste no plano — planeje só as telas que FALTAM, do MESMO app, com o mesmo assunto, vocabulário e estilo delas):\n${existing.map((e) => `- "${e.name}": ${e.summary}`).join('\n')}\n` : '';
  return `Você é um designer de produto sênior planejando as telas de um app. Responda SOMENTE com JSON válido minificado (sem markdown), em português do Brasil.

PEDIDO: ${prompt}
${projectContext ? `CONTEXTO DO PROJETO (se o pedido não disser de que app se trata — "o app", "o restante das telas" —, o assunto é ESTE projeto: use o domínio, os módulos, as entidades e o vocabulário dele nas telas): ${projectContext.slice(0, 4000)}\n` : ''}${referenceSpec ? `REFERÊNCIA VISUAL (vale para todas as telas): ${referenceSpec.slice(0, 1500)}\n` : ''}${tokens ? tokensPromptBlock(tokens) + 'O design system compartilhado ("style") DEVE ser exatamente estes tokens.\n' : ''}
${have}${prd ? `PRD DO PROJETO (fonte de verdade: telas, funcionalidades, perfis de usuário, fluxos e regras):\n${prd.slice(0, 16000)}\n\n` : ''}Liste as telas necessárias para cobrir ${prd ? 'TODAS as funcionalidades e fluxos do PRD (uma tela por função ou estado relevante, até 16 telas, na ordem da jornada; o "brief" de cada uma cita os dados, campos e ações do PRD que ela mostra)' : 'a jornada completa (siga o número pedido; se não houver, entre 4 e 8)'} e defina UM design system compartilhado que todas vão seguir.
REGRAS: 1) Se o pedido descreve uma tela específica e pede "o restante" das telas, a PRIMEIRA tela do plano é exatamente a descrita (o "brief" reproduz todos os detalhes que o usuário deu) e as seguintes completam o app; ${existing?.length ? 'com telas já existentes, o plano tem só as telas NOVAS (nenhuma repete uma existente). ' : ''}2) Nunca repita nem duplique uma tela: cada tela do plano tem função e conteúdo próprios. 3) Todas as telas pertencem ao MESMO app: deduza o assunto, o público e o vocabulário do pedido${existing?.length ? ', das telas existentes' : ''}${projectContext ? ' e do contexto do projeto' : ''} e use-os nos nomes e nos briefs (dados, textos e ações específicos do app, nada genérico).
FORMATO:
{"app":"o que é o app: nome/assunto, público e objetivo, em 1 ou 2 frases","width":393,"height":852,"style":"paleta em hex (fundo, superfícies, primária, acento, texto, texto secundário), fonte e escala de tamanhos, raios de borda, estilo de cards/botões/campos/ícones, efeitos (vidro, degradê, sombras), e a navegação das telas PRINCIPAIS (cabeçalho e barra inferior com os itens exatos; telas de login, cadastro, recuperar senha, splash, onboarding e fluxos em tela cheia NÃO têm barra de navegação), proporções (botão primário 48–56px de altura, campos 48–56, ícones 20–24)","screens":[{"name":"nome curto","brief":"o que a tela mostra, em uma frase, com os blocos principais","nav":true}]}
"nav": a tela mostra a barra de navegação inferior do app? (false em login, cadastro, splash, onboarding, recuperar senha e telas em tela cheia; true nas telas principais)
width/height: 393x852 para mobile, 1440x900 para desktop/web.`;
}

export function parsePlan(raw: string, max = 12): AppPlan | null {
  const d = extractJson(raw);
  if (!d || !Array.isArray(d.screens)) return null;
  const screens = d.screens
    .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
    .slice(0, max)
    .map((s: any) => {
      const name = String(s.name).trim().slice(0, 40);
      return { name, brief: String(s.brief ?? '').trim().slice(0, 300), nav: isEntryScreen(name) ? false : typeof s.nav === 'boolean' ? s.nav : undefined };
    });
  if (!screens.length) return null;
  const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? Math.round(v) : def);
  return { width: num(d.width, 393, 200, 3000), height: num(d.height, 852, 200, 3000), style: typeof d.style === 'string' ? d.style.slice(0, 1500) : '', app: typeof d.app === 'string' ? d.app.slice(0, 400) : '', screens };
}

/**
 * Pedido de UMA tela do plano. O pedido original do usuário vira só contexto do app (senão cada chamada o refaria inteiro e todas
 * as telas sairiam iguais à primeira); as demais telas ficam listadas para manter coerência de nomes e navegação.
 */
export function screenPrompt(basePrompt: string, plan: AppPlan, index: number, ctx?: { request?: string; existing?: ExistingScreen[] }): string {
  const s = plan.screens[index];
  const others = plan.screens.map((x, i) => `${i + 1}. ${x.name}`).join(' | ');
  const req = ctx?.request?.trim();
  const rest = req && basePrompt.startsWith(req) ? basePrompt.slice(req.length).trim() : basePrompt;
  const have = ctx?.existing?.length
    ? `\nTELAS JÁ EXISTENTES no canvas (${ctx.existing.map((e) => `"${e.name}"`).join(', ')}): as imagens anexadas mostram essas telas e servem SÓ de guia de estilo (cores, tipografia, componentes, navegação). NÃO recrie nem copie nenhuma delas, nem o conteúdo delas: "${s.name}" é uma tela NOVA e diferente.\n`
    : '';
  return `${plan.app ? `APP: ${plan.app}\n` : ''}${req ? `PEDIDO ORIGINAL DO USUÁRIO (só contexto geral do app: cada chamada gera UMA tela diferente; NÃO reproduza o pedido inteiro nesta tela): "${req.slice(0, 600)}"\n` : ''}${rest}
${have}
TELA ${index + 1} DE ${plan.screens.length}: "${s.name}" — ${s.brief}
${s.nav === false ? `Barra de navegação inferior: NÃO — esta tela não tem navbar/tab bar nem o menu principal do app (só o que ela precisa: ${isEntryScreen(s.name) ? 'logo, título, campos, botão e links' : 'o conteúdo dela'}).\n` : s.nav === true ? 'Barra de navegação inferior: SIM, a mesma das outras telas principais.\n' : ''}Gere APENAS esta tela (UMA única tela de ${plan.width}x${plan.height} px; escreva exatamente esse width/height e o nome "${s.name}"), com o conteúdo que o resumo dela descreve, e que seja DIFERENTE das demais telas do app: ${others}.
DESIGN SYSTEM COMPARTILHADO (obrigatório, igual em todas as telas): ${plan.style || 'mantenha um visual coerente'}`;
}
