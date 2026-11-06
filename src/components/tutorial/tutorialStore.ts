import { useEffect } from 'react';
import type { Step } from 'react-joyride';

export type TutorialScreenId = 'projetos' | 'orchestration' | 'daily' | 'ide' | 'cli' | 'design';
export type MainTutorialScreenId = TutorialScreenId;

export type OverlayTutorialId =
  | 'modal_skills'
  | 'modal_settings'
  | 'modal_ai_rules'
  | 'modal_brain'
  | 'popup_theme'
  | 'popup_cli_customize'
  | 'panel_notifications'
  | 'modal_branches';

export type ProjectSubTutorialId =
  | 'projeto_tarefas'
  | 'projeto_issues'
  | 'projeto_sprints'
  | 'projeto_riscos'
  | 'projeto_marcos'
  | 'projeto_relatorio'
  | 'projeto_links'
  | 'projeto_time'
  | 'projeto_configuracoes';

export type ProjectSubflowTutorialId = ProjectSubTutorialId;

export type TutorialContextId = TutorialScreenId | OverlayTutorialId | ProjectSubTutorialId;

export const ALL_TUTORIAL_CONTEXT_IDS: readonly TutorialContextId[] = [
  'projetos',
  'orchestration',
  'daily',
  'ide',
  'cli',
  'design',
  'modal_skills',
  'modal_settings',
  'modal_ai_rules',
  'modal_brain',
  'popup_theme',
  'popup_cli_customize',
  'panel_notifications',
  'modal_branches',
  'projeto_tarefas',
  'projeto_issues',
  'projeto_sprints',
  'projeto_riscos',
  'projeto_marcos',
  'projeto_relatorio',
  'projeto_links',
  'projeto_time',
  'projeto_configuracoes',
] as const;

export const SCREEN_TUTORIAL_LABELS: Record<TutorialContextId, string> = {
  projetos: 'Projetos',
  orchestration: 'Orquestração',
  daily: 'Daily',
  ide: 'IDE',
  cli: 'CLI',
  design: 'Design',
  modal_skills: 'Skills de IA',
  modal_settings: 'Configurações',
  modal_ai_rules: 'Regras Globais de IA',
  modal_brain: 'Brain do Projeto',
  popup_theme: 'Aparência e Tema',
  popup_cli_customize: 'Personalizar CLI',
  panel_notifications: 'Central de Notificações',
  modal_branches: 'Branches do Repositório',
  projeto_tarefas: 'Tarefas do Projeto',
  projeto_issues: 'Issues do Projeto',
  projeto_sprints: 'Sprints do Projeto',
  projeto_riscos: 'Riscos do Projeto',
  projeto_marcos: 'Marcos do Projeto',
  projeto_relatorio: 'Relatório do Projeto',
  projeto_links: 'Links do Projeto',
  projeto_time: 'Time e Acessos',
  projeto_configuracoes: 'Config. do Projeto',
};

export const TUTORIAL_CONTEXT_LABELS: Record<TutorialContextId, string> = SCREEN_TUTORIAL_LABELS;

const OVERLAY_TUTORIAL_ID_SET: ReadonlySet<string> = new Set<OverlayTutorialId>([
  'modal_skills',
  'modal_settings',
  'modal_ai_rules',
  'modal_brain',
  'popup_theme',
  'popup_cli_customize',
  'panel_notifications',
  'modal_branches',
]);

export function isOverlayTutorialContext(contextId: TutorialContextId): contextId is OverlayTutorialId {
  return OVERLAY_TUTORIAL_ID_SET.has(contextId);
}

const STORAGE_KEY = 'auradev_seen_screen_tutorials_v1';

type SeenTutorialMap = Partial<Record<TutorialContextId, number>>;

let memorySeenCache: SeenTutorialMap | null = null;

// Runtime context tracking & pub/sub bus
let activeOverlayStack: OverlayTutorialId[] = [];
let activeProjectSubflow: ProjectSubTutorialId | null = null;

type ContextChangeListener = () => void;
type TutorialRequestListener = (contextId?: TutorialContextId) => void;

const contextChangeListeners = new Set<ContextChangeListener>();
const tutorialRequestListeners = new Set<TutorialRequestListener>();

