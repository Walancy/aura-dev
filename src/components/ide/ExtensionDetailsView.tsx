import React, { useState, useEffect } from 'react';
import {
  Download,
  Star,
  ExternalLink,
  ShieldCheck,
  Palette,
  Terminal,
  Code2,
  FileText,
  Sliders,
  Check,
  RefreshCw,
  X,
  Copy,
  BookOpen,
  Sparkles,
} from 'lucide-react';

export interface ExtensionDetailsViewProps {
  extension: any;
  isInstalled: boolean;
  isEnabled?: boolean;
  themeTokens: {
    bgCard: string;
    bgCardSecondary?: string;
    bgCardElevated?: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    hoverBg: string;
  };
  isEffectiveDark: boolean;
  accentColor: string;
  onClose: () => void;
  onInstall: (ext: any) => Promise<void>;
  onUninstall: (ext: any) => Promise<void>;
  onToggleEnabled: (ext: any) => Promise<void>;
  onApplyTheme: (themeData: any, themeLabel: string) => void;
  onToast: (msg: string) => void;
}

export const ExtensionDetailsView: React.FC<ExtensionDetailsViewProps> = ({
  extension,
  isInstalled,
  isEnabled = true,
  themeTokens,
  isEffectiveDark,
  accentColor,
  onClose,
  onInstall,
  onUninstall,
  onToggleEnabled,
  onApplyTheme,
  onToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'contributions' | 'changelog'>('details');
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [fullDetails, setFullDetails] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [activeThemeApplied, setActiveThemeApplied] = useState<string | null>(null);

  const hexToRgba = (hex: string, alpha: number) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
      value /= 1024;
      unitIdx++;
    }
    return `${value.toFixed(unitIdx === 0 ? 0 : 2)}${units[unitIdx]}`;
  };

  const formatUpdatedDate = (iso?: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 30) return `${diffDays} dias atrás`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'} atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  // Fetch full metadata, README and manifest from Open VSX
  useEffect(() => {
    let isMounted = true;
    setLoadingDetails(true);

    if (window.electronAPI?.extensions?.getDetails) {
      window.electronAPI.extensions
        .getDetails(extension.namespace, extension.name)
        .then((res: any) => {
          if (!isMounted) return;
          if (res?.success && res.details) {
            setFullDetails(res.details);
          } else {
            setFullDetails(extension);
          }
        })
        .catch(() => {
          if (isMounted) setFullDetails(extension);
        })
        .finally(() => {
          if (isMounted) setLoadingDetails(false);
        });
    } else {
      setFullDetails(extension);
      setLoadingDetails(false);
    }

    return () => {
      isMounted = false;
    };
  }, [extension.namespace, extension.name]);

  const extData = fullDetails || extension;
  const iconUrl = extData.files?.icon || extData.iconUrl;
  const contributes = extData.contributes || {};
  const themes = contributes.themes || [];
  const commands = contributes.commands || [];
  const snippets = contributes.snippets || [];
  const configuration = contributes.configuration;

  const identifier = `${extData.namespace || ''}.${extData.name || ''}`;
  const updatedLabel = formatUpdatedDate(extData.timestamp);
  const sizeLabel = formatBytes(extData.sizeBytes);
  const openVsxUrl = extData.namespace && extData.name
    ? `https://open-vsx.org/extension/${extData.namespace}/${extData.name}`
    : null;

  const downloadFormatted = extData.downloadCount
    ? extData.downloadCount > 1000000
      ? `${(extData.downloadCount / 1000000).toFixed(1)}M`
      : extData.downloadCount > 1000
      ? `${(extData.downloadCount / 1000).toFixed(0)}k`
      : String(extData.downloadCount)
    : 'Popular';

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await onInstall(extData);
      onToast(`Extensão "${extData.displayName || extData.name}" instalada com sucesso!`);
    } catch (err: any) {
      onToast(`Erro ao instalar extensão: ${err?.message || err}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleApplyThemeClick = (themeItem: any) => {
    // If theme has inline data or we fetch it
    onApplyTheme(themeItem.data, themeItem.label);
    setActiveThemeApplied(themeItem.label);
    onToast(`Tema "${themeItem.label}" aplicado`);
  };

  // Simple Markdown Renderer for README
  const renderMarkdown = (md: string) => {
    if (!md) {
      return (
        <div style={{ color: themeTokens.textMuted, fontSize: 13, fontStyle: 'italic', padding: 20 }}>
          Nenhuma documentação detalhada fornecida pela extensão.
        </div>
      );
    }

    const lines = md.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6, fontSize: 13 }}>
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} style={{ height: 4 }} />;

          // Headers
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={i} style={{ fontSize: 22, fontWeight: 700, color: themeTokens.textPrimary, margin: '14px 0 6px', borderBottom: '1px solid ' + themeTokens.border, paddingBottom: 6 }}>
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={i} style={{ fontSize: 17, fontWeight: 600, color: themeTokens.textPrimary, margin: '12px 0 4px', borderBottom: '1px solid ' + themeTokens.border, paddingBottom: 4 }}>
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: themeTokens.textPrimary, margin: '8px 0 2px' }}>
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          // Lists
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: 8 }}>
                <span style={{ color: accentColor, fontWeight: 700 }}>•</span>
                <span style={{ color: themeTokens.textPrimary }}>{trimmed.replace(/^[-*]\s+/, '')}</span>
              </div>
            );
          }

          // Code blocks
          if (trimmed.startsWith('```')) {
            return null; // Simplified for line-by-line preview
          }

          // Standard paragraph
          return (
            <p key={i} style={{ color: themeTokens.textPrimary, margin: 0 }}>
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: themeTokens.bgCard,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {/* ---------------------------------------------------- */}
      {/* 1. Top Header (VS Code Official Extension Page)      */}
      {/* ---------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          padding: '18px 24px',
          borderBottom: '1px solid ' + themeTokens.border,
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          flexShrink: 0,
        }}
      >
        {/* Extension Icon */}
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={extData.name}
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              objectFit: 'contain',
              flexShrink: 0,
              background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              padding: 4,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              background: hexToRgba(accentColor, 0.15),
              color: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {extData.name.substring(0, 2).toUpperCase()}
          </div>
        )}

        {/* Info & Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: themeTokens.textPrimary, margin: 0 }}>
              {extData.displayName || extData.name}
            </h1>
            {extData.version && (
              <span
                style={{
                  fontSize: 11,
                  color: themeTokens.textSecondary,
                  background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                v{extData.version}
              </span>
            )}
            {extData.verified && (
              <span
                style={{
                  fontSize: 11,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                <ShieldCheck size={12} />
                Verificado
              </span>
            )}
          </div>

          {/* Identifier & Publisher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: themeTokens.textSecondary }}>
            <span style={{ color: accentColor, fontWeight: 500 }}>
              {extData.namespace || 'Community'}
            </span>
            <span>•</span>
            <span style={{ fontFamily: 'monospace', color: themeTokens.textMuted }}>
              {(extData.namespace || '') + '.' + extData.name}
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: 12.5, color: themeTokens.textPrimary, margin: '2px 0 4px', lineHeight: 1.4 }}>
            {extData.description || 'Extensão para aprimorar sua experiência no Aura Dev.'}
          </p>

          {/* Action Buttons & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {!isInstalled ? (
              <button
                onClick={handleInstallClick}
                disabled={installing}
                style={{
                  background: accentColor,
                  border: 'none',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Poppins, sans-serif',
                  padding: '7px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: `0 2px 8px ${hexToRgba(accentColor, 0.35)}`,
                  transition: 'all 0.15s ease',
                }}
              >
                {installing ? (
                  <>
                    <RefreshCw size={13} className="spin-animate" />
                    <span>Baixando VSIX & Instalando...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Instalar no DevFlow</span>
                  </>
                )}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => onToggleEnabled(extData)}
                  style={{
                    background: isEnabled ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'rgba(239,68,68,0.12)',
                    border: '1px solid ' + themeTokens.border,
                    borderRadius: 6,
                    color: isEnabled ? themeTokens.textPrimary : '#ef4444',
                    fontSize: 11.5,
                    fontWeight: 500,
                    fontFamily: 'Poppins, sans-serif',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>{isEnabled ? 'Desativar' : 'Ativar'}</span>
                </button>

                <button
                  onClick={() => onUninstall(extData)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    color: '#ef4444',
                    fontSize: 11.5,
                    fontWeight: 500,
                    fontFamily: 'Poppins, sans-serif',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>Desinstalar</span>
                </button>
              </div>
            )}

            {/* Quick Apply Theme button if it provides themes */}
            {themes.length > 0 && (
              <button
                onClick={() => handleApplyThemeClick(themes[0])}
                style={{
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  border: '1px solid ' + themeTokens.border,
                  borderRadius: 6,
                  color: accentColor,
                  fontSize: 11.5,
                  fontWeight: 500,
                  fontFamily: 'Poppins, sans-serif',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Palette size={13} />
                <span>Definir Tema de Cores ({themes[0].label})</span>
              </button>
            )}

            {/* Stats: Downloads, Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto', fontSize: 11.5, color: themeTokens.textSecondary }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={13} color={themeTokens.textMuted} />
                <span>{downloadFormatted} downloads</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                <span>{(extData.averageRating || 5).toFixed(1)}</span>
              </div>
              {extData.repository && (
                <a
                  href={extData.repository}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: themeTokens.textSecondary, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <ExternalLink size={12} />
                  <span>GitHub</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: themeTokens.textSecondary,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
          }}
          title="Fechar Detalhes da Extensão"
        >
          <X size={16} />
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Sub-Tabs Header (Detalhes, Contribuições, Changelog)*/}
      {/* ---------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 24px',
          borderBottom: '1px solid ' + themeTokens.border,
          background: isEffectiveDark ? '#141416' : '#ffffff',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setActiveSubTab('details')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'details' ? `2px solid ${accentColor}` : '2px solid transparent',
            color: activeSubTab === 'details' ? themeTokens.textPrimary : themeTokens.textSecondary,
            padding: '10px 4px',
            fontSize: 12.5,
            fontWeight: activeSubTab === 'details' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookOpen size={13} color={activeSubTab === 'details' ? accentColor : 'currentColor'} />
          <span>Detalhes</span>
        </button>

        <button
          onClick={() => setActiveSubTab('contributions')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'contributions' ? `2px solid ${accentColor}` : '2px solid transparent',
            color: activeSubTab === 'contributions' ? themeTokens.textPrimary : themeTokens.textSecondary,
            padding: '10px 4px',
            fontSize: 12.5,
            fontWeight: activeSubTab === 'contributions' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={13} color={activeSubTab === 'contributions' ? accentColor : 'currentColor'} />
          <span>Contribuições</span>
          {(themes.length > 0 || commands.length > 0 || snippets.length > 0) && (
            <span
              style={{
                fontSize: 10,
                background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                padding: '1px 6px',
                borderRadius: 10,
              }}
            >
              {themes.length + commands.length + snippets.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('changelog')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'changelog' ? `2px solid ${accentColor}` : '2px solid transparent',
            color: activeSubTab === 'changelog' ? themeTokens.textPrimary : themeTokens.textSecondary,
            padding: '10px 4px',
            fontSize: 12.5,
            fontWeight: activeSubTab === 'changelog' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileText size={13} color={activeSubTab === 'changelog' ? accentColor : 'currentColor'} />
          <span>Changelog</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Sub-Tab Body (content + metadata sidebar)         */}
      {/* ---------------------------------------------------- */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          gap: 24,
          padding: '20px 24px',
        }}
      >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loadingDetails ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, color: themeTokens.textSecondary }}>
            <RefreshCw size={16} className="spin-animate" />
            <span>Carregando documentação da extensão...</span>
          </div>
        ) : activeSubTab === 'details' ? (
          renderMarkdown(extData.readme)
        ) : activeSubTab === 'contributions' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Color Themes */}
            {themes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                  <Palette size={15} color={accentColor} />
                  <span>Temas de Cores ({themes.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {themes.map((t: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 6,
                        background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: '1px solid ' + themeTokens.border,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: themeTokens.textPrimary }}>
                          {t.label}
                        </span>
                        <span style={{ fontSize: 10.5, color: themeTokens.textMuted }}>
                          UI: {t.uiTheme} • Caminho: {t.path}
                        </span>
                      </div>
                      <button
                        onClick={() => handleApplyThemeClick(t)}
                        style={{
                          background: activeThemeApplied === t.label ? '#10b981' : accentColor,
                          border: 'none',
                          borderRadius: 4,
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '5px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {activeThemeApplied === t.label ? <Check size={12} /> : <Palette size={12} />}
                        <span>{activeThemeApplied === t.label ? 'Tema Ativo' : 'Definir Tema'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commands */}
            {commands.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                  <Terminal size={15} color={accentColor} />
                  <span>Comandos Contribuídos ({commands.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {commands.map((cmd: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>
                        {cmd.title || cmd.command}
                      </span>
                      <span style={{ fontFamily: 'monospace', color: themeTokens.textMuted, fontSize: 11 }}>
                        {cmd.command}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Snippets */}
            {snippets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                  <Code2 size={15} color={accentColor} />
                  <span>Snippets de Código ({snippets.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {snippets.map((snip: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        fontSize: 12,
                        color: themeTokens.textPrimary,
                      }}
                    >
                      Linguagem: <strong>{snip.language}</strong> ({snip.path})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configuration */}
            {configuration && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                  <Sliders size={15} color={accentColor} />
                  <span>Configurações Disponíveis</span>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    fontSize: 11.5,
                    fontFamily: 'monospace',
                    color: themeTokens.textSecondary,
                    maxHeight: 200,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(configuration.properties || configuration, null, 2)}
                </div>
              </div>
            )}

            {themes.length === 0 && commands.length === 0 && snippets.length === 0 && !configuration && (
              <div style={{ color: themeTokens.textMuted, fontSize: 13, fontStyle: 'italic', padding: 10 }}>
                Nenhuma contribuição declarada explicitamente no manifest.
              </div>
            )}
          </div>
        ) : (
          renderMarkdown(extData.changelog || 'Nenhum changelog disponível.')
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. Metadata Sidebar (Instalação, Marketplace, Recursos) */}
      {/* ---------------------------------------------------- */}
      <div
        style={{
          width: 210,
          flexShrink: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* Instalação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Instalação
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 10,
              borderRadius: 8,
              background: themeTokens.bgCardSecondary || (isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
              border: '1px solid ' + themeTokens.border,
            }}
          >
            {[
              ['Identificador', identifier],
              ['Versão', extData.version || '—'],
              ...(updatedLabel ? [['Atualizado', updatedLabel]] : []),
              ...(sizeLabel ? [['Tamanho', sizeLabel]] : []),
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: themeTokens.textMuted }}>{label}</span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: themeTokens.textPrimary,
                    fontFamily: label === 'Identificador' ? 'monospace' : 'inherit',
                    wordBreak: 'break-word',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Categorias */}
        {extData.categories && extData.categories.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Categorias
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {extData.categories.map((cat: string) => (
                <span
                  key={cat}
                  style={{
                    fontSize: 10.5,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: hexToRgba(accentColor, 0.12),
                    color: accentColor,
                    border: '1px solid ' + hexToRgba(accentColor, 0.25),
                  }}
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recursos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Recursos
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {openVsxUrl && (
              <a
                href={openVsxUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: accentColor, textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
                <span>Ver na Open VSX</span>
              </a>
            )}
            {extData.repository && (
              <a
                href={extData.repository}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: accentColor, textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
                <span>Repositório</span>
              </a>
            )}
            {extData.homepage && (
              <a
                href={extData.homepage}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: accentColor, textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
                <span>Homepage</span>
              </a>
            )}
            {extData.license && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: themeTokens.textMuted }}>Licença</span>
                <span style={{ fontSize: 11.5, color: themeTokens.textPrimary }}>{extData.license}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
