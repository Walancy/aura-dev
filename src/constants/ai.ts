export interface AiSlashCommand {
  command: string;
  description: string;
  usage?: string;
}

export interface AiProviderConfig {
  id: string;
  name: string;
  cliCommand: string;
  installUrl: string;
  installGuide: string;
  requiresLogin?: boolean;
  loginCommand?: string;
  loginUrl?: string;
  loginHelp?: string;
  models: string[];
  commands: AiSlashCommand[];
  patchNotesUrl?: string;
}

// Brand accent colors for AI providers
export const AI_BRAND_COLORS: Record<string, string> = {
  claude: '#FF8B67',
  antigravity: '#69C2FD',
  codex: '#8975B9',
  gemini: '#589EFF',
  ollama: '#ECECEC',
};

// AI Execution Modes (Auto Mode, Plan Mode, Code Agent, Ask Only)
export type AiMode = 'auto' | 'plan' | 'agent' | 'ask';

export interface AiModeConfig {
  id: AiMode;
  name: string;
  shortName: string;
  badge: string;
  iconName: string;
  description: string;
  guide: string;
}

export const AI_MODES: AiModeConfig[] = [
  {
    id: 'auto',
    name: 'Auto',
    shortName: 'Auto',
    badge: '',
    iconName: 'Zap',
    description: 'Execução autônoma contínua',
    guide: 'Executa tarefas sem confirmação manual.',
  },
  {
    id: 'plan',
    name: 'Plan',
    shortName: 'Plan',
    badge: '',
    iconName: 'ListChecks',
    description: 'Planejamento antes de codar',
    guide: 'Cria estratégia antes de alterar código.',
  },
  {
    id: 'agent',
    name: 'Agente',
    shortName: 'Agente',
    badge: '',
    iconName: 'Bot',
    description: 'Assistente interativo padrão',
    guide: 'Escreve, testa e depura código.',
  },
  {
    id: 'ask',
    name: 'Ask',
    shortName: 'Ask',
    badge: '',
    iconName: 'MessageSquare',
    description: 'Apenas respostas conceituais',
    guide: 'Não modifica arquivos no disco.',
  },
];

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    cliCommand: 'claude',
    installUrl: 'https://claude.com/download',
    installGuide: 'npm install -g @anthropic-ai/claude-code',
    patchNotesUrl: 'https://github.com/anthropics/claude-code/releases',
    requiresLogin: true,
    loginCommand: 'claude login',
    loginUrl: 'https://claude.ai/login',
    loginHelp: 'O Claude Code CLI requer login com sua conta Anthropic. Complete a autenticação no navegador ou envie a chave/código no terminal.',
    models: [
      'Sonnet 5',
      'Opus 5',
      'Haiku 4.5',
      'Fable 5.1',
      'Best (Fable 5.1)',
      'Sonnet 5 (1M)',
      'Opus 5 (1M)',
      'Fable 5.1 (1M)',
      'Opus Plan',
      'Default',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos e opções disponíveis no Claude Code' },
      { command: '/model', description: 'Trocar ou configurar modelo do Claude', usage: '/model [nome]' },
      { command: '/cost', description: 'Ver custos acumulados e uso de tokens da sessão' },
      { command: '/clear', description: 'Limpar a conversa e resetar o contexto do agente' },
      { command: '/compact', description: 'Compactar histórico para liberar contexto' },
      { command: '/doctor', description: 'Diagnosticar saúde do ambiente e configurações' },
      { command: '/config', description: 'Ver ou alterar configurações do Claude Code' },
      { command: '/init', description: 'Criar arquivo CLAUDE.md com instruções do projeto' },
      { command: '/review', description: 'Revisar diff e alterações de código no projeto' },
      { command: '/pr', description: 'Criar um Pull Request com as alterações atuais' },
      { command: '/bug', description: 'Reportar um bug diretamente para a Anthropic' },
      { command: '/login', description: 'Fazer login ou autenticar conta Anthropic' },
    ],
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliCommand: 'agy',
    installUrl: 'https://antigravity.google/product/antigravity-cli?authuser=31',
    installGuide: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    patchNotesUrl: 'https://antigravity.google/changelog',
    requiresLogin: true,
    loginCommand: 'export PATH="$HOME/.local/bin:$PATH"; agy',
    loginUrl: 'https://antigravity.google/product/antigravity-cli?authuser=31',
    loginHelp: 'O Antigravity requer autorização de login com sua conta Google. Faça login no navegador e envie o código gerado para o CLI.',
    models: [
      'gemini-3.8-flash-high',
      'gemini-3.8-flash-medium',
      'gemini-3.8-flash-low',
      'gemini-3.7-flash-high',
      'gemini-3.7-flash-medium',
      'gemini-3.7-flash-low',
      'gemini-3.6-flash-high',
      'gemini-3.6-flash-medium',
      'gemini-3.6-flash-low',
      'gemini-3.1-pro-high',
      'gemini-3.1-pro-low',
      'claude-sonnet-4-6',
      'claude-opus-4-6-thinking',
      'gpt-oss-120b-medium',
    ],
    commands: [
      { command: '/goal', description: 'Executar tarefa autônoma até o objetivo final', usage: '/goal [objetivo]' },
      { command: '/plan', description: 'Planejar implementação e arquitetura antes de codar', usage: '/plan [tarefa]' },
      { command: '/grill-me', description: 'Entrevista técnica interativa para refinar decisões de design' },
      { command: '/schedule', description: 'Agendar timer ou rotina periódica em segundo plano', usage: '/schedule [tempo]' },
      { command: '/learn', description: 'Registrar aprendizado e diretrizes para novas tarefas' },
      { command: '/browser', description: 'Invocar subagente de navegação web com gravação de sessão' },
      { command: '/subagents', description: 'Listar e gerenciar subagentes autônomos em background' },
      { command: '/status', description: 'Verificar status das tarefas ativas em segundo plano' },
      { command: '/clear', description: 'Limpar contexto e reiniciar agente' },
      { command: '/help', description: 'Guia completo de recursos e comandos do Antigravity' },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    cliCommand: 'codex',
    installUrl: 'https://learn.chatgpt.com/docs/codex/cli',
    installGuide: 'npm install -g @openai/codex',
    patchNotesUrl: 'https://github.com/openai/codex/releases',
    requiresLogin: true,
    loginCommand: 'codex login',
    loginUrl: 'https://platform.openai.com/api-keys',
    loginHelp: 'O Codex CLI requer autenticação ou uma chave de API da OpenAI (OPENAI_API_KEY).',
    models: [
      'default',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos e opções do Codex CLI' },
      { command: '/model', description: 'Selecionar o modelo configurado no Codex CLI', usage: '/model [nome]' },
      { command: '/clear', description: 'Resetar histórico e contexto da sessão' },
      { command: '/review', description: 'Revisão profunda de código com recomendações' },
      { command: '/diff', description: 'Visualizar diff de alterações locais no repositório' },
      { command: '/test', description: 'Gerar e rodar suíte de testes unitários' },
      { command: '/exec', description: 'Executar comando no shell local e analisar saída', usage: '/exec [cmd]' },
      { command: '/login', description: 'Configurar chave OPENAI_API_KEY ou autenticação' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    cliCommand: 'gemini',
    installUrl: 'https://geminicli.com/docs/get-started/installation/',
    installGuide: 'npm install -g @google/gemini-cli',
    patchNotesUrl: 'https://github.com/google-gemini/gemini-cli/releases',
    requiresLogin: true,
    loginCommand: 'gemini auth login',
    loginUrl: 'https://aistudio.google.com/apikey',
    loginHelp: 'O Gemini CLI requer autenticação com conta Google ou chave do Google AI Studio (GEMINI_API_KEY).',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash-thinking',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-3.8-flash-high',
      'gemini-3.7-flash-high',
      'gemini-3.6-flash',
      'gemini-3.1-pro',
    ],
    commands: [
      { command: '/help', description: 'Exibir opções e ajuda do Gemini CLI' },
      { command: '/model', description: 'Alternar modelo (2.5 Pro, Flash, etc)', usage: '/model [nome]' },
      { command: '/clear', description: 'Limpar histórico e contexto da sessão' },
      { command: '/analyze', description: 'Análise detalhada do repositório e dependências' },
      { command: '/tokens', description: 'Exibir contagem de tokens e quotas da sessão' },
      { command: '/system', description: 'Definir instrução de sistema para o agente', usage: '/system [texto]' },
      { command: '/auth', description: 'Gerenciar autenticação com conta Google ou API key' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    cliCommand: 'ollama',
    installUrl: 'https://ollama.com/download',
    installGuide: 'brew install ollama',
    patchNotesUrl: 'https://github.com/ollama/ollama/releases',
    requiresLogin: false,
    loginHelp: 'O Ollama não requer login na nuvem! Ele executa modelos 100% locais e offline na sua máquina.',
    models: [
      'llama3.3',
      'deepseek-r1',
      'qwen2.5-coder',
      'mistral-large',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos disponíveis do Ollama' },
      { command: '/show', description: 'Exibir parâmetros e arquitetura do modelo atual' },
      { command: '/set', description: 'Configurar variáveis (temperatura, system prompt)', usage: '/set [param] [val]' },
      { command: '/load', description: 'Carregar modelo na memória da GPU/CPU', usage: '/load [modelo]' },
      { command: '/save', description: 'Salvar modelo com configurações personalizadas', usage: '/save [nome]' },
      { command: '/clear', description: 'Limpar contexto da sessão local atual' },
      { command: '/bye', description: 'Encerrar a sessão interativa do Ollama' },
    ],
  },
];

export const formatModelDisplayName = (modelStr?: string | null): string => {
  if (!modelStr) return '';
  const s = modelStr.trim();
  const lower = s.toLowerCase();

  // Gemini / Antigravity Flash & Pro models
  if (lower === 'gemini-3.8-flash-high' || lower === 'flash 3.8 (high)') return 'Flash 3.8 (High)';
  if (lower === 'gemini-3.8-flash-medium' || lower === 'flash 3.8 (medium)') return 'Flash 3.8 (Medium)';
  if (lower === 'gemini-3.8-flash-low' || lower === 'flash 3.8 (low)') return 'Flash 3.8 (Low)';
  if (lower === 'gemini-3.7-flash-high' || lower === 'flash 3.7 (high)') return 'Flash 3.7 (High)';
  if (lower === 'gemini-3.7-flash-medium' || lower === 'flash 3.7 (medium)') return 'Flash 3.7 (Medium)';
  if (lower === 'gemini-3.7-flash-low' || lower === 'flash 3.7 (low)') return 'Flash 3.7 (Low)';
  if (lower === 'gemini-3.6-flash-high' || lower === 'flash 3.6 (high)') return 'Flash 3.6 (High)';
  if (lower === 'gemini-3.1-pro-high' || lower === 'pro 3.1 (high)') return 'Pro 3.1 (High)';
  if (lower === 'gemini-3.1-pro-low' || lower === 'pro 3.1 (low)') return 'Pro 3.1 (Low)';
  if (lower === 'claude-sonnet-4-6') return 'Sonnet 4.6';
  if (lower === 'claude-opus-4-6-thinking') return 'Opus 4.6 (Thinking)';
  if (lower === 'gpt-oss-120b-medium') return 'GPT-OSS 120B';

  return s;
};

export interface AiQuotaConfig {
  dailyPercent: number;
  weeklyPercent: number;
  dailyResetTime: string;
  weeklyResetDay: string;
  weeklyResetTime: string;
}

export const DEFAULT_AI_QUOTAS: Record<string, AiQuotaConfig> = {
  claude: {
    dailyPercent: 100,
    weeklyPercent: 84,
    dailyResetTime: 'Hoje às 22:49 (em 5h)',
    weeklyResetDay: 'Sexta-feira',
    weeklyResetTime: 'Sexta-feira (18/09) às 13:26 (em 19h 30min)',
  },
  antigravity: {
    dailyPercent: 62,
    weeklyPercent: 92,
    dailyResetTime: 'Hoje às 18:04 (em 15min)',
    weeklyResetDay: 'Quarta-feira',
    weeklyResetTime: 'Quarta-feira (23/09) às 08:32 (em 5d 14h)',
  },
  codex: {
    dailyPercent: 100,
    weeklyPercent: 84,
    dailyResetTime: 'Hoje às 22:49 (em 5h)',
    weeklyResetDay: 'Sexta-feira',
    weeklyResetTime: 'Sexta-feira (18/09) às 13:26 (em 19h 30min)',
  },
  gemini: {
    dailyPercent: 62,
    weeklyPercent: 92,
    dailyResetTime: 'Hoje às 18:04 (em 15min)',
    weeklyResetDay: 'Quarta-feira',
    weeklyResetTime: 'Quarta-feira (23/09) às 08:32 (em 5d 14h)',
  },
  ollama: {
    dailyPercent: 100,
    weeklyPercent: 100,
    dailyResetTime: 'Ilimitado (Local)',
    weeklyResetDay: 'Ilimitado',
    weeklyResetTime: 'Sem limites',
  },
};
