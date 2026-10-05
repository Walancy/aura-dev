import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { githubAuthService } from './github-auth-service';
import { orchestratorService, OrchestratorEvent } from './orchestrator-service';
import { isStatusPass } from './env-utils';

export { isStatusPass };

export interface AutonomousTaskInput {
  provider: 'claude' | 'codex' | 'antigravity';
  cwd: string;
  title: string;
  description?: string;
  model?: string;
  projectNumber?: number;
  projectId?: string;
  itemId?: string;
  maxRepairCycles?: number;
  taskId?: string;
  runId?: string;
}

type Phase = 'planning' | 'implementation' | 'verification' | 'repair' | 'completed' | 'review';

export class AutonomousService {
  private readonly activeRuns = new Map<string, string>();
  private readonly cancelledRuns = new Set<string>();

  cancel(runId: string): boolean {
    this.cancelledRuns.add(runId);
    const childRunId = this.activeRuns.get(runId);
    if (childRunId) {
      orchestratorService.cancel(childRunId);
    }
    return true;
  }

  async run(
    input: AutonomousTaskInput,
    onEvent?: (event: OrchestratorEvent & { phase?: Phase; issueId?: string }) => void
  ): Promise<{ runId: string; status: 'done' | 'review' | 'failed'; summary: string }> {
    input = await this.resolveProjectItem(input);
    const runId = input.runId || randomUUID();
    const emit = (phase: Phase, event: OrchestratorEvent) =>
      onEvent?.({ ...event, phase, issueId: input.taskId || input.itemId });

    const state: any = {
      runId,
      title: input.title,
      cwd: input.cwd,
      phase: 'planning' as Phase,
      startedAt: new Date().toISOString(),
      phases: [],
    };
    this.persist(runId, state);

    if (this.cancelledRuns.has(runId)) {
      state.phase = 'review';
      state.finishedAt = new Date().toISOString();
      state.summary = 'Execução cancelada pelo usuário.';
      this.persist(runId, state);
      return { runId, status: 'failed', summary: state.summary };
    }

    await this.updateProjectStatus(input, 'In Progress');

    const context = `Tarefa: ${input.title}\nDescrição: ${input.description || '(sem descrição)'}\nWorkspace: ${input.cwd}`;

    // Planning Phase
    const plan = await this.phase(
      input,
      runId,
      'planning',
      `${context}\n\nAtue como líder técnico. Inspecione o repositório e produza um plano curto e verificável. Não edite arquivos nesta fase. Não faça perguntas: escolha a alternativa segura e registre premissas.`,
      state,
      emit
    );

    if (this.cancelledRuns.has(runId)) {
      return this.cancelRun(runId, state);
    }
    if (plan.exitCode !== 0) return this.fail(input, runId, state, plan.stderr);

    // Implementation Phase
    const implementation = await this.phase(
      input,
      runId,
      'implementation',
      `${context}\n\nImplemente a tarefa no workspace. Inspecione o código atual, mantenha o diff pequeno e execute testes direcionados ao terminar. Não peça confirmação; pare apenas se houver risco destrutivo ou credencial ausente.`,
      state,
      emit
    );

    if (this.cancelledRuns.has(runId)) {
      return this.cancelRun(runId, state);
    }
    if (implementation.exitCode !== 0) return this.fail(input, runId, state, implementation.stderr);

    // Verification Phase
    let verification = await this.phase(
      input,
      runId,
      'verification',
      `${context}\n\nFaça revisão objetiva do diff atual e execute os testes relevantes. Corrija problemas simples encontrados. Termine exatamente com STATUS: PASS ou STATUS: FAIL e explique apenas o bloqueio principal.`,
      state,
      emit
    );

    const maxRepairs = Math.min(Math.max(input.maxRepairCycles ?? 1, 0), 2);
    let repairs = 0;
    while (
      !this.cancelledRuns.has(runId) &&
      verification.exitCode === 0 &&
      !isStatusPass(verification.stdout) &&
      repairs < maxRepairs
    ) {
      repairs += 1;
      const repair = await this.phase(
        input,
        runId,
        'repair',
        `${context}\n\nA revisão encontrou problemas. Corrija apenas os problemas verificáveis no workspace, rode os testes afetados e não amplie o escopo. Termine com STATUS: PASS ou STATUS: FAIL.`,
        state,
        emit
      );
      if (repair.exitCode !== 0 || this.cancelledRuns.has(runId)) break;
      verification = repair;
    }

    if (this.cancelledRuns.has(runId)) {
      return this.cancelRun(runId, state);
    }

    const passed = verification.exitCode === 0 && isStatusPass(verification.stdout);
    state.phase = passed ? 'completed' : 'review';
    state.finishedAt = new Date().toISOString();
    state.summary = this.compact(verification.stdout || verification.stderr);
    this.persist(runId, state);
    await this.updateProjectStatus(input, passed ? 'Done' : 'Review');
    return { runId, status: passed ? 'done' : 'review', summary: state.summary };
  }

