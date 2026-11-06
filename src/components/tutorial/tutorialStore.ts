import type { Step } from 'react-joyride';

export type TutorialScreenId = 'projetos' | 'orchestration' | 'daily' | 'ide' | 'cli' | 'design';

export const SCREEN_TUTORIAL_LABELS: Record<TutorialScreenId, string> = {
  projetos: 'Projetos',
  orchestration: 'Orquestração',
  daily: 'Daily',
  ide: 'IDE',
  cli: 'CLI',
  design: 'Design',
};

const STORAGE_KEY = 'auradev_seen_screen_tutorials_v1';

type SeenTutorialMap = Partial<Record<TutorialScreenId, number>>;

let memorySeenCache: SeenTutorialMap | null = null;

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

export function hasSeenScreenTutorial(screenId: TutorialScreenId): boolean {
  const map = readSeenMap();
  return Boolean(map[screenId]);
}

export function markScreenTutorialSeen(screenId: TutorialScreenId): void {
  const current = readSeenMap();
  const next: SeenTutorialMap = {
    ...current,
    [screenId]: Date.now(),
  };
  memorySeenCache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function resetAllScreenTutorials(): void {
  memorySeenCache = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function isSelectorVisible(selector: string): boolean {
  if (typeof document === 'undefined') return false;
  if (selector === 'body') return true;
  const el = document.querySelector(selector);
  if (!el || !(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
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
          'Abra este menu para ajustar aparência, regras de IA ou rever o tutorial da tela atual quando precisar.',
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

const STATIC_SCREEN_CANDIDATES: Record<Exclude<TutorialScreenId, 'projetos'>, CandidateStep[]> = {
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
};

const FALLBACK_STEP_BY_SCREEN: Record<TutorialScreenId, CandidateStep> = {
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
};

export function resolveStepsForScreen(screenId: TutorialScreenId): Step[] {
  const candidates =
    screenId === 'projetos'
      ? buildProjectsCandidateSteps()
      : STATIC_SCREEN_CANDIDATES[screenId];

  const visibleSteps: Step[] = [];

  for (const item of candidates) {
    if (!isSelectorVisible(item.target)) continue;
    const hasSpotlightTarget = item.spotlightTarget && isSelectorVisible(item.spotlightTarget);
    visibleSteps.push({
      id: item.id,
      target: item.target,
      ...(hasSpotlightTarget ? { spotlightTarget: item.spotlightTarget } : {}),
      placement: item.placement || 'bottom',
      title: item.title,
      content: item.content,
      skipBeacon: true,
    });
  }

  if (visibleSteps.length === 0) {
    const fb = FALLBACK_STEP_BY_SCREEN[screenId];
    visibleSteps.push({
      id: fb.id,
      target: 'body',
      placement: 'center',
      title: fb.title,
      content: fb.content,
      skipBeacon: true,
    });
  }

  return visibleSteps;
}
