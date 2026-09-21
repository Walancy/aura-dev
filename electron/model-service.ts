import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AiModelItem {
  id: string;
  label: string;
  tag?: string;
  description?: string;
}

export interface ProviderModelsResult {
  providerId: string;
  currentModel: string;
  currentModelId: string;
  models: AiModelItem[];
}

function runCommandAsync(
  cmd: string,
  options: { shell?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      {
        encoding: 'utf8',
        shell: options.shell || '/bin/zsh',
        env: options.env,
        timeout: options.timeout || 6000,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve((stdout || '').toString());
        }
      }
    );
  });
}

export class ModelService {
  private activeModelIds: Record<string, string> = {
    claude: 'sonnet',
    antigravity: 'gemini-3.8-flash-high',
    codex: 'default',
    gemini: 'gemini-2.5-flash',
    ollama: 'llama3.3',
  };

  private cache: Record<string, { timestamp: number; data: ProviderModelsResult }> = {};
  private readonly CACHE_TTL_MS = 20000; // 20s cache
  private binaryPathCache: Record<string, string | null> = {};

  private async resolveBinaryPath(name: string): Promise<string | null> {
    if (this.binaryPathCache[name] !== undefined) {
      return this.binaryPathCache[name];
    }

    const userHome = process.env.HOME || '';
    const candidates = [
      path.join(userHome, '.local/bin', name),
      path.join(userHome, '.bun/bin', name),
      path.join('/opt/homebrew/bin', name),
      path.join('/usr/local/bin', name),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.binaryPathCache[name] = p;
        return p;
      }
    }

