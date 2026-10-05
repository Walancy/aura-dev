/**
 * Project Matcher & DevUrl Intent Resolution Utility
 * 
 * Accurately identifies projects requested in user prompts (triggers, agents, maestro),
 * prevents opening the wrong project, supports single or multi-project opening,
 * and extracts project dev URLs instead of falling back to web searches.
 */

export interface ProjectCandidate {
  id: string;
  name?: string;
  projectName?: string;
  title?: string;
  fullName?: string;
  projectPath?: string;
  localDir?: string;
  devUrl?: string;
  branch?: string;
  gitBranch?: string;
  isCloned?: boolean;
}

/**
 * Normalizes text for lenient, accent-insensitive and delimiter-agnostic matching.
 * e.g. "Estância-Bahia / Painel Interno" -> "estancia bahia painel interno"
 */
export function normalizeTextForMatching(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[_\-/\\:.,;!?#@+*&()[\]{}'"]/g, ' ') // converte pontuação em espaços
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether the input text expresses an intent to open, run, preview or view a project or dev URL.
 */
export function isProjectOpenIntent(text?: string | null): boolean {
  if (!text) return false;
  const normalized = normalizeTextForMatching(text);
  if (!normalized) return false;

  // Verbos de abertura / execução / visualização
  const hasActionVerb = /\b(abrir|abra|abrem|abra-o|rodar|rode|rodam|executar|execute|testar|teste|testam|preview|ver|veja|acessar|acesse|iniciar|inicie|start|dev|run|visualizar|visualize|carregar|carregue|mostrar|mostre|subir|suba)\b/i.test(
    normalized
  );

  // Termos relacionados a projeto / servidor / aplicação
  const hasProjectTarget = /\b(projeto|projetos|project|projects|dev|devurl|dev-url|dev url|servidor|server|porta|port|localhost|site|app|aplicacao|aplicativo|painel|sistema|navegador|browser|aba|frontend|backend)\b/i.test(
    normalized
  );

  return hasActionVerb && hasProjectTarget;
}

/**
 * Extracts searchable aliases and normalized tokens from a candidate project.
 */
export function getProjectSearchAliases(project: ProjectCandidate): string[] {
  const aliases = new Set<string>();

  const pName = project.projectName || project.name;
  if (pName) {
    aliases.add(pName);
    aliases.add(normalizeTextForMatching(pName));
  }

  if (project.title) {
    aliases.add(project.title);
    aliases.add(normalizeTextForMatching(project.title));
  }

  if (project.fullName) {
    aliases.add(project.fullName);
    const repoPart = project.fullName.split('/').pop();
    if (repoPart) {
      aliases.add(repoPart);
      aliases.add(normalizeTextForMatching(repoPart));
    }
  }

  const pPath = project.projectPath || project.localDir;
  if (pPath) {
    const cleanP = pPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = cleanP.split('/').filter(Boolean);
    const folder = parts[parts.length - 1];
    const parentFolder = parts.length > 1 ? parts[parts.length - 2] : '';
    if (folder) {
      aliases.add(folder);
      aliases.add(normalizeTextForMatching(folder));
    }
    if (parentFolder && parentFolder !== 'codes' && parentFolder !== 'Documents') {
      aliases.add(parentFolder);
      aliases.add(normalizeTextForMatching(parentFolder));
      if (folder) {
        aliases.add(`${parentFolder} ${folder}`);
        aliases.add(normalizeTextForMatching(`${parentFolder} ${folder}`));
      }
    }
  }

  // Decompõe nomes removendo sufixos técnicos comuns (-desktop, -app, -api, -web, -painel, -mobile, -interno, -frontend, -backend)
  const allRawNames = [project.projectName, project.name, project.title, project.fullName?.split('/').pop()];
  for (const raw of allRawNames) {
    if (!raw) continue;
    // Remove sufixos como -desktop, -app, etc.
    const stripped = raw.replace(/[-_](desktop|app|api|web|mobile|interno|painel|frontend|backend|client|server)$/i, '');
    if (stripped && stripped !== raw) {
      aliases.add(stripped);
      aliases.add(normalizeTextForMatching(stripped));
    }
    // Adiciona o primeiro segmento significativo antes do hífen (ex: "devflow" de "devflow-desktop")
    const segments = raw.split(/[-_\s]+/);
    if (segments.length > 1 && segments[0].length >= 3) {
      aliases.add(segments[0]);
      aliases.add(normalizeTextForMatching(segments[0]));
      // Se houver 2 primeiros segmentos (ex: "estancia" e "bahia" -> "estancia bahia")
      if (segments.length >= 2 && segments[1].length >= 3) {
        aliases.add(`${segments[0]} ${segments[1]}`);
        aliases.add(normalizeTextForMatching(`${segments[0]} ${segments[1]}`));
      }
    }
  }

  // Remove aliases vazios ou excessivamente genéricos (ex: "app", "dev", "project")
  const stopWords = new Set(['app', 'dev', 'api', 'web', 'mobile', 'projeto', 'project', 'novo projeto', 'workspace', 'main']);
  const result: string[] = [];
  aliases.forEach((a) => {
    const clean = normalizeTextForMatching(a);
    if (clean && clean.length >= 3 && !stopWords.has(clean)) {
      result.push(clean);
    }
  });

  // Ordena por tamanho decrescente (termos mais específicos primeiro)
  return result.sort((a, b) => b.length - a.length);
}

/**
 * Finds all candidate projects mentioned in the text.
 * Returns matching projects in the order they appear in the prompt.
 * If multiple projects are mentioned (e.g. "abra o projeto estancia bahia e o devflow"),
 * all of them are returned.
 */
export function findProjectsInText(
  text: string | undefined | null,
  candidates: ProjectCandidate[]
): ProjectCandidate[] {
  if (!text || !candidates || candidates.length === 0) return [];
  const normalizedText = normalizeTextForMatching(text);
  if (!normalizedText) return [];

  // Verifica se o usuário pediu especificamente "todos os projetos" ou "os 2 projetos" / "ambos projetos"
  const multiProjectMention = /\b(?:todos\s+os\s+projetos|os\s+(?:2|3|4|dois|tres|quatro)\s+projetos|ambos\s+(?:os\s+)?projetos|os\s+projetos)\b/i.test(
    normalizedText
  );

  const matched: Array<{ project: ProjectCandidate; firstIndex: number; matchLength: number }> = [];
  const matchedProjectIds = new Set<string>();

  for (const proj of candidates) {
    const aliases = getProjectSearchAliases(proj);
    let bestIndex = -1;
    let bestMatchLen = 0;

    for (const alias of aliases) {
      // Cria regex com limites de palavras ou correspondência exata de frase
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
      const m = normalizedText.match(regex);
      if (m && m.index !== undefined) {
        const idx = m.index;
        if (bestIndex === -1 || idx < bestIndex || alias.length > bestMatchLen) {
          bestIndex = idx;
          bestMatchLen = alias.length;
        }
      }
    }

    if (bestIndex !== -1 && !matchedProjectIds.has(proj.id)) {
      matchedProjectIds.add(proj.id);
      matched.push({ project: proj, firstIndex: bestIndex, matchLength: bestMatchLen });
    }
  }

  // Se encontrou projetos específicos citados no texto, retorna-os na ordem de menção
  if (matched.length > 0) {
    matched.sort((a, b) => a.firstIndex - b.firstIndex);
    return matched.map((m) => m.project);
  }

  // Se o usuário pediu explicitamente para abrir múltiplos projetos sem citar os nomes um a um
  if (multiProjectMention && candidates.length > 0) {
    return [...candidates];
  }

  return [];
}

/**
 * Resolves the appropriate project(s) for a node given the prompt and available candidate projects.
 * 
 * Precedence:
 * 1. Directly connected project nodes (text only picks among them).
 * 2. Projects explicitly mentioned in prompt / upstreamInput.
 * 3. Fallback to all canvas project nodes.
 */
export function resolveTargetProjectsForNode(
  promptOrInput: string | undefined | null,
  connectedProjects: ProjectCandidate[],
  allCanvasProjects: ProjectCandidate[],
  availableProjects: ProjectCandidate[] = []
): {
  matchedProjects: ProjectCandidate[];
  primaryProject: ProjectCandidate | null;
  isExplicitMatch: boolean;
} {
  // Concatena candidatos sem duplicatas por ID ou nome
  const seenIds = new Set<string>();
  const combinedCandidates: ProjectCandidate[] = [];

  const addCandidate = (p: ProjectCandidate) => {
    const key = p.id || p.projectName || p.name || '';
    if (key && !seenIds.has(key)) {
      seenIds.add(key);
      combinedCandidates.push(p);
    }
  };

  connectedProjects.forEach(addCandidate);
  allCanvasProjects.forEach(addCandidate);
  availableProjects.forEach(addCandidate);

  // 0. Projeto conectado por cabo é a intenção explícita do usuário: o texto só desambigua entre os conectados.
  // (Casar nomes no prompt inteiro, cheio de instruções, escolhia projeto errado.)
  if (connectedProjects.length > 0) {
    const mentioned = findProjectsInText(promptOrInput, connectedProjects);
    const chosen = mentioned.length > 0 ? mentioned : connectedProjects;
    return { matchedProjects: chosen, primaryProject: chosen[0], isExplicitMatch: mentioned.length > 0 };
  }

  // 1. Tenta correspondência explícita no texto
  const matched = findProjectsInText(promptOrInput, combinedCandidates);
  if (matched.length > 0) {
    return {
      matchedProjects: matched,
      primaryProject: matched[0],
      isExplicitMatch: true,
    };
  }

  // 2. Se não encontrou no texto, usa nós de projeto conectados diretamente
  if (connectedProjects.length > 0) {
    return {
      matchedProjects: connectedProjects,
      primaryProject: connectedProjects[0],
      isExplicitMatch: false,
    };
  }

  // 3. Fallback para nós de projeto existentes no canvas
  if (allCanvasProjects.length > 0) {
    return {
      matchedProjects: allCanvasProjects,
      primaryProject: allCanvasProjects[0],
      isExplicitMatch: false,
    };
  }

  // 4. Nenhum projeto configurado
  return {
    matchedProjects: [],
    primaryProject: null,
    isExplicitMatch: false,
  };
}
