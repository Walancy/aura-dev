// Ponte da aba Sites com a CLI de IA: a CLI roda dentro da pasta do site e cria/edita o index.html diretamente.
import { requestAiScreenRaw } from '../design2/aiScreenFromLlm';
import { resolveCliModel } from '../design2/aiModel';
import { AURA_3D_GUIDE } from './siteThreeEngine';
import { SITE_RULES, freeTemplate, REACTBITS_KIT, FONT_MATCH_KIT, BG_REMOVAL_KIT } from './siteTemplates';
import { AURA_FX_GUIDE } from './siteMotionEngine';
import type { SiteSelection } from './siteInspector';

export interface SiteReference {
  /** páginas capturadas (pasta _reference/ do site): host, capturas e se há CSS */
  pages: Array<{ host: string; url: string; shots: string[]; hasCss: boolean; three?: boolean; rebuild?: { paths: string[]; media: number } }>;
  /** imagens anexadas pelo usuário, já copiadas para _reference/ */
  images: string[];
}

/** O pedido manda USAR a imagem anexada no site (fundo do hero, logo, foto...) em vez de só servir de referência visual? */
export const wantsAttachedImage = (request: string): boolean =>
  /(imagem|foto|logo|logotipo|banner|print|screenshot|arquivo)s?\s+(que\s+)?(anexad|enviad|mandei|subi|carreguei)/i.test(request) ||
  /(usar?|use|usa|coloc\w*|p[õo]e|ponha|insir\w*|adicion\w*|inclu\w*|aplic\w*|troque?|substitu\w*)\b[^.\n]{0,70}\b(essa|esta|a|minha|nossa|dessa|desta)\s+(imagem|foto|logo|logotipo)/i.test(request) ||
  /(minha|nossa)\s+(foto|imagem|logo|logotipo)/i.test(request);

/** Recriação completa: o conteúdo (textos, dados, mídias) vem do site de referência; o visual é novo. */
export function rebuildBlock(ref?: SiteReference): string {
  const p = ref?.pages.find((x) => x.rebuild);
  if (!p?.rebuild) return '';
  const paths = p.rebuild.paths;
  return `RECRIAÇÃO COMPLETA DE ${p.url} (pasta _reference/ dentro do site; leia ANTES de escrever):
- content.md: o conteúdo real extraído de ${paths.length} ${paths.length === 1 ? 'página' : 'páginas'} (${paths.join(', ')}), na ordem em que aparece: títulos, textos, listas, tabelas, links, botões, formulários, contatos, redes sociais e dados estruturados. Leia o arquivo inteiro.
- media-N.ext: ${p.rebuild.media} imagens baixadas do site (a lista com descrição, página de origem e endereço original está no fim do content.md). Abra as principais para saber o que mostram.
- shot-N.png e page-*.png: capturas do site atual, SÓ para você entender o negócio, a marca (logo, cores da marca) e o que existe hoje. Não são o modelo do visual novo. page.html e styles.css são o código original, para consultar detalhes de conteúdo.

O QUE FAZER
1. CONTEÚDO: reaproveite TODO o conteúdo útil do site original: nome da empresa, textos (pode revisar e melhorar a redação e o tom, sem mudar o sentido), serviços, produtos, preços, números, depoimentos, equipe, endereço, horários, telefones, e-mails, redes, links externos, perguntas frequentes, formulários e SEO (título, descrição, idioma). NUNCA invente dados que não estão no content.md (preço, telefone, endereço, cliente, número, depoimento); se faltar algo importante, deixe de fora ou use um texto genérico sem fatos e avise no resumo.
2. MÍDIAS: reaproveite as imagens do site: <img data-asset="media-N.ext" alt="..." width="..." height="..."> (o app embute o arquivo; não use base64 nem o endereço original quando houver o arquivo). Vídeos ficam com o endereço original no src. Logo: use o arquivo baixado se houver; se for SVG inline que não veio, recrie em texto/SVG simples com o nome da marca. Só use <img data-photo> (foto de banco) onde o site original não tem imagem para aquele espaço. Imagens pequenas ou de baixa resolução: não as use grandes em sangria (use em cartões, galerias ou miniaturas).
3. DESIGN TOTALMENTE NOVO E COM CONCEITO: antes do código, escreva no PLANO o conceito visual nascido do negócio, as 3 assinaturas e o que o site evita (regra ANTI-GENÉRICO). Use as fotos do próprio site como protagonistas (grandes, com recortes e enquadramentos ousados). Ignore o layout, a grade, a tipografia, as animações e a composição do site original. Crie uma identidade visual atual e moderna, com conceito próprio, tipografia de impacto, hierarquia clara, layouts diferentes em cada seção e animações ricas, como um site premiado de 2026. Mantenha só a essência da marca: o nome, o logo e a cor principal da marca (que pode virar a cor de destaque numa paleta renovada, ou ser reinterpretada se for datada ou sem contraste). O resultado não pode parecer o site antigo com outra cor.
4. ESTRUTURA E PÁGINAS: o arquivo é um único index.html. Cada página do site original vira uma visão dentro dele: com poucas páginas curtas, seções em rolagem única com âncoras; com várias páginas, use roteamento por hash (#/servicos, #/contato) com <section data-page="..."> mostrando só a ativa, com transição entre elas, título do documento atualizado, botão voltar do navegador funcionando e o menu marcando a página atual. Preserve a hierarquia de navegação (menu, rodapé, CTAs) do site original, reorganizando só se melhorar. Nada de links quebrados: todo link interno aponta para uma seção ou visão que existe; links externos mantêm o endereço original.
5. PRECEDÊNCIA: o conteúdo do site original manda sobre qualquer plano de seções, número de seções ou sequência sugerida no modelo; as regras de design e de arquivo continuam valendo. Reorganize e melhore a ordem das seções para converter melhor (prova social perto do CTA, serviços antes de preços), mantendo todo o conteúdo relevante. Remova só o que é lixo (banners de cookies, avisos do construtor de sites, menus duplicados, textos de "carregando").
6. Não copie código, CSS nem scripts do site original: escreva tudo novo. Textos e imagens são do dono do site; se o conteúdo parecer de terceiros (loja de outra marca, notícias, material protegido), diga isso no resumo.
7. Na resposta final, liste em até 4 linhas: páginas recriadas, o que foi reaproveitado, o que foi decidido mudar e o que faltou (dados ausentes).`;
}

