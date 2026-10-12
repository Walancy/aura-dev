import React, { useRef } from 'react';
import { Settings, X, GaugeCircle, Palette, Code, SquareTerminal, Bot, Keyboard, Folder, GitBranch, LayoutTemplate, FileCode, ListTodo } from 'lucide-react';
import { hexToRgba } from '../../utils/color';
import type { ThemeTokens } from '../../types/ide';
import type { AiMode } from '../../constants/ai';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab';
import { EditorSettingsTab } from './settings/EditorSettingsTab';
import { TerminalSettingsTab } from './settings/TerminalSettingsTab';
import { AiAgentsSettingsTab } from './settings/AiAgentsSettingsTab';
import { ShortcutsSettingsTab } from './settings/ShortcutsSettingsTab';
import { LayoutSettingsTab } from './settings/LayoutSettingsTab';
import { SnippetsSettingsTab } from './settings/SnippetsSettingsTab';
import { TasksSettingsTab } from './settings/TasksSettingsTab';
import { WorkspaceSettingsTab } from './settings/WorkspaceSettingsTab';
import { logSystemActivity } from '../../utils/brainService';
import type { GitBranchItem } from '../../types/ide';

export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'terminal'
  | 'ai'
  | 'layout'
  | 'snippets'
  | 'tasks'
  | 'shortcuts'
  | 'workspace';

