import { requestAiScreenRaw, extractJson, guessScreenFormat } from '../design2/aiScreenFromLlm';
import { wantsNewScreens } from '../design2/screenFlow';
import { looksMultiScreen } from '../design2/appPlan';
import { matchComponentSpec, matchDeviceSpec, matchDomainContext } from './figcraftCatalog';

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const COMPONENT_WORDS = /\b(componentes?|component|bot(ao|oes)|button|card|cards|chip|chips|badge|tag|tags|input|inputs|campo|campos|navbar|nav bar|tab bar|tabbar|barra (de )?(navegacao|abas|busca|pesquisa|progresso|superior|inferior|lateral)|header|cabecalho|topbar|sidebar|menu lateral|rodape|footer|modal|dialog|dialogo|popup|pop-up|bottom ?sheet|toast|snackbar|alerta|dropdown|select|combobox|menu|avatar|pilha de avatares|toggle|switch|checkbox|radio|slider|tooltip|popover|banner|widget|accordion|sanfona|faq|stepper|breadcrumb|paginacao|seletor|picker|item de lista|linha de (lista|transacao|extrato)|lista de itens|tabela|data ?table|grafico|chart|calendario|player|tocador|timeline|stories|carrossel|carousel|empty ?state|estado vazio|hero ?section|pricing ?card|coluna kanban)\b/;
const SCREEN_WORDS = /\b(tela|telas|pagina|paginas|screen|screens|app completo|aplicativo completo|fluxo|jornada|onboarding|dashboard completo|landing( page)?|home do app|tela inicial)\b/;

/**
 * O pedido é um COMPONENTE (botão, card, navbar, modal...) e não uma tela?
 * Resolve deterministicamente em 0ms inclusive quando cita "da tela/imagem" ("crie o card de saldo da tela") ou
 * quando pede uma tela contendo componentes ("crie uma tela de login com input e botão").
 */
export function componentByRules(prompt: string): boolean | null {
  const p = norm(prompt).trim();
  const comp = COMPONENT_WORDS.test(p) || !!matchComponentSpec(p);
  const scr = SCREEN_WORDS.test(p);
  if (/\b(apenas|somente|so)\s+(o|um|uma)\s+/.test(p) && comp) return true;
  if (/\bcomponentes?\b|\bcomponent\b/.test(p) && !/\b(telas?|pagina|screen)\b/.test(p)) return true;
  // "crie uma tela/pagina de X com card/botao/tabela" -> e claramente uma TELA
  if (/^(cri(e|ar)|ger(e|ar)|faca|fazer|mont(e|ar)|desenh(e|ar)|quero|preciso)?\s*(uma?|a|as|os|\d+)?\s*(novas?\s+)?(telas?|paginas?|screens?|landing|dashboard completo|fluxo|app)\b/.test(p)) {
    return false;
  }
  // "crie um card/botao/navbar/modal ... (da tela / para a tela / da imagem)" -> e claramente um COMPONENTE
  if (/^(cri(e|ar)|ger(e|ar)|faca|fazer|mont(e|ar)|desenh(e|ar)|recri(e|ar)|copi(e|ar)|quero|preciso)?\s*(so\s+|somente\s+|apenas\s+)?(um|uma|o|a|os|as|esse|este|essa|esta)?\s*(componente|bot(ao|oes)|button|card|chip|badge|tag|input|campo|navbar|tab ?bar|header|cabecalho|topbar|sidebar|modal|dialog|popup|bottom ?sheet|toast|alerta|dropdown|select|avatar|toggle|switch|slider|tooltip|banner|widget|accordion|stepper|breadcrumb|paginacao|item de lista|linha de|tabela|data ?table|grafico|chart|calendario|player|empty ?state|pricing ?card|coluna kanban)\b/.test(p)) {
    return true;
  }
  if (comp && !scr) return true;
  if (scr && !comp) return false;
  if (!comp && !scr) return false;
  return null;
}

