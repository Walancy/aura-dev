import type { FillItem, Shape } from './types';
import { COMMON_ICON_NAMES, iconShape, resolveIconName, type IconCatalog } from './icons';
import { fitText } from './textFit';
import { buildDevice, MOBILE_SAFE } from './devices';
import { referenceHints } from './designReferences';
import { directionBlock, inspirationBlock } from './designDirections';
import { relayoutAll } from './autoLayout';
import { parseColorAlpha, snapDimension, snapIconSize, snapSpacing, styleFromItem, textStyleFromItem, effectsFromItem } from './aiStyle';
import { applyDeltas } from './align';
import { assetsPromptBlock, type ProjectAsset } from './projectAssets';
import { STYLE_MODE_MARK } from './screenFlow';
import { buildChartShapes, normalizeChartSpec, type ChartSpec } from './charts';
import { snapColorToTokens, snapRadiusToTokens, snapSpaceToTokens, snapTypeToTokens, tokensPromptBlock, type DesignTokens } from './designTokens';
import { descendantIds } from './constraints';

/** Entrada para pedir uma tela à IA e converter a resposta em shapes do canvas. */
export interface AiScreenRequest {
  prompt: string;
  pageId: string;
  startX: number;
  startY: number;
  accentColor: string;
  isDark: boolean;
  targetFrame?: Shape | null;
  projectContext?: string;
  /** Catálogo de ícones Material (para itens type:"icon") */
  icons?: IconCatalog;
  /** O agente pode ler arquivos do projeto (cwd) para entender o contexto */
  canReadProject?: boolean;
  /** Caminhos locais de imagens de referência anexadas pelo usuário */
  referenceImages?: string[];
  /** Especificação visual extraída das imagens de referência (etapa de análise): regra obrigatória */
  referenceSpec?: string;
  /** Imagens da biblioteca local usadas só como INSPIRAÇÃO (não são copiadas) */
  inspirationImages?: string[];
  /** false = ignora o projeto da header: a IA usa só o pedido (e as imagens) */
  useProjectContext?: boolean;
  /** Design tokens do projeto (se definidos, a IA deve segui-los) */
  tokens?: DesignTokens | null;
  /** Logos e ícones do projeto que a IA pode usar (só com o contexto do projeto ligado) */
  projectAssets?: ProjectAsset[];
  /** 1 = a chamada gera UMA tela (o pedido já indica qual): sem o formato de várias telas */
  maxScreens?: number;
}

const MAX_SHAPES = 450;
const ALLOWED = new Set(['rect', 'ellipse', 'text', 'line', 'icon', 'image', 'frame']);
const MAX_SCREENS = 12;
const SCREEN_GAP = 120;

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Bloco do prompt para imagens anexadas (as CLIs abrem os arquivos pelo caminho). */
export function referenceBlock(paths?: string[], spec?: string, styleMode = false): string {
  const files = paths?.length ? `\nAs IMAGENS ORIGINAIS também estão disponíveis (abra CADA uma, UMA única vez, no início, para conferir cores, proporções e detalhes; depois responda direto com o JSON, sem explorar mais nada):\n${paths.map((p) => `- ${p}`).join('\n')}\n` : '';
  const fidelity = `FIDELIDADE MÁXIMA À REFERÊNCIA (regra acima de todas as outras): reproduza a imagem 1:1 — MESMOS elementos, na MESMA ordem, nas MESMAS posições e proporções (caixa em % × tamanho da tela), com as MESMAS cores (hex), raios, bordas, sombras, tipografia (tamanho/peso/alinhamento), ícones e espaçamentos. NÃO adicione, remova, simplifique, reordene nem "melhore" nada; não invente seções que a imagem não tem; não troque o estilo pela sua preferência nem pelos exemplos deste prompt. Formato/tamanho da tela = o da imagem. TEXTOS: copie os textos literais da imagem, NO MESMO IDIOMA e com a mesma pontuação/caixa (NÃO traduza: traduzir muda a largura e quebra o layout; nunca misture idiomas) a menos que o PEDIDO diga claramente outro assunto/conteúdo ou outro idioma — nesse caso troque só as palavras, mantendo o mesmo número de itens, o mesmo comprimento e a mesma hierarquia. Se o texto do PEDIDO for só contexto solto (logs, erros, anotações), a imagem manda. Itens repetidos (listas, cards, abas) mantêm a MESMA quantidade da imagem. PEDIDO × REFERÊNCIA: o PEDIDO diz O QUE gerar; a REFERÊNCIA diz COMO (todas as características: estrutura, proporções, espaçamentos, bordas, raios, cores, tipografia, componentes). Aplique TODAS as características ao que foi pedido. GAP, BORDA E RAIO SÓ ONDE EXISTEM (leia a ÁRVORE DE LAYOUT da análise): blocos que na referência estão ENCOSTADOS levam \"gap\":0 no frame pai (nunca espaço entre eles), com uma divisória de 1px entre eles quando a referência tem linha, SEM cornerRadius e SEM borda própria; só dê cornerRadius/borda a quem tem na referência; o conteúdo interno de cada bloco mantém o padding medido (um bloco colado pode ter padding interno de 16–20). Cards separados por espaço usam o gap medido. GAPS E ESPAÇAMENTOS: calcule gap e padding pela DISTÂNCIA entre as caixas do inventário (px = % × tamanho da tela, arredondado para múltiplo de 4) e use o mesmo valor para elementos equivalentes; tamanhos de cards, botões e ícones também saem das caixas — não use valores padrão. CONSTRUÇÃO SEM BUGS (referências densas como dashboards): cada card/painel é UM frame vertical (ou horizontal) com padding, e TUDO o que está visualmente dentro dele é filho dele (botões de ação do card, rótulos, números) — nada solto na raiz nem posicionado por x/y dentro de frame com layout; linha de título com ação = frame horizontal [título "fill"][ação "hug"]; rótulos, botões e valores curtos ("Ver tudo", "Inscrever Treinador", "Week") usam "hug" e NUNCA quebram linha (se faltar espaço, dê mais largura ao irmão "fill", não encolha o botão); agendas/calendários = colunas de largura "fill" com os eventos como frames dentro da coluna do dia (hug, largura da coluna) — nunca eventos soltos por cima; áreas grandes vazias na imagem continuam vazias na mesma proporção. HIERARQUIA: respeite o que está dentro de cada container (linhas indentadas do inventário = filhos; crie o frame pai e coloque os filhos nele com \"parent\"). FUNDOS: copie o tipo de fundo de cada container (sólido, degradê, halos pastel, vidro) — nunca troque claro por escuro nem simplifique um degradê para cor chapada; para halos use ellipse com degradê radial e blur atrás do conteúdo do card (card com \"clip\":true).
`;
  if (styleMode && (spec || paths?.length)) {
    const tail = fidelity.slice(fidelity.indexOf('GAPS E ESPAÇAMENTOS') >= 0 ? fidelity.indexOf('GAP, BORDA E RAIO SÓ ONDE EXISTEM') : 0);
    return `GUIA DE ESTILO = TELAS JÁ EXISTENTES DESTE SISTEMA/APP (imagem${(paths?.length || 0) > 1 ? 'ns' : ''} + análise abaixo). As telas NOVAS pedidas devem parecer do MESMO produto, como se o mesmo designer as tivesse feito: reaproveite 1:1 o SHELL (menu lateral/barra superior/navegação inferior/cabeçalho/rodapé, com os mesmos itens, ícones e textos fixos, no mesmo idioma), a paleta, a tipografia (família, tamanhos, pesos), os raios, bordas, sombras, espaçamentos, a densidade e os COMPONENTES (botões, campos, cards, tabelas, chips, abas, listas) exatamente como na referência. Só o CONTEÚDO da área principal muda, conforme o PEDIDO (outra função/tela), montado com os mesmos tipos de componente e a mesma hierarquia visual. Mesmo tamanho e formato de tela da referência. Textos, dados e rótulos novos no MESMO idioma da referência. O item ativo do menu/abas passa a ser o da nova função, se existir. NÃO copie o conteúdo da tela de exemplo; NÃO invente outro estilo nem outra paleta.
${tail}${spec ? spec + '\n' : ''}${paths?.length ? `\nAs imagens originais (abra CADA uma, UMA única vez, no início, para conferir o estilo; depois responda direto com o JSON):\n${paths.map((p) => `- ${p}`).join('\n')}\n` : ''}
`;
  }
  if (spec) {
    return `REFERÊNCIA VISUAL OBRIGATÓRIA (análise das imagens que o usuário anexou: siga cada linha do INVENTÁRIO e das demais seções; ela é a fonte da verdade da composição).
${fidelity}${spec}
${files}
`;
  }
  if (!paths?.length) return '';
  return `IMAGENS DE REFERÊNCIA ANEXADAS PELO USUÁRIO (arquivos locais; abra CADA imagem uma única vez, logo no início). TEMPO É CRÍTICO: depois de ver as imagens responda direto com o JSON — não explore o projeto nem use outras ferramentas.
${fidelity}${paths.map((p) => `- ${p}`).join('\n')}
`;
}

const GENERIC_WORDS = new Set(('crie cria criar gere gera gerar faca faça fazer monte montar desenhe desenhar quero preciso uma um uns umas o a os as de do da dos das no na nos nas em para por com sem e ou que ' +
  'tela telas pagina página paginas páginas app apps aplicativo aplicativos sistema sistemas site portal plataforma produto projeto ' +
  'inicial home principal primeira inicio início login cadastro dashboard painel listagem lista detalhe detalhes perfil configuracoes configurações menu navbar header rodape rodapé ' +
  'mobile celular desktop web responsivo responsiva moderno moderna bonito bonita simples limpo limpa clean escuro escura claro clara dark light lightmode darkmode mode modo ' +
  'nova novo novos novas outra outro mais tambem também isso esse essa este esta aqui ai aí ja já agora favor por-favor pf pfv fluxo fluxos ' +
  'exemplo imagem imagens anexo anexei anexada referencia referência seguindo siga igual exatamente mesma mesmo parecida parecido estilo layout').split(' '));

