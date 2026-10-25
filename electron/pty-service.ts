import { BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as https from 'node:https';
import { execSync, exec } from 'node:child_process';
import { skillsService } from './skills-service';
import { ensureClaudeWorkspaceTrust, normalizeClaudeModel, resolveBinaryPath, stripTerminalControl } from './env-utils';

const pty = require('node-pty');

const ZSH_SYNTAX_HIGHLIGHTING_VERSION = '0.8.0';

function downloadAndExtractGithubTag(repo: string, tag: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://github.com/${repo}/archive/refs/tags/${tag}.tar.gz`;
    const tmpTar = path.join(os.tmpdir(), `devflow-${Date.now()}.tar.gz`);

    const download = (u: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Muitos redirecionamentos'));
        return;
      }
      https
        .get(u, { headers: { 'User-Agent': 'devflow-desktop' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            download(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download falhou: HTTP ${res.statusCode}`));
            return;
          }
          const fileStream = fs.createWriteStream(tmpTar);
          res.pipe(fileStream);
          fileStream.on('finish', () =>
            fileStream.close(() => {
              fs.mkdirSync(destDir, { recursive: true });
              exec(`tar -xzf "${tmpTar}" -C "${destDir}" --strip-components=1`, (err) => {
                try {
                  fs.unlinkSync(tmpTar);
                } catch {}
                if (err) reject(err);
                else resolve();
              });
            })
          );
          fileStream.on('error', reject);
          res.on('error', reject);
        })
        .on('error', reject);
    };

    download(url);
  });
}

/** Aspas simples para o shell: `'` vira `'\\''` (nome de pasta/modelo com `"`, `$()` ou crase não executa nada). */
const shq = (v: string) => `'${String(v).replace(/'/g, `'\\''`)}'`;

/** duração mínima de uma tarefa (Enter → silêncio) para avisar que a IA terminou */
const MIN_TURN_MS = 4000;
/** linhas de moldura do TUI das CLIs (rodapé, spinner, banner) que não dizem nada no resumo */
const TUI_CHROME = /bypass permissions|esc to interrupt|to manage|shift\+tab|ctrl\+[a-z]|Checking for updates|for shortcuts|auto-update|^\s*[·✻✽✶✳*]\s.*(…|\.\.\.|tokens)|^\s*[▸▶⏵]+\s/i;

export interface NativePtySession {
  id: string;
  type: string;
  title: string;
  cwd: string;
  term: any;
  buffer: string[];
  /** a CLI está na tela alternativa (TUI de tela cheia): o histórico reproduzido precisa começar do último reset de tela */
  inAlt?: boolean;
  isAi: boolean;
  isRunning: boolean;
  lastActivity: number;
  createdAt: number;
  completionTimer?: any;
  reused?: boolean;
  /** CLI de IA rodando dentro de um shell (ex.: `claude` digitado no zsh), detectada pela árvore de processos */
  aiProvider?: string | null;
  aiCheckedAt?: number;
  /** quando o usuário (ou a orquestração) enviou um prompt com Enter; só uma tarefa assim gera o aviso de "IA terminou" */
  turnStartedAt?: number;
  /** nº de ordem da saída: a tela que reabre lê o histórico e descarta o que já veio nele */
  seq?: number;
}

/** O spawn-helper do node-pty precisa de permissão de execução: instalações e empacotamentos às vezes o deixam sem ela ("posix_spawnp failed", terminal em branco) */
function ensureSpawnHelperExecutable(): void {
  try {
    const pkgDir = path.dirname(require.resolve('node-pty/package.json')).replace('app.asar', 'app.asar.unpacked').replace('node_modules.asar', 'node_modules.asar.unpacked');
    const candidates = [path.join(pkgDir, 'build', 'Release', 'spawn-helper'), path.join(pkgDir, 'build', 'Debug', 'spawn-helper'), path.join(pkgDir, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper')];
    for (const file of candidates) {
      if (fs.existsSync(file) && (fs.statSync(file).mode & 0o111) === 0) fs.chmodSync(file, 0o755);
    }
  } catch (err) {
    console.warn('[Native PTY] Could not ensure spawn-helper permissions:', err);
  }
}
ensureSpawnHelperExecutable();

export class NativePtyService extends EventEmitter {
  private sessions: Map<string, NativePtySession> = new Map();
  private sessionHistories: Map<string, string[]> = new Map();
  private claudeBinPath: string;
  private agyBinPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    // app aberto pelo Finder tem PATH mínimo (`which` não acha nada): procura nas pastas conhecidas
    this.claudeBinPath = resolveBinaryPath('claude');
    const agy = resolveBinaryPath('agy');
    this.agyBinPath = path.isAbsolute(agy) && fs.existsSync(agy) ? agy : null;

    this.ensureAgyAutoApproveSettings();
    console.log(`[Native PTY] Claude at: ${this.claudeBinPath}`);
    console.log(`[Native PTY] AGY at: ${this.agyBinPath || 'nao encontrado'}`);
  }

  private currentAccentColor: string = '#FF6A00';
  private lastZshInitColor: string | null = null;
  private zshInitDir = path.join(os.homedir(), '.devflow', 'zsh-init');
  private syntaxHighlightingDir = path.join(this.zshInitDir, 'plugins', 'zsh-syntax-highlighting');
  private syntaxHighlightingDownloadStarted = false;
  private shimDir = path.join(os.homedir(), '.devflow', 'browser-shims');

  // Shims que desviam "abrir URL" (open <url>, $BROWSER) para o card de navegador da orquestração:
  // escrevem uma sequência OSC 7777 no terminal da sessão, que o xterm do card intercepta.
  // Sem terminal controlador (processo desanexado), caem no `open` real do macOS.
  private ensureBrowserShims(): string {
    try {
      fs.mkdirSync(this.shimDir, { recursive: true });
      const browserScript = [
        '#!/bin/sh',
        '# Auto-generated by DevFlow IDE: roteia URL para terminal capturar no componente de navegador.',
        'url="$1"',
        'if [ -n "$url" ]; then',
        '  printf \'\\033]7777;open-url;%s\\007\' "$url" > /dev/tty 2>/dev/null || printf \'\\033]7777;open-url;%s\\007\' "$url" 2>/dev/null || true',
        '  exit 0',
        'fi',
        'exit 0',
        '',
      ].join('\n');
      const openScript = [
        '#!/bin/sh',
        '# Auto-generated by DevFlow IDE: intercepta URLs para nunca abrir navegador externo.',
        'for arg in "$@"; do',
        '  case "$arg" in',
        '    http://*|https://*)',
        '      exec "$(dirname "$0")/devflow-browser" "$arg"',
        '      ;;',
        '  esac',
        'done',
        'exec /usr/bin/open "$@"',
        '',
      ].join('\n');
      const write = (name: string, content: string) => {
        const target = path.join(this.shimDir, name);
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
          fs.writeFileSync(target, content, { encoding: 'utf8', mode: 0o755 });
        }
        fs.chmodSync(target, 0o755);
      };
      write('devflow-browser', browserScript);
      write('open', openScript);
    } catch (err) {
      console.warn('[Native PTY] Failed to write browser shims:', err);
    }
    return this.shimDir;
  }

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setAccentColor(accentColor: string) {
    if (!accentColor) return;
    this.currentAccentColor = accentColor;
    // o prompt do zsh lê a cor deste arquivo: terminais já abertos mudam na hora (sem esperar o próximo Enter)
    if (/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      try {
        fs.mkdirSync(this.zshInitDir, { recursive: true });
        fs.writeFileSync(path.join(this.zshInitDir, 'accent'), accentColor, 'utf8');
        for (const session of this.sessions.values()) {
          // sequência ligada no .zshrc ao widget que relê a cor e redesenha o prompt; só em shell parado no prompt
          if (session.term && this.isShellIdle(session)) session.term.write('\x1b[9999~');
        }
      } catch {}
    }
  }

  // Verifica se a sessão é um shell puro ocioso (sem CLI interativo tipo agy/claude ou comando em foreground)
  private isShellIdle(session: NativePtySession): boolean {
    if (!session || !session.term) return false;
    if (session.isAi) return false;
    const termType = (session.type || '').toLowerCase();
    if (termType !== 'zsh' && termType !== 'bash') return false;

    // Checa o nome do processo em foreground informado pelo node-pty
    const proc = (session.term.process || '').toLowerCase().trim();
    const baseProc = proc.split('/').pop() || '';
    if (baseProc && baseProc !== 'zsh' && baseProc !== '-zsh' && baseProc !== 'bash' && baseProc !== '-bash') {
      return false;
    }

    // Checa se o shell possui processos filhos rodando em foreground (ex: agy, claude, bun, node, etc.)
    if (session.term.pid) {
      try {
        const children = execSync(`pgrep -P ${session.term.pid}`, {
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf8',
        }).trim();
        if (children.length > 0) {
          return false;
        }
      } catch {
        // Código de saída 1 indica nenhum filho -> shell está ocioso no prompt
      }
    }

    return true;
  }

  // Fetches the (small, BSD-licensed) zsh-syntax-highlighting plugin once and caches it, so
  // typed commands get live color feedback (valid command -> green, unknown -> red, etc.),
  // matching what VS Code/Antigravity's terminal shows when that plugin is present. Runs in
  // the background; the colored prompt works fine on its own while this is still downloading.
  private ensureSyntaxHighlightingPlugin() {
    const entry = path.join(this.syntaxHighlightingDir, 'zsh-syntax-highlighting.zsh');
    if (this.syntaxHighlightingDownloadStarted || fs.existsSync(entry)) return;
    this.syntaxHighlightingDownloadStarted = true;
    downloadAndExtractGithubTag('zsh-users/zsh-syntax-highlighting', ZSH_SYNTAX_HIGHLIGHTING_VERSION, this.syntaxHighlightingDir)
      .then(() => console.log('[Native PTY] zsh-syntax-highlighting installed'))
      .catch((err) => {
        console.warn('[Native PTY] Failed to fetch zsh-syntax-highlighting (prompt colors still work):', err);
        this.syntaxHighlightingDownloadStarted = false;
      });
  }

  // Gives our embedded zsh sessions a colored prompt (like VS Code/Antigravity's integrated
  // terminal), without touching the user's own ~/.zshrc. Uses a custom ZDOTDIR whose .zshrc
  // sources the user's real one first (so aliases/tools/exports keep working), then overrides
  // PROMPT with a truecolor version of the app's accent color, then sources live command
  // syntax highlighting if it's been downloaded. Regenerated only when the accent color changes.
  private ensureAgyAutoApproveSettings(): void {
    try {
      const settingsPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      let current: Record<string, any> = {};
      if (fs.existsSync(settingsPath)) {
        try {
          current = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
        } catch {
          current = {};
        }
      }
      const requiredAllow = [
        'command',
        'command(*)',
        'command(regex:.*)',
        'read_file',
        'read_file(*)',
        'read_file(regex:.*)',
        'write_file',
        'write_file(*)',
        'write_file(regex:.*)',
        'read_url',
        'read_url(*)',
        'mcp',
        'mcp(*)',
      ];
      const existingAllow = Array.isArray(current?.permissions?.allow) ? current.permissions.allow : [];
      const mergedAllow = Array.from(new Set([...requiredAllow, ...existingAllow]));
      const needsWrite =
        requiredAllow.some((r) => !existingAllow.includes(r)) ||
        (Array.isArray(current?.permissions?.ask) && current.permissions.ask.length > 0);
      if (needsWrite) {
        current.permissions = {
          ...(current.permissions || {}),
          allow: mergedAllow,
          ask: [],
          deny: Array.isArray(current?.permissions?.deny) ? current.permissions.deny : [],
        };
        fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
      }
    } catch {}
  }

  private ensureColoredZshInit(): string {
    this.ensureSyntaxHighlightingPlugin();
    this.ensureAgyAutoApproveSettings();
    const color = /^#[0-9a-fA-F]{6}$/.test(this.currentAccentColor) ? this.currentAccentColor : '#FF6A00';
    const rcPath = path.join(this.zshInitDir, '.zshrc');
    if (
      this.lastZshInitColor === color &&
      fs.existsSync(rcPath) &&
      fs.readFileSync(rcPath, 'utf8').includes('DEVFLOW_ZSH_PROMPT_V6')
    ) {
      return this.zshInitDir;
    }
    try {
      fs.mkdirSync(this.zshInitDir, { recursive: true });
      const highlightEntry = path.join(this.syntaxHighlightingDir, 'zsh-syntax-highlighting.zsh');
      const rc = [
        '# Auto-generated by DevFlow IDE — do not edit, regenerated on accent color change.',
        '# DEVFLOW_ZSH_PROMPT_V6',
        '[ -f "$DEVFLOW_REAL_HOME/.zshrc" ] && ZDOTDIR="$DEVFLOW_REAL_HOME" source "$DEVFLOW_REAL_HOME/.zshrc"',
        '[ -n "$DEVFLOW_INITIAL_CWD" ] && [ -d "$DEVFLOW_INITIAL_CWD" ] && cd "$DEVFLOW_INITIAL_CWD"',
        // O login shell (path_helper) e o .zshrc do usuário reordenam o PATH; recoloca os shims na frente.
        '[ -n "$DEVFLOW_SHIM_DIR" ] && export PATH="$DEVFLOW_SHIM_DIR:$PATH"',
        // Garantir que agy e claude chamados manualmente no terminal rodem sem pedir confirmacao de permissao
        'alias agy="agy --dangerously-skip-permissions"',
        'alias claude="claude --dangerously-skip-permissions"',
        'stty erase "^?" 2>/dev/null || true',
        // Garantir que Backspace e Delete sempre funcionem no ZSH do terminal embutido
        'bindkey "^?" backward-delete-char 2>/dev/null || true',
        'bindkey "^H" backward-delete-char 2>/dev/null || true',
        'bindkey "^W" backward-kill-word 2>/dev/null || true',
        'bindkey "^U" backward-kill-line 2>/dev/null || true',
        'bindkey "\\e[3~" delete-char 2>/dev/null || true',
        // Sequências não imprimíveis e cores DEVEM estar entre %{ e %} para que o ZLE conte exatamente 0 colunas e não deixe sobras ao apagar
        // A cor vem de um arquivo relido a cada prompt (e quando o app muda o destaque): mudar o tema atualiza os terminais abertos.
        `DEVFLOW_ACCENT_FILE="${path.join(this.zshInitDir, 'accent')}"`,
        `DEVFLOW_ACCENT="${color}"`,
        '_devflow_read_accent() { local c; [ -r "$DEVFLOW_ACCENT_FILE" ] && c="$(<"$DEVFLOW_ACCENT_FILE")" && [[ "$c" =~ \'^#[0-9a-fA-F]{6}$\' ]] && DEVFLOW_ACCENT="$c"; }',
        '_devflow_read_accent',
        'autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook precmd _devflow_read_accent',
        'setopt prompt_subst',
        // Avisa o app (sequência invisível) com o código de saída de cada comando: o botão de play usa isso para mostrar o erro.
        '_devflow_emit_exit() { local ec=$?; print -n "\\e]777;devflow-exit;${ec}\\a" }',
        'precmd_functions=(_devflow_emit_exit $precmd_functions)',
        '_devflow_refresh_prompt() { _devflow_read_accent; zle reset-prompt 2>/dev/null }',
        'zle -N _devflow_refresh_prompt 2>/dev/null',
        `bindkey '^[[9999~' _devflow_refresh_prompt 2>/dev/null || true`,
        // O hostname do macOS pode vir corrompido da rede (bytes inválidos viram lixo no prompt): usa o nome local do Mac, só com ASCII seguro
        'DEVFLOW_HOST="$(scutil --get LocalHostName 2>/dev/null)"; DEVFLOW_HOST="${DEVFLOW_HOST//[^A-Za-z0-9._-]/}"; [ -z "$DEVFLOW_HOST" ] && DEVFLOW_HOST="mac"',
        `PROMPT='%{%F{242}%}%n@\${DEVFLOW_HOST}%{%f%} %{%B%F{\${DEVFLOW_ACCENT}}%}%~%{%f%b%} %{%F{\${DEVFLOW_ACCENT}}%}%#%{%f%} '`,
        // Sourced last, as recommended by the plugin (it wraps ZLE widgets already defined above).
        `[ -f "${highlightEntry}" ] && source "${highlightEntry}"`,
        '',
      ].join('\n');
      fs.writeFileSync(path.join(this.zshInitDir, '.zshrc'), rc, 'utf8');
      this.lastZshInitColor = color;
    } catch (err) {
      console.warn('[Native PTY] Failed to write colored zsh prompt init:', err);
    }
    return this.zshInitDir;
  }

  private isOrchCliSession(id: string): boolean {
    return id.startsWith('orch-cli-') || id.startsWith('orchestration-cli-');
  }

  createSession(
    id: string,
    type: 'zsh' | 'claude' | 'agy' | 'antigravity' | 'gemini' | 'ollama' | 'ai-stream' | 'custom' | string = 'zsh',
    cwd: string = process.cwd(),
    cols: number = 80,
    rows: number = 24,
    accentColor?: string,
    extraOptions?: { model?: string; prompt?: string }
  ): NativePtySession {
    this.ensureAgyAutoApproveSettings();
    if (accentColor) {
      this.currentAccentColor = accentColor;
    }
    const isOrchCli = this.isOrchCliSession(id);
    if (this.sessions.has(id)) {
      const existing = this.sessions.get(id)!;
      const newCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
      // CLI de IA da Orquestração não troca de diretório sozinha: se o projeto do nó mudou,
      // reinicia a sessão no novo diretório (senão ela continuaria editando o projeto antigo).
      // Sessão só de saída (relay/headless escreveram nela antes do terminal existir): abrir o CLI de verdade a substitui,
      // senão o "CLI" nunca iniciaria (reaproveitaria a sessão de mentira).
      if ((existing.type === 'ai-stream' && type !== 'ai-stream') || (isOrchCli && existing.type !== 'ai-stream' && existing.cwd !== newCwd)) {
        const history = existing.type === 'ai-stream' ? existing.buffer.slice() : [];
        this.kill(id);
        if (history.length) this.sessionHistories.set(id, history); // o buffer da sessão nova começa com o que já foi escrito
      } else {
      existing.reused = true;
      const cleanCwd = newCwd;
      if (cleanCwd && existing.cwd !== cleanCwd) {
        existing.cwd = cleanCwd;
        if (!isOrchCli && this.isShellIdle(existing)) {
          existing.term?.write(`cd ${shq(cleanCwd)}\r`);
        }
      }
      return existing;
      }
    }

    const cleanCwd = fs.existsSync(cwd) ? cwd : process.cwd();

    // Sessões de stream dedicado para agentes e modelos de IA do canvas
    if (type === 'ai-stream') {
      const mockTerm = {
        process: 'ai-stream',
        pid: 0,
        write: () => {},
        resize: () => {},
        kill: () => {},
        onData: () => {},
        onExit: () => {},
      };

      const session: NativePtySession = {
        id,
        type: 'ai-stream',
        title: 'Aura Dev IA CLI',
        cwd: cleanCwd,
        term: mockTerm,
        buffer: [],
        isAi: true,
        isRunning: false,
        lastActivity: Date.now(),
        createdAt: Date.now(),
        reused: false,
      };
      this.sessions.set(id, session);
      return session;
    }

    let file = '/bin/zsh';
    let args: string[] = ['-l'];
    let title = 'zsh';

    const userHome = process.env.HOME || '';
    const customPaths = [
      path.join(userHome, '.local/bin'),
      path.join(userHome, '.bun/bin'),
      path.join(userHome, '.cargo/bin'),
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      PATH: `${customPaths.join(':')}:${process.env.PATH || ''}`,
    };

    // Terminais da orquestração: URLs abertas por projetos/IA vão para o card de navegador conectado.
    if (isOrchCli) {
      const shimDir = this.ensureBrowserShims();
      env.DEVFLOW_SHIM_DIR = shimDir;
      env.BROWSER = path.join(shimDir, 'devflow-browser');
      env.PATH = `${shimDir}:${env.PATH}`;
    }

    if (type === 'claude') {
      // tela cheia (alt screen + scroll virtual) deixa a barra de rolagem do xterm sem efeito e quebra o visual ao reabrir a sessão
      env.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN = '1';
      // terminal de IA da Orquestração em pasta nova: sem isto o diálogo de confiança engole o prompt (e "Enter" = "Não, sair")
      if (isOrchCli) ensureClaudeWorkspaceTrust(cleanCwd);
      file = this.claudeBinPath;
      args = ['--dangerously-skip-permissions', ...skillsService.cliArgs('claude')];
      if (extraOptions?.model) {
        const norm = normalizeClaudeModel(extraOptions.model);
        if (norm) args.push('--model', norm);
      }
      title = 'Claude Code CLI';
    } else if (type === 'agy' || type === 'antigravity') {
      if (this.agyBinPath && fs.existsSync(this.agyBinPath)) {
        file = this.agyBinPath;
        args = ['--dangerously-skip-permissions', ...skillsService.cliArgs('agy')];
        if (cleanCwd && fs.existsSync(cleanCwd)) {
          args.push('--add-dir', cleanCwd);
        }
        if (extraOptions?.model) {
          args.push('--model', extraOptions.model);
        }
      } else {
        file = '/bin/zsh';
        args = ['-l', '-c', 'echo "Antigravity CLI (agy) nao encontrada. Instale a CLI ou ajuste o PATH."; exec zsh -l'];
      }
      title = 'Antigravity CLI (agy)';
    } else if (type === 'gemini') {
      file = '/bin/zsh';
      args = ['-l', '-c', extraOptions?.model ? `gemini --model ${shq(extraOptions.model)}` : 'gemini'];
      title = 'Gemini CLI';
    } else if (type === 'ollama') {
      file = '/bin/zsh';
      args = ['-l', '-c', `ollama run ${shq(extraOptions?.model || 'llama3')}`];
      title = 'Ollama CLI';
    } else if (type === 'codex') {
      const codexCandidates = [
        path.join(userHome, '.local/bin/codex'),
        path.join(userHome, '.bun/bin/codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
      ];
      const codexPath = codexCandidates.find((candidate) => fs.existsSync(candidate));
      if (codexPath) {
        file = codexPath;
        args = ['--dangerously-bypass-approvals-and-sandbox'];
        if (cleanCwd && fs.existsSync(cleanCwd)) {
          args.push('--cd', cleanCwd);
        }
        if (extraOptions?.model) {
          args.push('-m', extraOptions.model);
        }
      } else {
        file = '/bin/zsh';
        args = ['-l', '-c', 'codex'];
      }
      title = 'OpenAI Codex CLI';
    }

    // Give plain zsh sessions a colored prompt matching the app's accent color
    if (file === '/bin/zsh') {
      env.DEVFLOW_INITIAL_CWD = cleanCwd;
      env.ZDOTDIR = this.ensureColoredZshInit();
      env.DEVFLOW_REAL_HOME = userHome;
    }

    const term = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: Math.max(10, cols || 80),
      rows: Math.max(5, rows || 25),
      cwd: cleanCwd,
      env,
    });

    const isAi = ['claude', 'agy', 'antigravity', 'codex', 'gemini', 'ollama'].includes(type.toLowerCase());

    const session: NativePtySession = {
      id,
      type,
      title,
      cwd: cleanCwd,
      term,
      buffer: this.sessionHistories.has(id) ? [...(this.sessionHistories.get(id) || [])] : [],
      isAi,
      isRunning: false,
      lastActivity: Date.now(),
      createdAt: Date.now(),
      reused: false,
    };

    term.onData((data: string) => {
      if (session.buffer.length > 2000) session.buffer.shift();
      session.buffer.push(data);
      const altOn = data.lastIndexOf('\x1b[?1049h');
      const altOff = data.lastIndexOf('\x1b[?1049l');
      if (altOn >= 0 || altOff >= 0) session.inAlt = altOn > altOff;
      session.seq = (session.seq || 0) + 1;
      this.sessionHistories.set(id, session.buffer);
      session.lastActivity = Date.now();
      this.emit('session-data', { id, data });

      // CLI de IA aberta dentro de um shell comum: detecta (no máximo a cada 3s) para tratar como sessão de IA
      if (!session.isAi && Date.now() - (session.aiCheckedAt || 0) > 3000) {
        session.aiCheckedAt = Date.now();
        session.aiProvider = this.detectAiProvider(session);
      }
      if (session.isAi || session.aiProvider) {
        if (!session.isRunning) {
          session.isRunning = true;
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('pty:session-status', {
              id: session.id,
              type: session.type,
              cwd: session.cwd,
              isAi: true,
              isRunning: true,
            });
          }
        }

        if (session.completionTimer) {
          clearTimeout(session.completionTimer);
        }

        session.completionTimer = setTimeout(() => {
          if (session.isRunning) {
            session.isRunning = false;
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('pty:session-status', {
                id: session.id,
                type: session.type,
                cwd: session.cwd,
                isAi: true,
                isRunning: false,
              });

              // Clean text from ANSI escape codes and extract recent snippet
              const rawBuffer = session.buffer.slice(-30).join('');
              const stripped = this.stripAnsi(rawBuffer);
              const lines = stripped
                .split('\n')
                .map((l) => {
                  const parts = l.split('\r').map((p) => p.trim()).filter((p) => p.length > 0);
                  return parts.length > 0 ? parts[parts.length - 1] : '';
                })
                .filter((l) => l.length > 0)
                .filter((l, idx, arr) => idx === 0 || l !== arr[idx - 1]);
              const cleanText = lines.join('\n');
              const lastFew = lines
                .slice(-6)
                .filter((l) => !TUI_CHROME.test(l))
                .filter((l) => !l.startsWith('❯') && !l.startsWith('agy>') && !l.startsWith('╭') && !l.startsWith('╰') && !l.startsWith('│'));
              const summary = lastFew.join(' ').slice(0, 160) || 'Tarefa finalizada no terminal.';

              const projectName = path.basename(session.cwd) || 'Projeto';
              const payload = {
                id: session.id,
                type: session.aiProvider || session.type,
                cwd: session.cwd,
                projectName,
                summary,
                // A IA parou esperando o usuário (pergunta / confirmação) em vez de ter terminado
                needsInput: this.looksLikeQuestion(cleanText),
                timestamp: Date.now(),
              };
              this.emit('session-ai-completed', payload);
              // Só avisa a interface de uma tarefa de verdade: redesenho de prompt, banner ("Checking for updates") e rodapé do TUI também geram saída e antes viravam "a IA terminou"
              const realTurn = !!session.turnStartedAt && Date.now() - session.turnStartedAt >= MIN_TURN_MS;
              session.turnStartedAt = undefined;
              if (realTurn) this.mainWindow.webContents.send('pty:ai-completed', payload);
            }
          }
        }, 2200);
      }

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:data', { id, data, seq: session.seq });
      }
    });

    term.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      // a sessão deste id já foi trocada por outra (createSession matou e recriou): o fim do PTY antigo não pode apagar a nova
      if (this.sessions.get(id) !== session) return;
      console.log(`[Native PTY] ${id} exited (${exitCode})`);
      if (session.completionTimer) clearTimeout(session.completionTimer);
      this.emit('session-exit', { id, exitCode, signal });
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:session-status', {
          id,
          type: session.type,
          cwd: session.cwd,
          isAi: session.isAi,
          isRunning: false,
          exited: true,
        });
        this.mainWindow.webContents.send('pty:exit', { id, exitCode, signal });
      }
      this.sessions.delete(id);
    });

    this.sessions.set(id, session);
    console.log(`[Native PTY] Created session ${id} (${title}) in ${cleanCwd}`);
    return session;
  }

  // Foto da árvore de processos (compartilhada por 2s entre as sessões)
  private psCache: { at: number; children: Map<number, Array<{ pid: number; args: string }>> } | null = null;
  private psChildren() {
    if (this.psCache && Date.now() - this.psCache.at < 2000) return this.psCache.children;
    const children = new Map<number, Array<{ pid: number; args: string }>>();
    try {
      const out = execSync('ps -A -o pid=,ppid=,args=', { encoding: 'utf8', timeout: 1500, maxBuffer: 8 * 1024 * 1024 });
      for (const line of out.split('\n')) {
        const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        if (!m) continue;
        const ppid = Number(m[2]);
        if (!children.has(ppid)) children.set(ppid, []);
        children.get(ppid)!.push({ pid: Number(m[1]), args: m[3] });
      }
    } catch {}
    this.psCache = { at: Date.now(), children };
    return children;
  }

  // Procura uma CLI de IA entre os processos descendentes do shell da sessão
  private detectAiProvider(session: NativePtySession): string | null {
    const rootPid = session.term?.pid;
    if (!rootPid) return null;
    const children = this.psChildren();
    const queue = [rootPid];
    while (queue.length) {
      for (const c of children.get(queue.shift()!) || []) {
        const hit = c.args.match(/(?:^|[\s/])(claude|agy|antigravity|codex|gemini|ollama)(?:\s|$)/);
        if (hit) return hit[1];
        queue.push(c.pid);
      }
    }
    return null;
  }

  private looksLikeQuestion(text: string): boolean {
    const tail = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^Try "/.test(l) && !/^\?\s+for shortcuts/i.test(l))
      .slice(-14)
      .join('\n');
    return /\(y\/n\)|\[y\/n\]|do you want to|would you like|proceed\?|allow (?:this|once|always)|esc to cancel|❯\s*1\.|\b1\.\s*yes\b|deseja continuar|quer que eu|posso (?:prosseguir|continuar)|\?\s*$/im.test(tail);
  }

  private stripAnsi(t: string): string {
    return stripTerminalControl(t);
  }

  // Aguarda a TUI da CLI estar pronta: sem saída recente e com a caixa de entrada/rodapé visível.
  // (Digitar antes disso perde o prompt, e o fluxo acabava marcado como concluído sem a IA ter feito nada.)
  private async waitCliReady(session: NativePtySession, maxMs = 30000): Promise<void> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const age = Date.now() - (session.createdAt || 0);
      const quiet = Date.now() - (session.lastActivity || 0) > 900;
      const tail = this.stripAnsi(session.buffer.slice(-40).join(''));
      const hasInputBox = /for shortcuts|bypass permissions|\?\s+for|Try "|^\s*[>❯]\s*$/m.test(tail);
      if (age > 1400 && quiet && (hasInputBox || age > 12000)) return;
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Digita o prompt na caixa de texto da CLI e pressiona Enter. Retorna o instante do Enter.
  private async typeAndSubmit(session: NativePtySession, prompt: string): Promise<number> {
    const cleanPrompt = prompt.replace(/\r?\n/g, ' ').trim();
    const chunkSize = 150;
    for (let i = 0; i < cleanPrompt.length; i += chunkSize) {
      session.term.write(cleanPrompt.slice(i, i + chunkSize));
      if (cleanPrompt.length < 600) {
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    await new Promise((r) => setTimeout(r, 80));
    session.term.write('\r');
    session.turnStartedAt ||= Date.now();
    return Date.now();
  }

  // A IA realmente começou a trabalhar? O eco/redesenho do Enter acaba em ~300ms; um modelo pensando
  // continua emitindo saída (spinner, ferramentas) bem depois disso. Caixa de entrada parada = prompt perdido.
  private async confirmCliActivity(session: NativePtySession, since: number, maxMs: number): Promise<boolean> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if ((session.lastActivity || 0) > since + 1200) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  async writePrompt(id: string, prompt: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || !session.term) return false;
    await this.waitCliReady(session);
    await this.typeAndSubmit(session, prompt);
    return true;
  }

  runPromptInCli(
    id: string,
    prompt: string,
    timeoutMs: number = 300000
  ): Promise<{ response: string; error?: string; cancelled?: boolean }> {
    return new Promise(async (resolve) => {
      const session = this.sessions.get(id);
      if (!session || !session.term) {
        resolve({ response: '', error: 'Sessão PTY do CLI não encontrada.' });
        return;
      }

      session.isRunning = true;
      // Coleta a saída por evento (o buffer da sessão é circular e seus índices mudam)
      const chunks: string[] = [];
      let confirmed = false;
      let done = false;

      const onData = (payload: any) => {
        if (payload.id === id) chunks.push(payload.data);
      };
      const finish = (result: { response: string; error?: string; cancelled?: boolean }) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // Terminou (ou falhou): a sessão não pode ficar marcada como "gerando" para sempre
        if (session.completionTimer) clearTimeout(session.completionTimer);
        this.setRunning(id, false);
        this.removeListener('session-data', onData);
        this.removeListener('session-ai-completed', onCompletedListener);
        this.removeListener('session-exit', onExitListener);
        this.removeListener('prompt-cancel', onCancelListener);
        resolve(result);
      };
      const buildResponse = () => {
        const clean = this.stripAnsi(chunks.join('')).replace(/\r/g, '').trim();
        return { response: clean || 'Execução concluída no CLI.', cancelled: false };
      };

      const timer = setTimeout(() => finish(buildResponse()), timeoutMs);
      // Conclusão só vale depois que a IA comprovadamente recebeu o prompt (antes disso é a CLI parada)
      const onCompletedListener = (payload: any) => {
        if (payload.id === id && confirmed) finish(buildResponse());
      };
      const onExitListener = (payload: any) => {
        if (payload.id !== id) return;
        finish(
          confirmed
            ? buildResponse()
            : { response: '', error: 'O CLI da IA foi encerrado antes de processar o prompt.' }
        );
      };

      // Parar o fluxo: o await do nó termina agora (e não só quando a IA, talvez, avisar que acabou)
      const onCancelListener = (cancelId: string) => {
        if (cancelId === id) finish({ response: '', error: 'Execução cancelada pelo usuário.', cancelled: true });
      };

      this.on('session-data', onData);
      this.on('session-ai-completed', onCompletedListener);
      this.on('session-exit', onExitListener);
      this.on('prompt-cancel', onCancelListener);

      try {
        await this.waitCliReady(session);
        chunks.length = 0; // descarta banner/boot: a resposta é só o que vem depois do envio
        const submittedAt = await this.typeAndSubmit(session, prompt);
        confirmed = await this.confirmCliActivity(session, submittedAt, 8000);
        if (!confirmed && !done) {
          // O Enter pode ter sido engolido pela TUI: tenta uma vez mais
          session.term.write('\r');
          confirmed = await this.confirmCliActivity(session, Date.now(), 6000);
        }
        if (!confirmed) {
          finish({
            response: '',
            error: 'O CLI da IA não reagiu ao prompt enviado (a mensagem não foi recebida). Abra o CLI do nó e tente novamente.',
          });
          return;
        }
        if (Date.now() - (session.lastActivity || 0) > 2300) finish(buildResponse());
      } catch (err: any) {
        finish({ response: '', error: err?.message || 'Falha ao escrever no CLI.' });
      }
    });
  }

  /** Cancela o `runPromptInCli` em andamento nesta sessão (resolve com `cancelled: true`). */
  cancelPrompt(id: string): void {
    this.emit('prompt-cancel', id);
  }

  write(id: string, data: string) {
    const session = this.sessions.get(id);
    if (session && session.term) {
      if (/[\r\n]/.test(data) && (session.isAi || session.aiProvider)) session.turnStartedAt ||= Date.now();
      session.term.write(data);
    }
  }

  sendOutput(id: string, data: string) {
    let session = this.sessions.get(id);
    if (!session) {
      if (!this.isOrchCliSession(id)) return; // terminal que já foi fechado: não abre um zsh só para mostrar texto
      session = this.createSession(id, 'ai-stream', process.cwd());
    }
    if (session.buffer.length > 2000) session.buffer.shift();
    session.buffer.push(data);
    session.lastActivity = Date.now();
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pty:data', { id, data });
    }
  }

  setRunning(id: string, isRunning: boolean) {
    const session = this.sessions.get(id);
    if (!session) return;
    session.isRunning = isRunning;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('pty:session-status', {
        id: session.id,
        type: session.type,
        cwd: session.cwd,
        isAi: session.isAi,
        isRunning,
      });
    }
  }

  resize(id: string, cols: number, rows: number) {
    const session = this.sessions.get(id);
    if (session && session.term) {
      try {
        session.term.resize(Math.max(10, cols), Math.max(5, rows));
      } catch (err) {
        console.warn(`[Native PTY] Resize error:`, err);
      }
    }
  }

  /** Encerra todas as sessões (o app está saindo). */
  killAll() {
    for (const id of Array.from(this.sessions.keys())) {
      try { this.kill(id); } catch {}
    }
  }

  kill(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      if (session.completionTimer) clearTimeout(session.completionTimer);
      try {
        session.term.kill();
      } catch (err) {
        // ignore
      }
      this.sessions.delete(id);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:session-status', {
          id,
          type: session.type,
          cwd: session.cwd,
          isAi: session.isAi,
          isRunning: false,
          exited: true,
        });
      }
    }
  }

  /** Nome do processo em primeiro plano de cada terminal (ex.: "zsh", "agy", "claude") */
  getForegroundProcesses(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, session] of this.sessions) {
      try { out[id] = (session.term?.process || '').split('/').pop() || ''; } catch { out[id] = ''; }
    }
    return out;
  }

  getRunningSessions(): Array<{
    id: string;
    type: string;
    title: string;
    cwd: string;
    isAi: boolean;
    isRunning: boolean;
    projectName: string;
    lastActivity: number;
  }> {
    return Array.from(this.sessions.values()).map((s) => {
      // Shell comum com uma CLI de IA rodando dentro (claude, agy, codex...) conta como sessão de IA
      if (!s.isAi && s.term?.pid) s.aiProvider = this.detectAiProvider(s);
      const aiActive = s.isAi || Boolean(s.aiProvider);
      return {
        id: s.id,
        type: s.isAi ? s.type : s.aiProvider || s.type,
        title: s.title,
        cwd: s.cwd,
        isAi: aiActive,
        // "Gerando" só vale com saída recente (a TUI emite spinner enquanto pensa); flag antiga não fica presa
        isRunning: aiActive ? s.isRunning && Date.now() - (s.lastActivity || 0) < 8000 : s.isRunning,
        projectName: path.basename(s.cwd) || 'Projeto',
        lastActivity: s.lastActivity || 0,
      };
    });
  }

  getHistoryWithSeq(id: string): { history: string; seq: number } {
    return { history: this.getHistory(id), seq: this.sessions.get(id)?.seq || 0 };
  }

  getHistory(id: string): string {
    const session = this.sessions.get(id);
    if (session && session.buffer.length > 0) {
      const all = session.buffer.join('');
      if (!session.inAlt) return all;
      // tela alternativa: o que veio antes do último reset de tela não aparece mais, e o limite do buffer pode ter cortado a entrada nela;
      // reproduzir o fluxo cortado pela metade jogava a conversa no buffer normal, com o começo à vista
      const clear = all.lastIndexOf('\x1b[2J');
      if (clear >= 0) return '\x1b[?1049h' + all.slice(clear);
      return all.includes('\x1b[?1049h') ? all : '\x1b[?1049h\x1b[2J' + all;
    }
    const cached = this.sessionHistories.get(id);
    return cached ? cached.join('') : '';
  }

  setCwd(id: string, cwd: string): boolean {
    if (this.isOrchCliSession(id)) return false;
    const session = this.sessions.get(id);
    if (!session) return false;
    const cleanCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
    session.cwd = cleanCwd;
    if (session.term && this.isShellIdle(session)) {
      session.term.write(`cd ${shq(cleanCwd)}\r`);
      return true;
    }
    return false;
  }

  setAllCwd(cwd: string): void {
    const cleanCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
    for (const session of this.sessions.values()) {
      if (this.isOrchCliSession(session.id)) continue;
      session.cwd = cleanCwd;
      if (session.term && this.isShellIdle(session)) {
        session.term.write(`cd ${shq(cleanCwd)}\r`);
      }
    }
  }
}
