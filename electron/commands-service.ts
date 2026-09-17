import * as path from 'node:path';
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { app } from 'electron';

const pty = require('node-pty');

export interface AiSlashCommand {
  command: string;
  description: string;
  usage?: string;
}

interface CacheEntry {
  mtime: number;
  timestamp: number;
  commands: AiSlashCommand[];
}

export class NativeCommandsService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheFilePath: string;

  constructor() {
    const userData = app?.getPath ? app.getPath('userData') : (process.env.HOME || '');
    this.cacheFilePath = path.join(userData, 'cli_commands_cache.json');
    this.loadDiskCache();
  }

  private loadDiskCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.cache.set(k, v as CacheEntry);
        }
      }
    } catch {}
  }

  private saveDiskCache() {
    try {
      const obj: Record<string, CacheEntry> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch {}
  }

  public resolveBinaryPath(bin: string): { path: string | null; mtime: number } {
    const userHome = process.env.HOME || '';
    const candidates = [
      path.join(userHome, '.local/bin', bin),
      path.join(userHome, '.bun/bin', bin),
      path.join(userHome, '.cargo/bin', bin),
      `/opt/homebrew/bin/${bin}`,
      `/usr/local/bin/${bin}`,
      `/usr/bin/${bin}`,
      `/bin/${bin}`,
    ];

    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          const stats = fs.statSync(c);
          return { path: c, mtime: stats.mtimeMs };
        }
      } catch {}
    }

    return { path: null, mtime: 0 };
  }

  public async getCommands(providerId: string): Promise<AiSlashCommand[]> {
    if (providerId === 'claude') {
      return this.getClaudeCommands();
    } else if (providerId === 'antigravity') {
      return this.getAntigravityCommands();
    } else if (providerId === 'codex') {
      return this.getCodexCommands();
    } else if (providerId === 'gemini') {
      return this.getGeminiCommands();
    } else if (providerId === 'ollama') {
      return this.getOllamaCommands();
    }
    return [];
  }

  private getDefaultClaudeCommands(): AiSlashCommand[] {
    return [
      { command: '/help', description: 'Show help and available commands' },
      { command: '/model', description: 'Select model or configure thinking mode', usage: '/model [name]' },
      { command: '/cost', description: 'Show cost and token usage for current session' },
      { command: '/clear', description: 'Start a new session with empty context' },
      { command: '/compact', description: 'Free up context by summarizing conversation so far' },
      { command: '/doctor', description: 'Health-check your Claude Code setup and fix issues' },
      { command: '/config', description: 'Open settings and customize configuration' },
      { command: '/init', description: 'Initialize project with CLAUDE.md guidelines' },
      { command: '/review', description: 'Review diff and changes in current project' },
      { command: '/pr', description: 'Create a GitHub Pull Request with current changes' },
      { command: '/bug', description: 'Report a bug or share feedback directly with Anthropic' },
      { command: '/login', description: 'Authenticate with your Anthropic account' },
      { command: '/run', description: 'Launch and drive this project app to see a change working' },
      { command: '/add-dir', description: 'Add a new working directory to context' },
      { command: '/advisor', description: 'Let Claude consult a stronger model at key moments' },
      { command: '/agents', description: 'Create and manage background subagents' },
      { command: '/context', description: 'Visualize current context usage as a colored grid' },
      { command: '/memory', description: 'Edit Claude memory and project instructions' },
      { command: '/permissions', description: 'Manage tool permissions and execution policies' },
      { command: '/terminal-setup', description: 'Configure terminal integration and shortcuts' },
      { command: '/vim', description: 'Toggle Vim keybindings mode' },
    ];
  }

  private async getClaudeCommands(): Promise<AiSlashCommand[]> {
    const { path: binPath, mtime } = this.resolveBinaryPath('claude');
    if (!binPath) {
      return this.getDefaultClaudeCommands();
    }

    const cached = this.cache.get('claude');
    // If binary mtime hasn't changed, return cached commands
    if (cached && cached.mtime === mtime && cached.commands?.length > 0) {
      return cached.commands;
    }

    try {
      const liveCommands = await this.extractLiveClaudeCommands(binPath);
      if (liveCommands && liveCommands.length > 0) {
        this.cache.set('claude', {
          mtime,
          timestamp: Date.now(),
          commands: liveCommands,
        });
        this.saveDiskCache();
        return liveCommands;
      }
    } catch (err) {
      console.warn('[CommandsService] Failed to extract live claude commands:', err);
    }

    return cached?.commands || this.getDefaultClaudeCommands();
  }

  private extractLiveClaudeCommands(binPath: string): Promise<AiSlashCommand[]> {
    return new Promise((resolve) => {
      let resolved = false;
      let fullOutput = '';
      let state = 0;

      const p = pty.spawn(binPath, [], {
        name: 'xterm-256color',
        cols: 160,
        rows: 80,
        cwd: process.cwd(),
        env: { ...process.env, CI: '1' },
      });

      const finish = () => {
        if (resolved) return;
        resolved = true;
        try { p.kill(); } catch {}

        const clean = fullOutput.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ' ');
        const regex = /(\/[a-z0-9_-]+)\s{2,}(.+?)(?=\s{2,}\/[a-z0-9_-]+|$)/g;
        let m;
        const list: AiSlashCommand[] = [];
        while ((m = regex.exec(clean)) !== null) {
          const cmd = m[1];
          const desc = m[2].trim();
          if (cmd.length >= 3 && desc.length >= 3 && !cmd.includes('http') && cmd !== '/overview') {
            if (!list.some((x) => x.command === cmd)) {
              list.push({ command: cmd, description: desc.slice(0, 120) });
            }
          }
        }

        // Fallback merge with defaults if list is small
        const defaults = this.getDefaultClaudeCommands();
        for (const def of defaults) {
          if (!list.some((x) => x.command === def.command)) {
            list.push(def);
          }
        }

        list.sort((a, b) => a.command.localeCompare(b.command));
        resolve(list);
      };

      p.onData((data: string) => {
        fullOutput += data;
        if (state === 0 && (data.includes('❯') || data.includes('>'))) {
          state = 1;
          p.write('/help\r');
        } else if (state === 1 && fullOutput.includes('General')) {
          state = 2;
          setTimeout(() => p.write('\t'), 300); // Switch to Commands tab
          setTimeout(() => p.write('\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B'), 600); // Scroll down
          setTimeout(() => p.write('\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B\x1b[B'), 900); // Scroll down more
          setTimeout(() => finish(), 1800);
        }
      });

      // Safety timeout of 2.5s
      setTimeout(() => finish(), 2500);
    });
  }

  private async getAntigravityCommands(): Promise<AiSlashCommand[]> {
    const { path: binPath, mtime } = this.resolveBinaryPath('agy');
    const cached = this.cache.get('antigravity');
    if (cached && cached.mtime === mtime && cached.commands?.length > 0) {
      return cached.commands;
    }

    const list: AiSlashCommand[] = [];

    // Core Antigravity workflow commands
    const coreWorkflows: AiSlashCommand[] = [
      { command: '/goal', description: 'Executar tarefa autônoma de ponta a ponta até atingir o objetivo', usage: '/goal [objetivo]' },
      { command: '/plan', description: 'Criar plano detalhado de implementação e arquitetura antes de executar', usage: '/plan [tarefa]' },
      { command: '/grill-me', description: 'Entrevista técnica interativa para refinar decisões de design e requisitos' },
      { command: '/schedule', description: 'Agendar timer ou rotina cron periódica em segundo plano', usage: '/schedule [tempo]' },
      { command: '/learn', description: 'Registrar aprendizado e diretrizes para novas tarefas' },
      { command: '/browser', description: 'Invocar subagente autônomo com navegação e gravação web' },
      { command: '/subagents', description: 'Listar e gerenciar subagentes especialistas em segundo plano' },
      { command: '/status', description: 'Verificar status das tarefas ativas em segundo plano' },
      { command: '/clear', description: 'Limpar contexto e reiniciar agente' },
    ];
    list.push(...coreWorkflows);

    // Live query from agy -p "/help"
    // Live query from agy -p "/help"
    if (binPath) {
      try {
        const out = await new Promise<string>((resolve) => {
          exec(`${binPath} -p "/help"`, { encoding: 'utf8', timeout: 3000 }, (_err, stdout) => {
            resolve(stdout ? stdout.toString() : '');
          });
        });
        if (out) {
          const lines = out.split('\n');
          for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 2 && parts[0].startsWith('/')) {
              const rawCmd = parts[0].trim();
              const desc = parts.slice(1).join('\t').trim();
              const cleanCmd = rawCmd.split(' ')[0];
              const alias = rawCmd.includes('(') ? rawCmd : undefined;

              if (!list.some((c) => c.command === cleanCmd)) {
                list.push({
                  command: cleanCmd,
                  description: desc,
                  usage: alias,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[CommandsService] Failed to query agy -p /help:', err);
      }
    }

    // Scan builtin skills
    const userHome = process.env.HOME || '';
    const skillDirs = [
      path.join(userHome, '.gemini/antigravity-ide/builtin/skills'),
      path.join(process.cwd(), '.agents/skills'),
    ];

    for (const dir of skillDirs) {
      try {
        if (fs.existsSync(dir)) {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const skillFile = path.join(dir, item, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
              const cmdName = `/${item}`;
              if (!list.some((c) => c.command === cmdName)) {
                let desc = `Skill especializada: ${item}`;
                try {
                  const content = fs.readFileSync(skillFile, 'utf8');
                  const m = content.match(/description:\s*["']?([^"'\n]+)/i);
                  if (m) desc = m[1].trim();
                } catch {}
                list.push({ command: cmdName, description: desc });
              }
            }
          }
        }
      } catch {}
    }

    list.sort((a, b) => a.command.localeCompare(b.command));

    this.cache.set('antigravity', {
      mtime,
      timestamp: Date.now(),
      commands: list,
    });
    this.saveDiskCache();
    return list;
  }

  private async getCodexCommands(): Promise<AiSlashCommand[]> {
    const { path: binPath, mtime } = this.resolveBinaryPath('codex');
    const cached = this.cache.get('codex');
    if (cached && cached.mtime === mtime && cached.commands?.length > 0) {
      return cached.commands;
    }

    const list: AiSlashCommand[] = [
      { command: '/help', description: 'Exibir comandos e opções do Codex CLI' },
      { command: '/model', description: 'Alternar modelo OpenAI (GPT-4o, o3-mini, o1)', usage: '/model [nome]' },
      { command: '/clear', description: 'Resetar histórico e contexto da sessão' },
      { command: '/review', description: 'Revisão profunda de código com recomendações' },
      { command: '/diff', description: 'Visualizar diff de alterações locais no repositório' },
      { command: '/test', description: 'Gerar e rodar suíte de testes unitários' },
      { command: '/exec', description: 'Executar comando no shell local e analisar saída', usage: '/exec [cmd]' },
      { command: '/login', description: 'Configurar chave OPENAI_API_KEY ou autenticação' },
    ];

    if (binPath) {
      try {
        const out = await new Promise<string>((resolve) => {
          exec(`${binPath} --help`, { encoding: 'utf8', timeout: 2000 }, (_err, stdout) => {
            resolve(stdout ? stdout.toString() : '');
          });
        });
        if (out) {
          const lines = out.split('\n');
          for (const l of lines) {
            const m = l.match(/^\s*([a-z0-9_-]+)\s{2,}(.+)$/i);
            if (m && !m[1].startsWith('-')) {
              const cmd = `/${m[1].toLowerCase()}`;
              if (!list.some((c) => c.command === cmd)) {
                list.push({ command: cmd, description: m[2].trim() });
              }
            }
          }
        }
      } catch {}
    }

    this.cache.set('codex', { mtime, timestamp: Date.now(), commands: list });
    this.saveDiskCache();
    return list;
  }

  private async getGeminiCommands(): Promise<AiSlashCommand[]> {
    const { path: binPath, mtime } = this.resolveBinaryPath('gemini');
    const cached = this.cache.get('gemini');
    if (cached && cached.mtime === mtime && cached.commands?.length > 0) {
      return cached.commands;
    }

    const list: AiSlashCommand[] = [
      { command: '/help', description: 'Exibir opções e ajuda do Gemini CLI' },
      { command: '/model', description: 'Alternar modelo Gemini (2.5 Pro, Flash, etc)', usage: '/model [nome]' },
      { command: '/clear', description: 'Limpar histórico e contexto da sessão' },
      { command: '/analyze', description: 'Análise detalhada do repositório e dependências' },
      { command: '/tokens', description: 'Exibir contagem de tokens e quotas da sessão' },
      { command: '/system', description: 'Definir instrução de sistema para o agente', usage: '/system [texto]' },
      { command: '/auth', description: 'Gerenciar autenticação com conta Google ou API key' },
    ];

    this.cache.set('gemini', { mtime, timestamp: Date.now(), commands: list });
    this.saveDiskCache();
    return list;
  }

  private async getOllamaCommands(): Promise<AiSlashCommand[]> {
    const { path: binPath, mtime } = this.resolveBinaryPath('ollama');
    const cached = this.cache.get('ollama');
    if (cached && cached.mtime === mtime && cached.commands?.length > 0) {
      return cached.commands;
    }

    const list: AiSlashCommand[] = [
      { command: '/help', description: 'Exibir comandos disponíveis do Ollama' },
      { command: '/show', description: 'Exibir parâmetros e arquitetura do modelo atual' },
      { command: '/set', description: 'Configurar variáveis (temperatura, system prompt)', usage: '/set [param] [val]' },
      { command: '/load', description: 'Carregar modelo na memória da GPU/CPU', usage: '/load [modelo]' },
      { command: '/save', description: 'Salvar modelo com configurações personalizadas', usage: '/save [nome]' },
      { command: '/clear', description: 'Limpar contexto da sessão local atual' },
      { command: '/bye', description: 'Encerrar a sessão interativa do Ollama' },
    ];

    if (binPath) {
      try {
        const out = await new Promise<string>((resolve) => {
          exec(`${binPath} --help`, { encoding: 'utf8', timeout: 2000 }, (_err, stdout) => {
            resolve(stdout ? stdout.toString() : '');
          });
        });
        if (out) {
          const lines = out.split('\n');
          for (const l of lines) {
            const m = l.match(/^\s{2}([a-z0-9_-]+)\s{2,}(.+)$/i);
            if (m && !m[1].startsWith('-')) {
              const cmd = `/${m[1].toLowerCase()}`;
              if (!list.some((c) => c.command === cmd)) {
                list.push({ command: cmd, description: m[2].trim() });
              }
            }
          }
        }
      } catch {}
    }

    this.cache.set('ollama', { mtime, timestamp: Date.now(), commands: list });
    this.saveDiskCache();
    return list;
  }
}
