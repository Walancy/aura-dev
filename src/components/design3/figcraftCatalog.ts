import { tokensPromptBlock, type DesignTokens } from '../design2/designTokens';
import { COMMON_ICON_NAMES } from '../design2/icons';

export type TaskComplexity = 'simple' | 'medium' | 'complex';
export type ComponentCategory = 'atomic' | 'molecular' | 'organism';
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'watch' | 'tv-slide' | 'social';

export interface ProductDomainContext {
  id: string;
  name: string;
  keywords: RegExp;
  defaultDevice: 'mobile' | 'desktop';
  paletteHint: string;
  typographyHint: string;
  keyModules: string[];
  typicalMetrics: string[];
  recommendedIcons: string[];
}

export interface ComponentRecipeSpec {
  id: string;
  name: string;
  category: ComponentCategory;
  complexity: TaskComplexity;
  keywords: RegExp;
  width: number;
  height: number;
  maxShapes: number;
  recipe: string;
  recommendedIcons: string[];
}

export interface IconCategorySpec {
  id: string;
  name: string;
  description: string;
  icons: string[];
  ptKeywords: string[];
}

export interface DeviceFormatSpec {
  id: string;
  name: string;
  category: DeviceCategory;
  width: number;
  height: number;
  mobile: boolean;
  cornerRadius: number;
  keywords: RegExp;
}

export interface TaskComplexitySpec {
  tier: TaskComplexity;
  label: string;
  effort: 'low' | 'medium';
  timeoutMs: number;
  stallTimeoutMs: number;
  maxShapes: number;
  useCompactPrompt: boolean;
  canReadProjectFiles: boolean;
  skipSeparateVisionPass: boolean;
  description: string;
}

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ============================================================================
// 1. CATALOGO DE CONTEXTOS E DOMINIOS DE PRODUTO
// ============================================================================

