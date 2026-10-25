import type { LibComponent } from '../design2/aiScreenFromLlm';

const fileOf = (ws: string) => `${ws}/.devflow/figcraft/components.json`;
const mem = new Map<string, LibComponent[]>();

/** Biblioteca de componentes do projeto (o que a IA já desenhou e pode reutilizar com instâncias). */
export async function loadLibrary(ws?: string): Promise<LibComponent[]> {
  const key = ws || '';
  const fs = (window as any).electronAPI?.fs;
  if (ws && fs?.readFile) {
    try {
      const r = await fs.readFile(fileOf(ws));
      const list = r?.content ? JSON.parse(r.content)?.components : null;
      if (Array.isArray(list)) mem.set(key, list.filter((c: any) => c?.name && Array.isArray(c.items) && c.items.length));
    } catch { /* sem arquivo: biblioteca vazia */ }
  }
  return mem.get(key) ?? [];
}

/** Acrescenta (ou atualiza) componentes na biblioteca e grava no projeto. */
export async function saveToLibrary(ws: string | undefined, library: LibComponent[], added: LibComponent[]): Promise<void> {
  for (const c of added) {
    const at = library.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase());
    if (at >= 0) library[at] = c; else library.push(c);
  }
  const key = ws || '';
  mem.set(key, library);
  const fs = (window as any).electronAPI?.fs;
  if (ws && fs?.writeFile) await fs.writeFile(fileOf(ws), JSON.stringify({ version: 1, components: library })).catch(() => {});
}
