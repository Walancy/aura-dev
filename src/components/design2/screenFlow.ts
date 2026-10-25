/** Marca (dentro do prompt) de que as imagens/telas anexadas são telas JÁ EXISTENTES do sistema: servem de guia de estilo, não de cópia. */
export const STYLE_MODE_MARK = '[MODO REFERÊNCIA: ESTILO]';

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Com uma tela selecionada, o pedido é CRIAR outras telas (do mesmo sistema/app, uma sequência para uma função…) em vez de
 * editar a selecionada? "crie as outras telas", "faça o fluxo de pagamento", "gere 4 telas…", "a partir desta tela crie…".
 * "adicione um botão na tela" ou "mude a tela" continuam sendo edição.
 */
export function wantsNewScreens(prompt: string): boolean {
  const p = norm(prompt);
  // referência direta ao conjunto de telas novas
  if (/\b(outras?|novas?|demais|restantes?|proximas?|seguintes?|mais)\s+(\d+\s+)?(telas?|paginas?)\b/.test(p)) return true;
  if (/\b(restante|resto|demais|outras|outros)\b[^.]{0,40}\b(telas?|paginas?|ecras?)\b/.test(p)) return true;
  if (/\b(sequencia|fluxo|jornada|passo a passo|etapas)\b.*\b(telas?|paginas?)\b|\b(telas?|paginas?)\b.*\b(sequencia|fluxo|jornada|passo a passo|etapas)\b/.test(p)) return true;
  if (/\b(cri(e|ar)|ger(e|ar)|mont(e|ar)|faca|fazer|desenh(e|ar)|prototip(e|ar))\b[^.]*\b(\d+|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|varias|todas as|as)\s+(telas?|paginas?)\b/.test(p)) return true;
  if (/\b(a partir d(esta|essa|a)|com base n(esta|essa|a)|baseado n(esta|essa|a)|seguindo (esta|essa|a)|igual (a|ao) d(esta|essa|a)|no (mesmo )?(padrao|estilo) d(esta|essa|a))\s+tela\b/.test(p) && /\b(cri(e|ar)|ger(e|ar)|mont(e|ar)|faca|fazer|desenh(e|ar))\b/.test(p)) return true;
  if (/\b(cri(e|ar)|ger(e|ar)|mont(e|ar)|faca|fazer|desenh(e|ar)|prototip(e|ar))\s+(o\s+|um\s+|uma\s+|os\s+)?(fluxo|sequencia|jornada|passo a passo)\b/.test(p)) return true;
  // "crie uma tela de X" / "nova tela de X" (e não "na tela", "nesta tela", "da tela")
  if (/\b(cri(e|ar)|ger(e|ar)|mont(e|ar)|faca|fazer|desenh(e|ar)|adicion(e|ar))\s+(uma\s+|a\s+)?(nova\s+)?(tela|pagina)\s+(de|para|do|da|com)\b/.test(p)) return true;
  return false;
}