  private cancelRun(runId: string, state: any): { runId: string; status: 'failed'; summary: string } {
    state.phase = 'review';
    state.finishedAt = new Date().toISOString();
    state.summary = 'Execução cancelada pelo usuário.';
    this.persist(runId, state);
    return { runId, status: 'failed', summary: state.summary };
  }

  private async resolveProjectItem(input: AutonomousTaskInput): Promise<AutonomousTaskInput> {
    if (!input.projectNumber || input.itemId) return input;
    try {
      const project = await githubAuthService.fetchProjectItems(input.projectNumber);
      const item = (project?.items?.nodes || []).find(
        (candidate: any) => candidate.content?.title?.toLowerCase() === input.title.toLowerCase()
      );
      return item ? { ...input, projectId: input.projectId || project.id, itemId: item.id } : input;
    } catch (error) {
      console.warn('[Autonomous] Failed to resolve GitHub Project item:', error);
      return input;
    }
  }

  private async phase(
    input: AutonomousTaskInput,
    runId: string,
    phase: Phase,
    prompt: string,
    state: any,
    emit: (phase: Phase, event: OrchestratorEvent) => void
  ) {
    this.activeRuns.set(runId, `${runId}-${phase}`);
    const result = await orchestratorService.run(
      {
        runId: `${runId}-${phase}`,
        provider: input.provider,
        request: prompt,
        cwd: input.cwd,
        model: input.model,
        mode: phase === 'planning' ? 'plan' : 'execute',
        depth: 'balanced',
        timeoutMs: 600_000,
      },
      (event) => emit(phase, event)
    );
    this.activeRuns.delete(runId);

    state.phases.push({
      phase,
      updatedAt: new Date().toISOString(),
      output: this.compact(result.stdout || result.stderr),
      exitCode: result.exitCode,
    });
    this.persist(runId, state);
    return result;
  }

  private async updateProjectStatus(input: AutonomousTaskInput, status: string): Promise<void> {
    if (!input.projectNumber || !input.itemId) return;
    try {
      const project = await githubAuthService.fetchProjectItems(input.projectNumber);
      const field: any = (project?.fields?.nodes || []).find(
        (candidate: any) => candidate.name?.toLowerCase() === 'status' && candidate.options
      );
      const option = field?.options?.find(
        (candidate: any) => candidate.name?.toLowerCase() === status.toLowerCase()
      );
      if (project?.id && field?.id && option?.id) {
        await githubAuthService.updateProjectItemStatus(
          input.projectId || project.id,
          input.itemId,
          field.id,
          option.id
        );
      }
    } catch (error) {
      console.warn('[Autonomous] GitHub status update failed:', error);
    }
  }

  private async fail(
    input: AutonomousTaskInput,
    runId: string,
    state: any,
    error: string
  ): Promise<{ runId: string; status: 'failed'; summary: string }> {
    state.phase = 'review';
    state.finishedAt = new Date().toISOString();
    state.summary = this.compact(error);
    this.persist(runId, state);
    if (!this.cancelledRuns.has(runId)) {
      await this.updateProjectStatus(input, 'Review');
    }
    return { runId, status: 'failed', summary: state.summary };
  }

  private persist(runId: string, state: any): void {
    try {
      const directory = path.join(process.env.HOME || os.homedir(), '.devflow', 'orchestrator', 'autonomous');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `${runId}.json`), JSON.stringify(state, null, 2));

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
      console.warn('[Autonomous] Failed to persist state:', error);
    }
  }

  private compact(value: string): string {
    return value.replace(/\s+/g, ' ').trim().slice(-2000);
  }
}

export const autonomousService = new AutonomousService();
