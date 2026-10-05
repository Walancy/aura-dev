import { ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { app } from 'electron';
import { skillsService } from './skills-service';
import { getCleanEnv } from './env-utils';

type Provider = 'claude' | 'codex' | 'antigravity';

export interface OrchestratorRunInput {
  provider: Provider;
  request: string;
  cwd: string;
  model?: string;
  mode?: 'ask' | 'plan' | 'execute';
  depth?: 'fast' | 'balanced' | 'deep';
  additionalDirs?: string[];
  timeoutMs?: number;
  runId?: string;
}

export type OrchestratorEvent = {
  provider: string;
  kind: string;
  message: string;
  timestamp_ms: number;
  payload: unknown;
  runId?: string;
};

export interface OrchestratorRunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  requestId: string;
  cancelled?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class OrchestratorService {
  private readonly activeProcesses = new Map<string, ChildProcess>();

  private getManifestPath(): string {
    const appRoot = app ? app.getAppPath() : process.cwd();
    return path.join(appRoot, 'rust', 'orchestrator', 'Cargo.toml');
  }

  async providers(): Promise<any[]> {
    const result = await this.invoke({ operation: 'providers' });
    return result.providers || [];
  }

  async run(input: OrchestratorRunInput, onEvent?: (event: OrchestratorEvent) => void): Promise<OrchestratorRunOutput> {
    const runId = input.runId || randomUUID();
    const cliName = input.provider === 'antigravity' ? 'agy' : input.provider;
    const preamble = skillsService.promptPreamble(cliName, { force: input.provider === 'codex' });
    const result = await this.invoke({
      operation: 'run',
      request: preamble + input.request,
      extra_args: skillsService.cliArgs(cliName),
      provider: input.provider,
      cwd: input.cwd,
      model: input.model,
      mode: input.mode || 'execute',
      additional_dirs: input.additionalDirs || [],
      timeout_ms: input.timeoutMs || 300_000,
      run_id: runId,
    }, onEvent, runId);

    if (!result.ok) {
      const response: OrchestratorRunOutput = {
        stdout: '',
        stderr: result.error || 'orchestrator failed',
        exitCode: 1,
        requestId: runId,
        cancelled: false,
      };
      this.persist(input, response, runId);
      return response;
    }

    const response: OrchestratorRunOutput = {
      stdout: result.result?.text || '',
      stderr: '',
      exitCode: 0,
      requestId: runId,
      cancelled: false,
      usage: {
        input_tokens: result.result?.input_tokens,
        output_tokens: result.result?.output_tokens,
      },
    };
    this.persist(input, response, runId);
    return response;
  }

  cancel(runId?: string): boolean {
    if (runId) {
      const child = this.activeProcesses.get(runId);
      if (child) {
        this.killProcess(child);
        this.activeProcesses.delete(runId);
        return true;
      }
      return false;
    }
    return false;
  }

  cancelAll(): boolean {
    let killed = false;
    for (const [, child] of this.activeProcesses.entries()) {
      this.killProcess(child);
      killed = true;
    }
    this.activeProcesses.clear();
    return killed;
  }

  private killProcess(child: ChildProcess): void {
    try {
      if (child.pid && process.platform !== 'win32') {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        setTimeout(() => {
          try {
            if (child.pid) process.kill(-child.pid, 'SIGKILL');
          } catch {}
        }, 3000);
      }
      child.kill('SIGTERM');
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 3000);
    } catch {}
  }

  private persist(input: OrchestratorRunInput, result: unknown, runId: string): void {
    try {
      const directory = path.join(process.env.HOME || os.homedir(), '.devflow', 'orchestrator', 'runs');
      fs.mkdirSync(directory, { recursive: true });
      const filename = `${Date.now()}-${runId}.json`;
      fs.writeFileSync(path.join(directory, filename), JSON.stringify({
        timestamp: new Date().toISOString(),
        provider: input.provider,
        cwd: input.cwd,
        request: input.request,
        result,
      }, null, 2));

      // Keep only 200 most recent files
      const files = fs.readdirSync(directory)
        .filter((f) => f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a));
      if (files.length > 200) {
        for (const oldFile of files.slice(200)) {
          try { fs.unlinkSync(path.join(directory, oldFile)); } catch {}
        }
      }
    } catch (error) {
      console.warn('[Orchestrator] Failed to persist run history:', error);
    }
  }

  private binaryCandidates(): string[] {
    const binName = process.platform === 'win32' ? 'devflow-orchestrator.exe' : 'devflow-orchestrator';
    if (app && app.isPackaged) {
      return [
        path.join(process.resourcesPath || '', 'bin', binName),
        path.join(process.resourcesPath || '', binName),
      ];
    }
    const appRoot = app ? app.getAppPath() : process.cwd();
    return [
      path.join(__dirname, 'bin', binName),
      path.join(appRoot, 'dist-electron', 'bin', binName),
      path.join(appRoot, 'rust', 'orchestrator', 'target', 'release', binName),
      path.join(process.resourcesPath || '', 'bin', binName),
    ];
  }

  private async invoke(payload: Record<string, unknown>, onEvent?: (event: OrchestratorEvent) => void, runId?: string): Promise<any> {
    const binary = this.binaryCandidates().find((candidate) => fs.existsSync(candidate));
    if (!binary && app && app.isPackaged) {
      return { ok: false, error: 'devflow-orchestrator binary not found in packaged app resources' };
    }
    const command = binary ? binary : 'cargo';
    const args = binary ? [] : ['run', '--quiet', '--manifest-path', this.getManifestPath()];
    const env = getCleanEnv();

    const spawnCwd =
      (payload.cwd as string) && fs.existsSync(payload.cwd as string)
        ? (payload.cwd as string)
        : os.homedir();

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: spawnCwd,
        env,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      if (runId) this.activeProcesses.set(runId, child);
      let stdout = '';
      let stderr = '';
      let pending = '';

      const forwardEvent = (line: string) => {
        try {
          const message = JSON.parse(line);
          if (message.event) onEvent?.({ ...message.event, runId });
        } catch {}
      };

      const timeout = setTimeout(() => {
        this.killProcess(child);
      }, Number(payload.timeout_ms || 300_000) + 5_000);

      child.stdout.on('data', (text: string) => {
        stdout += text;
        pending += text;
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) forwardEvent(line);
        }
      });

      child.stderr.on('data', (text: string) => {
        stderr += text;
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        if (runId) this.activeProcesses.delete(runId);
        resolve({ ok: false, error: `${error.message}${stderr ? `: ${stderr}` : ''}` });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        if (runId) this.activeProcesses.delete(runId);
        if (pending.trim()) forwardEvent(pending);

        const lines = stdout.trim().split('\n').filter(Boolean);
        let terminalResult: any = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (typeof parsed === 'object' && parsed !== null && 'ok' in parsed) {
              terminalResult = parsed;
              break;
            }
          } catch {}
        }

        if (terminalResult) {
          resolve(terminalResult);
        } else {
          resolve({
            ok: false,
            error: `orchestrator exited with ${code ?? signal ?? 1}: ${stderr || stdout}`,
          });
        }
      });

      child.stdin.end(`${JSON.stringify(payload)}\n`);
    });
  }
}

export const orchestratorService = new OrchestratorService();
