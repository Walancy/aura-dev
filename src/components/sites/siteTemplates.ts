// Modelos de site da aba Sites: cada um é um briefing de direção de arte que a IA transforma
// em um index.html autocontido. Os prompts do getlayers.ai não podem ser redistribuídos, então o catálogo é nosso
// e o usuário pode colar um prompt do GetLayers (gratuito ou da conta dele) pelo botão "Prompt do GetLayers".
import { AURA_FX_GUIDE } from './siteMotionEngine';
import type { SampleSpec } from './siteTemplateSample';

export interface SiteTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  /** três cores do cartão de pré-visualização (fundo, destaque, texto) */
  colors: string[];
  brief: string;
  /** página de exemplo (miniatura, preview e esqueleto inicial); um prompt colado do GetLayers não tem */
  sample?: SampleSpec;
  /** modelo do usuário (salvo em ~/.aura-dev/sites/_templates): o prompt dele vale acima das regras genéricas */
  custom?: boolean;
}

export const GETLAYERS_URL = 'https://www.getlayers.ai/templates';

/** Identificação de tipografia: vale quando há imagem/referência ou o pedido fala de fonte. Sobrepõe a fonte padrão (Poppins). */
export const FONT_MATCH_KIT = `IDENTIFICAR A FONTE DA REFERÊNCIA (quando há imagem, captura ou pedido de fonte, a tipografia mostrada manda sobre a fonte padrão Poppins)
1. Observe as letras de verdade (abra a imagem) e descreva antes de escolher: classificação (serifada de alto contraste/didone, transicional, humanista, grotesca, geométrica, slab, script, display decorativa), contraste entre traços grossos e finos, serifas (afiladas, em cunha, retas), terminais, largura (condensada, normal, expandida), caixa (só maiúsculas, versalete), peso, e detalhes únicos (W com traço fino central, G com espora, R com perna longa, ligaduras, itálico com swashes).
2. Procure a fonte exata: se tiver acesso à web, pesquise pelas características e pelo texto da imagem (ex.: "high contrast display serif wide caps hairline W") em fonts.google.com, fontshare.com, fontsource.org e fontsquirrel.com; confira o nome candidato olhando os glifos de amostra. Nunca diga que identificou com certeza sem comparar.
3. Se a exata for paga ou não achar, escolha a gratuita MAIS PRÓXIMA de um destes grupos, e some ajustes de CSS para chegar perto (letter-spacing, font-weight, font-stretch/font-variation-settings, text-transform, line-height apertado, transform scaleY/scaleX só no título quando preciso):
   - Display serifada de alto contraste, moda/luxo/cosméticos: Bodoni Moda, Playfair Display, Italiana, Gilda Display, Bellefair, Cormorant (Infant/Unicase/Garamond), Yeseva One, Abril Fatface, Rozha One, Gloock, Prata, Forum, Cinzel, Cinzel Decorative, Marcellus, Tenor Sans, Limelight, Fraunces (eixos SOFT/WONK/opsz), DM Serif Display, Instrument Serif, Young Serif.
   - Grotescas e geométricas com personalidade: Bricolage Grotesque, Syne, Unbounded, Familjen Grotesk, Schibsted Grotesk, Hanken Grotesk, Archivo (largura expandida), Red Hat Display, Lexend, League Spartan, Krona One, Michroma, Orbitron, Space Grotesk.
   - Condensadas: Anton, Bebas Neue, Oswald, Big Shoulders Display, League Gothic, Antonio, Barlow Condensed.
   - Manuscritas e scripts: Allura, Great Vibes, Pinyon Script, Playball, Caveat, Homemade Apple, Reenie Beanie.
   - Mono e técnicas: JetBrains Mono, IBM Plex Mono, Space Mono, DM Mono, Martian Mono.
   - Fontshare (gratuitas, CSS via https://api.fontshare.com/v2/css?f[]=<slug>@<pesos>&display=swap): Gambetta, Zodiak, Boska, Erode, Sentient, Cabinet Grotesk, Clash Display, Clash Grotesk, Satoshi, General Sans, Switzer, Ranade, Supreme, Melodrama, Chillax, Bespoke Serif, Tanker, Stardom.
4. Importe pelo <link> do Google Fonts/Fontshare com os pesos e estilos usados e declare fallback de sistema parecido (ex.: 'Bodoni Moda', 'Didot', 'Times New Roman', serif). Se a fonte original não existir de forma gratuita, avise na resposta final qual escolheu e por que é a mais próxima.`;

/** Recorte de fundo de fotos: pessoas e produtos sobrepostos ao design (hero estilo "recorte"). A ferramenta é gravada por siteTools.ts. */
export const BG_REMOVAL_KIT = `RECORTE DE FUNDO DE IMAGENS (PNG/WebP com transparência, feito pelo app)
Decida você mesmo quando uma foto precisa ter o fundo removido. É OBRIGATÓRIO recortar quando o sujeito (pessoa, produto, objeto) precisa interagir com o design: hero com pessoa ou produto ao lado/atrás/na frente do título, sujeito sobre gradiente, cor chapada ou fundo escuro, sobreposto a cards e formas, saindo da moldura, colagem/sticker, equipe em cards coloridos. NÃO recorte fotos de fundo de seção, galerias, paisagens, ambientes, nem fotos que aparecem em moldura/retângulo por escolha de design.
Como fazer: coloque o atributo data-cutout na <img>, junto com data-photo (ex.: <img data-cutout data-photo="man portrait studio plain gray background" width="1000" height="1300" alt="...">). Descreva uma foto com sujeito único, bem iluminado e fundo simples, com 1000px ou mais (se o usuário anexou foto, use src="_reference/user-1.png" no lugar de data-photo). Quando você terminar, o app busca a foto, remove o fundo e troca o src por uma imagem com transparência embutida; o atributo some. Não faça o recorte você mesmo e não gere base64.
Escreva o CSS já contando com transparência:
- A imagem é o próprio sujeito: height/width definidos, object-fit: contain (nunca cover em retângulo), sem fundo, sem borda e sem border-radius na <img>; para dar volume use filter: drop-shadow(...) em vez de box-shadow.
- Posicione com position:absolute/relative e z-index acima do fundo e dos efeitos; o título gigante pode passar atrás (z-index menor) ou na frente do sujeito.
- Brilho/cor atrás do sujeito com radial-gradient num elemento irmão ATRÁS (nunca sobre ele); fade inferior curto com mask-image só se o sujeito for cortado pela borda da seção.
- Se o recorte falhar, o app mantém a foto original: o CSS deve continuar funcionando com ela.`;