export interface SettingsModalProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  onClose: () => void;
  settingsActiveTab: SettingsTabId;
  setSettingsActiveTab: (tab: SettingsTabId) => void;
  workspacePath: string;
  currentBranch: string;
  onOpenBranchManager?: () => void;

  // Workspace & Git management
  gitRepoName?: string;
  branchesList?: GitBranchItem[];
  onCheckoutBranch?: (name: string) => void;
  onCreateBranch?: (name: string) => void;
  isCreatingBranch?: boolean;
  onSyncGit?: () => void;
  isSyncingGit?: boolean;
  onRefreshBranches?: () => void;

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
  panelAlignment?: 'left' | 'right' | 'center' | 'justify';
  setPanelAlignment?: (value: 'left' | 'right' | 'center' | 'justify') => void;
  showActivityBar?: boolean;
  setShowActivityBar?: (value: boolean) => void;
  showStatusBar?: boolean;
  setShowStatusBar?: (value: boolean) => void;

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
  editorFontFamily?: string;
  setEditorFontFamily?: (value: string) => void;
  editorLineHeight?: number;
  setEditorLineHeight?: (value: number) => void;
  editorCursorStyle?: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline';
  setEditorCursorStyle?: (value: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline') => void;
  editorCursorBlinking?: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  setEditorCursorBlinking?: (value: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid') => void;
  editorGuides?: boolean;
  setEditorGuides?: (value: boolean) => void;
  editorAutoClosingBrackets?: boolean;
  setEditorAutoClosingBrackets?: (value: boolean) => void;
  editorHighlightActiveLine?: 'all' | 'line' | 'none';
  setEditorHighlightActiveLine?: (value: 'all' | 'line' | 'none') => void;
  editorFormatOnSave?: boolean;
  setEditorFormatOnSave?: (value: boolean) => void;
  editorCodeFolding?: boolean;
  setEditorCodeFolding?: (value: boolean) => void;

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
  terminalFontFamily?: string;
  setTerminalFontFamily?: (value: string) => void;
  terminalLineHeight?: number;
  setTerminalLineHeight?: (value: number) => void;
  terminalThemePreset?: string;
  setTerminalThemePreset?: (value: string) => void;
  terminalCursorWidth?: number;
  setTerminalCursorWidth?: (value: number) => void;
  terminalScrollOnUserInput?: boolean;
  setTerminalScrollOnUserInput?: (value: boolean) => void;
  terminalDrawBoldTextInBrightColors?: boolean;
  setTerminalDrawBoldTextInBrightColors?: (value: boolean) => void;

  // AI & Agents tab
  selectedAiProvider: string;
  setSelectedAiProvider: (id: string) => void;
  aiMode: AiMode;
  setAiMode: (id: AiMode) => void;
  aiAutoApprove: boolean;
  setAiAutoApprove: (value: boolean) => void;
  aiConfirmBeforeDelete: boolean;
  setAiConfirmBeforeDelete: (value: boolean) => void;
  onOpenAiGlobalRules?: () => void;
  onOpenSkills?: () => void;
  activeSkillsCount?: number;

  // Additional system options
  pinnedAis?: string[];
  setPinnedAis?: (pinned: string[]) => void;
  useAiSystemAccent?: boolean;
  setUseAiSystemAccent?: (value: boolean) => void;
  devForce?: boolean;
  setDevForce?: (value: boolean) => void;
  aiAutoUpdate?: boolean;
  setAiAutoUpdate?: (value: boolean) => void;
  rainbow?: { on: boolean; stops: string[]; speed: number };
  setRainbow?: (value: { on: boolean; stops: string[]; speed: number }) => void;

  // Layout tab options
  showExplorer?: boolean;
  setShowExplorer?: (value: boolean) => void;
  showAiPanel?: boolean;
  setShowAiPanel?: (value: boolean) => void;
  isTerminalCollapsed?: boolean;
  setIsTerminalCollapsed?: (value: boolean) => void;
  quickInputPosition?: 'top' | 'center';
  setQuickInputPosition?: (value: 'top' | 'center') => void;
  onToggleFullscreen?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onResetLayout?: () => void;

  // Tasks tab options
  onOpenTasksDock?: () => void;
  onToast?: (msg: string) => void;
}

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'Geral', icon: <GaugeCircle size={15} /> },
  { id: 'appearance', label: 'Estilização & Temas', icon: <Palette size={15} /> },
  { id: 'editor', label: 'Configurações Editor', icon: <Code size={15} /> },
  { id: 'terminal', label: 'Terminal', icon: <SquareTerminal size={15} /> },
  { id: 'ai', label: 'IA & Agentes', icon: <Bot size={15} /> },
  { id: 'layout', label: 'Personalizar Layout', icon: <LayoutTemplate size={15} /> },
  { id: 'snippets', label: 'Configurar Snippets', icon: <FileCode size={15} /> },
  { id: 'tasks', label: 'Tarefas', icon: <ListTodo size={15} /> },
  { id: 'shortcuts', label: 'Atalhos de Teclado', icon: <Keyboard size={15} /> },
];

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

  const isMouseDownOnBackdrop = useRef(false);

  return (
    <>
      {/* Backdrop */}
      <div
        onMouseDown={(e) => {
          isMouseDownOnBackdrop.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
            onClose();
          }
          isMouseDownOnBackdrop.current = false;
        }}
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
          width: 'min(1180px, calc(100vw - 32px))',
          height: 'min(820px, calc(100vh - 32px))',
          background: isEffectiveDark ? '#141416' : '#ffffff',
          border: 'none',
          borderRadius: 12,
          boxShadow: 'none',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.12s ease-out',
          color: themeTokens.textPrimary,
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 400, fontSize: 13, color: themeTokens.textPrimary }}>
                Configurações
              </div>
              <div style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                Estilização, editor, atalhos e agentes do Aura Dev
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: themeTokens.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : '#000000')}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
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
              width: 220,
              flexShrink: 0,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
              borderRight: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
              padding: '14px 10px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 500, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 10px', marginBottom: 6 }}>
              Preferências
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SETTINGS_TABS.map((tab) => {
                const active = settingsActiveTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => {
                      logSystemActivity('configuracoes', 'trocar_aba', tab.label, { tab: tab.id });
                      setSettingsActiveTab(tab.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: 400,
                      color: active ? accentColor : themeTokens.textSecondary,
                      background: active ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)') : 'transparent',
                      transition: 'all 0.12s ease',
                      border: 'none',
                      boxShadow: 'none',
                    }}
                  >
                    <div style={{ color: active ? accentColor : 'inherit' }}>{tab.icon}</div>
                    <span>{tab.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Workspace group */}
            {workspacePath && (
              <>
                <div style={{ fontSize: 10, fontWeight: 500, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 10px', marginTop: 18, marginBottom: 6 }}>
                  Workspace
                </div>
                <div
                  onClick={() => {
                    logSystemActivity('configuracoes', 'trocar_aba', 'Workspace', { tab: 'workspace' });
                    setSettingsActiveTab('workspace');
                    props.onRefreshBranches?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 400,
                    color: settingsActiveTab === 'workspace' ? accentColor : themeTokens.textSecondary,
                    background: settingsActiveTab === 'workspace'
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')
                      : 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (settingsActiveTab !== 'workspace') {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (settingsActiveTab !== 'workspace') {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  title="Configurações e Branches do Workspace"
                >
                  <Folder size={14} color={settingsActiveTab === 'workspace' ? accentColor : undefined} />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: settingsActiveTab === 'workspace' ? accentColor : themeTokens.textPrimary, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {workspacePath.split('/').filter(Boolean).pop()}
                    </div>
                    {currentBranch && (
                      <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, color: settingsActiveTab === 'workspace' ? accentColor : themeTokens.textSecondary }}>
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
            <div style={{ borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)', paddingTop: 8, marginTop: 8, padding: '8px 10px 0 10px' }}>
              <div style={{ fontSize: 10, color: themeTokens.textSecondary }}>Aura Dev • v1.0.0</div>
            </div>
          </div>

          {/* Right Content Pane */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
            {settingsActiveTab === 'general' && (
              <GeneralSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                isCenteredLayout={props.isCenteredLayout}
                setIsCenteredLayout={props.setIsCenteredLayout}
                restoreLastWorkspace={props.restoreLastWorkspace}
                setRestoreLastWorkspace={props.setRestoreLastWorkspace}
                confirmBeforeClosingUnsaved={props.confirmBeforeClosingUnsaved}
                setConfirmBeforeClosingUnsaved={props.setConfirmBeforeClosingUnsaved}
                autoRefreshGitStatus={props.autoRefreshGitStatus}
                setAutoRefreshGitStatus={props.setAutoRefreshGitStatus}
                showActivityBar={props.showActivityBar}
                setShowActivityBar={props.setShowActivityBar}
                showStatusBar={props.showStatusBar}
                setShowStatusBar={props.setShowStatusBar}
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
                useAiSystemAccent={props.useAiSystemAccent}
                setUseAiSystemAccent={props.setUseAiSystemAccent}
                rainbow={props.rainbow}
                setRainbow={props.setRainbow}
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
                editorFontFamily={props.editorFontFamily}
                setEditorFontFamily={props.setEditorFontFamily}
                editorLineHeight={props.editorLineHeight}
                setEditorLineHeight={props.setEditorLineHeight}
                editorCursorStyle={props.editorCursorStyle}
                setEditorCursorStyle={props.setEditorCursorStyle}
                editorCursorBlinking={props.editorCursorBlinking}
                setEditorCursorBlinking={props.setEditorCursorBlinking}
                editorGuides={props.editorGuides}
                setEditorGuides={props.setEditorGuides}
                editorAutoClosingBrackets={props.editorAutoClosingBrackets}
                setEditorAutoClosingBrackets={props.setEditorAutoClosingBrackets}
                editorHighlightActiveLine={props.editorHighlightActiveLine}
                setEditorHighlightActiveLine={props.setEditorHighlightActiveLine}
                editorFormatOnSave={props.editorFormatOnSave}
                setEditorFormatOnSave={props.setEditorFormatOnSave}
                editorCodeFolding={props.editorCodeFolding}
                setEditorCodeFolding={props.setEditorCodeFolding}
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
                terminalFontFamily={props.terminalFontFamily}
                setTerminalFontFamily={props.setTerminalFontFamily}
                terminalLineHeight={props.terminalLineHeight}
                setTerminalLineHeight={props.setTerminalLineHeight}
                terminalThemePreset={props.terminalThemePreset}
                setTerminalThemePreset={props.setTerminalThemePreset}
                terminalCursorWidth={props.terminalCursorWidth}
                setTerminalCursorWidth={props.setTerminalCursorWidth}
                terminalScrollOnUserInput={props.terminalScrollOnUserInput}
                setTerminalScrollOnUserInput={props.setTerminalScrollOnUserInput}
                terminalDrawBoldTextInBrightColors={props.terminalDrawBoldTextInBrightColors}
                setTerminalDrawBoldTextInBrightColors={props.setTerminalDrawBoldTextInBrightColors}
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
                onOpenAiGlobalRules={props.onOpenAiGlobalRules}
                onOpenSkills={props.onOpenSkills}
                activeSkillsCount={props.activeSkillsCount}
                pinnedAis={props.pinnedAis}
                setPinnedAis={props.setPinnedAis}
                useAiSystemAccent={props.useAiSystemAccent}
                setUseAiSystemAccent={props.setUseAiSystemAccent}
                useAiChatThemeColor={props.useAiChatThemeColor}
                setUseAiChatThemeColor={props.setUseAiChatThemeColor}
                devForce={props.devForce}
                setDevForce={props.setDevForce}
                aiAutoUpdate={props.aiAutoUpdate}
                setAiAutoUpdate={props.setAiAutoUpdate}
              />
            )}

            {settingsActiveTab === 'layout' && (
              <LayoutSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                showActivityBar={props.showActivityBar}
                setShowActivityBar={props.setShowActivityBar}
                showExplorer={props.showExplorer}
                setShowExplorer={props.setShowExplorer}
                showAiPanel={props.showAiPanel}
                setShowAiPanel={props.setShowAiPanel}
                isTerminalCollapsed={props.isTerminalCollapsed}
                setIsTerminalCollapsed={props.setIsTerminalCollapsed}
                showStatusBar={props.showStatusBar}
                setShowStatusBar={props.setShowStatusBar}
                sidebarPosition={props.sidebarPosition}
                setSidebarPosition={props.setSidebarPosition}
                panelAlignment={props.panelAlignment}
                setPanelAlignment={props.setPanelAlignment}
                quickInputPosition={props.quickInputPosition}
                setQuickInputPosition={props.setQuickInputPosition}
                onToggleFullscreen={props.onToggleFullscreen}
                onToggleZenMode={props.onToggleZenMode}
                isZenMode={props.isZenMode}
                isCenteredLayout={props.isCenteredLayout}
                setIsCenteredLayout={props.setIsCenteredLayout}
                onResetLayout={props.onResetLayout}
              />
            )}

            {settingsActiveTab === 'snippets' && (
              <SnippetsSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
              />
            )}

            {settingsActiveTab === 'tasks' && (
              <TasksSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                onOpenTasksDock={props.onOpenTasksDock}
                onToast={props.onToast}
              />
            )}

            {settingsActiveTab === 'shortcuts' && (
              <ShortcutsSettingsTab themeTokens={themeTokens} isEffectiveDark={isEffectiveDark} />
            )}

            {settingsActiveTab === 'workspace' && (
              <WorkspaceSettingsTab
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                workspacePath={workspacePath}
                currentBranch={currentBranch}
                gitRepoName={props.gitRepoName}
                branchesList={props.branchesList || []}
                onCheckoutBranch={props.onCheckoutBranch}
                onCreateBranch={props.onCreateBranch}
                isCreatingBranch={props.isCreatingBranch}
                onSyncGit={props.onSyncGit}
                isSyncingGit={props.isSyncingGit}
                onRefreshBranches={props.onRefreshBranches}
                restoreLastWorkspace={props.restoreLastWorkspace}
                setRestoreLastWorkspace={props.setRestoreLastWorkspace}
                autoRefreshGitStatus={props.autoRefreshGitStatus}
                setAutoRefreshGitStatus={props.setAutoRefreshGitStatus}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
