// Leva o Brain para as CLIs (Claude Code, Codex, Gemini): elas leem CLAUDE.md, AGENTS.md e GEMINI.md sozinhas ao abrir o projeto,
// então um bloco gerenciado nesses arquivos aponta para o mapa em .aura/brain e traz o índice das notas.
import type { ProjectBrainContext } from '../../types/brain';
import { BRAIN_NOTES_DIR, summarizeVaultForAi, type VaultNote } from './vault';

const START = '<!-- aura:brain:start -->';
const END = '<!-- aura:brain:end -->';
const FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];
const fsApi = () => (window as any).electronAPI?.fs;

export function buildCliBrainBlock(brain: ProjectBrainContext | null, notes: VaultNote[]): string {
  const index = summarizeVaultForAi(notes, 40);
  const lines = [
    START,
    '## Brain do projeto (Aura Dev)',
    `O mapa do projeto está em notas Markdown ligadas por [[links]] em \`${BRAIN_NOTES_DIR}/\`. Antes de explorar o código, leia a nota "Visão geral" e as notas dos módulos envolvidos; abra arquivos do código só para o detalhe. Se uma nota estiver desatualizada, corrija-a.`,
  ];
  if (brain?.techStack?.length) lines.push(`- Stack: ${brain.techStack.join(', ')}`);
  if (brain?.summary) lines.push(`- Resumo: ${brain.summary.replace(/\s+/g, ' ').trim().slice(0, 500)}`);
  if (brain?.aiDirectives?.trim()) lines.push('', 'Diretrizes:', brain.aiDirectives.trim().slice(0, 1500));
  if (index) lines.push('', 'Notas:', index);
  lines.push('<!-- Bloco gerado pelo Aura Dev; edite as notas no Brain, não aqui. -->', END);
  return lines.join('\n');
}

const upsert = (content: string, block: string) => {
  const a = content.indexOf(START);
  const b = content.indexOf(END);
  if (a !== -1 && b > a) return content.slice(0, a) + block + content.slice(b + END.length);
  return `${content.trimEnd()}${content.trim() ? '\n\n' : ''}${block}\n`;
};

/** Arquivos de instruções do projeto que já têm o bloco do Brain (ou que existem). */
async function readTargets(root: string) {
  const fs = fsApi();
  const out: Array<{ path: string; content: string | null }> = [];
  for (const f of FILES) {
    const path = `${root}/${f}`;
    const res = await fs?.readFile?.(path).catch(() => null);
    out.push({ path, content: typeof res?.content === 'string' ? res.content : null });
  }
  return out;
}

/** O usuário já ligou a sincronização neste projeto (algum arquivo tem o bloco)? */
export async function hasCliSync(workspacePath: string): Promise<boolean> {
  const root = workspacePath.replace(/\/+$/, '');
  return (await readTargets(root)).some((t) => t.content?.includes(START));
}

/**
 * Atualiza o bloco do Brain. `create` (primeira sincronização, pedida pelo usuário) escreve também nos arquivos que ainda não existem;
 * sem ele só atualiza os que já têm o bloco, sem criar nem tocar em mais nada. Devolve os arquivos alterados.
 */
export async function syncBrainToCli(workspacePath: string, brain: ProjectBrainContext | null, notes: VaultNote[], create = false): Promise<string[]> {
  const fs = fsApi();
  const root = workspacePath.replace(/\/+$/, '');
  const block = buildCliBrainBlock(brain, notes);
  const done: string[] = [];
  for (const t of await readTargets(root)) {
    const name = t.path.split('/').pop() as string;
    if (t.content === null && !create) continue;
    if (t.content !== null && !create && !t.content.includes(START)) continue;
    const res = await fs?.writeFile?.(t.path, upsert(t.content || '', block)).catch(() => null);
    if (res?.success) done.push(name);
  }
  return done;
}