export const SITE_RULES = `REGRAS DO ARQUIVO
- Um único arquivo index.html autocontido: CSS em <style> e JS em <script> inline. Não crie outros arquivos nem pastas.
- Fonte: Poppins (Google Fonts, <link> com os pesos usados) em todo o site, a menos que o usuário peça outra, envie imagem/referência com tipografia a reproduzir (aí vale a seção IDENTIFICAR A FONTE) ou o modelo base defina a sua. Fontes só do Google Fonts. Ícones em SVG inline. Nenhuma biblioteca externa de JS.
- Imagens: mantenha as imagens/vídeos reais já presentes no esqueleto do modelo. Para foto de pessoa, produto, objeto, lugar, comida, veículo ou ambiente, use SEMPRE foto real: escreva <img data-photo="consulta em inglês" width="..." height="..." alt="..."> (sem src) e o app busca a foto de verdade (Unsplash/Pexels) e embute. A consulta tem 3 a 7 palavras em inglês, com sujeito, contexto e estilo (ex.: "white leather sneaker product photo plain studio background", "young woman portrait natural light studio", "modern concrete house exterior golden hour"); pessoas: "portrait of ...". Use consultas diferentes para fotos diferentes. NUNCA invente URLs/ids de foto. NUNCA desenhe pessoas, rostos, produtos, calçados, objetos, animais, veículos, comida, prédios ou cenas com SVG, CSS, canvas ou emoji: o resultado fica bizarro. SVG/CSS só para ícones, logotipos simples, formas geométricas decorativas, padrões, gráficos de dados e fundos abstratos. Toda <img> leva alt, width/height, loading="lazy" (exceto a do hero) e um fundo em gradiente/cor no próprio elemento ou no wrapper. Nunca caminhos locais quebrados.
- Imagens de pessoas/produtos que interagem com o design (sobre gradiente, atrás/na frente de títulos) devem ter o fundo removido: siga a seção RECORTE DE FUNDO DE IMAGENS, que decide quando e como fazer.
- SISTEMA DE DESIGN (como Framer e Webflow): no topo do <style> declare tokens em :root e use SÓ eles no resto do CSS: cores (--bg, --fg, --muted, --accent, --surface), espaçamento (--space-1..--space-8, padding e gap iguais), raios (--radius), tamanhos de fonte (--fs-xs..--fs-display com clamp()) e easing/duração (--ease, --dur). Nada de hex ou px soltos repetidos. Componentes viram classes reutilizáveis (.btn, .btn--ghost, .card, .eyebrow, .section-title, .chip) usadas em todas as seções, no lugar de style="" inline repetido; variantes de estado (hover, ativo) ficam na própria classe. Títulos em hierarquia: um único <h1>, seções com <h2>, itens com <h3>.
- ANTI-GENÉRICO (obrigatório, antes de escrever qualquer código): o PLANO precisa trazer (1) CONCEITO: uma ideia visual que só serve para ESTE negócio, nascida do que ele faz de verdade (objetos, materiais, lugares, rotina, processo, o gesto do cliente); (2) 3 ASSINATURAS: elementos concretos que se repetem pelo site (uma forma, um gesto de animação, um recurso tipográfico, um tratamento de foto); (3) NÃO FAZ: 3 clichês do setor que este site evita (ex.: clínica com azul-hospital e mãos apertando, advogado com balança, restaurante com prato centralizado no escuro). TESTE DO NOME: se trocar o nome da marca e o site ainda servir para outro negócio, ele é genérico: refaça o conceito. Títulos afirmativos e específicos (nomes de serviços, procedimentos, números, bairros, materiais), nunca "Soluções completas para você". Sem marca definida, escolha uma cor de destaque que NÃO seja a padrão do setor. Fotos grandes, com enquadramentos e recortes ousados e tamanhos diferentes, não miniaturas iguais em cartões.
- PLANO NO ARQUIVO: ao criar ou recriar o site, comece o <head> com um comentário <!-- PLANO: conceito; paleta (hex); fontes e escala; seções em ordem (nome: função e layout); efeito do hero; transições --> e MANTENHA-O atualizado. Nas edições, leia o PLANO antes de mexer para continuar a mesma linguagem.
- Nenhum texto pode ser cortado: título grande dentro de pílula/cartão com overflow:hidden e raio alto precisa de padding generoso (use o mesmo valor em todos os lados), quebra de linha e altura mínima; o container cresce com o texto. Confira a seção final (CTA) e os cartões. Nunca deixe "Novo Site", "Nome da marca" ou outro nome provisório: invente o nome do negócio.
- Responsivo de verdade: desktop (1280+), tablet (768) e celular (390) com menu mobile funcional.
- Cada seção principal em <section id="..."> com um id descritivo, para poder ser editada depois.
- Textos reais e convincentes em português do Brasil (ou no idioma pedido pelo usuário), coerentes com o negócio descrito.
- Micro animações: preserve integralmente todas as animações, interações, cursores e transições do modelo base. Respeite prefers-reduced-motion.
- Acessibilidade: contraste AA, foco visível, alt nas imagens, landmarks (header/nav, main, footer).
- Atributos resolvidos pelo app depois que você termina (NUNCA remova, troque nem tente resolver você mesmo): data-photo (foto de banco; data-photo-id repete a mesma foto em várias camadas), data-cutout (remover fundo) e data-asset / url('asset:nome') (imagem anexada pelo usuário em _reference/).
- Sem selos de terceiros nem de prêmios (Awwwards Honors, "Site of the Day", badges fixos nas laterais): se o modelo base tiver um, remova.
- Sem comentários de código explicativos longos. Sem emojis no conteúdo.
- UI (vale para todo componente, salvo se o usuário pedir outro estilo):
  - Sem bordas nem sombras em botões, cards, inputs e containers: separe por cor de fundo, espaço e tipografia. Divisórias só como linha fina de baixa opacidade.
  - Nada de cores pastel: use cores saturadas e com contraste claro, ou neutros. Confira o contraste de texto sobre cada fundo.
  - Fontes em peso regular e medium, com equilíbrio entre os dois (negrito só em casos pontuais).
  - Ícones: SVG inline de uma única família coerente (traço uniforme, estilo Lucide/Phosphor), do mesmo tamanho e espessura. Nunca emojis.
  - Dropdowns/selects, date pickers e color pickers são sempre customizados (menu próprio, animado, com navegação por teclado); nunca use o <select>, <input type="date"> ou <input type="color"> nativos sem estilização. Dropdown com mais de 5 opções tem campo de busca.
  - Botões, inputs, selects, abas e campos de busca com a mesma altura (ex.: 44px no site, 36px em áreas densas) e mesmo raio.
  - Espaçamento padronizado e curto: padding e gap iguais, escala fixa (4/8/12/16/24/32/48...), sem exageros nem áreas vazias gigantes.
  - Microanimações em hover, foco, abertura de menus e troca de estados (150 a 250ms, ease-out).
  - Reutilize componentes e tokens: defina cores, raios, espaçamentos e fontes como variáveis CSS em :root e use classes reaproveitáveis em vez de estilos repetidos.
  - Poucas camadas de cards/divs aninhadas.
  - Scrollbar bem fina e estilizada em todas as áreas roláveis, só com os pseudo-elementos webkit (não use scrollbar-width nem scrollbar-color, que engrossam a barra): ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:<cor do texto a 28% de opacidade>;border-radius:9px} e o thumb mais forte no :hover.
  - CAMADAS: fundo e efeitos (canvas, pontos, aurora, grain, partículas) ficam atrás de tudo (z-index:0, pointer-events:none); fotos e sujeitos recortados acima (z-index:1) e textos acima de tudo (z-index:2). Nunca ponha efeito, canvas, gradiente ou véu escuro POR CIMA da foto ou do sujeito principal, nem faça o hero parecer apagado: o hero carrega com 100% de opacidade e contraste (só vale fade inferior curto, até 30% da altura, para fundir com a próxima seção; grain fixo com opacity até .08).
  - TIPOGRAFIA GIGANTE sem cortar glifos: line-height de pelo menos .9 (ou padding-block para compensar), nenhum overflow:hidden no contêiner direto do título (máscara de revelação com padding de .2em em cima e embaixo), cuidado com margens negativas, descendentes (g, p, y, q) e acentos. Confira que o texto inteiro aparece dentro da seção.
  - Tooltips explicativos só onde ajudam (ícones sem texto, siglas, ações não óbvias), sem exagerar na quantidade.
  - Aproveite bem o espaço da tela: evite áreas vazias grandes e rolagem desnecessária, com densidade equilibrada e hierarquia clara.
  - Cuidado com contraste: nenhum texto pode ficar ilegível sobre o fundo, imagem ou gradiente (use overlay quando preciso).
  - Se o pedido for um app, painel ou sistema (e não uma página de marketing): a tela começa direto na estrutura funcional (abas, barra de ferramentas, filtros, busca e conteúdo), sem bloco de cabeçalho de tela com título, subtítulo, ícone e descrição; botões de ação e busca ficam à direita das abas; voltar, nome da tela e descrição ficam no cabeçalho superior, nunca na área central.`;

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'squared',
    name: 'Squared',
    category: 'Agência / Assinatura',
    description: 'Recriação fiel de squared-media.nl: mega-nav liquid glass, portal 3D com relógio ao vivo, bouncy tabs, feature pills, showreel em scroll, cases assimétricos, carrossel radial, cards empilháveis e mascote Square.',
    colors: ['#b8c0a5', '#ff4500', '#182113'],
    brief: `ESTILO "SQUARED" (recriação exata de https://www.squared-media.nl — agência criativa e tecnológica por assinatura)
IMPORTANTE: O arquivo index.html já contém a estrutura DOM, o CSS completo e todos os controladores JS do modelo Squared. Preserve TODAS as classes CSS, variáveis, fontes, animações, SVGs e interações originais, adaptando os textos, serviços, cases, depoimentos e preços para o negócio do usuário.

1. TIPOGRAFIA E FONTES (Google Fonts):
- Display (--font-display / --font-space-grotesk-vf): "Space Grotesk" (pesos 300 a 700), caixa alta (.lab-display) com letter-spacing -0.06em, line-height 0.84 e efeito interativo [data-font-weight-hover] em que cada letra engrossa conforme a proximidade do cursor.
- Corpo (--font-sans / --font-figtree): "Figtree" (400, 500, 600, 700).
- Monoespaçada (--font-mono / --font-jetbrains-mono): "JetBrains Mono" (400, 500) em caixa alta com tracking 0.14em–0.2em e 11px (.lab-mono).

2. PALETA DE CORES E TEMAS:
- Destaques de marca: --color-flame: #ff4500 (laranja intenso), --color-brand-ink: #0d0d0c, --color-brand-mint: #eeece7.
- Seções Sage (.sq-sage.lab-b-hero — Hero, AI, Showreel, Tarieven/Preços, Team, Footer): fundo verde-sálvia quente (#b8c0a5 misturado com #f4f3ea), texto #182113 e suporte aos estados de céu data-sky="day|dusk|night" (--sky-dusk, --sky-night) com sombra de folhagem animada (.sq-hero-leaf-shadow) e textura de ruído SVG.
- Seções Escuras / Ink (:root[data-theme="dark"] — Marquee, Disciplines #werk, Cases #cases, Reviews #reviews, Process #proces): fundo #0c0c0b, superfície #161614, texto #eeece7, e bloco interno .sq-mint (#f5f3f0 / #eeece7) na seção de disciplinas.

3. COMPONENTES E SEÇÕES OBRIGATÓRIOS (na ordem exata):
- Loader (.sq-loader): tela de introdução com marca SQUARED (dois retângulos inclinados a 21.77deg), barra de progresso inferior e cortina clip-path.
- Canvas de rastro ASCII (canvas.fixed): partículas discretas em #ff4500 e tinta seguindo o ponteiro.
- Mega-Nav Liquid Glass (nav.mega-nav): barra superior fixa com backdrop-filter, logo SQUARED, dropdowns expansíveis (Services/Diensten, Work/Werk, Tools, Studio), seletor de idioma (.sq-lang) e botão "Book a call" (.button-046 com preenchimento circular radial no hover).
- Hero (section#top.sq-sage.lab-b-hero): grid de 12 colunas. À esquerda: pill flame (.lab-eyebrow), título gigante em 4 linhas escalonadas (.lab-display .lab-line__inner com [data-font-weight-hover]), subtítulo, botões .button-046 (flame + outline) e marquee compacto de logos (.sq-logos--compact). À direita (#lab-b-portal): janela arredondada (#lab-b-window) com parallax (#lab-b-inner), cena da ilha + mascote Square com balão de fala (#sq-hero-bubble), relógio ao vivo (.lab-sky-clock que alterna dia/entardecer/noite ao clicar), botão de som (.sq-sound-toggle com 5 barras animadas) e chat interativo (.lab-chat).
- Faixa Marquee (.sq-marquee-track): rolagem horizontal infinita de disciplinas separadas por losangos (◆).
- Disciplinas e Feature Pills (section#werk -> .svc-disc__block.sq-mint): Bouncy Tabs (.bouncy-tabs com indicador deslizante flame .bouncy-tabs__indicator e ghost pill) alternando entre 4 categorias, e Expanding Feature Pills (.feature-pills__wrap) com barras de progresso segmentadas, pills expansíveis com ícone + e coluna visual direita (.feature-pills__col.is--visual) com gradientes em movimento (@keyframes feature-pills-drift) e vídeo em moldura 16:9.
- Seção IA (section#ai.sq-sage): headline display gigante, vídeo de fundo em loop (.lab-workshop-video) e parágrafo editorial.
- Showreel em Scroll (section[aria-label="Watch our showreel"]): seção sticky de 260svh com marquee gigante ao fundo (.sq-showreel-track), aviso "Scroll to enlarge" com ponto flame e container de vídeo (#sq-showreel-frame) cujo clip-path abre até tela cheia conforme a rolagem.
- Cases Board (section#cases -> .cases-board): grid editorial assimétrico de 12 colunas com 8 cards (.case-card) de larguras e proporções variadas (--col, --aspect, --y), tags (.case-pill) e cursor magnético "View ↗" (.case-card__cursor).
- Reviews Radial Slider (section#reviews -> .radial-gsap-slider): carrossel em arco circular (--slider-rotate: 9deg, transform-origin: 50% 980%) com estrelas em #ff4500, selo do Google, controles Previous / dots / Next, suporte a arraste e modal <dialog class="radial-review-dialog"> ao clicar.
- Processo em Cards Empilháveis (section#proces -> .cards-stack): cabeçalho sticky (.cards-stack-heading) e 4 cartões sticky (.cards-stack-card nas variantes is--mint, is--flame, is--ink, is--mint) que se abrem em leque com rotação e deslocamento X/Y ao rolar.
- Preços e Abas Interativas (section#tarieven.sq-sage): 2 cartões grandes (.sq-plan) com faixa diagonal (.sq-plan-slash) e mascotes Square que sobem no scroll (.sq-plan-squares), barra comparativa (.sq-bar) e 3 abas (.sq-tabs) contendo: (1) passos iniciais, (2) tickets destacáveis com picote radial (.sq-ticket), e (3) tabela de projetos com linha pontilhada (.sq-menu__leader).
- Equipe e Vagas (section#team.sq-sage): fotos quadradas com filtro duotone/sépia (.sq-team-photo) e card escuro "// hiring" com selo circular giratório em SVG.
- Rodapé Interativo (footer#contact.sq-sage.sq-footer): título gigante "LET'S TALK?" ao lado do buraco circular (.sq-footer-hole) de onde o mascote Square (.sq-footer-square) espia, inclina-se na direção do mouse (--lean) e acena ao passar o mouse nos botões CTA ([data-square-wave]), além do modal <dialog class="sq-plancall">.`,
    sample: {
      fonts: ['Space Grotesk', 'Figtree'],
      bg: '#b8c0a5',
      surface: '#161614',
      text: '#182113',
      muted: '#545f46',
      accent: '#ff4500',
      accent2: '#eeece7',
      radius: 24,
      hero: 'editorial',
      brand: 'Squared',
      nav: ['Services', 'Work', 'Tools', 'Studio', 'Pricing'],
      eyebrow: 'Websites, apps and video on subscription',
      headline: 'Monday ticket. Thursday live.',
      sub: 'Your own development and content team for one monthly price, from €2,000. You fire off a ticket, we deliver within 3 working days.',
      cta: 'Book an intro call →',
      features: [
        ['Design & Build', 'Interfaces, branding, fast websites, web apps, 3D configurators and AI implementation.'],
        ['Film & Content', 'Corporate films, event aftermovies, photography, campaign content, copywriting and ads.'],
        ['Fixed Rhythm', 'Submit a ticket on Monday, live by Thursday. Unlimited queue, pause or cancel monthly.'],
      ],
      stats: [
        ['3 days', 'delivery per ticket'],
        ['€2.000', 'fixed monthly price'],
        ['5.0 ★', 'on Google Reviews'],
        ['10+ yrs', 'experience'],
      ],
    },
  },
  {
    id: 'isomeet',
    name: 'ISO Meet',
    category: 'Plataforma / Waitlist',
    description: 'Recriação fiel de isomeet.com: tipografia Instrument Serif com letras em itálico, carrossel duplo sincronizado no hero, marquee duplo de profissões, bento grid com abas Hirer/Talent, reserva de username e FAQ.',
    colors: ['#f2f2f2', '#000000', '#180046'],
    brief: `ESTILO "ISO MEET" (recriação exata de https://www.isomeet.com — plataforma criativa, marketplace e waitlist de app mobile)
IMPORTANTE: O arquivo index.html já contém a estrutura DOM completa, ambos os arquivos CSS originais do Webflow, todas as imagens/gradientes e todos os controladores JS interativos do modelo ISO Meet. Preserve TODAS as classes CSS, variáveis, fontes, animações, SVGs e interações originais, adaptando os textos, benefícios, profissões do marquee, cards das abas, formulário e FAQ para o negócio do usuário.

1. TIPOGRAFIA E FONTES (Google Fonts):
- Títulos (.h1, .h2, .h3): "Instrument Serif" (400, normal e italic), com destaque editorial em letras específicas dentro das palavras usando <span class="italic-letter-span"> (ex.: Coll<span class="italic-letter-span">a</span>borate, C<span class="italic-letter-span">o</span>mmunity).
- Corpo e interface (body, .text-16, .text-18, .text-20, .button, .nav-link): "Instrument Sans" (400, 500, 600, 700).
- Escala fluida responsiva em rem via @media (1440px, 991px, 767px, 479px, 375px).

2. PALETA DE CORES E TOKENS:
- Variáveis: --_colors---white: white, --_colors---black: #000, --_colors---black-10: #0000001a, --_colors---white-85: #ffffffd9, --black-5: #0000000d, --_colors---gray-f2f2f2: #f2f2f2, --_colors---black-40: #0006, --_colors---black-80: #000c.
- Bento Cards de Features (.tab-card): fundos coloridos suaves e vibrantes com .violet-card, .green-card, .pink-card, .blue-card e gradientes difusos (.tab-card-bg-gradient).

3. COMPONENTES E SEÇÕES OBRIGATÓRIOS (na ordem exata):
- Navbar Flutuante em Pílula (.navbar-w / .navbar.w-nav): barra centralizada com logo SVG (ícone de obturador + wordmark), divisor vertical (.nav-logo-divider), links de navegação (.nav-link), botão "Join waitlist" (.nav-button) e menu mobile expansível (.nav-menu-btn).
- Hero com Carrossel Duplo Sincronizado (section#top.hero-section): grid de 2 colunas (.hero-main-grid). À esquerda (.hero-left-col): badge iOS (.hero-badge), título .h1 com letras em .italic-letter-span, subtítulo, formulário inline de waitlist (#hero-form com .form-input e botão pílula .button com seta em círculo branco) e prova social com avatares empilhados (.main-form-info-block). À direita (.hero-slider-col): bloco sobre gradiente quente (.hero-slider-bg-img) com dois sliders sincronizados — .hero-main-slider (5 fotos principais com paginação clicável .swiper-pagination) e .hero-second-slider (5 cards flutuantes verticais de UI que acompanham o slide ativo mostrando o próximo card abaixo com opacidade 0.28).
- Por Que Escolher / Benefícios (section#why.section.top-margin-132): cabeçalho em 2 colunas (.h2-block.with-2col) e grid de 3 cartões (.benefit-card) em fundo #f2f2f2 com ícones lineares em SVG e animação de entrada no scroll.
- Para Quem É / Marquee Duplo (section#who.section.for-who-section): título centralizado e duas faixas horizontais infinitas em direções opostas (.marquee e .marquee.with-reverse -> .logo-track-w) exibindo cartões de profissões/perfis (.marquee-item) com foto quadrada arredondada (.marqee-img) e legenda.
- Features Bento Grid com Abas (section#features.section): seletor de abas em pílula (.features-tabs / .tabs-menu) alternando entre duas personas (ex.: "Hirer" / "Talent"). Cada aba exibe um bento grid de 4 cards (.tab-main-grid / .tab-card) combinando mockups de celular, notificações flutuantes e variações .violet-card, .green-card, .pink-card e .blue-card.
- Reserva / Checkout + FAQ (section#reserve-username.section): à esquerda (.user-form-block-col), card de reserva/acesso antecipado com inputs em 2 colunas, campo de username com limite de 16 caracteres em tempo real (#USERNAME + .form-text-12), botões de rádio customizados (.form-radio-btn) e botão de checkout; à direita (.user-form-faq-list), acordeão de 6 perguntas frequentes (.faq-dd) com ícone + animado (.faq-dd-icon-line-1 / .faq-dd-icon-line-2).
- CTA Inferior com Fotos Flutuantes (section#join-waitlist.section.bottom-cta-section): card centralizado com ícone da marca (.cta-logo-w), título .h2, formulário de waitlist (#footer-form), prova social e 6 retratos flutuantes ao redor (.bottom-cta-bg-img-1 a .bottom-cta-bg-img-6) com animação suave de flutuação.
- Rodapé (footer.footer-section): emblema da marca, texto institucional, links de Sitemap, e-mail de contato, copyright e botão social.`,
    sample: {
      fonts: ['Instrument Serif', 'Instrument Sans'],
      bg: '#ffffff',
      surface: '#f2f2f2',
      text: '#000000',
      muted: '#666666',
      accent: '#000000',
      accent2: '#d5c4fe',
      radius: 24,
      hero: 'phone',
      brand: 'ISO Meet',
      nav: ['Why choose ISO', 'Who is it for', 'Features', 'Reserve username'],
      eyebrow: 'Public launch on iOS soon',
      headline: 'Meet. Collaborate. Hire. Finally, all in one place.',
      sub: 'ISO Meet is the creative network where photographers, models, stylists, and brands connect, book, and get paid without the chaos.',
      cta: 'Reserve My Spot →',
      features: [
        ['One Place for Everything', 'No more jumping between Instagram DMs, spreadsheets, and payment links. Manage every booking in one app.'],
        ['Fair, Friction-Free Booking', 'Clear project briefs, transparent rates, and instant agreements built for creative workflows.'],
        ['A Community You Can Trust', 'Verified portfolios, real ratings, and reviews from creatives who have actually worked together.'],
      ],
      stats: [
        ['5,000+', 'creatives signed up for beta'],
        ['20+', 'creative disciplines'],
        ['100%', 'verified portfolios'],
        ['iOS', 'public launch soon'],
      ],
    },
  },
  {
    id: 'visuvate',
    name: 'Visuvate',
    category: 'Estúdio / Web Design',
    description:
      'Estúdio de web design e desenvolvimento com tema escuro/claro interativo, barras de gradiente azul pulsantes no hero, editor visual completo no palco, espiral 3D cilíndrica de projetos no scroll com shader WebGL aurora, bento grid interativo com relógio analógico e laptop 3D, globo pontilhado 3D interativo nos depoimentos e acordeão de FAQs.',
    colors: ['#000000', '#0099ff', '#141414', '#ffffff'],
    brief: `Direção de arte fiel ao modelo Visuvate (https://visuvate.com):
- Paleta & Temas (Dark / Light mode via data-theme="dark" | "light"):
  - Dark (padrão): fundo #000000 (--vv-bg), superfície #141414 (--vv-surface), superfície forte #1f1f1f (--vv-surface-strong), texto primário #ffffff, texto secundário #9a9a9a, destaque primário Electric Blue #0099ff (--color-blue-500), #7acaff (--color-blue-300), #0068ad (--color-blue-700) e estrelas #ffb840.
  - Light: fundo #ffffff, superfície #f6f6f6, texto #000000, mantendo acentos em #0099ff.
- Tipografia:
  - Títulos Display: 'walsheim' / 'Plus Jakarta Sans' peso 400 e 500, tracking apertado (-0.05em).
  - Palavras de destaque editorial (.vv-accent / .vv-accent-roman): serifada 'Fraunces' peso 300 italic/normal com tracking -0.04em.
  - Corpo: 'Geist' 400/500.
- Componentes & Seções obrigatórias (preservar todos os componentes, shaders e animações ao adaptar para o negócio do usuário):
  1. Header fixo com logo SVG, links com animação 3D character-roll (.vv-roll / .vv-roll-char), switch interativo Dark/Light mode (role="switch") e botão pill "Start a project".
  2. Hero (#hero) com 15 barras verticais de gradiente azul pulsantes (.vv-gradient-bar com @keyframes vvPulseBar), badge interativa "Design In Details" que reage ao cursor (.hh-badge), headline com palavras em Fraunces (.vv-accent) e o mockup completo de Web Builder Studio (.hh-editor) com barra superior estilo macOS, árvore de Layers clicável à esquerda, marquee infinito de projetos ao centro com brilho conic-gradient (.vv-shine) e painel Inspector à direita.
  3. Tech Stack com logos das ferramentas e plataformas.
  4. Introduction (#intro-heading) com 3 fileiras horizontais de cards (.intro-track) que fazem parallax horizontal no scroll com máscara radial spotlight centralizada na copy.
  5. Our Works (#works) com palco sticky 100vh sobre 450vh de scroll room, canvas WebGL de aurora azul ao fundo e espiral cilíndrica 3D (.vv-coil-world / .vv-coil-card) que gira os projetos em hélice 3D conforme o scroll, revelando o CTA "View all" ao final.
  6. Services (#services) com 6 cards animados com ilustrações SVG interativas (.vv-anim-float, .vv-anim-press, .vv-anim-sweep, .vv-anim-ball, .vv-anim-ring, .vv-anim-score, .vv-anim-beam, .vv-anim-cursor) + grid de plataformas com efeito shimmer (.vv-shimmer-mask).
  7. Faixa Marquee infinita (.vv-marquee-track) e seção Pricing (#pricing) com 3 cards glassmorphic e borda animada conic-gradient (.vv-shine).
  8. Our Approach (#approach) em Bento Grid com 6 cards: Discovery First (tira de janelas que desliza no scroll), Mobile-First Design (smartphones flutuando), Conversion-Driven (laptop 3D cuja tampa abre no scroll), Pixel-Perfect Development (cursores Alex & Gangu que reagem ao mouse), Seamless CMS Launch (tabela CMS) e Future-Ready (relógio analógico com ponteiros animados).
  9. Testimonials (#testimonials) com globo 3D pontilhado Fibonacci interativo em canvas (arrastável com o mouse), contadores animados (30+, 98%, 12+) e carrossel de depoimentos navegável.
  10. FAQs (#faqs) em acordeão expansível e Footer (#contact-footer) com aurora de fundo, CTA gigante "Create Bold. Deliver Better." e wordmark monumental Visuvate.`,
    sample: {
      fonts: ['Plus Jakarta Sans', 'Geist'],
      bg: '#000000',
      surface: '#141414',
      text: '#ffffff',
      muted: '#9a9a9a',
      accent: '#0099ff',
      accent2: '#7acaff',
      radius: 12,
      hero: 'dashboard',
      brand: 'Visuvate',
      nav: ['Home', 'About Us', 'Works', 'Services', 'Blogs', 'Templates'],
      eyebrow: 'Design In Details',
      headline: 'Crafted Websites, Lasting Impressions',
      sub: 'Premium websites crafted for bold brands.',
      cta: 'Start a project',
      features: [
        ['Crafted Websites', 'Bespoke websites tailored to your brand goals and built for lasting impact.'],
        ['eCommerce & CMS', 'High-converting online stores and scalable dynamic content architectures.'],
        ['Consistent Identity', 'Cohesive visual systems, motion design, and pixel-perfect development.'],
      ],
      stats: [
        ['30+', 'Projects delivered'],
        ['98%', 'Client satisfaction'],
        ['12+', 'Years combined experience'],
        ['6', 'Platforms mastered'],
      ],
    },
  },
  {
    id: 'marcus',
    name: 'Marcus Lorenzet',
    category: 'Portfólio / Produto Digital',
    description:
      'Portfólio editorial escuro de design de websites e produtos SaaS com loader animado que encolhe para o logo, hero monumental "Websites & Digital Products", badges de experiência, vitrine numerada de cases com vídeos e métricas, seção de processo e rodapé interativo.',
    colors: ['#0a0a0a', '#cfc4aa', '#171717', '#ffffff'],
    brief: `Direção de arte fiel ao modelo Marcus Lorenzet (https://www.marcuslorenzet.com):
- Paleta: fundo carbono profundo #0a0a0a, superfície #141414 / #171717, destaque bege quente editorial #cfc4aa, texto branco #ffffff e cinza #9e9e9e.
- Tipografia & Layout: títulos monumentais com contraste entre sans geométrica e display editorial, badges técnicas em caixa alta ("15+ YEARS OF EXPERIENCE", "300+ PROJECTS", "Pixel by pixel").
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Animação de entrada (loader quadrado com sequência de 3 imagens que se transforma no quadrado bege #CFC4AA do logo no header).
  2. Header minimalista com quadrado bege, links PROJECTS e LET'S TALK.
  3. Hero Section com retrato centralizado, tipografia gigante "Websites & Digital Products", bio curta e selos "15+ YEARS OF EXPERIENCE" e "300+ PROJECTS".
  4. Seção [WHAT I DO] destacando design de websites de alta conversão, dashboards SaaS e design systems.
  5. Vitrine numerada de projetos (01, 02, 03, 04...) em grid assimétrico com vídeos/imagens em alta definição e tags de escopo.
  6. Seção de depoimentos, métricas de impacto e CTA final "Let's Talk".`,
    sample: {
      fonts: ['Plus Jakarta Sans', 'Inter'],
      bg: '#0a0a0a',
      surface: '#141414',
      text: '#ffffff',
      muted: '#9e9e9e',
      accent: '#cfc4aa',
      accent2: '#ffffff',
      radius: 8,
      hero: 'portrait',
      brand: 'Marcus Lorenzet',
      nav: ['Projects', 'What I Do', 'About', "Let's Talk"],
      eyebrow: '15+ YEARS OF EXPERIENCE · 300+ PROJECTS',
      headline: 'Websites & Digital Products',
      sub: 'Stunning websites and SaaS dashboards, crafted for companies that care about every detail.',
      cta: "Let's Talk",
      features: [
        ['High-Converting Websites', 'Fast, clean marketing sites built to turn visitors into customers and drive growth.'],
        ['SaaS Dashboards & Product UI', 'Complex interfaces, design systems, and workflows simplified pixel by pixel.'],
        ['Art Direction & Motion', 'Intentional interactions and visual craft that make digital products memorable.'],
      ],
      stats: [
        ['15+', 'Years of experience'],
        ['300+', 'Projects delivered'],
        ['100%', 'Pixel-by-pixel craft'],
        ['Global', 'Clientele'],
      ],
    },
  },
  {
    id: 'kstoimenov',
    name: 'Krasi Stoimenov',
    category: 'Portfólio / UX & Produto',
    description:
      'Portfólio premiado "From Wireframes to Wow’s" com shader WebGL de vidro canelado verde esmeralda no hero, barra de navegação flutuante com filtro SVG liquid-glass que faz morph no scroll, revelação de palavras no scroll, showreel expansível, lista de serviços com ícones animados, cases monumentais e cards de depoimentos empilhados.',
    colors: ['#0c0c0c', '#12801c', '#73ff57', '#f6f6f6'],
    brief: `Direção de arte fiel ao modelo Krasi Stoimenov (https://kstoimenov.com):
- Paleta & Temas (data-theme="dark" | "light"):
  - Dark (padrão): fundo #0c0c0c, superfície #141414, verde esmeralda profundo #082d06 / #12801c, verde neon luminoso #73ff57, texto #f6f6f6 e secundário #878787.
  - Light: fundo claro com acentos verdes e tipografia escura de alto contraste.
- Tipografia:
  - Display Editorial Serif: 'Manier' Regular & Italic para palavras de ênfase.
  - Sans Principal: 'TWKLausanne' peso 300.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Barra de navegação flutuante (ScrollNav) com filtro SVG #liquid-glass, botão de alternância de tema (sol/lua) e morph dinâmico no scroll (--p / --dx).
  2. Hero (#home) com canvas WebGL de vidro canelado verde (30 hastes de refração com aberração cromática que reagem ao mouse), headline monumental "From Wireframes to Wow’s" e botão CTA circular.
  3. About (#about) com régua lateral graduada (28 ticks) e texto cujas palavras ([data-w]) e sublinhados ([data-ubar]) acendem progressivamente conforme o scroll.
  4. PlayReal showreel que escala de 0.62 para 1.0 no scroll com marquee e player de vídeo interativo.
  5. Metrics (12 Years, 87 Projects, 3+ Years, 6k Hours) com animação de slide-up quando entra em viewport.
  6. Services+ (#services) com 5 linhas interativas (Product design, Digital strategy, Web design, Brand identity, Service design) com rolagem dupla de texto e micro-animações nos ícones.
  7. Works (#works) com cases completos (Acronis, Polygon, Deutsche Bank, WP Engine, Orion, Macmillan) com reveal clip-path e zoom suave.
  8. WorksCta ("Want to see how I enable companies?") com olho piscante e toggle switch com retrato.
  9. Testimonials em pilha diagonal escalonada ([data-tcard]), Quote com drift horizontal no scroll, grid Valuable Partners (15 logos) e Footer monumental ("Get in touch") com cursor customizado.`,
    sample: {
      fonts: ['Instrument Serif', 'Plus Jakarta Sans'],
      bg: '#0c0c0c',
      surface: '#141414',
      text: '#f6f6f6',
      muted: '#878787',
      accent: '#73ff57',
      accent2: '#12801c',
      radius: 12,
      hero: 'editorial',
      brand: 'KRS',
      nav: ['Work', 'Services+', 'Pricing', 'About'],
      eyebrow: 'UX PORTFOLIO · PRODUCT DESIGN',
      headline: 'From Wireframes to Wow’s',
      sub: 'Elevating UX to the remarkable. Product design, digital strategy, web design, brand identity and service design.',
      cta: 'Let’s talk',
      features: [
        ['Product & Service Design', 'End-to-end UX research, prototyping, and scalable design systems for complex products.'],
        ['Digital Strategy', 'Turning rough concepts into fundable, high-performing digital products without agency overhead.'],
        ['Web Design & Brand Identity', 'Distinctive visual craft, WebGL motion, and conversion-focused marketing sites.'],
      ],
      stats: [
        ['12', 'Years crafting digital products'],
        ['87', 'Projects across 6 continents'],
        ['3+', 'Years average cooperation'],
        ['6k', 'Hours in UX research & UI'],
      ],
    },
  },
  {
    id: 'avecanni',
    name: 'Avec Anni',
    category: 'Estúdio / Branding & Web',
    description:
      'Estúdio independente de direção de arte, identidade visual e web design ("Your work is good. Your brand should know that.") com estética editorial minimalista, vídeo de background no hero, pilha de cases selecionados, seção manifesta "Two services. No filler." e formulário de consulta.',
    colors: ['#0d0d0d', '#f5f3ef', '#ff4d24', '#8c8c8c'],
    brief: `Direção de arte fiel ao modelo Avec Anni Studio (https://avecanni.studio):
- Paleta: contraste editorial entre off-white quente #f5f3ef e preto profundo #0d0d0d, texto secundário #7a7a7a e acentos pontuais quentes.
- Tipografia: tipografia editorial limpa com hierarquia forte e espaçamento generoso.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Header com navegação enxuta (Cases, Services, About, Inquire) com sublinhado animado.
  2. Hero com vídeo de fundo, headline "Your work is good. Your brand should know that." e posicionamento "An independent design studio working with founders who are building something worth caring about."
  3. Galeria e stack de cases selecionados ("Work that started with something real and ended with something better" — SH Web, SMAK, etc.).
  4. Seção de serviços "Two services. No filler." dividida claramente em "01 – Brand identity" e "02 – Website design".
  5. Manifesto do estúdio ("There are a lot of studios out there that will say yes to everything you bring them. We're not one of them.") e seção de contato/Inquire.`,
    sample: {
      fonts: ['Instrument Serif', 'Inter'],
      bg: '#f5f3ef',
      surface: '#ffffff',
      text: '#0d0d0d',
      muted: '#6e6e6e',
      accent: '#0d0d0d',
      accent2: '#ff4d24',
      radius: 6,
      hero: 'editorial',
      brand: 'Avec Anni',
      nav: ['Cases', 'Services', 'About', 'Inquire'],
      eyebrow: 'BRAND & WEBSITE DESIGN STUDIO',
      headline: 'Your work is good. Your brand should know that.',
      sub: 'Strategy-led branding and design-driven websites, for brands that want to be taken seriously.',
      cta: 'Inquire',
      features: [
        ['01 – Brand Identity', 'Strategy-led visual identities, typography, and brand guidelines for unconventional founders.'],
        ['02 – Website Design', 'Design-driven websites built to position your brand with clarity and authority.'],
        ['Two Services. No Filler.', 'Focused senior execution without bloated retainers or unnecessary deliverables.'],
      ],
      stats: [
        ['01', 'Brand identity'],
        ['02', 'Website design'],
        ['100%', 'Founder-led craft'],
        ['Global', 'Independent studio'],
      ],
    },
  },
  {
    id: 'oxigen',
    name: 'Oxigen',
    category: 'Venture Studio / Deep Tech',
    description:
      'Portfólio e venture builder de tecnologia ("The hard technology calls, made from inside the Gulf") com cena 3D Three.js interativa guiada por 7 capítulos de scroll, rolagem suave Lenis, seções de Approach, Services, Startups com tiles SVG customizados, cena parallax interativa e artigos de Research.',
    colors: ['#07090e', '#38bdf8', '#e2e8f0', '#64748b'],
    brief: `Direção de arte fiel ao modelo Oxigen (https://www.oxigen.sa):
- Paleta: fundo espacial escuro #07090e / #0b0f17, textos em #f8fafc e #94a3b8, linhas técnicas sutis e acentos luminosos ciano/azul (#38bdf8) com tipografia monoespaçada técnica ('Roboto Mono') combinada a títulos editoriais.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Canvas 3D Three.js fixo ao fundo sincronizado com os 7 capítulos do Hero/Story (data-wp="0" até data-wp="6") e rolagem suave Lenis.
  2. Capítulos narrativos (#story e #approach) apresentando a tese "The hard technology calls, made from inside the Gulf".
  3. Seção #services detalhando concepção, engenharia de IA soberana, digital twins e transformação digital.
  4. Seção #startups exibindo o portfólio de empresas com ilustrações vetoriais (su-tile-1.svg, su-tile-2.svg, su-tile-3.svg).
  5. Cena interativa #px-scene (px-scene) e seção #research com artigos técnicos ("Sovereign Intelligence", "Digital Twins", "Digital Transformation") e rodapé #footer.`,
    sample: {
      fonts: ['Space Grotesk', 'Roboto Mono'],
      bg: '#07090e',
      surface: '#0f1420',
      text: '#f8fafc',
      muted: '#94a3b8',
      accent: '#38bdf8',
      accent2: '#0284c7',
      radius: 8,
      hero: 'terminal',
      brand: 'Oxigen',
      nav: ['Approach', 'Services', 'Startups', 'Research', 'Contact'],
      eyebrow: 'BUILT HERE · OWNED HERE · COMPOUNDED HERE',
      headline: 'The hard technology calls, made from inside the Gulf',
      sub: 'A growing portfolio of technology companies — conceived, scaled, and owned from inside the Gulf for the decade ahead.',
      cta: 'Explore Oxigen',
      features: [
        ['Sovereign Intelligence', 'Foundational AI and data infrastructure engineered for regional sovereignty and scale.'],
        ['Venture Conception & Scaling', 'Building and compounding deep-technology companies from day zero inside the Gulf.'],
        ['Digital Twins & Systems', 'Mission-critical simulation and enterprise transformation for complex industries.'],
      ],
      stats: [
        ['7', 'Narrative 3D chapters'],
        ['3+', 'Core venture pillars'],
        ['10yr', 'Compounding horizon'],
        ['Gulf', 'Sovereign technology'],
      ],
    },
  },
  {
    id: 'ballance',
    name: 'Ballance',
    category: 'Fintech / SaaS B2B',
    description:
      'Plataforma moderna de gestão de gastos e pagamentos corporativos ("Move payments without friction") com estética fintech limpa, mockups de cartões e aprovações em tempo real, abas interativas de funcionalidades, carrossel de histórias de clientes, contadores de impacto (88%, 18 hours, 10x, 46%) e tabela de planos.',
    colors: ['#f7f7f5', '#101010', '#1c78b0', '#ffffff'],
    brief: `Direção de arte fiel ao modelo Ballance (https://ballance.framer.website):
- Paleta: fundo claro sofisticado #f7f7f5 / #ffffff, texto principal #101010, destaque azul petróleo #1c78b0 (rgb(28, 120, 176)) e superfícies escuras de alto contraste em blocos de destaque.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Header com logo Ballance, navegação clara (Customer Stories, Company, Careers, Pricing, Blog, Contact) e CTA primário.
  2. Hero Section com headline "Move payments without friction", botões de ação com setas animadas e vitrine visual do produto + barra de estatísticas.
  3. Seção "What Ballance* Does" com abas interativas (tab-01 a tab-04) demonstrando cartões corporativos, controle de despesas e visibilidade em tempo real.
  4. Seção "Who Ballance is built for" ("Trusted by finance leaders", "Built for operational clarity", "Designed to scale with your business", "Control without micromanagement").
  5. Slideshow de casos de sucesso e seção "What they Say About Ballance" com ticker de métricas comprovadas (88%, 18 hours, 10x, 46%, > 50) e rodapé completo.`,
    sample: {
      fonts: ['Plus Jakarta Sans', 'Inter'],
      bg: '#f7f7f5',
      surface: '#ffffff',
      text: '#101010',
      muted: '#5c5c5c',
      accent: '#1c78b0',
      accent2: '#101010',
      radius: 12,
      hero: 'card',
      brand: 'Ballance',
      nav: ['Features', 'Customer Stories', 'Company', 'Pricing', 'Contact'],
      eyebrow: 'MODERN SPEND MANAGEMENT',
      headline: 'Move payments without friction',
      sub: 'Ballance is a modern spend management platform for growing teams — built to showcase payments, cards, and real-time visibility.',
      cta: 'Get Started',
      features: [
        ['Built for Operational Clarity', 'Real-time visibility into every corporate card, invoice, and team expense in one place.'],
        ['Control Without Micromanagement', 'Automated approval flows and smart spend limits that empower teams while protecting budgets.'],
        ['Designed to Scale', 'Multi-currency payments, instant virtual cards, and seamless accounting integrations.'],
      ],
      stats: [
        ['88%', 'Faster month-end close'],
        ['18 hrs', 'Saved per finance team weekly'],
        ['10x', 'Faster expense approvals'],
        ['46%', 'Reduction in duplicate spend'],
      ],
    },
  },
  {
    id: 'williams',
    name: 'Williams GP Tech',
    category: 'Engenharia / Deep Tech & F1',
    description:
      'Engenharia de Fórmula 1 aplicada a sistemas avançados de baterias e PhysicsML ("Advanced Battery Systems and PhysicsML | Williams Grand Prix Technologies") com vídeos nativos, efeito GSAP ScrambleText nos títulos técnicos, abas interativas com barra de progresso automática, sliders Swiper de setores (Marine, Defence, Motorsport, Mobility, Energy) e estética industrial de alta precisão.',
    colors: ['#0a0b0e', '#00a3e0', '#ffffff', '#161920'],
    brief: `Direção de arte fiel ao modelo Williams Grand Prix Technologies (https://www.williamsgptech.com):
- Paleta: tema escuro industrial de engenharia F1 (#0a0b0e / #111318), bordas técnicas sutis (var(--_theme---border)), textos brancos #ffffff e destaque azul Williams #00a3e0.
- Tipografia & Efeitos: títulos de engenharia com efeito GSAP ScrambleText / SplitText, botões com stagger caractere por caractere ([data-button-animate-chars]) e numeração técnica.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Navbar técnica (.navbar_component) com dropdowns de Sectors (Marine, Defence, Motorsport, Mobility, Energy) e Technology (ES10M Battery System, Physics-Informed Machine Learning).
  2. Hero full-screen com vídeo de engenharia F1/baterias e posicionamento de performance extrema.
  3. Seção #intro e abas interativas (.big-tabs_menu com barra de progresso animada .big-tabs_progress-bar) apresentando as tecnologias ES10M e PhysicsML.
  4. Sliders interativos ([data-slider="component"] / Swiper) para os setores de aplicação (Marine, Defence, Motorsport, Mobility, Energy).
  5. Seção de notícias e estudos de caso (Unipart partnership, Marine electrification, Real-time telemetry) e rodapé completo Williams Grand Prix Technologies.`,
    sample: {
      fonts: ['Space Grotesk', 'JetBrains Mono'],
      bg: '#0a0b0e',
      surface: '#14171f',
      text: '#ffffff',
      muted: '#94a3b8',
      accent: '#00a3e0',
      accent2: '#38bdf8',
      radius: 4,
      hero: 'dashboard',
      brand: 'Williams GP Tech',
      nav: ['About', 'Sectors', 'Technology', 'Resources', 'Contact'],
      eyebrow: 'FORMULA 1 ENGINEERING APPLIED',
      headline: 'Advanced Battery Systems and PhysicsML',
      sub: 'Williams Grand Prix Technologies applies Formula 1 engineering to battery systems and physics-informed ML across marine, defence, motorsport, mobility and energy.',
      cta: 'Explore Technology',
      features: [
        ['High-Performance Battery Systems', 'Modular, race-bred energy storage systems engineered for extreme power density and safety.'],
        ['Physics-Informed ML (PhysicsML)', 'Real-time simulation and predictive intelligence combining physical laws with machine learning.'],
        ['Multi-Sector Deployment', 'Proven across marine electrification, defence, elite motorsport, mobility, and grid energy.'],
      ],
      stats: [
        ['F1', 'Heritage & engineering DNA'],
        ['5', 'Core industrial sectors'],
        ['ES10M', 'Modular battery platform'],
        ['Real-Time', 'PhysicsML telemetry'],
      ],
    },
  },
  {
    id: 'grainient',
    name: 'Grainient',
    category: 'Design Assets / Criativo',
    description:
      'Biblioteca criativa de gradientes texturizados, mockups e ferramentas para designers ("Crafted for Bold & Modern Designers") com vitrine de coleções, geradores interativos, bento grid de recursos, planos e galeria 3D.',
    colors: ['#0b0b0d', '#ff5c00', '#f5f5f7'],
    brief: `Direção de arte fiel ao modelo Grainient (https://grainient.supply):
- Paleta: fundo escuro profundo #0b0b0d / #121215, gradientes granulados vibrantes (laranja #ff5c00, violeta, azul cobalto e magenta), texto claro #f5f5f7 e cinza neutro #9a9aa1.
- Tipografia & Layout: tipografia display geométrica combinada com serifada editorial e tags monoespaçadas.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Navbar flutuante com links de coleções, ferramentas, preços e acesso.
  2. Hero monumental ("Crafted for Bold & Modern Designers") com gradientes texturizados de alta resolução e call-to-actions em pílula.
  3. Vitrine de coleções (Section - Collection e Section - Images) com cards visuais ricos em textura grain.
  4. Seção de novas ferramentas (Section - New tools & Section - Screen) demonstrando fluxos criativos e plugins.
  5. Bento Grid de benefícios (Section - Bento Grid), tabela de planos/assinatura (Section - Pricing), vitrine 3D (Section - 3d Img), depoimentos (Section - Testimonials), newsletter e rodapé.`,
    sample: {
      fonts: ['Plus Jakarta Sans', 'Inter'],
      bg: '#0b0b0d',
      surface: '#141418',
      text: '#f5f5f7',
      muted: '#9a9aa1',
      accent: '#ff5c00',
      accent2: '#7c3aed',
      radius: 16,
      hero: 'editorial',
      brand: 'Grainient',
      nav: ['Collections', 'Tools', 'Bento', 'Pricing', 'Testimonials'],
      eyebrow: 'DESIGN SUPPLY · TEXTURED GRADIENTS & TOOLS',
      headline: 'Crafted for Bold & Modern Designers',
      sub: 'Curated collections of high-resolution grained gradients, 3D assets, and creative tools built to elevate modern digital products.',
      cta: 'Explore All-Access',
      features: [
        ['Curated Gradient Collections', 'Thousands of ultra-high-resolution grained gradients, backgrounds, and abstract textures.'],
        ['Interactive Design Tools', 'Browser-based generators and plugins to craft custom palettes and noise shaders in seconds.'],
        ['Unlimited Commercial License', 'Ready-to-use assets for client websites, brand identities, apps, and marketing campaigns.'],
      ],
      stats: [
        ['2,000+', 'Grained assets'],
        ['8K', 'Ultra HD resolution'],
        ['10k+', 'Designers & studios'],
        ['100%', 'Royalty-free license'],
      ],
    },
  },
  {
    id: 'ciaoenergy',
    name: 'Ciao Energy',
    category: 'Bebidas / E-Commerce 3D',
    description:
      'Energético natural de kombucha ("THE FIRST NATURAL ENERGY KOMBUCHA") criado por Squeezie com seletor interativo de sabores (#gamme), seções cromáticas vibrantes, benefícios numerados (#benefits-1 a #benefits-4), argumentos nutricionais, linha completa, FAQ e newsletter.',
    colors: ['#fff6d6', '#ff4b2b', '#1a120b'],
    brief: `Direção de arte fiel ao modelo Ciao Energy / Ciao Kombucha (https://www.ciaoenergy.com):
- Paleta: cores solares e vibrantes inspiradas nas latas (amarelo pêssego #fff6d6, coral/laranja #ff4b2b, rosa framboesa, verde limão e marrom espresso #1a120b para tipografia ultra-bold).
- Tipografia: display condensada ultra-pesada em caixa alta combinada com sans-serif limpa e badges circulares.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Navbar fixa (.navbar) com logo CIAO, navegação rápida e seletor de idioma.
  2. Seção #gamme com carrossel interativo de sabores (Peach, Raspberry, Lime, Berry, etc.), HUD de navegação (.hud) e especificações de cada lata.
  3. Seção de perfil e história (.is-profile) com vídeo e assinatura do criador.
  4. Capítulos de benefícios em scroll (#benefits-1, #benefits-2, #benefits-3, #benefits-4) e seção comparativa (.is-argument).
  5. Vitrine da linha completa (.is-full-gamme), acordeão de perguntas frequentes (#FAQ), chamada final (.is-last-copy) e rodapé (.is-last).`,
    sample: {
      fonts: ['Space Grotesk', 'Plus Jakarta Sans'],
      bg: '#fff6d6',
      surface: '#ffe8a3',
      text: '#1a120b',
      muted: '#5c4738',
      accent: '#ff4b2b',
      accent2: '#ff9f1c',
      radius: 20,
      hero: 'product',
      brand: 'CIAO Energy',
      nav: ['Flavors', 'Benefits', 'Our Story', 'Full Range', 'FAQ'],
      eyebrow: 'THE FIRST NATURAL ENERGY KOMBUCHA',
      headline: 'Natural Energy. Zero Compromise.',
      sub: 'Organic kombucha brewed with real fruit infusion and natural caffeine for clean, refreshing daily energy.',
      cta: 'Discover the Range',
      features: [
        ['100% Natural Energy', 'Powered by organic green tea, yerba mate, and live kombucha cultures without synthetic crash.'],
        ['Low Sugar & Organic', 'Crafted with real fruit juices, low calories, and zero artificial sweeteners or preservatives.'],
        ['Bold Refreshing Flavors', 'Available in Peach, Raspberry, Lime Mint, Dragon Fruit, and Passion Fruit cans.'],
      ],
      stats: [
        ['100%', 'Natural ingredients'],
        ['5+', 'Signature flavors'],
        ['Low', 'Sugar & calories'],
        ['Bio', 'Certified organic'],
      ],
    },
  },
  {
    id: 'neoconda',
    name: 'Neoconda',
    category: 'Agência 3D / WebGL',
    description:
      'Estúdio criativo digital ("Digital Evolution Powered by Creativity") com túnel 3D Three.js interativo guiado pelo scroll, animações GSAP Flip/SplitText/ScrambleText, vitrine de cases imersivos, serviços e chamada de contato.',
    colors: ['#07080a', '#c8ff00', '#f4f4f6'],
    brief: `Direção de arte fiel ao modelo Neoconda (https://neoconda.com):
- Paleta: fundo escuro futurista #07080a / #0f1115, acento verde-limão ácido #c8ff00 / ciano tecnológico, texto principal #f4f4f6 e cinza técnico #8e929f.
- Tipografia: 'Plus Jakarta Sans' combinada com tipografia display de alto impacto e labels técnicas com efeito ScrambleText.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Cena WebGL Three.js interativa (canvas 3D) sincronizada com Lenis smooth scroll e GSAP ScrollTrigger.
  2. Hero monumental ("Digital Evolution Powered by Creativity") com navegação minimalista e indicadores de scroll.
  3. Seções narrativas apresentando direção criativa, engenharia WebGL, branding e experiências imersivas.
  4. Galeria interativa de projetos selecionados com transições GSAP Flip e rodapé com chamada para novos projetos.`,
    sample: {
      fonts: ['Plus Jakarta Sans', 'JetBrains Mono'],
      bg: '#07080a',
      surface: '#111318',
      text: '#f4f4f6',
      muted: '#8e929f',
      accent: '#c8ff00',
      accent2: '#38bdf8',
      radius: 12,
      hero: 'terminal',
      brand: 'Neoconda',
      nav: ['About', 'Work', 'Services', 'Process', 'Contact'],
      eyebrow: 'CREATIVE TECHNOLOGY STUDIO',
      headline: 'Digital Evolution Powered by Creativity',
      sub: 'We blend 3D interactive storytelling, brand strategy, and high-performance engineering to build unforgettable digital experiences.',
      cta: 'Start a Project',
      features: [
        ['Interactive 3D & WebGL', 'Real-time shaders, Three.js worlds, and scroll-choreographed product experiences.'],
        ['Brand & Digital Identity', 'Forward-looking visual systems designed to stand out in crowded markets.'],
        ['Full-Stack Web Engineering', 'Fast, accessible, and scalable web applications built with modern frameworks.'],
      ],
      stats: [
        ['60fps', 'Real-time 3D motion'],
        ['100%', 'Bespoke architecture'],
        ['Global', 'Creative partners'],
        ['Award', 'Winning digital craft'],
      ],
    },
  },
  {
    id: 'trionn',
    name: 'TRIONN',
    category: 'Agência / Design & Motion',
    description:
      'Estúdio digital independente ("Designed to mean something.") com palavra dinâmica no hero, texto iluminado no scroll, marquee duplo "Inspire + innovate + impact", cards 3D em perspectiva na seção Key Facts com vídeos integrados, logos de parceiros e rodapé monumental.',
    colors: ['#121315', '#c5fcfc', '#d8d8d8'],
    brief: `Direção de arte fiel ao modelo TRIONN (https://trionn.com):
- Paleta: fundo carbono #121315, superfície #1b1c1e, texto principal #d8d8d8, destaque ciano gelo #c5fcfc e laranja coral #ff764d nos cards de destaque.
- Tipografia: 'Sora' (display e títulos), 'DM Sans' (corpo) e 'Plus Jakarta Sans', com divisores técnicos (.line-plus-block) adornados por sinais "+" nas extremidades.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Header fixo (#nav) com logo TRIONN, botão de som, botão "Book a Call" e menu gaveta em tela cheia (#desktopMenuRef).
  2. Hero (.main-banner) com título "Designed to mean something." (onde a última palavra alterna suavemente entre something., depth., impact., purpose., intention.) e vídeo principal em loop.
  3. Seção sobre (.home-about) com statement editorial em 2 colunas, divisores .line-plus-block e descrição da filosofia de design.
  4. Seção #vision-section ("Focused vision. Measured execution.") com botão magnético .explore-btn e marquee duplo infinito ("Inspire + innovate + impact").
  5. Seção #keyfacts-section ("Key facts") com 4 cards 3D em perspectiva ([data-kf-card="true"]) contendo métricas (25+ Years, 60+ Awards, 98% Client retention, 250+ Projects) e vídeos embutidos + grid "Our business partners".
  6. Footer monumental ("Let's build something great.") com links sociais, contatos e wordmark gigante TRIONN.`,
    sample: {
      fonts: ['Sora', 'DM Sans'],
      bg: '#121315',
      surface: '#1b1c1e',
      text: '#d8d8d8',
      muted: '#8c8f96',
      accent: '#c5fcfc',
      accent2: '#ff764d',
      radius: 24,
      hero: 'editorial',
      brand: 'TRIONN',
      nav: ['Work', 'About', 'Services', 'Team', 'Contact'],
      eyebrow: 'INDEPENDENT DIGITAL STUDIO',
      headline: 'Designed to mean something.',
      sub: 'Trionn is an independent digital studio building brands, digital products, and immersive web experiences with focused vision and measured execution.',
      cta: 'Book a Call',
      features: [
        ['Brand & Digital Products', 'Strategic brand systems and product interfaces crafted for clarity, emotion, and longevity.'],
        ['Motion & Interactive Web', 'Fluid choreography, 3D perspective layouts, and purposeful micro-interactions.'],
        ['Measured Execution', 'Senior multidisciplinary teams delivering enterprise-grade design and engineering.'],
      ],
      stats: [
        ['25+', 'Years of excellence'],
        ['60+', 'Global design awards'],
        ['98%', 'Client retention rate'],
        ['250+', 'Projects delivered'],
      ],
    },
  },
  {
    id: 'storia',
    name: 'Storia OSI',
    category: 'Cultural / Editorial Interativo',
    description:
      'Experiência histórica interativa celebrando os 90 anos da Orchestra della Svizzera italiana ("LA NOSTRA STORIA") com rastro de imagens históricas no cursor, linha do tempo cronológica de 1935 a 2025, canvas WebGL UnicornStudio e barra flutuante de navegação.',
    colors: ['#141210', '#d4af37', '#f5f0e6'],
    brief: `Direção de arte fiel ao modelo Storia OSI — 90 Anni Orchestra della Svizzera italiana (https://storia.osi.swiss):
- Paleta: fundo escuro clássico de sala de concerto #141210, tipografia marfim #f5f0e6, acentos dourados #d4af37 e fotografias históricas de arquivo.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Barra superior com logo OSI, navegação ("La nostra storia", "I nostri temi") e controles de áudio/menu.
  2. Palco central interativo com título monumental "LA NOSTRA STORIA", galeria de rastro de mouse (.content__img) com dezenas de registros históricos da orquestra e efeito WebGL UnicornStudio.
  3. Linha do tempo cronológica (.dates-list / .dates-item) percorrendo os anos de 1935 a 2025.
  4. Pílula flutuante inferior (#pillLink "Celebrando 90 anni di OSI") e modal informativo (#toolbarComponent) com capítulos da história.`,
    sample: {
      fonts: ['Instrument Serif', 'Plus Jakarta Sans'],
      bg: '#141210',
      surface: '#1f1c18',
      text: '#f5f0e6',
      muted: '#a39b8b',
      accent: '#d4af37',
      accent2: '#e6c65a',
      radius: 12,
      hero: 'editorial',
      brand: 'OSI 90 Anni',
      nav: ['La nostra storia', 'I nostri temi', 'Archivio', 'Concerti'],
      eyebrow: 'CELEBRANDO 90 ANNI DI STORIA',
      headline: 'La Nostra Storia',
      sub: 'Un viaggio interattivo attraverso novant’anni di musica, direttori leggendari, solisti e concerti dell’Orchestra della Svizzera italiana.',
      cta: 'Esplora la Storia',
      features: [
        ['Archivio Storico Vivente', 'Fotografie d’epoca, locandine e registrazioni dal 1935 fino ai giorni nostri.'],
        ['Linea del Tempo Interattiva', 'Esplora decennio per decennio i momenti chiave e i protagonisti dell’orchestra.'],
        ['Esperienza Editoriale Immersiva', 'Direzione artistica museale con animazioni fluide e narrazione multimediale.'],
      ],
      stats: [
        ['90', 'Anni di musica'],
        ['1935', 'Anno di fondazione'],
        ['100+', 'Documenti d’archivio'],
        ['OSI', 'Svizzera italiana'],
      ],
    },
  },
  {
    id: 'getblue',
    name: 'Get Blue',
    category: 'Healthtech / Longevidade & IA',
    description:
      'Plataforma adaptativa de saúde e longevidade ("Clarity today. Longevity tomorrow.") com estética editorial clínica luminosa, cards interativos de biomarcadores e IA, linha do tempo de protocolo baseado em evidências, carrossel Swiper, tabela comparativa e rodapé parallax.',
    colors: ['#f6f5f0', '#0047ff', '#111318'],
    brief: `Direção de arte fiel ao modelo Get Blue (https://www.getblue.com):
- Paleta: fundo off-white clínico e acolhedor #f6f5f0 / #ffffff, azul cobalto puro #0047ff, texto carvão #111318 e superfícies translúcidas com bordas sutis.
- Tipografia: serifada editorial elegante para títulos combinada com sans-serif geométrica limpa e dados numéricos precisos.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Navbar limpa com links de plataforma, protocolo, ciência, FAQs e botão "Start Today".
  2. Hero ("Clarity today. Longevity tomorrow.") com visual de saúde adaptativa e cards de inteligência contínua.
  3. Seções de linha de base quantificada (biomarcadores, wearables, exames laboratoriais), protocolo baseado em evidências e acompanhamento 24/7.
  4. Carrossel interativo Swiper de funcionalidades, tabela comparativa completa (.section_table) destacando diferenciais da Blue, seção de CTA (.section_cta) e rodapé parallax.`,
    sample: {
      fonts: ['Instrument Serif', 'Plus Jakarta Sans'],
      bg: '#f6f5f0',
      surface: '#ffffff',
      text: '#111318',
      muted: '#5e6470',
      accent: '#0047ff',
      accent2: '#3b82f6',
      radius: 16,
      hero: 'phone',
      brand: 'Blue',
      nav: ['How It Works', 'Science', 'Compare', 'FAQs', 'Start Today'],
      eyebrow: 'ADAPTIVE HEALTH SYSTEM',
      headline: 'Clarity today. Longevity tomorrow.',
      sub: 'Blue unifies advanced blood biomarkers, wearable data, and clinical guidance into an adaptive daily protocol built for long-term health.',
      cta: 'Start Today',
      features: [
        ['Quantified Baseline', 'Comprehensive lab panels, epigenetic insights, and wearable metrics unified in one profile.'],
        ['Evidence-Based Protocol', 'Personalized nutrition, supplementation, sleep, and training routines that adapt as you progress.'],
        ['Always-On Health Intelligence', 'Instant answers and proactive adjustments grounded in peer-reviewed longevity science.'],
      ],
      stats: [
        ['100+', 'Biomarkers tracked'],
        ['24/7', 'Adaptive guidance'],
        ['100%', 'Evidence-based protocol'],
        ['1 App', 'Complete health record'],
      ],
    },
  },
  {
    id: 'coffeetech',
    name: 'Coffee-Tech',
    category: 'Indústria / Engenharia Premium',
    description:
      'Fabricante de torrefadores de café de alta engenharia ("Coffee Roasting Reinvented") com alternância de seções Dark/Light theme, vitrine técnica de máquinas (FZ94 EVO, Silon ZR7, Ghibli R90, Lab Extractor), pilares de Tecnologia, Eficiência e Sustentabilidade, blog técnico e rodapé industrial.',
    colors: ['#0d0e13', '#e05a2b', '#f3ede3'],
    brief: `Direção de arte fiel ao modelo Coffee-Tech Engineering (https://www.coffee-tech.com):
- Paleta: contraste entre seções .dark-theme (fundo #0d0e13, texto creme #f3ede3) e .light-theme (fundo marfim #fbf8f3 / #f3ede3, texto #141110), com destaque laranja torra/cobre #e05a2b.
- Tipografia: tipografia industrial robusta com numeração técnica, especificações de capacidade e animações GSAP ScrollTrigger / SplitText.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Header (.header) com navegação de produtos, tecnologia, eficiência, sustentabilidade, catálogo e contato.
  2. Hero escuro (section#model-page.hero.dark-theme) com headline "Coffee Roasting Reinvented" e apresentação da engenharia de torra.
  3. Seção institucional (.about.light-theme) e vitrine de equipamentos comerciais e de laboratório (FZ94 EVO, Silon ZR7, Ghibli R90, Lab Extractor).
  4. Pilares detalhados de Technology, Efficiency e Sustainability com métricas de energia limpa e precisão térmica.
  5. Artigos e insights técnicos de torrefação e rodapé completo (.footer).`,
    sample: {
      fonts: ['Space Grotesk', 'Inter'],
      bg: '#0d0e13',
      surface: '#171922',
      text: '#f3ede3',
      muted: '#9ca3af',
      accent: '#e05a2b',
      accent2: '#f3ede3',
      radius: 8,
      hero: 'product',
      brand: 'Coffee-Tech',
      nav: ['Roasters', 'Technology', 'Efficiency', 'Sustainability', 'Catalog'],
      eyebrow: 'PRECISION ROASTING ENGINEERING',
      headline: 'Coffee Roasting Reinvented',
      sub: 'Industrial and specialty coffee roasters engineered for thermal precision, clean energy efficiency, and repeatable roast profiles.',
      cta: 'Explore Roasters',
      features: [
        ['Precision Thermal Control', 'Patented drum and airflow engineering for full mastery over conduction and convection.'],
        ['Energy Efficiency', 'Low-emission roasting systems designed to reduce energy consumption without sacrificing cup quality.'],
        ['Built for Every Scale', 'From laboratory sample roasters and shop roasters to automated industrial production lines.'],
      ],
      stats: [
        ['30+', 'Years of engineering'],
        ['4', 'Signature roaster lines'],
        ['EEP', 'Efficiency metric leader'],
        ['Global', 'Roastery installations'],
      ],
    },
  },
  {
    id: 'flowty',
    name: 'Flowty',
    category: 'App Mobile / Produtividade',
    description:
      'Timer minimalista de foco e descanso para iOS ("Silence Your Digital Noise") com vídeos reais do app e Apple Watch, contadores de impacto ("Up To 37%"), alternador interativo Time Modes / Categories, bento cards de recursos e modal de contato.',
    colors: ['#f4f3ef', '#141414', '#ff5a36'],
    brief: `Direção de arte fiel ao modelo Flowty (https://flowty.co):
- Paleta: fundo claro suave #f4f3ef / #eae8e1, superfícies em #ffffff e preto suave #141414, texto principal #141414, cinza #6e6e6e e acentos quentes em laranja/vermelho suave.
- Tipografia: 'Outfit' (400, 500, 600) com curvas amigáveis, pílulas arredondadas e mockups táteis de iPhone e Apple Watch.
- Componentes & Seções obrigatórias (preservar integralmente):
  1. Header flutuante com logo Flowty, botão de download da App Store e menu modal expansível (#main-menu-panel).
  2. Hero ("Silence Your Digital Noise") com vídeo em loop do Apple Watch/iPhone (/video/watch.mp4), descrição do ritmo foco-descanso e CTA da App Store.
  3. Seção de impacto ("Up To 37% less screen fatigue") e demonstração em vídeo do timer (/video/timer.mp4).
  4. Seção interativa com abas "Time Modes" e "Categories" mostrando bloqueio de apps ruidosos, sessões de foco e recuperação.
  5. Cards de diferenciais, seção de perguntas/suporte com formulário integrado e rodapé minimalista.`,
    sample: {
      fonts: ['Outfit', 'Inter'],
      bg: '#f4f3ef',
      surface: '#ffffff',
      text: '#141414',
      muted: '#6e6e6e',
      accent: '#141414',
      accent2: '#ff5a36',
      radius: 22,
      hero: 'phone',
      brand: 'Flowty',
      nav: ['Features', 'Time Modes', 'Categories', 'App Store'],
      eyebrow: 'MINIMALIST FOCUS-BREAK TIMER',
      headline: 'Silence Your Digital Noise',
      sub: 'Flowty is a minimalist focus-break timer that blocks noisy apps so focus and recovery can take turns. Find your daily rhythm.',
      cta: 'Download on App Store',
      features: [
        ['Block Noisy Apps Automatically', 'Shield your attention during focus sessions by silencing distracting social and messaging apps.'],
        ['Flexible Time Modes', 'Switch seamlessly between Pomodoro, deep work blocks, and custom recovery intervals.'],
        ['iPhone & Apple Watch Sync', 'Start, pause, and feel gentle haptic transitions right from your wrist without picking up your phone.'],
      ],
      stats: [
        ['37%', 'More consistent focus'],
        ['0', 'Distracting notifications'],
        ['iOS', 'iPhone & Apple Watch'],
        ['4.9 ★', 'App Store rating'],
      ],
    },
  },
  {
    id: 'traced',
    name: 'Traced',
    category: 'E-commerce / Saúde & Bem-estar',
    description:
      'Página de produto premium de teste ambiental de cabelo ("Traced™ Environmental Exposure Test") em tons sálvia e cinza quente: serifa elegante nos títulos, galeria com zoom, opções de compra em cartões, linha do tempo "Collect, Send, Analyze, Trace, Act", comparativo com coluna destacada, relatório com score e FAQ em acordeão.',
    colors: ['#f5f5f5', '#c7d2ac', '#413f32', '#e1dcd7'],
    brief: `Direção de arte fiel ao modelo Traced (https://traced.life/products/test), página de produto de um teste ambiental de saúde:
- Paleta: fundo cinza claríssimo #f5f5f5 / #eaeaea com cartões brancos #ffffff, verde-sálvia #c7d2ac (e #d8e0c5, #e3e9d5) como cor de ação, texto em marrom-oliva escuro #413f32 / #201f1a, cinzas quentes #a09f98 e #e1dcd7 e um toque de pêssego #f1c494. Nada de cores saturadas.
- Tipografia: serifa de alto contraste e leve ("Serrif" 300/400) nos títulos grandes, com tracking apertado, e grotesca neutra ("Saans" 400/500) no texto; rótulos em caixa-alta espaçada com mono ("Saans Semi Mono") e numeração "01–07". Se as fontes não carregarem, use Fraunces/Instrument Serif nos títulos e uma grotesca neutra no texto.
- Componentes & Seções (preservar a estrutura e o ritmo):
  1. Nav flutuante em pílula translúcida com logo, links curtos (Shop, Learn, Account, Cart) e mini-cartão fixo do produto ("Traced™ Environmental Exposure Test $299") com seta.
  2. Topo de produto em duas colunas: galeria de fotos grandes com cantos arredondados e botão "+" de zoom; à direita título serifado, nota 5.0 com estrelas, descrição, opções de compra em cartões brancos arredondados (rádio, preço riscado, depoimento com foto), botão pílula verde-sálvia "Add to cart" e linha em mono "Results within 15 days • Free shipping".
  3. Acordeões "What you get" com sinal de "+" em círculo e divisórias finas.
  4. Lista numerada de elementos (01–07) com título serifado enorme, texto lateral e foto de apoio arredondada, e seção "All measured elements explained" com acordeões grandes.
  5. Linha do tempo vertical "Collect / Send / Analyze / Trace / Act" com tipografia serifada gigante, numeração lateral e foto fixa à esquerda.
  6. Seção "Report" com selo-pílula de contorno, score "1,4 / 10" em cartão com gradiente suave e prévias do relatório.
  7. Comparativo "Compare" com coluna destacada em verde-sálvia (logo) contra "Other methods" e pontos/travessões.
  8. Cartão "The science" arredondado com miniaturas circulares, FAQs em acordeão respondidas por especialista (foto em elipse) e rodapé.
- Detalhes: cantos muito arredondados (24–32px), sem bordas nem sombras pesadas, espaço generoso, microinterações suaves (cartões que sobem, "+" que gira, sticky nav) e fotografia de produto em estúdio com luz suave.`,
    sample: {
      fonts: ['Fraunces', 'Figtree'],
      bg: '#f5f5f5',
      surface: '#ffffff',
      text: '#413f32',
      muted: '#7a7970',
      accent: '#c7d2ac',
      accent2: '#f1c494',
      radius: 28,
      hero: 'product',
      brand: 'Traced',
      nav: ['Shop', 'Learn', 'Account', 'Cart'],
      eyebrow: 'AT-HOME HAIR ANALYSIS',
      headline: 'Environmental Exposure Test',
      sub: 'A small sample of hair, analyzed across 15 environmental elements, gives you a clearer picture of your exposure patterns across a 30-day timeline.',
      cta: 'Add to cart',
      features: [
        ['Collect', 'A few strands of hair, collected at home in seconds.'],
        ['Analyze', 'Fifteen elements measured and compared against reference ranges.'],
        ['Act', 'Plain-language report with practical guidance for your daily environment.'],
      ],
      stats: [
        ['15', 'Elements measured'],
        ['30', 'Day exposure timeline'],
        ['15', 'Days to results'],
        ['5.0 ★', '25 reviews'],
      ],
    },
  },
];

