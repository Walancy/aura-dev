import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit2, Copy, Check, Code2, Sparkles, X } from 'lucide-react';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

export interface SnippetItem {
  id: string;
  title: string;
  prefix: string;
  language: string;
  description: string;
  code: string;
  isBuiltIn?: boolean;
}

const DEFAULT_SNIPPETS: SnippetItem[] = [
  {
    id: 'rfc',
    title: 'React Functional Component',
    prefix: 'rfc',
    language: 'typescript',
    description: 'Componente React funcional com tipagem TypeScript e props',
    code: `import React from 'react';\n\ninterface Props {\n  children?: React.ReactNode;\n}\n\nexport const MyComponent: React.FC<Props> = ({ children }) => {\n  return (\n    <div>\n      {children}\n    </div>\n  );\n};`,
    isBuiltIn: true,
  },
  {
    id: 'trycatch',
    title: 'Try / Catch com Auditoria',
    prefix: 'trycatch',
    language: 'typescript',
    description: 'Tratamento de exceções assíncronas com registro no log do sistema',
    code: `try {\n  // Operação assíncrona\n} catch (error: any) {\n  console.error('[Falha]:', error?.message || error);\n}`,
    isBuiltIn: true,
  },
  {
    id: 'use-state-effect',
    title: 'Custom Hook Template',
    prefix: 'usehook',
    language: 'typescript',
    description: 'Estrutura básica de um Custom React Hook reutilizável',
    code: `import { useState, useEffect } from 'react';\n\nexport function useCustomHook<T>(initialValue: T) {\n  const [state, setState] = useState<T>(initialValue);\n\n  useEffect(() => {\n    // Lógica do hook\n  }, []);\n\n  return [state, setState] as const;\n}`,
    isBuiltIn: true,
  },
  {
    id: 'async-fetch',
    title: 'Fetch API Tipado',
    prefix: 'fetch-api',
    language: 'typescript',
    description: 'Função fetch com parsing JSON e validação de resposta',
    code: `async function fetchData<T>(url: string): Promise<T> {\n  const response = await fetch(url);\n  if (!response.ok) {\n    throw new Error(\`Erro HTTP: \${response.status}\`);\n  }\n  return (await response.json()) as T;\n}`,
    isBuiltIn: true,
  },
  {
    id: 'css-microanim',
    title: 'Micro-animação CSS',
    prefix: 'microanim',
    language: 'css',
    description: 'Transição suave sem saltos para microinterações de interface',
    code: `transition: all 0.15s ease-out;\nbackface-visibility: hidden;\nwill-change: transform, opacity;`,
    isBuiltIn: true,
  },
];

const STORAGE_KEY = 'devflow_user_snippets_v1';

export interface SnippetsSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
}

