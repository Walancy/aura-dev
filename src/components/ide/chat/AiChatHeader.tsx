import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Clock,
  MoreHorizontal,
  X,
  Download,
  Trash2,
  Shield,
  Pencil,
  Check,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { renderAiIcon } from '../../icons/AiProviderIcons';

interface AiChatHeaderProps {
  sessionTitle: string;
  providerId: string;
  providerName: string;
  modelLabel?: string | null;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onRenameChat: (newTitle: string) => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onClearHistory: () => void;
  onOpenPermissions?: () => void;
  onClosePanel: () => void;
  onSelectModel?: () => void;
  onPreviousSession?: () => void;
  onNextSession?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
}

export const AiChatHeader: React.FC<AiChatHeaderProps> = ({
  sessionTitle,
  providerId,
  providerName,
  modelLabel,
  onNewChat,
  onOpenHistory,
  onRenameChat,
  onExportMarkdown,
  onExportJson,
  onClearHistory,
  onOpenPermissions,
  onClosePanel,
  onSelectModel,
  onPreviousSession,
  onNextSession,
  canGoPrevious = false,
  canGoNext = false,
  accentColor,
  themeTokens,
  isEffectiveDark,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState(sessionTitle);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditingTitleValue(sessionTitle);
  }, [sessionTitle]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [isMenuOpen]);

  const handleSaveTitle = () => {
    if (editingTitleValue.trim()) {
      onRenameChat(editingTitleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 6px',
        gap: 6,
        width: '100%',
        boxSizing: 'border-box',
        borderBottom: `1px solid ${divider}`,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Left: AI Icon + Session Title (Editable) + Model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {renderAiIcon(providerId, 15)}
        </div>

        {isEditingTitle ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveTitle();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}
          >
            <input
              autoFocus
              type="text"
              value={editingTitleValue}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditingTitleValue(sessionTitle);
                }
              }}
              style={{
                height: 22,
                fontSize: 12,
                fontWeight: 500,
                color: themeTokens.textPrimary,
                background: isEffectiveDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                borderRadius: 4,
                padding: '0 6px',
                outline: 'none',
                minWidth: 0,
                flex: 1,
              }}
            />
            <button
              type="submit"
              style={{
                height: 22,
                width: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: accentColor,
                cursor: 'pointer',
              }}
            >
              <Check size={12} />
            </button>
          </form>
        ) : (
          <div
            onDoubleClick={() => setIsEditingTitle(true)}
            title="Duplo clique para renomear conversa"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              minWidth: 0,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: themeTokens.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sessionTitle || 'Nova Conversa'}
            </span>
            {modelLabel && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectModel?.();
                }}
                title="Modelo ativo. Clique para alterar."
                style={{
                  fontSize: 10,
                  color: accentColor,
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {modelLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Navigation + New Chat + History + Menu + Close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {onPreviousSession && (
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={onPreviousSession}
            title="Conversa anterior"
            style={{
              height: 24,
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: canGoPrevious ? themeTokens.textSecondary : (isEffectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'),
              cursor: canGoPrevious ? 'pointer' : 'default',
              borderRadius: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (canGoPrevious) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              if (canGoPrevious) e.currentTarget.style.background = 'transparent';
            }}
          >
            <ArrowLeft size={12} />
          </button>
        )}

        {onNextSession && (
          <button
            type="button"
            disabled={!canGoNext}
            onClick={onNextSession}
            title="Próxima conversa"
            style={{
              height: 24,
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: canGoNext ? themeTokens.textSecondary : (isEffectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'),
              cursor: canGoNext ? 'pointer' : 'default',
              borderRadius: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (canGoNext) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              if (canGoNext) e.currentTarget.style.background = 'transparent';
            }}
          >
            <ArrowRight size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={onNewChat}
          title="Nova Conversa (+)"
          style={{
            height: 24,
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: themeTokens.textSecondary,
            cursor: 'pointer',
            borderRadius: 4,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Plus size={13} />
        </button>

        <button
          type="button"
          onClick={onOpenHistory}
          title="Histórico de Conversas"
          style={{
            height: 24,
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: themeTokens.textSecondary,
            cursor: 'pointer',
            borderRadius: 4,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Clock size={13} />
        </button>

        {/* Options Menu (...) */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title="Opções da conversa"
            style={{
              height: 24,
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isMenuOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
              border: 'none',
              color: themeTokens.textSecondary,
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
            onMouseLeave={(e) => {
              if (!isMenuOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <MoreHorizontal size={13} />
          </button>

          {isMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: isEffectiveDark ? '#1a1a1a' : '#ffffff',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 190,
                zIndex: 10000,
              }}
            >
              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsEditingTitle(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: themeTokens.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Pencil size={12} color={themeTokens.textSecondary} />
                <span>Renomear conversa</span>
              </div>

              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  onExportMarkdown();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: themeTokens.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Download size={12} color={themeTokens.textSecondary} />
                <span>Exportar (Markdown)</span>
              </div>

              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  onExportJson();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: themeTokens.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Download size={12} color={themeTokens.textSecondary} />
                <span>Exportar (JSON)</span>
              </div>

              {onOpenPermissions && (
              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenPermissions?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: themeTokens.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Shield size={12} color={accentColor} />
                <span>Políticas de Permissão</span>
              </div>
              )}

              <div style={{ height: 1, background: divider, margin: '2px 0' }} />

              <div
                onClick={() => {
                  setIsMenuOpen(false);
                  onClearHistory();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontSize: 11.5,
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={12} color="#ef4444" />
                <span>Limpar histórico</span>
              </div>
            </div>
          )}
        </div>

        {/* View Control Close (X) */}
        <button
          type="button"
          onClick={onClosePanel}
          title="Ocultar Painel de IA (⌘⇧A)"
          style={{
            height: 24,
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: themeTokens.textSecondary,
            cursor: 'pointer',
            borderRadius: 4,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
