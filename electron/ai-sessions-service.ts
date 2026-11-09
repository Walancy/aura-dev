import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Lê as conversas que cada CLI de IA guarda em disco (o que o /resume mostra), filtradas pelo projeto aberto.

export interface AiSessionInfo {
  id: string; // o que o CLI recebe para retomar
  title: string;
  updatedAt: number;
}

const HOME = os.homedir();
const LIMIT = 60;
const noteTitle = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 100);
const isNoise = (t: string) => !t.trim() || t.trimStart().startsWith('<');

function readHead(file: string, bytes = 256 * 1024): string {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString('utf8', 0, n);
  } catch {
    return '';
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function jsonLines(text: string): any[] {
  const out: any[] = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('{')) continue;
    try {
      out.push(JSON.parse(l));
    } catch {}
  }
  return out;
}

const textOf = (content: any): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join(' ') : '';

function listClaude(cwd: string): AiSessionInfo[] {
  const dir = path.join(HOME, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  const out: AiSessionInfo[] = [];
  for (const { f, m } of files) {
    if (out.length >= LIMIT) break;
    let title = '';
    let aiTitle = '';
    for (const d of jsonLines(readHead(path.join(dir, f), 96 * 1024))) {
      if (d.type === 'ai-title' && d.aiTitle) aiTitle = d.aiTitle;
      if (!title && d.type === 'user' && !d.isMeta) {
        const t = textOf(d.message?.content);
        if (!isNoise(t)) title = t;
      }
    }
    if (!title && !aiTitle) continue; // sessão sem nenhuma mensagem real
    out.push({ id: f.replace(/\.jsonl$/, ''), title: noteTitle(aiTitle || title), updatedAt: m });
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsonl')) acc.push(p);
  }
  return acc;
}

function listCodex(cwd: string): AiSessionInfo[] {
  const root = path.join(HOME, '.codex', 'sessions');
  const names = new Map<string, string>();
  try {
    for (const d of jsonLines(fs.readFileSync(path.join(HOME, '.codex', 'session_index.jsonl'), 'utf8'))) if (d.id && d.thread_name) names.set(d.id, d.thread_name);
  } catch {}
  const out: AiSessionInfo[] = [];
  for (const file of walk(root)) {
    const lines = jsonLines(readHead(file));
    const meta = lines.find((d) => d.type === 'session_meta')?.payload;
    if (!meta?.id || meta.cwd !== cwd) continue;
    let title = names.get(meta.id) || '';
    if (!title) {
      for (const d of lines) {
        const p = d.payload;
        if (d.type === 'response_item' && p?.role === 'user') {
          const t = textOf(p.content);
          if (!isNoise(t)) {
            title = t;
            break;
          }
        }
      }
    }
    out.push({ id: meta.id, title: noteTitle(title) || `Conversa ${String(meta.id).slice(0, 8)}`, updatedAt: fs.statSync(file).mtimeMs });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMIT);
}

function listGemini(cwd: string): AiSessionInfo[] {
  let name = '';
  try {
    name = JSON.parse(fs.readFileSync(path.join(HOME, '.gemini', 'projects.json'), 'utf8'))?.projects?.[cwd] || '';
  } catch {}
  const dir = name ? path.join(HOME, '.gemini', 'tmp', name, 'chats') : '';
  if (!dir || !fs.existsSync(dir)) return [];
  const sessions: Array<{ start: number; info: AiSessionInfo }> = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl') || x.endsWith('.json'))) {
    const file = path.join(dir, f);
    const lines = jsonLines(readHead(file, 128 * 1024));
    const head = lines[0];
    if (!head?.sessionId || (head.kind && head.kind !== 'main')) continue;
    let title = '';
    for (const d of lines) {
      const msgs: any[] = d.$set?.messages || (d.type === 'user' ? [d] : []);
      for (const m of msgs) {
        if (title || m.type !== 'user') continue;
        const t = textOf(m.content);
        if (!isNoise(t)) title = t;
      }
    }
    const start = Date.parse(head.startTime) || fs.statSync(file).mtimeMs;
    sessions.push({ start, info: { id: head.sessionId, title: noteTitle(title) || `Conversa ${String(head.sessionId).slice(0, 8)}`, updatedAt: Date.parse(head.lastUpdated) || start } });
  }
  // o Gemini CLI retoma por número (--resume N), na ordem da listagem: da mais antiga para a mais nova
  sessions.sort((a, b) => a.start - b.start);
  return sessions.map((s, i) => ({ ...s.info, id: String(i + 1) })).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMIT);
}

function listAgy(cwd: string): AiSessionInfo[] {
  let raw = '';
  try {
    raw = fs.readFileSync(path.join(HOME, '.gemini', 'antigravity-cli', 'history.jsonl'), 'utf8');
  } catch {
    return [];
  }
  const byId = new Map<string, AiSessionInfo>();
  for (const d of jsonLines(raw)) {
    if (d.workspace !== cwd || !d.conversationId) continue;
    const cur = byId.get(d.conversationId) || { id: d.conversationId, title: '', updatedAt: 0 };
    if (!cur.title && d.display && !/^cd\s/.test(d.display)) cur.title = noteTitle(d.display);
    cur.updatedAt = Math.max(cur.updatedAt, d.timestamp || 0);
    byId.set(d.conversationId, cur);
  }
  return [...byId.values()]
    .map((s) => ({ ...s, title: s.title || `Conversa ${s.id.slice(0, 8)}` }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, LIMIT);
}

export function listAiSessions(provider: string, cwd: string): AiSessionInfo[] {
  if (!cwd) return [];
  try {
    if (provider === 'claude') return listClaude(cwd);
    if (provider === 'codex') return listCodex(cwd);
    if (provider === 'gemini') return listGemini(cwd);
    if (provider === 'agy' || provider === 'antigravity') return listAgy(cwd);
  } catch {}
  return [];
}