/** Componente único ou tela? Regras instantâneas primeiro; só chama a IA se for genuinamente ambíguo. */
export async function requestKind(prompt: string, hasReference: boolean, o: { provider: string; model?: string; onProgress?: (m: string) => void }): Promise<'component' | 'screen'> {
  const r = componentByRules(prompt);
  if (r !== null) return r ? 'component' : 'screen';
  o.onProgress?.('Entendendo o pedido: um componente ou uma tela…');
  const j = await askJson(
    `Um designer pediu algo à IA de design${hasReference ? ' (com imagem de referência anexada)' : ''}. Decida se o resultado é UM COMPONENTE de interface isolado (botão, card, barra de navegação, modal, campo, item de lista, widget) ou uma TELA inteira. Responda SOMENTE JSON: {"kind":"component"|"screen","reason":"<frase curta>"}.
Regra: se o pedido cita um elemento específico ("o card de saldo da imagem", "um botão com ícone") é "component"; se pede uma tela, página, fluxo ou app, é "screen".

PEDIDO: ${prompt}`,
    o
  );
  return j?.kind === 'component' ? 'component' : 'screen';
}

/** Pedido que pede uma nova versao/variacao/adaptacao de uma tela existente sem destruir a original. */
export function looksLikeVariation(p: string): boolean {
  return /\b(varia(cao|coes)|outra versao|nova versao|versao (dark|light|escura|clara|mobile|desktop|tablet|web|compacta|alternativa)|adapt(e|ar) para (mobile|desktop|tablet|web)|duplic(ar|que)|copi(a|e|ar) (dessa|desta|da) tela)\b/.test(p);
}

/** Pedido que mexe no que já existe nas telas selecionadas (não cria telas). */
function looksLikeEdit(p: string): boolean {
  if (looksLikeVariation(p)) return false;
  return /\b(alter(e|ar)|mud(e|ar)|troc(ar|ue|a)|ajust(e|ar)|corrij(a|ir)|mov(a|er)|remov(a|er)|apag(ue|ar)|delet(e|ar)|aument(e|ar)|diminu(a|ir)|deix(e|ar)|renome(ie|ar)|centraliz(e|ar)|alinh(e|ar)|arredond(e|ar)|reduz(a|ir)|ampli(e|ar)|melhor(e|ar)|refin(e|ar)|substitu(a|ir)|inclu(a|ir)|esconda|mostre|oculte|pint(e|ar)|colori(r|a)|atualiz(e|ar)|converta|transforme|apli(que|car))\b/.test(p)
    || /\b(adicion(e|ar)|coloc(ar|ue)|inser(ir|a))\s+(um|uma|o|a|os|as|mais|esse|este|essa|esta)\s+(?!tela|telas|pagina|paginas)/.test(p)
    || /\b(mais|menos|maior|menor)\s+(escur|clar|espac|arredond|vibrante|suave|contrast|compact|grande|pequen)/.test(p)
    || /\b(na|nesta|nessa|da|desta|dessa)\s+(tela|selecao|camada)\b/.test(p);
}

/** Pedido com a imagem/tela de referência pedindo cópia fiel (inclusive com ajustes pontuais). */
function looksLikeReplicate(p: string): boolean {
  return /\b(exatamente|identic[oa]s?|fiel(mente)?|replic(a|ar|que|e)|copi(e|ar|a)|clon(e|ar)|reproduz(a|ir)|recri(e|ar)|pixel|1:1|igualzinh[oa]|mesm[oa]s? (tela|design|layout|visual)|como (esta|na|a) (imagem|referencia|tela)|essa (tela|imagem)|esta (tela|imagem)|fa[cç]a igual|transform(e|ar) em tela|converta em tela| a partir d(a|essa|esta) imagem)\b/.test(p);
}

/** Pedido que usa a referência só como inspiração de design (outro assunto/tela). */
function looksLikeStyle(p: string): boolean {
  return /\b(no estilo|no mesmo estilo|estilo d(a|e|o)|com base (n(a|o)|no design|na referencia)|basead[oa]|inspirad[oa]|inspira(cao|r)|seguindo (o|a) (design|estilo|padrao|identidade|visual|linguagem)|mesm[oa] (padrao|identidade|linguagem|estilo|paleta)|mesma cara|parecid[oa]|similar|referencia de (design|estilo|visual)|use (a|o) (referencia|imagem|design) como (base|referencia|estilo|inspiracao)|mesma vibe|no padrao|para um app de|para o meu|outra tela)\b/.test(p);
}

async function askJson(prompt: string, o: { provider: string; model?: string }): Promise<any | null> {
  try {
    const raw = await requestAiScreenRaw(prompt, o.provider, o.model, '/tmp', 22000, undefined, undefined, 0, { effort: 'low' });
    return extractJson(raw);
  } catch {
    return null;
  }
}

