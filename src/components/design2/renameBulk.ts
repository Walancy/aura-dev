/**
 * Renomear em massa. No padrão: {n} = sequência (começa em `start`, com `pad` dígitos), {nome} = nome atual.
 * Localizar/substituir roda antes, sobre o nome atual (texto simples; `useRegex` liga expressão regular).
 */
export interface RenameOptions {
  pattern: string;
  find?: string;
  replace?: string;
  useRegex?: boolean;
  start?: number;
  pad?: number;
}

export function renameOne(name: string, index: number, o: RenameOptions): string {
  let base = name;
  if (o.find) {
    try {
      base = o.useRegex ? name.replace(new RegExp(o.find, 'g'), o.replace ?? '') : name.split(o.find).join(o.replace ?? '');
    } catch {
      base = name; // regex inválida: não muda nada
    }
  }
  const n = String((o.start ?? 1) + index).padStart(Math.max(1, o.pad ?? 1), '0');
  const pattern = o.pattern === '' ? '{nome}' : o.pattern;
  return pattern.split('{nome}').join(base).split('{n}').join(n);
}

/** Novos nomes na ordem recebida. */
export function renameMany(names: string[], o: RenameOptions): string[] {
  return names.map((n, i) => renameOne(n, i, o));
}
