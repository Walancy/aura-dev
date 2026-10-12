import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, ExternalLink, FolderOpen, FolderInput, Globe, Loader2, Pencil, Pin, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  active: boolean;
  alwaysOn: boolean;
  source: { type: 'github' | 'local' | 'created'; sourceId?: string; repo?: string; path?: string };
  installedAt: string;
  sizeBytes: number;
  fileCount: number;
}

interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  sourceId: string;
  path: string;
  installed: boolean;
  updateAvailable: boolean;
}

interface Source {
  id: string;
  label: string;
  owner: string;
  repo: string;
  basePath: string;
  description?: string;
  tags?: string[];
  featured?: boolean;
  alwaysOn?: string[];
  hidden?: boolean;
}

interface RegistryResult {
  id: string;
  repo: string;
  skillId: string;
  name: string;
  installs: number;
  installed: boolean;
}

const REGISTRY = '__skills_sh__';
const fmtInstalls = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

interface ExternalSkill {
  id: string;
  name: string;
  description: string;
  dir: string;
  cli: string;
}

async function call<T = any>(action: string, payload?: any): Promise<T> {
  const fn = window.electronAPI?.skills?.call;
  if (!fn) throw new Error('Reinicie o app para carregar o módulo de skills.');
  const res = await fn(action, payload);
  if (!res.success) throw new Error(res.error || 'Falha na operação.');
  return res.data as T;
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onToast: (msg: string) => void;
}

