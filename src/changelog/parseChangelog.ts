// Lê o CHANGELOG.md da raiz (fonte única: o mesmo texto vira o arquivo do repositório, as notas da release e o modal de novidades).
export interface ChangelogItem { title?: string; text: string; images: Array<{ alt: string; src: string }> }
export interface ChangelogSection { title: string; items: ChangelogItem[] }
export interface ChangelogRelease { version: string; date?: string; sections: ChangelogSection[] }

const cmp = (a: string, b: string) => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
export const compareVersions = cmp;

export function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let rel: ChangelogRelease | null = null;
  let sec: ChangelogSection | null = null;
  let item: ChangelogItem | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const h2 = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(\S+))?/);
    if (h2) { rel = { version: h2[1], date: h2[2], sections: [] }; releases.push(rel); sec = null; item = null; continue; }
    if (!rel) continue;
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { sec = { title: h3[1].trim(), items: [] }; rel.sections.push(sec); item = null; continue; }
    if (!sec) continue;
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img && item) { item.images.push({ alt: img[1], src: img[2] }); continue; }
    const li = line.match(/^[-*]\s+(.+)/);
    if (li) {
      const t = li[1].match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
      item = t ? { title: t[1], text: t[2], images: [] } : { text: li[1], images: [] };
      sec.items.push(item);
    }
  }
  return releases;
}

/** Versões que o usuário ainda não viu, da mais nova para a mais antiga (no máximo `limit`); `seen` vazio mostra só a atual. */
export function releasesToShow(all: ChangelogRelease[], current: string, seen: string | null, limit = 3): ChangelogRelease[] {
  const released = all.filter((r) => /^\d+\.\d+\.\d+/.test(r.version) && cmp(r.version, current) <= 0).sort((a, b) => cmp(b.version, a.version));
  if (!seen) return released.slice(0, 1);
  return released.filter((r) => cmp(r.version, seen) > 0).slice(0, limit);
}