/**
 * Com telas selecionadas (e opcionalmente imagens do canvas selecionadas junto): o pedido é criar OUTRAS telas tendo a
 * seleção como referência ("new"), ou mexer nas telas selecionadas ("edit")? Regras primeiro; na dúvida, consulta rápida à IA.
 */
export async function selectionIntent(
  prompt: string,
  screens: string[],
  o: { provider: string; model?: string; onProgress?: (m: string) => void; hasCanvasImages?: boolean }
): Promise<'new' | 'edit'> {
  const p = norm(prompt);
  if (looksLikeVariation(p)) return 'new';
  const isCompCreate = componentByRules(prompt) === true && /\b(cri(e|ar)|ger(e|ar)|faca|fazer|mont(e|ar)|desenh(e|ar)|novo|nova)\b/.test(p) && !/\b(na|nesta|nessa)\s+tela\b/.test(p);
  const create = wantsNewScreens(prompt) || (looksMultiScreen(prompt) && !looksLikeEdit(p)) || isCompCreate || (o.hasCanvasImages && /\b(cri(e|ar)|ger(e|ar)|faca|mont(e|ar)|recri(e|ar)|transform(e|ar)|converta)\s+(a|uma|essa|esta|nova|as)?\s*(tela|pagina|screen|imagem)\b/.test(p) && !/\b(na|nesta|nessa)\s+tela\b/.test(p));
  const edit = looksLikeEdit(p) && !isCompCreate;
  if (create && !edit) return 'new';
  if (edit && !create) return 'edit';
  // Se o pedido começa com "crie a tela de X" e X não bate com os nomes das telas selecionadas, é nova tela
  const newNamedScreen = /\b(cri(e|ar)|ger(e|ar)|faca|mont(e|ar))\s+(a|uma|as|os)?\s*telas?\s+de\s+([a-z0-9\s]+)/.exec(p);
  if (newNamedScreen) {
    const targetName = newNamedScreen[3].trim();
    const matchesExisting = screens.some((s) => norm(s).includes(targetName) || targetName.includes(norm(s)));
    if (!matchesExisting) return 'new';
  }
  o.onProgress?.('Entendendo o pedido: criar novas telas a partir da seleção ou alterar a tela selecionada…');
  const contextDesc = o.hasCanvasImages
    ? `Um designer selecionou ${screens.length} tela(s) pronta(s) (${screens.slice(0, 6).join(', ') || 'sem nome'}) JUNTO com imagem(ns) de referência no canvas`
    : `Um designer selecionou ${screens.length} tela(s) no canvas (${screens.slice(0, 6).join(', ') || 'sem nome'})`;
  const j = await askJson(
    `${contextDesc} e enviou o pedido abaixo. Decida a intenção. Responda SOMENTE JSON: {"intent":"new"|"edit","reason":"<frase curta>"}.
- "new": o pedido é CRIAR outra(s) tela(s)/página(s)/variação/componente isolado (ex: criar uma tela nova inspirada na seleção, recriar a imagem selecionada seguindo o estilo da tela selecionada, criar uma variação dark/mobile ou novas telas do fluxo); a tela existente NÃO deve ser sobrescrita.
- "edit": o pedido é ALTERAR algo dentro da(s) tela(s) pronta(s) selecionada(s) (mudar cores, textos, layout, adicionar/remover elementos nela, ou aplicar o estilo/componente da imagem selecionada dentro da tela selecionada).
Na dúvida entre "criar uma tela" e "mudar a tela": se o pedido pede para criar/gerar uma tela ou variação nova, é "new"; se pede para alterar/adicionar algo na tela selecionada, é "edit".

PEDIDO: ${prompt}`,
    o
  );
  if (j?.intent === 'new' || j?.intent === 'edit') return j.intent;
  return create ? 'new' : 'edit';
}

/**
 * Com imagem de referência (anexada ou selecionada no canvas): o usuário quer a MESMA tela da imagem ("replicate": cópia fiel
 * ou recriação com as modificações pedidas) ou uma tela nova com o design da referência ("style": mesma identidade visual, assunto próprio)?
 */