/** Skills de design lidas pela IA nas gerações de site (preenchido pelo app antes de cada execução). */
export interface SiteSkill { id: string; name: string; path: string }
let siteSkills: SiteSkill[] = [];
export const setSiteSkills = (list: SiteSkill[]) => {
  siteSkills = list;
};

const SKILL_USE: Record<string, string> = {
  'design-taste-frontend': 'TASTE: direção de arte anti-genérica (conceito, composição, tipografia, paleta, fotos). Aplique-a ao escolher o conceito e o layout e rode o laço de olhar e corrigir.',
  'web-design-guidelines': 'WEB DESIGN GUIDELINES: confira o resultado contra as diretrizes de interface, acessibilidade e UX (contraste, foco, alvos de toque, semântica, responsivo).',
  'awesome-design-md': 'AWESOME DESIGN MD: coleção de DESIGN.md de marcas reais; escolha 1 ou 2 que combinem com o conceito e inspire-se na forma de documentar tokens, tipografia, espaçamento e componentes, sem copiar a marca.',
  'playwright-cli': 'PLAYWRIGHT CLI: ao terminar, abra o index.html no navegador com o playwright-cli, tire capturas em 1440, 768 e 390 de largura, olhe as imagens e corrija o que estiver quebrado (se o comando não existir, pule este passo).',
};

/** Bloco que manda a IA ler e seguir as skills de design antes de escrever e conferir depois. */
export function skillsBlock(compact = false): string {
  const list = siteSkills.filter((s) => SKILL_USE[s.id]);
  if (!list.length) return '';
  const lines = list.map((s) => `- ${SKILL_USE[s.id]} Instruções: ${s.path}`).join('\n');
  return `SKILLS DE DESIGN (obrigatório${compact ? ' se o pedido mexer no visual' : ''}): ${compact ? 'leia o SKILL.md de cada uma antes de editar o visual' : 'ANTES de escrever qualquer código, leia o SKILL.md de cada uma abaixo e siga o que ele manda'}:
${lines}
Em conflito, valem as REGRAS DO ARQUIVO e o pedido do usuário (um único index.html, fonte e UI definidos nas regras); as skills decidem o resto do design.
`;
}

