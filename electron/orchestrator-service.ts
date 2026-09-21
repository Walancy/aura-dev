import { ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

export type OrchestratorEvent = { provider: string; kind: string; message: string; timestamp_ms: number; payload: unknown };

export class OrchestratorService {
  private readonly manifestPath = path.join(process.cwd(), 'rust', 'orchestrator', 'Cargo.toml');
  private readonly activeProcesses = new Map<string, ChildProcess>();

  async providers(): Promise<any[]> {
    const result = await this.invoke({ operation: 'providers' });
    return result.providers || [];
  }

  async run(input: OrchestratorRunInput, onEvent?: (event: OrchestratorEvent) => void): Promise<{ stdout: string; stderr: string; exitCode: number; requestId: string }> {
    const runId = input.runId || randomUUID();
    const result = await this.invoke({
      operation: 'run',
      request: input.request,
      provider: input.provider,
      cwd: input.cwd,
      model: input.model,
      mode: input.mode || 'execute',
      depth: input.depth || 'balanced',
      additional_dirs: input.additionalDirs || [],
      timeout_ms: input.timeoutMs || 300_000,
      run_id: runId,
    }, onEvent, runId);
    if (!result.ok) {
      const response = { stdout: '', stderr: result.error || 'orchestrator failed', exitCode: 1, requestId: runId };
      this.persist(input, response);
      return response;
    }
    const response = {
      stdout: result.result?.text || '',
      stderr: '',
      exitCode: 0,
      requestId: runId,
    };
    this.persist(input, response);
    return response;
  }

  cancel(runId: string): boolean {
    const child = this.activeProcesses.get(runId);
    if (!child) return false;
    child.kill('SIGTERM');
    return true;
  }

  private persist(input: OrchestratorRunInput, result: { stdout: string; stderr: string; exitCode: number }): void {
    try {
      const directory = path.join(process.env.HOME || process.cwd(), '.devflow', 'orchestrator', 'runs');
      fs.mkdirSync(directory, { recursive: true });
      const filename = `${Date.now()}-${input.provider}.json`;
      fs.writeFileSync(path.join(directory, filename), JSON.stringify({
        timestamp: new Date().toISOString(),
        provider: input.provider,
        cwd: input.cwd,
        request: input.request,
        result,
      }, null, 2));
    } catch (error) {
      console.warn('[Orchestrator] Failed to persist run history:', error);
    }
  }

  private binaryCandidates(): string[] {
    return [
      path.join(__dirname, 'bin', process.platform === 'win32' ? 'devflow-orchestrator.exe' : 'devflow-orchestrator'),
      path.join(process.cwd(), 'rust', 'orchestrator', 'target', 'release', 'devflow-orchestrator'),
      path.join(process.cwd(), 'target', 'release', 'devflow-orchestrator'),
      path.join(process.resourcesPath || '', 'devflow-orchestrator'),
    ];
  }

  private async invoke(payload: Record<string, unknown>, onEvent?: (event: OrchestratorEvent) => void, runId?: string): Promise<any> {
    const binary = this.binaryCandidates().find((candidate) => fs.existsSync(candidate));
    const command = binary ? binary : 'cargo';
    const args = binary ? [] : ['run', '--quiet', '--manifest-path', this.manifestPath];
    const env = { ...process.env, TERM: 'xterm-256color' };

    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd: path.dirname(this.manifestPath), env, stdio: ['pipe', 'pipe', 'pipe'] });
      if (runId) this.activeProcesses.set(runId, child);
      let stdout = '';
      let stderr = '';
      let pending = '';
      const forwardEvent = (line: string) => {
        try {
          const message = JSON.parse(line);
          if (message.event) onEvent?.(message.event);
        } catch {}
      };
      const timeout = setTimeout(() => child.kill('SIGTERM'), Number(payload.timeout_ms || 30_000) + 5_000);
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdout += text;
        pending += text;
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) if (line.trim()) forwardEvent(line);
      });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => { clearTimeout(timeout); if (runId) this.activeProcesses.delete(runId); resolve({ ok: false, error: `${error.message}${stderr ? `: ${stderr}` : ''}` }); });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (runId) this.activeProcesses.delete(runId);
        if (pending.trim()) forwardEvent(pending);
        const lines = stdout.trim().split('\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];
        try {
          resolve(JSON.parse(lastLine || '{}'));
        } catch {
          resolve({ ok: false, error: `orchestrator exited with ${code ?? 1}: ${stderr || stdout}` });
        }
      });
      child.stdin.end(`${JSON.stringify(payload)}\n`);
    });
  }
}

export const orchestratorService = new OrchestratorService();
