// Garante e usa o CHANGELOG.md de cada release.
//   bun scripts/changelog.ts check <versão>   falha se a versão não tiver entrada, itens ou prints existentes
//   bun scripts/changelog.ts notes <versão>   imprime o texto da versão (vira o corpo da release no GitHub)
import { existsSync, readFileSync } from 'node:fs';
import { parseChangelog } from '../src/changelog/parseChangelog';

const [mode, rawVersion] = process.argv.slice(2);
const version = (rawVersion || '').replace(/^v/, '');
if (!['check', 'notes'].includes(mode) || !version) {
  console.error('uso: bun scripts/changelog.ts <check|notes> <versão>');
  process.exit(2);
}

const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const release = parseChangelog(md).find((r) => r.version === version);
const fail = (msg: string) => { console.error(`CHANGELOG.md: ${msg}`); process.exit(1); };

if (!release) fail(`não há a seção "## [${version}] - AAAA-MM-DD". Renomeie "[Não lançado]" e liste as novidades antes de lançar.`);
const items = release!.sections.flatMap((s) => s.items);
if (!release!.date) fail(`a versão ${version} precisa de data (## [${version}] - AAAA-MM-DD).`);
if (!items.length) fail(`a versão ${version} não tem nenhum item.`);
for (const it of items) {
  for (const im of it.images) {
    if (!existsSync(new URL(`../public/${im.src}`, import.meta.url))) fail(`print não encontrado: public/${im.src}`);
  }
}

if (mode === 'check') {
  console.log(`CHANGELOG.md ok: ${version} com ${items.length} itens.`);
} else {
  // corpo da release: só a seção da versão, sem as imagens locais (elas vivem dentro do app)
  const start = md.indexOf(`## [${version}]`);
  const next = md.indexOf('\n## [', start + 1);
  const body = md.slice(start, next === -1 ? undefined : next).split('\n').slice(1).filter((l) => !/^\s*!\[/.test(l)).join('\n').trim();
  console.log(body);
}
