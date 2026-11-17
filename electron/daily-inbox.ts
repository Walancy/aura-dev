import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BrowserWindow } from 'electron';
import { skillsService } from './skills-service';

// As IAs (CLI e chat da IDE) criam cards na Daily rodando `aura-daily`: o comando deixa um JSON na caixa de entrada abaixo,
// o app junta no arquivo da Daily (~/.aura-dev/daily-items.json) e avisa as janelas abertas.
const base = path.join(os.homedir(), '.aura-dev');
const inboxDir = path.join(base, 'daily-inbox');
const binDir = path.join(base, 'bin');
const itemsFile = path.join(base, 'daily-items.json');
export const DAILY_COMMAND = path.join(binDir, 'aura-daily');
const DAILY_JS = path.join(binDir, 'aura-daily.js');

// O comando é um script Node rodado pelo próprio executável do app (ELECTRON_RUN_AS_NODE), com `node` do sistema como alternativa.
const JS_SOURCE = `const fs = require('fs'), os = require('os'), path = require('path');
const base = path.join(os.homedir(), '.aura-dev'), inbox = path.join(base, 'daily-inbox'), file = path.join(base, 'daily-items.json');
const a = process.argv.slice(2);
const die = (m) => { console.error(m); process.exit(1); };
const COLS = { yesterday: 'ontem', blocker: 'bloqueio', today: 'hoje' };
const colOf = (v) => { v = String(v || '').toLowerCase(); if (/ontem|yesterday/.test(v)) return 'yesterday'; if (/bloq|blocker|impediment/.test(v)) return 'blocker'; return 'today'; };
const PR = { baixa: 'Baixa', media: 'Média', 'média': 'Média', alta: 'Alta', urgente: 'Urgente' };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const read = () => { try { const p = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(p) ? p : []; } catch { return []; } };
const write = (items) => { fs.mkdirSync(base, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(items)); fs.renameSync(file + '.tmp', file); };
const notify = (o) => { fs.mkdirSync(inbox, { recursive: true }); const f = path.join(inbox, Date.now() + '-' + process.pid + '-' + Math.floor(Math.random() * 1e5) + '.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); };
const opts = (list) => { const o = {}; for (let i = 0; i < list.length; i++) { const k = list[i]; if (k === '--all') { o.all = true; continue; } if (!/^-[a-zA-Z]$/.test(k)) die('opção desconhecida: ' + k); i++; o[k.slice(1)] = list[i] == null ? '' : list[i]; } return o; };
const line = (i) => i.id.slice(-8) + '\\t' + (COLS[i.category] || i.category) + '\\t' + i.dateIso + '\\t' + (i.completed ? '[x]' : '[ ]') + '\\t' + i.title + '\\t' + (i.projectName || '-') + '\\t' + (i.priority || '-');
const live = (items) => items.filter((i) => !i.deleted);
const find = (items, q) => {
  if (!q) die('informe o id (da coluna 1 do list) ou parte do título do card');
  const l = live(items);
  let m = l.filter((i) => i.id === q || (q.length >= 4 && i.id.endsWith(q)));
  if (!m.length) m = l.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()));
  if (!m.length) die('nenhum card encontrado para: ' + q + ' (rode: aura-daily list --all)');
  if (m.length > 1) die('mais de um card encontrado, use o id:\\n' + m.map(line).join('\\n'));
  return m[0];
};
const cmd = a[0];
if (!cmd) die('uso: aura-daily "Título" [opções] | list | edit <id> | done <id> | undone <id> | rm <id>   (veja a skill aura-daily)');
if (cmd === 'list') {
  const o = opts(a.slice(1));
  let l = live(read());
  if (!o.all) l = l.filter((i) => i.dateIso === (o.D || today()));
  if (o.c) l = l.filter((i) => i.category === colOf(o.c));
  if (o.p) l = l.filter((i) => (i.projectName || '').toLowerCase().includes(o.p.toLowerCase()));
  console.log(l.length ? 'id\\tcoluna\\tdata\\tfeito\\ttítulo\\tprojeto\\tprioridade\\n' + l.map(line).join('\\n') : 'Nenhum card.');
} else if (['edit', 'done', 'undone', 'rm'].includes(cmd)) {
  const items = read();
  const it = find(items, a[1]);
  const o = opts(a.slice(2));
  let msg;
  if (cmd === 'rm') { it.deleted = true; msg = 'Card removido da Daily: ' + it.title; }
  else if (cmd === 'done' || cmd === 'undone') { it.completed = cmd === 'done'; msg = (it.completed ? 'Card concluído na Daily: ' : 'Card reaberto na Daily: ') + it.title; }
  else {
    if (!Object.keys(o).length) die('nada para alterar. Opções: -T título -d descrição -c coluna -p projeto -D data -t tag -P prioridade -H horas');
    if (o.T) it.title = o.T;
    if (o.d != null) it.description = o.d || undefined;
    if (o.c) it.category = colOf(o.c);
    if (o.p != null) it.projectName = o.p || undefined;
    if (o.D) { if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(o.D)) die('data inválida, use AAAA-MM-DD'); it.dateIso = o.D; }
    if (o.t) it.tag = o.t;
    if (o.P) { it.priority = PR[o.P.toLowerCase()]; if (!it.priority) die('prioridade inválida (baixa, media, alta, urgente)'); }
    if (o.H) { const h = Number(String(o.H).replace(',', '.')); it.estimatedHours = h > 0 ? h : undefined; }
    msg = 'Card atualizado na Daily: ' + it.title;
  }
  write(items);
  notify({ op: 'refresh', message: msg });
  console.log(msg);
} else {
  const o = opts(a.slice(1));
  notify({ title: cmd, description: o.d, column: o.c || 'hoje', project: o.p, date: o.D, tag: o.t, priority: o.P, hours: o.H });
  console.log('Card criado na Daily: ' + cmd);
}
`;

