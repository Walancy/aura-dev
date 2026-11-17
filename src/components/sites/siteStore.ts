// Sites da aba Sites: cada um é uma pasta em ~/.aura-dev/sites/<id> com index.html, site.json (metadados),
// chat.json (conversa) e history/ (cópias antes de cada edição da IA, para desfazer).
export interface SiteMeta {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  project?: string;
  /** domínio final do site (canonical/og:url no HTML baixado) */
  domain?: string;
  /** ID de métricas do Google Analytics 4 (G-XXXX) */
  gaId?: string;
  /** ID do projeto no Microsoft Clarity */
  clarityId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SiteChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: number;
  error?: boolean;
  /** rótulos dos elementos selecionados no preview quando o pedido foi feito */
  selection?: string[];
  /** referências (URL/screenshots) anexadas ao pedido */
  refs?: string[];
  /** miniaturas (data URL reduzida) das imagens de `refs`, na mesma ordem; null para URLs */
  refImages?: Array<string | null>;
  workedDuration?: string;
}

/** Reduz a imagem anexada para guardar no histórico do chat sem inflar o chat.json. */
export function shrinkImage(dataUrl: string, max = 720): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/webp', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const fsApi = () => (window as any).electronAPI?.fs;

let rootCache: string | null = null;
export async function sitesRoot(): Promise<string> {
  if (rootCache) return rootCache;
  const home: string = (await fsApi()?.getHomeDir?.()) || '';
  rootCache = `${home}/.aura-dev/sites`;
  return rootCache;
}

export const siteDir = (root: string, id: string) => `${root}/${id}`;

// Modelos do usuário (prompts colados, como os do GetLayers): ficam só na máquina, em _templates/<id>.json + <id>.md
export interface CustomTemplateMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  colors: [string, string, string];
  source?: string;
}
export type CustomTemplate = CustomTemplateMeta & { brief: string };

export async function listCustomTemplates(): Promise<CustomTemplate[]> {
  const root = await sitesRoot();
  const dir = `${root}/_templates`;
  const metas = await Promise.all(
    (await listDir(dir))
      .filter((n) => !n.isDirectory && n.name.endsWith('.json'))
      .map(async (n) => {
        const meta = await readJson<CustomTemplateMeta>(n.path);
        if (!meta?.id) return null;
        try {
          const md = await fsApi()?.readFile(`${dir}/${meta.id}.md`);
          return typeof md?.content === 'string' && md.content.trim() ? ({ ...meta, brief: md.content } as CustomTemplate) : null;
        } catch {
          return null;
        }
      }),
  );
  return metas.filter((m): m is CustomTemplate => !!m).sort((a, b) => a.name.localeCompare(b.name));
}

const PALETTES: Array<[string, string, string]> = [
  ['#111111', '#7c6cff', '#f5f3ff'],
  ['#f6f7f9', '#0f766e', '#0a0a0a'],
  ['#1c1917', '#d4a373', '#faf5ef'],
  ['#0f172a', '#f472b6', '#f8fafc'],
];