export const GETLAYERS_TEMPLATE_ID = 'getlayers';

const inspirationList = () =>
  SITE_TEMPLATES.map((t) => `- ${t.name} (${t.category}; cores ${t.colors.join(' ')}): ${t.description.slice(0, 160)}`).join('\n');

interface ArtDirection {
  id: string;
  name: string;
  /** conceito visual em uma frase */
  idea: string;
  fonts: string;
  palette: string;
  layout: string;
  motion: string;
}

// Cada criação livre recebe duas direções sorteadas (sem repetir as últimas usadas): é o que impede a IA de cair sempre no mesmo visual.
const ART_DIRECTIONS: ArtDirection[] = [
  { id: 'editorial', name: 'Editorial de revista', idea: 'diagramação de revista impressa na web: manchete gigante em serifa, colunas de texto, legendas e numeração de páginas', fonts: 'Instrument Serif ou Fraunces nos títulos (itálico em palavras-chave), DM Sans ou Hanken Grotesk no corpo, detalhes em mono pequeno', palette: 'papel off-white #f3efe7, tinta #14120f, um único destaque vermelho-tomate #d6381f', layout: 'grade de 12 colunas quebrada de propósito, imagens com legenda, linhas finas separando seções, títulos que invadem a coluna vizinha, índice numerado lateral', motion: 'revelação de títulos linha a linha com máscara, imagens que abrem com clip-path, números de seção que trocam ao rolar' },
  { id: 'brutalist', name: 'Brutalismo elegante', idea: 'estética crua e grande: blocos de cor chapada, tipografia gigante, bordas grossas e contraste agressivo, mas com acabamento impecável', fonts: 'Archivo Black ou Unbounded nos títulos em caixa alta, Space Mono ou JetBrains Mono no corpo', palette: 'fundo #e8e4d9 ou amarelo-ácido #e5ff3a, preto #0b0b0b, um segundo bloco azul-cobalto #1f3bff', layout: 'blocos retangulares colados sem gap, títulos que ocupam 100% da largura, tabelas e listas com linhas grossas, rótulos tipo etiqueta', motion: 'marquee gigante, hover que inverte cores do bloco inteiro, títulos que se deslocam em direções opostas ao rolar' },
  { id: 'luxe', name: 'Minimalismo de luxo', idea: 'silêncio visual: muito espaço, poucas palavras, imagens grandes e transições lentas, sensação de marca premium', fonts: 'Cormorant Garamond ou Playfair Display nos títulos em tamanho médio com tracking aberto, Jost ou Manrope no corpo', palette: 'preto quente #0e0d0c, areia #cbbfae, branco-osso #f6f2ea, detalhes em dourado fosco #b8975a', layout: 'seções de altura total com um único elemento por tela, imagens em tela cheia com texto sobreposto discreto, menu minimalista em duas palavras', motion: 'fades lentos, parallax suave, cursor customizado que cresce sobre imagens, transição de página por cortina' },
  { id: 'techdark', name: 'Tech técnico escuro', idea: 'painel de instrumento: terminal, grids de pontos, números em tempo real e diagramas, passa precisão de engenharia', fonts: 'Geist Mono ou IBM Plex Mono nos rótulos, Sora ou Outfit nos títulos', palette: 'grafite #0a0c10, linhas #1c222b, destaque verde-fósforo #3dff9a ou ciano #19d3ff, texto #d8dee6', layout: 'cards com cantos retos e linhas de 1px, coordenadas e marcadores nos cantos das seções, gráfico/diagrama SVG animado no hero, tabela de especificações', motion: 'texto digitando, contadores, linhas que se desenham (stroke-dashoffset), glitch sutil em hover, grade que reage ao cursor' },
  { id: 'organic', name: 'Orgânico e acolhedor', idea: 'formas suaves, cores de terra e textura de papel: calor humano, artesanal, natural', fonts: 'Bricolage Grotesque ou Recoleta-like (Young Serif) nos títulos, Nunito Sans ou Figtree no corpo', palette: 'creme #f4ead8, verde-musgo #2f4a35, terracota #c4572c, mostarda #e0a526', layout: 'blobs e curvas SVG como divisores de seção, cartões com raios assimétricos, fotos recortadas em formas orgânicas, selos circulares girando', motion: 'formas que flutuam, selo rotativo, hover que balança cartões, revelação com escala suave' },
  { id: 'neo-pop', name: 'Neo-pop colorido', idea: 'energia jovem: cores saturadas em blocos, adesivos, tipografia grande e divertida, sensação de marca de cultura pop', fonts: 'Syne ou Clash-like (Bricolage Grotesque 800) nos títulos, Poppins-free: use Plus Jakarta Sans no corpo', palette: 'três cores vivas combinadas, por exemplo #ff5b2e, #ffd23f, #2b59ff sobre off-white #fff8ec e tinta #111', layout: 'cards inclinados com rotação leve, adesivos e etiquetas sobrepostos, seções com cor de fundo diferente, botões grandes arredondados', motion: 'elementos que quicam com mola, adesivos arrastáveis, hover que gira e cresce, marquee colorido' },
  { id: 'swiss', name: 'Tipografia suíça', idea: 'rigor de grade e tipografia: hierarquia clara, alinhamentos perfeitos, poucas cores, tudo organizado em módulos', fonts: 'Inter Tight ou Schibsted Grotesk em pesos 500/700 com títulos enormes e tracking negativo, sem serifa', palette: 'branco #fafafa, preto #0a0a0a, um único vermelho #ff2a1a ou azul #0a3cff como acento', layout: 'grade modular visível, colunas com numeração 01/02/03, texto alinhado à esquerda em blocos de largura fixa, grandes áreas vazias intencionais', motion: 'transições secas e rápidas, números e índices que mudam ao rolar, sublinhados que se desenham no hover' },
  { id: 'cinematic', name: 'Cinematográfico', idea: 'trailer de filme: seções como cenas em tela cheia, contraste dramático, texto grande sobre imagem escurecida', fonts: 'Big Shoulders Display ou Anton nos títulos condensados em caixa alta, Barlow ou Work Sans no corpo', palette: 'preto #060606, vermelho-sangue #c8102e ou laranja-pôr-do-sol #ff7a1a, cinza-fumaça #8d8d8d', layout: 'seções 100svh com foto de fundo (data-photo) e overlay em gradiente, legendas estilo créditos, contador de cena, barra de proporção 2.39:1', motion: 'scroll sticky com troca de cenas, texto que aparece letra a letra, zoom lento nas imagens (Ken Burns), grão de filme animado' },
  { id: 'retro', name: 'Retrô futurista', idea: 'nostalgia dos anos 70/80 com cara de agora: gradientes de pôr do sol, formas geométricas, tipografia arredondada e cromada', fonts: 'Righteous, Monoton só em destaques ou Rubik Mono One nos títulos, Space Grotesk no corpo', palette: 'roxo-noite #1a0b2e, magenta #ff2e88, laranja #ff8a00, ciano #00e5ff', layout: 'sol/horizonte em SVG, grade em perspectiva, cartões com cantos muito arredondados, faixas diagonais', motion: 'grade em perspectiva que se move, sol pulsante, texto com brilho neon, tilt 3D nos cartões' },
  { id: 'bauhaus', name: 'Geométrico Bauhaus', idea: 'formas primárias (círculo, quadrado, triângulo) como linguagem visual: composição gráfica ousada e equilibrada', fonts: 'League Spartan ou Outfit 800 nos títulos, Work Sans no corpo', palette: 'vermelho #e63312, amarelo #f6c500, azul #1d4ed8 sobre creme #f2ebdd e preto #111', layout: 'composições de formas geométricas em SVG no hero e nos divisores, seções em módulos de cores primárias, texto em blocos retos', motion: 'formas que giram e se encaixam ao rolar, cores que alternam no hover, transições geométricas (círculo que expande como cortina)' },
  { id: 'glass', name: 'Vidro e profundidade', idea: 'camadas translúcidas, luz e profundidade: cartões de vidro sobre gradientes fluidos e formas 3D suaves', fonts: 'Plus Jakarta Sans ou Onest nos títulos em peso 600, Inter no corpo, números em Geist Mono', palette: 'gradiente malha entre #0b1020, #3b2bff e #00d1b2 com luz branca, ou versão clara #eef2ff com acentos #5b4bff', layout: 'cartões com backdrop-filter e borda de 1px clara, orbes de gradiente desfocados ao fundo, ícones grandes em 3D simples via CSS', motion: 'orbes que flutuam, cartões com tilt e brilho seguindo o cursor, números que contam, entradas escalonadas' },
  { id: 'zine', name: 'Zine / colagem', idea: 'colagem de recortes, fita adesiva, textos sobrepostos e fotos em P&B: visual artesanal e rebelde, mas legível', fonts: 'Rubik Glitch só no logo, Bebas Neue ou Anton nos títulos, Special Elite ou Courier Prime em anotações, Karla no corpo', palette: 'papel #efe9dc, preto #151515, rosa-choque #ff3d8b e marca-texto amarelo #fff04d', layout: 'elementos sobrepostos com rotação, fitas e rasgos em SVG/CSS, fotos com filtro P&B e halftone, títulos recortados tipo ransom note', motion: 'recortes que balançam, sublinhado de marca-texto que se pinta, hover que gira o recorte, scroll com camadas em velocidades diferentes' },
];

