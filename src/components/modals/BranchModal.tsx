import React from 'react';
import { GitBranch, RefreshCw, X, Plus, Check } from 'lucide-react';
import type { ThemeTokens, GitBranchItem } from '../../types/ide';

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
          border: `1px solid ${themeTokens.border}`,
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255, 139, 103, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitBranch size={17} color={accentColor} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: themeTokens.textPrimary }}>
                Gerenciador de Branches
              </div>
              <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                {gitRepoName || 'ainaobra'} • Ativa: <span style={{ color: accentColor, fontWeight: 500 }}>{currentBranch}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onSyncGit}
              disabled={isSyncingGit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11.5,
                color: themeTokens.textPrimary,
                cursor: isSyncingGit ? 'not-allowed' : 'pointer',
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
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: themeTokens.textSecondary,
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Create new branch section */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            type="text"
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
              background: isEffectiveDark ? '#1a1a1e' : '#f4f4f5',
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: 7,
              padding: '6px 12px',
              fontSize: 12,
              color: themeTokens.textPrimary,
              outline: 'none',
            }}
          />
          <button
            onClick={() => onCreateBranch(newBranchInput)}
            disabled={!newBranchInput.trim() || isCreatingBranch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: accentColor,
              color: '#ffffff',
              border: 'none',
              borderRadius: 7,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              cursor: newBranchInput.trim() ? 'pointer' : 'not-allowed',
              opacity: newBranchInput.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={14} />
            Criar Branch
          </button>
        </div>

        {/* Search branches */}
        <div style={{ padding: '10px 18px 6px' }}>
          <input
            type="text"
            placeholder="Filtrar branches..."
            value={branchSearchQuery}
            onChange={(e) => setBranchSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: isEffectiveDark ? '#18181b' : '#f9fafb',
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}`,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11.5,
              color: themeTokens.textPrimary,
              outline: 'none',
            }}
          />
        </div>

        {/* Branches list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
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
                    background: isCur
                      ? 'rgba(255, 139, 103, 0.1)'
                      : 'transparent',
                    transition: 'background 0.15s ease',
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCur) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCur) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <GitBranch size={14} color={isCur ? accentColor : themeTokens.textSecondary} />
                    <span style={{ fontWeight: isCur ? 600 : 400, color: isCur ? accentColor : themeTokens.textPrimary }}>
                      {branch.name}
                    </span>
                    {branch.isRemote && (
                      <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.06)', color: themeTokens.textSecondary }}>
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
                        fontWeight: 600,
                      }}
                    >
                      <Check size={13} />
                      Atual
                    </div>
                  ) : (
                    <button
                      onClick={() => onCheckoutBranch(branch.name)}
                      style={{
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 500,
                        color: themeTokens.textPrimary,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)')}
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
