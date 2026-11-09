import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, GitBranch, Plus, RefreshCw, Tag, Unplug } from 'lucide-react';
import type { ThemeTokens, GitBranchItem } from '../../types/ide';
import { hexToRgba } from '../../utils/color';
import { getFieldTokens } from '../../utils/fieldTokens';
import { useRegisterTutorialOverlay } from '../tutorial/TutorialTriggerButton';

export interface BranchModalProps {
  isEffectiveDark: boolean;
  themeTokens: ThemeTokens;
  accentColor: string;
  onClose: () => void;
  gitRepoName: string;
  currentBranch: string;
  onSyncGit: () => void;
  isSyncingGit: boolean;
  branchesList: GitBranchItem[];
  onCheckoutBranch: (name: string) => void;
  /** base opcional: cria a branch a partir de outra referência */
  onCreateBranch: (name: string, base?: string) => void;
  onCheckoutDetached: (ref: string) => void;
}

// o git devolve a data relativa em inglês ("4 days ago")
const UNITS: Record<string, [string, string]> = { second: ['segundo', 'segundos'], minute: ['minuto', 'minutos'], hour: ['hora', 'horas'], day: ['dia', 'dias'], week: ['semana', 'semanas'], month: ['mês', 'meses'], year: ['ano', 'anos'] };
const relPt = (rel: string) => {
  const m = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/.exec(rel.trim());
  if (!m) return rel;
  const n = Number(m[1]);
  return `há ${n} ${UNITS[m[2]][n === 1 ? 0 : 1]}`;
};

type Mode = 'checkout' | 'pickBase' | 'pickDetached' | 'name';
type Row = { key: string; kind: 'action' | 'ref'; label: string; run: () => void; icon?: React.ReactNode; ref?: GitBranchItem; group?: string };

