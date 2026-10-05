import type { BrainEdge, BrainNode, BrainNodeType, ProjectBrainContext } from '../types/brain';

const BRAIN_STORAGE_PREFIX = 'devflow_brain_';
const ACTIVE_BRAIN_KEY = 'devflow_active_brain_path';

// In-memory cache for synchronous instant access (e.g. during prompt assembly in handleAiSubmit)
const brainCache = new Map<string, ProjectBrainContext>();

export function getBrainStorageKey(workspacePath: string): string {
  return `${BRAIN_STORAGE_PREFIX}${workspacePath.trim()}`;
}

export function getActiveBrainContextSync(workspacePath?: string): ProjectBrainContext | null {
  if (!workspacePath) {
    const activePath = localStorage.getItem(ACTIVE_BRAIN_KEY);
    if (!activePath) return null;
    return brainCache.get(activePath) || readFromLocalStorage(activePath);
  }
  return brainCache.get(workspacePath) || readFromLocalStorage(workspacePath);
}

function readFromLocalStorage(workspacePath: string): ProjectBrainContext | null {
  try {
    const raw = localStorage.getItem(getBrainStorageKey(workspacePath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectBrainContext;
    brainCache.set(workspacePath, parsed);
    return parsed;
  } catch (err) {
    console.warn('[brainService] Erro ao ler brain do localStorage:', err);
    return null;
  }
}

/**
 * Registra atividade no fluxo de logs do sistema
 */
export function logSystemActivity(module: string, action: string, projectName: string, details?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[DevFlow System Log][${timestamp}][${module}] Acao: ${action} | Projeto: ${projectName}`, details || '');
  try {
    const logHistoryKey = 'devflow_system_activity_logs';
    const existing = JSON.parse(localStorage.getItem(logHistoryKey) || '[]');
    const newEntry = {
      timestamp,
      module,
      action,
      projectName,
      details,
    };
    existing.unshift(newEntry);
    // Limita aos ultimos 200 registros
    if (existing.length > 200) existing.length = 200;
    localStorage.setItem(logHistoryKey, JSON.stringify(existing));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('devflow-system-activity-logged', { detail: newEntry }));
    }
  } catch {}
}

/**
 * Registra atividade do Brain no fluxo de logs do sistema
 */
export function logBrainActivity(action: string, projectName: string, details?: any) {
  logSystemActivity('brain', action, projectName, details);
}

/**
 * Salva o Brain do projeto no localStorage e no arquivo .devflow/brain.json se disponivel
 */
export async function saveProjectBrain(brain: ProjectBrainContext): Promise<void> {
  const key = getBrainStorageKey(brain.workspacePath);
  brain.lastIndexedAt = Date.now();
  brain.version = (brain.version || 0) + 1;

  // Atualiza cache em memoria e localStorage
  brainCache.set(brain.workspacePath, brain);
  try {
    localStorage.setItem(key, JSON.stringify(brain));
    localStorage.setItem(ACTIVE_BRAIN_KEY, brain.workspacePath);
  } catch (err) {
    console.warn('[brainService] Erro ao salvar no localStorage:', err);
  }

  // Tenta persistir no filesystem local do projeto (.devflow/brain.json)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.fs?.writeFile) {
    try {
      const devflowDir = `${brain.workspacePath}/.devflow`;
      const brainFilePath = `${devflowDir}/brain.json`;
      if ((window as any).electronAPI?.fs?.createItem) {
        await (window as any).electronAPI.fs.createItem(devflowDir, true).catch(() => {});
      }
      await (window as any).electronAPI.fs.writeFile(
        brainFilePath,
        JSON.stringify(brain, null, 2)
      );
    } catch (fsErr) {
      console.warn('[brainService] Aviso: Nao foi possivel escrever .devflow/brain.json:', fsErr);
    }
  }

  logBrainActivity('atualizar_brain', brain.projectName, {
    nodesCount: brain.nodes.length,
    edgesCount: brain.edges.length,
    techStack: brain.techStack,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devflow-brain-updated', { detail: brain }));
  }
}

/**
 * Carrega o Brain do projeto ativo ou realiza varredura caso nao exista
 */
export async function loadProjectBrain(
  workspacePath: string,
  projectName?: string
): Promise<ProjectBrainContext> {
  const normPath = workspacePath.trim();
  const effectiveProjectName = projectName || normPath.split('/').filter(Boolean).pop() || 'Projeto';

  // 1. Tenta carregar do cache ou localStorage
  const existing = getActiveBrainContextSync(normPath);
  if (existing) {
    brainCache.set(normPath, existing);
    return existing;
  }

  // 2. Tenta ler do arquivo .devflow/brain.json
  if (typeof window !== 'undefined' && (window as any).electronAPI?.fs?.readFile) {
    try {
      const res = await (window as any).electronAPI.fs.readFile(`${normPath}/.devflow/brain.json`);
      if (res && res.content) {
        const parsed = JSON.parse(res.content) as ProjectBrainContext;
        brainCache.set(normPath, parsed);
        localStorage.setItem(getBrainStorageKey(normPath), JSON.stringify(parsed));
        return parsed;
      }
    } catch {}
  }

  // 3. Se nao existe, realiza escaneamento automatico
  const scanned = await scanProjectCodebase(normPath, effectiveProjectName);
  await saveProjectBrain(scanned);
  return scanned;
}

/**
 * Realiza troca de contexto para as IAs do aplicativo
 */
export async function switchProjectBrainContext(
  workspacePath: string,
  projectName?: string
): Promise<ProjectBrainContext> {
  const normPath = workspacePath.trim();
  const name = projectName || normPath.split('/').filter(Boolean).pop() || 'Projeto';

  localStorage.setItem(ACTIVE_BRAIN_KEY, normPath);
  const brain = await loadProjectBrain(normPath, name);

  logBrainActivity('troca_de_contexto', name, {
    workspacePath: normPath,
    techStack: brain.techStack,
    nodesCount: brain.nodes.length,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('devflow-brain-context-switched', { detail: brain })
    );
  }

  return brain;
}

/**
 * Escaneia o projeto e gera a estrutura de conhecimento, arquitetura e grafo Obsidian
 */
export async function scanProjectCodebase(
  workspacePath: string,
  projectName?: string
): Promise<ProjectBrainContext> {
  const name = projectName || workspacePath.split('/').filter(Boolean).pop() || 'Projeto';
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  const techStackSet = new Set<string>();

  // No central do projeto
  const rootNodeId = 'root-project';
  nodes.push({
    id: rootNodeId,
    label: name,
    path: workspacePath,
    type: 'entry',
    description: `Nucleo do projeto ${name}. Ponto central da arquitetura e direcionamento das IAs.`,
    tags: ['core', 'projeto', 'raiz'],
    size: 24,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  });

  let pkgJsonData: any = null;
  let readmeContent = '';
  let agentsRuleContent = '';

  // 1. Leitura de arquivos-chave de configuracao
  if (typeof window !== 'undefined' && (window as any).electronAPI?.fs?.readFile) {
    try {
      const pkgRes = await (window as any).electronAPI.fs.readFile(`${workspacePath}/package.json`);
      if (pkgRes?.content) {
        pkgJsonData = JSON.parse(pkgRes.content);
      }
    } catch {}

    try {
      const readmeRes = await (window as any).electronAPI.fs.readFile(`${workspacePath}/README.md`);
      if (readmeRes?.content) {
        readmeContent = readmeRes.content;
      }
    } catch {}

    try {
      const agentsRes = await (window as any).electronAPI.fs.readFile(`${workspacePath}/AGENTS.md`);
      if (agentsRes?.content) {
        agentsRuleContent = agentsRes.content;
      }
    } catch {}
  }

  // 2. Deteccao de Stack Tecnologica a partir do package.json ou configs
  if (pkgJsonData) {
    const deps = { ...(pkgJsonData.dependencies || {}), ...(pkgJsonData.devDependencies || {}) };

    if (deps.react) techStackSet.add(`React ${deps.react.replace(/^[\^~]/, '')}`);
    if (deps.vue) techStackSet.add(`Vue ${deps.vue.replace(/^[\^~]/, '')}`);
    if (deps.electron) techStackSet.add('Electron Desktop');
    if (deps.vite) techStackSet.add('Vite');
    if (deps.typescript) techStackSet.add('TypeScript');
    if (deps.next) techStackSet.add('Next.js');
    if (deps.tailwindcss) techStackSet.add('Tailwind CSS');
    if (deps['@nestjs/core']) techStackSet.add('NestJS');
    if (deps.express) techStackSet.add('Express');
    if (deps.zustand) techStackSet.add('Zustand');
    if (deps['@reduxjs/toolkit']) techStackSet.add('Redux Toolkit');
    if (deps['@monaco-editor/react']) techStackSet.add('Monaco Editor');
    if (deps['lucide-react']) techStackSet.add('Lucide Icons');
    if (deps.prisma) techStackSet.add('Prisma ORM');
    if (deps['@xterm/xterm']) techStackSet.add('xTerm Terminal');

    nodes.push({
      id: 'cfg-package-json',
      label: 'package.json',
      path: `${workspacePath}/package.json`,
      type: 'config',
      description: `Manifesto com ${Object.keys(deps).length} dependencias e scripts de execucao`,
      tags: ['config', 'npm', 'scripts'],
      size: 16,
      x: -180,
      y: -100,
      vx: 0,
      vy: 0,
    });
    edges.push({
      id: `edge-${rootNodeId}-cfg-package-json`,
      source: rootNodeId,
      target: 'cfg-package-json',
      relation: 'configura',
    });
  }

  // Deteccao de Rust, Docker, Python
  if (typeof window !== 'undefined' && (window as any).electronAPI?.fs?.readFile) {
    try {
      const cargoRes = await (window as any).electronAPI.fs.readFile(`${workspacePath}/Cargo.toml`);
      if (cargoRes?.content) {
        techStackSet.add('Rust / Cargo');
        nodes.push({
          id: 'cfg-cargo',
          label: 'Cargo.toml',
          path: `${workspacePath}/Cargo.toml`,
          type: 'config',
          description: 'Modulo nativo de alto desempenho em Rust',
          tags: ['rust', 'backend', 'performance'],
          size: 14,
          x: -240,
          y: -40,
          vx: 0,
          vy: 0,
        });
        edges.push({
          id: `edge-${rootNodeId}-cfg-cargo`,
          source: rootNodeId,
          target: 'cfg-cargo',
          relation: 'compila',
        });
      }
    } catch {}

    try {
      const dockerRes = await (window as any).electronAPI.fs.readFile(`${workspacePath}/Dockerfile`);
      if (dockerRes?.content) {
        techStackSet.add('Docker');
        nodes.push({
          id: 'cfg-docker',
          label: 'Dockerfile',
          path: `${workspacePath}/Dockerfile`,
          type: 'config',
          description: 'Controle de containerizacao e ambiente isolado',
          tags: ['docker', 'infra'],
          size: 12,
          x: -180,
          y: 120,
          vx: 0,
          vy: 0,
        });
        edges.push({
          id: `edge-${rootNodeId}-cfg-docker`,
          source: rootNodeId,
          target: 'cfg-docker',
          relation: 'containeriza',
        });
      }
    } catch {}
  }

  // 3. Deteccao de Documentos e Regras
  if (readmeContent) {
    nodes.push({
      id: 'doc-readme',
      label: 'README.md',
      path: `${workspacePath}/README.md`,
      type: 'doc',
      description: 'Documentacao principal do projeto com orientacoes de instalacao e arquitetura',
      tags: ['documentacao', 'guia'],
      size: 14,
      x: 200,
      y: -120,
      vx: 0,
      vy: 0,
    });
    edges.push({
      id: `edge-${rootNodeId}-doc-readme`,
      source: rootNodeId,
      target: 'doc-readme',
      relation: 'documenta',
    });
  }

  if (agentsRuleContent) {
    nodes.push({
      id: 'doc-agents',
      label: 'AGENTS.md',
      path: `${workspacePath}/AGENTS.md`,
      type: 'doc',
      description: 'Diretrizes obrigatorias para agentes de IA que operam no projeto',
      tags: ['regras', 'ia', 'seguranca'],
      size: 16,
      x: 240,
      y: -50,
      vx: 0,
      vy: 0,
    });
    edges.push({
      id: `edge-${rootNodeId}-doc-agents`,
      source: rootNodeId,
      target: 'doc-agents',
      relation: 'orienta-ia',
    });
  }

  // 4. Mapeamento de modulos a partir da arvore do projeto
  let fileTree: any[] = [];
  if (typeof window !== 'undefined' && (window as any).electronAPI?.fs?.getTree) {
    try {
      const res = await (window as any).electronAPI.fs.getTree(workspacePath, 2);
      fileTree = Array.isArray(res) ? res : (res as any)?.tree || [];
    } catch {}
  }

  // Se nao obteve pelo getTree, cria estrutura padrao baseada nos diretorios tipicos
  const modulesList: string[] = [];

  const addFolderNode = (
    folderName: string,
    relPath: string,
    type: BrainNodeType,
    desc: string,
    tags: string[],
    angle: number,
    dist: number
  ) => {
    const id = `mod-${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    nodes.push({
      id,
      label: folderName,
      path: `${workspacePath}/${relPath}`,
      type,
      description: desc,
      tags,
      size: 16,
      x,
      y,
      vx: 0,
      vy: 0,
    });
    edges.push({
      id: `edge-${rootNodeId}-${id}`,
      source: rootNodeId,
      target: id,
      relation: 'modulo',
    });
    modulesList.push(folderName);
    return id;
  };

  // Processa itens encontrados ou fallbacks
  let angleStep = (2 * Math.PI) / 8;
  let currAngle = 0;

  if (fileTree.length > 0) {
    fileTree.forEach((item: any) => {
      const lower = item.name.toLowerCase();
      if (['node_modules', '.git', 'dist', 'dist-electron', 'build', '.devflow'].includes(lower)) {
        return;
      }
      if (item.isDirectory) {
        let type: BrainNodeType = 'module';
        let desc = `Diretório de ${item.name}`;
        if (lower.includes('component')) {
          type = 'component';
          desc = 'Componentes visuais e interfaces de usuário';
        } else if (lower.includes('service') || lower.includes('api')) {
          type = 'service';
          desc = 'Camada de comunicacao, IPC, servicos e regras de negocio';
        } else if (lower.includes('electron')) {
          type = 'entry';
          desc = 'Processo principal Electron e IPC bridge nativo';
        } else if (lower.includes('rust')) {
          type = 'module';
          desc = 'Modulos de compilacao nativa em Rust';
        } else if (lower.includes('test') || lower.includes('spec')) {
          type = 'doc';
          desc = 'Testes automatizados e validacao de regressao';
        }

        const modId = addFolderNode(
          item.name,
          item.name,
          type,
          desc,
          [type, item.name],
          currAngle,
          220 + (nodes.length % 3) * 30
        );
        currAngle += angleStep;

        // Adiciona filhos importantes desse diretorio
        if (Array.isArray(item.children)) {
          item.children.slice(0, 5).forEach((child: any, cIdx: number) => {
            if (['.DS_Store'].includes(child.name)) return;
            const childId = `sub-${child.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${cIdx}`;
            const subType: BrainNodeType = child.isDirectory ? 'module' : (lower.includes('component') ? 'component' : 'service');
            nodes.push({
              id: childId,
              label: child.name,
              path: child.path,
              type: subType,
              description: child.isDirectory ? `Submodulo ${child.name}` : `Arquivo ${child.name} em ${item.name}`,
              tags: [subType, item.name],
              size: 11,
              x: Math.cos(currAngle + cIdx * 0.4) * (320 + cIdx * 15),
              y: Math.sin(currAngle + cIdx * 0.4) * (320 + cIdx * 15),
              vx: 0,
              vy: 0,
            });
            edges.push({
              id: `edge-${modId}-${childId}`,
              source: modId,
              target: childId,
              relation: 'contem',
            });
          });
        }
      }
    });
  }

  // Se nao achou modulos suficientes na arvore, cria nós representativos padrao para IDE / Web
  if (modulesList.length === 0) {
    const defaultMods = [
      { name: 'src/components', type: 'component' as BrainNodeType, desc: 'Componentes e interfaces visuais', tags: ['ui', 'react'] },
      { name: 'src/utils', type: 'service' as BrainNodeType, desc: 'Funcoes utilitarias e servicos compartilhados', tags: ['helpers', 'utils'] },
      { name: 'src/types', type: 'domain' as BrainNodeType, desc: 'Tipagens TypeScript e contratos de dados', tags: ['types', 'interfaces'] },
      { name: 'electron', type: 'entry' as BrainNodeType, desc: 'Processo principal e IPC bridges nativos', tags: ['desktop', 'ipc'] },
    ];
    defaultMods.forEach((mod, idx) => {
      addFolderNode(
        mod.name,
        mod.name,
        mod.type,
        mod.desc,
        mod.tags,
        (idx * 2 * Math.PI) / defaultMods.length,
        220
      );
    });
  }

  // Calcula conexoes para ajustar o tamanho dos nos
  const connectionCounts = new Map<string, number>();
  edges.forEach((edge) => {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  });
  nodes.forEach((node) => {
    node.connectionsCount = connectionCounts.get(node.id) || 0;
    if (!node.size) {
      node.size = Math.min(26, Math.max(10, 10 + (node.connectionsCount || 0) * 2));
    }
  });

  const techStack = Array.from(techStackSet);
  if (techStack.length === 0) {
    techStack.push('TypeScript', 'React', 'Node.js');
  }

  // Gera sintese de arquitetura e diretrizes padrao
  const summary = pkgJsonData?.description ||
    `Projeto ${name} configurado no ecossistema DevFlow com ${nodes.length} nós contextuais mapeados e suporte a múltiplos agentes de IA.`;

  const architectureOverview =
    `Arquitetura modular orientada a ${techStack.slice(0, 4).join(', ')}. ` +
    `Os fluxos de trabalho se dividem em ${modulesList.slice(0, 5).join(', ') || 'componentes, utilitarios e rotas'}.`;

  const aiDirectives = agentsRuleContent ?
    agentsRuleContent.slice(0, 1000) :
    `1. Sempre preserve o padrao de design e modularidade do projeto.\n` +
    `2. Modifique e crie arquivos apenas dentro de "${workspacePath}".\n` +
    `3. Priorize consistencia de tipos TypeScript e interfaces estritas.\n` +
    `4. Em componentes de exclusao, utilize confirmacoes seguras e padronizadas.\n` +
    `5. Mantenha micro-animacoes suaves e visual limpo sem bordas pesadas.`;

  const modulesSummary = modulesList.length > 0 ?
    `Modulos mapeados: ${modulesList.join(', ')}` :
    'Estrutura principal: src/, components/, utils/, electron/';

  return {
    id: `brain-${workspacePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
    projectName: name,
    workspacePath,
    summary,
    techStack,
    architectureOverview,
    aiDirectives,
    modulesSummary,
    nodes,
    edges,
    lastIndexedAt: Date.now(),
    version: 1,
  };
}

/**
 * Formata o contexto completo do Brain para ser injetado nos prompts dos agentes de IA
 */
export function generateBrainAiContext(brain: ProjectBrainContext | null): string {
  if (!brain) return '';

  const tech = brain.techStack && brain.techStack.length > 0 ? brain.techStack.join(', ') : 'Nao identificada';
  const topNodes = (brain.nodes || [])
    .filter((n) => n.id !== 'root-project')
    .slice(0, 12)
    .map((n) => `• [${n.type.toUpperCase()}] ${n.label}: ${n.description}`)
    .join('\n');

  return (
    `[Contexto do Brain do Projeto (DevFlow OS Context Switch)]:\n` +
    `- Projeto Ativo: ${brain.projectName}\n` +
    `- Diretorio Raiz: ${brain.workspacePath}\n` +
    `- Stack Tecnologica: ${tech}\n` +
    `- Resumo da Arquitetura: ${brain.summary}\n` +
    `${brain.architectureOverview ? `- Visao Arquitetural: ${brain.architectureOverview}\n` : ''}` +
    `${brain.modulesSummary ? `- Modulos Principais: ${brain.modulesSummary}\n` : ''}` +
    `- Diretrizes Obrigatorias de Codificacao para IAs:\n${brain.aiDirectives}\n` +
    `${topNodes ? `\n- Mapa de Componentes & Conexoes Principais:\n${topNodes}\n` : ''}`
  );
}
