import { BrowserWindow } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

const pty = require('node-pty');

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

  setWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  createSession(
    id: string,
    type: 'zsh' | 'claude' | 'agy' | 'antigravity' | 'gemini' | 'ollama' | 'custom' | string = 'zsh',
    cwd: string = process.cwd(),
    cols: number = 80,
    rows: number = 24
  ): NativePtySession {
    if (this.sessions.has(id)) {
      return this.sessions.get(id)!;
    }

    let file = '/bin/zsh';
    let args: string[] = ['-l'];
    let title = 'zsh';

    const cleanCwd = fs.existsSync(cwd) ? cwd : process.cwd();

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      PATH: `${path.join(process.env.HOME || '', '.local/bin')}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
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
      file = '/bin/zsh';
      args = ['-l'];
      title = 'OpenAI Codex CLI';
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
}
