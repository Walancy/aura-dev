import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Biblioteca de skills do DevFlow (~/.devflow/skills) e sua ativação em todos os CLIs de IA.
//
// Cada CLI tem um mecanismo diferente, então as skills ATIVAS são expostas assim:
//  - Claude Code: um plugin gerado em ~/.devflow/claude-plugin, passado via --plugin-dir em toda execução
//    (escopo só do DevFlow; não mexe em ~/.claude).
//  - Codex / Gemini CLI: links simbólicos "devflow-<skill>" em ~/.codex/skills e ~/.gemini/skills
//    (esses CLIs só descobrem skills nessas pastas).
//  - Antigravity e demais: --add-dir na pasta de skills + índice das skills ativas injetado no prompt
//    das execuções não interativas.

export interface SkillSource {
  id: string;
  label: string;
  owner: string;
  repo: string;
  branch: string;
  basePath: string; // pasta que contém uma subpasta por skill (ou categorias com subpastas)
  description?: string;
  tags?: string[];
  featured?: boolean;
  alwaysOn?: string[]; // skills que funcionam melhor sempre ligadas (ex.: ponytail)
  hidden?: boolean; // fonte criada ao instalar pelo skills.sh (não vira aba)
}

export interface RegistryResult {
  id: string;
  repo: string; // owner/repo
  skillId: string;
  name: string;
  installs: number;
  installed: boolean;
}

export interface CatalogSkill {
  id: string; // nome da pasta
  name: string;
  description: string;
  sourceId: string;
  path: string; // caminho no repositório
  treeSha: string;
  installed: boolean;
  updateAvailable: boolean;
}

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  active: boolean;
  alwaysOn: boolean; // conteúdo injetado em toda sessão, sem depender da IA decidir usar
  source: { type: 'github' | 'local' | 'created'; sourceId?: string; repo?: string; path?: string; treeSha?: string };
  installedAt: string;
  sizeBytes: number;
  fileCount: number;
  dir: string;
}

// Catálogo curado: fontes oficiais e as mais instaladas do skills.sh relevantes para desenvolvimento
const DEFAULT_SOURCES: SkillSource[] = [
  { id: 'anthropic', label: 'Anthropic', owner: 'anthropics', repo: 'skills', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'documentos'], description: 'Oficiais: PDF, Word, Excel, PowerPoint, design de frontend, testes web, criador de skills.' },
  { id: 'vercel', label: 'Vercel', owner: 'vercel-labs', repo: 'agent-skills', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'react', 'web'], description: 'Boas práticas de React/Next, React Native, design web, deploy e otimização na Vercel.' },
  { id: 'vercel-skills', label: 'Vercel · find-skills', owner: 'vercel-labs', repo: 'skills', branch: '', basePath: 'skills', featured: true, tags: ['oficial'], description: 'A skill mais instalada do skills.sh: deixa a IA encontrar e sugerir outras skills.' },
  { id: 'ponytail', label: 'Ponytail', owner: 'DietrichGebert', repo: 'ponytail', branch: '', basePath: 'skills', featured: true, tags: ['código enxuto', 'sempre ligada'], alwaysOn: ['ponytail'], description: '"Dev sênior preguiçoso": YAGNI, stdlib primeiro, menos código. Funciona sempre ligada.' },
  { id: 'superpowers', label: 'Superpowers', owner: 'obra', repo: 'superpowers', branch: '', basePath: 'skills', featured: true, tags: ['workflow', 'tdd', 'code review'], alwaysOn: ['using-superpowers'], description: 'Workflow de engenharia: planejamento, TDD, debugging sistemático, worktrees e code review.' },
  { id: 'mattpocock', label: 'Matt Pocock', owner: 'mattpocock', repo: 'skills', branch: '', basePath: 'skills', featured: true, tags: ['typescript', 'engenharia'], description: 'Engenharia e produtividade: code review, design de codebase, "grill me", pre-commit.' },
  { id: 'supabase', label: 'Supabase', owner: 'supabase', repo: 'agent-skills', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'banco de dados'], description: 'Oficiais: Supabase e boas práticas de Postgres (RLS, índices, migrations).' },
  { id: 'flutter', label: 'Flutter', owner: 'flutter', repo: 'agent-plugins', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'mobile'], description: 'Oficiais do time Flutter: arquitetura, layouts responsivos, testes de widget e integração.' },
  { id: 'expo', label: 'Expo', owner: 'expo', repo: 'skills', branch: '', basePath: 'plugins/expo/skills', featured: true, tags: ['oficial', 'mobile'], description: 'Oficiais: React Native com Expo, EAS, Tailwind, upgrades de SDK.' },
  { id: 'stripe', label: 'Stripe', owner: 'stripe', repo: 'ai', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'pagamentos'], description: 'Oficiais: boas práticas de integração e upgrades da API Stripe.' },
  { id: 'firebase', label: 'Firebase', owner: 'firebase', repo: 'agent-skills', branch: '', basePath: 'skills', featured: true, tags: ['oficial', 'backend'], description: 'Oficiais: regras de segurança, Firestore, Auth, Hosting e Functions.' },
  { id: 'addyosmani', label: 'Addy Osmani', owner: 'addyosmani', repo: 'agent-skills', branch: '', basePath: 'skills', featured: true, tags: ['web', 'performance'], description: 'Performance web, segurança, acessibilidade e qualidade de frontend.' },
  { id: 'awesome-copilot', label: 'GitHub · awesome-copilot', owner: 'github', repo: 'awesome-copilot', branch: '', basePath: 'skills', featured: true, tags: ['comunidade', 'grande'], description: 'Coleção da comunidade GitHub com 400+ skills (git, docs, diagramas, linguagens).' },
];