export const SnippetsSettingsTab: React.FC<SnippetsSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
}) => {
  const [snippets, setSnippets] = useState<SnippetItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SNIPPETS;
  });

  const [search, setSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal / Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<SnippetItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [formLanguage, setFormLanguage] = useState('typescript');
  const [formDescription, setFormDescription] = useState('');
  const [formCode, setFormCode] = useState('');

  // Delete confirmation modal state (strictly adhering to AGENTS.md rule)
  const [deletingSnippet, setDeletingSnippet] = useState<SnippetItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const saveSnippetsToStorage = (list: SnippetItem[]) => {
    setSnippets(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  };

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormTitle('');
    setFormPrefix('');
    setFormLanguage('typescript');
    setFormDescription('');
    setFormCode('');
    setIsEditing(true);
  };

  const handleOpenEdit = (s: SnippetItem) => {
    setEditTarget(s);
    setFormTitle(s.title);
    setFormPrefix(s.prefix);
    setFormLanguage(s.language);
    setFormDescription(s.description);
    setFormCode(s.code);
    setIsEditing(true);
  };

  const handleSaveForm = () => {
    if (!formTitle.trim() || !formPrefix.trim() || !formCode.trim()) return;

    if (editTarget) {
      const updated = snippets.map((item) =>
        item.id === editTarget.id
          ? {
              ...item,
              title: formTitle.trim(),
              prefix: formPrefix.trim(),
              language: formLanguage,
              description: formDescription.trim(),
              code: formCode,
            }
          : item
      );
      saveSnippetsToStorage(updated);
      logSystemActivity('snippets', 'atualizar_snippet', formTitle.trim(), {
        prefix: formPrefix.trim(),
        language: formLanguage,
      });
    } else {
      const newItem: SnippetItem = {
        id: `snip-${Date.now()}`,
        title: formTitle.trim(),
        prefix: formPrefix.trim(),
        language: formLanguage,
        description: formDescription.trim(),
        code: formCode,
      };
      const updated = [newItem, ...snippets];
      saveSnippetsToStorage(updated);
      logSystemActivity('snippets', 'criar_snippet', formTitle.trim(), {
        prefix: formPrefix.trim(),
        language: formLanguage,
      });
    }

    setIsEditing(false);
    setEditTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSnippet) return;
    setIsDeleting(true);
    try {
      const updated = snippets.filter((s) => s.id !== deletingSnippet.id);
      saveSnippetsToStorage(updated);
      logSystemActivity('snippets', 'excluir_snippet', deletingSnippet.title, { id: deletingSnippet.id });
    } finally {
      setIsDeleting(false);
      setDeletingSnippet(null);
    }
  };

  const handleCopyCode = (s: SnippetItem) => {
    navigator.clipboard.writeText(s.code);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 1500);
    logSystemActivity('snippets', 'copiar_snippet', s.title, { prefix: s.prefix });
  };

  const languages = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => set.add(s.language));
    return ['all', ...Array.from(set)];
  }, [snippets]);

  const filtered = useMemo(() => {
    return snippets.filter((s) => {
      const matchesLang = selectedLanguage === 'all' || s.language === selectedLanguage;
      if (!matchesLang) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.prefix.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
      );
    });
  }, [snippets, selectedLanguage, search]);

  const cardBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)';
  const inputBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* Top Toolbar: Search + Language Filter + New Snippet Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: inputBg,
              borderRadius: 6,
              padding: '0 10px',
              height: 28,
              flex: 1,
            }}
          >
            <Search size={13} color={themeTokens.textSecondary} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, prefixo ou código…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                height: 28,
                fontSize: 11.5,
                color: themeTokens.textPrimary,
                width: '100%',
                fontWeight: 400,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              height: 28,
              padding: '0 8px',
              borderRadius: 6,
              border: 'none',
              background: inputBg,
              color: themeTokens.textPrimary,
              fontSize: 11.5,
              fontWeight: 400,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">Todas as linguagens</option>
            {languages.filter((l) => l !== 'all').map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            border: 'none',
            boxShadow: 'none',
            cursor: 'pointer',
            background: accentColor,
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 400,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={13} />
          <span>Novo Snippet</span>
        </button>
      </div>

      <div style={{ height: 1, background: divider }} />

      {/* Snippet List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center', color: themeTokens.textSecondary, fontSize: 12 }}>
            Nenhum snippet encontrado para os critérios atuais.
          </div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Code2 size={14} color={accentColor} />
                  <span style={{ fontSize: 12.5, fontWeight: 400, color: themeTokens.textPrimary }}>
                    {s.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      color: accentColor,
                      fontWeight: 400,
                      fontFamily: 'monospace',
                    }}
                  >
                    prefixo: {s.prefix}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      color: themeTokens.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.language}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(s)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: copiedId === s.id ? '#10b981' : themeTokens.textSecondary,
                      transition: 'color 0.15s ease',
                    }}
                    title="Copiar código do snippet"
                  >
                    {copiedId === s.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(s)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: themeTokens.textSecondary,
                      transition: 'color 0.15s ease',
                    }}
                    title="Editar snippet"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingSnippet(s)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                      transition: 'opacity 0.15s ease',
                    }}
                    title="Excluir snippet"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {s.description && (
                <div style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: 1.4 }}>
                  {s.description}
                </div>
              )}

              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.04)',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
                  color: isEffectiveDark ? '#d4d4d8' : '#27272a',
                  lineHeight: 1.45,
                  overflowX: 'auto',
                  border: 'none',
                }}
              >
                {s.code}
              </pre>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação / Edição de Snippet */}
      {isEditing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setIsEditing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(580px, calc(100vw - 32px))',
              background: isEffectiveDark ? '#18181b' : '#ffffff',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary }}>
                {editTarget ? 'Editar Snippet' : 'Novo Snippet'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Título</div>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ex: React Functional Component"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: inputBg,
                      border: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Prefixo (Trigger)</div>
                  <input
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    placeholder="ex: rfc"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: inputBg,
                      border: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Linguagem</div>
                  <input
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    placeholder="ex: typescript"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: inputBg,
                      border: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Descrição</div>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Finalidade do snippet…"
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    background: inputBg,
                    border: 'none',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Código do Snippet</div>
                <textarea
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Insira o modelo de código do snippet…"
                  rows={8}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 6,
                    background: inputBg,
                    border: 'none',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontFamily: "'JetBrains Mono', Menlo, monospace",
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11.5,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={!formTitle.trim() || !formPrefix.trim() || !formCode.trim()}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: accentColor,
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  opacity: !formTitle.trim() || !formPrefix.trim() || !formCode.trim() ? 0.5 : 1,
                }}
              >
                Salvar Snippet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão (Regra AGENTS.md) */}
      {deletingSnippet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 1000001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !isDeleting && setDeletingSnippet(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              background: isEffectiveDark ? '#18181b' : '#ffffff',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 500, color: themeTokens.textPrimary }}>
              Excluir Snippet
            </div>
            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary, lineHeight: 1.45 }}>
              Tem certeza que deseja remover o snippet "{deletingSnippet.title}" ({deletingSnippet.prefix})? Esta ação não pode ser desfeita.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSnippet(null)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11.5,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
