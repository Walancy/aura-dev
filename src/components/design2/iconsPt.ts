/** Dicionário pt-BR -> palavras (em inglês) presentes nos nomes dos Material Icons. Contextos listam vários termos relacionados. */
export const PT_ICON_TERMS: Record<string, string> = {
  // contextos
  viagem: 'luggage flight airplane car ticket hotel map beach suitcase travel explore tour passport',
  viajar: 'luggage flight airplane car ticket hotel map beach travel explore',
  transporte: 'car bus train subway flight directions bike taxi local shipping truck',
  compras: 'cart shopping bag store payment receipt sell local offer',
  loja: 'store shop storefront cart bag sell',
  dinheiro: 'money attach payments wallet savings bank paid currency coin price',
  financeiro: 'money bank wallet savings payments account balance receipt trending',
  pagamento: 'payment payments credit card wallet paid receipt',
  saude: 'health medical hospital medication heart favorite vaccines monitor',
  medico: 'medical hospital health medication stethoscope vaccines',
  comida: 'restaurant fastfood lunch dinner pizza cake coffee bakery kitchen food',
  restaurante: 'restaurant fastfood dining lunch dinner menu food',
  bebida: 'coffee local bar wine cocktail drink',
  educacao: 'school book library science menu_book class education cast',
  escola: 'school class book library backpack',
  trabalho: 'work business briefcase badge assignment task corporate',
  empresa: 'business corporate work apartment domain badge',
  comunicacao: 'chat mail message call forum comment phone sms email',
  mensagem: 'chat message mail sms forum comment send',
  rede: 'wifi network lan hub router share public language cloud',
  social: 'share people group forum thumb favorite public person',
  seguranca: 'security lock shield verified key password fingerprint privacy admin',
  tecnologia: 'computer laptop phone smartphone devices code terminal memory developer',
  desenvolvimento: 'code terminal bug build developer data_object api integration',
  grafico: 'chart bar pie show analytics trending insights leaderboard',
  dados: 'analytics chart table database storage data insights',
  midia: 'play pause stop video music audio movie camera photo image library',
  musica: 'music audio headphones album library queue play',
  video: 'video videocam movie play camera theaters',
  foto: 'photo camera image picture collections add_a_photo',
  tempo: 'time schedule access alarm timer history hourglass update',
  clima: 'wb sunny cloud rainy snow thunderstorm air thermostat weather',
  mapa: 'map place location pin navigation explore directions near_me',
  localizacao: 'location place pin map my_location gps near_me',
  casa: 'home house cottage apartment bed kitchen',
  esporte: 'sports soccer basketball fitness gym run hiking tennis golf',
  jogo: 'games sports esports gamepad casino extension',
  festa: 'celebration cake party emoji_events confetti',
  natureza: 'park forest eco nature grass spa pets flower',
  animal: 'pets cruelty_free',
  ferramenta: 'build construction handyman hardware tool settings',
  configuracao: 'settings tune build manage_accounts display_settings',
  notificacao: 'notifications notification bell alert campaign',
  arquivo: 'file folder document drive description article attach',
  documento: 'description article file note text_snippet assignment',
  // palavras soltas
  casas: 'home house', inicio: 'home', pagina: 'page article description', busca: 'search', buscar: 'search', pesquisa: 'search', pesquisar: 'search',
  configuracoes: 'settings', ajustes: 'settings tune', usuario: 'person account', usuarios: 'people group', pessoa: 'person', pessoas: 'people group', perfil: 'person account profile', conta: 'account',
  adicionar: 'add plus', novo: 'add new', criar: 'add create', remover: 'remove delete', excluir: 'delete', apagar: 'delete', lixeira: 'delete', editar: 'edit', salvar: 'save', fechar: 'close', cancelar: 'cancel close',
  confirmar: 'check done', confirmado: 'check done', ok: 'check done', certo: 'check', erro: 'error', aviso: 'warning', alerta: 'warning notifications', informacao: 'info', ajuda: 'help support',
  voltar: 'back arrow', avancar: 'forward arrow next', proximo: 'next forward', anterior: 'previous back', seta: 'arrow', cima: 'up', baixo: 'down', esquerda: 'left', direita: 'right',
  menu: 'menu', mais: 'add more', menos: 'remove', opcoes: 'more settings', filtro: 'filter', filtrar: 'filter', ordenar: 'sort', lista: 'list', grade: 'grid apps', tabela: 'table',
  email: 'mail', correio: 'mail', carta: 'mail', telefone: 'phone call', celular: 'smartphone phone', ligar: 'call phone', chamada: 'call', camera: 'camera', mensagens: 'chat message',
  coracao: 'favorite heart', favorito: 'favorite star bookmark', favoritos: 'favorite star', curtir: 'thumb favorite', estrela: 'star', salvo: 'bookmark', marcador: 'bookmark', bandeira: 'flag',
  calendario: 'calendar event today', evento: 'event', data: 'calendar date event', hora: 'time schedule access', relogio: 'access schedule alarm watch', alarme: 'alarm',
  mala: 'luggage work suitcase', aviao: 'flight airplane', voo: 'flight airplane', carro: 'car directions', onibus: 'bus', trem: 'train', metro: 'subway', bicicleta: 'bike pedal', moto: 'two_wheeler motorcycle', barco: 'sailing boat directions_boat', navio: 'directions_boat ship',
  passagem: 'ticket confirmation_number airplane', ingresso: 'ticket confirmation_number', hotel: 'hotel bed', cama: 'bed', praia: 'beach umbrella', montanha: 'terrain landscape', cidade: 'location_city apartment', predio: 'apartment domain business', mundo: 'public language globe', globo: 'public language',
  cadeado: 'lock', senha: 'password key lock', chave: 'key', olho: 'visibility', ver: 'visibility', ocultar: 'visibility_off', visivel: 'visibility',
  nuvem: 'cloud', baixar: 'download', download: 'download', enviar: 'send upload', subir: 'upload', compartilhar: 'share', link: 'link', copiar: 'content_copy', colar: 'content_paste', imprimir: 'print', anexo: 'attach attachment', anexar: 'attach',
  pasta: 'folder', imagem: 'image photo', imagens: 'image photo collections', texto: 'text title notes', titulo: 'title', fonte: 'font text_fields', negrito: 'format_bold', italico: 'format_italic', alinhar: 'format_align',
  sol: 'sunny light_mode', lua: 'dark_mode bedtime nights', escuro: 'dark_mode', claro: 'light_mode', luz: 'light lightbulb', lampada: 'lightbulb', raio: 'bolt flash', energia: 'bolt power battery electric', bateria: 'battery',
  carrinho: 'shopping_cart cart', sacola: 'shopping_bag', cartao: 'credit_card payment', carteira: 'wallet account_balance_wallet', banco: 'account_balance bank', moeda: 'paid monetization_on currency', preco: 'sell price attach_money', desconto: 'percent discount local_offer sell', oferta: 'local_offer sell', recibo: 'receipt', nota: 'receipt note description',
  coracoes: 'favorite', amor: 'favorite heart', feliz: 'sentiment_satisfied mood emoji', triste: 'sentiment_dissatisfied sad', sorriso: 'mood sentiment_satisfied', emoji: 'emoji mood sentiment',
  presente: 'card_giftcard redeem', premio: 'emoji_events military_tech workspace_premium', trofeu: 'emoji_events', medalha: 'military_tech workspace_premium', verificado: 'verified', escudo: 'shield security',
  foguete: 'rocket_launch rocket', idea: 'lightbulb', ideia: 'lightbulb', dica: 'lightbulb tips', ferramentas: 'build construction', engrenagem: 'settings', martelo: 'gavel hardware construction', pincel: 'brush format_paint', paleta: 'palette', cor: 'palette color', tinta: 'format_color_fill palette',
  camadas: 'layers', componente: 'widgets extension', quadrado: 'square crop', circulo: 'circle', triangulo: 'change_history', linha: 'horizontal_rule remove', ponto: 'circle fiber_manual_record', 
  sair: 'logout exit', entrar: 'login', sincronizar: 'sync', atualizar: 'refresh update', recarregar: 'refresh replay', repetir: 'repeat replay', desfazer: 'undo', refazer: 'redo', historico: 'history',
  jogar: 'play_arrow play', tocar: 'play_arrow', pausar: 'pause', parar: 'stop', gravar: 'mic fiber_manual_record', microfone: 'mic', volume: 'volume', som: 'volume audio', mudo: 'volume_off mic_off', fone: 'headphones headset', 
  computador: 'computer laptop desktop', notebook: 'laptop', tela: 'desktop monitor tv', monitor: 'monitor desktop', teclado: 'keyboard', mouse: 'mouse', impressora: 'print', relatorio: 'assessment summarize bar_chart description', painel: 'dashboard', metricas: 'analytics insights trending',
  tarefa: 'task assignment check_circle', tarefas: 'task assignment checklist', checklist: 'checklist', projeto: 'folder assignment work', equipe: 'group groups people', time: 'group groups', cliente: 'person support_agent', suporte: 'support_agent help headset', atendimento: 'support_agent headset',
  idioma: 'language translate', traduzir: 'translate', livro: 'book menu_book', biblioteca: 'library_books local_library', caderno: 'book notebook note', estudo: 'school menu_book', formatura: 'school', ciencia: 'science biotech', quimica: 'science biotech',
  hospital: 'local_hospital', remedio: 'medication', vacina: 'vaccines', medicamento: 'medication', ambulancia: 'emergency', emergencia: 'emergency warning sos', fogo: 'local_fire_department whatshot', bomba: 'whatshot', agua: 'water_drop water', gota: 'water_drop', folha: 'eco spa', arvore: 'park forest', flor: 'local_florist', cachorro: 'pets', gato: 'pets', patinha: 'pets',
  cafe: 'coffee local_cafe', pizza: 'local_pizza', bolo: 'cake', sorvete: 'icecream', vinho: 'wine_bar', bar: 'local_bar sports_bar', cerveja: 'sports_bar', fruta: 'nutrition', supermercado: 'local_grocery_store shopping_cart', farmacia: 'local_pharmacy', posto: 'local_gas_station', gasolina: 'local_gas_station', estacionamento: 'local_parking', 
  futebol: 'sports_soccer', basquete: 'sports_basketball', academia: 'fitness_center', musculacao: 'fitness_center', corrida: 'directions_run', natacao: 'pool', ioga: 'self_improvement spa', 
};

/** minúsculas sem acento */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Termos em inglês equivalentes a uma palavra digitada (inclui prefixos: "viag" -> viagem). Vazio se não há tradução. */
export function translateTerm(term: string): string[] {
  const t = normalize(term);
  if (t.length < 2) return [];
  const out = new Set<string>();
  for (const [k, v] of Object.entries(PT_ICON_TERMS)) {
    if (k === t || (t.length >= 3 && k.startsWith(t))) v.split(' ').forEach((w) => out.add(w));
  }
  return [...out];
}