export async function saveCustomTemplate(input: { name: string; brief: string; source?: string }): Promise<CustomTemplate> {
  const root = await sitesRoot();
  const dir = `${root}/_templates`;
  const base = slugify(input.name);
  const existing = new Set((await listDir(dir)).map((n) => n.name.replace(/\.(json|md)$/, '')));
  let id = base;
  for (let i = 2; existing.has(id); i++) id = `${base}-${i}`;
  const brief = input.brief.trim();
  const firstLine = brief.split('\n').find((l) => l.replace(/^#+\s*/, '').trim()) || '';
  const meta: CustomTemplateMeta = {
    id,
    name: input.name.trim(),
    category: input.source === 'getlayers' ? 'GetLayers' : 'Seu modelo',
    description: firstLine.replace(/^#+\s*/, '').slice(0, 140),
    colors: PALETTES[id.length % PALETTES.length],
    source: input.source,
  };
  await fsApi()?.createItem(dir, true);
  await fsApi()?.writeFile(`${dir}/${id}.md`, brief);
  await fsApi()?.writeFile(`${dir}/${id}.json`, JSON.stringify(meta, null, 2));
  return { ...meta, brief };
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const root = await sitesRoot();
  await fsApi()?.deleteItem(`${root}/_templates/${id}.json`);
  await fsApi()?.deleteItem(`${root}/_templates/${id}.md`);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site';
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const r = await fsApi()?.readFile(file);
    return r?.content ? (JSON.parse(r.content) as T) : null;
  } catch {
    return null;
  }
}

async function listDir(dir: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> {
  try {
    const r = await fsApi()?.getTree(dir, 0);
    const nodes = Array.isArray(r) ? r : r?.tree || [];
    return nodes;
  } catch {
    return [];
  }
}

export async function listSites(): Promise<SiteMeta[]> {
  const root = await sitesRoot();
  const dirs = (await listDir(root)).filter((n) => n.isDirectory);
  const metas = await Promise.all(dirs.map((d) => readJson<SiteMeta>(`${d.path}/site.json`)));
  return metas.filter((m): m is SiteMeta => !!m?.id).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSite(input: { name: string; templateId: string; templateName: string; project?: string }): Promise<SiteMeta> {
  const root = await sitesRoot();
  const base = slugify(input.name);
  const existing = new Set((await listDir(root)).map((n) => n.name));
  let id = base;
  for (let i = 2; existing.has(id); i++) id = `${base}-${i}`;
  const now = Date.now();
  const meta: SiteMeta = { id, name: input.name, templateId: input.templateId, templateName: input.templateName, project: input.project, createdAt: now, updatedAt: now };
  await fsApi()?.createItem(siteDir(root, id), true);
  await writeMeta(meta);
  return meta;
}

export async function writeMeta(meta: SiteMeta): Promise<void> {
  const root = await sitesRoot();
  await fsApi()?.writeFile(`${siteDir(root, meta.id)}/site.json`, JSON.stringify(meta, null, 2));
}

export async function readSiteHtml(id: string): Promise<string | null> {
  const root = await sitesRoot();
  try {
    const r = await fsApi()?.readFile(`${siteDir(root, id)}/index.html`);
    return typeof r?.content === 'string' && r.content.trim() ? r.content : null;
  } catch {
    return null;
  }
}

export async function writeSiteHtml(id: string, html: string): Promise<void> {
  const root = await sitesRoot();
  await fsApi()?.writeFile(`${siteDir(root, id)}/index.html`, html);
}

/** Guarda uma cópia do index.html atual em history/ (chamado antes de cada edição da IA). */
export async function backupSiteHtml(id: string): Promise<void> {
  const html = await readSiteHtml(id);
  if (!html) return;
  const root = await sitesRoot();
  const dir = `${siteDir(root, id)}/history`;
  await fsApi()?.createItem(dir, true);
  await fsApi()?.writeFile(`${dir}/${Date.now()}.html`, html);
}

export async function historyCount(id: string): Promise<number> {
  const root = await sitesRoot();
  return (await listDir(`${siteDir(root, id)}/history`)).filter((n) => n.name.endsWith('.html')).length;
}

/** Volta o index.html para a última cópia de history/ e a remove. */
export async function undoSiteHtml(id: string): Promise<string | null> {
  const root = await sitesRoot();
  const files = (await listDir(`${siteDir(root, id)}/history`)).filter((n) => n.name.endsWith('.html')).sort((a, b) => a.name.localeCompare(b.name));
  const last = files[files.length - 1];
  if (!last) return null;
  const r = await fsApi()?.readFile(last.path);
  if (typeof r?.content !== 'string') return null;
  await writeSiteHtml(id, r.content);
  await fsApi()?.deleteItem(last.path);
  return r.content;
}

export async function deleteSite(id: string): Promise<void> {
  const root = await sitesRoot();
  await fsApi()?.deleteItem(siteDir(root, id));
}

export async function readChat(id: string): Promise<SiteChatMessage[]> {
  const root = await sitesRoot();
  return (await readJson<SiteChatMessage[]>(`${siteDir(root, id)}/chat.json`)) || [];
}

export async function writeChat(id: string, messages: SiteChatMessage[]): Promise<void> {
  const root = await sitesRoot();
  await fsApi()?.writeFile(`${siteDir(root, id)}/chat.json`, JSON.stringify(messages.slice(-200)));
}
