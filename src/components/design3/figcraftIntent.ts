import { requestAiScreenRaw, extractJson } from '../design2/aiScreenFromLlm';
import { wantsNewScreens } from '../design2/screenFlow';

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pedido que mexe no que já existe nas telas selecionadas (não cria telas). */
function looksLikeEdit(p: string): boolean {
  return /\b(alter(e|ar)|mud(e|ar)|troc(ar|ue|a)|ajust(e|ar)|corrij(a|ir)|mov(a|er)|remov(a|er)|apag(ue|ar)|delet(e|ar)|aument(e|ar)|diminu(a|ir)|deix(e|ar)|renome(ie|ar)|centraliz(e|ar)|alinh(e|ar)|arredond(e|ar)|reduz(a|ir)|ampli(e|ar)|melhor(e|ar)|refin(e|ar)|substitu(a|ir)|inclu(a|ir)|esconda|mostre|oculte|pint(e|ar)|colori(r|a))\b/.test(p)
    || /\b(adicion(e|ar)|coloc(ar|ue)|inser(ir|a))\s+(um|uma|o|a|os|as|mais)\s+(?!tela|telas|pagina|paginas)/.test(p)
    || /\b(mais|menos|maior|menor)\s+(escur|clar|espac|arredond|vibrante|suave|contrast|compact|grande|pequen)/.test(p)
    || /\b(na|nesta|nessa|da|desta|dessa)\s+tela\b/.test(p);
}

/** Pedido com a imagem/tela de referência pedindo cópia fiel. */
function looksLikeReplicate(p: string): boolean {
  return /\b(exatamente|identic[oa]s?|fiel(mente)?|replic(a|ar|que|e)|copi(e|ar|a)|clon(e|ar)|reproduz(a|ir)|recri(e|ar)|pixel|1:1|igualzinh[oa]|mesm[oa]s? (tela|design|layout|visual)|como (esta|na|a) (imagem|referencia|tela))\b/.test(p);
}

/** Pedido que usa a referência só como inspiração de design (outro assunto/tela). */
function looksLikeStyle(p: string): boolean {
  return /\b(no estilo|no mesmo estilo|estilo d(a|e|o)|com base (n(a|o)|no design|na referencia)|basead[oa]|inspirad[oa]|inspira(cao|r)|seguindo (o|a) (design|estilo|padrao|identidade|visual|linguagem)|mesm[oa] (padrao|identidade|linguagem|estilo|paleta)|mesma cara|parecid[oa]|similar|referencia de (design|estilo|visual)|use (a|o) (referencia|imagem|design)|mesma vibe|no padrao)\b/.test(p);
}

async function askJson(prompt: string, o: { provider: string; model?: string }): Promise<any | null> {
  try {
    const raw = await requestAiScreenRaw(prompt, o.provider, o.model, '/tmp', 45000);
    return extractJson(raw);
  } catch {
    return null;
  }
}

/**
 * Com telas selecionadas: o pedido é criar OUTRAS telas tendo a selecionada como referência de design ("new"), ou mexer
 * nas telas selecionadas ("edit")? Regras primeiro; na dúvida, uma chamada rápida à IA; sem resposta, a heurística antiga.
 */
export async function selectionIntent(prompt: string, screens: string[], o: { provider: string; model?: string; onProgress?: (m: string) => void }): Promise<'new' | 'edit'> {
  const p = norm(prompt);
  const create = wantsNewScreens(prompt);
  const edit = looksLikeEdit(p);
  if (create && !edit) return 'new';
  if (edit && !create) return 'edit';
  o.onProgress?.('Entendendo o pedido: criar novas telas a partir da selecionada ou alterar a seleção…');
  const j = await askJson(
    `Um designer selecionou ${screens.length} tela(s) no canvas (${screens.slice(0, 6).join(', ') || 'sem nome'}) e enviou o pedido abaixo. Decida a intenção. Responda SOMENTE JSON: {"intent":"new"|"edit","reason":"<frase curta>"}.
- "new": o pedido é CRIAR outras telas/páginas/estados (um fluxo, uma tela de outra função, novas telas do mesmo app); a tela selecionada serve de referência de design (paleta, tipografia, componentes, estilo) e NÃO deve ser modificada.
- "edit": o pedido é ALTERAR algo nas telas selecionadas (cores, textos, componentes, layout, adicionar/remover elementos nelas).
Na dúvida entre "criar uma tela de X" e "mudar a tela": se o pedido nomeia uma função/tela diferente da selecionada, é "new".

PEDIDO: ${prompt}`,
    o
  );
  if (j?.intent === 'new' || j?.intent === 'edit') return j.intent;
  return create ? 'new' : 'edit';
}

/**
 * Com imagem de referência anexada: o usuário quer a MESMA tela ("replicate": cópia fiel de estrutura, conteúdo e estilo) ou uma tela
 * nova com o design da referência ("style": mesma identidade visual, assunto e estrutura do pedido)?
 */
export async function referenceIntent(prompt: string, o: { provider: string; model?: string; onProgress?: (m: string) => void }): Promise<'replicate' | 'style'> {
  const p = norm(prompt).trim();
  if (p.length < 4) return 'replicate'; // só a imagem
  const rep = looksLikeReplicate(p);
  const sty = looksLikeStyle(p);
  if (rep && !sty) return 'replicate';
  if (sty && !rep) return 'style';
  o.onProgress?.('Entendendo o pedido: replicar a referência ou criar uma tela nova no design dela…');
  const j = await askJson(
    `O usuário anexou imagem(ns) de referência de interface e enviou o pedido abaixo. Decida. Responda SOMENTE JSON: {"intent":"replicate"|"style","reason":"<frase curta>"}.
- "replicate": quer RECRIAR a tela/telas da imagem o mais fiel possível (mesma estrutura, mesmos elementos, mesmo conteúdo).
- "style": quer uma tela NOVA (outro assunto, outra função ou estrutura própria) usando a imagem só como referência de design (paleta, tipografia, componentes, estilo, clima visual).
Pedido que descreve um assunto/tela diferente do que aparece na imagem ("crie uma tela de pagamento para um app de pets") é "style". Pedido genérico como "crie essa tela", "faça igual" ou "como na imagem" é "replicate".

PEDIDO: ${prompt}`,
    o
  );
  if (j?.intent === 'replicate' || j?.intent === 'style') return j.intent;
  return 'replicate';
}