const wrapper = (execPath: string) => `#!/bin/sh
# Aura Dev: gerencia os cards da aba Daily (criar, listar, editar, concluir, remover). Detalhes: skill aura-daily
js="$HOME/.aura-dev/bin/aura-daily.js"
app=${JSON.stringify(execPath)}
if [ -x "$app" ]; then ELECTRON_RUN_AS_NODE=1 exec "$app" "$js" "$@"; fi
exec node "$js" "$@"
`;

const SKILL_DESC = 'Cria, lista, edita, conclui e remove cards da aba Daily do Aura Dev quando o usuário pedir.';

const SKILL_BODY = `Quando o usuário pedir para adicionar, listar, alterar, concluir ou remover cards da Daily (reunião diária), use o comando abaixo no terminal. Não edite arquivos da Daily à mão.

Criar:
\`\`\`
${DAILY_COMMAND} "Título curto" -d "descrição opcional" -c hoje -p "nome do projeto"
\`\`\`
Opções: \`-c\` coluna (\`hoje\` padrão, \`ontem\` ou \`bloqueio\`); \`-p\` projeto; \`-D\` data AAAA-MM-DD (padrão hoje); \`-t\` tag; \`-P\` prioridade (baixa, media, alta, urgente); \`-H\` horas estimadas; \`-d\` descrição.

Listar (mostra o id, a coluna, a data, se está feito, o título, o projeto e a prioridade):
\`\`\`
${DAILY_COMMAND} list              # cards de hoje
${DAILY_COMMAND} list -D 2026-11-11 -c bloqueio -p projeto
${DAILY_COMMAND} list --all       # todas as datas
\`\`\`

Alterar um card (use o id da primeira coluna do list, ou parte do título):
\`\`\`
${DAILY_COMMAND} edit <id> -T "novo título" -d "nova descrição" -c ontem -p projeto -D 2026-11-12 -t tag -P alta -H 2
${DAILY_COMMAND} done <id>        # marcar como concluído
${DAILY_COMMAND} undone <id>      # reabrir
${DAILY_COMMAND} rm <id>          # remover
\`\`\`

Regras:
- Antes de editar, concluir ou remover, rode \`list\` para achar o id certo; se houver dúvida sobre qual card, pergunte.
- Para vários itens, rode o comando uma vez para cada.
- Só mexa nos cards quando o usuário pedir. Nunca por conta própria.
- Depois de rodar, confirme ao usuário o que mudou (título e coluna).
`;

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const columnOf = (v: string): 'yesterday' | 'blocker' | 'today' => {
  const s = (v || '').toLowerCase();
  if (/(ontem|yesterday)/.test(s)) return 'yesterday';
  if (/(bloq|blocker|impediment)/.test(s)) return 'blocker';
  return 'today';
};
const priorityOf = (v: string) => ({ baixa: 'Baixa', media: 'Média', média: 'Média', alta: 'Alta', urgente: 'Urgente' } as Record<string, string>)[(v || '').toLowerCase()];