export function referenceBlock(ref?: SiteReference, assetMode = false): string {
  if (!ref || (!ref.pages.length && !ref.images.length)) return '';
  if (ref.pages.some((p) => p.rebuild)) return rebuildBlock(ref);
  const lines: string[] = ['REFERÊNCIA VISUAL (pasta _reference/ dentro do site; abra as imagens e leia os arquivos antes de escrever):'];
  if (ref.pages.length) {
    lines.push(`- ${ref.pages[0].url}: shot-N.png são capturas da página de cima para baixo, page.html é o HTML renderizado${ref.pages[0].hasCss ? ' e styles.css o CSS dela' : ''}. Extraia dali a estrutura de seções, o layout, a grade, a tipografia, a paleta, os espaçamentos e as animações/interações.`);
  }
  const three = ref.pages.find((p) => p.three);
  if (three) {
    lines.push(`- ${three.url} é uma EXPERIÊNCIA 3D (WebGL/Three.js). Além dos shot-N.png (scroll), há motion-N.png (quadros em sequência com o mouse se mexendo) e three-notes.md (resumo técnico: biblioteca, shaders, técnicas, uniforms). Leia o three-notes.md, descreva em palavras o efeito 3D que você vê (formas, cores, movimento, reação ao scroll e ao mouse) e RECRIE-O de forma ORIGINAL com as cenas AURA 3D (veja o guia). Não copie código, shaders, modelos nem texturas da página: só a ideia, a composição e o ritmo.`);
  }
  if (assetMode && ref.images.length) {
    lines.length = 0;
    if (ref.pages.length) lines.push(`REFERÊNCIA VISUAL (pasta _reference/): páginas capturadas de ${ref.pages.map((p) => p.url).join(', ')}.`);
    lines.push(`IMAGENS ANEXADAS PARA USAR NO SITE (arquivos em _reference/: ${ref.images.join(', ')}). O usuário pediu para usar a imagem anexada no site: ela é CONTEÚDO, não um modelo de layout. Abra-a para ver o que mostra, decida onde entra conforme o pedido (fundo do hero, logo, foto de seção...) e insira assim, sem base64: <img data-asset="${ref.images[0]}" alt="..." width="..." height="..."> ou, em CSS, background-image:url('asset:${ref.images[0]}'). O app troca isso pela imagem embutida quando você terminar. Se precisar do sujeito sem fundo, use também data-cutout na <img>. Se for fundo de seção, garanta contraste do texto (overlay leve só se necessário), object-fit/background-size: cover e foco no ponto certo. Não recrie o visual da imagem como layout, não a descreva com SVG/CSS e não a substitua por foto de banco.`);
    return lines.join('\n');
  }
  if (ref.images.length) lines.push(`- Screenshots enviados pelo usuário: ${ref.images.map((i) => `_reference/${i}`).join(', ')}. Reproduza o layout e o visual mostrados.`);
  lines.push('Recrie o VISUAL e a estrutura dessa referência no nosso index.html, mas com os textos, o nome e o conteúdo do negócio do usuário. Não copie textos, logos, marcas nem imagens protegidas: use <img data-photo="..."> para fotos e ícones SVG próprios. Se algo na referência não puder ser reproduzido com fidelidade, diga na resposta.');
  return lines.join('\n');
}

/** Kit de identificação de fonte: com referência visual ou quando o pedido fala de fonte/tipografia. */
const fontBlock = (ref: SiteReference | undefined, request: string): string =>
  (ref && (ref.pages.length || (ref.images.length && !wantsAttachedImage(request)))) || /fonte|tipografia|typeface|\bfont\b|letra/i.test(request) ? `\n${FONT_MATCH_KIT}\n` : '';

/** Pedido ou referência 3D: entra o guia das cenas AURA 3D (Three.js testado). */
const wants3d = (request: string, ref?: SiteReference): boolean => !!ref?.pages.some((p) => p.three) || /\b3d\b|three\.?js|webgl|tridimensional|shader|imersiv|part[ií]culas|esfera|orb\b|modelo 3d|glb|mesh3d/i.test(request);
const threeBlock = (request: string, ref?: SiteReference): string => (wants3d(request, ref) ? `\nPRECEDÊNCIA: para as cenas 3D, a regra "Nenhuma biblioteca externa de JS" não vale: o Three.js 0.160 via CDN (importado pelo bloco AURA 3D) é autorizado. Canvas 3D atrás do texto do hero também é permitido (a regra de não pôr efeito por cima de fotos continua valendo).\n${AURA_3D_GUIDE}\n` : '');