function emitContextChange(): void {
  contextChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeTutorialContextChange(listener: ContextChangeListener): () => void {
  contextChangeListeners.add(listener);
  return () => {
    contextChangeListeners.delete(listener);
  };
}

export function requestTutorialStart(contextId?: TutorialContextId): void {
  tutorialRequestListeners.forEach((listener) => {
    try {
      listener(contextId);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeTutorialRequests(listener: TutorialRequestListener): () => void {
  tutorialRequestListeners.add(listener);
  return () => {
    tutorialRequestListeners.delete(listener);
  };
}

export const subscribeTutorialManualRequest = subscribeTutorialRequests;

export function pushTutorialOverlay(overlayId: OverlayTutorialId): void {
  const filtered = activeOverlayStack.filter((item) => item !== overlayId);
  activeOverlayStack = [...filtered, overlayId];
  emitContextChange();
}

export function removeTutorialOverlay(overlayId: OverlayTutorialId): void {
  const next = activeOverlayStack.filter((item) => item !== overlayId);
  if (next.length !== activeOverlayStack.length) {
    activeOverlayStack = next;
    emitContextChange();
  }
}

export function getActiveTutorialOverlay(): OverlayTutorialId | null {
  return activeOverlayStack.length > 0
    ? activeOverlayStack[activeOverlayStack.length - 1]
    : null;
}

export function setProjectSubflowContext(subflowId: ProjectSubTutorialId | null): void {
  if (activeProjectSubflow === subflowId) return;
  activeProjectSubflow = subflowId;
  emitContextChange();
}

export function getProjectSubflowContext(): ProjectSubTutorialId | null {
  return activeProjectSubflow;
}

export function resolveActiveTutorialContext(
  activeScreen: TutorialScreenId,
  options?: { preferSubflow?: boolean }
): TutorialContextId {
  const topOverlay = getActiveTutorialOverlay();
  if (topOverlay) {
    return topOverlay;
  }

  if (activeScreen === 'projetos' && activeProjectSubflow) {
    if (options?.preferSubflow) {
      return activeProjectSubflow;
    }
    if (!hasSeenScreenTutorial('projetos')) {
      return 'projetos';
    }
    return activeProjectSubflow;
  }

  return activeScreen;
}

export function getTopTutorialContext(fallback: TutorialScreenId): TutorialContextId {
  return resolveActiveTutorialContext(fallback, { preferSubflow: true });
}

export function pushActiveTutorialContext(contextId: TutorialContextId): () => void {
  if (isOverlayTutorialContext(contextId)) {
    pushTutorialOverlay(contextId);
    return () => removeTutorialOverlay(contextId);
  }
  return () => {};
}

export function useTutorialContext(
  contextId: TutorialContextId | null | undefined,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || !contextId) return;
    return pushActiveTutorialContext(contextId);
  }, [contextId, enabled]);
}

export function resetTutorialRuntimeState(): void {
  activeOverlayStack = [];
  activeProjectSubflow = null;
  emitContextChange();
}

function readSeenMap(): SeenTutorialMap {
  if (memorySeenCache) return memorySeenCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memorySeenCache = {};
      return memorySeenCache;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      memorySeenCache = parsed as SeenTutorialMap;
      return memorySeenCache;
    }
  } catch {
    // ignore storage errors
  }
  memorySeenCache = {};
  return memorySeenCache;
}

export function hasSeenScreenTutorial(contextId: TutorialContextId): boolean {
  const map = readSeenMap();
  return Boolean(map[contextId]);
}

export function markScreenTutorialSeen(contextId: TutorialContextId): void {
  const current = readSeenMap();
  const next: SeenTutorialMap = {
    ...current,
    [contextId]: Date.now(),
  };
  memorySeenCache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  emitContextChange();
}

export function resetAllScreenTutorials(): void {
  memorySeenCache = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  emitContextChange();
}

export function countSeenTutorials(): { seen: number; total: number } {
  const map = readSeenMap();
  let seen = 0;
  for (const id of ALL_TUTORIAL_CONTEXT_IDS) {
    if (map[id]) seen += 1;
  }
  return { seen, total: ALL_TUTORIAL_CONTEXT_IDS.length };
}