function installTools() {
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(inboxDir, { recursive: true });
  const script = wrapper(process.execPath);
  if (!fs.existsSync(DAILY_COMMAND) || fs.readFileSync(DAILY_COMMAND, 'utf8') !== script) fs.writeFileSync(DAILY_COMMAND, script, { mode: 0o755 });
  fs.chmodSync(DAILY_COMMAND, 0o755);
  if (!fs.existsSync(DAILY_JS) || fs.readFileSync(DAILY_JS, 'utf8') !== JS_SOURCE) fs.writeFileSync(DAILY_JS, JS_SOURCE);
  // skill embutida: criada (e ligada) na primeira vez; depois o usuário pode desligar ou editar. Só a versão antiga (sem list/edit) é atualizada
  const skillMd = path.join(skillsService.root, 'aura-daily', 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    skillsService.create({ name: 'aura-daily', description: SKILL_DESC, body: SKILL_BODY });
    skillsService.setActive('aura-daily', true);
    skillsService.setAlwaysOn('aura-daily', true);
  } else if (!fs.readFileSync(skillMd, 'utf8').includes('aura-daily list') && !fs.readFileSync(skillMd, 'utf8').includes(`${DAILY_COMMAND} list`)) {
    skillsService.updateSkillMd('aura-daily', `---\nname: aura-daily\ndescription: ${SKILL_DESC}\n---\n\n${SKILL_BODY.trim()}\n`);
  }
}

function ingest() {
  let files: string[] = [];
  try {
    files = fs.readdirSync(inboxDir).filter((f) => f.endsWith('.json'));
  } catch {
    return;
  }
  if (!files.length) return;
  const created: any[] = [];
  let refreshMsg = '';
  for (const f of files) {
    const p = path.join(inboxDir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (raw && raw.op === 'refresh') {
        refreshMsg = String(raw.message || 'IA alterou cards da Daily');
        continue;
      }
      for (const c of Array.isArray(raw) ? raw : [raw]) {
        const title = String(c.title || '').trim();
        if (!title) continue;
        const hours = Number(String(c.hours || '').replace(',', '.'));
        created.push({
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          description: String(c.description || '').trim() || undefined,
          category: columnOf(c.column),
          dateIso: /^\d{4}-\d{2}-\d{2}$/.test(c.date || '') ? c.date : localDate(),
          tag: String(c.tag || '').trim() || 'IA',
          priority: priorityOf(c.priority),
          estimatedHours: hours > 0 ? hours : undefined,
          projectName: String(c.project || '').trim() || undefined,
          completed: false,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {}
    try {
      fs.unlinkSync(p);
    } catch {}
  }
  if (!created.length && !refreshMsg) return;
  let items: any[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(itemsFile, 'utf8'));
    if (Array.isArray(parsed)) items = parsed;
  } catch {}
  if (created.length) {
    items = [...items, ...created];
    fs.writeFileSync(`${itemsFile}.tmp`, JSON.stringify(items));
    fs.renameSync(`${itemsFile}.tmp`, itemsFile);
  }
  const snapshot = items.filter((i) => !i.deleted);
  const message = refreshMsg || (created.length === 1 ? `IA adicionou um card à Daily: ${created[0].title}` : `IA adicionou ${created.length} cards à Daily`);
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('dailyStore:changed', { count: created.length, titles: created.map((c) => c.title), items: created, snapshot, message, kind: refreshMsg && !created.length ? 'updated' : 'created' }));
}

export function startDailyInbox() {
  try {
    installTools();
    ingest();
    let timer: NodeJS.Timeout | undefined;
    fs.watch(inboxDir, () => {
      clearTimeout(timer);
      timer = setTimeout(ingest, 300);
    });
  } catch (err) {
    console.warn('[daily-inbox] falhou ao iniciar:', err);
  }
}
