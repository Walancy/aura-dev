import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import type { ThemeTokens } from '../../types/ide';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemDescription?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  iconType?: 'trash' | 'warning';
  themeTokens?: any;
  accentColor?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  itemDescription,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isDeleting = false,
  iconType = 'trash',
  themeTokens,
  accentColor = '#f97316',
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      } else if (e.key === 'Enter' && !isDeleting) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onConfirm, onClose]);

  if (!isOpen) return null;

  const bgModal = themeTokens?.modalBg || themeTokens?.bgCard || '#161616';
  const borderModal =
    themeTokens?.modalBorder && themeTokens.modalBorder !== 'none'
      ? themeTokens.modalBorder
      : themeTokens?.borderSubtle || '1px solid rgba(255, 255, 255, 0.1)';
  const textPrimary = themeTokens?.textPrimary || '#f4f4f5';
  const textSecondary = themeTokens?.textSecondary || '#a1a1aa';
  const modalOverlay = themeTokens?.modalOverlay || 'rgba(0, 0, 0, 0.65)';

  return (
    <div
      onClick={() => {
        if (!isDeleting) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: modalOverlay,
        backdropFilter: 'blur(6px)',
        zIndex: 100005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: bgModal,
          borderRadius: 12,
          border: borderModal,
          padding: '24px 22px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          position: 'relative',
        }}
      >
        {/* Header com ícone de alerta e fechar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {iconType === 'trash' ? (
                <Trash2 size={18} color="#ef4444" />
              ) : (
                <AlertTriangle size={18} color="#ef4444" />
              )}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: textPrimary,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              color: textSecondary,
              opacity: isDeleting ? 0.4 : 0.7,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.color = textSecondary;
              }
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Mensagem e corpo descritivo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: textPrimary,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {message}
          </p>

          {itemDescription && (
            <div
              style={{
                fontSize: 12,
                color: textSecondary,
                lineHeight: 1.45,
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {itemDescription}
            </div>
          )}
        </div>

        {/* Rodapé com botões Cancelar e Excluir */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 4,
            paddingTop: 8,
          }}
        >
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: textSecondary,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = textSecondary;
              }
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: 6,
              background: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.8)',
              color: '#ffffff',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) e.currentTarget.style.background = '#dc2626';
            }}
            onMouseLeave={(e) => {
              if (!isDeleting) e.currentTarget.style.background = '#ef4444';
            }}
          >
            {isDeleting && <Loader2 size={13} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
            <span>{isDeleting ? 'Excluindo...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