    try {
      const out = (
        await runCommandAsync(`which ${name}`, {
          shell: '/bin/zsh',
          env: {
            ...process.env,
            PATH: `${userHome}/.local/bin:${userHome}/.bun/bin:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
          },
          timeout: 2000,
        })
      ).trim();
      if (out && fs.existsSync(out)) {
        this.binaryPathCache[name] = out;
        return out;
      }
    } catch {}

    this.binaryPathCache[name] = null;
    return null;
  }

  public async getModels(providerId: string): Promise<ProviderModelsResult> {
    const now = Date.now();
    const cached = this.cache[providerId];
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    let result: ProviderModelsResult;

    if (providerId === 'claude') {
      result = await this.getClaudeModels();
    } else if (providerId === 'antigravity') {
      result = await this.getAntigravityModels();
    } else if (providerId === 'codex') {
      result = this.getCodexModels();
    } else if (providerId === 'gemini') {
      result = this.getGeminiModels();
    } else {
      result = await this.getOllamaModels();
    }

    this.cache[providerId] = { timestamp: now, data: result };
    return result;
  }

  public async setModel(providerId: string, modelId: string): Promise<{ success: boolean; currentModel: string; message: string }> {
    this.activeModelIds[providerId] = modelId;

    if (providerId === 'claude') {
      const bin = await this.resolveBinaryPath('claude');
      if (bin) {
        try {
          const out = (
            await runCommandAsync(`${bin} -p "/model ${modelId}" < /dev/null`, {
              shell: '/bin/zsh',
              timeout: 5000,
            })
          ).trim();
          delete this.cache['claude'];
          const fresh = await this.getClaudeModels();
          return {
            success: true,
            currentModel: fresh.currentModel,
            message: out || `Modelo alterado para ${modelId}`,
          };
        } catch (err: any) {
          console.warn('[ModelService] Failed to set claude model via CLI:', err?.message || err);
        }
      }
    }

    delete this.cache[providerId];
    const fresh = await this.getModels(providerId);
    return {
      success: true,
      currentModel: fresh.currentModel,
      message: `Modelo alterado para ${modelId}`,
    };
  }

  private async getClaudeModels(): Promise<ProviderModelsResult> {
    const bin = await this.resolveBinaryPath('claude');
    let currentModel = 'Sonnet 5';
    let currentModelId = this.activeModelIds.claude || 'sonnet';
    const models: AiModelItem[] = [];

    const CLAUDE_META: Record<string, { label: string; tag?: string; desc?: string }> = {
      sonnet: { label: 'Sonnet 5', tag: 'Padrão', desc: 'Modelo mais inteligente e balanceado' },
      opus: { label: 'Opus 5', tag: 'Poderoso', desc: 'Máxima capacidade de raciocínio profundo' },
      haiku: { label: 'Haiku 4.5', tag: 'Rápido', desc: 'Respostas ultra-rápidas e econômicas' },
      fable: { label: 'Fable 5.1', tag: 'Raciocínio', desc: 'Agente avançado com suporte a créditos' },
      best: { label: 'Best (Fable 5.1)', desc: 'Melhor modelo disponível para a tarefa' },
      'sonnet[1m]': { label: 'Sonnet 5 (1M)', tag: '1M Contexto', desc: 'Janela estendida de 1 milhão de tokens' },
      'opus[1m]': { label: 'Opus 5 (1M)', tag: '1M Contexto', desc: 'Opus com 1 milhão de tokens de contexto' },
      'fable[1m]': { label: 'Fable 5.1 (1M)', tag: '1M Contexto', desc: 'Fable com janela de contexto estendida' },
      opusplan: { label: 'Opus Plan', tag: 'Planejamento', desc: 'Modo especializado em planejamento de código' },
      default: { label: 'Default', desc: 'Padrão do sistema Claude Code' },
    };

    if (bin) {
      try {
        const out = await runCommandAsync(`${bin} -p "/model" < /dev/null`, {
          shell: '/bin/zsh',
          timeout: 4000,
        });

        const currentMatch = out.match(/Current model:\s*`?([^`\n]+)`?/i);
        if (currentMatch) {
          currentModel = currentMatch[1].trim();
        }

        const availMatch = out.match(/Available:\s*([^\n]+)/i);
        if (availMatch) {
          const rawTokens = availMatch[1]
            .replace(/or a full model ID\.?/gi, '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          for (const token of rawTokens) {
            const lower = token.toLowerCase();
            const meta = CLAUDE_META[lower];
            const label = (lower === 'sonnet' && currentModel) ? currentModel : (meta?.label || token);
            models.push({
              id: token,
              label,
              tag: meta?.tag,
              description: meta?.desc || token,
            });
          }
        }
      } catch (err) {
        console.warn('[ModelService] Failed to query live claude models:', err);
      }
    }

    if (models.length === 0) {
      const defaultClaudeTokens = [
        'sonnet',
        'opus',
        'haiku',
        'fable',
        'best',
        'sonnet[1m]',
        'opus[1m]',
        'fable[1m]',
        'opusplan',
        'default',
      ];
      for (const token of defaultClaudeTokens) {
        const meta = CLAUDE_META[token];
        models.push({
          id: token,
          label: meta?.label || token,
          tag: meta?.tag,
          description: meta?.desc || token,
        });
      }
    }

    const matched = models.find((m) =>
      m.id.toLowerCase() === currentModelId.toLowerCase() ||
      m.label.toLowerCase() === currentModel.toLowerCase() ||
      currentModel.toLowerCase().includes(m.id.toLowerCase())
    );
    if (matched) {
      currentModelId = matched.id;
      currentModel = matched.label;
    }

    return {
      providerId: 'claude',
      currentModel,
      currentModelId,
      models,
    };
  }

  private async getAntigravityModels(): Promise<ProviderModelsResult> {
    const bin = await this.resolveBinaryPath('agy');
    let currentModelId = this.activeModelIds.antigravity || 'gemini-3.8-flash-high';
    const models: AiModelItem[] = [];

    if (bin) {
      try {
        const out = await runCommandAsync(`${bin} models`, {
          shell: '/bin/zsh',
          timeout: 6000,
        });

        const cleanedOut = out
          .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
          .replace(/[\u2800-\u28FF]/g, '')
          .replace(/[^\n]*Fetching available models[^\n]*/gi, '');

        const lines = cleanedOut.split('\n');
        for (const line of lines) {
          const match = line.trim().match(/([a-zA-Z0-9._-]+)\s{2,}(.+)$/);
          if (match) {
            const id = match[1].trim();
            const label = match[2].trim();

            let tag: string | undefined = undefined;
            if (id.includes('3.8') || id.includes('high')) tag = 'Mais Recente';
            else if (id.includes('thinking') || id.includes('pro')) tag = 'Raciocínio';
            else if (id.includes('low')) tag = 'Econômico';

            models.push({ id, label, tag });
          }
        }
      } catch (err) {
        console.warn('[ModelService] Failed to query live agy models:', err);
      }
    }

    if (models.length === 0) {
      models.push(
        { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', tag: 'Mais Recente' },
        { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
        { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
        { id: 'gemini-3.7-flash-high', label: 'Gemini 3.7 Flash (High)' },
        { id: 'gemini-3.7-flash-medium', label: 'Gemini 3.7 Flash (Medium)' },
        { id: 'gemini-3.7-flash-low', label: 'Gemini 3.7 Flash (Low)' },
        { id: 'gemini-3.6-flash-high', label: 'Gemini 3.6 Flash (High)' },
        { id: 'gemini-3.6-flash-medium', label: 'Gemini 3.6 Flash (Medium)' },
        { id: 'gemini-3.6-flash-low', label: 'Gemini 3.6 Flash (Low)' },
        { id: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro (High)', tag: 'Raciocínio' },
        { id: 'gemini-3.1-pro-low', label: 'Gemini 3.1 Pro (Low)' },
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Thinking)', tag: 'Raciocínio' },
        { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6 (Thinking)', tag: 'Poderoso' },
        { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)' },
      );
    }

    const currentItem = models.find((m) => m.id === currentModelId) || models[0];

    return {
      providerId: 'antigravity',
      currentModel: currentItem.label,
      currentModelId: currentItem.id,
      models,
    };
  }

  private getCodexModels(): ProviderModelsResult {
    const models: AiModelItem[] = [
      { id: 'default', label: 'Padrão do Codex CLI', tag: 'Compatível com ChatGPT' },
    ];
    const currentModelId = this.activeModelIds.codex || 'default';
    const current = models.find((m) => m.id === currentModelId) || models[0];
    return {
      providerId: 'codex',
      currentModel: current.label,
      currentModelId: current.id,
      models,
    };
  }

  private getGeminiModels(): ProviderModelsResult {
    const models: AiModelItem[] = [
      { id: 'gemini-2.5-flash', label: '2.5 Flash', tag: 'Rápido' },
      { id: 'gemini-2.5-pro', label: '2.5 Pro', tag: 'Poderoso' },
      { id: 'gemini-2.0-flash-thinking', label: '2.0 Flash Thinking', tag: 'Raciocínio' },
    ];
    const currentModelId = this.activeModelIds.gemini || 'gemini-2.5-flash';
    const current = models.find((m) => m.id === currentModelId) || models[0];
    return {
      providerId: 'gemini',
      currentModel: current.label,
      currentModelId: current.id,
      models,
    };
  }

  private async getOllamaModels(): Promise<ProviderModelsResult> {
    const bin = await this.resolveBinaryPath('ollama');
    const models: AiModelItem[] = [];

    if (bin) {
      try {
        const out = await runCommandAsync(`${bin} list`, { timeout: 3000 });
        const lines = out.split('\n').slice(1);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0]) {
            models.push({ id: parts[0], label: parts[0] });
          }
        }
      } catch {}
    }

    if (models.length === 0) {
      models.push(
        { id: 'llama3.3', label: 'Llama 3.3 70B', tag: 'Recomendado' },
        { id: 'deepseek-r1', label: 'DeepSeek R1', tag: 'Raciocínio' },
        { id: 'qwen2.5-coder', label: 'Qwen 2.5 Coder', tag: 'Código' },
      );
    }

    const currentModelId = this.activeModelIds.ollama || models[0].id;
    const current = models.find((m) => m.id === currentModelId) || models[0];

    return {
      providerId: 'ollama',
      currentModel: current.label,
      currentModelId: current.id,
      models,
    };
  }
}

export const modelService = new ModelService();