const OUTPUT_RULE = `Ao terminar, responda em português, em até 4 linhas, o que foi feito. Não cole o código na resposta.`;

export function buildCreatePrompt(o: { brief: string; templateName: string; description: string; siteName: string; projectName?: string; hasSkeleton: boolean; custom?: boolean; free?: boolean; reference?: SiteReference; selection?: SiteSelection[] }): string {
  const task = o.hasSkeleton
    ? `O index.html atual é o esqueleto do modelo "${o.templateName}" com textos e seções de exemplo: mantenha a direção de arte dele (paleta, fontes, ritmo) e transforme-o no site real do negócio abaixo, trocando todo o conteúdo, ajustando/criando as seções que fizerem sentido e removendo o que não se aplica.`
    : `Crie o arquivo index.html seguindo o modelo "${o.templateName}" abaixo.`;
  const sel = o.selection?.length
    ? `\nELEMENTOS SELECIONADOS NO PREVIEW DO MODELO (dê atenção especial a estes elementos no pedido):\n${o.selection.map((s, i) => `--- ${i + 1}. ${s.label} (seletor: ${s.path})\n${s.html}`).join('\n')}\n`
    : '';
  return `Você está na pasta de um site novo chamado "${o.siteName}"${o.projectName ? ` (projeto ${o.projectName})` : ''}. ${task}

O QUE O SITE É (descrição do usuário):
${o.description.trim()}
${sel}
MODELO
${o.brief.trim()}

${skillsBlock()}
${referenceBlock(o.reference, wantsAttachedImage(o.description))}
${fontBlock(o.reference, o.description)}${threeBlock(o.description, o.reference)}
${SITE_RULES}

${BG_REMOVAL_KIT}
${o.free ? `\nPRECEDÊNCIA: nesta criação livre, a regra "Nenhuma biblioteca externa de JS" não vale: o MODELO acima autoriza bibliotecas via CDN com versão fixa (React, GSAP, Lenis, ogl, three etc.), e o uso do React Bits é obrigatório (só quando NÃO há referência visual: com referência, o React Bits é opcional e a fidelidade à referência vem primeiro). Ignore também "preserve as animações do modelo base" (não há modelo base) e crie animações próprias, ricas e fluidas. As demais regras continuam valendo. Cores, tema e estilo pedidos pelo usuário têm prioridade sobre a direção de arte do modelo.\n` : ''}${o.custom ? `\nPRECEDÊNCIA: o MODELO acima é um prompt completo de recriação de site e manda sobre as regras do arquivo no que for conflitante (bibliotecas via CDN/importmap, imagens de URLs indicadas, estrutura de seções, textos e identidade). Siga-o fielmente e use a descrição do usuário para adaptar marca, nome e conteúdo ao negócio dele, sem perder o visual e as interações do modelo.\n` : ''}
${OUTPUT_RULE}`;
}

