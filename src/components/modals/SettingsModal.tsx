import React from 'react';
import { Settings, X, GaugeCircle, Palette, Code, SquareTerminal, Bot, Keyboard, Blocks, Folder, GitBranch } from 'lucide-react';
import { hexToRgba } from '../../utils/color';
import type { ThemeTokens } from '../../types/ide';
import type { AiMode } from '../../constants/ai';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';
import { EditorSettingsTab } from './settings/EditorSettingsTab';
import { TerminalSettingsTab } from './settings/TerminalSettingsTab';
import { AiAgentsSettingsTab } from './settings/AiAgentsSettingsTab';
import { ShortcutsSettingsTab } from './settings/ShortcutsSettingsTab';
import { ExtensionsSettingsTab } from './settings/ExtensionsSettingsTab';

export type SettingsTabId = 'general' | 'appearance' | 'editor' | 'terminal' | 'ai' | 'shortcuts' | 'extensions';

export interface SettingsModalProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  onClose: () => void;
  settingsActiveTab: SettingsTabId;
  setSettingsActiveTab: (tab: SettingsTabId) => void;
  workspacePath: string;
  currentBranch: string;
  onOpenBranchManager: () => void;

  // General tab
  sidebarPosition: 'left' | 'right';
  setSidebarPosition: (value: 'left' | 'right') => void;
  isCenteredLayout: boolean;
  setIsCenteredLayout: (value: boolean) => void;
  restoreLastWorkspace: boolean;
  setRestoreLastWorkspace: (value: boolean) => void;
  confirmBeforeClosingUnsaved: boolean;
  setConfirmBeforeClosingUnsaved: (value: boolean) => void;
  autoRefreshGitStatus: boolean;
  setAutoRefreshGitStatus: (value: boolean) => void;

  // Appearance tab
  setAccentColor: (color: string) => void;
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  useAiChatThemeColor: boolean;
  setUseAiChatThemeColor: (value: boolean) => void;

  // Editor tab
  editorFontSize: number;
  setEditorFontSize: (value: number) => void;
  editorTabSize: number;
  setEditorTabSize: (value: number) => void;
  editorWordWrap: boolean;
  setEditorWordWrap: (value: boolean) => void;
  editorMinimap: boolean;
  setEditorMinimap: (value: boolean) => void;
  editorLineNumbers: boolean;
  setEditorLineNumbers: (value: boolean) => void;
  editorSmoothScrolling: boolean;
  setEditorSmoothScrolling: (value: boolean) => void;
  editorBracketColorization: boolean;
  setEditorBracketColorization: (value: boolean) => void;
  editorRenderWhitespace: boolean;
  setEditorRenderWhitespace: (value: boolean) => void;

  // Terminal tab
  terminalFontSize: number;
  setTerminalFontSize: (value: number) => void;
  terminalCursorStyle: 'block' | 'bar' | 'underline';
  setTerminalCursorStyle: (value: 'block' | 'bar' | 'underline') => void;
  terminalScrollback: number;
  setTerminalScrollback: (value: number) => void;
  terminalCursorBlink: boolean;
  setTerminalCursorBlink: (value: boolean) => void;
  terminalCopyOnSelect: boolean;
  setTerminalCopyOnSelect: (value: boolean) => void;

  // AI & Agents tab
  selectedAiProvider: string;
  setSelectedAiProvider: (id: string) => void;
  aiMode: AiMode;
  setAiMode: (id: AiMode) => void;
  aiAutoApprove: boolean;
  setAiAutoApprove: (value: boolean) => void;
  aiConfirmBeforeDelete: boolean;
  setAiConfirmBeforeDelete: (value: boolean) => void;

  // Extensions tab
  installedClis: Record<string, boolean>;
}

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'Geral', icon: <GaugeCircle size={15} /> },
  { id: 'appearance', label: 'Estilização & Temas', icon: <Palette size={15} /> },
  { id: 'editor', label: 'Configurações Editor', icon: <Code size={15} /> },
  { id: 'terminal', label: 'Terminal', icon: <SquareTerminal size={15} /> },
  { id: 'ai', label: 'IA & Agentes', icon: <Bot size={15} /> },
  { id: 'shortcuts', label: 'Atalhos de Teclado', icon: <Keyboard size={15} /> },
  { id: 'extensions', label: 'Extensões & Status', icon: <Blocks size={15} /> },
];