const LAST_DIRECTIONS_KEY = 'aura_sites_last_directions';

function pickDirections(count = 2): ArtDirection[] {
  let recent: string[] = [];
  try { recent = JSON.parse(localStorage.getItem(LAST_DIRECTIONS_KEY) || '[]'); } catch {}
  const pool = ART_DIRECTIONS.filter((d) => !recent.includes(d.id));
  const bag = pool.length >= count ? pool : ART_DIRECTIONS;
  const picked: ArtDirection[] = [];
  const copy = [...bag];
  while (picked.length < count && copy.length) picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  try { localStorage.setItem(LAST_DIRECTIONS_KEY, JSON.stringify([...picked.map((d) => d.id), ...recent].slice(0, 6))); } catch {}
  return picked;
}

// Fonte padrão de todo site criado pela IA: só muda se o usuário pedir outra.
const DEFAULT_FONT = 'Poppins';

const directionBlock = (d: ArtDirection, i: number) =>
  `DIREÇÃO ${String.fromCharCode(65 + i)} · ${d.name}\n- Ideia: ${d.idea}\n- Fontes (Google Fonts, use ${DEFAULT_FONT} em todo o site, nos títulos e no texto, variando só peso, tamanho e estilo; outra fonte só se o usuário pediu): ${DEFAULT_FONT}\n- Paleta: ${d.palette}\n- Layout: ${d.layout}\n- Movimento: ${d.motion}`;


