import { BrowserWindow } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as https from 'node:https';
import { execSync, exec } from 'node:child_process';

const pty = require('node-pty');

const ZSH_SYNTAX_HIGHLIGHTING_VERSION = '0.8.0';

// Downloads and extracts a small (~150KB), BSD-licensed GitHub tag archive into destDir.
// Used to fetch the zsh-syntax-highlighting plugin on first run; failures are non-fatal
// (the colored prompt still works without it, just without live command highlighting).
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

export interface NativePtySession {
  id: string;
  type: string;
  title: string;
  cwd: string;
  term: any;
  buffer: string[];
}

export class NativePtyService {
  private sessions: Map<string, NativePtySession> = new Map();
  private claudeBinPath: string;
  private agyBinPath: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    const homeClaude = path.join(process.env.HOME || '', '.local/bin/claude');
    if (fs.existsSync(homeClaude)) {
      this.claudeBinPath = homeClaude;
    } else {
      try {
        this.claudeBinPath = execSync('which claude', { encoding: 'utf8' }).trim();
      } catch {
        this.claudeBinPath = 'claude';
      }
    }

    try {
      this.agyBinPath = execSync('which agy', { encoding: 'utf8' }).trim();
    } catch {
      this.agyBinPath = null;
    }

    console.log(`[Native PTY] Claude at: ${this.claudeBinPath}`);
    console.log(`[Native PTY] AGY at: ${this.agyBinPath || 'Built-in AGY TUI bridge'}`);
  }

  private currentAccentColor: string = '#FF6A00';
  private lastZshInitColor: string | null = null;
  private zshInitDir = path.join(os.homedir(), '.devflow', 'zsh-init');
  private syntaxHighlightingDir = path.join(this.zshInitDir, 'plugins', 'zsh-syntax-highlighting');
  private syntaxHighlightingDownloadStarted = false;

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setAccentColor(accentColor: string) {
    if (!accentColor) return;
    this.currentAccentColor = accentColor;
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
  private ensureColoredZshInit(): string {
    this.ensureSyntaxHighlightingPlugin();
    const color = /^#[0-9a-fA-F]{6}$/.test(this.currentAccentColor) ? this.currentAccentColor : '#FF6A00';
    if (this.lastZshInitColor === color && fs.existsSync(path.join(this.zshInitDir, '.zshrc'))) {
      return this.zshInitDir;
    }
    try {
      fs.mkdirSync(this.zshInitDir, { recursive: true });
      const highlightEntry = path.join(this.syntaxHighlightingDir, 'zsh-syntax-highlighting.zsh');
      const rc = [
        '# Auto-generated by DevFlow IDE — do not edit, regenerated on accent color change.',
        '[ -f "$DEVFLOW_REAL_HOME/.zshrc" ] && ZDOTDIR="$DEVFLOW_REAL_HOME" source "$DEVFLOW_REAL_HOME/.zshrc"',
        '[ -n "$DEVFLOW_INITIAL_CWD" ] && [ -d "$DEVFLOW_INITIAL_CWD" ] && cd "$DEVFLOW_INITIAL_CWD"',
        `PROMPT='%F{242}%n@%m%f %B%F{${color}}%1~%f%b %F{${color}}%#%f '`,
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

  createSession(
    id: string,
    type: 'zsh' | 'claude' | 'agy' | 'antigravity' | 'gemini' | 'ollama' | 'custom' | string = 'zsh',
    cwd: string = process.cwd(),
    cols: number = 80,
    rows: number = 24,
    accentColor?: string
  ): NativePtySession {
    if (accentColor) {
      this.currentAccentColor = accentColor;
    }
    if (this.sessions.has(id)) {
      const existing = this.sessions.get(id)!;
      const cleanCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
      if (cleanCwd && existing.cwd !== cleanCwd) {
        existing.cwd = cleanCwd;
        if (existing.type === 'zsh' || existing.type === 'bash') {
          existing.term?.write(`cd "${cleanCwd}"\r`);
        }
      }
      return existing;
    }

    let file = '/bin/zsh';
    let args: string[] = ['-l'];
    let title = 'zsh';

    const cleanCwd = fs.existsSync(cwd) ? cwd : process.cwd();

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

    if (type === 'claude') {
      file = this.claudeBinPath;
      args = [];
      title = 'Claude Code CLI';
    } else if (type === 'agy' || type === 'antigravity') {
      if (this.agyBinPath && fs.existsSync(this.agyBinPath)) {
        file = this.agyBinPath;
        args = [];
      } else {
        file = '/opt/homebrew/bin/bun';
        args = [path.join(__dirname, 'agy-cli.ts')];
      }
      title = 'Antigravity CLI (agy)';
    } else if (type === 'gemini') {
      file = '/bin/zsh';
      args = ['-l', '-c', 'gemini'];
      title = 'Gemini CLI';
    } else if (type === 'ollama') {
      file = '/bin/zsh';
      args = ['-l', '-c', 'ollama run llama3'];
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
        args = [];
      } else {
        file = '/bin/zsh';
        args = ['-l', '-c', 'codex'];
      }
      title = 'OpenAI Codex CLI';
    }

    // Give plain zsh sessions (interactive terminal, or CLI wrappers that shell out via zsh -c)
    // a colored prompt matching the app's accent color, VS Code/Antigravity style.
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

    const session: NativePtySession = {
      id,
      type,
      title,
      cwd: cleanCwd,
      term,
      buffer: [],
    };

    term.onData((data: string) => {
      if (session.buffer.length > 200) session.buffer.shift();
      session.buffer.push(data);

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:data', { id, data });
      }
    });

    term.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log(`[Native PTY] ${id} exited (${exitCode})`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('pty:exit', { id, exitCode, signal });
      }
      this.sessions.delete(id);
    });

    this.sessions.set(id, session);
    console.log(`[Native PTY] Created session ${id} (${title}) in ${cleanCwd}`);
    return session;
  }

  write(id: string, data: string) {
    const session = this.sessions.get(id);
    if (session && session.term) {
      session.term.write(data);
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

  kill(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      try {
        session.term.kill();
      } catch (err) {
        // ignore
      }
      this.sessions.delete(id);
    }
  }

  getHistory(id: string): string {
    const session = this.sessions.get(id);
    return session ? session.buffer.join('') : '';
  }

  setCwd(id: string, cwd: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    const cleanCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
    session.cwd = cleanCwd;
    if (session.term && (session.type === 'zsh' || session.type === 'bash')) {
      session.term.write(`cd "${cleanCwd}"\r`);
      return true;
    }
    return false;
  }

  setAllCwd(cwd: string): void {
    const cleanCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
    for (const session of this.sessions.values()) {
      session.cwd = cleanCwd;
      if (session.term && (session.type === 'zsh' || session.type === 'bash')) {
        session.term.write(`cd "${cleanCwd}"\r`);
      }
    }
  }
}
