import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { X, Save, SplitSquareVertical, FileCode } from 'lucide-react';
import { EditorTab } from '../../types';

interface CodeEditorProps {
  tabs: EditorTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onChangeContent: (id: string, newContent: string) => void;
  onSaveFile: (id: string) => void;
  onCursorChange?: (line: number, col: number) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSaveFile,
  onCursorChange,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const editorRef = useRef<any>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Define custom Antigravity Dark theme
    monaco.editor.defineTheme('antigravity-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'variable', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#0c0d12',
        'editor.foreground': '#e6e8ee',
        'editorCursor.foreground': '#ff6600',
        'editor.lineHighlightBackground': '#14161f',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#ff6600',
        'editor.selectionBackground': '#2d3748',
        'editorGutter.background': '#0c0d12',
      },
    });

    monaco.editor.setTheme('antigravity-dark');

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // Keyboard shortcut for saving (Ctrl+S / Cmd+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) {
        onSaveFile(activeTab.id);
      }
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div
        style={{
          height: '35px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflowX: 'auto',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 12px',
                  height: '100%',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? '#0c0d12' : 'transparent',
                  borderTop: isActive ? '2px solid var(--accent-orange)' : '2px solid transparent',
                  borderRight: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <FileCode size={13} color={isActive ? 'var(--accent-orange)' : 'var(--text-muted)'} />
                <span>{tab.name}</span>
                {tab.isDirty && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-orange)',
                    }}
                  />
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    padding: '2px',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  className="btn-icon"
                >
                  <X size={12} />
                </span>
              </div>
            );
          })}
        </div>

        {/* Action icons right of tab bar */}
        {activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px' }}>
            <button
              className="btn-icon"
              title="Salvar Arquivo (Ctrl+S / Cmd+S)"
              onClick={() => onSaveFile(activeTab.id)}
            >
              <Save size={13} color={activeTab.isDirty ? 'var(--accent-orange)' : 'inherit'} />
            </button>
            <button className="btn-icon" title="Dividir Editor">
              <SplitSquareVertical size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Monaco Editor Container */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', backgroundColor: '#0c0d12' }}>
        {activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            onMount={handleEditorMount}
            onChange={(val) => onChangeContent(activeTab.id, val || '')}
            options={{
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Menlo, monospace',
              tabSize: 2,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              padding: { top: 8, bottom: 8 },
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <FileCode size={42} strokeWidth={1} color="var(--border-active)" />
            <p style={{ fontSize: '0.85rem' }}>Nenhum arquivo aberto no editor</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Selecione um arquivo no Explorer à esquerda para visualizar e editar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