// Pacote obrigatório de movimento e efeitos da criação livre: os modelos do catálogo têm tudo isso, e sem exigência explícita a IA entrega um site estático.
const LANDBOOK_KIT = `REFERÊNCIA LAND-BOOK (https://land-book.com/websites): galeria com milhares de landing pages reais, organizadas por categoria/segmento, estilo e cor. É a melhor fonte para decidir A ESTRUTURA da página do segmento do usuário. Se você tiver acesso à web, abra a galeria, filtre pelo segmento do negócio (SaaS, saúde, educação, finanças, e-commerce, agência, restaurante, imobiliário etc.) e pelo estilo (minimal, dark, bold, editorial), abra 3 exemplos e anote: a ordem das seções, como o hero apresenta a oferta, que provas aparecem (números, logos, depoimentos), como o preço/CTA é tratado, o ritmo entre seções densas e vazias. Se o site bloquear o acesso (403), siga sem ele e use o que você conhece desses padrões. Regras: só a estrutura e a linguagem visual servem de inspiração; nunca copie textos, marcas, logos, ilustrações nem imagens, e nunca repita a sequência de um único exemplo: combine o que funciona para o segmento com a estrutura sorteada abaixo.`;

const AWWWARDS_KIT = `REFERÊNCIA AWWWARDS (https://www.awwwards.com/websites/): vitrine dos sites premiados. Se você tiver acesso à web, abra a lista, escolha 2 ou 3 sites cujo tema se aproxime do pedido (filtros por categoria e tecnologia em /websites/<tecnologia>/, ex.: /websites/gsap/, /websites/three-js/, /websites/webgl/) e abra a página de cada um (/sites/<nome>) para ver as tecnologias e técnicas usadas. Inspire-se na linguagem (layout, tipografia, ritmo, transições, interação), sem copiar textos, marcas, logos nem imagens. Se não tiver acesso, use as técnicas recorrentes desses sites:
- Rolagem suave com Lenis + GSAP ScrollTrigger (pin, scrub, seções que se revelam, texto que se move com o scroll).
- Tipografia gigante e expressiva, títulos divididos em linhas/letras/palavras animadas (estilo SplitText), marquees infinitos.
- Cursor customizado que reage a links e imagens (magnético, com rótulo "ver", que cresce no hover).
- Efeitos WebGL/shader leves (ogl ou three) em fundos ou imagens: distorção no hover, ondas, ruído, gradientes fluidos; sempre com fallback em CSS.
- Transições de página/seção (cortina, clip-path, máscara) e loader curto com contador ou palavra.
- Layouts que quebram a grade: sobreposição, texto atrás de imagem, colunas assimétricas, scroll horizontal em seção pinada, listas enormes que mudam a imagem no hover.
- Acabamento: grain/noise sutil, microinterações em botões, estados de hover com atraso escalonado, tudo respeitando prefers-reduced-motion.`;

