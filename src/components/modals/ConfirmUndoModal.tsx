import React, { useEffect } from 'react';
import { X, CornerDownLeft } from 'lucide-react';

export interface ConfirmUndoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messageText?: string;
  themeTokens?: any;
  accentColor?: string;
}

export const ConfirmUndoModal: React.FC<ConfirmUndoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  messageText = 'This undo action will not make any code changes.',
  themeTokens,
  accentColor = '#007acc',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen) return null;

  const bgModal = themeTokens?.modalBg || themeTokens?.bgCard || '#1e1e1e';
  const textPrimary = themeTokens?.textPrimary || '#f4f4f5';
  const textSecondary = themeTokens?.textSecondary || '#9ca3af';
  const modalOverlay = themeTokens?.modalOverlay || 'rgba(0, 0, 0, 0.65)';

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
        backdropFilter: 'blur(5px)',
        zIndex: 100005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: bgModal,
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'none',
          border: 'none',
          position: 'relative',
          animation: 'slideUp 0.15s ease-out',
        }}
      >
        {/* Header: Title + Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: '600',
              fontFamily: 'Poppins, sans-serif',
              color: textPrimary,
              letterSpacing: '-0.2px',
            }}
          >
            Confirm Undo
          </span>

          <button
            onClick={onClose}
            title="Fechar"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'transparent',
              border: `1.5px solid ${accentColor}`,
              color: textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = textPrimary;
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = textSecondary;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body Message */}
        <div
          style={{
            fontSize: 13,
            color: textSecondary,
            fontFamily: 'Poppins, sans-serif',
            fontWeight: '400',
            lineHeight: 1.5,
          }}
        >
          {messageText}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '400',
              color: textSecondary,
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: accentColor,
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <span>Confirm</span>
            <CornerDownLeft size={13} style={{ strokeWidth: 2.4 }} />
          </button>
        </div>
      </div>
    </div>
  );
};