export async function referenceIntent(prompt: string, o: { provider: string; model?: string; onProgress?: (m: string) => void; /** pedido de componente: replica o trecho da imagem, salvo se pedir só o estilo */ component?: boolean }): Promise<'replicate' | 'style'> {
  const p = norm(prompt).trim();
  if (o.component) return looksLikeStyle(p) && !looksLikeReplicate(p) ? 'style' : 'replicate';
  if (p.length < 32 && !looksLikeStyle(p)) return 'replicate'; // pedido curto com imagem ("crie essa tela", "recrie", etc.)
  const rep = looksLikeReplicate(p);
  const sty = looksLikeStyle(p);
  if (rep && !sty) return 'replicate';
  if (sty && !rep) return 'style';
  o.onProgress?.('Entendendo o pedido: recriar a imagem selecionada ou criar uma tela nova no estilo dela…');
  const j = await askJson(
    `O usuário selecionou/anexou imagem(ns) de referência e enviou o pedido abaixo. Decida. Responda SOMENTE JSON: {"intent":"replicate"|"style","reason":"<frase curta>"}.
- "replicate": quer RECRIAR a tela/interface mostrada na imagem como camadas editáveis no canvas (mesma estrutura e conteúdo, OU recriar a imagem aplicando modificações específicas pedidas pelo usuário, como mudar cores, tema, textos ou adicionar uma seção).
- "style": quer uma tela NOVA (outro assunto, outra função ou estrutura própria diferente da imagem) usando a imagem apenas como referência de estilo visual (paleta, tipografia, componentes, clima visual).

PEDIDO: ${prompt}`,
    o
  );
  if (j?.intent === 'replicate' || j?.intent === 'style') return j.intent;
  return 'replicate';
}

const DESKTOP_WORDS = /\b(desktop|web ?app|webapp|site|website|landing( page)?|dashboard|painel|admin|backoffice|back-office|computador|notebook|laptop|macbook|navegador|browser|saas|crm|erp|plataforma|portal|e-?commerce|loja virtual|intranet|sistema( web)?|tela larga|full ?hd|widescreen|1440|1920|1512|1280)\b/;
const MOBILE_WORDS = /\b(mobile|aplicativo|celular|iphone|android|smartphone|ios|pixel|galaxy|tab bar|tabbar|bottom ?sheet|smartwatch|apple watch|story|reels|393|390|430|412|375|360)\b/;
const TABLET_WORDS = /\b(ipad|tablet|pdv|totem|kiosk|834|744|1194)\b/;

/**
 * Formato e dimensões exatas do dispositivo: resolve instantaneamente (0ms) por dispositivo citado, dimensões explícitas
 * ou domínio do produto (SaaS/CRM/ERP/Dashboard = Desktop 1440x900; Fintech/Delivery/Social = Mobile 393x852).
 */
export async function requestFormat(prompt: string, o: { provider: string; model?: string; projectContext?: string; onProgress?: (m: string) => void }): Promise<{ mobile: boolean; width: number; height: number; deviceName?: string }> {
  const p = norm(prompt);
  const domain = matchDomainContext(prompt, o.projectContext);
  const dev = matchDeviceSpec(prompt, domain);
  if (dev.id !== 'iphone-16-pro' && dev.id !== 'desktop-standard') {
    return { mobile: dev.mobile, width: dev.width, height: dev.height, deviceName: dev.name };
  }
  const d = DESKTOP_WORDS.test(p), m = MOBILE_WORDS.test(p), t = TABLET_WORDS.test(p);
  if (t) return { mobile: false, width: dev.width, height: dev.height, deviceName: dev.name };
  if (d && !m) return { mobile: false, width: dev.width, height: dev.height, deviceName: dev.name };
  if (m && !d) return { mobile: true, width: dev.width, height: dev.height, deviceName: dev.name };
  if (domain) {
    return { mobile: dev.mobile, width: dev.width, height: dev.height, deviceName: dev.name };
  }
  if (o.projectContext) {
    const ctxNorm = norm(o.projectContext.slice(0, 900));
    if (/\b(electron|desktop|vite|next\.?js|dashboard|painel|admin|saas|erp|crm|web)\b/.test(ctxNorm) && !/\b(react-native|expo|flutter|ios|android)\b/.test(ctxNorm)) {
      return { mobile: false, width: 1440, height: 900, deviceName: 'Desktop / Web App (1440x900)' };
    }
    if (/\b(react-native|expo|flutter|swiftui|kotlin|mobile)\b/.test(ctxNorm)) {
      return { mobile: true, width: 393, height: 852, deviceName: 'iPhone 16 Pro (393x852)' };
    }
  }
  return guessScreenFormat(prompt, undefined);
}