export function buildEditPrompt(o: { request: string; selection: SiteSelection[]; siteName: string; reference?: SiteReference; blank?: boolean }): string {
  const sel = o.selection.length
    ? `ELEMENTOS SELECIONADOS NO PREVIEW (o pedido é sobre eles; localize cada um no index.html pelo seletor e pelo HTML):
${o.selection.map((s, i) => `--- ${i + 1}. ${s.label} (seletor: ${s.path})\n${s.html}`).join('\n')}

Altere só o necessário nesses elementos (e o CSS/JS ligado a eles). O resto do arquivo fica igual.`
    : `Nenhum elemento selecionado: o pedido vale para o site inteiro, mas mantenha o que não foi pedido como está.`;
  const patch = o.blank ? '' : `\nMODO DE EDIÇÃO: faça edições pontuais (substitua só os trechos afetados com a ferramenta de edição) em vez de reescrever o arquivo inteiro. Reaproveite os tokens do :root e as classes que já existem (leia o comentário PLANO no topo); crie tokens/classes novos só se faltarem. Não apague conteúdo nem seções que o pedido não citou.\n`;
  const blank = o.blank ? `\nO index.html atual é só um marcador de projeto em branco: reescreva-o por completo como um site novo.\n${freeTemplate(!!(o.reference && (o.reference.pages.length || (o.reference.images.length && !wantsAttachedImage(o.request))))).brief}\nPRECEDÊNCIA: nesta criação livre, bibliotecas via CDN com versão fixa (React, GSAP, Lenis, ogl, three etc.), e o uso do React Bits é obrigatório são permitidas e as animações são criadas por você; as demais regras continuam valendo.\n` : '';
  const wantsFx = /anima|efeito|fundo|background|hover|cursor|part[ií]cula|gradiente|aurora|brilho|movimento|transi|scroll|carrossel|menu|card/i.test(o.request);
  const fx = wantsFx && !o.blank ? `\n\nSe o pedido envolver animação, efeito, fundo ou componente interativo, use componentes do React Bits (leia o código no GitHub conforme abaixo) em vez de criar do zero. Bibliotecas via CDN com versão fixa são permitidas nesse caso.\nSe o index.html já tiver <script id="aura-fx-js">, use os atributos do motor AURA FX (data-split, data-reveal, data-curtain, data-pin, data-hscroll, data-magnetic, data-tilt...) em vez de escrever lógica nova; se não tiver, cole o motor conforme abaixo.\n${AURA_FX_GUIDE}\n${REACTBITS_KIT}\n` : '';
  return `Você está na pasta do site "${o.siteName}". Edite o arquivo index.html existente conforme o pedido.${blank}

PEDIDO:
${o.request.trim()}

${sel}${patch}${fx}

${skillsBlock(!o.blank)}
${referenceBlock(o.reference, wantsAttachedImage(o.request))}
${fontBlock(o.reference, o.request)}${threeBlock(o.request, o.reference)}
${SITE_RULES}${o.blank || /foto|imagem|pessoa|recort|sem fundo|fundo transparente|png|produto|hero|banner|equipe|retrato|modelo/i.test(o.request) ? `\n\n${BG_REMOVAL_KIT}` : ''}

${OUTPUT_RULE}`;
}

/** Roda a CLI na pasta do site. `onText` recebe a resposta conforme chega; `ctl.abort` interrompe. */
export function runSiteAi(o: { prompt: string; provider: string; model?: string; cwd: string; effort?: 'low' | 'medium' | 'high'; onText: (t: string) => void; ctl: { abort?: (why?: string) => void; onActivity?: (text: string) => void } }): Promise<string> {
  const model = resolveCliModel(o.provider, o.model);
  // o mesmo objeto `ctl` recebe o `abort` de dentro da chamada (uma cópia não receberia)
  const ctl = o.ctl as { abort?: (why?: string) => void; effort?: 'low' | 'medium' | 'high' };
  ctl.effort = o.effort || 'medium';
  return requestAiScreenRaw(o.prompt, o.provider, model, o.cwd, 900000, o.onText, undefined, 0, ctl);
}

/** Pedidos curtos ganham um briefing detalhado, gerado em segundo plano, antes da criação do site. */
export const BRIEF_MAX_CHARS = 600;

