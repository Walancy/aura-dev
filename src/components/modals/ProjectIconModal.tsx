import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Globe, Sparkles, RefreshCw, Check, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getLanguageSvgUrl } from '../FileIcon';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export interface ProjectIconModalProps {
  isOpen: boolean;
  project: {
    id: number | string;
    title: string;
    badge: number;
    language?: string | null;
    owner?: string;
    repoName?: string;
    fullName?: string;
    ownerAvatarUrl?: string;
    defaultBranch?: string;
  } | null;
  currentCustomIcon?: string;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  onSave: (iconUrlOrData: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export const ProjectIconModal: React.FC<ProjectIconModalProps> = ({
  isOpen,
  project,
  currentCustomIcon,
  themeTokens,
  accentColor = '#007acc',
  isEffectiveDark = true,
  onSave,
  onRemove,
  onClose,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const [isSearchingGithub, setIsSearchingGithub] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && project) {
      setPreviewIcon(currentCustomIcon || null);
      setUrlInput(currentCustomIcon && currentCustomIcon.startsWith('http') ? currentCustomIcon : '');
      setFeedbackMessage(null);
    }
  }, [isOpen, project, currentCustomIcon]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const bgModal = themeTokens?.modalBg || themeTokens?.bgCard || (isEffectiveDark ? '#18181b' : '#ffffff');
  const borderModal = themeTokens?.modalBorder && themeTokens.modalBorder !== 'none'
    ? themeTokens.modalBorder
    : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.12)');
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#f4f4f5' : '#18181b');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#a1a1aa' : '#71717a');
  const modalOverlay = themeTokens?.modalOverlay || 'rgba(0, 0, 0, 0.65)';
  const inputBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const inputBorder = isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)';

  const langSvg = getLanguageSvgUrl(project.language);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMessage('Arquivo muito grande (máximo 2MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewIcon(dataUrl);
      onSave(dataUrl);
      setFeedbackMessage('Ícone do projeto salvo com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUrl = () => {
    if (!urlInput.trim()) return;
    setPreviewIcon(urlInput.trim());
    onSave(urlInput.trim());
    setFeedbackMessage('URL do ícone salva com sucesso!');
  };

  const handleSelectPreset = (url: string, label: string) => {
    setPreviewIcon(url);
    setUrlInput(url);
    onSave(url);
    setFeedbackMessage(`Ícone alterado para: ${label}`);
  };

  const handleSearchGithubFavicon = async () => {
    if (!project.owner || !project.repoName) {
      setFeedbackMessage('Repositório sem vínculo do GitHub para busca automática.');
      return;
    }

    setIsSearchingGithub(true);
    setFeedbackMessage('Buscando ícone no GitHub raw content...');

    const branch = project.defaultBranch || 'main';
    const candidateUrls = [
      `https://raw.githubusercontent.com/${project.owner}/${project.repoName}/${branch}/public/favicon.ico`,
      `https://raw.githubusercontent.com/${project.owner}/${project.repoName}/${branch}/favicon.ico`,
      `https://raw.githubusercontent.com/${project.owner}/${project.repoName}/${branch}/logo.png`,
      `https://raw.githubusercontent.com/${project.owner}/${project.repoName}/${branch}/assets/icon.png`,
    ];

    let foundUrl: string | null = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          foundUrl = url;
          break;
        }
      } catch {
        // Ignora erro de rede ou CORS e testa o próximo
      }
    }

    setIsSearchingGithub(false);

    if (foundUrl) {
      setPreviewIcon(foundUrl);
      setUrlInput(foundUrl);
      onSave(foundUrl);
      setFeedbackMessage('Favicon localizado e configurado diretamente do GitHub!');
    } else {
      setFeedbackMessage('Nenhum favicon padrão encontrado na raiz do repo. Você pode usar o avatar da organização ou enviar uma imagem.');
    }
  };

  const handleRevertDefault = () => {
    setPreviewIcon(null);
    setUrlInput('');
    onRemove();
    setFeedbackMessage('Ícone restaurado para o padrão (tecnologia/avatar).');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: modalOverlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 16,
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: bgModal,
          border: borderModal,
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleUp 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
                Ícone do Projeto
              </div>
              <div style={{ fontSize: 11.5, color: textSecondary }}>
                Personalize o ícone do card sem precisar clonar o repo
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: textSecondary,
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Preview Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 16px',
              borderRadius: 10,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {previewIcon ? (
                <img
                  src={previewIcon}
                  alt={project.title}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent' }}
                  onError={() => setPreviewIcon(null)}
                />
              ) : project.ownerAvatarUrl ? (
                <img
                  src={project.ownerAvatarUrl}
                  alt={project.owner || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent' }}
                />
              ) : langSvg ? (
                <img
                  src={langSvg}
                  alt={project.language || ''}
                  style={{ width: 36, height: 36, objectFit: 'contain', background: 'transparent' }}
                />
              ) : (
                <span style={{ fontSize: 16, fontWeight: '400', color: textPrimary, background: 'transparent' }}>
                  {project.badge}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.title}
              </div>
              <div style={{ fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
                {previewIcon
                  ? 'Ícone personalizado ativo'
                  : langSvg
                  ? `Ícone da stack: ${project.language}`
                  : project.ownerAvatarUrl
                  ? `Avatar da organização: @${project.owner}`
                  : 'Exibindo número padrão do card'}
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {feedbackMessage && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}33`,
                color: textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Check size={14} color={accentColor} />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Opção 1: Upload */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 6 }}>
              1. Enviar Imagem do Computador
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                color: textPrimary,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
            >
              <Upload size={14} />
              <span>Selecionar arquivo (PNG, SVG, JPG, ICO, WebP)</span>
            </button>
          </div>

          {/* Opção 2: URL */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 6 }}>
              2. Ou Colar URL da Imagem
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="https://exemplo.com/logo.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveUrl();
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: textPrimary,
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSaveUrl}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: accentColor,
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Opção 3: Predefinições Inteligentes */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
              3. Opções Rápidas (Sem Clonar)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {project.ownerAvatarUrl && (
                <button
                  onClick={() => handleSelectPreset(project.ownerAvatarUrl!, `Avatar da organização @${project.owner}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                    border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: textPrimary,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={project.ownerAvatarUrl}
                      alt=""
                      style={{ width: 18, height: 18, objectFit: 'contain' }}
                    />
                    <span>Usar Avatar da Organização (@{project.owner})</span>
                  </div>
                  <Check size={13} color={previewIcon === project.ownerAvatarUrl ? accentColor : 'transparent'} />
                </button>
              )}

              {project.owner && project.repoName && (
                <button
                  onClick={handleSearchGithubFavicon}
                  disabled={isSearchingGithub}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                    border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: textPrimary,
                    fontSize: 12,
                    cursor: isSearchingGithub ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={14} className={isSearchingGithub ? 'animate-spin' : ''} />
                    <span>Buscar Favicon/Logo no GitHub Raw</span>
                  </div>
                  <Globe size={13} color={textSecondary} />
                </button>
              )}

              {currentCustomIcon && (
                <button
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    fontSize: 12,
                    cursor: 'pointer',
                    marginTop: 4,
                  }}
                >
                  <Trash2 size={13} />
                  <span>Remover Personalização (Voltar ao Ícone Padrão)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: accentColor,
              border: 'none',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Concluir
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        title="Remover Ícone Customizado"
        message={`Deseja remover o ícone personalizado de "${project.title}"?`}
        itemDescription="O projeto voltará a utilizar o ícone padrão da linguagem de programação ou avatar da organização."
        confirmLabel="Remover Ícone"
        cancelLabel="Cancelar"
        iconType="trash"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={() => {
          handleRevertDefault();
          setIsConfirmDeleteOpen(false);
        }}
        onClose={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
};
