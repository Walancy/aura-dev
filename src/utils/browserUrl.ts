import { findProjectsInText, isProjectOpenIntent, type ProjectCandidate } from './projectMatcher';

// Dicionário de serviços e plataformas conhecidas na web
export const KNOWN_SERVICES: Record<
  string,
  { home: string; search?: (q: string) => string }
> = {
  youtube: {
    home: 'https://www.youtube.com',
    search: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  github: {
    home: 'https://www.github.com',
    search: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
  },
  google: {
    home: 'https://www.google.com',
    search: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  twitter: {
    home: 'https://x.com',
    search: (q) => `https://x.com/search?q=${encodeURIComponent(q)}`,
  },
  x: {
    home: 'https://x.com',
    search: (q) => `https://x.com/search?q=${encodeURIComponent(q)}`,
  },
  linkedin: {
    home: 'https://www.linkedin.com',
    search: (q) => `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(q)}`,
  },
  instagram: {
    home: 'https://www.instagram.com',
  },
  reddit: {
    home: 'https://www.reddit.com',
    search: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  },
  wikipedia: {
    home: 'https://www.wikipedia.org',
    search: (q) => `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
  twitch: {
    home: 'https://www.twitch.tv',
  },
  netflix: {
    home: 'https://www.netflix.com',
  },
  spotify: {
    home: 'https://open.spotify.com',
    search: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  },
  chatgpt: {
    home: 'https://chatgpt.com',
  },
  claude: {
    home: 'https://claude.ai',
  },
  amazon: {
    home: 'https://www.amazon.com',
    search: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  },
  'mercado livre': {
    home: 'https://www.mercadolivre.com.br',
    search: (q) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`,
  },
  mercadolivre: {
    home: 'https://www.mercadolivre.com.br',
    search: (q) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`,
  },
  figma: {
    home: 'https://www.figma.com',
  },
  g1: {
    home: 'https://g1.globo.com',
    search: (q) => `https://g1.globo.com/busca/?q=${encodeURIComponent(q)}`,
  },
  globo: {
    home: 'https://www.globo.com',
  },
  uol: {
    home: 'https://www.uol.com.br',
  },
  apple: {
    home: 'https://www.apple.com',
  },
  microsoft: {
    home: 'https://www.microsoft.com',
  },
  vercel: {
    home: 'https://vercel.com',
  },
  maps: {
    home: 'https://maps.google.com',
    search: (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}`,
  },
  tradutor: {
    home: 'https://translate.google.com',
    search: (q) => `https://translate.google.com/?text=${encodeURIComponent(q)}`,
  },
  noticias: {
    home: 'https://news.google.com',
    search: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  },
};

// Helper: Extrai ou resolve a URL destinada ao componente de navegador interno
export function resolveBrowserUrlFromInput(
  upstreamInput?: string,
  nodeConfigUrl?: string,
  candidateProjects: ProjectCandidate[] = []
): string {
  let targetUrl = '';
  if (upstreamInput) {
    const rawInput = upstreamInput
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .trim();

    // 1. URL explícita (http://, https://, www.)
    const urlMatch = rawInput.match(/(?:https?:\/\/|www\.)[^\s"'<>\x00-\x1F\x7F]+/i);
    if (urlMatch) {
      targetUrl = urlMatch[0]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      if (targetUrl.startsWith('www.')) targetUrl = `https://${targetUrl}`;
      return targetUrl;
    }

    // 2. Localhost ou domínio .localhost (Portless) com ou sem porta (ex: localhost:3000, 127.0.0.1:5173, myapp.localhost:1355, app.localhost)
    const localhostMatch = rawInput.match(/\b(?:(?:[a-zA-Z0-9_-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s"'<>\x00-\x1F\x7F]*)?\b/i);
    if (localhostMatch) {
      const cleanLocal = localhostMatch[0]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      return `http://${cleanLocal}`;
    }

    // 3. Domínio explícito no texto (ex: vitejs.dev, apple.com, g1.globo.com, devflow.org/docs)
    const domainMatch = rawInput.match(
      /\b([a-zA-Z0-9-]+\.(?:com\.br|gov\.br|org\.br|edu\.br|com|org|net|io|dev|app|ai|me|tv|co|uk|de|fr|xyz|tech)(?:\/[^\s"'<>\x00-\x1F\x7F]*)?)\b/i
    );
    if (domainMatch) {
      const cleanDom = domainMatch[1]
        .replace(/^[*\s`"']+|[*_`"'<>\)\].,;:]+$/g, '')
        .replace(/\/\*+.*$/, '');
      return `https://${cleanDom}`;
    }

    // 4. Busca direcionada a um serviço específico (ex: "pesquisar x no youtube", "buscar repo no github")
    const serviceSearchMatch = rawInput.match(
      /(?:pesquisar|pesquise|buscar|busque|procurar|procure)(?:\s+(?:por|sobre))?\s+([^]+?)\s+(?:no|em|na)\s+([a-zA-Z0-9\s]+?)(?:\s+no\s+navegador|\.|$)/i
    );
    if (serviceSearchMatch) {
      const q = serviceSearchMatch[1].trim();
      const sName = serviceSearchMatch[2].trim().toLowerCase();
      const svc = KNOWN_SERVICES[sName];
      if (svc?.search && q) {
        return svc.search(q);
      }
    }

    // 5. Serviço conhecido com intenção explícita de abrir/acessar (ex: "Abra o youtube no navegador.", "Acesse o github", "ir para o g1").
    // Só o nome solto não basta: a saída de um agente é a tela crua do terminal, e um "g1" ou "x" qualquer não é um pedido.
    const openIntent = '(?:abra|abrir|abre|acesse|acessar|acessa|visite|visitar|navegue|navegar|ir|v[aá]|entre|entrar|carregue|carregar|mostre|mostrar)';
    for (const [key, svc] of Object.entries(KNOWN_SERVICES)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const svcRegex = new RegExp(`\\b${openIntent}\\b(?:\\s+(?:para|pra|at[eé]|a|o|ao|à|no|na|em|do|da|de|site|p[aá]gina|pagina)){0,3}\\s+${escapedKey}\\b`, 'i');
      if (svcRegex.test(rawInput)) {
        // Verifica se há pedido de busca associado na frase (ex: "abra o youtube e busque rock")
        const associatedSearch = rawInput.match(
          /(?:pesquisar|pesquise|buscar|busque|procurar|procure)(?:\s+(?:por|sobre))?\s+[:"']?([^"'\n\r]+)/i
        );
        if (associatedSearch && associatedSearch[1]?.trim() && svc.search) {
          const cleanQ = associatedSearch[1]
            .trim()
            .replace(new RegExp(`\\s+(?:no|em|na)\\s+${escapedKey}`, 'i'), '')
            .replace(/\s+no\s+navegador/i, '')
            .trim();
          if (cleanQ && !new RegExp(`^${escapedKey}$`, 'i').test(cleanQ)) {
            return svc.search(cleanQ);
          }
        }
        return svc.home;
      }
    }

    // 6. Resolução de Projeto Solicitado & Dev URL
    // Se o texto mencionar um projeto ou expressar intenção de abrir projeto / dev server:
    if (candidateProjects && candidateProjects.length > 0) {
      const matched = findProjectsInText(rawInput, candidateProjects);
      if (matched.length > 0 && matched[0].devUrl) {
        return matched[0].devUrl;
      }
      if (isProjectOpenIntent(rawInput)) {
        const fallback = candidateProjects.find((p) => p.devUrl) || candidateProjects[0];
        if (fallback?.devUrl) {
          return fallback.devUrl;
        }
      }
    }

    // 7. "Abra o site [nome]" (ex: "abra o site da apple", "acesse o site da vercel")
    const siteMatch = rawInput.match(
      /(?:abrir|abra|acesse|acessar|navegar\s+para)\s+(?:o\s+)?site\s+(?:da\s+|do\s+|de\s+)?([a-zA-Z0-9-]+)/i
    );
    if (siteMatch && siteMatch[1]) {
      const name = siteMatch[1].trim().toLowerCase();
      if (KNOWN_SERVICES[name]) {
        return KNOWN_SERVICES[name].home;
      }
      return `https://www.${name}.com`;
    }

    // 8. Busca geral por intenção (pesquisar / buscar / procurar / saber / ver)
    const generalSearchMatch = rawInput.match(
      /(?:pesquisar|pesquise|buscar|busque|procurar|procure|encontrar|como|qual\s+é|o\s+que\s+é)(?:\s+(?:por|sobre))?\s+[:"']?([^"'\n\r]+)/i
    );
    if (generalSearchMatch && generalSearchMatch[1]?.trim()) {
      const cleanQ = generalSearchMatch[1]
        .trim()
        .replace(/\s+no\s+navegador\.?$/i, '')
        .replace(/\s+(?:na web|na internet)$/i, '')
        .trim();
      if (cleanQ) {
        return `https://www.google.com/search?q=${encodeURIComponent(cleanQ)}`;
      }
    }

    // 9. Se há texto e parece comando de abrir algo (e NÃO for intenção de abrir projeto):
    const openVerbMatch = rawInput.match(
      /(?:abrir|abra|acesse|acessar|visitar|navegue\s+até)\s+(.+)/i
    );
    if (openVerbMatch && openVerbMatch[1]?.trim() && !isProjectOpenIntent(rawInput)) {
      const target = openVerbMatch[1].trim().replace(/\s+no\s+navegador\.?$/i, '').trim();
      if (target) {
        return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }

    // 10. Se for qualquer texto não vazio (e não for comando de projeto):
    if (rawInput.length > 0 && !isProjectOpenIntent(rawInput)) {
      return `https://www.google.com/search?q=${encodeURIComponent(rawInput)}`;
    }
  }

  // 11. Configuração pré-existente do nó de navegador
  if (!targetUrl && nodeConfigUrl && nodeConfigUrl !== 'about:blank') {
    targetUrl = nodeConfigUrl;
  }

  if (!targetUrl) {
    targetUrl = 'about:blank';
  }

  if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('about:')) {
    targetUrl = `https://${targetUrl}`;
  }

  return targetUrl;
}