export function buildBriefPrompt(description: string, projectName?: string): string {
  return `Você é um diretor de criação e estrategista de sites. O usuário fez um pedido curto e você vai transformá-lo num briefing completo para o designer/desenvolvedor que vai construir o site. O usuário não verá este briefing.

PEDIDO DO USUÁRIO:
${description.trim()}
${projectName ? `\nProjeto: ${projectName}\n` : ''}
Escreva o briefing em português do Brasil, com no máximo 350 palavras, nestas seções curtas:
1. Negócio e público: quem é, o que vende, para quem, diferenciais plausíveis.
2. Objetivo da página e ação principal (CTA).
3. Tom de voz e personalidade da marca.
4. Conceito visual: uma ideia central que nasce do negócio, paleta (com hex), estilo de imagens e ícones. Não escolha fontes: elas são definidas depois.
5. Estrutura: de 5 a 8 seções em ordem, desenhadas para ESTE negócio, cada uma com o conteúdo (títulos e textos reais e específicos, números, nomes, provas). NÃO use a sequência padrão hero, texto, carrossel, cards, preços, CTA: pergunte o que um visitante deste negócio precisa ver para confiar e agir, e crie seções com função própria (por exemplo processo em passos, antes e depois, catálogo, mapa, linha do tempo, números, manifesto, simulador, bastidores). Planos e preços só se o negócio realmente vende planos; carrossel só se houver uma série real de itens.
6. Componentes e interações sugeridos: animações, efeitos de fundo, microinterações, comportamento mobile.

REGRAS
- Tudo o que o usuário especificou (tema claro/escuro, cores, estilo, tipo de componente, idioma, seções) é obrigatório: preserve e nunca contradiga.
- Preencha só o que ele não disse. Invente nomes e números plausíveis, sem afirmar fatos reais sobre empresas existentes.
- Sem emojis. Sem cores pastel. Sem bordas e sem sombras nos componentes.
- Responda apenas com o briefing em texto. Não crie nem edite arquivos, não use ferramentas.`;
}

/** Devolve o briefing, ou '' se a IA não respondeu nada útil. Cancelamento é repassado; outras falhas ficam por conta de quem chama. */
export async function expandSiteBrief(o: { description: string; projectName?: string; provider: string; model?: string; cwd: string; ctl: { abort?: (why?: string) => void } }): Promise<string> {
  const out = await runSiteAi({ prompt: buildBriefPrompt(o.description, o.projectName), provider: o.provider, model: o.model, cwd: o.cwd, effort: 'low', onText: () => {}, ctl: o.ctl });
  const brief = (out || '').trim();
  return brief.length > 120 ? brief : '';
}

export function withBrief(description: string, brief: string): string {
  return brief ? `${description.trim()}\n\nBRIEFING DETALHADO (planejamento interno que complementa o pedido sem contradizê-lo; o pedido original sempre prevalece):\n${brief}` : description;
}

/** CLIs que costumam entregar sites mais fracos numa única passada: recebem uma revisão crítica obrigatória depois da criação. */
export const needsReviewPass = (provider: string) => (provider || 'claude').toLowerCase() !== 'claude';

