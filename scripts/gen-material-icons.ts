// Gera src/components/design2/materialIcons.json (nome -> path "d", viewBox 24) a partir de @mui/icons-material (variante Outlined).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'node_modules/@mui/icons-material';
const out: Record<string, string> = {};
for (const f of readdirSync(dir)) {
  if (!f.endsWith('Outlined.js')) continue;
  const ds = [...readFileSync(`${dir}/${f}`, 'utf8').matchAll(/\bd: "([^"]+)"/g)].map((m) => m[1]);
  if (ds.length) out[f.replace(/Outlined\.js$/, '')] = ds.join(' ');
}
writeFileSync('src/components/design2/materialIcons.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'ícones');
