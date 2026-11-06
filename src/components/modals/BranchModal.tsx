import React from 'react';
import { GitBranch, RefreshCw, X, Plus, Check, Search } from 'lucide-react';
import type { ThemeTokens, GitBranchItem } from '../../types/ide';
import { getContrastTextColor } from '../../utils/color';
import { getFieldTokens } from '../../utils/fieldTokens';
import { TutorialTriggerButton, useRegisterTutorialOverlay } from '../tutorial/TutorialTriggerButton';

export interface BranchModalProps {
  isEffectiveDark: boolean;
  themeTokens: ThemeTokens;
  accentColor: string;
  onClose: () => void;
  gitRepoName: string;
  currentBranch: string;
  onSyncGit: () => void;
  isSyncingGit: boolean;
  newBranchInput: string;
  setNewBranchInput: (value: string) => void;
  onCreateBranch: (name: string) => void;
  isCreatingBranch: boolean;
  branchSearchQuery: string;
  setBranchSearchQuery: (value: string) => void;
  branchesList: GitBranchItem[];
  onCheckoutBranch: (name: string) => void;
}

// Branch manager modal (list, search, create, checkout, sync).
export const BranchModal: React.FC<BranchModalProps> = ({
  isEffectiveDark,
  themeTokens,
  accentColor,
  onClose,
  gitRepoName,
  currentBranch,
  onSyncGit,
  isSyncingGit,
  newBranchInput,
  setNewBranchInput,
  onCreateBranch,
  isCreatingBranch,
  branchSearchQuery,
  setBranchSearchQuery,
  branchesList,
  onCheckoutBranch,
}) => {
  useRegisterTutorialOverlay('modal_branches', true);
  const ft = getFieldTokens(isEffectiveDark);
  const accentTextColor = getContrastTextColor(accentColor);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.12s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 540,
          maxWidth: '92vw',
          maxHeight: '80vh',
          background: isEffectiveDark ? '#141416' : '#ffffff',
          border: 'none',
          borderRadius: 10,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease-out',
          fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          data-tour="branch-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${ft.fieldBorderColor}`,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${accentColor}1c`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitBranch size={17} color={accentColor} />
            </div>
            <div>
              <div style={{ fontWeight: 400, fontSize: 14, color: themeTokens.textPrimary }}>
                Gerenciador de Branches
              </div>
              <div style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textSecondary }}>
                {gitRepoName || 'aura-dev'} • Ativa:{' '}
                <span style={{ color: accentColor, fontWeight: 400 }}>{currentBranch}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TutorialTriggerButton
              contextId="modal_branches"
              isDark={isEffectiveDark}
              accentColor={accentColor}
              textColor={themeTokens.textPrimary}
              mutedColor={themeTokens.textSecondary}
              height={28}
              contextName="Gerenciador de Branches"
            />
            <button
              type="button"
              onClick={onSyncGit}
              disabled={isSyncingGit}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: ft.fieldBg,
                border: ft.fieldBorder,
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 11.5,
                fontWeight: 400,
                color: themeTokens.textPrimary,
                cursor: isSyncingGit ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSyncingGit) e.currentTarget.style.background = ft.fieldBgHover;
              }}
              onMouseLeave={(e) => {
                if (!isSyncingGit) e.currentTarget.style.background = ft.fieldBg;
              }}
              title="Git Pull & Push"
            >
              <RefreshCw
                size={12}
                color={accentColor}
                style={{ animation: isSyncingGit ? 'spin 1s linear infinite' : 'none' }}
              />
              {isSyncingGit ? 'Sincronizando...' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: themeTokens.textSecondary,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Create new branch + Search section */}
        <div
          data-tour="branch-create-bar"
          style={{
            padding: '12px 18px',
            borderBottom: `1px solid ${ft.fieldBorderColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="df-field"
              placeholder="Nome da nova branch (ex: feat/minha-feature)..."
              value={newBranchInput}
              onChange={(e) => setNewBranchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newBranchInput.trim()) {
                  onCreateBranch(newBranchInput);
                }
              }}
              style={{
                flex: 1,
                height: 30,
                background: ft.fieldBg,
                border: ft.fieldBorder,
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 400,
                color: themeTokens.textPrimary,
                outline: 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            />
            <button
              type="button"
              onClick={() => onCreateBranch(newBranchInput)}
              disabled={!newBranchInput.trim() || isCreatingBranch}
              style={{
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: accentColor,
                color: accentTextColor,
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 400,
                cursor: newBranchInput.trim() ? 'pointer' : 'not-allowed',
                opacity: newBranchInput.trim() ? 1 : 0.5,
                transition: 'filter 0.15s ease, opacity 0.15s ease',
              }}
            >
              <Plus size={14} />
              Criar Branch
            </button>
          </div>

          <div
            className="df-search-box"
            style={{
              height: 30,
              background: ft.fieldBg,
              border: ft.fieldBorder,
              boxShadow: 'none',
              borderRadius: 6,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Search size={13} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Filtrar branches..."
              value={branchSearchQuery}
              onChange={(e) => setBranchSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                fontSize: 12,
                fontWeight: 400,
                color: themeTokens.textPrimary,
                outline: 'none',
                padding: 0,
              }}
            />
          </div>
        </div>

        {/* Branches list */}
        <div
          data-tour="branch-list-area"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {branchesList
            .filter((b) => b.name.toLowerCase().includes(branchSearchQuery.toLowerCase()))
            .map((branch, idx) => {
              const isCur = branch.isCurrent || branch.name === currentBranch;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 8,
                    background: isCur ? `${accentColor}16` : 'transparent',
                    transition: 'background 0.15s ease',
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCur)
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCur) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <GitBranch size={14} color={isCur ? accentColor : themeTokens.textSecondary} />
                    <span
                      style={{
                        fontWeight: 400,
                        color: isCur ? accentColor : themeTokens.textPrimary,
                      }}
                    >
                      {branch.name}
                    </span>
                    {branch.isRemote && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: ft.fieldBg,
                          color: themeTokens.textSecondary,
                        }}
                      >
                        remote
                      </span>
                    )}
                  </div>

                  {isCur ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#22c55e',
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      <Check size={13} />
                      Atual
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCheckoutBranch(branch.name)}
                      style={{
                        height: 26,
                        background: ft.fieldBg,
                        border: ft.fieldBorder,
                        boxShadow: 'none',
                        borderRadius: 6,
                        padding: '0 10px',
                        fontSize: 11,
                        fontWeight: 400,
                        color: themeTokens.textPrimary,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = accentColor;
                        e.currentTarget.style.color = accentTextColor;
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = ft.fieldBg;
                        e.currentTarget.style.color = themeTokens.textPrimary;
                        e.currentTarget.style.borderColor = ft.fieldBorderColor;
                      }}
                    >
                      Checkout
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