export const PRODUCT_CONTEXTS: ProductDomainContext[] = [
  {
    id: 'fintech',
    name: 'Fintech, Banco Digital e Carteira',
    keywords: /\b(fintech|banco|bancari[oa]|pix|carteira|wallet|cartao|credito|debito|extrato|transferencia|investimento|cripto|crypto|saldo|fatura|boleto|emprestimo|financeir[oa]|pagamento)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Fundo escuro profundo (#0A0E17) ou claro neutro (#F8FAFC), primaria confiavel (azul real #2563EB, roxo #7C3AED ou verde esmeralda #10B981), indicadores semanticos nitidos para entradas (#10B981) e saidas (#EF4444).',
    typographyHint: 'Numeros tabulares em destaque para saldo (32-40px), rotulos curtos (12-13px), hierarquia limpa entre valor principal e metadados da transacao.',
    keyModules: ['Card de saldo com ocultar valor', 'Atalhos rapidos em circulos (Pix, Pagar, Transferir, Cartoes)', 'Cartao virtual com bandeira e ultimos digitos', 'Lista de transacoes recentes com icone de categoria', 'Grafico de evolucao patrimonial'],
    typicalMetrics: ['Saldo disponivel (R$)', 'Fatura atual (R$)', 'Limite disponivel', 'Rendimento mensal (% CDI)', 'Cashback acumulado'],
    recommendedIcons: ['AccountBalanceWallet', 'CreditCard', 'Paid', 'TrendingUp', 'QrCode', 'SwapHoriz', 'Receipt', 'Visibility', 'Shield', 'Lock'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce, Varejo e Marketplace',
    keywords: /\b(e-?commerce|loja|shopping|produto|produtos|catalogo|carrinho|sacola|checkout|compra|varejo|marketplace|oferta|desconto|vitrine|cupom|frete|pedido)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Superficies claras (#FFFFFF e #F4F4F5) para destacar fotos de produtos, cor de acento vibrante nos CTAs de compra (#EA580C, #2563EB ou #16A34A), selos de desconto em destaque.',
    typographyHint: 'Preco atual forte (18-24px), preco antigo riscado (12-13px cinza), parcelamento em verde, titulo de produto conciso.',
    keyModules: ['Barra de busca com filtro e scanner', 'Banner promocional com CTA', 'Chips de categorias horizontais', 'Grade 2 colunas de ProductCards com foto, selo de desconto, avaliacao e preco', 'Barra fixa de adicionar ao carrinho'],
    typicalMetrics: ['Preco a vista', 'Desconto (%)', 'Avaliacao (4.9 estrelas)', 'Frete e prazo de entrega', 'Subtotal do carrinho'],
    recommendedIcons: ['ShoppingBag', 'ShoppingCart', 'LocalOffer', 'Star', 'Favorite', 'Search', 'FilterList', 'LocalShipping', 'CreditCard', 'Verified'],
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS, B2B, Admin, CRM e ERP',
    keywords: /\b(saas|dashboard|painel|admin|administrativ[oa]|crm|erp|backoffice|analytics|relatorio|metricas|kpi|gestao|gerenciamento|faturamento|clientes|usuarios|organizacao|b2b)\b/,
    defaultDevice: 'desktop',
    paletteHint: 'App shell estruturado em 3 niveis de superficie (fundo #0B0D12 ou #F8FAFC, card #12151E ou #FFFFFF, hover/elevado), divisoria sutil de baixa opacidade, 1 cor primaria para acao principal e estado ativo.',
    typographyHint: 'Titulos de secao 20-24px, valores de KPI 28-36px, cabecalhos de tabela 11-12px em caixa alta com letter-spacing, linhas de dados 13-14px.',
    keyModules: ['Sidebar fixa com grupos de navegacao e perfil', 'Topbar com busca global, filtros de periodo e acao primaria', 'Fileira de 4 StatCards (KPI + variacao percentual)', 'Grafico principal (area/barras) + lista lateral Top N', 'DataTable com busca, status chips, acoes e paginacao'],
    typicalMetrics: ['MRR / Receita recorrente', 'Usuarios ativos (MAU/DAU)', 'Taxa de conversao (%)', 'Ticket medio', 'Churn rate (%)'],
    recommendedIcons: ['Dashboard', 'Analytics', 'BarChart', 'People', 'Settings', 'Search', 'Notifications', 'FilterList', 'Download', 'MoreHoriz'],
  },
  {
    id: 'food-delivery',
    name: 'Delivery, Restaurante e Gastronomia',
    keywords: /\b(delivery|ifood|restaurante|comida|lanche|hamburguer|burger|pizza|cardapio|menu|pedido|entrega|motoboy|cafeteria|cafe|padaria|gastronomia|bebida)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Cores quentes e apetitosas (vermelho #EA1D2C, laranja #F97316 ou ambar #D97706) sobre fundo limpo (#FFFFFF / #FAFAFA) ou escuro premium para bares e hamburguerias.',
    typographyHint: 'Nome do prato/restaurante legivel (16-18px), tempo de entrega e taxa em destaque secundario (12-13px), preco claro na base.',
    keyModules: ['Seletor de endereco no topo', 'Carrossel de categorias com foto/icone', 'Card de restaurante com capa, nota, tempo em minutos e taxa de entrega', 'Lista de pratos com foto quadrada arredondada e botao de adicionar', 'Sacola flutuante na base com total'],
    typicalMetrics: ['Tempo de entrega (25-35 min)', 'Taxa de entrega (Gratis / R$ 5,90)', 'Avaliacao (4.8)', 'Distancia (1,8 km)'],
    recommendedIcons: ['Place', 'Search', 'Star', 'AccessTime', 'ShoppingBag', 'Add', 'Remove', 'LocalOffer', 'Receipt', 'Person'],
  },
  {
    id: 'health-fitness',
    name: 'Saude, Clinica, Telemedicina e Fitness',
    keywords: /\b(saude|medicina|medic[oa]|clinica|hospital|consulta|agendamento|exame|paciente|prontuario|telemedicina|fitness|treino|academia|caloria|sono|batimento|bem-?estar|nutricao)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Saude/Clinica: azul-petroleo (#0284C7), ciano (#06B6D4) ou verde-menta (#10B981) sobre fundo claro arejado. Fitness/Treino: escuro energetico (#090D16) com verde-limao (#84CC16) ou laranja (#F97316).',
    typographyHint: 'Numeros grandes para biomarcadores (bpm, kcal, passos, horas de sono) com unidade ao lado em tamanho menor.',
    keyModules: ['Card de proxima consulta com foto do medico, especialidade e horario', 'Aneis de progresso e tiles de sinais vitais (passos, calorias, batimentos, hidratacao)', 'Seletor horizontal de dias da semana', 'Cronograma de medicamentos ou serie de exercicios'],
    typicalMetrics: ['Batimentos (72 bpm)', 'Calorias queimadas (640 kcal)', 'Passos (8.420)', 'Sono (7h 45m)', 'Horario da consulta'],
    recommendedIcons: ['Favorite', 'CalendarMonth', 'AccessTime', 'Person', 'Videocam', 'TrendingUp', 'Check', 'Notifications', 'Star', 'Shield'],
  },
  {
    id: 'education-lms',
    name: 'Educacao, Cursos, LMS e Estudo',
    keywords: /\b(educacao|curso|cursos|aula|aulas|aluno|professor|escola|faculdade|universidade|lms|estudo|aprendizado|modulo|certificado|prova|quiz|biblioteca|mentoria)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Indigo (#4F46E5), violeta (#7C3AED) ou azul (#2563EB) com acento ambar (#F59E0B) para conquistas, ofensiva e progresso.',
    typographyHint: 'Titulos de curso claros, contadores de aulas e duracao em horas/minutos, porcentagem de conclusao visivel.',
    keyModules: ['Card Continuar assistindo com barra de progresso e botao Play', 'Chips de trilhas/categorias', 'Lista de modulos e aulas com duracao e icone de concluido/bloqueado', 'Indicador de sequencia de estudo (streak) e certificados'],
    typicalMetrics: ['Progresso do curso (68%)', 'Aulas concluidas (12/18)', 'Tempo restante (2h 15m)', 'Dias seguidos (14 dias)'],
    recommendedIcons: ['School', 'Bookmark', 'Check', 'Lock', 'AccessTime', 'Star', 'TrendingUp', 'Search', 'Person', 'Article'],
  },
  {
    id: 'social-community',
    name: 'Rede Social, Comunidade, Chat e Mensagens',
    keywords: /\b(social|rede social|feed|post|posts|stories|story|comunidade|chat|conversa|mensagem|mensagens|inbox|perfil|seguidores|curtidas|comentarios|forum)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Superficie neutra limpa para valorizar fotos e avatares, acento vibrante para notificacoes, badges de nao lidos e aneis de stories.',
    typographyHint: 'Nome de usuario forte (14-15px), handle/tempo relativo discreto (12px cinza), corpo do post legivel (14-15px com line-height 1.45).',
    keyModules: ['Faixa horizontal de avatares circulares (Stories/Online)', 'Post card com cabecalho do autor, midia arredondada e barra de interacoes (curtir, comentar, compartilhar, salvar)', 'Lista de conversas com avatar, ponto online, ultima mensagem e badge de nao lidas', 'Campo de envio de mensagem fixo na base'],
    typicalMetrics: ['Seguidores / Seguindo', 'Curtidas e comentarios', 'Mensagens nao lidas', 'Status online'],
    recommendedIcons: ['Chat', 'Favorite', 'Comment', 'Share', 'Bookmark', 'Send', 'Camera', 'Photo', 'Notifications', 'PersonAdd'],
  },
  {
    id: 'travel-mobility',
    name: 'Viagem, Hospedagem, Passagens e Mobilidade',
    keywords: /\b(viagem|viagens|hotel|hospedagem|airbnb|passagem|voo|aviao|aeroporto|reserva|booking|turismo|destino|corrida|uber|mobilidade|transporte|mapa|rota|navegacao)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Azul-ceu (#0284C7), coral (#F43F5E) ou verde-floresta (#059669), com fotos amplas de destinos ou mapa em tela cheia com painel inferior arredondado (bottom sheet).',
    typographyHint: 'Siglas de aeroportos ou destino em destaque (24-32px), datas/horarios alinhados, preco por noite ou por trecho claro.',
    keyModules: ['Card de busca com origem, destino, datas e passageiros', 'Cards de destino/hospedagem com foto grande, selo de avaliacao e preco por noite', 'Cartao de embarque com origem-destino, portao, assento e codigo', 'Mapa com rota + bottom sheet de escolha de veiculo/motorista'],
    typicalMetrics: ['Preco por noite / trecho', 'Avaliacao (4.92)', 'Distancia e tempo estimado (ETA)', 'Portao e horario de embarque'],
    recommendedIcons: ['Place', 'Map', 'CalendarMonth', 'Search', 'Star', 'Favorite', 'Person', 'AccessTime', 'CreditCard', 'Share'],
  },
  {
    id: 'real-estate',
    name: 'Imobiliaria, Imoveis, Aluguel e Arquitetura',
    keywords: /\b(imovel|imoveis|imobiliari[oa]|apartamento|casa|aluguel|venda de imoveis|condominio|corretor|arquitetura|decoracao|quartos|su[ií]tes|metros quadrados|m2)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Tons arquitetonicos sofisticados: carvao (#18181B), areia/off-white (#FAF8F5), verde-salvia ou terracota (#C2410C), fotos amplas de interiores.',
    typographyHint: 'Valor do imovel/aluguel em destaque (22-28px), endereco secundario, chips de especificacoes (m2, quartos, vagas).',
    keyModules: ['Busca com filtro de cidade, tipo de imovel e faixa de preco', 'Card de imovel com foto ampla, preco, endereco e linha de atributos (quartos, banheiros, area m2)', 'Galeria de fotos + mapa de localizacao + card de contato com o corretor'],
    typicalMetrics: ['Valor de venda / aluguel mensal', 'Area privativa (m2)', 'Quartos / Suites / Vagas', 'Valor do condominio e IPTU'],
    recommendedIcons: ['Home', 'Place', 'Map', 'Search', 'FilterList', 'Favorite', 'Share', 'Call', 'Chat', 'Verified'],
  },
  {
    id: 'media-entertainment',
    name: 'Streaming, Musica, Video, Podcast e Eventos',
    keywords: /\b(streaming|musica|player|spotify|playlist|album|artista|podcast|audio|video|filme|filmes|serie|series|cinema|ingresso|evento|festival|show)\b/,
    defaultDevice: 'mobile',
    paletteHint: 'Fundo escuro imersivo (#09090B / #121216) com halo radial derivado da capa do album/filme e controles de alto contraste.',
    typographyHint: 'Titulo da faixa/obra expressivo (20-28px), artista/autor em tom medio (14-16px), contadores de tempo monoespacados ou tabulares (12px).',
    keyModules: ['Capa em destaque com sombra/halo suave', 'Barra de progresso de tempo com marcadores de inicio e fim', 'Controles de reproducao centralizados (shuffle, anterior, play/pause circular grande, proximo, repeat)', 'Carrossel de albuns, episodios ou recomendacoes', 'Mini-player fixo acima da barra de navegacao'],
    typicalMetrics: ['Tempo decorrido / duracao total (02:14 / 03:48)', 'Ouvintes mensais', 'Ano de lancamento e classificacao'],
    recommendedIcons: ['Mic', 'Videocam', 'Favorite', 'Share', 'Download', 'MoreHoriz', 'Search', 'Home', 'Bookmark', 'AccessTime'],
  },
  {
    id: 'ai-devtools',
    name: 'IA, DevTools, IDE, Automacao e Produtividade',
    keywords: /\b(inteligencia artificial|ia|ai|llm|agente|agentes|prompt|chat de ia|copiloto|copilot|ide|devtools|codigo|deploy|pipeline|servidor|cloud|api|automacao|workflow|kanban|tarefas|projeto|produtividade|notion|linear)\b/,
    defaultDevice: 'desktop',
    paletteHint: 'Dark mode tecnico refinado (#090A0F, #11131A, #181B24) com divisoria fina (#FFFFFF12), acento violeta (#8B5CF6), ciano (#06B6D4) ou esmeralda (#10B981).',
    typographyHint: 'Interface enxuta (13-14px), identificadores de tarefas/branches/modelos e latencia em estilo tecnico preciso, status claros.',
    keyModules: ['Sidebar compacta de workspaces, projetos e execucoes', 'Composer de prompt com seletor de modelo, anexos e acao de envio', 'Timeline de passos de execucao, logs ou kanban de tarefas por status', 'Painel de inspecao de metricas (tokens, latencia, status de build)'],
    typicalMetrics: ['Latencia (ms)', 'Tokens consumidos', 'Taxa de sucesso (%)', 'Tarefas concluidas na sprint'],
    recommendedIcons: ['Code', 'Terminal', 'Bolt', 'Rocket', 'Layers', 'Task', 'Check', 'Schedule', 'Settings', 'Tune'],
  },
  {
    id: 'agro-field-erp',
    name: 'Agronegocio, Fazenda, Pecuaria, Campo e Operacoes',
    keywords: /\b(agro|agronegocio|fazenda|pecuaria|gado|bovino|rebanho|pastagem|safra|lavoura|talhao|talhoes|defensivo|insumo|maquinario|trator|leilao|arroba|hectare|clima rural|estancia|cooperativa|logistica|frota)\b/,
    defaultDevice: 'desktop',
    paletteHint: 'Verde-campo profundo (#15803D / #16A34A), tons terrosos/ambar (#D97706) e superficie tecnica limpa (escura para mapas de calor/monitoramento ou clara de alto contraste para uso em campo).',
    typographyHint: 'Indicadores operacionais claros (hectares, cabecas, @, sacas/ha, mm de chuva), rotulos diretos e tabelas escaneaveis.',
    keyModules: ['Painel de indicadores da propriedade/safra (area plantada, rebanho, clima, custos)', 'Mapa de talhoes ou pastagens com camadas de calor/NDVI e pins de alerta', 'Tabela/lista de lotes, manejos, aplicacoes de insumos ou movimentacoes', 'Registro de atividade e log operacional'],
    typicalMetrics: ['Area total (ha)', 'Cabecas / Lotes ativos', 'Produtividade (sc/ha ou @)', 'Precipitacao (mm)', 'Custo operacional (R$/ha)'],
    recommendedIcons: ['Map', 'Place', 'Analytics', 'TrendingUp', 'CalendarMonth', 'Assignment', 'LocalShipping', 'Warning', 'Check', 'Layers'],
  },
];

// ============================================================================
// 2. CATALOGO DE TIPOS DE COMPONENTES E RECEITAS DE AUTO LAYOUT
// ============================================================================

export const COMPONENT_CATALOG: ComponentRecipeSpec[] = [
  // ---- ATOMICOS (Simple: geracao ultra-rapida, poucos nos)
  {
    id: 'button',
    name: 'Botao (Primario / Secundario / Variantes)',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(bot(ao|oes)|button|buttons|cta)\b/,
    width: 220,
    height: 52,
    maxShapes: 12,
    recipe: 'Frame horizontal, align center, gap 8, padding [14,24,14,24], cornerRadius 12 (ou 999 pilula), fill na cor primaria; icone 18px opcional + texto 14-15px width "hug" sem quebra de linha.',
    recommendedIcons: ['ArrowForward', 'Add', 'Check', 'Send', 'Download', 'Bolt'],
  },
  {
    id: 'icon-button',
    name: 'Botao de Icone / Acao Circular',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(botao de icone|icon ?button|botao circular|fab|floating action)\b/,
    width: 48,
    height: 48,
    maxShapes: 8,
    recipe: 'Frame 44x44 ou 48x48, layout horizontal, align center, cornerRadius 12 ou 999, fill de superficie ou cor primaria, contendo icon 20-22px centralizado e badge overlay opcional.',
    recommendedIcons: ['Add', 'Notifications', 'Search', 'Tune', 'Favorite', 'Edit'],
  },
  {
    id: 'badge-chip',
    name: 'Badge, Chip, Tag ou Pilula de Status',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(badge|badges|chip|chips|tag|tags|pilula|etiqueta|selo|status chip)\b/,
    width: 160,
    height: 36,
    maxShapes: 10,
    recipe: 'Frame horizontal, align center, gap 6, padding [6,12,6,12], cornerRadius 999, fill sutil com texto 12-13px width "hug" e ponto (ellipse 6x6) ou icone 14px.',
    recommendedIcons: ['Check', 'Close', 'LocalOffer', 'Verified', 'Bolt', 'FilterList'],
  },
  {
    id: 'avatar',
    name: 'Avatar ou Pilha de Avatares (Avatar Stack)',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(avatar|avatares|avatar stack|pilha de avatares|foto de perfil)\b/,
    width: 180,
    height: 56,
    maxShapes: 12,
    recipe: 'Individual: image circular (width=height=44..56, cornerRadius 999, person:true) + ponto de status online em overlay bottom-right. Pilha: frame horizontal com gap -10, 3-4 avatares circulares com stroke 2 na cor do fundo + pilula contadora "+12".',
    recommendedIcons: ['Person', 'People', 'Verified'],
  },
  {
    id: 'toggle-switch',
    name: 'Switch, Toggle, Checkbox ou Radio',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(toggle|switch|interruptor|checkbox|caixa de selecao|radio button|seletor booleano)\b/,
    width: 280,
    height: 56,
    maxShapes: 12,
    recipe: 'Frame horizontal (align left, gap 12, padding [12,16,12,16], width fill): coluna de rotulo + descricao ("fill") a esquerda e trilho do switch (frame 44x24, cornerRadius 999, padding 2, fill ativo) contendo ellipse 20x20 branca a direita.',
    recommendedIcons: ['Check'],
  },
  {
    id: 'progress-indicator',
    name: 'Barra de Progresso, Anel de Progresso ou Slider',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(barra de progresso|progress ?bar|anel de progresso|progress ?ring|slider|controle deslizante)\b/,
    width: 300,
    height: 88,
    maxShapes: 14,
    recipe: 'Frame vertical (gap 8, padding 16): linha superior com rotulo ("fill") e porcentagem ("hug"); trilho (frame width "fill", height 8, cornerRadius 999) contendo barra preenchida proporcional. Para anel: ellipse com arcStart -90, arcEnd proporcional e arcInner 0.84 sobre trilho 0..360.',
    recommendedIcons: ['TrendingUp', 'Bolt', 'Check'],
  },
  {
    id: 'tooltip-popover',
    name: 'Tooltip ou Popover Contextual',
    category: 'atomic',
    complexity: 'simple',
    keywords: /\b(tooltip|dica flutuante|popover)\b/,
    width: 240,
    height: 76,
    maxShapes: 10,
    recipe: 'Frame vertical ou horizontal compacto (padding [10,14,10,14], cornerRadius 10, gap 4) com titulo curto 12-13px e texto explicativo ou atalho.',
    recommendedIcons: ['Info', 'Help', 'Lightbulb'],
  },

  // ---- MOLECULARES (Simple a Medium: campos, cards focados, controles de navegacao locais)
  {
    id: 'input-field',
    name: 'Campo de Entrada, Input ou Busca (Search Field)',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(input|inputs|campo de (texto|busca|pesquisa|senha|email|entrada)|search ?bar|barra de (busca|pesquisa)|text ?field|textarea)\b/,
    width: 343,
    height: 84,
    maxShapes: 14,
    recipe: 'Frame vertical (gap 6, width 343): rotulo superior 13px ("hug") + caixa do campo (frame horizontal, height 48, padding [12,14,12,14], gap 10, align left, cornerRadius 12) com icone 20px a esquerda, texto/placeholder ("fill") e icone/atalho a direita.',
    recommendedIcons: ['Search', 'Mail', 'Lock', 'Visibility', 'Tune', 'Close'],
  },
  {
    id: 'dropdown-select',
    name: 'Dropdown, Select, Menu Suspenso ou Combobox',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(dropdown|select|combobox|menu suspenso|seletor de opcoes)\b/,
    width: 280,
    height: 220,
    maxShapes: 24,
    recipe: 'Frame vertical (gap 6, width 280): botao gatilho (height 44, layout horizontal, texto "fill" + icone ExpandMore 20px) + menu de opcoes (frame vertical, padding 6, gap 2, cornerRadius 12) contendo 4 itens horizontais (padding [10,12,10,12], cornerRadius 8, icone + texto "fill" + Check no item ativo).',
    recommendedIcons: ['ExpandMore', 'Check', 'Search', 'FilterList'],
  },
  {
    id: 'segmented-tabs',
    name: 'Controle Segmentado ou Abas (Tabs)',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(segmented|controle segmentado|seletor de abas|tabs|barra de abas|abas de filtro)\b/,
    width: 343,
    height: 48,
    maxShapes: 16,
    recipe: 'Frame horizontal (padding 4, gap 4, cornerRadius 12, height 44, fill de superficie sutil) com 3-4 itens horizontais ("width":"fill", align center, padding [8,12,8,12], cornerRadius 9); o item ativo recebe fill contrastante.',
    recommendedIcons: ['CalendarMonth', 'Analytics', 'GridView', 'ViewList'],
  },
  {
    id: 'stat-kpi-card',
    name: 'Card de Metrica / KPI / Estatistica (StatCard)',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(card de (metrica|kpi|saldo|estatistica|resumo|indicador)|kpi ?card|stat ?card|indicador)\b/,
    width: 280,
    height: 148,
    maxShapes: 18,
    recipe: 'Frame vertical (padding 20, gap 12, cornerRadius 16, width 280): topo horizontal com rotulo 13px ("fill") e chip de icone 36x36; meio com valor principal grande 28-32px ("hug"); base horizontal com badge de variacao ("+14,2%", icone TrendingUp 14px) + texto comparativo "vs. mes anterior".',
    recommendedIcons: ['TrendingUp', 'TrendingDown', 'AttachMoney', 'People', 'Analytics', 'Bolt'],
  },
  {
    id: 'product-card',
    name: 'Card de Produto / E-commerce (ProductCard)',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(card de produto|product ?card|card de item|card de loja|card de imovel|card de curso)\b/,
    width: 240,
    height: 310,
    maxShapes: 22,
    recipe: 'Frame vertical (padding 12, gap 12, cornerRadius 18, width 240, clip:true): imagem do produto (width "fill", height 160, cornerRadius 12) + selo de desconto/favorito em overlay top-right; coluna de textos com categoria 11px, titulo 15px e linha inferior horizontal com preco ("fill") e botao de acao circular 36x36.',
    recommendedIcons: ['Favorite', 'ShoppingBag', 'Add', 'Star', 'LocalOffer'],
  },
  {
    id: 'user-profile-card',
    name: 'Card de Usuario, Perfil ou Membro de Equipe',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(card de (usuario|perfil|membro|cliente|medico|profissional)|user ?card|profile ?card)\b/,
    width: 320,
    height: 196,
    maxShapes: 20,
    recipe: 'Frame vertical (padding 20, gap 16, cornerRadius 18, width 320): cabecalho horizontal (avatar circular 52x52 person:true + coluna com nome 16px, cargo/handle 13px e badge verificado); linha de 3 mini-metricas ou tags; linha de botoes de acao ("Seguir" / "Mensagem").',
    recommendedIcons: ['Verified', 'PersonAdd', 'Chat', 'MoreHoriz', 'Star'],
  },
  {
    id: 'list-item-row',
    name: 'Item de Lista, Linha de Transacao ou Notificacao',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(item de lista|linha de (lista|transacao|extrato|historico|notificacao)|list ?item|transaction ?row)\b/,
    width: 360,
    height: 76,
    maxShapes: 14,
    recipe: 'Frame horizontal (padding [14,16,14,16], gap 12, align left, cornerRadius 14, width 360): chip de icone ou avatar 44x44 + coluna central ("width":"fill", gap 2: titulo 15px + subtitulo/horario 12px) + coluna direita ("width":"hug": valor ou status + chevron 18px).',
    recommendedIcons: ['ChevronRight', 'Paid', 'Notifications', 'Check', 'Schedule'],
  },
  {
    id: 'toast-alert-banner',
    name: 'Toast, Snackbar, Alerta ou Banner de Aviso',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(toast|snackbar|alerta|alert|banner de (aviso|erro|sucesso|notificacao)|callout)\b/,
    width: 360,
    height: 76,
    maxShapes: 14,
    recipe: 'Frame horizontal (padding [14,16,14,16], gap 12, align left, cornerRadius 14, width 360): chip de icone semantico 36x36 + coluna de texto ("width":"fill", gap 2: titulo 14px + descricao 12px) + botao de acao ou icone Close 18px.',
    recommendedIcons: ['Check', 'Warning', 'Error', 'Info', 'Close'],
  },
  {
    id: 'stepper-breadcrumb',
    name: 'Stepper (Passos de Fluxo), Paginacao ou Breadcrumb',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(stepper|passos|etapas do fluxo|breadcrumb|migalhas|paginacao|pagination)\b/,
    width: 420,
    height: 64,
    maxShapes: 20,
    recipe: 'Frame horizontal (align center, gap 8, padding [12,16,12,16], cornerRadius 12): passos numerados em circulos 28x28 (concluido com Check, atual em destaque, pendente neutro) + rotulo "hug" + linha divisoria entre passos.',
    recommendedIcons: ['Check', 'ChevronRight', 'ChevronLeft', 'Home'],
  },
  {
    id: 'accordion-faq',
    name: 'Accordion / Lista Expansivel (FAQ)',
    category: 'molecular',
    complexity: 'simple',
    keywords: /\b(accordion|sanfona|faq|perguntas frequentes|item expansivel)\b/,
    width: 380,
    height: 240,
    maxShapes: 22,
    recipe: 'Frame vertical (gap 8, width 380): 3 cards empilhados (padding 16, cornerRadius 12); o primeiro aberto com cabecalho horizontal (pergunta "fill" + ExpandLess 20px) e texto de resposta abaixo; os demais fechados com ExpandMore 20px.',
    recommendedIcons: ['ExpandLess', 'ExpandMore', 'Help'],
  },

  // ---- ORGANISMOS / SECOES (Medium: estruturas ricas, tabelas, graficos, modais, barras completas)
  {
    id: 'navbar-bottom-tab',
    name: 'Navbar Inferior / Bottom Tab Bar (Mobile)',
    category: 'organism',
    complexity: 'simple',
    keywords: /\b(navbar|nav ?bar|tab ?bar|bottom ?(nav|bar|tabs)|barra (de )?(navegacao|abas|inferior)|menu inferior)\b/,
    width: 393,
    height: 84,
    maxShapes: 22,
    recipe: 'Frame horizontal (width 393, height 84, padding [10,12,28,12], gap 4, cornerRadius 24): 4 a 5 abas verticais ("width":"fill", "height":"hug", gap 4, align top-center), cada uma com icon 22-24px e texto 11px "hug"; a aba ativa usa a cor de destaque.',
    recommendedIcons: ['Home', 'Search', 'Analytics', 'Notifications', 'Person', 'ShoppingBag'],
  },
  {
    id: 'topbar-header',
    name: 'Header / Topbar de Aplicativo ou Sistema',
    category: 'organism',
    complexity: 'simple',
    keywords: /\b(header|cabecalho|topbar|top ?bar|app ?bar|barra superior)\b/,
    width: 1200,
    height: 68,
    maxShapes: 22,
    recipe: 'Frame horizontal (width 1200 ou 393 se pedir mobile, height 68, padding [14,24,14,24], gap 16, align left): bloco esquerdo com titulo/breadcrumb ("width":"fill"), campo de busca compacto (width 240), botoes de icone (notificacao com badge, ajustes) e avatar do usuario.',
    recommendedIcons: ['Search', 'Notifications', 'Settings', 'Help', 'Menu', 'ArrowBack'],
  },
  {
    id: 'sidebar-nav',
    name: 'Sidebar / Menu Lateral de Navegacao',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(sidebar|menu lateral|barra lateral|drawer|navegacao lateral)\b/,
    width: 264,
    height: 760,
    maxShapes: 36,
    recipe: 'Frame vertical (width 264, height 760, padding 16, gap 16, cornerRadius 16): topo com logo + nome do produto; campo de busca rapida; 2 grupos de navegacao com rotulo 11px uppercase e 4-5 itens horizontais (padding [10,12,10,12], gap 10, cornerRadius 10, icon 18px + texto "fill" + badge opcional); rodape com card do usuario.',
    recommendedIcons: ['Dashboard', 'Analytics', 'People', 'Folder', 'Task', 'Settings', 'Search', 'Logout'],
  },
  {
    id: 'modal-dialog',
    name: 'Modal, Dialogo de Confirmacao ou Bottom Sheet',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(modal|dialog|dialogo|popup|pop-?up|bottom ?sheet|painel deslizante|confirmacao)\b/,
    width: 400,
    height: 320,
    maxShapes: 26,
    recipe: 'Frame vertical (width 400, padding 24, gap 18, cornerRadius 20): cabecalho horizontal (chip de icone 44x44 + coluna de titulo 18px e subtitulo 13px + botao Close 20px); corpo com resumo/campos; rodape horizontal com botao secundario "Cancelar" ("fill") e botao primario/perigo ("fill").',
    recommendedIcons: ['Close', 'Warning', 'Check', 'Delete', 'Info', 'Shield'],
  },
  {
    id: 'chart-card',
    name: 'Card de Grafico / Visualizacao de Dados (ChartCard)',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(grafico|chart|card de grafico|grafico de (linhas?|barras?|area|pizza|rosca|donut)|visualizacao de dados)\b/,
    width: 480,
    height: 300,
    maxShapes: 28,
    recipe: 'Frame vertical (width 480, padding 20, gap 16, cornerRadius 18): cabecalho horizontal com coluna (titulo 16px + valor/subtitulo 24px, width "fill") e seletor de periodo ("7D | 30D | 1A", width "hug"); item {"type":"chart","kind":"area|bar|line|donut","width":"fill","height":170,"data":[...],"labels":[...],"grid":true} + legenda.',
    recommendedIcons: ['TrendingUp', 'BarChart', 'PieChart', 'ShowChart', 'CalendarMonth', 'MoreHoriz'],
  },
  {
    id: 'data-table',
    name: 'Tabela de Dados com Filtros (DataTable)',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(tabela|data ?table|grade de dados|lista tabular|tabela de (clientes|usuarios|pedidos|transacoes|produtos))\b/,
    width: 880,
    height: 420,
    maxShapes: 55,
    recipe: 'Frame vertical (width 880, padding 20, gap 14, cornerRadius 16): barra superior horizontal (titulo + contador "fill", campo de busca 220px, botao Filtrar e botao primario "+ Novo"); linha de cabecalho (padding [10,12,10,12], textos 11px uppercase); 4 linhas de dados horizontais (height 54, avatar+nome "fill", status chip "hug", valor/data "hug", icone MoreHoriz) separadas por linhas divisorias de 1px; rodape de paginacao.',
    recommendedIcons: ['Search', 'FilterList', 'Add', 'MoreHoriz', 'ChevronLeft', 'ChevronRight', 'Download'],
  },
  {
    id: 'pricing-card',
    name: 'Card de Plano / Precos (Pricing Card)',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(card de (plano|preco|assinatura)|pricing ?card|tabela de precos|plano pro)\b/,
    width: 320,
    height: 420,
    maxShapes: 30,
    recipe: 'Frame vertical (width 320, padding 24, gap 18, cornerRadius 20): topo com nome do plano + badge "Mais popular"; bloco de preco grande (36px + "/mes" 14px); descricao curta; linha divisoria 1px; lista vertical de 4-5 beneficios horizontais (icone Check 18px + texto 14px); botao CTA de largura total ("width":"fill", height 48) na base.',
    recommendedIcons: ['Check', 'Bolt', 'Star', 'Verified', 'ArrowForward'],
  },
  {
    id: 'kanban-column',
    name: 'Coluna ou Quadro Kanban / Tarefas',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(coluna kanban|card de tarefa|task ?card|quadro de tarefas|sprint card)\b/,
    width: 320,
    height: 460,
    maxShapes: 36,
    recipe: 'Frame vertical (width 320, padding 14, gap 12, cornerRadius 16): cabecalho da coluna (ponto de cor + titulo "Em andamento" + contador "3" + icone Add); 3 cards de tarefa (padding 14, gap 10, cornerRadius 12) com chip de prioridade, titulo da tarefa, prazo e pilha de avatares.',
    recommendedIcons: ['Add', 'MoreHoriz', 'CalendarMonth', 'Comment', 'Attachment', 'Flag'],
  },
  {
    id: 'calendar-schedule',
    name: 'Calendario, Agenda ou Grade de Horarios',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(calendario|agenda|seletor de data|date ?picker|grade de horarios|schedule)\b/,
    width: 360,
    height: 380,
    maxShapes: 42,
    recipe: 'Frame vertical (width 360, padding 20, gap 14, cornerRadius 18): cabecalho do mes com setas ChevronLeft/ChevronRight; tira dos 7 dias da semana; grade de dias ou lista de compromissos com horario a esquerda e card colorido do evento a direita.',
    recommendedIcons: ['CalendarMonth', 'ChevronLeft', 'ChevronRight', 'AccessTime', 'Add'],
  },
  {
    id: 'media-player-card',
    name: 'Player de Musica, Audio ou Video',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(player|tocador|mini ?player|reprodutor de (musica|audio|video|podcast))\b/,
    width: 360,
    height: 220,
    maxShapes: 26,
    recipe: 'Frame vertical (width 360, padding 20, gap 16, cornerRadius 20): linha com capa (image 64x64, cornerRadius 12) + coluna (titulo 16px, artista 13px, width "fill") + icone Favorite; barra de tempo com marcadores "01:42" e "03:20"; linha centralizada de controles de reproducao.',
    recommendedIcons: ['Favorite', 'Share', 'MoreHoriz', 'Mic', 'Videocam'],
  },
  {
    id: 'login-auth-card',
    name: 'Card / Formulario de Login ou Autenticacao',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(card de login|formulario de (login|cadastro|acesso)|bloco de autenticacao)\b/,
    width: 380,
    height: 440,
    maxShapes: 30,
    recipe: 'Frame vertical (width 380, padding 28, gap 16, cornerRadius 20): cabecalho com titulo 24px e subtitulo 13px; 2 campos de input (e-mail e senha com altura 48); botao primario "Continuar" (width "fill", height 48); divisor "ou continue com"; linha horizontal de 2 botoes sociais.',
    recommendedIcons: ['Mail', 'Lock', 'Visibility', 'ArrowForward', 'Shield'],
  },
  {
    id: 'empty-state-card',
    name: 'Estado Vazio (Empty State)',
    category: 'organism',
    complexity: 'simple',
    keywords: /\b(empty ?state|estado vazio|lista vazia|sem resultados)\b/,
    width: 360,
    height: 260,
    maxShapes: 14,
    recipe: 'Frame vertical centralizado (width 360, padding 32, gap 12, align top-center, cornerRadius 18): circulo 64x64 com icone 28px centralizado, titulo 17px, descricao curta 13px centralizada e botao CTA primario ("hug", height 44).',
    recommendedIcons: ['Search', 'Folder', 'Add', 'Inbox', 'Rocket'],
  },
  {
    id: 'hero-banner',
    name: 'Hero Section ou Banner de Destaque',
    category: 'organism',
    complexity: 'medium',
    keywords: /\b(hero ?section|secao hero|banner principal|banner promocional|card de destaque)\b/,
    width: 720,
    height: 320,
    maxShapes: 24,
    recipe: 'Frame horizontal (width 720, height 320, padding 32, gap 24, cornerRadius 24): coluna esquerda ("width":"fill", gap 14: badge superior, titulo forte 32px, subtitulo 15px e par de botoes CTA) + coluna direita com imagem/ilustracao ou preview visual.',
    recommendedIcons: ['Rocket', 'ArrowForward', 'Bolt', 'Star', 'Verified'],
  },
];

// ============================================================================
// 3. TAXONOMIA DE ICONES POR CATEGORIA SEMANTICA (MATERIAL ICONS)
// ============================================================================

export const ICON_CATEGORIES: IconCategorySpec[] = [
  {
    id: 'navigation',
    name: 'Navegacao e Direcao',
    description: 'Barras de navegacao, menus, breadcrumbs, retorno, paginacao e abertura de paineis.',
    icons: ['Home', 'Menu', 'Apps', 'GridView', 'ViewList', 'ArrowBack', 'ArrowForward', 'ArrowUpward', 'ArrowDownward', 'ChevronLeft', 'ChevronRight', 'ExpandMore', 'ExpandLess', 'MoreVert', 'MoreHoriz', 'Close', 'Login', 'Logout'],
    ptKeywords: ['inicio', 'menu', 'voltar', 'avancar', 'seta', 'chevron', 'abrir', 'fechar', 'grade', 'lista', 'entrar', 'sair'],
  },
  {
    id: 'actions-crud',
    name: 'Acoes, Edicao e CRUD',
    description: 'Criacao, edicao, exclusao, busca, filtragem, ordenacao, upload, download e compartilhamento.',
    icons: ['Add', 'Remove', 'Edit', 'Delete', 'Save', 'Search', 'FilterList', 'Sort', 'Tune', 'Refresh', 'Sync', 'Download', 'Upload', 'Share', 'Send', 'Attachment', 'Link', 'ContentCopy', 'Paste', 'Print'],
    ptKeywords: ['adicionar', 'novo', 'editar', 'excluir', 'salvar', 'buscar', 'filtrar', 'ordenar', 'ajustar', 'atualizar', 'baixar', 'enviar', 'compartilhar', 'copiar'],
  },
  {
    id: 'status-feedback',
    name: 'Status, Alertas e Confirmacao',
    description: 'Estados de validacao, sucesso, erro, alerta, ajuda, favoritos, verificacao e conquistas.',
    icons: ['Check', 'Info', 'Warning', 'Error', 'Help', 'Verified', 'Star', 'Favorite', 'ThumbUp', 'Bookmark', 'Flag', 'Bolt', 'Rocket', 'Lightbulb'],
    ptKeywords: ['confirmar', 'sucesso', 'aviso', 'alerta', 'erro', 'ajuda', 'verificado', 'estrela', 'favorito', 'curtir', 'salvar', 'destaque'],
  },
  {
    id: 'finance-commerce',
    name: 'Financas, Pagamentos e E-commerce',
    description: 'Bancos, carteiras, cartoes, vendas, descontos, recibos e lojas.',
    icons: ['AccountBalance', 'AccountBalanceWallet', 'CreditCard', 'Payment', 'AttachMoney', 'Paid', 'Receipt', 'ShoppingCart', 'ShoppingBag', 'Store', 'LocalOffer', 'TrendingUp', 'TrendingDown'],
    ptKeywords: ['banco', 'carteira', 'cartao', 'pagamento', 'dinheiro', 'saldo', 'recibo', 'fatura', 'carrinho', 'sacola', 'loja', 'desconto', 'oferta', 'lucro'],
  },
  {
    id: 'analytics-data',
    name: 'Dados, Metricas e Dashboards',
    description: 'KPIs, graficos de linhas/barras/pizza, relatorios e paineis gerenciais.',
    icons: ['Dashboard', 'Analytics', 'BarChart', 'PieChart', 'ShowChart', 'TrendingUp', 'TrendingDown', 'Layers', 'Assignment', 'Task', 'Description', 'Article'],
    ptKeywords: ['painel', 'dashboard', 'metricas', 'grafico', 'relatorio', 'indicadores', 'estatisticas', 'tabela'],
  },
  {
    id: 'communication-social',
    name: 'Comunicacao, Chat e Redes Sociais',
    description: 'Mensagens, e-mail, chamadas de voz/video, comentarios, comunidades e notificacoes.',
    icons: ['Notifications', 'Mail', 'Chat', 'Comment', 'Forum', 'Call', 'Videocam', 'Mic', 'People', 'Group', 'Person', 'PersonAdd', 'Support', 'Public', 'Language'],
    ptKeywords: ['notificacao', 'email', 'chat', 'mensagem', 'comentario', 'ligar', 'telefone', 'videochamada', 'usuarios', 'equipe', 'comunidade', 'suporte'],
  },
  {
    id: 'time-calendar',
    name: 'Tempo, Agenda e Eventos',
    description: 'Calendarios, agendamentos, prazos, cronometros e historico de atividades.',
    icons: ['CalendarMonth', 'Calendar', 'Event', 'Schedule', 'AccessTime', 'Timer', 'History', 'Update'],
    ptKeywords: ['calendario', 'data', 'agenda', 'evento', 'horario', 'relogio', 'prazo', 'historico', 'cronometro'],
  },
  {
    id: 'files-media',
    name: 'Arquivos, Fotos, Audio e Video',
    description: 'Pastas, documentos, galeria de fotos, camera e players de midia.',
    icons: ['Folder', 'InsertDriveFile', 'Image', 'Photo', 'Camera', 'Videocam', 'Mic', 'Palette', 'Brush'],
    ptKeywords: ['pasta', 'arquivo', 'documento', 'imagem', 'foto', 'camera', 'video', 'audio', 'design'],
  },
  {
    id: 'security-auth',
    name: 'Seguranca, Privacidade e Acesso',
    description: 'Autenticacao, senhas, permissoes, criptografia e protecao.',
    icons: ['Lock', 'LockOpen', 'Security', 'Shield', 'Verified', 'Visibility', 'VisibilityOff', 'Person'],
    ptKeywords: ['cadeado', 'senha', 'seguranca', 'escudo', 'privacidade', 'visivel', 'ocultar', 'acesso'],
  },
  {
    id: 'dev-system',
    name: 'Tecnologia, Codigo, Dispositivos e Infraestrutura',
    description: 'IDEs, terminais, nuvem, conectividade, bateria e hardware.',
    icons: ['Code', 'Terminal', 'BugReport', 'Build', 'Cloud', 'Phone', 'Smartphone', 'Laptop', 'Wifi', 'Battery', 'Power', 'Settings'],
    ptKeywords: ['codigo', 'terminal', 'bug', 'ferramenta', 'nuvem', 'celular', 'notebook', 'wifi', 'bateria', 'sistema'],
  },
  {
    id: 'location-agro-logistics',
    name: 'Mapas, Logistica, Viagem e Campo',
    description: 'Geolocalizacao, rotas, entregas, propriedades e operacoes.',
    icons: ['Place', 'Map', 'Public', 'Store', 'Work', 'School'],
    ptKeywords: ['mapa', 'localizacao', 'pino', 'endereco', 'rota', 'viagem', 'fazenda', 'filial'],
  },
];

// ============================================================================
// 4. CATALOGO DE DISPOSITIVOS E FORMATOS DE TELA
// ============================================================================

export const DEVICE_CATALOG: DeviceFormatSpec[] = [
  { id: 'iphone-16-pro', name: 'iPhone 16 Pro / 15 Pro', category: 'mobile', width: 393, height: 852, mobile: true, cornerRadius: 55, keywords: /\b(iphone( 1[56])?( pro)?(?! max)|ios|mobile|celular|smartphone|app)\b/ },
  { id: 'iphone-16-pro-max', name: 'iPhone 16 Pro Max / 15 Pro Max', category: 'mobile', width: 430, height: 932, mobile: true, cornerRadius: 55, keywords: /\b(iphone[ 0-9]*pro max|iphone plus|iphone max|430x932)\b/ },
  { id: 'iphone-se', name: 'iPhone SE / Compacto', category: 'mobile', width: 375, height: 667, mobile: true, cornerRadius: 0, keywords: /\b(iphone se|iphone mini|375x667|375x812)\b/ },
  { id: 'android-pixel', name: 'Android (Pixel / Galaxy)', category: 'mobile', width: 412, height: 915, mobile: true, cornerRadius: 40, keywords: /\b(android|pixel|galaxy|samsung|412x915)\b/ },
  { id: 'android-compact', name: 'Android Compacto', category: 'mobile', width: 360, height: 800, mobile: true, cornerRadius: 32, keywords: /\b(android compacto|360x800)\b/ },
  { id: 'ipad-pro-11', name: 'iPad Pro 11" / Tablet', category: 'tablet', width: 834, height: 1194, mobile: false, cornerRadius: 28, keywords: /\b(ipad( pro)?|tablet|834x1194)\b/ },
  { id: 'ipad-mini', name: 'iPad mini', category: 'tablet', width: 744, height: 1133, mobile: false, cornerRadius: 24, keywords: /\b(ipad mini|744x1133)\b/ },
  { id: 'ipad-landscape', name: 'Tablet / iPad Horizontal (PDV / Kiosk)', category: 'tablet', width: 1194, height: 834, mobile: false, cornerRadius: 28, keywords: /\b(ipad horizontal|tablet horizontal|pdv|kiosk|totem|1194x834)\b/ },
  { id: 'desktop-standard', name: 'Desktop / Web App (1440x900)', category: 'desktop', width: 1440, height: 900, mobile: false, cornerRadius: 12, keywords: /\b(desktop|web ?app|site|website|landing( page)?|dashboard|painel|admin|saas|crm|erp|plataforma|portal|sistema( web)?|1440x900|1440)\b/ },
  { id: 'desktop-fhd', name: 'Desktop Full HD (1920x1080)', category: 'desktop', width: 1920, height: 1080, mobile: false, cornerRadius: 12, keywords: /\b(full ?hd|1920x1080|1920|widescreen|monitor grande)\b/ },
  { id: 'macbook-pro-14', name: 'MacBook Pro 14"', category: 'desktop', width: 1512, height: 982, mobile: false, cornerRadius: 12, keywords: /\b(macbook pro|1512x982)\b/ },
  { id: 'macbook-air-13', name: 'MacBook Air 13" / Laptop', category: 'desktop', width: 1280, height: 832, mobile: false, cornerRadius: 12, keywords: /\b(macbook air|notebook|laptop|1280x832|1280x800|1366x768)\b/ },
  { id: 'apple-watch', name: 'Smartwatch / Apple Watch (45mm)', category: 'watch', width: 205, height: 251, mobile: true, cornerRadius: 48, keywords: /\b(apple watch|smartwatch|relogio inteligente|watchos|wearable)\b/ },
  { id: 'tv-slide-16-9', name: 'Smart TV / Slide 16:9 (1920x1080)', category: 'tv-slide', width: 1920, height: 1080, mobile: false, cornerRadius: 0, keywords: /\b(smart ?tv|apple tv|apresentacao|slide|pitch deck|16:9)\b/ },
  { id: 'social-post', name: 'Post Social Quadrado (1080x1080)', category: 'social', width: 1080, height: 1080, mobile: false, cornerRadius: 0, keywords: /\b(post de instagram|post quadrado|1080x1080|carrossel de instagram)\b/ },
  { id: 'social-story', name: 'Story / Reels (1080x1920)', category: 'social', width: 1080, height: 1920, mobile: true, cornerRadius: 0, keywords: /\b(story de instagram|reels|tiktok|1080x1920)\b/ },
];

// ============================================================================
// 5. DEFINICAO DE TAREFAS SIMPLES, MEDIAS E COMPLEXAS (ORCAMENTO DE VELOCIDADE)
// ============================================================================

export const TASK_COMPLEXITY_TIERS: Record<TaskComplexity, TaskComplexitySpec> = {
  simple: {
    tier: 'simple',
    label: 'Tarefa Simples (Fast-Track)',
    effort: 'low',
    timeoutMs: 120000,
    stallTimeoutMs: 75000,
    maxShapes: 28,
    useCompactPrompt: true,
    canReadProjectFiles: false,
    skipSeparateVisionPass: true,
    description: 'Componente atomico ou molecular isolado (botao, badge, chip, avatar, switch, input, dropdown, card de KPI/produto/usuario, item de lista, toast, navbar, topbar, empty state) ou edicao pontual rapida sem multiplas telas.',
  },
  medium: {
    tier: 'medium',
    label: 'Tarefa Media (Single-Pass Focado)',
    effort: 'low',
    timeoutMs: 240000,
    stallTimeoutMs: 135000,
    maxShapes: 80,
    useCompactPrompt: false,
    canReadProjectFiles: false,
    skipSeparateVisionPass: true,
    description: 'Componente organismo complexo (DataTable, ChartCard, Sidebar, Modal, Kanban, Calendario, Hero, PricingCard), tela unica sem replica 1:1 pesada, ou edicao estrutural de 1 tela selecionada.',
  },
  complex: {
    tier: 'complex',
    label: 'Tarefa Complexa (Multi-Pass / Alta Fidelidade)',
    effort: 'medium',
    timeoutMs: 480000,
    stallTimeoutMs: 210000,
    maxShapes: 350,
    useCompactPrompt: false,
    canReadProjectFiles: true,
    skipSeparateVisionPass: false,
    description: 'Replica 1:1 de imagem de referencia densa (com analise de inventario e recorte de fotos), fluxo multi-telas (jornadas completas de 2 a 12 telas), geracao completa a partir de PRD ou edicao em lote de multiplas telas.',
  },
};

// ============================================================================
// 6. MOTOR DE DETECCAO DETERMINISTICA E ROTEAMENTO RAPIDO
// ============================================================================

export function matchDomainContext(prompt: string, projectContext?: string): ProductDomainContext | null {
  const p = norm(`${prompt} ${(projectContext || '').slice(0, 600)}`);
  let best: ProductDomainContext | null = null;
  let bestScore = 0;
  for (const ctx of PRODUCT_CONTEXTS) {
    const m = p.match(new RegExp(ctx.keywords.source, 'g'));
    const score = m ? m.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = ctx;
    }
  }
  return best;
}

export function matchComponentSpec(prompt: string): ComponentRecipeSpec | null {
  const p = norm(prompt);
  // Prioriza match no inicio do pedido ("crie um card de produto...", "um botao...", "navbar...")
  const head = p.slice(0, 120);
  for (const spec of COMPONENT_CATALOG) {
    if (spec.keywords.test(head)) return spec;
  }
  for (const spec of COMPONENT_CATALOG) {
    if (spec.keywords.test(p)) return spec;
  }
  return null;
}

export function matchDeviceSpec(prompt: string, domain?: ProductDomainContext | null): DeviceFormatSpec {
  const p = norm(prompt);
  // Dimensao explicita "1280x800", "393x852"
  const dimMatch = /\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/.exec(p);
  if (dimMatch) {
    const w = Number(dimMatch[1]), h = Number(dimMatch[2]);
    if (w >= 200 && w <= 3840 && h >= 200 && h <= 3840) {
      const mobile = w <= 500 && h >= 600;
      return { id: 'custom', name: `${w}x${h}`, category: mobile ? 'mobile' : 'desktop', width: w, height: h, mobile, cornerRadius: mobile ? 48 : 12, keywords: /^$/ };
    }
  }
  // Prioriza dispositivos especificos antes dos genericos
  const priorityOrder = [
    'iphone-16-pro-max', 'iphone-se', 'android-compact', 'android-pixel',
    'ipad-landscape', 'ipad-mini', 'ipad-pro-11',
    'desktop-fhd', 'macbook-pro-14', 'macbook-air-13',
    'apple-watch', 'tv-slide-16-9', 'social-post', 'social-story',
    'desktop-standard', 'iphone-16-pro',
  ];
  for (const id of priorityOrder) {
    const spec = DEVICE_CATALOG.find((d) => d.id === id);
    if (spec && spec.keywords.test(p)) return spec;
  }
  if (domain?.defaultDevice === 'desktop') {
    return DEVICE_CATALOG.find((d) => d.id === 'desktop-standard')!;
  }
  return DEVICE_CATALOG[0]; // iPhone 393x852
}

export interface DesignTaskClassification {
  kind: 'component' | 'screen' | 'flow';
  complexity: TaskComplexity;
  complexitySpec: TaskComplexitySpec;
  domain: ProductDomainContext | null;
  componentSpec: ComponentRecipeSpec | null;
  deviceSpec: DeviceFormatSpec;
  recommendedIcons: string[];
}

export function classifyDesignTask(opts: {
  prompt: string;
  isComponent: boolean;
  isMultiScreen: boolean;
  hasPrd: boolean;
  hasReferences: boolean;
  isReplica: boolean;
  isEdit: boolean;
  selectedCount: number;
  fastMode: boolean;
  projectContext?: string;
}): DesignTaskClassification {
  const domain = matchDomainContext(opts.prompt, opts.projectContext);
  const componentSpec = opts.isComponent ? (matchComponentSpec(opts.prompt) || {
    id: 'custom-component',
    name: 'Componente Customizado',
    category: 'molecular',
    complexity: 'simple',
    keywords: /^$/,
    width: 343,
    height: 200,
    maxShapes: 24,
    recipe: 'Frame com auto layout ("horizontal" ou "vertical"), padding uniforme, gap consistente, cantos arredondados e hierarquia clara.',
    recommendedIcons: ['Star', 'Check', 'ArrowForward', 'MoreHoriz'],
  }) : matchComponentSpec(opts.prompt);
  const deviceSpec = matchDeviceSpec(opts.prompt, domain);

  const kind: 'component' | 'screen' | 'flow' = opts.isComponent ? 'component' : opts.isMultiScreen || opts.hasPrd ? 'flow' : 'screen';

  let complexity: TaskComplexity = 'medium';
  if (opts.hasPrd || opts.isMultiScreen || (opts.hasReferences && opts.isReplica && !opts.isComponent) || (opts.isEdit && opts.selectedCount > 1)) {
    complexity = 'complex';
  } else if (opts.isComponent) {
    complexity = componentSpec?.complexity === 'medium' && !opts.fastMode ? 'medium' : 'simple';
  } else if (opts.isEdit && opts.selectedCount === 1 && !opts.hasReferences) {
    complexity = 'simple';
  }

  const baseTier = TASK_COMPLEXITY_TIERS[complexity];
  const complexitySpec: TaskComplexitySpec = opts.fastMode
    ? { ...baseTier, effort: 'low', skipSeparateVisionPass: true, canReadProjectFiles: false }
    : baseTier;

  const recommendedIcons = [
    ...new Set([
      ...(componentSpec?.recommendedIcons || []),
      ...(domain?.recommendedIcons || []),
      ...COMMON_ICON_NAMES.slice(0, 32),
    ]),
  ];

  return {
    kind,
    complexity,
    complexitySpec,
    domain,
    componentSpec,
    deviceSpec,
    recommendedIcons,
  };
}

/**
 * Bloco compacto de enriquecimento de contexto e componentes para injetar no prompt de tela/componente.
 */
export function buildDomainAndComponentHint(prompt: string, projectContext?: string): string {
  const domain = matchDomainContext(prompt, projectContext);
  const comp = matchComponentSpec(prompt);
  const lines: string[] = [];
  if (domain) {
    lines.push(
      `CONTEXTO DE PRODUTO DETECTADO (${domain.name}):`,
      `- Paleta e superficie recomendadas: ${domain.paletteHint}`,
      `- Tipografia e hierarquia: ${domain.typographyHint}`,
      `- Modulos tipicos deste dominio (use os que couberem no pedido): ${domain.keyModules.join('; ')}.`,
      `- Metricas/dados reais sugeridos: ${domain.typicalMetrics.join(', ')}.`,
      `- Icones recomendados para este contexto: ${domain.recommendedIcons.join(', ')}.`
    );
  }
  if (comp) {
    lines.push(
      `RECEITA DO COMPONENTE FOCO (${comp.name} — padrao ${comp.width}x${comp.height}px):`,
      `- Estrutura de Auto Layout: ${comp.recipe}`,
      `- Icones sugeridos: ${comp.recommendedIcons.join(', ')}.`
    );
  }
  return lines.length ? `\n${lines.join('\n')}\n` : '';
}

/**
 * Prompt enxuto de alta velocidade ("Fast-Track") exclusivo para geracao de COMPONENTES isolados (Simple/Medium).
 * Reduz o prompt de ~60KB para ~4KB, evitando regras de multiplas telas, barras de status e shells completos,
 * diminuindo drasticamente a latencia da LLM para criar botoes, cards, inputs, navbars, modais e widgets.
 */
export function buildCompactComponentPrompt(opts: {
  prompt: string;
  spec: ComponentRecipeSpec;
  domain: ProductDomainContext | null;
  tokens?: DesignTokens | null;
  isDark: boolean;
  accentColor: string;
  referenceImages?: string[];
  referenceSpec?: string;
}): string {
  const { spec, domain, tokens } = opts;
  const iconsList = [...new Set([...spec.recommendedIcons, ...(domain?.recommendedIcons || []), ...COMMON_ICON_NAMES.slice(0, 45)])].join(', ');
  const tokenLine = tokens ? `\n${tokensPromptBlock(tokens)}\n` : '';
  const refLine = opts.referenceSpec
    ? `\nESPECIFICACAO DA IMAGEM DE REFERENCIA:\n${opts.referenceSpec}\n`
    : opts.referenceImages?.length
      ? `\nIMAGENS DE REFERENCIA ANEXADAS (abra uma unica vez e recrie somente o componente pedido com fidelidade total):\n${opts.referenceImages.map((p) => `- ${p}`).join('\n')}\n`
      : '';

  return `Voce e um designer de sistemas de interface senior. Gere SOMENTE o componente isolado pedido e responda UNICAMENTE com JSON valido minificado (sem markdown, sem explicacoes).
NUNCA leia, edite ou busque arquivos no disco; responda direto com o JSON.

PEDIDO: ${opts.prompt}
COMPONENTE DETECTADO: ${spec.name} (tamanho base sugerido: ${spec.width}x${spec.height}px, maximo de ${spec.maxShapes} elementos).
RECEITA DE CONSTRUCAO: ${spec.recipe}
${domain ? `DOMINIO (${domain.name}): ${domain.paletteHint} Dados realistas: ${domain.typicalMetrics.slice(0, 3).join(', ')}.\n` : ''}${tokenLine}${refLine}
REGRAS DE AUTO LAYOUT E QUALIDADE:
1. Gere UM frame raiz com as dimensoes exatas do componente ("width":${spec.width},"height":${spec.height} ou ajustadas se o pedido pedir variantes lado a lado). NAO crie tela inteira, barra de status, Dynamic Island nem indicador home.
2. O primeiro item de "shapes" e o frame raiz do componente (com "id":"raiz", "layout":"horizontal" ou "vertical", "padding", "gap", "cornerRadius", "fill"). Todos os elementos internos declaram "parent":"raiz" (ou o id do sub-frame pai).
3. Filhos dentro de um frame com "layout" NAO levam x/y. Use "width":"fill" para expandir na linha, "width":"hug" para rotulos curtos, precos, badges e botoes (nunca quebre linha em textos curtos).
4. Tipos permitidos: frame, rect, ellipse, text, line, icon, image, chart. Cores em hexadecimal (#RRGGBB ou #RRGGBBAA). Fonte padrao: "Poppins". Contraste legivel (>= 4.5:1).
5. Icones: use SEMPRE {"type":"icon","parent":"...","name":"<MaterialIcon>","size":20,"fill":"#RRGGBB"}. Icones disponiveis: ${iconsList}.
6. Fotos/Avatares: use {"type":"image","parent":"...","query":"<descricao especifica em ingles>","person":true,"width":48,"height":48,"cornerRadius":999}.

FORMATO DE RESPOSTA (JSON minificado):
{"name":"${spec.name.slice(0, 28)}","width":${spec.width},"height":${spec.height},"background":"transparent","shapes":[
  {"type":"frame","id":"raiz","name":"${spec.name.slice(0, 24)}","layout":"vertical","gap":12,"padding":16,"x":0,"y":0,"width":${spec.width},"height":${spec.height},"fill":"#RRGGBB","cornerRadius":16}
]}`;
}