// Seletor rápido de branch no estilo VS Code / Cursor / Antigravity: busca no topo, ações de criar e a lista com data, autor e último commit
export const BranchModal: React.FC<BranchModalProps> = ({ isEffectiveDark, themeTokens, accentColor, onClose, gitRepoName, currentBranch, onSyncGit, isSyncingGit, branchesList, onCheckoutBranch, onCreateBranch, onCheckoutDetached }) => {
  useRegisterTutorialOverlay('modal_branches', true);
  const ft = getFieldTokens(isEffectiveDark);
  const [mode, setMode] = useState<Mode>('checkout');
  const [base, setBase] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const goMode = (m: Mode, b?: string) => {
    setMode(m);
    setBase(b);
    setQuery('');
    setIndex(0);
  };

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (r: GitBranchItem) => !q || r.name.toLowerCase().includes(q) || (r.subject || '').toLowerCase().includes(q) || (r.author || '').toLowerCase().includes(q);
    const refRows = (pick: (r: GitBranchItem) => void): Row[] =>
      branchesList.filter(match).map((r) => ({ key: `${r.isTag ? 't' : r.isRemote ? 'r' : 'b'}:${r.name}`, kind: 'ref' as const, label: r.name, ref: r, run: () => pick(r), group: r.isTag ? 'tags' : r.isRemote ? 'remotas' : 'branches' }));
    if (mode === 'pickBase') return refRows((r) => goMode('name', r.name));
    if (mode === 'pickDetached') return refRows((r) => onCheckoutDetached(r.name));
    if (mode === 'name') return [];
    const allActions: Row[] = [
      { key: 'a:new', kind: 'action', label: 'Criar nova branch...', icon: <Plus size={15} />, run: () => goMode('name') },
      { key: 'a:from', kind: 'action', label: 'Criar nova branch a partir de...', icon: <Plus size={15} />, run: () => goMode('pickBase') },
      { key: 'a:detached', kind: 'action', label: 'Fazer checkout (detached)...', icon: <Unplug size={15} />, run: () => goMode('pickDetached') },
      { key: 'a:sync', kind: 'action', label: isSyncingGit ? 'Sincronizando...' : 'Sincronizar com o GitHub', icon: <RefreshCw size={14} className={isSyncingGit ? 'spin-animate' : ''} />, run: () => !isSyncingGit && onSyncGit() },
    ];
    const actions = allActions.filter((a) => !q || a.label.toLowerCase().includes(q));
    return [...actions, ...refRows((r) => (r.isCurrent ? onClose() : onCheckoutBranch(r.name)))];
  }, [mode, query, branchesList, isSyncingGit]);

  useEffect(() => setIndex(0), [query, mode]);
  useEffect(() => {
    (listRef.current?.querySelector(`[data-row="${index}"]`) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const nameValid = /^[^\s~^:?*\[\\]+$/.test(query.trim()) && !query.trim().startsWith('-');
  const placeholder =
    mode === 'name' ? (base ? `Nome da nova branch (a partir de ${base})` : 'Nome da nova branch (ex: feat/minha-feature)') : mode === 'pickBase' ? 'Selecione a referência base da nova branch' : mode === 'pickDetached' ? 'Selecione uma referência para checkout detached' : 'Selecione uma branch ou tag para fazer checkout';

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (mode !== 'checkout') goMode('checkout');
      else onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'name') {
        if (nameValid) onCreateBranch(query.trim(), base);
      } else rows[index]?.run();
    }
  };

  const hl = hexToRgba(accentColor, 0.2);
  const muted = themeTokens.textSecondary;
  let lastGroup = '';

  return (
    <div
      data-tour="branch-header"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', animation: 'fadeIn 0.12s ease-out', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, padding: '12vh 20px 20px' }}
      onClick={onClose}
    >
      <div
        style={{ width: 640, maxWidth: '94vw', maxHeight: '70vh', background: isEffectiveDark ? '#1a1a1c' : '#ffffff', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 6, gap: 6, animation: 'fadeIn 0.12s ease-out', fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          style={{ height: 36, padding: '0 12px', borderRadius: 6, border: 'none', outline: `1px solid ${hexToRgba(accentColor, 0.6)}`, background: ft.fieldBg, color: themeTokens.textPrimary, fontSize: 13, fontFamily: 'inherit', fontWeight: 400, flexShrink: 0 }}
        />

        <div style={{ height: 1, margin: '0 -6px', background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexShrink: 0 }} />

        {mode === 'name' && (
          <div style={{ padding: '4px 10px 8px', fontSize: 11.5, color: query.trim() && !nameValid ? '#ef4444' : muted }}>
            {query.trim() && !nameValid ? 'Nome inválido: sem espaços nem caracteres especiais do git.' : 'Pressione Enter para criar e ativar a branch, ou Esc para voltar.'}
          </div>
        )}

        <div ref={listRef} data-tour="branch-create-bar" className="scroll-auto-hide" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
          {mode !== 'name' && rows.length === 0 && <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: 12, color: muted }}>Nenhuma branch ou tag encontrada.</div>}
          {rows.map((r, i) => {
            const active = i === index;
            const showGroup = r.kind === 'ref' && r.group !== lastGroup;
            if (r.kind === 'ref') lastGroup = r.group || '';
            const ref = r.ref;
            const separator = r.kind === 'ref' && i > 0 && rows[i - 1].kind === 'action';
            return (
              <React.Fragment key={r.key}>
                {separator && <div style={{ height: 1, margin: '4px 0', flexShrink: 0, background: isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />}
                <div
                  data-row={i}
                  onClick={r.run}
                  onMouseEnter={() => setIndex(i)}
                  style={{ display: 'flex', alignItems: ref ? 'flex-start' : 'center', gap: 10, padding: ref ? '7px 12px' : '0 12px', minHeight: ref ? undefined : 30, borderRadius: 6, cursor: 'pointer', background: active ? hl : 'transparent', transition: 'background 0.08s ease' }}
                >
                  {r.icon && <span style={{ display: 'flex', color: themeTokens.textPrimary, paddingTop: 0 }}>{r.icon}</span>}
                  {ref ? (
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ display: 'flex', color: ref.isCurrent ? accentColor : muted, flexShrink: 0 }}>{ref.isTag ? <Tag size={13} /> : <GitBranch size={13} />}</span>
                        <span style={{ fontSize: 13, color: ref.isCurrent ? accentColor : themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.name}</span>
                        {ref.relDate && <span style={{ fontSize: 11.5, color: muted, flexShrink: 0 }}>{relPt(ref.relDate)}</span>}
                        {Boolean(ref.ahead || ref.behind) && (
                          <span style={{ fontSize: 11.5, color: muted, flexShrink: 0 }}>
                            {ref.behind || 0}↓ {ref.ahead || 0}↑
                          </span>
                        )}
                        <span style={{ flex: 1 }} />
                        {ref.isCurrent ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#22c55e', flexShrink: 0 }}>
                            <Check size={12} /> atual
                          </span>
                        ) : (
                          showGroup && <span style={{ fontSize: 11.5, color: accentColor, flexShrink: 0 }}>{r.group}</span>
                        )}
                      </div>
                      {(ref.author || ref.hash || ref.subject) && (
                        <div style={{ fontSize: 11.5, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 21 }}>
                          {[ref.author, ref.hash, ref.subject].filter(Boolean).join('  •  ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: themeTokens.textPrimary }}>{r.label}</span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {mode === 'checkout' && <div style={{ height: 1, margin: '0 -6px', background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexShrink: 0 }} />}
        {mode === 'checkout' && (
          <div style={{ padding: '2px 10px 4px', fontSize: 11, color: muted, flexShrink: 0 }}>
            {gitRepoName || 'projeto'} • ativa: <span style={{ color: accentColor }}>{currentBranch}</span> • ↑↓ navegar • Enter escolher • Esc fechar
          </div>
        )}
      </div>
    </div>
  );
};
