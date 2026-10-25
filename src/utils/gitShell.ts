/** Aspas simples para o shell: caminho, branch ou mensagem com aspas, `$` ou crase não vira comando. */
export const shq = (v: string) => `'${String(v).replace(/'/g, `'\\''`)}'`;

export interface GitChange {
  path: string;
  /** letra do status do git (M, A, D, R, U) ou '??' para arquivo novo */
  status: string;
  staged: boolean;
}

/** Lê `git status --porcelain=v1 -z`: caminhos com espaço/acento vêm sem aspas e renomeados trazem origem e destino. */
export function parseStatusZ(out: string): GitChange[] {
  const changes: GitChange[] = [];
  const parts = out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    const x = entry[0];
    const y = entry[1];
    const path = entry.slice(3);
    // renomeado/copiado: o próximo campo é o caminho de origem
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') i++;
    if (x === '?' && y === '?') {
      changes.push({ path, status: '??', staged: false });
      continue;
    }
    if (x === '!') continue;
    if (x !== ' ') changes.push({ path, status: x, staged: true });
    if (y !== ' ') changes.push({ path, status: y, staged: false });
  }
  return changes;
}

/** Descarta todas as alterações do arquivo (staged, não staged ou novo) */
export const discardCommand = (p: string) => {
  const q = shq(p);
  return `if git cat-file -e HEAD:${q} 2>/dev/null; then git restore --source=HEAD --staged --worktree -- ${q}; elif git ls-files --error-unmatch -- ${q} >/dev/null 2>&1; then git rm -rfq -- ${q}; else git clean -fdq -- ${q}; fi`;
};

export const stageCommand = (p: string) => `git add -A -- ${shq(p)}`;

/** Funciona também em repositório sem nenhum commit */
export const unstageCommand = (p: string) => `git restore --staged -- ${shq(p)} 2>/dev/null || git rm --cached -rq -- ${shq(p)}`;

/** Atualiza com rebase e envia; sem upstream configurado publica a branch atual */
export const SYNC_COMMAND =
  'if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then git pull --rebase --autostash && git push; else git push -u origin HEAD; fi';
