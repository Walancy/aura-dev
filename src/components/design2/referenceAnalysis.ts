import { requestAiScreenRaw } from './aiScreenFromLlm';

/**
 * Etapa 1 do uso de imagens de referência: uma chamada só para OLHAR as imagens e descrever a interface
 * (estrutura, componentes, estilo). A geração recebe esse texto como regra obrigatória em vez de depender de a IA
 * abrir o arquivo no meio de um prompt enorme (onde a imagem era ignorada).
 */
export function buildReferenceAnalysisPrompt(paths: string[]): string {
  return `Você é um designer de produto sênior. Abra TODAS as imagens abaixo (arquivos locais) e escreva uma ESPECIFICAÇÃO VISUAL precisa para recriar a MESMA interface com FIDELIDADE MÁXIMA (cada elemento visível, na posição e no tamanho em que está). Não responda JSON; responda em texto curto e denso, em português, com no máximo 10000 caracteres, usando exatamente estas seções:

FORMATO: dispositivo, orientação e proporção.
TEMA: cores aproximadas em hex (fundo, superfícies/cards, primária, acento, texto, texto secundário, bordas).
TIPOGRAFIA (EXATA): família parecida e, para cada nível (título grande, título de seção, subtítulo, corpo, rótulos, legendas, botões, chips): tamanho em px (estime pela altura do texto relativa à tela de ~393px de largura), peso (100–900), espaçamento entre letras (px, negativo em títulos grandes?), entrelinha e caixa (maiúsculas?), cor com alfa.
FUNDO (OBRIGATÓRIO, região por região): cor aproximada em hex do topo, do centro, da base, dos lados e dos cantos; brilhos/halos (onde, cor, tamanho relativo, alfa); escurecimentos (vinhetas) e se o fundo é uma foto/ilustração/render ou apenas degradês. Nunca resuma como "escuro" se houver cor.
ALINHAMENTO E POSIÇÃO: para cada texto/componente: alinhado à esquerda, centro ou direita; posição vertical em % da altura da tela; tamanho em % da largura da tela (ex.: esfera ~55% da largura).
FORMAS: raios de borda (px), bordas (cor com alfa), elevação.
ESTILOS ESPECIAIS (quantifique cada um que existir): FUNDO da tela (cor sólida? degradê linear/radial: tipo, paradas em hex com alfa e posição %, ângulo ou centro/raio do brilho; manchas de luz/halos; granulado/ruído e intensidade); VIDRO/glassmorphism (cor de preenchimento com alfa, blur em px, borda com alfa, quais componentes); SOMBRAS (x, y, blur, spread, cor com alfa; sombras internas); NEOMORFISMO (luz clara e sombra escura: offsets, blur, cores); degradês em cards/botões/overlays (ex.: escurecimento na base de uma foto: de que cor/alfa até qual); transparências e blur de camada.
ÁRVORE DE LAYOUT (OBRIGATÓRIO — espaçamentos e bordas só onde EXISTEM): para cada container/seção, de fora para dentro, uma linha: nome | direção dos filhos (vertical, horizontal, grade, sobreposto) | GAP ENTRE OS FILHOS em px (0 se estão ENCOSTADOS; diga se são separados só por uma linha divisória de 1px ou por nada) | PADDING INTERNO em px (topo/lados/base) | tem fundo próprio? | tem borda (cor, px)? | raio em px (0 = canto reto). Diferencie com atenção: (a) cards SEPARADOS por espaço (com raio e borda), (b) seções COLADAS umas nas outras separadas por linha fina e SEM raio nem borda própria (ex.: painel lateral com seções empilhadas, cabeçalhos de tabela, células de calendário), (c) blocos colados sem linha. COMO DECIDIR O GAP: olhe a faixa entre dois blocos vizinhos. Se existe uma faixa visível da cor do FUNDO GERAL da tela (mais escura/clara que os blocos) → há gap (meça a faixa em px). Se os dois blocos têm a MESMA cor de fundo e entre eles há só uma linha fina (ou nada) → gap 0 e são seções de UM mesmo painel (sem raio nem borda individual; o painel é que tem raio/borda, se tiver). Painéis laterais e cabeçalhos de calendário/tabela costumam ser seções coladas; grades de cards de métricas costumam ter gap. Confira de novo cada gap antes de escrever. Conteúdo com padding dentro de um bloco encostado é comum: registre o padding do conteúdo e gap 0 do bloco.
CONTAINERS (OBRIGATÓRIO, olhe com atenção às cores): para CADA card, painel, barra, campo de entrada, chip ou botão: o fundo REAL — cor sólida? degradê (tipo, cores inicial/final em hex, direção)? manchas/halos de cor pastel nos cantos ou no topo (cor, posição, tamanho)? vidro? branco puro vs. cinza muito claro? —, a borda (cor, espessura, se tem brilho/degradê/tracejada), a sombra (y, blur, cor, alfa) e o raio. Não troque um fundo claro com halos pastel por um fundo escuro nem o contrário. Texto com degradê de cor: cores inicial e final.
GRÁFICOS (se houver): para cada um: tipo (linha, área, barras, rosca), caixa em %, número de pontos/barras, valores RELATIVOS de cada ponto de 0 a 100 na ordem (descreva a forma: sobe, cai, pico no 5º ponto…), rótulos dos eixos, cor da linha/barras, trilho de fundo (cor), grade (quantas linhas), ponto destacado com marcador e etiqueta (texto), valores escritos dentro/acima das barras.
DIVISÓRIAS: liste TODAS as linhas finas (entre itens, seções, colunas e linhas de calendário/tabela/grade): orientação, posição em %, espessura, cor com alfa.
SOBREPOSTOS (elementos que cobrem parte de outro: badges de contagem, pontos de notificação, botões flutuantes, selos): para cada um, o elemento que ele cobre, o canto (cima-direita…), quanto sai para fora do canto (px) e o tamanho/cor/texto. Eles NÃO ocupam espaço no fluxo do componente.
MICROCOMPONENTES: ícones dentro de chips/quadrados (cor e forma do chip), badges de contagem sobre ícones (valor, cor), pilhas de avatares (quantidade, sobreposição), pontos de status, controles segmentados, barras de progresso, logos de marcas (qual marca, cor), campos com ícones, botões fantasma vs preenchidos, ícones de seta/chevron.
INVENTÁRIO (OBRIGATÓRIO e o mais importante: UMA LINHA por elemento visível, de cima para baixo, NADA omitido — texto, ícone, botão, chip, avatar, divisória, imagem, forma decorativa). Indente com "  " (2 espaços por nível) para mostrar o que está DENTRO de cada container (ex.: o campo "Ask AI" dentro do card de resumo fica indentado sob ele). Formato: tipo | TEXTO LITERAL entre aspas (copie exatamente como está na imagem; para ícone, o significado) | caixa em % da tela: x,y,largura,altura | preenchimento hex (+alfa) | borda (cor, px) | raio (px na escala de 393px de largura) | fonte: px/peso/cor/alinhamento. Elementos repetidos (itens de lista, cards, avatares) são listados um a um com a mesma quantidade da imagem.
BLOCOS (de cima para baixo, um por linha, na ordem exata em que aparecem): tipo do componente | posição e tamanho relativo (ex.: "largura total, ~56px de altura") | estrutura interna (o que há dentro, alinhamento, ícones) | estilo.
Inclua TUDO que aparece: barra de status, cabeçalho (saudação, avatar), busca/filtros, chips/abas, títulos de seção, cards (com foto? texto sobre a foto? botões dentro?), carrosséis (cards vizinhos aparecendo nas laterais?), botões, navegação inferior (fixa ou flutuante? formato? item ativo como é destacado?).
COMPOSIÇÃO: margens laterais, espaçamento entre blocos, alinhamentos, o que é sobreposto a quê, o que é rolagem horizontal.
CONTEÚDO: registre os textos LITERAIS da imagem (no inventário). Quem for gerar a tela decide se mantém ou troca o conteúdo; a estrutura, as posições, as proporções e o estilo são sempre os da imagem.

Imagens:
${paths.map((p) => `- ${p}`).join('\n')}`;
}

const cache = new Map<string, string>();

/** Especificação visual das imagens (cacheada por caminho: regerar não analisa de novo). Lança erro se a IA falhar. */
export async function analyzeReferenceImages(paths: string[], provider: string | undefined, model: string | undefined, cwd: string | undefined, additionalDirs: string[]): Promise<string> {
  const key = paths.join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const raw = await requestAiScreenRaw(buildReferenceAnalysisPrompt(paths), provider, model, cwd, 240000, undefined, additionalDirs);
  const spec = raw.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim().slice(0, 11000);
  if (spec.length < 80) throw new Error('A IA não conseguiu analisar as imagens de referência');
  cache.set(key, spec);
  return spec;
}
