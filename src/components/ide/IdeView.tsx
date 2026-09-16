import React, { useState, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Monitor,
  Blocks,
  Settings,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  SplitSquareVertical,
  Columns,
  X,
  Plus,
  Minus,
  Trash2,
  Maximize2,
  Terminal as TerminalIcon,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const codeContent = `import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translations } from './config/i18n/dashboard.translations';
import { getDashboardHtml } from './views/dashboard.view';
import { EsocialService } from './esocial/esocial.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly esocialService: EsocialService,
  ) {}

  getDashboardView(): string {
    const sandboxActive = this.esocialService.isSandboxActive();
    const tpAmb = this.configService.get<string>('ESOCIAL_TPAMB') || '2';
    return getDashboardHtml(JSON.stringify(translations), sandboxActive, tpAmb);
  }

  getSystemStatus(): Record<string, unknown> {
    return {
      uptime: this.formatUptime(process.uptime()),
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      memoryUsage: this.formatMemory(process.memoryUsage().heapUsed),
    };
  }

  private formatUptime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return \`\${hrs}h \${mins}m \${secs}s\`;
  }

  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return \`\${mb.toFixed(2)} MB\`;
  }
}
`;

export const IdeView: React.FC = () => {
  // Activity bar active item
  const [activeActivity, setActiveActivity] = useState<'files' | 'search' | 'git' | 'debug' | 'remote' | 'extensions'>('files');
  
  // Folder tree expansion
  const [ainaobraOpen, setAinaobraOpen] = useState(true);
  const [claudeOpen, setClaudeOpen] = useState(false);

  // Editor tabs
  const [activeEditorTab, setActiveEditorTab] = useState<'docker' | 'test' | 'main'>('main');

  // Terminal subtabs
  const [activeTermSubtab, setActiveTermSubtab] = useState<'problems' | 'output' | 'debug' | 'terminal' | 'ports'>('terminal');

  // AI chat model selector
  const [selectedModel, setSelectedModel] = useState('Claude Sonnet 5');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const handleEditorMount: OnMount = (_editor, monaco) => {
    monaco.editor.defineTheme('ainaobra-exact-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'c9d1d9' },
      ],
      colors: {
        'editor.background': '#0c0d10',
        'editor.foreground': '#c9d1d9',
        'editorCursor.foreground': '#ff6600',
        'editor.lineHighlightBackground': '#14151a',
        'editorLineNumber.foreground': '#4b5263',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#0c0d10',
      },
    });
    monaco.editor.setTheme('ainaobra-exact-theme');
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 66px)', overflow: 'hidden', backgroundColor: '#090a0d' }}>
      
      {/* 1. LEFT ACTIVITY BAR (Slim vertical strip) */}
      <div
        style={{
          width: '46px',
          backgroundColor: '#08090b',
          borderRight: '1px solid #16181f',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '6px',
          paddingBottom: '8px',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            className={`act-icon ${activeActivity === 'files' ? 'active' : ''}`}
            onClick={() => setActiveActivity('files')}
            title="Explorer"
          >
            <Files size={19} />
          </div>
          <div
            className={`act-icon ${activeActivity === 'search' ? 'active' : ''}`}
            onClick={() => setActiveActivity('search')}
            title="Search"
          >
            <Search size={18} />
          </div>
          <div
            className={`act-icon ${activeActivity === 'git' ? 'active' : ''}`}
            onClick={() => setActiveActivity('git')}
            title="Source Control"
          >
            <GitBranch size={19} />
          </div>
          <div
            className={`act-icon ${activeActivity === 'debug' ? 'active' : ''}`}
            onClick={() => setActiveActivity('debug')}
            title="Run and Debug"
          >
            <Play size={18} />
          </div>
          <div
            className={`act-icon ${activeActivity === 'remote' ? 'active' : ''}`}
            onClick={() => setActiveActivity('remote')}
            title="Remote / Containers"
          >
            <Monitor size={18} />
          </div>
          <div
            className={`act-icon ${activeActivity === 'extensions' ? 'active' : ''}`}
            onClick={() => setActiveActivity('extensions')}
            title="Extensions"
          >
            <Blocks size={19} />
          </div>
        </div>

        <div className="act-icon" title="Settings">
          <Settings size={18} />
        </div>
      </div>

      {/* 2. EXPLORER SIDEBAR */}
      <div
        style={{
          width: '230px',
          backgroundColor: '#0e0f13',
          borderRight: '1px solid #1a1b22',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
        }}
      >
        {/* Top: Explorer Header & Tree */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              height: '35px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#8e94a5',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Explorer</span>
            <MoreHorizontal size={14} color="#6e7485" style={{ cursor: 'pointer' }} />
          </div>

          {/* Folder Tree */}
          <div style={{ padding: '4px 0', fontSize: '0.78rem' }}>
            {/* Folder: .claude */}
            <div
              onClick={() => setClaudeOpen(!claudeOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                cursor: 'pointer',
                color: '#b0b5c3',
              }}
            >
              {claudeOpen ? <ChevronDown size={13} color="#6e7485" /> : <ChevronRight size={13} color="#6e7485" />}
              <Folder size={14} color="#d97706" />
              <span>.claude</span>
            </div>

            {/* Folder: ainaobra (expanded with orange vertical line) */}
            <div>
              <div
                onClick={() => setAinaobraOpen(!ainaobraOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontWeight: 500,
                }}
              >
                {ainaobraOpen ? <ChevronDown size={13} color="#ff6600" /> : <ChevronRight size={13} color="#6e7485" />}
                {ainaobraOpen ? <FolderOpen size={14} color="#ff6600" /> : <Folder size={14} color="#ff6600" />}
                <span>ainaobra</span>
              </div>

              {ainaobraOpen && (
                <div style={{ marginLeft: '16px', borderLeft: '1px solid rgba(255, 102, 0, 0.4)', paddingLeft: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', color: '#b0b5c3', cursor: 'pointer' }}>
                    <ChevronRight size={13} color="#6e7485" />
                    <Folder size={14} color="#d97706" />
                    <span>data</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', color: '#b0b5c3', cursor: 'pointer' }}>
                    <ChevronRight size={13} color="#6e7485" />
                    <Folder size={14} color="#d97706" />
                    <span>dist</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', color: '#b0b5c3', cursor: 'pointer' }}>
                    <ChevronRight size={13} color="#6e7485" />
                    <Folder size={14} color="#d97706" />
                    <span>certs</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Collapsible Sections: Outline & Timeline */}
        <div style={{ borderTop: '1px solid #1a1b22' }}>
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: '#7b8192',
              cursor: 'pointer',
              borderBottom: '1px solid #14151b',
            }}
          >
            <span>Outline</span>
            <ChevronRight size={13} />
          </div>
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: '#7b8192',
              cursor: 'pointer',
            }}
          >
            <span>Timeline</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>

      {/* 3. CENTER COLUMN: EDITOR & TERMINAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, backgroundColor: '#0c0d10' }}>
        
        {/* Editor Tabs Bar */}
        <div
          style={{
            height: '35px',
            backgroundColor: '#0c0d10',
            borderBottom: '1px solid #1a1b22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: '10px',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {/* Tab 1: Dockerfile */}
            <div
              onClick={() => setActiveEditorTab('docker')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                height: '100%',
                fontSize: '0.76rem',
                color: activeEditorTab === 'docker' ? '#ffffff' : '#737989',
                backgroundColor: activeEditorTab === 'docker' ? '#14151b' : 'transparent',
                borderRight: '1px solid #16181f',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.7rem' }}>🐳</span>
              <span>Dockerfile</span>
              <X size={12} style={{ opacity: 0.5, marginLeft: '4px' }} />
            </div>

            {/* Tab 2: test.c */}
            <div
              onClick={() => setActiveEditorTab('test')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                height: '100%',
                fontSize: '0.76rem',
                color: activeEditorTab === 'test' ? '#ffffff' : '#737989',
                backgroundColor: activeEditorTab === 'test' ? '#14151b' : 'transparent',
                borderRight: '1px solid #16181f',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.72rem' }}>C</span>
              <span>test.c</span>
            </div>

            {/* Tab 3: main.ts (Active) */}
            <div
              onClick={() => setActiveEditorTab('main')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 14px',
                height: '100%',
                fontSize: '0.76rem',
                color: activeEditorTab === 'main' ? '#ffffff' : '#737989',
                backgroundColor: activeEditorTab === 'main' ? '#14151b' : 'transparent',
                borderRight: '1px solid #16181f',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.72rem' }}>TS</span>
              <span>main.ts</span>
            </div>
          </div>

          {/* Right Editor Actions (Split / More) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#737989' }}>
            <Columns size={15} style={{ cursor: 'pointer' }} />
            <SplitSquareVertical size={15} style={{ cursor: 'pointer' }} />
            <MoreHorizontal size={15} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        {/* Editor Content Area */}
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <Editor
            height="100%"
            language="typescript"
            value={codeContent}
            theme="ainaobra-exact-theme"
            onMount={handleEditorMount}
            options={{
              fontSize: 12.5,
              fontFamily: 'JetBrains Mono, Menlo, monospace',
              tabSize: 2,
              lineNumbers: 'on',
              minimap: { enabled: true, renderCharacters: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              cursorWidth: 2,
              padding: { top: 6, bottom: 6 },
            }}
          />
        </div>

        {/* Bottom Terminal Panel */}
        <div
          style={{
            height: '270px',
            backgroundColor: '#090a0c',
            borderTop: '1px solid #181920',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Terminal Tabs Header */}
          <div
            style={{
              height: '32px',
              backgroundColor: '#090a0c',
              borderBottom: '1px solid #15161c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
            }}
          >
            {/* Subtabs: Problems, Output, Debug console, Terminal, Ports */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className={`term-tab ${activeTermSubtab === 'problems' ? 'active' : ''}`}
                onClick={() => setActiveTermSubtab('problems')}
              >
                Problems
              </button>
              <button
                className={`term-tab ${activeTermSubtab === 'output' ? 'active' : ''}`}
                onClick={() => setActiveTermSubtab('output')}
              >
                Output
              </button>
              <button
                className={`term-tab ${activeTermSubtab === 'debug' ? 'active' : ''}`}
                onClick={() => setActiveTermSubtab('debug')}
              >
                Debug console
              </button>
              <button
                className={`term-tab ${activeTermSubtab === 'terminal' ? 'active' : ''}`}
                onClick={() => setActiveTermSubtab('terminal')}
              >
                Terminal
              </button>
              <button
                className={`term-tab ${activeTermSubtab === 'ports' ? 'active' : ''}`}
                onClick={() => setActiveTermSubtab('ports')}
              >
                Ports
              </button>
            </div>

            {/* Terminal Actions Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#737989' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#161820',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  color: '#fff',
                }}
              >
                <TerminalIcon size={12} color="#ff6600" />
                <span>zsh</span>
              </div>
              <Plus size={13} style={{ cursor: 'pointer' }} />
              <Minus size={13} style={{ cursor: 'pointer' }} />
              <Columns size={13} style={{ cursor: 'pointer' }} />
              <Trash2 size={13} style={{ cursor: 'pointer' }} />
              <Maximize2 size={13} style={{ cursor: 'pointer' }} />
              <MoreHorizontal size={13} style={{ cursor: 'pointer' }} />
              <X size={13} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Terminal Body: Split zsh panes */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Terminal Pane */}
            <div
              style={{
                flex: 1,
                borderRight: '1px solid #16181f',
                padding: '8px 12px',
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: '0.74rem',
                color: '#d1d5db',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#71717a', fontSize: '0.68rem', marginBottom: '4px' }}>
                <TerminalIcon size={11} color="#ff6600" />
                <span>zsh</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#e4e4e7' }}>walancy@MacBook-Pro-de-Walancy codes % </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '14px',
                    backgroundColor: '#ff6600',
                    marginLeft: '4px',
                    animation: 'pulse 1s infinite',
                  }}
                />
              </div>
            </div>

            {/* Right Terminal Pane */}
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: '0.74rem',
                color: '#d1d5db',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#71717a', fontSize: '0.68rem', marginBottom: '4px' }}>
                <TerminalIcon size={11} color="#ff6600" />
                <span>zsh</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#71717a' }}>walancy@MacBook-Pro-de-Walancy codes % </span>
              </div>
            </div>

            {/* Far Right Terminal Tabs Switcher */}
            <div
              style={{
                width: '90px',
                borderLeft: '1px solid #16181f',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  backgroundColor: '#191b22',
                  border: '1px solid rgba(255,102,0,0.4)',
                  fontSize: '0.7rem',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <TerminalIcon size={11} color="#ff6600" />
                <span>zsh</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  fontSize: '0.7rem',
                  color: '#71717a',
                  cursor: 'pointer',
                }}
              >
                <TerminalIcon size={11} />
                <span>zsh</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RIGHT SIDEBAR: AINAOBRA AI ASSISTANT */}
      <div
        style={{
          width: '320px',
          backgroundColor: '#17110c',
          borderLeft: '1px solid #241c16',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
        }}
      >
        {/* Brand Title: Ainaobra */}
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 500,
            color: '#f4f4f5',
            letterSpacing: '-0.02em',
            marginBottom: '36px',
          }}
        >
          Ainaobra
        </h1>

        {/* Floating Input Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '280px',
            backgroundColor: '#201812',
            border: '1px solid #2e231b',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          {/* Ask anything input */}
          <input
            type="text"
            placeholder="Ask anything"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f4f4f5',
              fontSize: '0.84rem',
              fontWeight: 400,
            }}
          />

          {/* Bottom row: dropdown pill + orange arrow button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Model Selector Dropdown Pill */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>+</span>
                <span>{selectedModel}</span>
                <ChevronDown size={12} color="#71717a" />
              </button>

              {modelDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    left: 0,
                    width: '200px',
                    backgroundColor: '#261e17',
                    border: '1px solid #3d2f25',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}
                >
                  {['Claude Sonnet 5', 'Claude Code CLI', 'Antigravity (AGY)', 'Gemini Flash'].map((m) => (
                    <div
                      key={m}
                      onClick={() => {
                        setSelectedModel(m);
                        setModelDropdownOpen(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        fontSize: '0.74rem',
                        color: m === selectedModel ? '#ff6600' : '#d4d4d8',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Circular Orange Action Button */}
            <button
              onClick={() => {
                if (aiPrompt.trim()) {
                  alert(`Prompt enviado para ${selectedModel}: "${aiPrompt}"`);
                  setAiPrompt('');
                }
              }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ff6600',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255,102,0,0.4)',
              }}
            >
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
