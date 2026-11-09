import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronRight, Cloud, CloudDownload, Folder, MoreHorizontal, RefreshCw, Tag, Target } from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';
import { getFieldTokens } from '../../utils/fieldTokens';

interface Props {
  dir: string;
  themeTokens: { textPrimary: string; textSecondary: string; hoverBg: string };
  isEffectiveDark: boolean;
  accentColor: string;
  /** muda quando o status do git é recarregado (commit, checkout...): recarrega o gráfico junto */
  refreshSignal?: unknown;
  onToast?: (msg: string) => void;
  /** CLI com estilo visual: a primeira coluna e a branch atual usam a cor do estilo */
  skinned?: boolean;
}

interface Commit {
  hash: string;
  parents: string[];
  author: string;
  rel: string;
  refs: string[];
  subject: string;
}
interface Row {
  commit: Commit;
  col: number;
  before: Array<string | null>;
  after: Array<string | null>;
  isNew: boolean;
}
type Scope = 'auto' | 'all';
type FileChange = { status: string; path: string };

const LANE = 11;
const ROW_H = 24;
const R = 5; // raio das curvas
const PALETTE = ['#5ba3f0', '#f0a830', '#e0559b', '#3ec9b6', '#a78bfa', '#8fc93a', '#f26d7d', '#4fc3f7'];
let SKIN = false; // definido a cada render: a cor 0 vira a cor do estilo (variável CSS do CLI)
const color = (i: number) => (i === 0 && SKIN ? 'var(--sk)' : PALETTE[i % PALETTE.length]);
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// Distribui os commits em colunas (uma por ramificação ativa), como o gráfico do Source Control do VS Code
function layout(commits: Commit[]): Row[] {
  let lanes: Array<string | null> = [];
  const rows: Row[] = [];
  for (const c of commits) {
    const before = lanes.slice();
    let col = lanes.indexOf(c.hash);
    const isNew = col === -1;
    if (isNew) {
      const free = lanes.indexOf(null);
      col = free === -1 ? lanes.length : free;
      lanes[col] = c.hash;
    }
    lanes = lanes.map((h, i) => (h === c.hash && i !== col ? null : h)); // colunas que esperavam este commit convergem nele
    lanes[col] = c.parents[0] ?? null;
    for (const p of c.parents.slice(1)) {
      if (lanes.includes(p)) continue;
      const free = lanes.indexOf(null);
      if (free === -1) lanes.push(p);
      else lanes[free] = p;
    }
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    rows.push({ commit: c, col, before, after: lanes.slice(), isNew });
  }
  return rows;
}

const GraphCell: React.FC<{ row: Row; width: number; bg: string; isHead: boolean }> = ({ row, width, bg, isHead }) => {
  const x = (i: number) => i * LANE + LANE / 2 + 1;
  const mid = ROW_H / 2;
  const { before, after, col, commit } = row;
  const n = Math.max(before.length, after.length, col + 1);
  const segs: React.ReactNode[] = [];
  const sw = 1.6;
  for (let i = 0; i < n; i++) {
    const b = before[i] ?? null;
    const a = after[i] ?? null;
    if (i === col) {
      if (!row.isNew) segs.push(<line key={`t${i}`} x1={x(i)} y1={0} x2={x(i)} y2={mid} stroke={color(i)} strokeWidth={sw} />);
      if (a) segs.push(<line key={`b${i}`} x1={x(i)} y1={mid} x2={x(i)} y2={ROW_H} stroke={color(i)} strokeWidth={sw} />);
      continue;
    }
    const dir = col > i ? 1 : -1;
    if (b && b === commit.hash) {
      // coluna que termina neste commit: desce e curva até o nó
      segs.push(<path key={`c${i}`} d={`M ${x(i)} 0 V ${mid - R} Q ${x(i)} ${mid} ${x(i) + dir * R} ${mid} H ${x(col)}`} stroke={color(i)} strokeWidth={sw} fill="none" />);
    } else if (b && a === b) {
      segs.push(<line key={`v${i}`} x1={x(i)} y1={0} x2={x(i)} y2={ROW_H} stroke={color(i)} strokeWidth={sw} />);
    }
    if (a && a !== b) {
      // nova coluna aberta por um merge: sai do nó para o lado e curva para baixo
      segs.push(<path key={`n${i}`} d={`M ${x(col)} ${mid} H ${x(i) - (i > col ? R : -R)} Q ${x(i)} ${mid} ${x(i)} ${mid + R} V ${ROW_H}`} stroke={color(i)} strokeWidth={sw} fill="none" />);
    }
  }
  const merge = commit.parents.length > 1;
  const cx = x(col);
  return (
    <svg width={width} height={ROW_H} style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}>
      {segs}
      {isHead ? (
        <circle cx={cx} cy={mid} r={5} fill={bg} stroke={color(col)} strokeWidth={2.2} />
      ) : merge ? (
        <>
          <circle cx={cx} cy={mid} r={4.6} fill={bg} stroke={color(col)} strokeWidth={1.6} />
          <circle cx={cx} cy={mid} r={1.8} fill={color(col)} />
        </>
      ) : (
        <circle cx={cx} cy={mid} r={3.6} fill={color(col)} />
      )}
    </svg>
  );
};

