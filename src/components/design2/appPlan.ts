import { extractJson } from './aiScreenFromLlm';
import { tokensPromptBlock, type DesignTokens } from './designTokens';

export interface PlannedScreen { name: string; brief: string }
export interface AppPlan { width: number; height: number; style: string; screens: PlannedScreen[] }

/** O pedido parece pedir várias telas (fluxo, app completo, "5 telas"...)? Só então vale gastar uma chamada de planejamento. */
export function looksMultiScreen(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (/\b(sequ[eê]ncia de telas|etapas|fluxo|jornada|app completo|aplicativo completo|sistema completo|todas as telas|todas telas|v[aá]rias telas|telas do app|telas do aplicativo|principais telas|conjunto de telas)\b/.test(p)) return true;
  const n = /\b(\d{1,2}|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+telas\b/.exec(p);
  if (n) return !/^(1|um|uma)$/.test(n[1]);
  return /\btelas\b/.test(p) && /\b(login|cadastro|home|perfil|configura)/.test(p) && / e |, /.test(p);
}

export function buildPlanPrompt(prompt: string, projectContext?: string, referenceSpec?: string, tokens?: DesignTokens | null): string {
  return `Você é um designer de produto sênior planejando as telas de um app. Responda SOMENTE com JSON válido minificado (sem markdown), em português do Brasil.

PEDIDO: ${prompt}
${projectContext ? `CONTEXTO DO PROJETO: ${projectContext.slice(0, 1800)}\n` : ''}${referenceSpec ? `REFERÊNCIA VISUAL (vale para todas as telas): ${referenceSpec.slice(0, 1500)}\n` : ''}${tokens ? tokensPromptBlock(tokens) + 'O design system compartilhado ("style") DEVE ser exatamente estes tokens.\n' : ''}
Liste as telas necessárias para cobrir a jornada completa (siga o número pedido; se não houver, entre 4 e 8) e defina UM design system compartilhado que todas vão seguir.
FORMATO:
{"width":393,"height":852,"style":"paleta em hex (fundo, superfícies, primária, acento, texto, texto secundário), fonte e escala de tamanhos, raios de borda, estilo de cards/botões/campos/ícones, efeitos (vidro, degradê, sombras), e a navegação: cabeçalho e barra inferior com os itens exatos","screens":[{"name":"nome curto","brief":"o que a tela mostra, em uma frase, com os blocos principais"}]}
width/height: 393x852 para mobile, 1440x900 para desktop/web.`;
}

export function parsePlan(raw: string, max = 12): AppPlan | null {
  const d = extractJson(raw);
  if (!d || !Array.isArray(d.screens)) return null;
  const screens = d.screens
    .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
    .slice(0, max)
    .map((s: any) => ({ name: String(s.name).trim().slice(0, 40), brief: String(s.brief ?? '').trim().slice(0, 300) }));
  if (!screens.length) return null;
  const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? Math.round(v) : def);
  return { width: num(d.width, 393, 200, 3000), height: num(d.height, 852, 200, 3000), style: typeof d.style === 'string' ? d.style.slice(0, 1500) : '', screens };
}

/** Pedido de UMA tela do plano: as demais ficam listadas só para a IA manter coerência de nomes e navegação. */
export function screenPrompt(basePrompt: string, plan: AppPlan, index: number): string {
  const s = plan.screens[index];
  const others = plan.screens.map((x, i) => `${i + 1}. ${x.name}`).join(' | ');
  return `${basePrompt}

TELA ${index + 1} DE ${plan.screens.length}: "${s.name}" — ${s.brief}
Gere APENAS esta tela (UMA única tela de ${plan.width}x${plan.height} px; escreva exatamente esse width/height e o nome "${s.name}").
Todas as telas do app: ${others}.
DESIGN SYSTEM COMPARTILHADO (obrigatório, igual em todas as telas): ${plan.style || 'mantenha um visual coerente'}`;
}