const LINK_PREFIX = 'devflow-';

function parseFrontmatter(md: string): { name?: string; description?: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    // Blocos YAML (>, |, >-, |-, >+, |+) ou valor vazio seguido de linhas indentadas
    const block = value.match(/^([>|])[+-]?\d*$/);
    if (block || value === '') {
      const parts: string[] = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1].trim() === '')) parts.push(lines[++i].trim());
      while (parts.length && !parts[parts.length - 1]) parts.pop();
      value = parts.join(block?.[1] === '|' ? '\n' : ' ').trim();
    }
    out[kv[1]] = value.replace(/^["']|["']$/g, '');
  }
  return { name: out.name, description: out.description };
}

const safeId = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export class SkillsService {
  readonly root = path.join(os.homedir(), '.devflow', 'skills');
  readonly pluginDir = path.join(os.homedir(), '.devflow', 'claude-plugin');
  private stateFile = path.join(this.root, '.devflow-state.json');
  private catalogCache = new Map<string, { at: number; items: CatalogSkill[] }>();

  constructor() {
    fs.mkdirSync(this.root, { recursive: true });
  }

  // ------------------------------------------------------------------ estado

  private readState(): { active: string[]; alwaysOn: string[]; sources: SkillSource[] } {
    try {
      const s = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return {
        active: Array.isArray(s.active) ? s.active : [],
        alwaysOn: Array.isArray(s.alwaysOn) ? s.alwaysOn : [],
        sources: Array.isArray(s.sources) ? s.sources : [],
      };
    } catch {
      return { active: [], alwaysOn: [], sources: [] };
    }
  }

  private writeState(state: { active: string[]; alwaysOn: string[]; sources: SkillSource[] }) {
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  getSources(): SkillSource[] {
    const custom = this.readState().sources;
    return [...DEFAULT_SOURCES, ...custom.filter((c) => !DEFAULT_SOURCES.some((d) => d.id === c.id))];
  }

  addSource(input: string): SkillSource {
    // Aceita "owner/repo", "owner/repo/pasta" ou URL do GitHub (…/tree/branch/pasta)
    const cleaned = input.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const treeMatch = cleaned.match(/^([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)$/);
    const [owner, repo, ...rest] = cleaned.split('/');
    if (!owner || !repo) throw new Error('Informe owner/repo ou a URL do repositório.');
    const source: SkillSource = treeMatch
      ? { id: safeId(`${treeMatch[1]}-${treeMatch[2]}-${treeMatch[4] || 'root'}`), label: `${treeMatch[1]}/${treeMatch[2]}`, owner: treeMatch[1], repo: treeMatch[2], branch: treeMatch[3], basePath: treeMatch[4].replace(/\/$/, '') }
      : { id: safeId(`${owner}-${repo}-${rest.join('-') || 'root'}`), label: `${owner}/${repo}`, owner, repo, branch: '', basePath: rest.join('/') };
    const state = this.readState();
    if (!state.sources.some((s) => s.id === source.id)) state.sources.push(source);
    this.writeState(state);
    return source;
  }

  removeSource(id: string) {
    const state = this.readState();
    state.sources = state.sources.filter((s) => s.id !== id);
    this.writeState(state);
    this.catalogCache.delete(id);
  }

  // ------------------------------------------------------------------ instaladas

  private dirSize(dir: string): { size: number; count: number } {
    let size = 0;
    let count = 0;
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith('.devflow')) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else {
          size += fs.statSync(p).size;
          count++;
        }
      }
    };
    try {
      walk(dir);
    } catch {}
    return { size, count };
  }

  listInstalled(): InstalledSkill[] {
    const state = this.readState();
    const active = new Set(state.active);
    const alwaysOn = new Set(state.alwaysOn);
    const out: InstalledSkill[] = [];
    for (const e of fs.readdirSync(this.root, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const dir = path.join(this.root, e.name);
      const skillMd = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      let meta: any = {};
      try {
        meta = JSON.parse(fs.readFileSync(path.join(dir, '.devflow-meta.json'), 'utf8'));
      } catch {}
      const { size, count } = this.dirSize(dir);
      out.push({
        id: e.name,
        name: fm.name || e.name,
        description: fm.description || '',
        active: active.has(e.name),
        alwaysOn: alwaysOn.has(e.name),
        source: meta.source || { type: 'local' },
        installedAt: meta.installedAt || fs.statSync(skillMd).mtime.toISOString(),
        sizeBytes: size,
        fileCount: count,
        dir,
      });
    }
    return out.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }

  getActive(): InstalledSkill[] {
    return this.listInstalled().filter((s) => s.active);
  }

  readSkill(id: string): string {
    return fs.readFileSync(path.join(this.root, id, 'SKILL.md'), 'utf8');
  }

  setActive(id: string, active: boolean) {
    const state = this.readState();
    const set = new Set(state.active);
    if (active) {
      if (!fs.existsSync(path.join(this.root, id, 'SKILL.md'))) throw new Error('Skill não instalada.');
      set.add(id);
    } else set.delete(id);
    state.active = Array.from(set);
    this.writeState(state);
    this.sync();
  }

  setAlwaysOn(id: string, on: boolean) {
    const state = this.readState();
    const set = new Set(state.alwaysOn);
    if (on) set.add(id);
    else set.delete(id);
    state.alwaysOn = Array.from(set);
    this.writeState(state);
    this.sync();
  }

  uninstall(id: string) {
    const dir = path.join(this.root, id);
    if (!dir.startsWith(this.root + path.sep)) throw new Error('Caminho inválido.');
    this.setActive(id, false);
    this.setAlwaysOn(id, false);
    fs.rmSync(dir, { recursive: true, force: true });
    this.sync();
  }

  create(input: { name: string; description: string; body: string }): InstalledSkill {
    const id = safeId(input.name);
    if (!id) throw new Error('Nome inválido.');
    const dir = path.join(this.root, id);
    if (fs.existsSync(dir)) throw new Error(`Já existe uma skill "${id}".`);
    fs.mkdirSync(dir, { recursive: true });
    const desc = input.description.replace(/\n/g, ' ').trim();
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${id}\ndescription: ${desc}\n---\n\n${input.body.trim()}\n`);
    fs.writeFileSync(path.join(dir, '.devflow-meta.json'), JSON.stringify({ source: { type: 'created' }, installedAt: new Date().toISOString() }, null, 2));
    return this.listInstalled().find((s) => s.id === id)!;
  }

  updateSkillMd(id: string, content: string) {
    const file = path.join(this.root, id, 'SKILL.md');
    if (!fs.existsSync(file)) throw new Error('Skill não instalada.');
    if (!/^---\s*\n[\s\S]*?\n---/.test(content)) throw new Error('O SKILL.md precisa começar com o frontmatter (--- name / description ---).');
    fs.writeFileSync(file, content);
  }

  importLocal(srcDir: string): InstalledSkill {
    const skillMd = path.join(srcDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) throw new Error('A pasta escolhida não tem um SKILL.md.');
    const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
    const id = safeId(fm.name || path.basename(srcDir));
    const dest = path.join(this.root, id);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(srcDir, dest, { recursive: true, filter: (p) => !/\/(\.git|node_modules)(\/|$)/.test(p) });
    fs.writeFileSync(path.join(dest, '.devflow-meta.json'), JSON.stringify({ source: { type: 'local', path: srcDir }, installedAt: new Date().toISOString() }, null, 2));
    this.sync();
    return this.listInstalled().find((s) => s.id === id)!;
  }

  // Skills que já existem soltas no ~/.claude/skills do usuário (podem ser importadas)
  listExternal(): Array<{ id: string; name: string; description: string; dir: string; cli: string }> {
    const out: Array<{ id: string; name: string; description: string; dir: string; cli: string }> = [];
    const roots: Array<[string, string]> = [
      [path.join(os.homedir(), '.claude', 'skills'), 'Claude Code'],
      [path.join(os.homedir(), '.codex', 'skills'), 'Codex'],
      [path.join(os.homedir(), '.gemini', 'skills'), 'Gemini'],
    ];
    const installed = new Set(this.listInstalled().map((s) => s.id));
    for (const [root, cli] of roots) {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.name.startsWith(LINK_PREFIX) || e.name.startsWith('.')) continue;
        const dir = path.join(root, e.name);
        const md = path.join(dir, 'SKILL.md');
        if (!fs.existsSync(md)) continue;
        const fm = parseFrontmatter(fs.readFileSync(md, 'utf8'));
        const id = safeId(fm.name || e.name);
        if (installed.has(id)) continue;
        out.push({ id, name: fm.name || e.name, description: fm.description || '', dir, cli });
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ catálogo remoto

  private async gh(url: string, token?: string): Promise<any> {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'devflow-desktop', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!res.ok) {
      let msg = '';
      try {
        msg = ((await res.json()) as any)?.message || '';
      } catch {}
      throw new Error(`GitHub respondeu ${res.status}${msg ? `: ${msg}` : ''}`);
    }
    return res.json();
  }

  private async resolveBranch(src: SkillSource, token?: string): Promise<string> {
    if (src.branch) return src.branch;
    const repo = await this.gh(`https://api.github.com/repos/${src.owner}/${src.repo}`, token);
    return repo.default_branch || 'main';
  }

  async listCatalog(sourceId: string, force = false, token?: string): Promise<CatalogSkill[]> {
    const src = this.getSources().find((s) => s.id === sourceId);
    if (!src) throw new Error('Fonte de skills desconhecida.');
    const hit = this.catalogCache.get(sourceId);
    if (!force && hit && Date.now() - hit.at < 30 * 60 * 1000) return this.decorate(hit.items);

    const branch = await this.resolveBranch(src, token);
    const tree = await this.gh(`https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);
    const base = src.basePath ? `${src.basePath.replace(/\/$/, '')}/` : '';
    const nodes: any[] = tree.tree || [];
    // Uma skill = pasta com SKILL.md (direto na base ou um nível abaixo)
    // Uma skill = pasta com SKILL.md direto na base ou dentro de uma categoria (ex.: skills/engineering/tdd)
    const skillFiles = nodes.filter((n) => n.type === 'blob' && n.path.startsWith(base) && /(^|\/)SKILL\.md$/.test(n.path) && n.path.slice(base.length).split('/').length <= 3);
    const fetchOne = async (f: any) => {
        const dirPath = path.posix.dirname(f.path);
        const dirNode = nodes.find((n) => n.type === 'tree' && n.path === dirPath);
        let fm: { name?: string; description?: string } = {};
        try {
          const raw = await fetch(`https://raw.githubusercontent.com/${src.owner}/${src.repo}/${branch}/${f.path}`);
          if (raw.ok) fm = parseFrontmatter(await raw.text());
        } catch {}
        const id = safeId(fm.name || path.posix.basename(dirPath));
        return {
          id,
          name: fm.name || path.posix.basename(dirPath),
          description: fm.description || '',
          sourceId,
          path: dirPath,
          treeSha: dirNode?.sha || f.sha,
          installed: false,
          updateAvailable: false,
        } as CatalogSkill;
    };
    // Em lotes: repositórios como o awesome-copilot têm centenas de skills
    const items: CatalogSkill[] = [];
    for (let i = 0; i < skillFiles.length; i += 24) items.push(...(await Promise.all(skillFiles.slice(i, i + 24).map(fetchOne))));
    items.sort((a, b) => a.name.localeCompare(b.name));
    this.catalogCache.set(sourceId, { at: Date.now(), items });
    return this.decorate(items);
  }

  private decorate(items: CatalogSkill[]): CatalogSkill[] {
    const installed = new Map(this.listInstalled().map((s) => [s.id, s]));
    return items.map((it) => {
      const local = installed.get(it.id);
      return { ...it, installed: Boolean(local), updateAvailable: Boolean(local && local.source.type === 'github' && local.source.treeSha && local.source.treeSha !== it.treeSha) };
    });
  }

  // Busca no diretório aberto skills.sh (Vercel)
  async searchRegistry(query: string): Promise<RegistryResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const res = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(q)}&limit=40`, { headers: { 'User-Agent': 'devflow-desktop' } });
    if (!res.ok) throw new Error(`skills.sh respondeu ${res.status}`);
    const data: any = await res.json();
    const installed = new Set(this.listInstalled().map((s) => s.id));
    return (data.skills || [])
      .filter((s: any) => typeof s.source === 'string' && /^[^/]+\/[^/]+$/.test(s.source)) // só repositórios do GitHub
      .map((s: any) => ({ id: s.id, repo: s.source, skillId: s.skillId, name: s.name || s.skillId, installs: s.installs || 0, installed: installed.has(safeId(s.name || s.skillId)) }));
  }

  // Instala uma skill do skills.sh: localiza a pasta dela dentro do repositório pelo nome
  async installFromRegistry(repoFull: string, skillId: string, token?: string): Promise<InstalledSkill> {
    const [owner, repo] = repoFull.split('/');
    const src: SkillSource = { id: safeId(`${owner}-${repo}-root`), label: repoFull, owner, repo, branch: '', basePath: '', hidden: true };
    const branch = await this.resolveBranch(src, token);
    const tree = await this.gh(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);
    const skillFiles: any[] = (tree.tree || []).filter((n: any) => n.type === 'blob' && /(^|\/)SKILL\.md$/.test(n.path));
    const dirOf = (p: string) => path.posix.dirname(p);
    const wanted = skillId.toLowerCase();
    // 1) pasta com o mesmo nome (preferindo a mais rasa); 2) frontmatter "name" igual
    let match = skillFiles
      .filter((f) => path.posix.basename(dirOf(f.path)).toLowerCase() === wanted)
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
    if (!match) {
      for (let i = 0; i < skillFiles.length && !match; i += 24) {
        const batch = await Promise.all(
          skillFiles.slice(i, i + 24).map(async (f) => {
            const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`);
            return r.ok && parseFrontmatter(await r.text()).name?.toLowerCase() === wanted ? f : null;
          }),
        );
        match = batch.find(Boolean);
      }
    }
    if (!match) throw new Error(`Não encontrei a skill "${skillId}" em ${repoFull}.`);
    // Registra a fonte (oculta) para permitir atualizar depois
    const state = this.readState();
    if (!this.getSources().some((s) => s.id === src.id)) {
      state.sources.push(src);
      this.writeState(state);
    }
    return this.install(src.id, dirOf(match.path), token);
  }

  async install(sourceId: string, skillPath: string, token?: string): Promise<InstalledSkill> {
    const src = this.getSources().find((s) => s.id === sourceId);
    if (!src) throw new Error('Fonte de skills desconhecida.');
    const branch = await this.resolveBranch(src, token);
    const tree = await this.gh(`https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);
    const prefix = `${skillPath.replace(/\/$/, '')}/`;
    const files: any[] = (tree.tree || []).filter((n: any) => n.type === 'blob' && n.path.startsWith(prefix));
    if (!files.some((f) => f.path === `${prefix}SKILL.md`)) throw new Error('SKILL.md não encontrado nessa pasta.');
    if (files.length > 400) throw new Error('Skill grande demais (mais de 400 arquivos).');
    const skillMdRaw = await fetch(`https://raw.githubusercontent.com/${src.owner}/${src.repo}/${branch}/${prefix}SKILL.md`).then((r) => r.text());
    const id = safeId(parseFrontmatter(skillMdRaw).name || path.posix.basename(skillPath));
    const tmp = path.join(this.root, `.tmp-${id}-${Date.now()}`);
    fs.mkdirSync(tmp, { recursive: true });
    try {
      // Baixa em lotes para não abrir centenas de conexões
      for (let i = 0; i < files.length; i += 8) {
        await Promise.all(
          files.slice(i, i + 8).map(async (f) => {
            const rel = f.path.slice(prefix.length);
            const dest = path.join(tmp, rel);
            if (!dest.startsWith(tmp + path.sep)) return;
            const res = await fetch(`https://raw.githubusercontent.com/${src.owner}/${src.repo}/${branch}/${f.path.split('/').map(encodeURIComponent).join('/')}`);
            if (!res.ok) throw new Error(`Falha ao baixar ${rel} (${res.status})`);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
            if (/\.(sh|py)$/.test(rel) && f.mode === '100755') fs.chmodSync(dest, 0o755);
          }),
        );
      }
      const dirNode = (tree.tree || []).find((n: any) => n.type === 'tree' && n.path === skillPath.replace(/\/$/, ''));
      fs.writeFileSync(
        path.join(tmp, '.devflow-meta.json'),
        JSON.stringify({ source: { type: 'github', sourceId, repo: `${src.owner}/${src.repo}`, path: skillPath, treeSha: dirNode?.sha }, installedAt: new Date().toISOString() }, null, 2),
      );
      const dest = path.join(this.root, id);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(tmp, dest);
      if (src.alwaysOn?.includes(id)) {
        const st = this.readState();
        if (!st.alwaysOn.includes(id)) st.alwaysOn.push(id);
        this.writeState(st);
      }
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }
    this.sync();
    return this.listInstalled().find((s) => s.id === id)!;
  }

  // ------------------------------------------------------------------ integração com os CLIs

  // Recria o plugin do Claude e os links do Codex/Gemini a partir das skills ativas
  sync() {
    const active = this.getActive();

    // Claude Code: plugin isolado
    const skillsDir = path.join(this.pluginDir, 'skills');
    fs.rmSync(skillsDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.pluginDir, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'devflow', version: '1.0.0', description: 'Skills ativadas no DevFlow' }, null, 2),
    );
    for (const s of active) {
      try {
        fs.symlinkSync(s.dir, path.join(skillsDir, s.id), 'dir');
      } catch {}
    }
    // Skills "sempre ligadas": o Claude injeta o SKILL.md no contexto ao iniciar/retomar a sessão
    const always = active.filter((s) => s.alwaysOn);
    const hooksDir = path.join(this.pluginDir, 'hooks');
    fs.rmSync(hooksDir, { recursive: true, force: true });
    if (always.length) {
      fs.mkdirSync(hooksDir, { recursive: true });
      const files = always.map((s) => `"${path.join(s.dir, 'SKILL.md')}"`).join(' ');
      fs.writeFileSync(
        path.join(hooksDir, 'hooks.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [{ matcher: 'startup|resume|clear|compact', hooks: [{ type: 'command', command: `cat ${files}`, timeout: 5 }] }],
            },
          },
          null,
          2,
        ),
      );
    }

    // Codex e Gemini: links com prefixo, removendo os que não estão mais ativos
    for (const root of [path.join(os.homedir(), '.codex', 'skills'), path.join(os.homedir(), '.gemini', 'skills')]) {
      if (!fs.existsSync(path.dirname(root))) continue; // CLI não instalado
      fs.mkdirSync(root, { recursive: true });
      for (const e of fs.readdirSync(root)) {
        if (!e.startsWith(LINK_PREFIX)) continue;
        const p = path.join(root, e);
        try {
          if (fs.lstatSync(p).isSymbolicLink()) fs.unlinkSync(p);
        } catch {}
      }
      for (const s of active) {
        try {
          fs.symlinkSync(s.dir, path.join(root, `${LINK_PREFIX}${s.id}`), 'dir');
        } catch {}
      }
    }
  }

  private cliKind(cmd: string): 'claude' | 'codex' | 'gemini' | 'agy' | 'other' {
    const base = path.basename(String(cmd || '').trim().split(/\s+/)[0] || '').toLowerCase();
    if (base.startsWith('claude')) return 'claude';
    if (base.startsWith('codex')) return 'codex';
    if (base.startsWith('gemini')) return 'gemini';
    if (base === 'agy' || base.startsWith('antigravity')) return 'agy';
    return 'other';
  }

  // Argumentos extras para qualquer execução (interativa ou não) de um CLI
  cliArgs(cmd: string): string[] {
    if (this.getActive().length === 0) return [];
    switch (this.cliKind(cmd)) {
      case 'claude':
        return ['--plugin-dir', this.pluginDir];
      case 'agy':
        return ['--add-dir', this.root];
      default:
        return []; // codex/gemini descobrem pelos links
    }
  }

  // Versão em string para comandos digitados em terminal
  cliArgsString(cmd: string): string {
    return this.cliArgs(cmd)
      .map((a) => (/[\s"'$]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a))
      .join(' ');
  }

  // Índice injetado no prompt de execuções não interativas dos CLIs sem suporte nativo a skills
  promptPreamble(cmd: string, opts: { force?: boolean } = {}): string {
    const kind = this.cliKind(cmd);
    const active = this.getActive();
    if (active.length === 0) return '';
    let out = '';
    // Sempre ligadas: instruções completas (o Claude já recebe pelo hook de SessionStart)
    if (kind !== 'claude') {
      const always = active.filter((s) => s.alwaysOn);
      for (const s of always) {
        try {
          const body = fs.readFileSync(path.join(s.dir, 'SKILL.md'), 'utf8').replace(/^---[\s\S]*?\n---\s*/, '').trim();
          out += `<skill name="${s.name}" modo="sempre-ligada">\n${body.slice(0, 12000)}\n</skill>\n\n`;
        } catch {}
      }
    }
    if (opts.force || !(kind === 'claude' || kind === 'codex' || kind === 'gemini')) {
      const onDemand = active.filter((s) => !s.alwaysOn || kind === 'claude');
      if (onDemand.length) {
        const list = onDemand.map((s) => `- ${s.name}: ${s.description.slice(0, 300)} (instruções: ${path.join(s.dir, 'SKILL.md')})`).join('\n');
        out += `<skills>\nSkills ativas nesta sessão. Quando a tarefa corresponder à descrição de uma delas, leia o SKILL.md indicado ANTES de agir e siga as instruções.\n${list}\n</skills>\n\n`;
      }
    }
    return out;
  }
}

export const skillsService = new SkillsService();