const MOTION_KIT = `MOVIMENTO E EFEITOS (OBRIGATÓRIO: o site precisa parecer vivo, como os modelos do catálogo)
O motor AURA FX (seção anterior) já entrega cursor, loader, revelações, cenas por scroll, magnético e tilt. Esta seção cobre o que vai além dele: fundo animado, efeitos próprios do conceito e acabamento. O que entra é definido pelo plano sorteado. Confira a lista no fim e acrescente o que faltar antes de responder.

1. FUNDO ANIMADO (escolha um coerente com a direção e use no hero; um segundo, mais discreto, em outra seção):
   - Malha de gradiente/aurora: 3 a 4 orbes (div com radial-gradient + filter:blur(60px)) animados com @keyframes de translate/scale em 12-24s alternate.
   - Grão de filme: overlay fixed com SVG feTurbulence (data URI) em opacity .06-.12 e mix-blend-mode, deslocando em steps().
   - Grade/pontos que reagem ao cursor: canvas ou background radial-gradient com máscara que segue --mx/--my.
   - Partículas ou linhas de fluxo em <canvas> (requestAnimationFrame, 40-120 elementos, pausa quando fora da tela e com prefers-reduced-motion).
   - Shader simples em canvas 2D/WebGL (ondas, ruído) ou Three.js só se o conceito pedir.
2. CURSOR: elemento customizado (círculo/ponto) que segue o ponteiro com lerp, cresce sobre links e imagens e vira rótulo ("Ver", "Arraste"); só em dispositivos com hover (@media (hover:hover)).
3. LOADER DE ENTRADA: 1,2 a 2s com marca/contador de 0 a 100 e saída por cortina (clip-path ou translateY), liberando as animações do hero só depois.
4. REVELAÇÕES: divida títulos em linhas/palavras/letras (JS) e anime com máscara (overflow:hidden + translateY 110% para 0, easing cubic-bezier(.16,1,.3,1), atraso escalonado). Imagens abrem com clip-path ou escala 1.15 para 1. Use IntersectionObserver para disparar ao entrar na tela.
5. SCROLL: pelo menos dois entre parallax em camadas (velocidades diferentes), seção sticky com troca de conteúdo, scroll horizontal em faixa de cards, texto que preenche por palavra ao rolar, barra de progresso, marquee que acelera com a rolagem, animation-timeline: view() com fallback.
6. MICROINTERAÇÕES (mínimo 3 tipos): botões magnéticos, hover com preenchimento circular/deslizante, cards com tilt 3D e brilho que segue o mouse, links com sublinhado que se desenha, ícones que giram/pulsam, contadores animados de números, marquee infinito, acordeões com altura animada, estados de foco visíveis.
7. NAVEGAÇÃO: nav que encolhe/muda de fundo ao rolar e esconde ao descer/aparece ao subir; menu mobile com animação de abertura.
8. TÉCNICA: anime só transform e opacity quando possível; will-change em elementos que se movem muito; um único loop requestAnimationFrame compartilhado; tudo sob @media (prefers-reduced-motion: no-preference), com o conteúdo visível e legível sem JS ou com movimento reduzido; nada pode travar o scroll nem esconder conteúdo se uma biblioteca de CDN falhar.

CONFERÊNCIA FINAL (releia o index.html): cada item do PLANO DE MOVIMENTO E COMPOSIÇÃO está implementado e funciona? há um efeito de fundo ou do hero com assinatura própria? as transições entre seções são as do plano? Se algo faltar, implemente antes de terminar; não acrescente itens que não estão no plano.`;