/** O pedido não diz sobre o que é o app/sistema (ex.: "crie a tela inicial do app"): o assunto é o próprio projeto. */
export function isVaguePrompt(prompt: string): boolean {
  const norm = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = norm((prompt || '').toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
  const generic = new Set([...GENERIC_WORDS].map(norm));
  const content = words.filter((w) => w.length > 2 && !generic.has(w) && !/^\d+$/.test(w));
  return content.length < 2;
}

/** Tokens obrigatórios; com imagem de referência juntos, os tokens mandam no estilo e a imagem só na estrutura. */
export function tokensBlockFor(req: { tokens?: DesignTokens | null; referenceImages?: string[]; referenceSpec?: string }): string {
  const b = tokensPromptBlock(req.tokens);
  if (!b) return '';
  return b + (req.referenceImages?.length || req.referenceSpec ? 'Com referência visual: use dela só a ESTRUTURA/composição; cores, fonte, escala, espaçamentos e raios vêm dos tokens acima.\n' : '') + '\n';
}


/** O pedido parece um erro/log colado (console, stack trace) em vez de uma descrição de tela? */
export function looksLikeErrorLog(prompt: string): boolean {
  return /(Error Type|Console Error|Runtime (Error|TypeError)|Encountered two children|Next\.js version|Uncaught |TypeError:|ReferenceError:|Warning: |\bat [\w$.<>]+ \(.*:\d+:\d+\))/i.test(prompt);
}

/** O pedido é para desktop/web (por palavras-chave ou pelo formato já detectado)? */
export function isDesktopRequest(prompt: string): boolean {
  return /Formato detectado: DESKTOP/.test(prompt) || !guessScreenFormat(prompt).mobile;
}

const DESKTOP_GUIDE = `DESKTOP / WEB — UX/UI PROFISSIONAL (obrigatório em telas desktop; nada de layout genérico de "cards soltos"):
- ESTRUTURA (app shell): raiz horizontal 1440x900 com 2 colunas: (1) SIDEBAR fixa à esquerda, width 248–264, altura "fill", fundo/superfície própria com borda direita 1px de baixa opacidade: logo + nome do produto no topo, grupos de navegação com título pequeno em caixa alta (11px, letterSpacing 0.8), itens com ícone 18–20 + rótulo, item ativo com pílula/fundo na cor primária suave e texto forte, ajuda/perfil do usuário (avatar + nome + papel) na base; (2) ÁREA PRINCIPAL vertical "fill": TOPBAR 64px (breadcrumb ou título da seção, busca global com atalho "⌘K", ícones de notificação/ajuda, avatar) + CONTEÚDO com padding 32 e largura máxima ~1200 centralizada.
- CABEÇALHO DA PÁGINA: título (28–32 / 700), descrição curta em cinza, à direita 1 ação PRIMÁRIA preenchida + 1 secundária contornada; abaixo, abas ou filtros (chips, busca, seletor de período). Só UMA ação primária por tela.
- GRADE E RITMO: 12 colunas, gutter 24, espaço entre seções 32, padding de card 20–24, tudo em múltiplos de 8; alinhamento rigoroso à esquerda; cards de uma mesma fileira com a MESMA altura e largura "fill".
- HIERARQUIA: um ponto focal por tela; números-chave grandes (32–40/700), rótulos pequenos em cinza (12–13), contraste de pesos (400 vs 600/700) em vez de muitos tamanhos; use 3–4 tamanhos de texto no total; cor de acento só para o que importa.
- PADRÕES DE CONTEÚDO REAIS (use dados plausíveis do domínio, nunca "Lorem ipsum" nem "Item 1"):
  • Dashboard: fileira de 4 KPIs (rótulo, valor grande, variação em chip verde/vermelho com seta, mini-barras de tendência); gráfico principal (barras ou linhas montadas com formas) ocupando ~2/3 com legenda e seletor de período, ao lado lista "Top N" com barras de progresso; tabela "Atividade recente".
  • Tabela de dados: cabeçalho com colunas em caixa alta cinza (11–12), linhas de 52–56px com divisórias finas, avatar+nome+e-mail na primeira coluna, chips de status (cor + ponto), valores alinhados à direita com números tabulares, ações por linha ("⋯"), seleção por checkbox, paginação e contagem no rodapé, barra de filtros/busca acima.
  • Detalhe: cabeçalho com avatar/título/status e ações; abas; duas colunas (principal ~2/3 com seções em cards; lateral ~1/3 com resumo, metadados e linha do tempo).
  • Configurações: sub-navegação vertical à esquerda (200–220) + formulário em seções com título, descrição e campos de altura 40, rótulo acima, ajuda abaixo; botão salvar fixo.
  • Login/cadastro: tela dividida 50/50 — painel de marca (degradê da cor primária, logo, frase de valor, depoimento/ilustração) + formulário centralizado (largura 380: título, campos, botão primário de largura total, login social, links).
  • Kanban: colunas de 300 com título + contagem, cartões com título, etiquetas, avatares e prazo; coluna "+ adicionar".
  • Landing/marketing: navegação 72px, herói com título 56–64/800 de 2 linhas, subtítulo 18–20 cinza, par de CTAs (primário + secundário), mock do produto abaixo com sombra suave, faixa de logos de clientes, 3 colunas de benefícios com ícone.
- ACABAMENTO: cantos 12–16 em cards e 8–10 em campos/botões; bordas 1px de baixa opacidade + sombra suave (y 1–4, blur 8–24, alfa 6–12%) — nunca bordas pretas pesadas; ícones de um único conjunto e peso; estados (ativo, hover/seleção, desabilitado) visíveis; vazios com ilustração/ícone + frase + ação; contraste de texto ≥ 4.5:1; modo escuro com superfícies em 3 níveis (fundo < card < elevado) em vez de preto chapado.
- NÃO FAÇA: cabeçalho gigante com texto genérico, cards vazios com só um título, tabelas com 2 linhas, tudo centralizado, mais de 2 cores fortes, caixas sem hierarquia, ícones aleatórios sem sentido.
`;

export function buildAiScreenPrompt(req: AiScreenRequest): string {
  const target = req.targetFrame;
  const size = target
    ? `O frame já existe com ${Math.round(target.width)}x${Math.round(target.height)} px: gere somente o CONTEÚDO dele (não mude o tamanho).`
    : 'Escolha o tamanho: MOBILE 393x852 (padrão para apps/celular; o app desenha o aparelho iPhone em volta) ou desktop 1440x900 (ou 1280x800), conforme o pedido.';
  const refs = referenceHints(req.prompt);
  return `Você é um designer de interfaces sênior. Crie o layout de uma ou mais telas e responda SOMENTE com JSON válido (sem markdown, sem texto antes ou depois).
${tokensBlockFor(req)}${assetsPromptBlock(req.projectAssets)}${referenceBlock(req.referenceImages, req.referenceSpec, req.prompt.includes(STYLE_MODE_MARK))}${req.referenceImages?.length || req.referenceSpec || req.prompt.includes(STYLE_MODE_MARK) ? '' : directionBlock(req.prompt)}${inspirationBlock(req.inspirationImages)}${isDesktopRequest(req.prompt) ? DESKTOP_GUIDE : ''}${req.canReadProject && req.useProjectContext !== false ? 'Você está na pasta do projeto do usuário e já recebeu abaixo um resumo dele. Só leia arquivos se faltar algo essencial para o design (somente LEITURA), no MÁXIMO ' + (isVaguePrompt(req.prompt) ? '6 arquivos (priorize os .md de documentação que descrevem o produto)' : '4 arquivos pequenos (ex.: README, tema/cores, uma página existente)') + ' e rápido — NUNCA varra o projeto inteiro nem rode buscas amplas, pois a resposta tem tempo limite. Reflita no design o domínio, o vocabulário e a identidade visual. NUNCA edite, crie ou apague arquivos. Responda apenas o JSON.' : `NÃO edite arquivos${req.referenceSpec ? ' nem leia outros arquivos' : req.referenceImages?.length ? ' (apenas abra as imagens de referência para vê-las)' : ' nem leia outros arquivos'}; responda apenas o JSON.`}

PEDIDO: ${req.prompt}
${looksLikeErrorLog(req.prompt) ? 'ATENÇÃO: o pedido contém um ERRO/LOG colado. NÃO desenhe um dashboard genérico nem a tela de erro: deduza do texto a tela ou o componente de interface envolvido (ex.: erro de chave duplicada em itens com estado "closed" = uma lista/abas/filtro com os estados "open", "closed"…) e gere ESSA tela, com todos os estados e itens que o erro cita. Se houver imagem de referência, ela manda na aparência.\n' : ''}${req.projectContext && req.useProjectContext !== false ? `CONTEXTO DO PROJETO${req.referenceSpec || req.referenceImages?.length ? ' (SECUNDÁRIO: só para nomes/vocabulário quando o pedido pedir conteúdo do projeto; a REFERÊNCIA VISUAL manda em estrutura, posições e estilo)' : ''}:\n${req.projectContext}\n` : ''}${size}

PALETA E TEMA: defina você mesmo uma paleta coerente com o PEDIDO — nunca com o tema ou a cor do aplicativo onde você está rodando. Prioridade: (1) o que o usuário pediu (ex.: "lightmode", "escuro", cores citadas); (2) a identidade da marca/app de referência citado (ex.: iFood = vermelho #EA1D2C); (3) as cores do projeto, só se o pedido for sobre esse projeto; (4) o que combina com o segmento (saúde = verdes/azuis, finanças = roxo/azul-escuro, beleza = tons suaves…). Sem pedido de tema, use tema claro em apps de consumo. Use 1 cor primária, 1 secundária opcional, neutros (fundo, superfície, borda, texto) e cores semânticas (verde/vermelho/amarelo) só onde fizer sentido. Informe SEMPRE "fill" (e "background" na tela) em todo elemento, com contraste adequado (texto legível sobre o fundo) e a mesma paleta em todas as telas.

${req.useProjectContext === false
  ? 'ASSUNTO DO PEDIDO: use SOMENTE o que está no pedido (e nas imagens/referências anexadas). IGNORE qualquer projeto, pasta, arquivo, memória ou conversa anterior: não puxe nomes, marcas, módulos ou dados de nenhum projeto existente. Se o pedido não disser o assunto, escolha um assunto genérico e plausível e siga o visual das referências.'
  : `ASSUNTO DO PEDIDO: ${isVaguePrompt(req.prompt) ? 'O PEDIDO NÃO DIZ SOBRE O QUE É O APP/SISTEMA — o assunto é o PROJETO do usuário. ' : 'Se o pedido não disser de que se trata o app/sistema, o assunto é o PROJETO do usuário. '}Use o CONTEXTO DO PROJETO (nome, README e documentos .md, estrutura, telas/rotas e entidades existentes, cores) para decidir o domínio, o público, os módulos, o vocabulário e dados fictícios realistas do negócio, e desenhe uma tela que faça sentido para os usuários desse projeto (ex.: "tela inicial" = a home/dashboard real desse sistema, com os indicadores, atalhos e listas que ele teria). Se o projeto for uma API, biblioteca ou CLI sem interface, imagine o app/painel que consumiria isso. Se o pedido disser o assunto, siga o pedido e use o projeto só como apoio de contexto e identidade visual.`}

REFERÊNCIAS DE MERCADO: se o pedido citar um app/sistema conhecido (iFood, Uber, Nubank, Airbnb, Spotify, Notion…) ou um tipo de produto consolidado, siga os padrões reais de UI dele (estrutura de navegação, hierarquia, componentes típicos, proporções, paleta e tom de voz), adaptados ao que foi pedido — sem copiar logos nem marcas. Mesmo sem citação, use como base os padrões estabelecidos de apps do mesmo tipo.
${refs ? `Padrões conhecidos do que foi citado:\n${refs}\n` : ''}
ORDEM DE PRIORIDADE (quando houver conflito): 1) a REFERÊNCIA VISUAL anexada (estrutura, componentes, estilo); 2) o PEDIDO do usuário; 3) o contexto do projeto; 4) os exemplos e receitas deste prompt (servem só para a SINTAXE e para saber construir as peças — nunca como modelo de tela). Cada tela deve ter composição própria, derivada da referência/pedido.

FORMATO (uma tela). ATENÇÃO: o exemplo abaixo mostra APENAS a sintaxe; os valores, textos, cores, tamanhos e a composição são fictícios. NÃO copie o conteúdo nem o layout do exemplo.
{"name":"<nome da tela>","width":393,"height":852,"background":"#RRGGBB","shapes":[
  {"type":"frame","id":"raiz","name":"Conteúdo","layout":"vertical","gap":16,"padding":[54,16,34,16],"x":0,"y":0,"width":393,"height":852,"fill":"transparent"},
  {"type":"frame","id":"c1","parent":"raiz","name":"<card>","layout":"horizontal","gap":12,"padding":12,"align":"left","width":"fill","height":"hug","fill":"#RRGGBB","cornerRadius":16},
  {"type":"image","parent":"c1","name":"<foto>","query":"<foto em inglês>","width":64,"height":64,"cornerRadius":12},
  {"type":"frame","id":"c1t","parent":"c1","name":"<textos>","layout":"vertical","gap":4,"width":"fill","height":"hug"},
  {"type":"text","parent":"c1t","name":"<título>","text":"<texto real>","width":"fill","fontSize":16,"fontWeight":600,"fill":"#RRGGBB"},
  {"type":"icon","parent":"c1t","name":"<MaterialIcon>","size":18,"fill":"#RRGGBB"},
  {"type":"ellipse","name":"<sobreposição>","x":300,"y":120,"width":12,"height":12,"fill":"#RRGGBB"},
  {"type":"frame","id":"nav","name":"<barra de abas>","pin":"bottom","layout":"horizontal","padding":[10,8,34,8],"width":"fill","height":"hug","fill":"#RRGGBB"},
  {"type":"frame","id":"aba1","parent":"nav","name":"<aba>","layout":"vertical","gap":4,"align":"top-center","width":"fill","height":"hug"},
  {"type":"icon","parent":"aba1","name":"<MaterialIcon>","size":24,"fill":"#RRGGBB"},
  {"type":"text","parent":"aba1","text":"<rótulo>","width":"hug","fontSize":11,"fill":"#RRGGBB"}
]}

AUTO LAYOUT (OBRIGATÓRIO): estruture a tela como um designer no Figma, com frames de Auto Layout aninhados — NÃO posicione tudo com x/y absolutos.
- Um frame com "layout":"horizontal" ou "vertical" organiza os filhos sozinho: "gap" (espaço entre itens), "padding" (número, ou [topo,direita,base,esquerda]; também "paddingX"/"paddingY"), "align" (top-left, top-center, top-right, left, center, right, bottom-left, bottom-center, bottom-right).
- Cada item declara o pai com "parent":"<id do frame>" (o pai precisa ter sido declarado ANTES, com "id"). Sem "parent" = direto na tela. Filhos de um frame com layout NÃO levam x/y.
- Tamanhos: número, "fill" (ocupa o espaço disponível do pai) ou "hug" (se ajusta ao conteúdo). Use "hug" na altura de cards/botões/listas, "fill" na largura de itens que ocupam a linha, textos de uma linha curta com "width":"hug".
- Estruture: um frame raiz vertical (cabeçalho, conteúdo rolável, barra inferior), seções, listas e grades (linhas horizontais de cards), cards (imagem + coluna de textos), chips, botões (frame com texto/ícone centralizado), barras de navegação e abas.
- SOBREPOSIÇÕES (badge de contagem, ponto de notificação, botão flutuante, selo): use "overlay":true + "anchor":"top-right|top-left|bottom-right|bottom-left|center" (+ "dx","dy" = quanto sai para fora do canto, px) no item filho do componente que ele cobre — ele fica FORA do fluxo do auto layout, preso ao canto do pai (nunca como irmão ao lado do ícone). Ex.: botão circular 44 com ícone + {"type":"frame","parent":"btn","overlay":true,"anchor":"top-right","dx":6,"dy":6,"layout":"horizontal","align":"center","padding":[2,6,2,6],"cornerRadius":999,"fill":"#7C3AED","width":"hug","height":18} contendo o texto "3"; ponto vermelho = {"type":"ellipse","parent":"btn","overlay":true,"anchor":"top-right","dx":2,"dy":2,"width":10,"height":10,"fill":"#EF4444","stroke":"#FFFFFF","strokeWidth":2}. Outras decorações soltas: x/y absolutos sem layout.
- Cores em "fill"/"stroke"; "cornerRadius" nos frames para cards e botões.
- DEGRADÊ: em rect/frame/ellipse use "gradient":{"from":"#00000000","to":"#000000CC","angle":180} (cores #RRGGBBAA, ângulo 180 = de cima para baixo) em vez de "fill" — ex.: escurecer a base de uma foto para o texto ficar legível: um frame com degradê sobre a imagem, com o texto dentro.
- Raios: "cornerRadius":999 faz pílula/círculo perfeito em qualquer tamanho.
- TODO item (inclusive as seções: cabeçalho, cards, listas, barras) declara "parent" com o id do frame que o contém — as seções da tela têm "parent":"raiz" (o id do frame de conteúdo). Item sem "parent" fica solto na tela, fora do layout.
- TODO frame que contém filhos precisa de "layout" ("horizontal" ou "vertical"). Filhos de um frame com layout NÃO levam x/y; se você der x/y aos filhos, o frame não deve ter layout. Nunca misture: sem "layout" e sem x/y os itens empilham todos no mesmo canto.
- "fill" é para o item PRINCIPAL que ocupa o espaço restante; em uma linha horizontal só UM item deve ser "fill" (o texto/coluna principal). Badges, pílulas (ex.: "+14,2% mês"), ícones, avatares, botões pequenos e chips são "hug" ou têm tamanho fixo — nunca "fill" (ficariam gigantes e espremeriam o texto ao lado).
- Valores monetários, números, datas e rótulos curtos (até ~20 caracteres) usam "width":"hug" e nunca quebram linha. Só descrições longas usam "fill" e quebram.
- Para um item no canto de um card (badge no topo à direita), prefira uma linha horizontal: [texto "fill"][badge "hug"], em vez de posição absoluta.
- BARRAS FIXAS (navbar/tab bar inferior, rodapé com botão, cabeçalho fixo): use "pin":"bottom" (ou "top") no frame da barra. Ele sai do fluxo e fica colado na borda da tela; em telas mobile dê padding inferior de 34 (indicador home) e deixe espaço no conteúdo. Para barra FLUTUANTE (cápsula com margem, como nos apps modernos) use também "inset" (distância da borda, ex.: 24), "x" (ex.: 24) e largura numérica (largura da tela − 2·x). NUNCA coloque uma navbar como mais um item do fluxo vertical logo depois de conteúdo "hug": ela subiria para o meio da tela. (Alternativa sem pin: o frame de conteúdo antes dela precisa ter "height":"fill".)

RECEITAS DE COMPONENTES — ensinam apenas COMO construir cada peça com auto layout. Use SÓ as peças que a referência/o pedido pedem; NÃO são blocos obrigatórios. Não monte o esqueleto padrão (busca + chips + card de destaque + grade de cards + lista + navbar) a menos que a referência ou o pedido peçam exatamente isso:
- Navbar/tab bar: frame "pin":"bottom", layout horizontal, padding [10,8,34,8], fundo e borda superior sutil; cada aba é um frame vertical (gap 4, align top-center, width "fill", height "hug") com ícone + rótulo curto; a aba ativa usa a cor de destaque.
- Cabeçalho: frame horizontal (align left, gap 12, width "fill"); o título com width "fill" empurra os ícones de ação para a direita; ícones e avatar com tamanho fixo.
- Botão: frame horizontal, align center, padding [14,20,14,20], cornerRadius, fill; dentro, texto com width "hug" (e ícone opcional). Botão de largura total: width "fill".
- Campo de busca/input: frame horizontal (align left, gap 8, padding 12/14, fill claro, cornerRadius); ícone + texto "fill" com cor de placeholder.
- Card: frame com padding 12–16, cornerRadius 12–16, gap entre conteúdos; textos com width "fill"; cards lado a lado em um frame horizontal com cada card "width":"fill".
- Linha de lista: frame horizontal (align left, gap 12, width "fill"): miniatura/ícone fixo + coluna vertical de textos (width "fill") + valor/estado à direita (width "hug").
- Chips/abas de filtro: frame horizontal com gap 8; cada chip é frame horizontal (padding 8/14, cornerRadius 20) com texto "hug".
- Grade: um frame vertical com linhas horizontais; cada célula "width":"fill".
- GRÁFICOS (nunca desenhe gráficos com formas soltas): {"type":"chart","kind":"line|area|bar|donut","parent":"<card>","width":"fill","height":120,"data":[...],"labels":[...],"color":"#hex"}. line/area: 6–12 valores que reproduzam a FORMA da curva da referência (subidas, quedas, picos), "fillArea":true para área com degradê, "grid":true para linhas de grade, "highlight":{"index":4,"label":"+$2,956"} para o ponto destacado com etiqueta; bar: uma barra por valor, "labels" nos eixos, "colors":["#..",...] cor por barra, "track":"#FFFFFF10" para o trilho de fundo cheio atrás de cada barra, "valueLabels":["56%",...] para os valores, "barRadius", "barGap"; donut: "data" proporcional, "colors", "ringWidth". O app calcula toda a geometria. Mesmo tamanho e posição do gráfico da referência.
- LINHAS DIVISÓRIAS: TODA linha fina da referência é um item: horizontal = rect/frame "width":"fill","height":1 na cor/alfa da linha; vertical = "width":1,"height":"fill". Entre itens de lista, entre seções de um painel (cada seção do painel lateral tem linha acima/abaixo), cabeçalho de colunas e GRADE COMPLETA de calendários e tabelas (uma linha horizontal por hora/linha + uma vertical entre cada coluna).
- MICROCOMPONENTES: chip de ícone = frame 36–44 (cornerRadius 10–12, fill sutil) com o ícone dentro; tile de estatística = frame horizontal [chip de ícone][coluna: rótulo pequeno + valor grande] com borda 1px e fundo mais claro que o card; badge de contagem sobre ícone/botão = frame pílula (altura 16–18, padding 2/6, fill de destaque) com o número, com "overlay":true e "anchor":"top-right" no botão (fora do fluxo); ponto de notificação = ellipse 8–10 com borda branca, "overlay":true, "anchor":"top-right"; pilha de avatares = frame horizontal com "gap":-10 e avatares circulares (image, cornerRadius metade) com stroke 2 na cor do fundo; ponto de status = ellipse 8 + texto; controle segmentado (Dia/Semana/Mês) = frame horizontal com fill sutil e raio, item ativo com fill mais claro; barra de progresso = rect trilho (altura 6–8, raio 999) + rect preenchido; marcas (Gmail, Spotify, SMS) = quadrado arredondado na cor da marca com ícone/inicial; botão contornado ("stroke" 1) vs preenchido; campo de entrada com ícones à direita e botão "Send".

ESTILOS AVANÇADOS (use quando a referência/pedido pedir; todos opcionais):
- Fundo da tela em degradê/camadas: "background":"#RRGGBB" (cor base, define claro/escuro) + "backgroundFills":[camadas de BAIXO para CIMA]; cada camada é "#RRGGBBAA" ou {"gradient":{...}}. "backgroundNoise":{"density":0.4} para granulado.
- Degradê: {"gradient":{"type":"linear|radial|angular","from":"#RRGGBBAA","to":"#RRGGBBAA","angle":180,"center":[0.5,0.15],"radius":0.9,"stops":[{"color":"#..","at":0},{"color":"#..","at":1}]}} — "center" (0 a 1 da caixa) e "radius" valem para radial (brilho/halo fora do centro). Em rect/frame/ellipse use "gradient" ou "fills":[...] (camadas de baixo para cima).
- Transparência: cores aceitam alfa #RRGGBBAA (ex.: "#FFFFFF1F" = branco 12%), em fill e stroke.
- VIDRO (glassmorphism) — PREFIRA o atalho "glass":true (ou "glass":"#FFFFFF" com a cor da tinta) em frame/rect: aplica degradê claro translúcido, borda de 1px, brilho interno no topo, blur do fundo e sombra suave. Use em cards, barras, chips, campo de entrada e botões sobre fundo colorido/imagem (o fundo precisa ter cor/brilho para o vidro aparecer: nunca vidro sobre preto liso). Vidro não é "preto translúcido": a tinta é CLARA (branco) a menos que a referência mostre vidro escuro. Manual: "fill":"#FFFFFF1A","stroke":"#FFFFFF33","strokeWidth":1,"effects":[{"type":"backdrop-blur","blur":24}] (atalho: "backdropBlur":24), com cornerRadius generoso.
- Sombras: "effects":[{"type":"shadow","x":0,"y":8,"blur":24,"spread":0,"color":"#00000040"}]; sombra interna: {"type":"inner-shadow",...}.
- NEOMORFISMO: fundo igual ao do app, "effects":[{"type":"shadow","x":8,"y":8,"blur":16,"color":"#A3B1C680"},{"type":"shadow","x":-8,"y":-8,"blur":16,"color":"#FFFFFFCC"}]; pressionado/côncavo: dois "inner-shadow" com as mesmas cores.
- Brilho/halo (glow) e manchas de cor no fundo: uma ellipse grande com "gradient" radial (cor → mesma cor com alfa 0) e "effects":[{"type":"blur","blur":80}] (atalho "blur":80), atrás do conteúdo.
- Granulado/ruído: {"type":"noise","density":0.35,"opacity":0.2} em effects.
- Raio por canto: "radii":[sup-esq,sup-dir,inf-dir,inf-esq]. Rotação: "rotation":graus.
- ESPAÇAMENTO E POSIÇÃO: a tela inteira deve ser preenchida como na referência (sem grande vazio embaixo): blocos principais com espaço proporcional entre si; o que fica colado na base (campo de entrada, botões de ação, navegação) usa "pin":"bottom" com margem; cabeçalho no topo logo abaixo da barra de status; mesmo recuo lateral (16–24px) em TODOS os blocos; mesmo gap entre itens iguais; cards/chips de uma mesma fileira com mesma largura e altura (largura "fill" dividindo igualmente). Carrossel só se a referência tiver; senão os cards cabem na largura.
- FONTE: use "Poppins" em todos os textos (é o padrão; não precisa informar "fontFamily"). Só informe outra se a referência for claramente outra (ex.: serifada, monoespaçada).
- POSIÇÃO DO TEXTO: copie o ALINHAMENTO da referência ("textAlign":"center" para textos centralizados; "left"/"right" nos demais) e a posição horizontal/vertical relativa. Texto centralizado fica em contêiner de largura total (width fill) com layoutAlign centralizado; nunca alinhe à esquerda um texto que na referência está centralizado.
- PROPORÇÕES: tamanhos de elementos (orbes, avatares, botões, imagens) em PORCENTAGEM da largura da tela, como na referência (ex.: orbe com ~55% da largura => ~215px em 393px); mantenha os espaços verticais entre blocos na mesma proporção.
- FUNDO: reproduza o fundo da referência por inteiro (cores de cada região: topo, centro, base, laterais; brilhos/halos e escurecimentos como camadas radiais em "backgroundFills"). Nunca troque um fundo colorido por preto/escuro liso. Se o fundo for uma foto/ilustração, use uma imagem ("image") em tela cheia atrás do conteúdo.
- TEXTO fiel à referência: "fontSize" EXATO em px da especificação (não arredonde para outro tamanho), "fontWeight" (100–900), "letterSpacing" em px (pode ser negativo em títulos grandes), "textCase":"upper|lower|title", "fontFamily", "italic":true, "textDecoration". Título grande e legenda pequena devem manter a MESMA proporção da referência.

SISTEMA DE MEDIDAS (padronização — o resultado deve parecer feito por um design system):
- Defina mentalmente os tokens e use-os em TODA a tela: grade de 4px (gap e padding múltiplos de 4); margem lateral única (16, 20 ou 24) igual em todos os blocos; espaço entre seções constante (16/24/32); padding de cards igual em cards do mesmo tipo (12/16/20); raios consistentes (um raio para cards, outro para botões/campos, 999 para pílulas).
- Mesmo componente = mesmas medidas: botões primários todos com a mesma altura (44–56) e padding; campos/inputs com a mesma altura; chips todos iguais (altura 32–40, padding 8/14); avatares 32/40/48; ícones 16/20/24; itens de lista com a mesma altura e o mesmo layout; cards lado a lado com a mesma altura (largura "fill").
- Alinhe por estrutura, não por números soltos: use "align", "fill" e "gap" em vez de x/y ou larguras mágicas; bordas esquerdas dos blocos na mesma margem; ícone e texto em linha com "align":"center"; textos em coluna alinhados à esquerda.
- Escala tipográfica enxuta (ex.: 11/12/13/14/16/18/20/24/28/32/40): poucos tamanhos, com hierarquia clara (título, subtítulo, corpo, legenda). Com referência anexada, copie os tamanhos exatos dela.

PROJETO SOB MEDIDA: projete especificamente o que foi pedido — as telas, as seções, os componentes, os textos, os dados fictícios e a hierarquia devem nascer do pedido (e das imagens/projeto/referências fornecidos), como um designer faria para esse produto. Não use um esqueleto genérico repetido (cabeçalho + 3 cards + botão) nem conteúdo de outro segmento; cada tela deve ter composição própria, adequada ao seu objetivo.

${req.maxScreens === 1 ? 'UMA ÚNICA TELA: esta chamada gera SOMENTE a tela indicada no pedido. Responda no formato de UMA tela ({"name","width","height","background","shapes":[...]}), SEM "screens", e NÃO desenhe as outras telas do app (elas são geradas em chamadas separadas).' : `VÁRIAS TELAS: se o pedido envolver mais de uma tela (fluxo, jornada, "telas de login e cadastro", "app com 4 telas"), responda {"screens":[{"name":"...","width":393,"height":852,"background":"#...","shapes":[...]}, ...]} com telas do mesmo tamanho e visual coerente (até ${MAX_SCREENS}). Quando o usuário pedir um FLUXO sem dizer quantas telas, VOCÊ decide a quantidade necessária para cobrir a jornada completa do início ao fim (normalmente 5 a 10: ex. abertura, cadastro/login, home, listagem, detalhe, seleção, confirmação, sucesso, acompanhamento), sem pedir confirmação e sem se limitar a poucas telas. Se o usuário disser o número, siga-o. Nomeie cada tela de forma curta e na ordem do fluxo, e mantenha os mesmos componentes de navegação, cabeçalhos e paleta entre elas. Em cada tela, escreva "name","width","height","background" ANTES de "shapes".`}

REGRAS:
- x e y (quando usados) são relativos ao canto superior esquerdo do pai; tudo deve caber dentro de width x height da tela.
- Em telas mobile NÃO desenhe barra de status, ilha/notch nem indicador home (o app já desenha). Reserve ${MOBILE_SAFE.top}px no topo e ${MOBILE_SAFE.bottom}px na base e use margens laterais de 16 a 24px.
- Tipos permitidos: frame, rect, ellipse, text, line, icon, image. Cores em hexadecimal (#RRGGBB).
- Ordem do array = ordem de criação e empilhamento: declare cada frame ANTES dos seus filhos; dentro de um layout, os filhos aparecem na ordem em que forem listados. Gere de cima para baixo.
- TEXTOS: o texto precisa caber DENTRO do card/área onde está. Textos curtos (títulos, botões, rótulos, preços) devem caber em UMA linha: dê largura suficiente e não os quebre. Só use mais linhas em descrições, com a largura do card menos 16px de margem interna. Nunca deixe texto passar da borda do card.
- ÍCONES: use SEMPRE type "icon" com "name" de um Material Icon em PascalCase (ex.: ${COMMON_ICON_NAMES.slice(0, 60).join(', ')}, ou outro) e "size" em px; "fill" define a cor. Nunca desenhe ícones com formas.
- IMAGENS: para fotos reais (perfil de usuário, banners, capas, fotos de produtos/lugares/comida) use type "image" com "query" em INGLÊS descrevendo a foto ESPECÍFICA do contexto: se for pessoa, diga gênero, idade e tipo ("smiling young woman portrait", "senior man headshot", "doctor in white coat"); se for lugar/objeto/comida, o assunto exato ("burger on table", "modern apartment living room", "Nelore cattle in pasture"). Nunca use consultas genéricas ("photo", "person", "image"): a foto deve combinar com o texto ao redor (um card de produto mostra o produto, um perfil mostra uma pessoa). Avatares: width = height e "cornerRadius" = metade do tamanho (círculo). Cantos arredondados com "cornerRadius".
- VELOCIDADE (a resposta tem tempo limite e cada caractere custa tempo): responda com JSON MINIFICADO — sem indentação, sem espaços fora de textos, um elemento por linha; nomes curtos (1 a 3 palavras) e OMITA "name" em textos e imagens (o app nomeia sozinho); ${req.referenceSpec || req.referenceImages?.length ? 'com REFERÊNCIA visual use até 350 elementos por tela: inclua TODOS os elementos do inventário da referência (fidelidade máxima), sem omitir nenhum.' : 'use no MÁXIMO 80 elementos por tela: priorize os blocos principais e, em listas/grades repetidas, mostre só 3 ou 4 itens de exemplo.'}
- Hierarquia visual clara, espaçamento consistente (múltiplos de 4 ou 8) e textos reais (em português do Brasil, exceto quando há referência visual: mantenha o idioma da imagem; nada de "Lorem ipsum").`;
}

/** Fundo escuro? (luminância do hex; padrão: claro) */
export function isDarkColor(hex: string | undefined): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec((hex || '').trim());
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|transparent|none)$/;
const color = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/** Quebra o texto por palavras para caber na largura (mantido por compatibilidade; o ajuste fino é do fitText). */
export function wrapText(text: string, width: number, fontSize: number): string {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > perLine) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Extrai o objeto JSON da resposta (aceita cercas ``` e texto em volta). */
export function extractJson(raw: string): any | null {
  const text = (raw || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

interface Box { x: number; y: number; width: number; height: number }
export interface PendingImage { id: string; query: string; width: number; height: number; /** arquivo do projeto (logo/ícone) em vez de foto do Unsplash */ assetPath?: string }
interface TextMeta { raw: string; size: number; weight: number; align: 'left' | 'center' | 'right'; singleLine: boolean }
type ItemCtx = {
  frameId: string; originX: number; originY: number; width: number; height: number; pageId: string; isDark: boolean; accentColor: string;
  icons?: IconCatalog;
  /** Retângulos já criados (relativos à tela): textos se ajustam ao menor que os contém */
  containers?: Box[];
  /** Imagens a resolver depois (Unsplash) */
  pending?: PendingImage[];
  /** Resolve o id declarado pela IA ("parent") para o shape atual */
  lookup?: (aiId: string) => Shape | undefined;
  /** Textos "fill": reajustados depois que o auto layout define a largura final */
  textMeta?: Map<string, TextMeta>;
  /** Design tokens do projeto: tudo que a IA cria é ajustado a eles */
  tokens?: DesignTokens | null;
  /** id curto (a1…) → caminho do logo/ícone do projeto */
  assets?: Record<string, string>;
};

/** Cor média (hex) das paradas do primeiro degradê, ou a cor sólida da camada de cima: define se o tema é escuro. */
function avgFillHex(fills?: FillItem[]): string | undefined {
  const f = fills?.[fills.length - 1] ?? fills?.[0]; // camada de baixo = fundo
  if (!f) return undefined;
  const stops = f.gradientStops?.length ? f.gradientStops : [{ color: f.color, position: 0, opacity: 1 }];
  const rgb = stops.map((st) => { const h = st.color.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); });
  const avg = [0, 1, 2].map((i) => Math.round(rgb.reduce((a, c) => a + c[i], 0) / rgb.length));
  return '#' + avg.map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Nome da camada quando a IA omite "name" (economiza tokens): o próprio texto, a busca da foto ou o tipo. */
function autoName(item: any): string {
  if (item.type === 'text') return String(item.text ?? 'Texto').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Texto';
  if (item.type === 'image') return String(item.query || 'Imagem').slice(0, 28);
  if (item.type === 'frame') return 'Frame';
  return ({ rect: 'Retângulo', ellipse: 'Elipse', line: 'Linha' } as Record<string, string>)[item.type] || item.type;
}

const NAVBAR_NAME = /\b(navbar|nav bar|tab ?bar|bottom ?(nav|bar|tabs)|barra (de )?(navega[cç][aã]o|abas|inferior)|menu inferior)\b/i;
const ALIGNS = new Set(['top-left', 'top-center', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom-center', 'bottom-right']);

/** Menor retângulo que contém o ponto; senão a própria tela. */
function containerFor(ctx: ItemCtx, x: number, y: number): { right: number; bottom: number; card: boolean } {
  let best: Box | null = null;
  for (const b of ctx.containers || []) {
    if (x >= b.x - 0.5 && y >= b.y - 0.5 && x < b.x + b.width && y < b.y + b.height && (!best || b.width * b.height < best.width * best.height)) best = b;
  }
  return best ? { right: best.x + best.width, bottom: best.y + best.height, card: best.width < ctx.width * 0.98 } : { right: ctx.width, bottom: ctx.height, card: false };
}

type Dim = { v: number; mode: 'fixed' | 'fill' | 'hug' };
function parsePadding(item: any) {
  let t = 0, r = 0, b = 0, l = 0;
  const p = item.padding;
  const n = (v: unknown) => num(v, 0, 0, 300);
  if (Array.isArray(p)) {
    if (p.length === 2) [t, r] = [n(p[0]), n(p[1])], (b = t), (l = r);
    else if (p.length >= 4) [t, r, b, l] = [n(p[0]), n(p[1]), n(p[2]), n(p[3])];
    else if (p.length === 1) t = r = b = l = n(p[0]);
  } else if (p != null) t = r = b = l = n(p);
  if (item.paddingX != null) l = r = n(item.paddingX);
  if (item.paddingY != null) t = b = n(item.paddingY);
  return { t, r, b, l };
}

/** Converte um item vindo da IA em shape (coordenadas relativas ao pai -> absolutas). Null se inválido. */
/** Converte o item da IA em shape e ajusta ao design system do projeto (se houver tokens): cores, fonte, escala, espaços e raios. */
export function convertAiItem(item: any, ctx: ItemCtx, z: number): Shape | null {
  const t = ctx.tokens;
  if (!t || !item || typeof item !== 'object') return convertAiItemRaw(item, ctx, z);
  let src = item;
  if (item.type === 'text') {
    const ts = snapTypeToTokens(Number(item.fontSize) || 16, t);
    src = { ...item, fontSize: ts.size, fontWeight: item.fontWeight ?? ts.weight, fontFamily: undefined };
  }
  const sh = convertAiItemRaw(src, ctx, z);
  if (!sh) return sh;
  const out: Shape = { ...sh };
  if (out.type === 'text') out.fontFamily = t.fontFamily;
  if (out.hasAutoLayout || out.independentPadding) {
    for (const k of ['layoutGap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) if (typeof out[k] === 'number') (out as any)[k] = snapSpaceToTokens(out[k] as number, t);
  }
  if (out.cornerRadius && out.cornerRadius < Math.min(out.width, out.height) / 2 - 1) out.cornerRadius = snapRadiusToTokens(out.cornerRadius, t);
  const snapC = (c: string) => snapColorToTokens(c, t);
  if (typeof out.fill === 'string') out.fill = snapC(out.fill);
  if (typeof out.stroke === 'string' && out.stroke !== 'none') out.stroke = snapC(out.stroke);
  if (out.fills) out.fills = out.fills.map((f) => (f.type && f.type !== 'solid' ? f : { ...f, color: snapC(f.color) }));
  if (out.strokes) out.strokes = out.strokes.map((f) => ({ ...f, color: snapC(f.color) }));
  return out;
}

/** Canto do pai onde o item sobreposto fica (dx/dy = quanto sai para fora do canto). */
export function overlayPosition(o: NonNullable<Shape['overlayAnchor']>, p: { x: number; y: number; width: number; height: number }, w: number, h: number): { x: number; y: number } {
  switch (o.anchor) {
    case 'top-left': return { x: p.x - o.dx, y: p.y - o.dy };
    case 'bottom-right': return { x: p.x + p.width - w + o.dx, y: p.y + p.height - h + o.dy };
    case 'bottom-left': return { x: p.x - o.dx, y: p.y + p.height - h + o.dy };
    case 'center': return { x: p.x + (p.width - w) / 2, y: p.y + (p.height - h) / 2 };
    default: return { x: p.x + p.width - w + o.dx, y: p.y - o.dy }; // top-right
  }
}

function convertAiItemRaw(item: any, ctx: ItemCtx, z: number): Shape | null {
  if (!item || typeof item !== 'object' || !ALLOWED.has(item.type)) return null;
  // pai declarado pela IA (frame/section) ou a própria tela
  // "pin": barras fixas (navbar, rodapé) saem do fluxo do layout e ficam coladas na borda da tela
  const pinned = (item.pin === 'bottom' || item.pin === 'top') && item.type === 'frame';
  const declared = !pinned && typeof item.parent === 'string' && item.parent !== 'root' ? ctx.lookup?.(item.parent) : undefined;
  const pShape = declared && (declared.type === 'frame' || declared.type === 'section') ? declared : undefined;
  // "overlay"/"anchor": sobreposto ao pai (badge, ponto de notificação, botão flutuante) — FORA do fluxo do auto layout
  const anchor = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'center'].includes(item.anchor) ? (item.anchor as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center') : undefined;
  const overlay = !!pShape && (item.overlay === true || item.overlay === 'true' || !!anchor);
  const autoParent = !overlay && !!pShape?.hasAutoLayout && (pShape.layoutFlow === 'horizontal' || pShape.layoutFlow === 'vertical');
  const parentId = pShape ? pShape.id : ctx.frameId;
  const ox = pShape ? pShape.x : ctx.originX;
  const oy = pShape ? pShape.y : ctx.originY;
  const width = pShape ? pShape.width : ctx.width;
  const height = pShape ? pShape.height : ctx.height;
  const horizontal = pShape?.layoutFlow === 'horizontal';
  // filho de auto layout entra no fim do fluxo (o layout o posiciona); senão posição absoluta no pai
  const place = (relX: number, relY: number) => (autoParent ? (horizontal ? { x: ox + width + 1, y: oy } : { x: ox, y: oy + height + 1 }) : { x: ox + relX, y: oy + relY });
  // frame com auto layout próprio se ajusta ao conteúdo ("hug") mesmo fora de um layout (ex.: navbar direto na tela)
  const ownLayout = item.type === 'frame' && (item.layout === 'horizontal' || item.layout === 'vertical');
  const relXHint = autoParent ? 0 : num(item.x, 0, 0, Math.max(0, width - 24));
  const dim = (v: unknown, fb: number, max: number): Dim => {
    if (v === 'fill') return { v: autoParent ? Math.max(24, Math.min(fb, max)) : Math.max(24, max - relXHint), mode: autoParent ? 'fill' : 'fixed' };
    if (v === 'hug') return { v: fb, mode: autoParent || ownLayout ? 'hug' : 'fixed' };
    const n = num(v, fb, 0, max);
    return { v: n > 0 && n < 200 && v !== undefined ? snapDimension(n) : n, mode: 'fixed' };
  };

  if (item.type === 'icon') {
    const name = ctx.icons ? resolveIconName(ctx.icons, item.name) : null;
    if (!ctx.icons || !name) return null;
    const size = snapIconSize(num(item.size ?? item.width, 24, 8, 256));
    const pos = place(num(item.x, 0, 0, Math.max(0, width - size)), num(item.y, 0, 0, Math.max(0, height - size)));
    return iconShape(ctx.icons, name, { id: uid('ai-icon'), pageId: ctx.pageId, parentId, x: pos.x, y: pos.y, size, fill: color(item.fill, ctx.isDark ? '#FFFFFF' : '#0F172A'), zIndex: z });
  }

  const isText = item.type === 'text';
  const isFrame = item.type === 'frame';
  // pais com auto layout ainda podem crescer (hug): o limite dos filhos é o tamanho da tela, não o do pai atual
  const capW = autoParent ? Math.max(width, ctx.width) : width;
  const capH = autoParent ? Math.max(height, ctx.height) : height;
  // Sem "width" dentro de um auto layout: frame com layout próprio e texto se ajustam ao conteúdo ("hug"), como no Figma.
  // (Antes viravam largura FIXA igual à do pai: o botão ao lado de um título ocupava a linha toda e cobria o texto.)
  const widthSpec = item.width ?? (autoParent && ((isFrame && ownLayout) || isText) ? 'hug' : undefined);
  const wDim = dim(widthSpec, item.type === 'line' ? 100 : isFrame ? width : 40, capW);
  const hDim = dim(item.height ?? (isFrame ? 'hug' : undefined), item.type === 'line' ? 0 : 40, capH);
  const w = wDim.v;
  const h = hDim.v;
  const relX = num(item.x, 0, 0, Math.max(0, width - (isText ? 24 : w)));
  const relY = num(item.y, 0, 0, Math.max(0, height - (isText ? 12 : h)));
  let pos = place(relX, relY);
  const overlayInfo = overlay && pShape && anchor ? { anchor, dx: num(item.dx, Math.round(Math.min(w, h) * 0.4), -200, 200), dy: num(item.dy, Math.round(Math.min(w, h) * 0.4), -200, 200) } : undefined;
  if (overlayInfo && pShape) pos = overlayPosition(overlayInfo, pShape, w, h);
  else if (overlay && pShape) pos = { x: pShape.x + num(item.x, 0, -200, 4000), y: pShape.y + num(item.y, 0, -200, 4000) };
  const base: any = {
    id: uid(`ai-${item.type}`),
    parentId,
    name: typeof item.name === 'string' && item.name.trim() ? item.name.slice(0, 60) : autoName(item),
    type: item.type,
    pageId: ctx.pageId,
    x: pos.x,
    y: pos.y,
    width: w,
    height: h,
    rotation: 0,
    opacity: num(item.opacity, 1, 0, 1),
    zIndex: z,
    visible: true,
    stroke: color(item.stroke, 'none'),
    strokeWidth: num(item.strokeWidth, 0, 0, 40),
  };
  if (autoParent || isFrame) {
    base.widthMode = wDim.mode;
    base.heightMode = hDim.mode;
  }
  if (overlay) {
    base.layoutAbsolute = true;
    if (overlayInfo) base.overlayAnchor = overlayInfo;
  }

  if (isFrame) {
    const layout = item.layout === 'horizontal' || item.layout === 'vertical' ? item.layout : undefined;
    const pad = parsePadding(item);
    base.fill = color(item.fill, 'transparent');
    Object.assign(base, styleFromItem(item));
    base.cornerRadius = num(item.cornerRadius, 0, 0, 400);
    if (item.clip === true || item.clip === 'true') base.clipContent = true;
    // o padding é guardado mesmo sem layout: se o frame virar fluxo depois (filhos sem x/y), ele já está lá
    if (!layout && (item.padding != null || item.paddingX != null || item.paddingY != null)) {
      Object.assign(base, { independentPadding: true, paddingTop: snapSpacing(pad.t), paddingRight: snapSpacing(pad.r), paddingBottom: snapSpacing(pad.b), paddingLeft: snapSpacing(pad.l) });
    }
    if (layout) {
      Object.assign(base, {
        hasAutoLayout: true,
        layoutFlow: layout,
        layoutGap: ((g) => (g < 0 ? -snapSpacing(-g) : snapSpacing(g)))(num(item.gap, 0, -48, 200)), // gap negativo = itens sobrepostos (pilha de avatares)
        independentPadding: true,
        paddingTop: snapSpacing(pad.t),
        paddingRight: snapSpacing(pad.r),
        paddingBottom: snapSpacing(pad.b),
        paddingLeft: snapSpacing(pad.l),
        layoutAlign: ALIGNS.has(item.align) ? item.align : 'top-left',
      });
    }
    if (!autoParent && base.fill !== 'transparent' && w > 24 && h > 14) ctx.containers?.push({ x: relX, y: relY, width: w, height: h });
    return base as Shape;
  }

  if (isText) {
    const size = num(item.fontSize, 16, 8, 160);
    const weight = num(item.fontWeight, 400, 100, 900);
    const align = ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'left';
    const raw = String(item.text ?? '').slice(0, 300);
    let maxW: number;
    let maxH: number;
    if (pShape && autoParent) {
      const padL = pShape.independentPadding ? pShape.paddingLeft ?? 0 : pShape.paddingHorizontal ?? 0;
      const padR = pShape.independentPadding ? pShape.paddingRight ?? 0 : pShape.paddingHorizontal ?? 0;
      // pai "hug" ainda não tem largura final: limita pela tela
      maxW = Math.max(24, (pShape.widthMode === 'hug' ? ctx.width - 32 : width) - padL - padR);
      maxH = 800;
    } else if (pShape) {
      maxW = Math.max(24, width - 16 - relX);
      maxH = Math.max(size * 1.25, height - 4 - relY);
    } else {
      const box = containerFor(ctx, relX, relY);
      const pad = box.card ? 8 : 16;
      maxW = Math.max(24, box.right - pad - relX);
      maxH = Math.max(size * 1.25, box.bottom - pad / 2 - relY);
    }
    const hugW = wDim.mode === 'hug';
    // largura "fill" quebra linha como no Figma (não encolhe a fonte); "hug" é sempre uma linha
    const singleLine = hugW || (wDim.mode !== 'fill' && !raw.includes('\n') && (item.height == null || h <= size * 1.25 * 1.6));
    const fit = fitText({ text: raw, width: hugW ? 16 : Math.min(Math.max(w, 16), maxW), fontSize: size, weight, align, maxWidth: maxW, maxHeight: maxH, singleLine });
    base.text = fit.text;
    base.fontSize = fit.fontSize;
    base.width = fit.width;
    base.height = fit.height;
    base.fontWeight = weight;
    base.fontFamily = 'Poppins';
    base.textAlign = align;
    base.fill = color(item.fill, ctx.isDark ? '#FFFFFF' : '#0F172A');
    Object.assign(base, textStyleFromItem(item));
    const fx = effectsFromItem(item);
    if (fx.length) base.effects = fx;
    if (autoParent) {
      base.widthMode = hugW ? 'hug' : wDim.mode;
      base.heightMode = 'hug';
      if (wDim.mode === 'fill') ctx.textMeta?.set(base.id, { raw, size, weight, align, singleLine });
    }
    return base as Shape;
  }

  if (item.type === 'image') {
    base.fill = '#D4D4D8';
    base.imageFit = 'fill';
    base.imageCrop = { x: 0, y: 0, w: 1, h: 1 }; // habilita o recorte com cantos arredondados
    base.cornerRadius = num(item.cornerRadius, item.circle ? Math.min(w, h) / 2 : 0, 0, 1000);
    Object.assign(base, { ...styleFromItem({ ...item, fill: undefined, fills: undefined, gradient: undefined }), fill: '#D4D4D8' });
    const assetPath = typeof item.asset === 'string' ? ctx.assets?.[item.asset] : undefined;
    if (assetPath) {
      // logo/ícone do próprio projeto: sem foto, sem fundo cinza, mantendo a proporção do arquivo
      base.imageFit = 'fit';
      base.fill = 'transparent';
      base.name = String(item.name || `Logo ${assetPath.split('/').pop()}`).slice(0, 40);
      ctx.pending?.push({ id: base.id, query: '', width: Math.round(w), height: Math.round(h), assetPath });
    } else {
      ctx.pending?.push({ id: base.id, query: String(item.query || item.name || 'abstract').slice(0, 80), width: Math.round(w), height: Math.round(h) });
    }
  } else {
    base.fill = color(item.fill, item.type === 'line' ? 'none' : ctx.isDark ? '#27272A' : '#E4E4E7');
    Object.assign(base, item.type === 'line' ? {} : styleFromItem(item));
    if (item.type === 'rect') base.cornerRadius = num(item.cornerRadius, 0, 0, 400);
    if (item.type === 'line' && base.stroke === 'none') base.stroke = ctx.isDark ? '#3F3F46' : '#CBD5E1';
    if (item.type === 'line' && base.strokeWidth === 0) base.strokeWidth = 1;
  }
  if (!autoParent && !pShape && (item.type === 'rect' || item.type === 'image') && w > 24 && h > 14) ctx.containers?.push({ x: relX, y: relY, width: w, height: h });
  return base as Shape;
}

/**
 * Monta telas aos poucos: startScreen() cria o frame (e o aparelho, se mobile) e addItem() cada elemento.
 * `all` guarda tudo o que foi criado, já com o auto layout aplicado (settle). Serve à criação em tempo real
 * e ao parse da resposta completa.
 */
export class ScreenBuilder {
  readonly pending: PendingImage[] = [];
  readonly frameIds: string[] = [];
  /** tudo o que o builder criou (aparelhos + conteúdo), sempre atualizado */
  all: Shape[] = [];
  /** tela de cada frame raiz (para regerar com o mesmo tamanho) */
  readonly screens_: Array<{ rootId: string; width: number; height: number }> = [];
  private cursorX: number;
  private z: number;
  private ctx: ItemCtx | null = null;
  private screens = 0;
  private items = 0;
  private aiIds = new Map<string, string>();
  /** frame de layout principal da tela (primeiro layout declarado direto na tela): destino de itens órfãos */
  private rootFlowId: string | null = null;
  /** barras fixas: id -> borda da tela onde ficam coladas */
  private pins = new Map<string, { edge: 'top' | 'bottom'; top: number; bottom: number; inset: number }>();
  private textMeta = new Map<string, TextMeta>();
  /** gráficos (type:"chart"): o frame é criado como um frame comum e a geometria é refeita quando o tamanho final é conhecido */
  private charts = new Map<string, { spec: ChartSpec; w: number; h: number; childIds: string[] }>();
  totalWidth = 0;
  maxHeight = 0;

  constructor(private req: Pick<AiScreenRequest, 'pageId' | 'startX' | 'startY' | 'isDark' | 'accentColor' | 'targetFrame' | 'icons' | 'tokens' | 'projectAssets'> & { maxScreens?: number }) {
    this.cursorX = req.startX;
    this.z = (req.targetFrame ? req.targetFrame.zIndex + 1 : 100);
  }

  get itemCount() { return this.items; }

  private lookup = (aiId: string) => {
    const id = this.aiIds.get(aiId);
    return id ? this.all.find((s) => s.id === id) : undefined;
  };

  startScreen(header: Record<string, any>): Shape[] {
    const target = this.req.targetFrame || null;
    if (this.screens >= (this.req.maxScreens ?? MAX_SCREENS) || (target && this.screens >= 1)) {
      this.ctx = null;
      return [];
    }
    this.screens++;
    this.aiIds.clear(); // ids declarados valem só dentro da própria tela
    this.rootFlowId = null;
    const width = target ? target.width : num(header.width, 393, 200, 3000);
    const height = target ? target.height : num(header.height, 852, 200, 3000);
    const originX = target ? target.x : this.cursorX;
    const originY = target ? target.y : this.req.startY;
    let out: Shape[] = [];
    let rootId: string;
    let frameId: string;
    let ox = originX;
    let oy = originY;
    let bgDark: boolean | null = null;
    if (target) {
      frameId = rootId = target.id;
      out = [target];
    } else {
      const mobile = width <= 500 && height >= 600;
      const name = typeof header.name === 'string' && header.name.trim() ? header.name.trim().slice(0, 60) : 'Tela gerada por IA';
      // fundo: cor sólida OU camadas/degradê/ruído ("backgroundFills", "backgroundGradient", "backgroundNoise", "backgroundEffects")
      const bgStyle = styleFromItem({ fills: header.backgroundFills, gradient: header.backgroundGradient, effects: header.backgroundEffects, noise: header.backgroundNoise });
      const bg = color(header.background, bgStyle.fill || '#FFFFFF');
      // tema (tinta da barra de status/indicador home) pelo fundo REAL: degradê/camadas valem mais que a cor base
      if (bgStyle.fills) bgDark = isDarkColor(avgFillHex(bgStyle.fills) || bg);
      const dev = buildDevice(
        { name, width, height, kind: mobile ? 'iphone-island' : 'plain', radius: mobile ? 55 : 0 },
        { idGen: () => uid('dev'), pageId: this.req.pageId, x: originX, y: originY, z: this.z, isDark: bgDark ?? isDarkColor(bg), name, icons: this.req.icons, background: bg }
      );
      out = dev.shapes;
      rootId = dev.rootId;
      frameId = dev.screenId; // o conteúdo da IA entra na tela, dentro do aparelho
      if (bgStyle.fills || bgStyle.effects) {
        out = out.map((sh) => (sh.id === dev.screenId ? { ...sh, ...bgStyle, fill: bgStyle.fill || sh.fill } : sh));
      }
      ox = dev.screenX;
      oy = dev.screenY;
      this.z = dev.zNext;
      this.cursorX += dev.rootWidth + SCREEN_GAP;
      this.totalWidth = this.cursorX - SCREEN_GAP - this.req.startX;
      this.maxHeight = Math.max(this.maxHeight, dev.rootHeight);
    }
    this.frameIds.push(rootId);
    this.screens_.push({ rootId, width, height });
    this.all.push(...out);
    // o tema vem do fundo que a IA escolheu, não do tema do app
    const bg = target ? target.fill : color(header.background, '#FFFFFF');
    this.ctx = { frameId, originX: ox, originY: oy, width, height, pageId: this.req.pageId, isDark: bgDark ?? isDarkColor(bg), accentColor: this.req.accentColor, icons: this.req.icons, containers: [], pending: this.pending, lookup: this.lookup, textMeta: this.textMeta, tokens: this.req.tokens, assets: this.req.projectAssets ? Object.fromEntries(this.req.projectAssets.map((a) => [a.id, a.path])) : undefined };
    return out;
  }

  addItem(rawItem: any): Shape | null {
    if (!this.ctx) this.startScreen({});
    if (!this.ctx || this.items >= MAX_SCREENS * MAX_SHAPES) return null;
    let item = rawItem;
    // rede de segurança: a hora da barra de status já vem do aparelho ("9:41" duplicado quando a IA copia da referência)
    if (item?.type === 'text' && /^\s*\d{1,2}:\d{2}\s*$/.test(String(item.text ?? '')) && Number(item.y ?? 0) < MOBILE_SAFE.top && this.ctx.width < 600) return null;
    // rede de segurança: navbar/tab bar horizontal dentro do layout principal da tela vira barra fixa na base
    // (a IA costuma esquecer o "pin" e a barra subiria para o meio da tela, logo após o conteúdo)
    if (item && item.type === 'frame' && !item.pin && item.layout === 'horizontal' && NAVBAR_NAME.test(String(item.name || ''))) {
      const parent = typeof item.parent === 'string' && item.parent !== 'root' ? this.lookup(item.parent) : undefined;
      if (!parent || (parent.hasAutoLayout && parent.height >= this.ctx.height * 0.9)) item = { ...item, pin: 'bottom' };
    }
    let chartSpec: ChartSpec | null = null;
    if (item?.type === 'chart') {
      chartSpec = normalizeChartSpec(item);
      if (!chartSpec) return null;
      item = { type: 'frame', id: item.id, parent: item.parent, name: item.name || 'Gráfico', x: item.x, y: item.y, width: item.width ?? 'fill', height: typeof item.height === 'number' ? item.height : 160, fill: 'transparent', clip: true };
    }
    this.ensureFlowParent(item);
    const shape = convertAiItem(item, this.ctx, this.z);
    if (shape && chartSpec) this.charts.set(shape.id, { spec: chartSpec, w: 0, h: 0, childIds: [] });
    if (shape) {
      this.z++;
      this.items++;
      this.all.push(shape);
      if (typeof item.id === 'string') this.aiIds.set(item.id, shape.id);
      if (!this.rootFlowId && shape.type === 'frame' && shape.hasAutoLayout && shape.parentId === this.ctx.frameId && !(item.pin === 'bottom' || item.pin === 'top') && this.isMainFlow(item)) {
        this.rootFlowId = shape.id;
        this.aiIds.set('__flow', shape.id);
      }
      if ((item.pin === 'bottom' || item.pin === 'top') && item.type === 'frame') {
        this.pins.set(shape.id, { edge: item.pin, top: this.ctx.originY, bottom: this.ctx.originY + this.ctx.height, inset: num(item.inset, 0, 0, 200) });
      }
    }
    return shape;
  }

  /** O frame é o layout principal da tela (ocupa a tela toda), e não só uma seção. */
  private isMainFlow(item: any): boolean {
    if (!item || item.type !== 'frame' || !item.layout || !this.ctx) return false;
    const h = item.height;
    return h === 'fill' || (typeof h === 'number' && h >= this.ctx.height * 0.8) || (typeof h === 'string' && parseFloat(h) >= this.ctx.height * 0.8);
  }

  /**
   * A IA às vezes esquece o "layout" de um frame e declara os filhos sem x/y (esperando fluxo): todos empilhariam no
   * canto. Se o pai declarado não tem auto layout e o filho não traz posição, o pai vira um layout vertical.
   * Também: pai desconhecido (id errado) cai no layout principal da tela em vez de ir para o canto.
   */
  private ensureFlowParent(item: any): void {
    if (!item || item.pin || item.x != null || item.y != null || !this.ctx) return;
    // Sem "parent" e sem x/y: a IA esperava fluxo (ex.: seções soltas depois do frame "Conteúdo"). Entra no layout
    // principal da tela, que é criado aqui se a IA não declarou nenhum — senão tudo empilharia no canto.
    if (item.parent == null || item.parent === 'root') {
      if (!this.rootFlowId && this.isMainFlow(item)) return; // este É o layout principal
      if (!this.rootFlowId) {
        const mobile = this.ctx.width <= 500 && this.ctx.height >= 600;
        this.addItem({ type: 'frame', id: '__flow', name: 'Conteúdo', layout: 'vertical', gap: 12, padding: mobile ? [56, 0, 0, 0] : 0, x: 0, y: 0, width: this.ctx.width, height: this.ctx.height });
      }
      item.parent = '__flow';
      return;
    }
    if (typeof item.parent !== 'string') return;
    let parent = this.lookup(item.parent);
    if (!parent) {
      // id inexistente: o item entra no fim do layout principal da tela (em vez de ir para o canto)
      const root = this.rootFlowId ? this.all.find((s) => s.id === this.rootFlowId) : undefined;
      if (root) {
        item.parent = [...this.aiIds.entries()].find(([, id]) => id === root.id)?.[0] ?? item.parent;
        parent = root;
      }
    }
    if (!parent || (parent.type !== 'frame' && parent.type !== 'section') || parent.hasAutoLayout || parent.deviceScreen || parent.deviceChrome) return;
    this.patch(parent.id, { hasAutoLayout: true, layoutFlow: 'vertical', layoutGap: parent.layoutGap ?? 8, independentPadding: true, paddingTop: parent.paddingTop ?? 0, paddingRight: parent.paddingRight ?? 0, paddingBottom: parent.paddingBottom ?? 0, paddingLeft: parent.paddingLeft ?? 0, layoutAlign: parent.layoutAlign ?? 'top-left', heightMode: parent.heightMode ?? 'hug' });
  }

  /** Aplica o auto layout (hug/fill/posições) e reajusta os textos "fill" à largura final. */
  /** Cola as barras "pin" na borda da tela (a altura delas muda quando recebem filhos). */
  private applyPins(): void {
    for (const [id, p] of this.pins) {
      const s = this.all.find((x) => x.id === id);
      if (!s) continue;
      const y = p.edge === 'bottom' ? p.bottom - s.height - p.inset : p.top + p.inset;
      const dy = Math.round(y - s.y);
      if (!dy) continue;
      const ids = [id, ...descendantIds(this.all, id)];
      this.all = applyDeltas(this.all, new Map(ids.map((i) => [i, { dx: 0, dy }])));
    }
  }

  /**
   * Em uma linha horizontal onde um TEXTO é "fill", os outros itens "fill" que são compactos (botão de ícone, badge,
   * pílula: poucos elementos e só texto curto) viram "hug": a IA costuma marcá-los "fill" por engano e eles
   * ficariam gigantes, espremendo o texto ao lado.
   */
  private compactFillToHug(): void {
    const kidsOf = new Map<string, Shape[]>();
    for (const s of this.all) if (s.parentId) (kidsOf.get(s.parentId) || kidsOf.set(s.parentId, []).get(s.parentId)!).push(s);
    const subtree = (id: string): Shape[] => (kidsOf.get(id) || []).flatMap((k) => [k, ...subtree(k.id)]);
    for (const row of this.all) {
      if (row.type !== 'frame' || !row.hasAutoLayout || row.layoutFlow !== 'horizontal') continue;
      const kids = kidsOf.get(row.id) || [];
      if (!kids.some((k) => k.type === 'text' && k.widthMode === 'fill')) continue;
      for (const k of kids) {
        // "fill" ou largura fixa quase da linha inteira (a IA copia a largura do pai por engano)
        const stretched = k.widthMode === 'fill' || (k.widthMode === 'fixed' && k.width >= row.width * 0.8);
        if (k.type !== 'frame' || !stretched || !k.hasAutoLayout) continue;
        const inner = subtree(k.id);
        const compact = inner.length <= 3 && inner.every((x) => x.type !== 'text' || (x.text || '').length <= 20);
        if (compact) this.patch(k.id, { widthMode: 'hug' });
      }
    }
  }

  /** Colunas "fill" lado a lado (cards, métricas): ficam com a mesma altura (esticam), como no Figma ("align stretch"). */
  private equalizeRows(): void {
    for (const row of this.all) {
      if (row.type !== 'frame' || !row.hasAutoLayout || row.layoutFlow !== 'horizontal') continue;
      const cols = this.all.filter((k) => k.parentId === row.id && k.type === 'frame' && k.widthMode === 'fill' && k.heightMode === 'hug');
      if (cols.length >= 2) cols.forEach((c) => this.patch(c.id, { heightMode: 'fill' }));
    }
  }

  settle(): void {
    this.compactFillToHug();
    this.equalizeRows();
    for (let i = 0; i < 3; i++) {
      this.all = relayoutAll(this.all);
      let changed = false;
      this.all = this.all.map((s) => {
        const m = this.textMeta.get(s.id);
        if (!m || s.widthMode !== 'fill') return s;
        // rótulos/valores curtos ficam em uma linha (igual ao auto layout)
        if (m.raw.length <= 20 && !m.raw.includes('\n')) {
          const h = Math.ceil(m.size * 1.25);
          if (s.text === m.raw && s.height === h && s.fontSize === m.size) return s;
          changed = true;
          return { ...s, text: m.raw, fontSize: m.size, height: h };
        }
        const fit = fitText({ text: m.raw, width: s.width, fontSize: m.size, weight: m.weight, align: m.align, maxWidth: s.width, maxHeight: 800, singleLine: m.singleLine });
        if (fit.text === s.text && fit.height === s.height && fit.fontSize === s.fontSize) return s;
        changed = true;
        return { ...s, text: fit.text, fontSize: fit.fontSize, height: fit.height };
      });
      if (!changed) break;
    }
    this.applyOverlays();
    this.applyPins();
    this.buildCharts();
  }

  /** Itens sobrepostos presos a um canto: refaz a posição pelo tamanho final do pai (e leva os filhos junto). */
  private applyOverlays(): void {
    for (const s of this.all.filter((x) => x.overlayAnchor)) {
      const parent = this.all.find((x) => x.id === s.parentId);
      if (!parent) continue;
      const pos = overlayPosition(s.overlayAnchor!, parent, s.width, s.height);
      const dx = Math.round(pos.x - s.x), dy = Math.round(pos.y - s.y);
      if (!dx && !dy) continue;
      const ids = new Set<string>([s.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const k of this.all) if (k.parentId && ids.has(k.parentId) && !ids.has(k.id)) { ids.add(k.id); grew = true; }
      }
      this.all = this.all.map((k) => (ids.has(k.id) ? { ...k, x: k.x + dx, y: k.y + dy } : k));
    }
  }

  /** (Re)desenha os gráficos cujo frame mudou de tamanho (o auto layout só define a largura final depois de criado). */
  private buildCharts(): void {
    if (!this.charts.size || !this.ctx) return;
    for (const [id, rec] of this.charts) {
      const f = this.all.find((x) => x.id === id);
      if (!f) continue;
      const w = Math.round(f.width), h = Math.round(f.height);
      if (w === rec.w && h === rec.h) continue;
      const gone = new Set(rec.childIds);
      const kids = buildChartShapes(rec.spec, { x: f.x, y: f.y, w: f.width, h: f.height }, { pageId: f.pageId || this.req.pageId, parentId: f.id, z: f.zIndex + 1, isDark: this.ctx.isDark });
      this.all = [...this.all.filter((x) => !gone.has(x.id)), ...kids];
      rec.childIds = kids.map((k) => k.id);
      rec.w = w;
      rec.h = h;
    }
  }

  patch(id: string, fields: Partial<Shape>): void {
    this.all = this.all.map((s) => (s.id === id ? { ...s, ...fields } : s));
  }
}

/** Valida e converte a resposta da IA em shapes (coordenadas absolutas no canvas). Aceita uma tela ({shapes}) ou várias ({screens}). Null se inutilizável. */
export function parseAiScreenResponse(
  raw: string,
  req: Pick<AiScreenRequest, 'pageId' | 'startX' | 'startY' | 'isDark' | 'accentColor' | 'targetFrame' | 'icons'>
): { shapes: Shape[]; mainFrameId: string; width: number; height: number; pending: PendingImage[] } | null {
  const data = extractJson(raw);
  if (!data) return null;
  const target = req.targetFrame || null;
  const screens: any[] = Array.isArray(data.screens) && !target ? data.screens.slice(0, MAX_SCREENS) : Array.isArray(data.shapes) ? [data] : [];
  if (!screens.length) return null;
  const b = new ScreenBuilder(req);
  for (const screen of screens) {
    if (!screen || !Array.isArray(screen.shapes) || screen.shapes.length === 0) continue;
    b.startScreen(screen);
    // settle a cada item, como no streaming: cada novo filho entra no fim do fluxo já com os tamanhos finais dos anteriores
    for (const item of screen.shapes.slice(0, MAX_SHAPES)) if (b.addItem(item)) b.settle();
  }
  if (b.itemCount === 0) return null;
  return { shapes: b.all, mainFrameId: b.frameIds[0], width: target ? target.width : b.totalWidth, height: target ? target.height : b.maxHeight, pending: b.pending };
}

const CLI_BY_PROVIDER: Record<string, string> = { claude: 'claude', antigravity: 'agy', agy: 'agy', codex: 'codex', gemini: 'gemini', ollama: 'ollama' };

/**
 * Pede o layout à CLI de IA escolhida e devolve o texto bruto. `onText` recebe os trechos conforme chegam
 * (a CLI do Claude é executada em stream-json). Lança erro em falha ou timeout.
 */
export async function requestAiScreenRaw(
  prompt: string,
  provider: string | undefined,
  model: string | undefined,
  cwd: string | undefined,
  timeoutMs = 480000,
  onText?: (chunk: string) => void,
  additionalDirs?: string[],
  stallMs = 0
): Promise<string> {
  const api = (window as any).electronAPI?.ai;
  if (!api?.runCli) throw new Error('CLI de IA indisponível');
  const cliCmd = CLI_BY_PROVIDER[(provider || 'claude').toLowerCase()] || 'claude';
  const streamId = crypto.randomUUID(); // várias gerações em paralelo: cada uma só lê o próprio texto e cancela só a si mesma
  let timer: any;
  let stallTimer: any;
  let lastText = Date.now();
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      api.cancel?.(undefined, cwd, streamId);
      reject(new Error('A IA demorou demais para responder'));
    }, timeoutMs);
    // sem nenhum texto por "stallMs": a CLI travou (melhor falhar cedo e deixar quem chamou tentar de novo)
    if (stallMs > 0 && onText) {
      stallTimer = setInterval(() => {
        if (Date.now() - lastText < stallMs) return;
        api.cancel?.(undefined, cwd, streamId);
        reject(new Error('STALL: a IA ficou sem responder'));
      }, 5000);
    }
  });
  const off = onText && api.onOrchestratorEvent
    ? api.onOrchestratorEvent((e: any) => {
        if (e?.kind === 'progress' && e.message === 'stdout' && typeof e.payload?.text === 'string' && e.provider === cliCmd && (e.payload.streamId === undefined || e.payload.streamId === streamId)) {
          lastText = Date.now();
          onText(e.payload.text);
        }
      })
    : null;
  try {
    const res = await Promise.race([api.runCli({ cliCmd, prompt, model, cwd, additionalDirs, streamText: !!onText, streamId }), timeout]);
    if (res?.exitCode && res.exitCode !== 0 && !res.stdout) throw new Error(res.stderr || 'A CLI de IA falhou');
    return String(res?.stdout || '');
  } finally {
    clearTimeout(timer);
    clearInterval(stallTimer);
    off?.();
  }
}

/** Mobile ou desktop a partir do pedido (e da proporção da imagem de referência, se houver): vale para o frame provisório. */
export function guessScreenFormat(prompt: string, aspect?: number): { mobile: boolean; width: number; height: number } {
  const desktop = /\b(desktop|web|site|landing|dashboard|painel|admin|computador|notebook|navegador|saas|backoffice|sistema web)\b/i.test(prompt);
  const mobile = /\b(mobile|app|aplicativo|celular|iphone|android|smartphone)\b/i.test(prompt);
  const isMobile = aspect ? aspect < 1.1 && !(desktop && !mobile) : !(desktop && !mobile);
  return isMobile ? { mobile: true, width: 393, height: 852 } : { mobile: false, width: 1440, height: 900 };
}