const statusColor = (s: string) => (s.startsWith('A') ? '#3fb950' : s.startsWith('D') ? '#f85149' : s.startsWith('R') ? '#58a6ff' : '#e3b341');

export const GitGraphSection: React.FC<Props> = ({ dir, themeTokens, isEffectiveDark, accentColor, refreshSignal, onToast, skinned }) => {
  SKIN = !!skinned;
  const BLUE = color(0);
  const ft = getFieldTokens(isEffectiveDark);
  const [open, setOpen] = useState(true);
  const [scope, setScope] = useState<Scope>('auto');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [headHash, setHeadHash] = useState('');
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewAsTree, setViewAsTree] = useState(() => {
    try {
      return localStorage.getItem('graph_view_tree') === '1';
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, FileChange[]>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((cmd: string) => window.electronAPI!.shell!.exec(cmd, dir), [dir]);

  const load = useCallback(async () => {
    if (!dir || !window.electronAPI?.shell?.exec) return;
    setLoading(true);
    try {
      // Auto: a branch atual e a remota dela; Todas: todas as referências
      const range = scope === 'all' ? '--all' : 'HEAD $(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)';
      const [res, head, who] = await Promise.all([
        exec(`git log ${range} --date-order -n 120 --pretty=format:'%H%x1f%P%x1f%an%x1f%ar%x1f%D%x1f%s'`),
        exec('git rev-parse HEAD'),
        exec('git config user.name'),
      ]);
      setHeadHash(head.stdout.trim());
      setMe(who.stdout.trim());
      if (res.exitCode !== 0) {
        setCommits([]);
        return;
      }
      setCommits(
        res.stdout
          .split('\n')
          .filter(Boolean)
          .map((l) => {
            const [hash, parents, author, rel, refs, ...subject] = l.split('\x1f');
            return { hash, parents: parents ? parents.split(' ') : [], author, rel, refs: refs ? refs.split(', ').filter((r) => r && !r.endsWith('/HEAD')) : [], subject: subject.join('\x1f') };
          }),
      );
    } finally {
      setLoading(false);
    }
  }, [dir, scope, exec]);

  useEffect(() => {
    if (open) load();
  }, [open, load, refreshSignal]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const rows = useMemo(() => layout(commits), [commits]);
  const bg = isEffectiveDark ? '#141416' : '#ffffff';

  const runGit = async (label: string, cmd: string, ok: string) => {
    if (busy) return;
    setBusy(label);
    try {
      const res = await exec(cmd);
      logSystemActivity('git', `graph_${label}`, dir.split('/').pop() || 'repo', { ok: res.exitCode === 0 });
      onToast?.(res.exitCode === 0 ? ok : `Falhou: ${(res.stderr || res.stdout || '').trim().split('\n')[0] || label}`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const toggleCommit = async (hash: string) => {
    const next = expanded === hash ? null : hash;
    setExpanded(next);
    if (!next || files[hash]) return;
    const res = await exec(`git show --name-status --format= ${hash}`);
    setFiles((prev) => ({
      ...prev,
      [hash]: res.stdout
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const [status, ...p] = l.split('\t');
          return { status, path: p[p.length - 1] };
        }),
    }));
  };

  const iconBtn = (title: string, onClick: () => void, icon: React.ReactNode, active = false) => (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ background: active ? themeTokens.hoverBg : 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s ease, color 0.12s ease', flexShrink: 0 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = themeTokens.hoverBg;
        e.currentTarget.style.color = themeTokens.textPrimary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? themeTokens.hoverBg : 'transparent';
        e.currentTarget.style.color = themeTokens.textSecondary;
      }}
    >
      {icon}
    </button>
  );

  const renderRef = (ref: string) => {
    const head = ref.startsWith('HEAD -> ');
    const label = ref.replace('HEAD -> ', '');
    if (label.startsWith('tag: ')) {
      return (
        <span key={ref} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#f0a830', background: '#f0a83026', padding: '1px 7px', borderRadius: 10, maxWidth: 110, flexShrink: 0 }}>
          <Tag size={10} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label.slice(5)}</span>
        </span>
      );
    }
    if (!head && label.includes('/')) {
      // remota: só o ícone de nuvem (o nome completo fica na dica)
      return (
        <span key={ref} title={label} style={{ width: 20, height: 20, borderRadius: '50%', background: '#a78bfa', color: '#17122b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Cloud size={12} />
        </span>
      );
    }
    return (
      <span key={ref} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '1px 8px 1px 6px', borderRadius: 10, maxWidth: 120, flexShrink: 0, background: head ? BLUE : mix(BLUE, 17), color: head ? (skinned ? 'var(--sk-ink, #0a0a0a)' : '#0b1b33') : BLUE }}>
        <Target size={11} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </span>
    );
  };

  const renderFiles = (hash: string, indent: number) => {
    const list = files[hash];
    if (!list) return <div style={{ padding: '4px 0 4px', paddingLeft: indent, fontSize: 11, color: themeTokens.textSecondary }}>Carregando arquivos...</div>;
    if (list.length === 0) return <div style={{ padding: '4px 0', paddingLeft: indent, fontSize: 11, color: themeTokens.textSecondary }}>Sem arquivos alterados</div>;
    const sorted = [...list].sort((a, b) => a.path.localeCompare(b.path));
    const item = (f: FileChange, label: string, depth: number) => (
      <div key={f.path} title={f.path} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 22, paddingLeft: indent + depth * 12, paddingRight: 4, fontSize: 11.5, color: themeTokens.textPrimary }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
        <span style={{ color: statusColor(f.status), fontSize: 10.5, flexShrink: 0 }}>{f.status[0]}</span>
      </div>
    );
    if (!viewAsTree) return <>{sorted.map((f) => item(f, f.path, 0))}</>;
    const out: React.ReactNode[] = [];
    const seen = new Set<string>();
    for (const f of sorted) {
      const parts = f.path.split('/');
      parts.slice(0, -1).forEach((_, i) => {
        const key = parts.slice(0, i + 1).join('/');
        if (seen.has(key)) return;
        seen.add(key);
        out.push(
          <div key={`d:${key}`} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 22, paddingLeft: indent + i * 12, fontSize: 11.5, color: themeTokens.textSecondary }}>
            <Folder size={12} />
            <span>{parts[i]}</span>
          </div>,
        );
      });
      out.push(item(f, parts[parts.length - 1], parts.length - 1));
    }
    return <>{out}</>;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div onClick={() => setOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 0', userSelect: 'none', minHeight: 26 }}>
        <ChevronRight size={12} color={themeTokens.textSecondary} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: skinned ? 'var(--sk-ls, 0)' : undefined }}>Graph</span>
        <div style={{ flex: 1 }} />
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title={scope === 'auto' ? 'Mostrando a branch atual e a remota dela (clique para ver todas)' : 'Mostrando todas as referências (clique para voltar ao automático)'}
              onClick={() => setScope((s) => (s === 'auto' ? 'all' : 'auto'))}
              style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', fontSize: 11, padding: '0 6px', height: 22, borderRadius: 4, fontFamily: 'inherit' }}
            >
              {scope === 'auto' ? 'Auto' : 'Todas'}
            </button>
            {iconBtn('Ir para o commit atual', () => (listRef.current?.querySelector('[data-head="1"]') as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), <Target size={14} />)}
            {iconBtn('Fetch (todas as remotas)', () => runGit('fetch', 'git fetch --all --prune', 'Fetch concluído'), <CloudDownload size={14} className={busy === 'fetch' ? 'spin-animate' : ''} />)}
            {iconBtn('Pull', () => runGit('pull', 'git pull', 'Pull concluído'), <ArrowDownToLine size={14} className={busy === 'pull' ? 'spin-animate' : ''} />)}
            {iconBtn('Push', () => runGit('push', 'git push', 'Push concluído'), <ArrowUpFromLine size={14} className={busy === 'push' ? 'spin-animate' : ''} />)}
            {iconBtn('Atualizar o gráfico', load, <RefreshCw size={13} className={loading ? 'spin-animate' : ''} />)}
            <div ref={menuRef} style={{ position: 'relative' }}>
              {iconBtn('Mais ações', () => setMenuOpen((v) => !v), <MoreHorizontal size={14} />, menuOpen)}
              {menuOpen && (
                <div className="df-dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 170, background: ft.dropdownMenuBg, border: ft.dropdownBorder, borderRadius: 8, boxShadow: 'none', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 9999 }}>
                  {[
                    { label: 'Ver como lista', tree: false },
                    { label: 'Ver como árvore', tree: true },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => {
                        setViewAsTree(o.tree);
                        setMenuOpen(false);
                        try {
                          localStorage.setItem('graph_view_tree', o.tree ? '1' : '0');
                        } catch {}
                      }}
                      style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: themeTokens.textPrimary, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: 14, display: 'flex' }}>{viewAsTree === o.tree && <Check size={13} />}</span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {open &&
        (rows.length === 0 ? (
          <div style={{ padding: '14px 0', textAlign: 'center', color: themeTokens.textSecondary, fontSize: 11 }}>{loading ? 'Carregando histórico...' : 'Nenhum commit encontrado'}</div>
        ) : (
          <div ref={listRef} style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r) => {
              const isHead = r.commit.hash === headHash;
              const lanes = Math.max(r.before.length, r.after.length, r.col + 1);
              const width = lanes * LANE + 2;
              const isOpen = expanded === r.commit.hash;
              const showAuthor = r.commit.author && r.commit.author !== me;
              return (
                <React.Fragment key={r.commit.hash}>
                  <div
                    data-head={isHead ? '1' : undefined}
                    onClick={() => toggleCommit(r.commit.hash)}
                    title={`${r.commit.hash.slice(0, 7)} • ${r.commit.author} • ${r.commit.rel}\n${r.commit.subject}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, height: ROW_H, borderRadius: 4, cursor: 'pointer', transition: 'background 0.1s ease', background: isOpen ? themeTokens.hoverBg : 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isOpen ? themeTokens.hoverBg : 'transparent')}
                  >
                    <GraphCell row={r} width={width} bg={bg} isHead={isHead} />
                    <span style={{ minWidth: 0, flex: '0 1 auto', fontSize: 12, fontWeight: isHead ? 600 : 400, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.commit.subject}</span>
                    {showAuthor && <span style={{ fontSize: 11, color: themeTokens.textSecondary, flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.commit.author}</span>}
                    <span style={{ flex: 1 }} />
                    {r.commit.refs.slice(0, 3).map(renderRef)}
                  </div>
                  {isOpen && <div style={{ paddingBottom: 4 }}>{renderFiles(r.commit.hash, width + 8)}</div>}
                </React.Fragment>
              );
            })}
          </div>
        ))}
    </div>
  );
};