/** React Bits (reactbits.dev): biblioteca de componentes e efeitos prontos que a IA deve consultar e usar em toda criação livre. */
export const REACTBITS_KIT = `REACT BITS (OBRIGATÓRIO: https://reactbits.dev, repositório https://github.com/DavidHDev/react-bits)
É a biblioteca de efeitos e componentes animados que você DEVE consultar e usar. Não invente do zero o que já existe lá.

COMO CONSULTAR (faça isso de verdade, com acesso web, antes de escrever o HTML)
1. Liste as opções da categoria: https://api.github.com/repos/DavidHDev/react-bits/contents/src/content/<Categoria>
2. Leia o código do componente escolhido: https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/content/<Categoria>/<Nome>/<Nome>.jsx (e o <Nome>.css quando existir). Veja também as props padrão e os imports (ogl, gsap, three, motion...).
Categorias e exemplos:
- Backgrounds (fundos): Aurora, Silk, Galaxy, Particles, Plasma, Iridescence, LiquidChrome, LightRays, Waves, DotGrid, Threads, Beams, Lightning, Orb, Hyperspeed, GridScan, PixelBlast, Ballpit, Prism, SoftAurora, DarkVeil, RippleGrid, Grainient, FloatingLines, LineWaves, Topography.
- TextAnimations: SplitText, BlurText, ShinyText, GradientText, DecryptedText, ScrambledText, ScrollReveal, ScrollFloat, ScrollVelocity, TextPressure, VariableProximity, TrueFocus, RotatingText, CountUp, Shuffle, GlitchText, FuzzyText, TextType, CurvedLoop.
- Animations: BlobCursor, SplashCursor, TargetCursor, GlareHover, Magnet, ClickSpark, ImageTrail, PixelTransition, AnimatedContent, FadeContent, Noise, MetaBalls, MetallicPaint, ElectricBorder, StarBorder, LaserFlow, LogoLoop, ScrollExpand.
- Components: SpotlightCard, TiltedCard, MagicBento, ChromaGrid, BounceCards, CardSwap, ScrollStack, InfiniteMenu, FlowingMenu, GooeyNav, PillNav, StaggeredMenu, Dock, CircularGallery, DomeGallery, Carousel, Masonry, GlassSurface, ProfileCard, Stepper, AnimatedList, BorderGlow, HoloCard.

QUANTO USAR (mínimo): 1 Background no hero, 1 TextAnimation nos títulos principais, 1 Animation (cursor, magnet, glare ou transição) e 2 Components nas seções de conteúdo. Escolha os que combinam com a direção de arte e com o negócio; não use todos nem os mais óbvios sempre (varie entre criações).

COMO USAR NUM ÚNICO index.html (sem build)
- Monte um <script type="importmap"> com versões fixas via https://esm.sh: react@18.3.1, react-dom@18.3.1/client e as dependências que o código importa (ogl, gsap, three, motion...), conferindo o nome exato no import do componente.
- Cole o código do componente no <script type="module"> convertendo o JSX para React.createElement (ou use htm). Se Tailwind for usado no original, traduza para CSS em <style>. Monte cada componente numa pequena raiz (createRoot) dentro de um container do HTML, com o resto do site em HTML/CSS normal.
- Componentes simples (texto, hover, cards) podem ser portados para JS puro. Efeitos WebGL (ogl/three) mantenha como estão.
- Posicione o fundo com position:absolute/fixed; inset:0; z-index:0 e pointer-events conforme o efeito, com o conteúdo acima. Dê altura ao container (os efeitos precisam de width/height do pai).
- Cores: troque as props de cor pelas da paleta do site. Performance: um único Background pesado por vez, e pare/oculte fora da viewport.
- Fallback: se o import falhar, o site continua legível (cor/gradiente CSS de fundo e texto normal). Cite no fim da resposta quais componentes React Bits usou.
- Licença: o uso nos sites é permitido; não copie a documentação do site, só o código dos componentes.`;

// Plano de movimento e composição sorteado a cada criação livre: sem ele a IA repete sempre o mesmo kit (loader com contador, cursor em anel,
// botão magnético, marquee, cortina...). Cada categoria evita as últimas escolhas.
const MOTION_POOLS: Record<string, string[]> = {
  hero: [
    'parallax em camadas com o título gigante ATRÁS do sujeito recortado (a mesma foto em duas camadas: fundo e recorte data-cutout com data-photo-id), profundidade pelo mouse e pelo scroll',
    'parallax em 4 camadas: fundo distante, névoa semitransparente, sujeito recortado e primeiro plano (folhas, rochas, nuvens) em profundidades diferentes, com zoom suave ao rolar',
    'cena em camadas (céu, montanhas, primeiro plano) que se afastam em velocidades diferentes ao rolar (data-depth e data-drift) com o título fixo no centro',
    'campo de pontos ou grade em canvas que reage ao ponteiro (repulsão e brilho)',
    'malha de gradiente: orbes grandes com blur que derivam sozinhos e seguem o ponteiro com atraso',
    'linhas de fluxo ou ondas em canvas 2D (ruído suave) atrás do título',
    'título gigante com preenchimento por imagem/gradiente animado (background-clip:text) cuja posição acompanha o mouse',
    'lanterna: círculo que segue o mouse e revela uma segunda camada (outra cor, outra foto ou outro texto) por baixo',
    'sujeito recortado (data-cutout) flutuando em camadas de parallax com rotação 3D leve ao mouse e título passando por trás',
    'partículas que formam uma forma/logo e se dispersam ao passar o mouse, depois se reagrupam',
    'duas faixas de texto gigante em direções opostas atrás/na frente do sujeito principal',
    'distorção líquida em imagem no hover (SVG feTurbulence + feDisplacementMap animado)',
    'rastro de imagens: ao mover o mouse, fotos aparecem e somem seguindo o trajeto',
    'cena 3D em CSS: cartões ou formas em perspectiva que giram com o scroll e inclinam com o mouse',
    'shader WebGL (ogl) de gradiente com ruído como fundo, com fallback em CSS',
    'tipografia cinética: letras do título mudam peso, espaçamento ou deslocamento conforme a distância do cursor',
    'grade de blocos/fotos que se reorganiza com animação de flip ao carregar e ao rolar',
  ],
  loader: [
    'SEM loader: a página entra direto e o hero se revela',
    'SEM loader: o hero abre com uma cortina que sobe uma única vez',
    'contador de 0 a 100 com cortina de saída',
    'palavra da marca revelada por máscara que sobe e sai',
    'linha fina que se desenha e abre a tela em duas metades',
    'forma/logo que cresce até preencher a tela e vira o fundo do hero',
  ],
  cursor: [
    'cursor NATIVO (sem cursor customizado)',
    'cursor NATIVO (sem cursor customizado)',
    'cursor NATIVO, com realce nos elementos clicáveis via hover (sem anel)',
    'anel com rótulo contextual (data-cursor) que cresce sobre links e imagens',
    'halo/spotlight suave que ilumina o fundo onde o mouse está (esconde o cursor nativo)',
    'ponto com rastro (trail) elástico (esconde o cursor nativo)',
  ],
  text: [
    'títulos por palavras com máscara (data-split)',
    'títulos por letras com stagger e leve rotação',
    'títulos por linhas com blur-in e deslocamento',
    'títulos com efeito decrypt/scramble ao entrar',
    'blocos de texto que entram por clip-path (sem dividir em palavras)',
    'texto que se preenche por palavra conforme a rolagem (cinza para cor cheia)',
  ],
  transition: [
    'camadas de parallax que se separam (data-depth) quando a seção seguinte sobe, revelando o fundo entre elas',
    'troca de cor da página entre seções (data-bg)',
    'seção que entra como cortina arredondada (data-curtain)',
    'cena fixa (pin) contando uma história em 3 a 5 passos controlados pelo scroll',
    'faixa de scroll horizontal com cartões (data-hscroll)',
    'cartas empilhadas (data-stack)',
    'círculo (clip-path) que expande a partir de um ponto e revela a próxima seção',
    'duas metades da tela que se abrem revelando a seção seguinte',
    'imagem em tela cheia que encolhe até virar um cartão da grade conforme o scroll',
    'título sticky enquanto o conteúdo ao lado troca de item ao rolar',
    'faixas de fundo com parallax em velocidades diferentes e texto que cruza as seções',
    'zoom: a seção seguinte emerge de dentro de um elemento da anterior (scale + clip-path)',
  ],
  micro: [
    'botões com preenchimento circular que nasce do ponto do mouse',
    'botão magnético (data-magnetic)',
    'cartões com tilt 3D e brilho que segue o mouse (data-tilt)',
    'links com sublinhado que se desenha e texto que "rola" (troca por uma cópia) no hover',
    'imagens que ganham zoom lento e máscara no hover',
    'listas onde o item em hover recebe destaque e os demais escurecem',
    'ícones que giram/pulsam e contadores que animam números',
    'acordeões com altura animada e sinal "+" que gira',
    'campos de formulário com rótulo flutuante e linha que cresce no foco',
  ],
  nav: [
    'pílula flutuante central com blur',
    'barra lateral vertical fixa com índice numerado das seções',
    'logo + botão de menu que abre um overlay de tela cheia animado',
    'barra mínima que esconde ao descer e volta ao subir',
    'nav inferior fixa (estilo app) com itens que destacam a seção atual',
  ],
  layout: [
    'colunas assimétricas com texto curto e imagem sangrando para fora da grade',
    'faixa full-bleed de tipografia gigante',
    'lista tipográfica enorme (cada linha é um item e revela uma imagem no hover)',
    'bento grid com blocos de tamanhos diferentes',
    'split-screen com um lado sticky e o outro rolando',
    'colagem com elementos sobrepostos e levemente rotacionados',
    'índice editorial numerado (01, 02, 03...) com linhas finas',
    'carrossel central com cartões em perspectiva',
    'números e dados em escala monumental com legendas pequenas',
    'rodapé gigante com a marca em escala total',
  ],
};
const LAST_MOTION_KEY = 'aura_sites_last_motion';

