import type { DesignStyle, Page, Shape } from './types';

export interface DesignSnapshot {
  shapes: Shape[];
  pages: Page[];
  selectedPageId: string;
  pageViewports: Record<string, { x: number; y: number; zoom: number }>;
  styles: DesignStyle[];
}

export interface VersionEntry {
  id: string;
  label: string;
  createdAt: number;
  shapeCount: number;
}

const MAX_VERSIONS = 40;

const dir = (workspacePath: string) => `${workspacePath}/.devflow/design2/versions`;

export const defaultVersionLabel = (d = new Date()) =>
  `Versão ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

/** Mantém só as versões mais recentes; devolve também as removidas (para apagar os arquivos). */
export function trimVersions(list: VersionEntry[], max = MAX_VERSIONS): { kept: VersionEntry[]; dropped: VersionEntry[] } {
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
  return { kept: sorted.slice(0, max), dropped: sorted.slice(max) };
}

export async function listVersions(workspacePath: string): Promise<VersionEntry[]> {
  try {
    const res = await (window as any).electronAPI?.fs?.readFile?.(`${dir(workspacePath)}/index.json`);
    const parsed = res?.content ? JSON.parse(res.content) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveVersion(workspacePath: string, snapshot: DesignSnapshot, label?: string): Promise<VersionEntry> {
  const fs = (window as any).electronAPI?.fs;
  const entry: VersionEntry = {
    id: `v-${Date.now().toString(36)}`,
    label: label?.trim() || defaultVersionLabel(),
    createdAt: Date.now(),
    shapeCount: snapshot.shapes.length,
  };
  await fs.writeFile(`${dir(workspacePath)}/${entry.id}.json`, JSON.stringify(snapshot));
  const { kept, dropped } = trimVersions([entry, ...(await listVersions(workspacePath))]);
  await fs.writeFile(`${dir(workspacePath)}/index.json`, JSON.stringify(kept, null, 2));
  for (const d of dropped) fs.deleteItem?.(`${dir(workspacePath)}/${d.id}.json`)?.catch?.(() => {});
  return entry;
}

export async function loadVersion(workspacePath: string, id: string): Promise<DesignSnapshot | null> {
  try {
    const res = await (window as any).electronAPI?.fs?.readFile?.(`${dir(workspacePath)}/${id}.json`);
    return res?.content ? JSON.parse(res.content) : null;
  } catch {
    return null;
  }
}

export async function deleteVersion(workspacePath: string, id: string): Promise<VersionEntry[]> {
  const fs = (window as any).electronAPI?.fs;
  const next = (await listVersions(workspacePath)).filter((v) => v.id !== id);
  await fs.writeFile(`${dir(workspacePath)}/index.json`, JSON.stringify(next, null, 2));
  fs.deleteItem?.(`${dir(workspacePath)}/${id}.json`)?.catch?.(() => {});
  return next;
}