// Settings modal shell: backdrop, dialog frame, header, sidebar nav, and composes
// whichever tab is active from src/components/modals/settings/*.
export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const {
    themeTokens,
    isEffectiveDark,
    accentColor,
    onClose,
    settingsActiveTab,
    setSettingsActiveTab,
    workspacePath,
    currentBranch,
    onOpenBranchManager,
  } = props;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 999998,
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.12s ease-out',
        }}
      />

      {/* Modal Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 920,
          maxWidth: 'calc(100vw - 32px)',
          height: '82vh',
          minHeight: 560,
          maxHeight: 'calc(100vh - 48px)',
          background: isEffectiveDark ? '#141416' : '#ffffff',
          border: `1px solid ${themeTokens.border}`,
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.12s ease-out',
          color: themeTokens.textPrimary,
          fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
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
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: hexToRgba(accentColor, 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={17} color={accentColor} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: themeTokens.textPrimary }}>
                Configurações
              </div>
              <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Estilização, editor, atalhos e extensões do DevFlow IDE
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: themeTokens.textSecondary,
              padding: 4,
              display: 'flex',
              borderRadius: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Fechar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar Tabs */}
          <div
            style={{
              width: 230,
              flexShrink: 0,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
              borderRight: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
              padding: '14px 10px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 10px', marginBottom: 6 }}>
              Configurações
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {SETTINGS_TABS.map((tab) => {
                const active = settingsActiveTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setSettingsActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      color: active ? themeTokens.textPrimary : themeTokens.textSecondary,
                      background: active ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)') : 'transparent',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ color: 'inherit' }}>{tab.icon}</div>
                    <span>{tab.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Workspace group (real, live data — not decorative) */}
            {workspacePath && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 10px', marginTop: 18, marginBottom: 6 }}>
                  Workspace
                </div>
                <div
                  onClick={onOpenBranchManager}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: themeTokens.textSecondary,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title="Abrir gerenciador de branches"
                >
                  <Folder size={14} />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: themeTokens.textPrimary, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {workspacePath.split('/').filter(Boolean).pop()}
                    </div>
                    {currentBranch && (
                      <div style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <GitBranch size={9} />
                        {currentBranch}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div style={{ flex: 1 }} />

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`, paddingTop: 10, marginTop: 10, padding: '10px 10px 0 10px' }}>
              <div style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>DevFlow IDE • v1.0.0</div>
            </div>
          </div>

          {/* Right Content Pane */}
          <div style={{ flex: 1, padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 26 }}>
            {settingsActiveTab === 'general' && (
              <GeneralSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                sidebarPosition={props.sidebarPosition}
                setSidebarPosition={props.setSidebarPosition}
                isCenteredLayout={props.isCenteredLayout}
                setIsCenteredLayout={props.setIsCenteredLayout}
                restoreLastWorkspace={props.restoreLastWorkspace}
                setRestoreLastWorkspace={props.setRestoreLastWorkspace}
                confirmBeforeClosingUnsaved={props.confirmBeforeClosingUnsaved}
                setConfirmBeforeClosingUnsaved={props.setConfirmBeforeClosingUnsaved}
                autoRefreshGitStatus={props.autoRefreshGitStatus}
                setAutoRefreshGitStatus={props.setAutoRefreshGitStatus}
              />
            )}

            {settingsActiveTab === 'appearance' && (
              <AppearanceSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                setAccentColor={props.setAccentColor}
                themeMode={props.themeMode}
                setThemeMode={props.setThemeMode}
                selectedAiProvider={props.selectedAiProvider}
                useAiChatThemeColor={props.useAiChatThemeColor}
                setUseAiChatThemeColor={props.setUseAiChatThemeColor}
              />
            )}

            {settingsActiveTab === 'editor' && (
              <EditorSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                editorFontSize={props.editorFontSize}
                setEditorFontSize={props.setEditorFontSize}
                editorTabSize={props.editorTabSize}
                setEditorTabSize={props.setEditorTabSize}
                editorWordWrap={props.editorWordWrap}
                setEditorWordWrap={props.setEditorWordWrap}
                editorMinimap={props.editorMinimap}
                setEditorMinimap={props.setEditorMinimap}
                editorLineNumbers={props.editorLineNumbers}
                setEditorLineNumbers={props.setEditorLineNumbers}
                editorSmoothScrolling={props.editorSmoothScrolling}
                setEditorSmoothScrolling={props.setEditorSmoothScrolling}
                editorBracketColorization={props.editorBracketColorization}
                setEditorBracketColorization={props.setEditorBracketColorization}
                editorRenderWhitespace={props.editorRenderWhitespace}
                setEditorRenderWhitespace={props.setEditorRenderWhitespace}
              />
            )}

            {settingsActiveTab === 'terminal' && (
              <TerminalSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                terminalFontSize={props.terminalFontSize}
                setTerminalFontSize={props.setTerminalFontSize}
                terminalCursorStyle={props.terminalCursorStyle}
                setTerminalCursorStyle={props.setTerminalCursorStyle}
                terminalScrollback={props.terminalScrollback}
                setTerminalScrollback={props.setTerminalScrollback}
                terminalCursorBlink={props.terminalCursorBlink}
                setTerminalCursorBlink={props.setTerminalCursorBlink}
                terminalCopyOnSelect={props.terminalCopyOnSelect}
                setTerminalCopyOnSelect={props.setTerminalCopyOnSelect}
              />
            )}

            {settingsActiveTab === 'ai' && (
              <AiAgentsSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                selectedAiProvider={props.selectedAiProvider}
                setSelectedAiProvider={props.setSelectedAiProvider}
                aiMode={props.aiMode}
                setAiMode={props.setAiMode}
                aiAutoApprove={props.aiAutoApprove}
                setAiAutoApprove={props.setAiAutoApprove}
                aiConfirmBeforeDelete={props.aiConfirmBeforeDelete}
                setAiConfirmBeforeDelete={props.setAiConfirmBeforeDelete}
              />
            )}

            {settingsActiveTab === 'shortcuts' && (
              <ShortcutsSettingsTab themeTokens={themeTokens} isEffectiveDark={isEffectiveDark} />
            )}

            {settingsActiveTab === 'extensions' && (
              <ExtensionsSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                installedClis={props.installedClis}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