function pickFrom(pool: string[], n: number, recent: string[]): string[] {
  const fresh = Array.from(new Set(pool)).filter((x) => !recent.includes(x));
  const bag = fresh.length >= n ? fresh : Array.from(new Set(pool));
  const out: string[] = [];
  while (out.length < n && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  return out;
}

function motionPlan(): string {
  let recent: Record<string, string[]> = {};
  try { recent = JSON.parse(localStorage.getItem(LAST_MOTION_KEY) || '{}'); } catch {}
  const counts: Record<string, number> = { hero: 1, loader: 1, cursor: 1, text: 1, transition: 3, micro: 3, nav: 1, layout: 4 };
  const plan: Record<string, string[]> = {};
  for (const k of Object.keys(MOTION_POOLS)) {
    plan[k] = pickFrom(MOTION_POOLS[k], counts[k], recent[k] || []);
    recent[k] = [...plan[k], ...(recent[k] || [])].slice(0, k === 'cursor' ? 2 : 6);
  }
  try { localStorage.setItem(LAST_MOTION_KEY, JSON.stringify(recent)); } catch {}
  const li = (label: string, k: string) => `- ${label}: ${plan[k].join('; ')}`;
  return `PLANO DE MOVIMENTO E COMPOSIÇÃO DESTE SITE (sorteado para esta criação: siga-o; é isto que faz cada site ser diferente do anterior)
${li('Efeito do hero', 'hero')}
${li('Entrada da página', 'loader')}
${li('Cursor', 'cursor')}
${li('Revelação de textos', 'text')}
${li('Transições entre seções (uma por par de seções, na ordem)', 'transition')}
${li('Microinterações (use só estas)', 'micro')}
${li('Navegação', 'nav')}
${li('Layouts de seção (um diferente por seção principal)', 'layout')}
Regras do plano: execute estes itens com qualidade e coerência com o conceito e o pedido do usuário (se algum conflitar com o pedido, o pedido vence e você adapta). Não acrescente por hábito loader com contador, cursor em anel, botão magnético, marquee ou cortina se não estiverem no plano. Pode combinar com React Bits e com o que o conceito exigir, mas o resultado final precisa ter uma assinatura de movimento própria, diferente do padrão comum.`;
}

const SECTION_POOL = [
  'processo em passos numerados que acompanha o scroll (sticky), cada passo com visual próprio',
  'antes e depois com slider arrastável ou revelação por scroll',
  'manifesto tipográfico: uma frase longa em escala enorme que se acende palavra por palavra',
  'números e provas em escala monumental, cada número com uma legenda curta e específica',
  'catálogo ou portfólio em grade quebrada, com filtro por categoria e revelação de detalhe ao passar o mouse',
  'linha do tempo horizontal da história ou do método, com rolagem lateral',
  'mapa ou rota estilizada com os pontos de atuação, endereço ou cobertura',
  'simulador, calculadora ou quiz curto que entrega um resultado personalizado (orçamento, indicação, estimativa)',
  'depoimento único em destaque, grande, com rosto e contexto concreto (não três cartões iguais)',
  'bastidores: colagem de fotos reais com legendas, mostrando o trabalho acontecendo',
  'comparativo lado a lado (nós versus alternativa comum) com critérios reais do setor',
  'detalhe interativo do produto ou serviço: peças, ingredientes ou etapas que se destacam ao passar o mouse',
  'perguntas frequentes em acordeão tipográfico, com respostas curtas e diretas',
  'equipe ou especialistas em linha editorial, com cargo, especialidade e uma frase de cada',
  'galeria imersiva em tela cheia que troca de imagem conforme o scroll',
  'agenda, calendário ou próximos passos com datas e vagas reais do negócio',
  'selos, parceiros, certificações ou clientes em faixa rolante, com contexto de cada um',
  'guia rápido ou glossário: "o que você precisa saber antes de contratar" em blocos curtos',
  'chamada final grande e específica, com o contato mais fácil do negócio (WhatsApp, telefone, endereço) já pronto para usar',
];
const LAST_SECTIONS_KEY = 'aura_sites_last_sections';

/** Estrutura da página: sorteia ingredientes de seção e proíbe a sequência padrão que todo gerador repete. */
function structurePlan(fromReference = false): string {
  let recent: string[] = [];
  try { recent = JSON.parse(localStorage.getItem(LAST_SECTIONS_KEY) || '[]'); } catch {}
  const picks = pickFrom(SECTION_POOL, 5, recent);
  try { localStorage.setItem(LAST_SECTIONS_KEY, JSON.stringify([...picks, ...recent].slice(0, 10))); } catch {}
  if (fromReference) {
    return `RESTANTE DA PÁGINA (o que a referência não mostra)
A referência costuma mostrar só o primeiro viewport. Tudo que ela NÃO mostra você projeta, e NÃO pode virar o "resto genérico": título e três cartões iguais em fileira, lista de "o que fazemos", etapas em três caixinhas, faixa laranja com botão. Isso é o que faz o site parecer abandonado depois do hero.
- PASSO 1, antes de escrever as seções: extraia o KIT VISUAL do hero e anote: fonte e escala dos títulos (e quais palavras levam a cor de destaque), paleta com hex, como as fotos são tratadas (recorte, camadas, mistura com o fundo), decorações (linhas, selos, rótulos pequenos em duas colunas, numerações), formato dos botões e do nav, espaçamentos e margens laterais.
- PASSO 2: invente as seções seguintes como a continuação natural dessa página, reusando o kit: cada seção tem um título na mesma escala dramática do hero (com a palavra-chave na cor de destaque), pelo menos 2 elementos de assinatura do hero (rótulos pequenos, linhas finas, numeração, selo circular, palavra gigante de fundo, recorte de foto sobreposto ao texto), as mesmas margens e a mesma paleta. Nada de caixas escuras com cantos arredondados e texto pequeno: se a seção tem cartões, eles seguem o estilo do hero (cor de destaque cheia, foto real em sangria, tipografia grande).
- PASSO 3: o ritmo da página alterna cena e respiro: seção com foto grande e título gigante, depois uma seção tipográfica limpa, depois uma de dados em escala monumental, depois uma sticky ou horizontal, fechando com um rodapé gigante com a marca em escala total, como encerramento da página (não uma faixa com botão).
- Crie de 4 a 7 seções com função própria para o negócio do usuário, cada uma com layout diferente das vizinhas. Nada de duas seções seguidas no mesmo formato de grade.
- Use fotos reais (data-photo) nas seções, não só texto sobre fundo escuro.
- Ingredientes sorteados (use ao menos 3, adaptados ao negócio):
${picks.map((x) => `  • ${x}`).join('\n')}`;
  }
  return `ESTRUTURA DA PÁGINA (a sequência de seções NÃO é um template)
Antes de escrever, liste de 5 a 8 seções pensadas para o negócio do usuário: que perguntas um visitante tem, que provas o convencem, que ação ele precisa fazer. A ordem e a quantidade nascem disso e mudam de site para site.
- PROIBIDO como esqueleto automático: hero, bloco de texto, carrossel, grade de cards, preços e CTA nessa ordem. Nenhuma seção existe só "porque todo site tem": preços/planos só se o negócio vende planos com valores; carrossel só se há uma série real de itens; "sobre" só se contar algo que muda a decisão.
- Cada seção tem uma função clara, um nome de conteúdo (não "Seção de cards") e um layout próprio, diferente das vizinhas, com respiro e ritmo variados (uma seção densa, uma vazia e tipográfica, uma de imagem em sangria).
- Ingredientes sorteados para esta criação (use ao menos 3, adaptados ao negócio, no lugar das seções genéricas): 
${picks.map((x) => `  • ${x}`).join('\n')}
- O hero também não é padrão: apresente o negócio por um gesto específico dele (um objeto, um número, uma ação), nunca título centralizado com dois botões.`;
}

/** Criação sem modelo: a IA projeta do zero numa direção de arte sorteada, usando o catálogo só como régua de qualidade. */
export const FREE_TEMPLATE_ID = 'free';
/** Criação a partir de uma referência visual (print/URL): reproduzir fielmente, sem direção de arte sorteada nem plano de movimento. */
const REFERENCE_BRIEF = `CRIAÇÃO A PARTIR DE REFERÊNCIA: o objetivo é REPRODUZIR a referência com a maior fidelidade possível, adaptando só marca, textos e conteúdo ao negócio do usuário. Aqui não existe direção de arte sorteada nem "plano de movimento": a referência manda em tudo.

COMO ANALISAR (abra a imagem de _reference/ e descreva antes de escrever)
- Liste, de cima para baixo, cada elemento visível: nav (formato, posição, cores), hero (alinhamento, escala do título, peso, cores), botões (formato, preenchimento), elementos decorativos (formas, estrelas/brilhos, linhas-guia, pontos, selos: tamanho e posição exatos), imagens (assunto real, enquadramento, largura total ou em moldura, cantos, como se funde com o fundo) e todas as seções seguintes.
- Meça proporções: quanto do primeiro viewport cada bloco ocupa, espaçamentos, largura do conteúdo, tamanho relativo das fontes. Copie a paleta exata (use conta-gotas mental: fundo, texto, destaque, tons da foto).

FIDELIDADE
- Reproduza TODOS os elementos da referência, na mesma ordem, escala e posição. Não acrescente elementos que ela não tem (índice lateral numerado, loader, cursor customizado, rastro de imagens, marquee, barras de progresso, selos) nem troque o estilo por outro "mais criativo".
- Profundidade/parallax: se a referência mostra texto atrás do sujeito (título gigante passando por trás de um prédio, pessoa ou objeto), reproduza com camadas (veja a RECEITA no motor AURA FX): fundo, título, a mesma foto recortada por cima (data-photo-id + data-cutout) e primeiro plano, com parallax de mouse e scroll.
- Foto: use o MESMO assunto da referência, descrito com precisão na consulta do data-photo (ex.: se a referência é uma vista aérea de lavouras verdes ao sol, a consulta é "aerial view green farmland fields sunny", nunca "agriculture" genérico), com o mesmo brilho e saturação: não escureça, não dessature e não ponha filtro sobre a foto. Se a foto se funde com o fundo (degradê), reproduza o degradê com mask-image/gradiente.
- Decorações como estrelas/brilhos de 4 pontas, linhas verticais finas e pontos: copie o tamanho e a posição da referência (se são grandes, faça grandes); nenhuma pode ser cortada pela borda de uma imagem ou seção.
- Movimento: só o que a referência mostra ou sugere, discreto (revelação de títulos, hover, pequena flutuação nas decorações). O motor AURA FX abaixo é opcional: ligue apenas o necessário.
- Texto: títulos nos mesmos pontos de quebra de linha e pesos; traduza/adapte o conteúdo para o negócio do usuário mantendo o tamanho aproximado de cada texto.

CONFERÊNCIA FINAL OBRIGATÓRIA: reabra a imagem de referência e compare com o seu index.html, bloco a bloco. Liste mentalmente as 5 diferenças mais visíveis (assunto e brilho da foto, escala do título, decorações, espaçamentos, cores, elementos extras que não existem na referência) e corrija todas antes de responder.

TECNOLOGIA: CSS e JS puros; bibliotecas via CDN com versão fixa só se a referência exigir (ex.: GSAP).`;

export function freeTemplate(fromReference = false): SiteTemplate {
  if (fromReference) {
    return {
      id: FREE_TEMPLATE_ID,
      name: 'Criação a partir de referência',
      category: 'Livre',
      description: 'Site criado a partir de um print ou URL de referência, reproduzido com fidelidade.',
      colors: ['#ffffff', '#1a7f2a', '#0f1720'],
      brief: `${REFERENCE_BRIEF}\n\n${structurePlan(true)}\n\n${AURA_FX_GUIDE}`,
    };
  }
  const dirs = pickDirections(2);
  const plan = motionPlan();
  const structure = structurePlan();
  return {
    id: FREE_TEMPLATE_ID,
    name: 'Criação livre',
    category: 'Livre',
    description: 'Site criado do zero pela IA, numa direção de arte sorteada.',
    colors: ['#0a0a0a', '#7c6cff', '#f5f3ff'],
    brief: `CRIAÇÃO LIVRE (sem modelo escolhido): projete um site autoral, memorável e fora do comum, no nível dos melhores sites premiados (Awwwards, Godly). O alvo é "isso foi desenhado por um estúdio", nunca "isso saiu de um gerador".

O PEDIDO DO USUÁRIO MANDA EM TUDO: tema (claro/escuro), paleta de cores, tipo de componentes, tamanho, tom e estilo que ele citou são obrigatórios e anulam qualquer cor, fonte ou regra visual da direção de arte, do PROIBIDO e do EXIGIDO abaixo. Exemplo: se ele pede "dark mode em cinza, preto e branco", o site inteiro usa só essas cores (sem amarelo, azul, laranja ou fundo creme) e a direção de arte entra apenas como linguagem de layout, tipografia e movimento. Só use as cores e o estilo da direção naquilo que o usuário não especificou.

DIREÇÃO DE ARTE (use UMA destas duas, a que mais combina com o pedido e o negócio, adaptando-a às restrições do usuário). Execute com consistência, sem misturar com outra e sem cair num visual padrão:
${dirs.map(directionBlock).join('\n\n')}

PROIBIDO (é isso que faz o site parecer genérico)
- Hero centralizado com título + subtítulo + dois botões sobre gradiente roxo/azul.
- Cartões arredondados todos do mesmo tamanho em fileira de três.
- Fonte diferente de ${DEFAULT_FONT} sem o usuário ter pedido (use ${DEFAULT_FONT} em todo o site) e a fonte padrão do navegador.
- Ícones de linha dentro de círculos coloridos como "features"; depoimentos em três cartões iguais; seção "Sobre nós" com foto ao lado de texto.
- Todas as seções com a mesma estrutura (título centralizado + grid). Cada seção principal precisa ter um layout diferente das demais.
- A sequência padrão hero, texto, carrossel, cards, preços e CTA (veja ESTRUTURA DA PÁGINA).
- Gradientes genéricos, sombras difusas pesadas, tons pastel, emojis.

EXIGIDO
- Um conceito visual central que nasce do negócio (um objeto, uma metáfora, um gesto) e aparece no hero e se repete como assinatura no resto do site.
- Títulos com escala dramática (clamp até ~10vw no hero), contraste forte entre tamanhos, line-height apertado e entrelinhas intencionais.
- Hero com um momento interativo ou animado que só este site tem (não apenas fade-in).
- Pelo menos 3 layouts de seção distintos (por exemplo: assimétrico em colunas, faixa full-bleed, lista tipográfica enorme, sticky/scroll horizontal, grade quebrada).
- Movimento com propósito, definido pelo PLANO DE MOVIMENTO sorteado abaixo (efeito do hero, entrada, cursor, revelações, transições, microinterações, navegação e layouts). Siga o plano e não caia no kit habitual.
- Imagens: fotos reais via <img data-photo="..."> (veja as regras do arquivo) para tudo que for pessoa, produto ou objeto, tratadas com filtro/recorte/máscara coerente com a direção; SVG/CSS apenas para ícones, formas e fundos abstratos, nunca para desenhar objetos ou produtos. Nada de caixas cinzas vazias.
- Textos reais e específicos do negócio (números, nomes de serviços, frases com personalidade), nunca "Lorem" nem frases de marketing genéricas.

QUALIDADE DE REFERÊNCIA: os modelos do catálogo abaixo mostram o nível de acabamento esperado (não copie o visual deles):
${inspirationList()}

${AWWWARDS_KIT}

${LANDBOOK_KIT}

${structure}

${plan}

${AURA_FX_GUIDE}

${REACTBITS_KIT}

${MOTION_KIT}

TECNOLOGIA: bibliotecas via CDN com versão fixa quando elevarem o resultado (GSAP + ScrollTrigger, Lenis, Three.js só se o conceito pedir), sempre com fallback se falharem. Sem bibliotecas, use CSS moderno (clip-path, mix-blend-mode, @property, scroll-driven animations, view transitions, backdrop-filter) e JS puro.`,
  };
}

export function templateById(id: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((t) => t.id === id);
}