export const SkillsModal: React.FC<Props> = ({ isOpen, onClose, isEffectiveDark, accentColor, accentContrastText, onToast }) => {
  const c = useMemo(
    () => ({
      overlay: isEffectiveDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
      bg: isEffectiveDark ? '#141414' : '#ffffff',
      panel: isEffectiveDark ? '#1a1a1a' : '#f8fafc',
      hover: isEffectiveDark ? '#222222' : '#f1f5f9',
      input: isEffectiveDark ? '#1f1f1f' : '#f1f5f9',
      text: isEffectiveDark ? '#f4f4f5' : '#0f172a',
      sub: isEffectiveDark ? '#a1a1aa' : '#64748b',
      muted: isEffectiveDark ? '#71717a' : '#94a3b8',
      border: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      danger: '#ef4444',
      success: '#22c55e',
    }),
    [isEffectiveDark],
  );

  const [tab, setTab] = useState<'installed' | 'explore' | 'system'>('installed');
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [external, setExternal] = useState<ExternalSkill[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState(REGISTRY);
  const [catalog, setCatalog] = useState<CatalogSkill[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InstalledSkill | null>(null);
  const [editor, setEditor] = useState<{ id: string; content: string; original: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', body: '' });
  const [newSource, setNewSource] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryResults, setRegistryResults] = useState<RegistryResult[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [updatesAvailable, setUpdatesAvailable] = useState<Record<string, boolean>>({});

  const availableUpdatesCount = useMemo(() => {
    return installed.filter((s) => updatesAvailable[s.id]).length;
  }, [installed, updatesAvailable]);

  // Scroll auto-hide state handlers
  const [isLeftScrolling, setIsLeftScrolling] = useState(false);
  const leftScrollTimer = useRef<any>(null);
  const handleLeftScroll = useCallback(() => {
    setIsLeftScrolling(true);
    if (leftScrollTimer.current) clearTimeout(leftScrollTimer.current);
    leftScrollTimer.current = setTimeout(() => setIsLeftScrolling(false), 700);
  }, []);

  const [isRightScrolling, setIsRightScrolling] = useState(false);
  const rightScrollTimer = useRef<any>(null);
  const handleRightScroll = useCallback(() => {
    setIsRightScrolling(true);
    if (rightScrollTimer.current) clearTimeout(rightScrollTimer.current);
    rightScrollTimer.current = setTimeout(() => setIsRightScrolling(false), 700);
  }, []);

  const [isBodyScrolling, setIsBodyScrolling] = useState(false);
  const bodyScrollTimer = useRef<any>(null);
  const handleBodyScroll = useCallback(() => {
    setIsBodyScrolling(true);
    if (bodyScrollTimer.current) clearTimeout(bodyScrollTimer.current);
    bodyScrollTimer.current = setTimeout(() => setIsBodyScrolling(false), 700);
  }, []);

  useEffect(() => {
    return () => {
      if (leftScrollTimer.current) clearTimeout(leftScrollTimer.current);
      if (rightScrollTimer.current) clearTimeout(rightScrollTimer.current);
      if (bodyScrollTimer.current) clearTimeout(bodyScrollTimer.current);
    };
  }, []);

  const checkUpdates = useCallback(async (force = false) => {
    try {
      const res = await call<Record<string, boolean>>('checkUpdates', { force });
      if (res && typeof res === 'object') {
        setUpdatesAvailable(res);
      }
    } catch {}
  }, []);

  const refreshLocal = useCallback(async () => {
    try {
      const [inst, ext, srcs] = await Promise.all([call<InstalledSkill[]>('listInstalled'), call<ExternalSkill[]>('listExternal'), call<Source[]>('listSources')]);
      setInstalled(inst);
      setExternal(ext);
      setSources(srcs);
      checkUpdates();
    } catch (e: any) {
      onToast(e.message);
    }
  }, [onToast, checkUpdates]);

  const loadCatalog = useCallback(
    async (force = false) => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        setCatalog(await call<CatalogSkill[]>('listCatalog', { sourceId, force }));
      } catch (e: any) {
        setCatalogError(e.message);
        setCatalog([]);
      } finally {
        setCatalogLoading(false);
      }
    },
    [sourceId],
  );

  useEffect(() => {
    if (!isOpen) return;
    refreshLocal();
    const off = window.electronAPI?.skills?.onChanged?.(refreshLocal);
    return () => off?.();
  }, [isOpen, refreshLocal]);

  useEffect(() => {
    if (isOpen && tab === 'explore' && sourceId !== REGISTRY) loadCatalog(false);
  }, [isOpen, tab, sourceId, loadCatalog]);

  // Busca no skills.sh com debounce
  useEffect(() => {
    if (sourceId !== REGISTRY) return;
    const q = registryQuery.trim();
    if (q.length < 2) {
      setRegistryResults([]);
      setRegistryError(null);
      return;
    }
    setRegistryLoading(true);
    const timer = setTimeout(async () => {
      try {
        setRegistryResults(await call<RegistryResult[]>('searchRegistry', { query: q }));
        setRegistryError(null);
      } catch (e: any) {
        setRegistryError(e.message);
      } finally {
        setRegistryLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [registryQuery, sourceId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editor) setEditor(null);
      else if (creating) setCreating(false);
      else if (confirmDelete) setConfirmDelete(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, editor, creating, confirmDelete, onClose]);

  if (!isOpen) return null;

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) onToast(ok);
      await refreshLocal();
      if (tab === 'explore' && sourceId !== REGISTRY) await loadCatalog(false);
    } catch (e: any) {
      onToast(`Falhou: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const match = (s: { name: string; description: string }) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  const activeCount = installed.filter((s) => s.active).length;

  const pillBtn = (active: boolean): React.CSSProperties => ({
    border: 'none',
    borderRadius: 6,
    padding: '0 12px',
    height: 28,
    fontSize: 12,
    fontFamily: 'inherit',
    cursor: 'pointer',
    background: active ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
    color: active ? c.text : c.sub,
    fontWeight: active ? 500 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s ease',
  });

  const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
    border: 'none',
    borderRadius: 6,
    height: 28,
    padding: '0 10px',
    fontSize: 11.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    background: kind === 'primary' ? accentColor : kind === 'danger' ? 'rgba(239,68,68,0.14)' : c.input,
    color: kind === 'primary' ? accentContrastText : kind === 'danger' ? c.danger : c.text,
    fontWeight: kind === 'primary' ? 500 : 400,
    transition: 'all 0.15s ease',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: 'none',
    borderRadius: 6,
    background: c.input,
    color: c.text,
    fontSize: 12.5,
    fontFamily: 'inherit',
    padding: '8px 10px',
    outline: 'none',
  };

  const Toggle = ({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      style={{ width: 34, height: 19, borderRadius: 10, border: 'none', padding: 2, cursor: disabled ? 'wait' : 'pointer', background: on ? accentColor : isEffectiveDark ? '#333' : '#cbd5e1', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', flexShrink: 0 }}
    >
      <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
    </button>
  );

  const SourcePill = ({ s }: { s: InstalledSkill }) => (
    <span style={{ fontSize: 10, color: c.muted, background: c.input, borderRadius: 8, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {s.source.type === 'github' ? s.source.repo : s.source.type === 'created' ? 'criada por você' : 'importada'}
    </span>
  );

  const catalogById = new Map((catalog || []).map((x) => [x.id, x]));
  const visibleSources = sources.filter((x) => !x.hidden);
  const currentSource = sources.find((x) => x.id === sourceId);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: c.overlay, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1200px, calc(100vw - 32px))',
          height: 'min(820px, calc(100vh - 32px))',
          background: c.bg,
          borderRadius: 12,
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Poppins', -apple-system, sans-serif",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: c.text }}>Skills</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, color: c.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeCount} ativa(s) • aplicadas em todos os CLIs de IA (Claude Code, Codex, Gemini e Antigravity), em qualquer tela
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              style={btn()}
              onClick={() => {
                logSystemActivity('skills', 'open_folder', 'skills_dir');
                call('openFolder');
              }}
              title="Abrir ~/.devflow/skills"
            >
              <FolderOpen size={12} />
              <span>Abrir pasta</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: c.sub,
                cursor: 'pointer',
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                transition: 'color 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = c.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = c.sub)}
              title="Fechar (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Barra Funcional: Tabs à esquerda, Ações à direita */}
        <div style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 5,
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0',
            }}
          >
            <button
              type="button"
              style={pillBtn(tab === 'installed')}
              onClick={() => {
                logSystemActivity('skills', 'switch_tab', 'installed');
                setTab('installed');
              }}
            >
              Instaladas <span style={{ color: c.muted, fontSize: 11 }}>{installed.length}</span>
            </button>
            <button
              type="button"
              style={pillBtn(tab === 'explore')}
              onClick={() => {
                logSystemActivity('skills', 'switch_tab', 'explore', { source: REGISTRY });
                setTab('explore');
                setSourceId(REGISTRY);
              }}
            >
              Explorar
            </button>
            {external.length > 0 && (
              <button
                type="button"
                style={pillBtn(tab === 'system')}
                onClick={() => {
                  logSystemActivity('skills', 'switch_tab', 'system');
                  setTab('system');
                }}
              >
                No sistema <span style={{ color: c.muted, fontSize: 11 }}>{external.length}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {availableUpdatesCount > 0 && (
              <button
                type="button"
                style={btn('primary')}
                disabled={busy === 'update-all'}
                onClick={() => {
                  logSystemActivity('skills', 'update_all_skills', `${availableUpdatesCount} disponíveis`);
                  run('update-all', async () => {
                    const res = await call<any>('updateAll');
                    await checkUpdates(true);
                    return res;
                  }, `${availableUpdatesCount} skill(s) atualizada(s).`);
                }}
                title={`Atualizar ${availableUpdatesCount} skill(s) com nova versão disponível`}
              >
                <RefreshCw size={12} className={busy === 'update-all' ? 'animate-spin' : ''} />
                <span>{busy === 'update-all' ? 'Atualizando…' : `Atualizar skills (${availableUpdatesCount})`}</span>
              </button>
            )}
            <button
              type="button"
              style={btn('primary')}
              onClick={() => {
                setCreating(true);
                setDraft({ name: '', description: '', body: '' });
              }}
            >
              <Plus size={12} />
              <span>Nova skill</span>
            </button>
            <button
              type="button"
              style={btn()}
              onClick={async () => {
                const res = await window.electronAPI?.dialog?.openFolder?.();
                if (res?.folderPath) {
                  logSystemActivity('skills', 'import_local', res.folderPath.split('/').pop() || 'local');
                  run('import', () => call('importLocal', { dir: res.folderPath }), 'Skill importada.');
                }
              }}
            >
              <FolderInput size={12} />
              <span>Importar pasta</span>
            </button>
          </div>
        </div>

        {/* Corpo Principal */}
        <div
          onScroll={tab === 'installed' || tab === 'system' ? handleBodyScroll : undefined}
          className={tab === 'installed' || tab === 'system' ? `scroll-auto-hide ${isBodyScrolling ? 'is-scrolling' : ''}` : ''}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: tab === 'explore' ? 'hidden' : 'auto',
            padding: tab === 'explore' ? 0 : '12px 18px',
            display: tab === 'explore' ? 'flex' : 'block',
            flexDirection: tab === 'explore' ? 'column' : undefined,
          }}
        >
          {tab === 'installed' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: c.input,
                  borderRadius: 6,
                  padding: '0 10px',
                  height: 28,
                  marginBottom: 12,
                }}
              >
                <Search size={13} color={c.sub} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar skill instalada…"
                  style={{ ...inputStyle, padding: 0, background: 'transparent', height: 28, fontSize: 12 }}
                />
              </div>

              {installed.filter(match).length === 0 ? (
                <div style={{ padding: '40px 12px', textAlign: 'center', color: c.sub, fontSize: 12.5, lineHeight: 1.5 }}>
                  {installed.length === 0 ? (
                    <>
                      Nenhuma skill instalada ainda.
                      <br />
                      Baixe do catálogo oficial da Anthropic (PDF, planilhas, apresentações, design de frontend…) ou crie a sua.
                    </>
                  ) : (
                    'Nenhuma skill corresponde à busca.'
                  )}
                </div>
              ) : (
                installed.filter(match).map((s) => {
                  const remote = catalogById.get(s.id);
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 4px', borderTop: `1px solid ${c.border}` }}>
                      <div style={{ paddingTop: 2 }}>
                        <Toggle
                          on={s.active}
                          disabled={busy === `act-${s.id}`}
                          onChange={() => run(`act-${s.id}`, () => call('setActive', { id: s.id, active: !s.active }), s.active ? `"${s.name}" desativada.` : `"${s.name}" ativada em todos os CLIs.`)}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</span>
                          <SourcePill s={s} />
                          <span style={{ fontSize: 10, color: c.muted }}>
                            {s.fileCount} arquivo(s) • {fmtSize(s.sizeBytes)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: c.sub, lineHeight: 1.45, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description || 'Sem descrição.'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {updatesAvailable[s.id] && (
                          <button
                            type="button"
                            style={btn('primary')}
                            title="Nova versão disponível no repositório! Clique para atualizar"
                            disabled={busy === `upd-${s.id}`}
                            onClick={() => {
                              logSystemActivity('skills', 'update_skill', s.name, { id: s.id });
                              run(
                                `upd-${s.id}`,
                                async () => {
                                  await call('update', { id: s.id });
                                  setUpdatesAvailable((prev) => ({ ...prev, [s.id]: false }));
                                },
                                `"${s.name}" atualizada com sucesso.`
                              );
                            }}
                          >
                            <RefreshCw size={11} className={busy === `upd-${s.id}` ? 'animate-spin' : ''} />
                            <span>Atualizar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          title={s.alwaysOn ? 'Sempre ligada: injetada em toda sessão. Clique para voltar ao modo sob demanda.' : 'Sob demanda: a IA decide quando usar. Clique para deixar sempre ligada.'}
                          disabled={busy === `pin-${s.id}`}
                          onClick={() => run(`pin-${s.id}`, () => call('setAlwaysOn', { id: s.id, on: !s.alwaysOn }), s.alwaysOn ? `"${s.name}" agora é sob demanda.` : `"${s.name}" sempre ligada em toda sessão.`)}
                          style={{ ...btn(), color: s.alwaysOn ? accentColor : c.sub }}
                        >
                          <Pin size={11} /> {s.alwaysOn ? 'Sempre ligada' : 'Sob demanda'}
                        </button>
                        <button
                          type="button"
                          style={btn()}
                          title="Ver / editar SKILL.md"
                          onClick={async () => {
                            try {
                              const content = await call<string>('read', { id: s.id });
                              setEditor({ id: s.id, content, original: content });
                            } catch (e: any) {
                              onToast(e.message);
                            }
                          }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button type="button" style={btn()} title="Abrir pasta" onClick={() => call('openFolder', { id: s.id })}>
                          <FolderOpen size={11} />
                        </button>
                        <button type="button" style={btn('danger')} title="Excluir" onClick={() => setConfirmDelete(s)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'explore' && (
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
              {/* Fontes (Div Esquerda) */}
              <div
                onScroll={handleLeftScroll}
                className={`scroll-auto-hide ${isLeftScrolling ? 'is-scrolling' : ''}`}
                style={{
                  width: 250,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '14px 16px 14px 18px',
                  borderRight: `1px solid ${c.border}`,
                  overflowY: 'auto',
                }}
              >
                <div
                  onClick={() => {
                    logSystemActivity('skills', 'select_source', 'skills_sh');
                    setSourceId(REGISTRY);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: sourceId === REGISTRY ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0') : c.panel,
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: sourceId === REGISTRY ? 600 : 500, color: c.text }}>
                    <Globe size={13} color={accentColor} /> skills.sh
                  </div>
                  <div style={{ fontSize: 10.5, color: c.sub, lineHeight: 1.35, marginTop: 2 }}>
                    Buscar em 1M+ skills da comunidade (diretório aberto da Vercel)
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 500, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 4px 2px' }}>
                  Destaques
                </div>
                {visibleSources.map((src) => {
                  const isSelected = sourceId === src.id;
                  return (
                    <div
                      key={src.id}
                      onClick={() => {
                        logSystemActivity('skills', 'select_source', src.label, { id: src.id });
                        setSourceId(src.id);
                      }}
                      title={src.description}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        cursor: 'pointer',
                        background: isSelected ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0') : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.label}
                        </span>
                        {!src.featured && (
                          <span
                            title="Remover fonte"
                            onClick={(e) => {
                              e.stopPropagation();
                              run('rmsrc', () => call('removeSource', { id: src.id })).then(() => setSourceId(REGISTRY));
                            }}
                            style={{ color: c.muted, fontSize: 13, lineHeight: 1 }}
                          >
                            ×
                          </span>
                        )}
                      </div>
                      {src.tags && src.tags.length > 0 && (
                        <div style={{ fontSize: 10, color: c.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.tags.join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 4, padding: '8px 2px 0' }}>
                  <input
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="owner/repo ou URL"
                    style={{ ...inputStyle, padding: '0 8px', height: 28, fontSize: 11 }}
                  />
                  <button
                    type="button"
                    style={btn()}
                    disabled={!newSource.trim()}
                    title="Adicionar repositório como fonte"
                    onClick={() =>
                      run('addsrc', async () => {
                        const src = await call<Source>('addSource', { input: newSource });
                        setNewSource('');
                        setSourceId(src.id);
                      }, 'Fonte adicionada.')
                    }
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Lista (Div Direita) */}
              <div
                onScroll={handleRightScroll}
                className={`scroll-auto-hide ${isRightScrolling ? 'is-scrolling' : ''}`}
                style={{ flex: 1, minWidth: 0, padding: '14px 18px 14px 16px', overflowY: 'auto' }}
              >
                {sourceId === REGISTRY ? (
                  <>
                    {/* Campo de busca na div principal */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: c.input,
                        borderRadius: 6,
                        padding: '0 10px',
                        height: 28,
                        marginBottom: 10,
                      }}
                    >
                      <Search size={13} color={c.sub} />
                      <input
                        value={registryQuery}
                        onChange={(e) => setRegistryQuery(e.target.value)}
                        placeholder="Buscar no skills.sh: flutter, supabase, testes, git, stripe…"
                        style={{ ...inputStyle, padding: 0, background: 'transparent', height: 28, fontSize: 12 }}
                      />
                      {registryLoading && (
                        <Loader2 size={12} color={c.sub} style={{ animation: 'spin 1s linear infinite' }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, color: c.muted, alignSelf: 'center' }}>Sugestões populares:</span>
                      {['flutter', 'supabase', 'react', 'nextjs', 'testing', 'code review', 'git', 'security', 'docs', 'figma'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          style={{
                            ...btn(),
                            background: registryQuery === t ? (isEffectiveDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0') : c.input,
                            fontWeight: registryQuery === t ? 500 : 400,
                          }}
                          onClick={() => setRegistryQuery(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {registryError && <div style={{ fontSize: 11.5, color: '#f59e0b', padding: '6px 0' }}>{registryError}</div>}
                    {!registryQuery.trim() && (
                      <div style={{ padding: '60px 20px', textAlign: 'center', color: c.sub, fontSize: 12 }}>
                        Digite um termo no campo de busca acima ou escolha uma sugestão para explorar skills do catálogo aberto skills.sh.
                      </div>
                    )}
                    {registryResults.map((r) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderTop: `1px solid ${c.border}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{r.name}</span>
                            {r.installed && (
                              <span style={{ fontSize: 10, color: c.success, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Check size={10} /> instalada
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: c.sub, marginTop: 1 }}>
                            {r.repo} • {fmtInstalls(r.installs)} instalações
                          </div>
                        </div>
                        <button type="button" style={btn()} title="Ver no skills.sh" onClick={() => window.electronAPI?.shell?.openExternal?.(`https://skills.sh/${r.id}`)}>
                          <ExternalLink size={11} />
                        </button>
                        {r.installed ? (
                          <span style={{ ...btn(), cursor: 'default', color: c.muted }}>Baixada</span>
                        ) : (
                          <button
                            type="button"
                            style={btn('primary')}
                            disabled={busy === `reg-${r.id}`}
                            onClick={() =>
                              run(
                                `reg-${r.id}`,
                                async () => {
                                  const inst = await call<InstalledSkill>('installFromRegistry', { repo: r.repo, skillId: r.skillId });
                                  await call('setActive', { id: inst.id, active: true });
                                  setRegistryResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, installed: true } : x)));
                                },
                                `"${r.name}" baixada e ativada.`,
                              )
                            }
                          >
                            {busy === `reg-${r.id}` ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={11} />}
                            Baixar e ativar
                          </button>
                        )}
                      </div>
                    ))}
                    {registryQuery.trim().length >= 2 && !registryLoading && registryResults.length === 0 && !registryError && (
                      <div style={{ padding: 30, textAlign: 'center', color: c.sub, fontSize: 12 }}>Nada encontrado para "{registryQuery}".</div>
                    )}
                  </>
                ) : (
                  <>
                    {currentSource && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0 8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text }}>
                            {currentSource.label} <span style={{ fontSize: 11, fontWeight: 400, color: c.muted }}>{currentSource.owner}/{currentSource.repo}</span>
                          </div>
                          {currentSource.description && <div style={{ fontSize: 11.5, color: c.sub, lineHeight: 1.4, marginTop: 2 }}>{currentSource.description}</div>}
                        </div>
                        <button type="button" style={btn()} title="Abrir repositório" onClick={() => window.electronAPI?.shell?.openExternal?.(`https://github.com/${currentSource.owner}/${currentSource.repo}`)}>
                          <ExternalLink size={11} />
                        </button>
                        <button type="button" style={btn()} title="Recarregar catálogo" onClick={() => loadCatalog(true)}>
                          <RefreshCw size={11} />
                        </button>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: c.input,
                        borderRadius: 6,
                        padding: '0 10px',
                        height: 28,
                        marginBottom: 10,
                      }}
                    >
                      <Search size={13} color={c.sub} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Buscar em ${currentSource?.label || 'fonte'}…`}
                        style={{ ...inputStyle, padding: 0, background: 'transparent', height: 28, fontSize: 12 }}
                      />
                    </div>
                    {catalogError && <div style={{ fontSize: 11.5, color: '#f59e0b', padding: '6px 0' }}>{catalogError}</div>}
                    {catalogLoading && !catalog?.length ? (
                      <div style={{ padding: 40, textAlign: 'center', color: c.sub, fontSize: 12 }}>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        <div>Carregando catálogo…</div>
                      </div>
                    ) : (
                      (catalog || []).filter(match).map((s) => {
                        const suggestsAlwaysOn = currentSource?.alwaysOn?.includes(s.id);
                        return (
                          <div key={`${s.sourceId}-${s.path}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 4px', borderTop: `1px solid ${c.border}` }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</span>
                                {suggestsAlwaysOn && (
                                  <span style={{ fontSize: 10, color: accentColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Pin size={10} /> sempre ligada
                                  </span>
                                )}
                                {s.installed && (
                                  <span style={{ fontSize: 10, color: c.success, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Check size={10} /> instalada
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: c.sub, lineHeight: 1.45, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                style={btn()}
                                title="Ver no GitHub"
                                onClick={() => currentSource && window.electronAPI?.shell?.openExternal?.(`https://github.com/${currentSource.owner}/${currentSource.repo}/tree/HEAD/${s.path}`)}
                              >
                                <ExternalLink size={11} />
                              </button>
                              {s.installed && !s.updateAvailable ? (
                                <span style={{ ...btn(), cursor: 'default', color: c.muted }}>Baixada</span>
                              ) : (
                                <button
                                  type="button"
                                  style={btn('primary')}
                                  disabled={busy === `dl-${s.id}`}
                                  onClick={() =>
                                    run(
                                      `dl-${s.id}`,
                                      async () => {
                                        const inst = await call<InstalledSkill>('install', { sourceId: s.sourceId, path: s.path });
                                        if (!s.installed) await call('setActive', { id: inst.id, active: true });
                                      },
                                      s.updateAvailable ? `"${s.name}" atualizada.` : `"${s.name}" baixada e ativada.`,
                                    )
                                  }
                                >
                                  {busy === `dl-${s.id}` ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : s.updateAvailable ? <RefreshCw size={11} /> : <Download size={11} />}
                                  {s.updateAvailable ? 'Atualizar' : 'Baixar e ativar'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'system' && (
            <>
              <div style={{ fontSize: 11.5, color: c.sub, padding: '4px 0 8px', lineHeight: 1.45 }}>
                Skills encontradas nas pastas dos CLIs. Importe para gerenciá-las aqui e usá-las em todos os CLIs (o original não é alterado).
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: c.input,
                  borderRadius: 6,
                  padding: '0 10px',
                  height: 28,
                  marginBottom: 12,
                }}
              >
                <Search size={13} color={c.sub} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar skill no sistema…"
                  style={{ ...inputStyle, padding: 0, background: 'transparent', height: 28, fontSize: 12 }}
                />
              </div>
              {external.filter(match).map((s) => (
                <div key={s.dir} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 4px', borderTop: `1px solid ${c.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{s.name}</span>
                      <span style={{ fontSize: 10, color: c.muted, background: c.input, borderRadius: 8, padding: '1px 6px' }}>{s.cli}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: c.sub, lineHeight: 1.45, marginTop: 2 }}>{s.description}</div>
                  </div>
                  <button type="button" style={btn('primary')} disabled={busy === `imp-${s.id}`} onClick={() => run(`imp-${s.id}`, () => call('importLocal', { dir: s.dir }), `"${s.name}" importada.`)}>
                    <FolderInput size={11} /> Importar
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: `1px solid ${c.border}`, fontSize: 10.5, color: c.muted, lineHeight: 1.45 }}>
          Sob demanda: a IA lê a skill quando a tarefa pede. Sempre ligada: o conteúdo entra em toda sessão (necessário para skills de comportamento, como o Ponytail). Claude Code recebe tudo como plugin da sessão; Codex e Gemini via ~/.codex/skills e ~/.gemini/skills; Antigravity pelo prompt. Terminais abertos precisam ser reiniciados.
        </div>

        {/* Confirmação de exclusão */}
        {confirmDelete && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.overlay, zIndex: 3001 }} onClick={() => setConfirmDelete(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 380, background: c.bg, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: 'none', boxShadow: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>Excluir "{confirmDelete.name}"?</div>
              <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.45 }}>
                A pasta da skill será apagada de ~/.devflow/skills e ela deixa de ser usada pelos CLIs.
                {confirmDelete.source.type === 'created' && ' Como foi criada por você, não dá para baixar de novo.'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" style={btn()} onClick={() => setConfirmDelete(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  style={{ ...btn(), background: c.danger, color: '#fff' }}
                  onClick={() => {
                    const s = confirmDelete;
                    setConfirmDelete(null);
                    logSystemActivity('skills', 'delete_skill', s.name, { id: s.id });
                    run(`del-${s.id}`, () => call('uninstall', { id: s.id }), `"${s.name}" excluída.`);
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor de SKILL.md */}
        {editor && (
          <div style={{ position: 'absolute', inset: 0, background: c.overlay, zIndex: 3001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setEditor(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(760px, 100%)', height: 'min(560px, 100%)', background: c.bg, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, border: 'none', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: c.text, flex: 1 }}>{editor.id}/SKILL.md</span>
                <button type="button" style={btn()} onClick={() => setEditor(null)}>
                  Fechar
                </button>
                <button
                  type="button"
                  style={btn('primary')}
                  disabled={editor.content === editor.original}
                  onClick={() =>
                    run('save', async () => {
                      logSystemActivity('skills', 'save_skill_file', editor.id, { file: 'SKILL.md' });
                      await call('save', { id: editor.id, content: editor.content });
                      setEditor(null);
                    }, 'SKILL.md salvo.')
                  }
                >
                  Salvar
                </button>
              </div>
              <textarea
                value={editor.content}
                onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                spellCheck={false}
                style={{ ...inputStyle, flex: 1, resize: 'none', fontFamily: "'JetBrains Mono', Menlo, monospace", fontSize: 12, lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}

        {/* Criar skill */}
        {creating && (
          <div style={{ position: 'absolute', inset: 0, background: c.overlay, zIndex: 3001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setCreating(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px, 100%)', background: c.bg, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: 'none', boxShadow: 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>Nova skill</div>
              <label style={{ fontSize: 11.5, color: c.sub }}>
                Nome
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex.: padroes-flutter-appmoove" style={{ ...inputStyle, marginTop: 4 }} autoFocus />
              </label>
              <label style={{ fontSize: 11.5, color: c.sub }}>
                Quando usar (descrição que a IA lê para decidir)
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  placeholder="Use ao criar telas Flutter nos apps da AppMoove: segue a arquitetura, o tema e os widgets padrão…"
                  style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
                />
              </label>
              <label style={{ fontSize: 11.5, color: c.sub }}>
                Instruções (Markdown)
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={9}
                  placeholder={'# Padrões\n\n- Estado com Riverpod\n- Rotas com go_router\n- …'}
                  style={{ ...inputStyle, marginTop: 4, resize: 'vertical', fontFamily: "'JetBrains Mono', Menlo, monospace", fontSize: 12 }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button type="button" style={btn()} onClick={() => setCreating(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  style={btn('primary')}
                  disabled={!draft.name.trim() || !draft.description.trim() || !draft.body.trim()}
                  onClick={() =>
                    run('create', async () => {
                      const s = await call<InstalledSkill>('create', draft);
                      logSystemActivity('skills', 'create_skill', s.name, { id: s.id, description: s.description });
                      await call('setActive', { id: s.id, active: true });
                      setCreating(false);
                    }, 'Skill criada e ativada.')
                  }
                >
                  Criar e ativar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
