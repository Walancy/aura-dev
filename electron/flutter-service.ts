import { ChildProcess, spawn } from 'node:child_process';

export type FlutterEvent =
  | { kind: 'stdout' | 'stderr'; runId: string; data: string }
  | { kind: 'ready'; runId: string; url: string }
  | { kind: 'exit'; runId: string; exitCode: number | null };

interface FlutterRun {
  runId: string;
  process: ChildProcess;
  port: number;
}

const READY_REGEX = /is being served at\s+(http:\/\/[^\s]+)/i;

export class FlutterService {
  private runs = new Map<string, FlutterRun>();

  run(
    runId: string,
    cwd: string,
    port: number,
    onEvent: (event: FlutterEvent) => void
  ): { success: boolean; error?: string } {
    if (this.runs.has(runId)) {
      return { success: false, error: 'Já existe uma execução Flutter com este id' };
    }

    let child: ChildProcess;
    try {
      child = spawn('flutter', ['run', '-d', 'web-server', '--web-port', String(port)], {
        cwd,
        env: process.env,
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    this.runs.set(runId, { runId, process: child, port });

    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString();
      onEvent({ kind: 'stdout', runId, data: text });
      const match = text.match(READY_REGEX);
      if (match) {
        onEvent({ kind: 'ready', runId, url: match[1] });
      }
    });
    child.stderr?.on('data', (buf: Buffer) => {
      onEvent({ kind: 'stderr', runId, data: buf.toString() });
    });
    child.on('exit', (exitCode) => {
      this.runs.delete(runId);
      onEvent({ kind: 'exit', runId, exitCode });
    });
    child.on('error', (err) => {
      onEvent({ kind: 'stderr', runId, data: `[flutter-service] Falha ao iniciar: ${err.message}` });
      this.runs.delete(runId);
    });

    return { success: true };
  }

  stop(runId: string): { success: boolean } {
    const run = this.runs.get(runId);
    if (!run) return { success: false };
    run.process.kill();
    this.runs.delete(runId);
    return { success: true };
  }

  isRunning(runId: string): boolean {
    return this.runs.has(runId);
  }
}

export const flutterService = new FlutterService();