/** Segunda passada: revisão como diretor de arte + correção dos problemas detectados na checagem estática. */
export function buildPolishPrompt(o: { siteName: string; request: string; issues: string[]; full: boolean; reference?: SiteReference; checkShots?: string[]; rebuild?: SiteReference }): string {
  const shotsNote = o.checkShots?.length ? `CAPTURAS DO SITE RENDERIZADO (pasta _check/: ${o.checkShots.join(', ')}; w1440 = desktop, w768 = tablet, w390 = celular, em ordem de rolagem). ABRA as imagens e confira com os próprios olhos: sobreposições, texto cortado, alinhamentos, espaçamentos irregulares, imagens vazias, o celular parecendo o desktop encolhido, contraste. Corrija o que vir, além da lista de problemas medidos.\n\n` : '';
  const found = shotsNote + (o.issues.length ? `PROBLEMAS DETECTADOS AUTOMATICAMENTE (corrija todos):\n${o.issues.map((i) => `- ${i}`).join('\n')}\n\n` : '');
  const hasRef = !!o.reference && (o.reference.pages.length > 0 || o.reference.images.length > 0);
  const refReview = hasRef
    ? `${referenceBlock(o.reference)}

COMPARAÇÃO COM A REFERÊNCIA (obrigatória): abra a imagem de referência e o index.html lado a lado e corrija, nesta ordem:
1. Assunto, enquadramento, brilho e saturação das fotos: têm de ser iguais aos da referência (consulta do data-photo mais precisa se o assunto estiver errado; sem filtro escurecendo a foto; mesmo degradê de fusão com o fundo). Se a foto estiver errada, troque a consulta do data-photo.
2. Elementos que existem na referência e faltam (decorações, estrelas, linhas-guia, pontos, selos, botões) e elementos que NÃO existem nela e foram acrescentados (índice lateral, loader, cursor customizado, rastro de imagens, marquee): remova os extras.
3. Escala e peso dos títulos, quebras de linha, alinhamentos e espaçamentos do primeiro viewport.
4. Decorações cortadas ou sobrepostas a imagens ou ao texto, e qualquer coisa que pareça "bugada".
5. Cores e formato do nav e dos botões.
6. Seções abaixo do primeiro viewport (a referência não as mostra): se virou título + três cartões iguais, lista "o que fazemos" ou faixa com botão, REESCREVA com a mesma linguagem do hero (tipografia gigante, fotos reais com data-photo, layouts diferentes entre seções, uma tipográfica, uma de imagem em sangria, uma sticky ou com hover).
7. Texto cortado (principalmente no CTA final dentro de pílula/cartão com overflow) e nomes provisórios como "Novo Site".

`
    : '';
  const rebuildReview = o.rebuild
    ? `${rebuildBlock(o.rebuild)}

CONFERÊNCIA DA RECRIAÇÃO (obrigatória, antes de editar): leia o content.md e o index.html e corrija:
1. Conteúdo que existia e sumiu (serviços, preços, textos, contatos, links, formulários, FAQ): traga de volta. Dados inventados que não estão no content.md: remova.
2. Imagens do site original que não foram usadas ou ficaram quebradas (data-asset com nome errado): use os arquivos media-N.
3. Páginas do site original sem visão correspondente, links internos quebrados, rota por hash sem funcionar, menu sem marcar a página atual.
4. Visual: se ainda parece o site antigo, ou genérico (hero centralizado, três cartões iguais), refaça com identidade nova, tipografia de impacto, layouts diferentes entre seções e animações.
5. Texto cortado, contraste ruim, mobile quebrado.

`
    : '';
  const review = o.rebuild ? rebuildReview : hasRef ? refReview : o.full
    ? `REVISÃO CRÍTICA (faça antes de editar): abra o index.html inteiro e avalie como um diretor de arte exigente, comparando com sites premiados do Awwwards. Liste mentalmente os 9 defeitos mais visíveis e corrija TODOS:
1. Cara de genérico: hero centralizado, seções repetidas e a sequência hero, três cartões, etapas em três caixas e faixa de CTA. Faça o TESTE DO NOME (a regra ANTI-GENÉRICO do arquivo): trocando o nome da marca o site serviria para outro negócio? Então refaça o conceito, as 3 assinaturas e os títulos com detalhes concretos do negócio. Dê a cada seção principal um layout próprio.
2. Tipografia: escala dramática no hero (clamp até ~10vw), contraste de tamanhos, line-height apertado nos títulos.
3. Movimento: o site precisa de revelação de textos, microinteração no hover, transições diferentes entre as seções e um efeito de hero com assinatura própria (conforme o plano de movimento do pedido, se houver). Se faltar, escreva o código; não troque por um kit genérico.
4. Imagens: foto real via data-photo para pessoas e produtos (nada de objetos desenhados em SVG/CSS, que ficam bizarros: troque por <img data-photo="...">); nada quebrado ou vazio; toda <img> com fallback (onerror e fundo em gradiente); sujeitos (pessoa, produto) sobrepostos ao design com data-cutout na <img> para o app remover o fundo; nenhum efeito, canvas ou véu por cima das fotos; o hero com 100% de opacidade.
5. Cores e contraste: respeite a paleta pedida, nenhum texto ilegível, sem pastel, sem borda e sem sombra em componentes.
6. Responsivo: confira desktop, tablet (768) e celular (390), menu mobile funcionando, nada estourando a largura.
7. Código: leia o JavaScript procurando erros (variável inexistente, seletor errado, biblioteca não carregada) e corrija; todo efeito pesado com fallback.
8. Títulos gigantes: nenhum glifo cortado (line-height, overflow, margens negativas), texto inteiro visível.
9. Conteúdo: textos reais e específicos do negócio, sem lorem ipsum e sem "...".

`
    : '';
  return `Você está na pasta do site "${o.siteName}". O index.html já existe e é a primeira versão, criada a partir deste pedido do usuário:
"${o.request.trim().slice(0, 600)}"

${found}${review}${skillsBlock()}\nEdite o index.html existente (reescreva por completo se for preciso) para entregar a versão final, mantendo a identidade, a paleta e as fontes já escolhidas e tudo o que o pedido exigia. Nunca encurte nem apague conteúdo bom. O arquivo final precisa ser completo e terminar em </html>.

${SITE_RULES}

${OUTPUT_RULE}`;
}
