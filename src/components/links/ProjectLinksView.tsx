import React, { useState, useMemo } from 'react';
import {
  Link2,
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  Search,
  GitBranch,
  Globe,
  Terminal,
  Layers,
  FileText,
  Palette,
  Server,
  Wrench,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

function GithubIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export interface CustomLinkItem {
  id: string;
  label: string;
  url: string;
  category?: 'repo' | 'deploy' | 'design' | 'docs' | 'tools' | 'other';
  description?: string;
}

export interface ProjectLinksViewProps {
  selectedProject?: any;
  selectedRepoRaw?: any;
  repoFullName?: string;
  customLinks: CustomLinkItem[];
  onAddCustomLink: (link: { label: string; url: string; category?: any; description?: string }) => void;
  onRemoveCustomLink: (id: string) => void;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  showToast: (msg: string) => void;
}

type CategoryFilter = 'all' | 'repo' | 'deploy' | 'design' | 'docs' | 'tools';

// Detecção inteligente de marca/serviço a partir da URL
function getServiceInfo(url: string, label: string) {
  const low = (url + ' ' + label).toLowerCase();
  if (low.includes('figma.com') || low.includes('figma')) {
    return { name: 'Figma', color: '#a259ff', icon: Palette, category: 'design' };
  }
  if (low.includes('notion.so') || low.includes('notion.site') || low.includes('notion')) {
    return { name: 'Notion', color: '#ffffff', icon: FileText, category: 'docs' };
  }
  if (low.includes('vercel.app') || low.includes('vercel')) {
    return { name: 'Vercel', color: '#000000', icon: Server, category: 'deploy' };
  }
  if (low.includes('github.com')) {
    return { name: 'GitHub', color: '#8b949e', icon: GithubIcon, category: 'repo' };
  }
  if (low.includes('swagger') || low.includes('postman') || low.includes('/docs') || low.includes('api-doc')) {
    return { name: 'API Docs', color: '#10b981', icon: Terminal, category: 'docs' };
  }
  if (low.includes('linear.app') || low.includes('jira') || low.includes('trello')) {
    return { name: 'Tracker', color: '#3b82f6', icon: Layers, category: 'tools' };
  }
  if (low.includes('staging') || low.includes('homolog') || low.includes('prod') || low.includes('app.')) {
    return { name: 'Ambiente', color: '#f59e0b', icon: Server, category: 'deploy' };
  }
  return { name: 'Web', color: '#6366f1', icon: Globe, category: 'other' };
}

export const ProjectLinksView: React.FC<ProjectLinksViewProps> = ({
  selectedProject,
  selectedRepoRaw,
  repoFullName,
  customLinks,
  onAddCustomLink,
  onRemoveCustomLink,
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<'deploy' | 'design' | 'docs' | 'tools' | 'other'>('deploy');
  const [newDesc, setNewDesc] = useState('');

  // Paleta neutra consistente com o DevFlow
  const c = useMemo(() => {
    return {
      shelf: isEffectiveDark ? '#0e0e0e' : '#f4f4f5',
      card: isEffectiveDark ? '#141414' : '#ffffff',
      cardSecondary: isEffectiveDark ? '#1a1a1a' : '#f9fafb',
      cardHover: isEffectiveDark ? '#1e1e1e' : '#f3f4f6',
      textPrimary: isEffectiveDark ? '#f4f4f5' : '#18181b',
      textSecondary: isEffectiveDark ? '#a1a1aa' : '#71717a',
      textMuted: isEffectiveDark ? '#71717a' : '#a1a1aa',
      inputBg: isEffectiveDark ? '#181818' : '#f4f4f5',
      pillBg: isEffectiveDark ? '#1c1c1c' : '#e4e4e7',
      pillActive: isEffectiveDark ? '#27272a' : '#ffffff',
      borderSubtle: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    };
  }, [isEffectiveDark]);

  // Links oficiais do repositório
  const repoOfficialLinks = useMemo(() => {
    const list: Array<{ label: string; url?: string; category: CategoryFilter; icon: any; isCommand?: boolean }> = [];
    if (selectedProject?.htmlUrl) {
      list.push({
        label: 'Repositório no GitHub',
        url: selectedProject.htmlUrl,
        category: 'repo',
        icon: GithubIcon,
      });
      list.push({
        label: 'Pull Requests',
        url: `${selectedProject.htmlUrl}/pulls`,
        category: 'repo',
        icon: GitBranch,
      });
    }
    if (selectedRepoRaw?.clone_url) {
      list.push({
        label: 'Clone HTTPS',
        url: selectedRepoRaw.clone_url,
        category: 'repo',
        icon: Terminal,
        isCommand: true,
      });
    }
    if (selectedRepoRaw?.ssh_url) {
      list.push({
        label: 'Clone SSH',
        url: selectedRepoRaw.ssh_url,
        category: 'repo',
        icon: Terminal,
        isCommand: true,
      });
    }
    if (selectedRepoRaw?.homepage) {
      list.push({
        label: 'Homepage / Site Oficial',
        url: selectedRepoRaw.homepage,
        category: 'deploy',
        icon: Globe,
      });
    }
    return list;
  }, [selectedProject, selectedRepoRaw]);

  // Filtro combinado de busca e categoria
  const filteredOfficialLinks = useMemo(() => {
    return repoOfficialLinks.filter((l) => {
      if (!l.url) return false;
      const matchesSearch =
        l.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [repoOfficialLinks, searchQuery, selectedCategory]);

  const filteredCustomLinks = useMemo(() => {
    return customLinks.filter((l) => {
      const matchesSearch =
        l.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const svc = getServiceInfo(l.url, l.label);
      const cat = l.category || svc.category;
      const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [customLinks, searchQuery, selectedCategory]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast(`${label} copiado.`);
  };

  const handleOpenExternal = (url: string) => {
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleSaveNewLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newUrl.trim()) return;

    let finalUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    onAddCustomLink({
      label: newLabel.trim(),
      url: finalUrl,
      category: newCategory,
      description: newDesc.trim() || undefined,
    });

    setNewLabel('');
    setNewUrl('');
    setNewDesc('');
    setIsModalOpen(false);
    showToast('Link adicionado com sucesso.');
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 6,
        boxSizing: 'border-box',
        background: c.shelf,
        borderRadius: 10,
        border: 'none',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO DO PROJETO & FILTROS                                         */}
      {/* ========================================================================= */}
      <div
        style={{
          background: c.card,
          borderRadius: 8,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Link2 size={18} color={accentColor} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary }}>
              Central de Links & Ambientes
            </div>
            <div style={{ fontSize: 11, color: c.textSecondary }}>
              {selectedProject?.title || repoFullName || 'Repositório'} · {repoOfficialLinks.length + customLinks.length} atalhos rápidos
            </div>
          </div>
        </div>

        {/* Controles: Busca, Categorias & Botão Novo Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Campo de Busca */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: c.inputBg,
              borderRadius: 6,
              padding: '5px 9px',
              width: 170,
            }}
          >
            <Search size={12} color={c.textSecondary} />
            <input
              type="text"
              placeholder="Buscar links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: c.textPrimary,
                fontSize: 11.5,
                width: '100%',
              }}
            />
            {searchQuery && (
              <X
                size={11}
                color={c.textSecondary}
                style={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>

          {/* Categorias em Pílula */}
          <div
            style={{
              display: 'flex',
              background: c.pillBg,
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            {[
              { id: 'all', label: 'Todos' },
              { id: 'repo', label: 'Git' },
              { id: 'deploy', label: 'Deploy' },
              { id: 'design', label: 'Design' },
              { id: 'docs', label: 'Docs' },
            ].map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                  style={{
                    background: isSelected ? c.pillActive : 'transparent',
                    color: isSelected ? c.textPrimary : c.textSecondary,
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: isSelected ? 500 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Botão Novo Link */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: accentColor,
              color: accentContrastText,
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            <span>Adicionar Link</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ÁREA DE LINKS: CARDS MODULARES EM GRADE                                 */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 2,
        }}
      >
        {/* SEÇÃO 1: RECURSOS DO REPOSITÓRIO GITHUB */}
        {filteredOfficialLinks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 4px' }}>
              Recursos do Repositório & Git
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 6,
              }}
            >
              {filteredOfficialLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <div
                    key={link.label}
                    style={{
                      background: c.card,
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent size={14} color={accentColor} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: c.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {link.label}
                        </div>
                        <div style={{ fontSize: 10.5, color: c.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {link.url}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(link.isCommand ? `git clone ${link.url}` : link.url!, link.label)}
                        title={link.isCommand ? 'Copiar comando git clone' : 'Copiar link'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: c.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                        }}
                      >
                        <Copy size={13} />
                      </button>
                      {!link.isCommand && (
                        <button
                          type="button"
                          onClick={() => handleOpenExternal(link.url!)}
                          title="Abrir no navegador"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: c.textSecondary,
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                            display: 'flex',
                          }}
                        >
                          <ExternalLink size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEÇÃO 2: ATALHOS PERSONALIZADOS & AMBIENTES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 4px' }}>
            Ambientes, Design & Ferramentas do Projeto
          </div>

          {filteredCustomLinks.length === 0 ? (
            <div
              style={{
                background: c.card,
                borderRadius: 8,
                padding: '28px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Link2 size={24} color={c.textMuted} />
              <div style={{ fontSize: 12.5, fontWeight: 500, color: c.textPrimary }}>
                Nenhum link personalizado cadastrado
              </div>
              <div style={{ fontSize: 11, color: c.textSecondary, maxWidth: 320 }}>
                Adicione URLs importantes do projeto como Figma, documentação Swagger, painéis de homologação e produção.
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                style={{
                  marginTop: 4,
                  background: accentColor,
                  color: accentContrastText,
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={12} />
                <span>Adicionar Primeiro Link</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 6,
              }}
            >
              {filteredCustomLinks.map((link) => {
                const svc = getServiceInfo(link.url, link.label);
                const IconComp = svc.icon;

                return (
                  <div
                    key={link.id}
                    style={{
                      background: c.card,
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComp size={14} color={svc.color} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: c.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {link.label}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 500,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                              color: c.textSecondary,
                              flexShrink: 0,
                            }}
                          >
                            {svc.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: c.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {link.url}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(link.url, link.label)}
                        title="Copiar link"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: c.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                        }}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(link.url)}
                        title="Abrir no navegador"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: c.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                        }}
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveCustomLink(link.id)}
                        title="Excluir link"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR NOVO LINK                                                */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              background: c.card,
              borderRadius: 10,
              width: 420,
              maxWidth: '100%',
              padding: 18,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} color={accentColor} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: c.textPrimary }}>
                  Adicionar Link ao Projeto
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: c.textSecondary, cursor: 'pointer', padding: 2 }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveNewLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Nome do Atalho */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: c.textSecondary, display: 'block', marginBottom: 4 }}>
                  Nome do Atalho / Serviço
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Figma Design System, Swagger API, Homologação"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={{
                    width: '100%',
                    background: c.inputBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                    color: c.textPrimary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* URL */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: c.textSecondary, display: 'block', marginBottom: 4 }}>
                  URL do Link
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  style={{
                    width: '100%',
                    background: c.inputBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                    color: c.textPrimary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Categoria */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: c.textSecondary, display: 'block', marginBottom: 4 }}>
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: c.inputBg,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                    color: c.textPrimary,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="deploy">Deploy & Ambientes (Staging, Produção, Vercel)</option>
                  <option value="design">Design & Protótipos (Figma, Miro)</option>
                  <option value="docs">Documentação & APIs (Swagger, Notion, Wiki)</option>
                  <option value="tools">Ferramentas & Monitoramento (Sentry, Linear)</option>
                  <option value="other">Outros Links</option>
                </select>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: c.textSecondary,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newLabel.trim() || !newUrl.trim()}
                  style={{
                    background: accentColor,
                    color: accentContrastText,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    opacity: !newLabel.trim() || !newUrl.trim() ? 0.5 : 1,
                  }}
                >
                  Salvar Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