function isSelectorVisible(selector: string): boolean {
  if (typeof document === 'undefined') return false;
  if (selector === 'body') return true;
  const el = document.querySelector(selector);
  if (!el || !(el instanceof HTMLElement)) return false;

  let cursor: HTMLElement | null = el;
  while (cursor && cursor !== document.body) {
    const style = window.getComputedStyle(cursor);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    cursor = cursor.parentElement;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

interface CandidateStep {
  id: string;
  target: string;
  spotlightTarget?: string;
  placement?: Step['placement'];
  title: string;
  content: string;
}

function buildProjectsCandidateSteps(): CandidateStep[] {
  const isProjectDetailsOpen = isSelectorVisible('[data-tour="project-sections-nav"]');

  if (isProjectDetailsOpen) {
    return [
      {
        id: 'projetos-detalhes-faixa',
        target: '[data-tour="projects-controls-bar"]',
        spotlightTarget: '[data-tour="projects-shelf-list"]',
        placement: 'bottom',
        title: 'Troca rápida de repositório',
        content:
          'Alterne entre projetos diretamente pela faixa superior sem precisar voltar para a grade principal.',
      },
      {
        id: 'projetos-detalhes-secoes',
        target: '[data-tour="project-sections-nav"]',
        placement: 'bottom',
        title: 'Módulos do projeto',
        content:
          'Gerencie Tarefas, Issues, Sprints, Riscos, Marcos, Relatório, Links, Time e Configurações em um único fluxo.',
      },
      {
        id: 'projetos-detalhes-contexto',
        target: '[data-tour="header-project-selector"]',
        placement: 'bottom',
        title: 'Contexto ativo sincronizado',
        content:
          'O repositório selecionado na header acompanha você automaticamente ao alternar para a IDE, CLI ou Design.',
      },
      {
        id: 'projetos-detalhes-ajuda',
        target: '[data-tour="header-settings-btn"]',
        placement: 'bottom-end',
        title: 'Configurações e Tutorial',
        content:
          'Abra este menu para ajustar aparência, regras de IA ou rever o tutorial da tela ou módulo atual quando precisar.',
      },
    ];
  }

  return [
    {
      id: 'projetos-ambientes',
      target: '[data-tour="header-nav-tabs"]',
      placement: 'bottom-start',
      title: 'Ambientes do sistema',
      content:
        'Navegue entre Projetos, Orquestração, Daily, IDE, CLI e Design mantendo sessões e processos ativos em segundo plano.',
    },
    {
      id: 'projetos-filtros',
      target: '[data-tour="projects-search-filters"]',
      placement: 'bottom-start',
      title: 'Busca e filtro por sprint',
      content:
        'Encontre rapidamente qualquer repositório por nome ou filtre os cartões pela sprint em andamento.',
    },
    {
      id: 'projetos-organizacao',
      target: '[data-tour="projects-right-filters"]',
      placement: 'bottom-end',
      title: 'Organização, Project e visualização',
      content:
        'Filtre por organização do GitHub, GitHub Project e status, ou alterne entre os modos Grade e Lista.',
    },
    {
      id: 'projetos-lista',
      target: '[data-tour="projects-controls-bar"]',
      spotlightTarget: '[data-tour="projects-shelf-list"]',
      placement: 'bottom',
      title: 'Painel de projetos',
      content:
        'Clique em um projeto para abrir suas tarefas, issues, sprints, riscos, marcos, relatórios e equipe.',
    },
    {
      id: 'projetos-config',
      target: '[data-tour="header-settings-btn"]',
      placement: 'bottom-end',
      title: 'Configurações e Tutorial',
      content:
        'Personalize temas, gerencie agentes de IA e clique em Tutorial neste menu sempre que quiser rever o guia de uma tela.',
    },
  ];
}

const STATIC_CONTEXT_CANDIDATES: Record<Exclude<TutorialContextId, 'projetos'>, CandidateStep[]> = {
  orchestration: [
    {
      id: 'orch-modos',
      target: '[data-tour="orchestration-mode-tabs"]',
      placement: 'bottom-start',
      title: 'Editor de fluxo e execuções',
      content:
        'Alterne entre o mapa visual de nós conectados e o histórico detalhado das execuções realizadas.',
    },
    {
      id: 'orch-andares',
      target: '[data-tour="orchestration-floors-btn"]',
      placement: 'bottom',
      title: 'Andares isolados por branch',
      content:
        'Crie andares dedicados a branches específicas para evoluir múltiplas frentes em paralelo sem conflito de arquivos.',
    },
    {
      id: 'orch-maestro',
      target: '[data-tour="orchestration-maestro-btn"]',
      placement: 'bottom',
      title: 'Maestro de agentes',
      content:
        'Coordene agentes de IA de forma integrada, distribuindo tarefas e acompanhando entregas em tempo real.',
    },
    {
      id: 'orch-canvas',
      target: '[data-tour="orchestration-topbar"]',
      spotlightTarget: '[data-tour="orchestration-canvas-area"]',
      placement: 'bottom',
      title: 'Canvas interativo',
      content:
        'Adicione nós de projeto, terminais e navegadores, conecte fluxos de trabalho e navegue livremente com zoom.',
    },
  ],
  daily: [
    {
      id: 'daily-modos',
      target: '[data-tour="daily-mode-header"]',
      placement: 'bottom-start',
      title: 'Daily, Weekly e exportação',
      content:
        'Alterne entre o registro diário e o planejamento semanal, ou copie o resumo pronto em Markdown com um clique.',
    },
    {
      id: 'daily-calendario',
      target: '[data-tour="daily-calendar-card"]',
      placement: 'right',
      title: 'Calendário de atividades',
      content:
        'Selecione qualquer data para consultar entregas anteriores, foco do dia e eventuais bloqueios registrados.',
    },
    {
      id: 'daily-ia',
      target: '[data-tour="daily-ai-panel"]',
      placement: 'right',
      title: 'Assistente de IA da Daily',
      content:
        'Gere itens e metas semanais automaticamente a partir do histórico recente do repositório ativo.',
    },
    {
      id: 'daily-quadro',
      target: '[data-tour="header-nav-tabs"]',
      spotlightTarget: '[data-tour="daily-board-content"]',
      placement: 'bottom-start',
      title: 'Quadro de acompanhamento',
      content:
        'Organize entregas concluídas, prioridades de hoje e impedimentos movendo cartões entre as colunas.',
    },
  ],
  ide: [
    {
      id: 'ide-barra-atividades',
      target: '[data-tour="ide-activity-bar"]',
      placement: 'right-start',
      title: 'Barra de atividades',
      content:
        'Acesse Explorador de Arquivos, Busca Global, Controle Git, Preview Web e telas vindas do estúdio de Design.',
    },
    {
      id: 'ide-explorador',
      target: '[data-tour="ide-explorer-panel"]',
      placement: 'right-start',
      title: 'Explorador e controle de versão',
      content:
        'Navegue pela estrutura de pastas do projeto, revise alterações de código e gerencie branches locais.',
    },
    {
      id: 'ide-editor',
      target: '[data-tour="ide-editor-tabs"]',
      spotlightTarget: '[data-tour="ide-editor-area"]',
      placement: 'bottom-start',
      title: 'Editor de código e abas',
      content:
        'Edite múltiplos arquivos simultaneamente com divisão de tela, busca contextual e pré-visualização integrada.',
    },
    {
      id: 'ide-terminal',
      target: '[data-tour="ide-terminal-dock"]',
      placement: 'top',
      title: 'Diagnósticos, portas e terminal',
      content:
        'Acompanhe alertas em Problems, saída de processos, portas locais, tarefas do projeto e sessões de terminal.',
    },
    {
      id: 'ide-ia',
      target: '[data-tour="ide-ai-panel"]',
      placement: 'left-start',
      title: 'Chat de IA integrado',
      content:
        'Mencione arquivos, pastas ou telas com @ para solicitar análises, correções e implementações diretas no código.',
    },
    {
      id: 'ide-layout',
      target: '[data-tour="ide-layout-controls"]',
      placement: 'bottom-end',
      title: 'Ajuste rápido de layout',
      content:
        'Mostre, oculte ou reposicione barras laterais e painéis conforme sua preferência de foco.',
    },
  ],
  cli: [
    {
      id: 'cli-atividades',
      target: '[data-tour="cli-activity-bar"]',
      placement: 'right-start',
      title: 'Apoio lateral ao terminal',
      content:
        'Consulte arquivos, status Git, issues do GitHub e telas de Design sem sair do ambiente de linha de comando.',
    },
    {
      id: 'cli-explorador',
      target: '[data-tour="cli-sidebar-pane"]',
      placement: 'right-start',
      title: 'Contexto do repositório',
      content:
        'Visualize rapidamente arquivos e pendências do projeto ao lado das suas sessões interativas.',
    },
    {
      id: 'cli-barra-abas',
      target: '[data-tour="cli-terminal-topbar"]',
      placement: 'bottom-start',
      title: 'Sessões, agentes e divisões',
      content:
        'Abra múltiplos terminais e agentes CLI, organize grades divididas e envie diagnósticos direto para a IA ativa.',
    },
    {
      id: 'cli-area-terminal',
      target: '[data-tour="cli-terminal-topbar"]',
      spotlightTarget: '[data-tour="cli-terminal-pane"]',
      placement: 'bottom',
      title: 'Execução nativa personalizável',
      content:
        'Opere agentes e comandos com baixa latência e ajuste temas, fontes e efeitos em Personalizar CLI na header.',
    },
  ],
  design: [
    {
      id: 'design-projeto',
      target: '[data-tour="header-project-selector"]',
      placement: 'bottom',
      title: 'Design conectado ao projeto',
      content:
        'As telas e componentes criados aqui ficam vinculados ao repositório ativo para ponte direta com o código.',
    },
    {
      id: 'design-ia',
      target: '[data-tour="header-ai-selector"]',
      placement: 'bottom-end',
      title: 'Provedor e modelo de IA',
      content:
        'Escolha qual agente e modelo conduzem a geração e o refinamento assistido de interfaces no estúdio.',
    },
    {
      id: 'design-estudio',
      target: '[data-tour="header-nav-tabs"]',
      spotlightTarget: '[data-tour="design-studio-canvas"]',
      placement: 'bottom-start',
      title: 'Estúdio visual FigCraft',
      content:
        'Projete telas, protótipos e especificações visuais e utilize @design na IDE ou no CLI para implementá-las.',
    },
  ],

  modal_skills: [
    {
      id: 'skills-abas',
      target: '[data-tour="skills-tabs"]',
      placement: 'bottom-start',
      title: 'Instaladas, Explorar e No sistema',
      content:
        'Alterne entre as skills já ativas nos seus agentes, o catálogo online para instalação em um clique e pacotes detectados localmente.',
    },
    {
      id: 'skills-acoes',
      target: '[data-tour="skills-actions"]',
      placement: 'bottom-end',
      title: 'Criação, importação e atualização',
      content:
        'Crie novas skills personalizadas, importe pastas existentes de regras ou atualize todas as skills instaladas de uma só vez.',
    },
    {
      id: 'skills-conteudo',
      target: '[data-tour="skills-header"]',
      spotlightTarget: '[data-tour="skills-body"]',
      placement: 'bottom',
      title: 'Sincronização entre provedores de IA',
      content:
        'Ative ou sincronize cada skill entre Claude, Gemini, Codex e outros agentes instalados mantendo suas especialidades alinhadas.',
    },
  ],
  modal_settings: [
    {
      id: 'settings-navegacao',
      target: '[data-tour="settings-sidebar-tabs"]',
      placement: 'right-start',
      title: 'Categorias de preferências',
      content:
        'Navegue entre ajustes gerais, aparência, editor, terminal, provedores de IA, layout, snippets, tarefas, atalhos e workspace.',
    },
    {
      id: 'settings-painel',
      target: '[data-tour="settings-header"]',
      spotlightTarget: '[data-tour="settings-content-pane"]',
      placement: 'bottom',
      title: 'Ajustes aplicados em tempo real',
      content:
        'Todas as preferências alteradas aqui entram em vigor imediatamente, incluindo a opção de redefinir os tutoriais na aba Geral.',
    },
  ],
  modal_ai_rules: [
    {
      id: 'ai-rules-provedor',
      target: '[data-tour="ai-rules-provider-selector"]',
      placement: 'bottom-start',
      title: 'Instruções por provedor de IA',
      content:
        'Selecione o agente desejado para visualizar e editar o arquivo global de instruções correspondente na sua máquina.',
    },
    {
      id: 'ai-rules-acoes',
      target: '[data-tour="ai-rules-actions"]',
      placement: 'bottom-end',
      title: 'Modelos de diretrizes e salvamento',
      content:
        'Insira blocos prontos de boas práticas em Diretrizes, abra o arquivo diretamente na IDE ou salve suas alterações.',
    },
    {
      id: 'ai-rules-editor',
      target: '[data-tour="ai-rules-path-bar"]',
      spotlightTarget: '[data-tour="ai-rules-editor"]',
      placement: 'bottom',
      title: 'Editor de regras persistentes',
      content:
        'Defina padrões de arquitetura, estilo visual e convenções de código que os agentes seguirão em qualquer projeto.',
    },
  ],
  modal_brain: [
    {
      id: 'brain-lateral',
      target: '[data-tour="brain-sidebar-tabs"]',
      placement: 'right-start',
      title: 'Visão de arquitetura e inspetor',
      content:
        'Consulte o resumo estrutural do projeto, inspecione propriedades de cada nó selecionado ou adicione notas arquiteturais.',
    },
    {
      id: 'brain-acoes',
      target: '[data-tour="brain-header-actions"]',
      placement: 'bottom-end',
      title: 'Escaneamento e contexto para IA',
      content:
        'Escaneie o código para atualizar o mapa de dependências e salve o arquivo de contexto para orientar os agentes.',
    },
    {
      id: 'brain-grafo',
      target: '[data-tour="brain-header"]',
      spotlightTarget: '[data-tour="brain-graph-area"]',
      placement: 'bottom',
      title: 'Grafo interativo de conhecimento',
      content:
        'Explore visualmente módulos, rotas, tabelas, regras e logs do sistema conectados por relações semânticas.',
    },
  ],
  popup_theme: [
    {
      id: 'theme-modo',
      target: '[data-tour="theme-mode-selector"]',
      placement: 'left',
      title: 'Modo de exibição',
      content:
        'Alterne rapidamente entre tema escuro, tema claro ou sincronização automática com a aparência do sistema operacional.',
    },
    {
      id: 'theme-destaque',
      target: '[data-tour="theme-accent-section"]',
      placement: 'left',
      title: 'Cor de destaque e personalização',
      content:
        'Escolha uma cor da paleta, defina um código hexadecimal próprio ou ative o modo dinâmico de transição contínua.',
    },
    {
      id: 'theme-ia-sync',
      target: '[data-tour="theme-ai-sync"]',
      placement: 'left',
      title: 'Identidade cromática por IA',
      content:
        'Vincule automaticamente a cor de destaque da interface e do chat ao agente de IA ativo no momento.',
    },
  ],
  popup_cli_customize: [
    {
      id: 'cli-preview',
      target: '[data-tour="cli-customize-preview"]',
      placement: 'left',
      title: 'Pré-visualização instantânea',
      content:
        'Confira em tempo real como ficam o fundo, as cores ANSI, o prompt e o cursor antes mesmo de digitar no terminal.',
    },
    {
      id: 'cli-opcoes',
      target: '[data-tour="cli-customize-header"]',
      spotlightTarget: '[data-tour="cli-customize-options"]',
      placement: 'left',
      title: 'Paleta, tipografia e cursor',
      content:
        'Personalize esquemas de cores do terminal, família e tamanho da fonte, altura de linha e estilo do cursor.',
    },
  ],
  panel_notifications: [
    {
      id: 'notif-abas',
      target: '[data-tour="notifications-tabs"]',
      placement: 'bottom',
      title: 'Novas e histórico',
      content:
        'Separe avisos recentes que exigem atenção do histórico completo de eventos já verificados.',
    },
    {
      id: 'notif-lista',
      target: '[data-tour="notifications-header"]',
      spotlightTarget: '[data-tour="notifications-list"]',
      placement: 'left-start',
      title: 'Eventos em tempo real',
      content:
        'Acompanhe conclusões de tarefas de agentes, atualizações de repositórios e marque itens como lidos com um clique.',
    },
  ],
  modal_branches: [
    {
      id: 'branch-topo',
      target: '[data-tour="branch-header"]',
      placement: 'bottom',
      title: 'Branch atual e sincronização',
      content:
        'Veja qual branch está ativa no workspace local e utilize Sync para buscar atualizações remotas do Git.',
    },
    {
      id: 'branch-criar',
      target: '[data-tour="branch-create-bar"]',
      placement: 'bottom',
      title: 'Nova branch e filtro rápido',
      content:
        'Digite o nome desejado para criar uma nova branch a partir da atual ou filtre branches existentes na busca.',
    },
    {
      id: 'branch-lista',
      target: '[data-tour="branch-list-area"]',
      placement: 'top',
      title: 'Troca rápida de contexto Git',
      content:
        'Visualize branches locais e remotas do repositório e faça checkout com apenas um clique.',
    },
  ],

  projeto_tarefas: [
    {
      id: 'tarefas-visualizacao',
      target: '[data-tour="tarefas-view-switcher"]',
      placement: 'bottom-start',
      title: 'Cinco modos de visualização',
      content:
        'Alterne entre Planilha, Timeline, Gantt, Kanban e Roadmap trabalhando sempre sobre a mesma base de tarefas.',
    },
    {
      id: 'tarefas-ferramentas',
      target: '[data-tour="tarefas-toolbar-right"]',
      placement: 'bottom-end',
      title: 'Busca, filtros e nova tarefa',
      content:
        'Combine filtros por responsável, status ou prioridade, ordene colunas e adicione novas entregas rapidamente.',
    },
    {
      id: 'tarefas-painel',
      target: '[data-tour="tarefas-topbar"]',
      spotlightTarget: '[data-tour="tarefas-main-container"]',
      placement: 'bottom',
      title: 'Gestão integrada de execução',
      content:
        'Atualize prazos, progresso e vínculos com sprints diretamente na visualização escolhida.',
    },
  ],
  projeto_issues: [
    {
      id: 'issues-filtros-laterais',
      target: '[data-tour="issues-left-sidebar"]',
      placement: 'right-start',
      title: 'Filtros rápidos por contexto',
      content:
        'Refine as issues do repositório por atribuição, autor, menções ou atividade recente usando a barra lateral.',
    },
    {
      id: 'issues-barra-superior',
      target: '[data-tour="issues-table-header"]',
      placement: 'bottom',
      title: 'Status, busca e abertura de issue',
      content:
        'Alterne entre Todas, Aberto e Fechado, pesquise termos específicos ou registre uma nova issue no GitHub.',
    },
    {
      id: 'issues-listagem',
      target: '[data-tour="issues-table-header"]',
      spotlightTarget: '[data-tour="issues-table-area"]',
      placement: 'bottom',
      title: 'Inspeção e execução assistida',
      content:
        'Clique em qualquer issue para ler discussões, gerenciar labels ou delegar a resolução para um agente na IDE ou CLI.',
    },
  ],
  projeto_sprints: [
    {
      id: 'sprints-barra-lateral',
      target: '[data-tour="sprint-sidebar"]',
      placement: 'right-start',
      title: 'Calendário e ciclos de sprint',
      content:
        'Acompanhe os dias do ciclo no calendário, crie novas sprints e navegue entre iterações ativas, futuras e encerradas.',
    },
    {
      id: 'sprints-indicadores',
      target: '[data-tour="sprint-header-kpis"]',
      placement: 'bottom',
      title: 'Indicadores e metas do ciclo',
      content:
        'Monitore percentual concluído, contagem regressiva de dias, total de entregas e ações rápidas da sprint.',
    },
    {
      id: 'sprints-modos',
      target: '[data-tour="sprint-view-modes"]',
      placement: 'bottom-start',
      title: 'Visões dedicadas da sprint',
      content:
        'Acompanhe o escopo do ciclo em Issues, Tabela, Calendário, Kanban ou Roadmap conforme a cerimônia do time.',
    },
  ],
  projeto_riscos: [
    {
      id: 'riscos-saude',
      target: '[data-tour="riscos-left-column"]',
      placement: 'right-start',
      title: 'Índice de saúde e sinais vitais',
      content:
        'Avalie a pontuação consolidada do repositório com métricas de demandas atrasadas, retrabalho e cadência de entregas.',
    },
    {
      id: 'riscos-modos',
      target: '[data-tour="riscos-mode-tabs"]',
      placement: 'bottom-start',
      title: 'Alertas, Matriz e Estratégicos',
      content:
        'Alterne entre alertas detectados automaticamente, matriz de impacto por probabilidade e riscos estratégicos mapeados.',
    },
    {
      id: 'riscos-painel',
      target: '[data-tour="riscos-mode-tabs"]',
      spotlightTarget: '[data-tour="riscos-right-panel"]',
      placement: 'bottom',
      title: 'Planos preventivos e mitigação',
      content:
        'Cadastre riscos manuais, defina severidade e acompanhe ações de mitigação antes que afetem os prazos.',
    },
  ],
  projeto_marcos: [
    {
      id: 'marcos-lista',
      target: '[data-tour="marcos-left-sidebar"]',
      placement: 'right-start',
      title: 'Gestão de milestones',
      content:
        'Crie novos marcos de entrega, busque pelo título e filtre rapidamente entre Abertos, Fechados e Atrasados.',
    },
    {
      id: 'marcos-detalhes',
      target: '[data-tour="marcos-detail-header"]',
      spotlightTarget: '[data-tour="marcos-detail-area"]',
      placement: 'bottom',
      title: 'Escopo e progresso da entrega',
      content:
        'Acompanhe o avanço percentual do marco selecionado, sua data limite e todas as issues vinculadas.',
    },
  ],
  projeto_relatorio: [
    {
      id: 'relatorio-secoes',
      target: '[data-tour="relatorio-left-sidebar"]',
      placement: 'right-start',
      title: 'Dimensões analíticas',
      content:
        'Navegue entre visão executiva, vazão de entregas, tempo de ciclo, qualidade e desempenho da equipe.',
    },
    {
      id: 'relatorio-kpis',
      target: '[data-tour="relatorio-top-kpis"]',
      placement: 'bottom',
      title: 'KPIs, IA Insights e exportação',
      content:
        'Consulte indicadores chave no topo, gere análises executivas com IA ou exporte o relatório completo em Markdown.',
    },
    {
      id: 'relatorio-conteudo',
      target: '[data-tour="relatorio-top-kpis"]',
      spotlightTarget: '[data-tour="relatorio-content-area"]',
      placement: 'bottom',
      title: 'Métricas históricas do projeto',
      content:
        'Analise tendências de produtividade, gargalos operacionais e evolução da saúde técnica ao longo do tempo.',
    },
  ],
  projeto_links: [
    {
      id: 'links-barra',
      target: '[data-tour="links-toolbar"]',
      placement: 'bottom',
      title: 'Categorias, busca e novo atalho',
      content:
        'Filtre recursos externos por Git, Deploy, Design ou Documentação e cadastre novos links importantes para o time.',
    },
    {
      id: 'links-grade',
      target: '[data-tour="links-toolbar"]',
      spotlightTarget: '[data-tour="links-grid-area"]',
      placement: 'bottom',
      title: 'Central de referências do projeto',
      content:
        'Acesse ambientes de produção, homologação, painéis de monitoramento e protótipos em um único lugar.',
    },
  ],
  projeto_time: [
    {
      id: 'time-navegacao',
      target: '[data-tour="time-left-sidebar"]',
      placement: 'right-start',
      title: 'Membros, acessos e governança',
      content:
        'Alterne entre visão geral da equipe, lista de membros, times, permissões de acesso, auditoria e insights com IA.',
    },
    {
      id: 'time-area',
      target: '[data-tour="time-left-sidebar"]',
      spotlightTarget: '[data-tour="time-content-area"]',
      placement: 'right',
      title: 'Colaboração e distribuição de carga',
      content:
        'Gerencie convites, papéis no repositório, matriz de responsabilidades e equilíbrio de demandas entre colaboradores.',
    },
  ],
  projeto_configuracoes: [
    {
      id: 'proj-config-menu',
      target: '[data-tour="proj-settings-sidebar"]',
      placement: 'right-start',
      title: 'Seções de configuração do repositório',
      content:
        'Pesquise ou navegue entre dados gerais, proteção de branches, webhooks, integrações Aura Dev e opções avançadas.',
    },
    {
      id: 'proj-config-topo',
      target: '[data-tour="proj-settings-topbar"]',
      spotlightTarget: '[data-tour="proj-settings-content"]',
      placement: 'bottom',
      title: 'Status e sincronização com GitHub',
      content:
        'Confira permissão de acesso, visibilidade, branch padrão e sincronize metadados diretamente com o GitHub.',
    },
  ],
};

const FALLBACK_STEP_BY_SCREEN: Record<TutorialContextId, CandidateStep> = {
  projetos: {
    id: 'projetos-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente de Projetos',
    content:
      'Gerencie repositórios, sprints, issues, riscos, marcos e equipe em um painel centralizado conectado ao GitHub.',
  },
  orchestration: {
    id: 'orchestration-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente de Orquestração',
    content:
      'Monte fluxos visuais com múltiplos agentes de IA, terminais e navegadores operando em branches isoladas.',
  },
  daily: {
    id: 'daily-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente de Daily e Weekly',
    content:
      'Acompanhe entregas diárias, planeje metas semanais com apoio de IA e exporte resumos prontos em Markdown.',
  },
  ide: {
    id: 'ide-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente IDE',
    content:
      'Edite código no Monaco Editor com explorador de arquivos, controle Git, terminal integrado e chat de IA contextual.',
  },
  cli: {
    id: 'cli-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente CLI',
    content:
      'Execute múltiplos terminais nativos e agentes de linha de comando lado a lado com acesso rápido aos arquivos do projeto.',
  },
  design: {
    id: 'design-fallback',
    target: 'body',
    placement: 'center',
    title: 'Ambiente de Design',
    content:
      'Crie interfaces, fluxos e especificações visuais sincronizadas com o repositório ativo para implementação direta.',
  },
  modal_skills: {
    id: 'modal-skills-fallback',
    target: 'body',
    placement: 'center',
    title: 'Fluxo de Skills de IA',
    content:
      'Instale, crie, importe e sincronize skills especializadas entre todos os seus agentes de IA em um único catálogo.',
  },
  modal_settings: {
    id: 'modal-settings-fallback',
    target: 'body',
    placement: 'center',
    title: 'Configurações do Sistema',
    content:
      'Personalize preferências gerais, aparência, notificações, provedores de IA, editor, terminal e atalhos globais.',
  },
  modal_ai_rules: {
    id: 'modal-ai-rules-fallback',
    target: 'body',
    placement: 'center',
    title: 'Regras Globais de IA',
    content:
      'Edite instruções globais por agente e aplique diretrizes padronizadas de engenharia e design em todos os projetos.',
  },
  modal_brain: {
    id: 'modal-brain-fallback',
    target: 'body',
    placement: 'center',
    title: 'Brain do Projeto',
    content:
      'Mapeie a arquitetura em grafo interativo, inspecione módulos e gere contexto estruturado para orientar agentes de IA.',
  },
  popup_theme: {
    id: 'popup-theme-fallback',
    target: 'body',
    placement: 'center',
    title: 'Aparência e Tema',
    content:
      'Ajuste modo claro ou escuro, cor de destaque personalizada e sincronização visual com o provedor de IA ativo.',
  },
  popup_cli_customize: {
    id: 'popup-cli-customize-fallback',
    target: 'body',
    placement: 'center',
    title: 'Personalizar CLI',
    content:
      'Configure esquema de cores, fonte monoespaçada, espaçamento e cursor das suas sessões de terminal com preview ao vivo.',
  },
  panel_notifications: {
    id: 'panel-notifications-fallback',
    target: 'body',
    placement: 'center',
    title: 'Central de Notificações',
    content:
      'Acompanhe avisos recentes, conclusões de agentes e histórico de atividades do sistema em tempo real.',
  },
  modal_branches: {
    id: 'modal-branches-fallback',
    target: 'body',
    placement: 'center',
    title: 'Gerenciador de Branches',
    content:
      'Sincronize referências remotas, crie novas branches e alterne o contexto Git do repositório com rapidez.',
  },
  projeto_tarefas: {
    id: 'projeto-tarefas-fallback',
    target: 'body',
    placement: 'center',
    title: 'Tarefas do Projeto',
    content:
      'Organize entregas em Planilha, Timeline, Gantt, Kanban ou Roadmap com filtros combinados e edição ágil.',
  },
  projeto_issues: {
    id: 'projeto-issues-fallback',
    target: 'body',
    placement: 'center',
    title: 'Issues do Projeto',
    content:
      'Gerencie issues sincronizadas com o GitHub usando filtros por autor, label, marco e delegação direta para agentes.',
  },
  projeto_sprints: {
    id: 'projeto-sprints-fallback',
    target: 'body',
    placement: 'center',
    title: 'Sprints do Projeto',
    content:
      'Planeje ciclos de entrega com calendário integrado, indicadores de progresso e múltiplas visões operacionais.',
  },
  projeto_riscos: {
    id: 'projeto-riscos-fallback',
    target: 'body',
    placement: 'center',
    title: 'Riscos e Saúde do Projeto',
    content:
      'Monitore o score de saúde do repositório, alertas automáticos, matriz de impacto e planos de mitigação.',
  },
  projeto_marcos: {
    id: 'projeto-marcos-fallback',
    target: 'body',
    placement: 'center',
    title: 'Marcos do Projeto',
    content:
      'Acompanhe milestones, datas limite e percentual de conclusão das principais entregas do repositório.',
  },
  projeto_relatorio: {
    id: 'projeto-relatorio-fallback',
    target: 'body',
    placement: 'center',
    title: 'Relatório Analítico',
    content:
      'Visualize métricas de vazão, lead time, retrabalho, diagnósticos gerados por IA e exportação em Markdown.',
  },
  projeto_links: {
    id: 'projeto-links-fallback',
    target: 'body',
    placement: 'center',
    title: 'Links do Projeto',
    content:
      'Centralize links de deploy, repositórios, protótipos de design, monitoramento e documentações da equipe.',
  },
  projeto_time: {
    id: 'projeto-time-fallback',
    target: 'body',
    placement: 'center',
    title: 'Time e Governança',
    content:
      'Gerencie membros, equipes, permissões de acesso no GitHub, auditoria e distribuição de atividades.',
  },
  projeto_configuracoes: {
    id: 'projeto-configuracoes-fallback',
    target: 'body',
    placement: 'center',
    title: 'Configurações do Projeto',
    content:
      'Ajuste visibilidade, branch padrão, regras de proteção, integrações e preferências específicas do repositório.',
  },
};

export function resolveStepsForScreen(contextId: TutorialContextId): Step[] {
  const candidates =
    contextId === 'projetos'
      ? buildProjectsCandidateSteps()
      : STATIC_CONTEXT_CANDIDATES[contextId];

  const visibleSteps: Step[] = [];

  for (const item of candidates) {
    if (!isSelectorVisible(item.target)) continue;
    const hasSpotlightTarget = item.spotlightTarget && isSelectorVisible(item.spotlightTarget);
    visibleSteps.push({
      id: item.id,
      target: item.target,
      ...(hasSpotlightTarget ? { spotlightTarget: item.spotlightTarget } : {}),
      placement: item.placement || 'bottom',
      title: item.title.trim(),
      content: item.content,
      skipBeacon: true,
    });
  }

  if (visibleSteps.length === 0) {
    const fb = FALLBACK_STEP_BY_SCREEN[contextId];
    visibleSteps.push({
      id: fb.id,
      target: 'body',
      placement: 'center',
      title: fb.title.trim(),
      content: fb.content,
      skipBeacon: true,
    });
  }

  return visibleSteps;
}
