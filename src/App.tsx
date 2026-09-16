import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Minimize2,
  Terminal as TerminalIcon,
  ArrowRight,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Radio,
  ExternalLink,
  Sidebar,
  PanelBottom,
  PanelRight,
  LayoutGrid,
  SquareTerminal,
  AtSign,
  Save,
  FileText,
  FilePlus,
  FolderPlus,
  AlertTriangle,
  Sparkles,
  Download,
} from 'lucide-react';
import avatarImg from './avatar.png';
import claudeLogo from './assets/logos/claude-color.svg';
import antigravityLogo from './assets/logos/google-antigravity-icon.svg';
import codexLogo from './assets/logos/codex-color.svg';
import geminiLogo from './assets/logos/gemini-icon-seeklogo.svg';
import ollamaLogo from './assets/logos/ollama-icon.svg';

// Claude Color Official SVG Icon
const ClaudeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={claudeLogo}
    alt="Claude"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Google Antigravity Official SVG Icon
const AntigravityIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={antigravityLogo}
    alt="Google Antigravity"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: 2,
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Google Gemini Official SVG Icon
const GeminiIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={geminiLogo}
    alt="Google Gemini"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Ollama Official SVG Icon
const OllamaIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={ollamaLogo}
    alt="Ollama"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// OpenAI Codex Official SVG Icon
const CodexIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={codexLogo}
    alt="OpenAI Codex"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

interface AiProviderConfig {
  id: string;
  name: string;
  cliCommand: string;
  installUrl: string;
  installGuide: string;
  models: string[];
}

const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    cliCommand: 'claude',
    installUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview',
    installGuide: 'npm install -g @anthropic-ai/claude-code',
    models: [
      'Claude 3.7 Sonnet (Thinking)',
      'Claude 3.5 Sonnet',
      'Claude 3.5 Haiku',
      'Claude Sonnet 5 (Preview)',
      'Claude 3 Opus',
    ],
  },
  {
    id: 'antigravity',
    name: 'Google Antigravity',
    cliCommand: 'agy',
    installUrl: 'https://github.com/google-deepmind/antigravity',
    installGuide: 'curl -fsSL https://antigravity.google.com/install.sh | bash',
    models: [
      'AGY 2.0 Autonomous Agent',
      'AGY Agentic Pair Programmer',
      'AGY Planning & Architecture',
      'AGY Background Deep Search',
    ],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    cliCommand: 'codex',
    installUrl: 'https://platform.openai.com/docs/models',
    installGuide: 'npm install -g openai',
    models: [
      'GPT-4o (Omni)',
      'o3-mini (Reasoning)',
      'o1 Pro Mode',
      'GPT-5 (Preview)',
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    cliCommand: 'gemini',
    installUrl: 'https://ai.google.dev/gemini-api/docs/quickstart',
    installGuide: 'npm install -g @google/gemini-cli',
    models: [
      'Gemini 2.5 Pro (Thinking & Multimodal)',
      'Gemini 2.5 Flash',
      'Gemini 2.0 Flash Thinking',
      'Gemini 1.5 Pro',
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    cliCommand: 'ollama',
    installUrl: 'https://ollama.com/download',
    installGuide: 'brew install ollama',
    models: [
      'DeepSeek R1 (70B & 8B)',
      'Llama 3.3 70B',
      'Qwen 2.5 Coder 32B',
      'Mistral Large 2',
    ],
  },
];

interface TerminalSessionItem {
  id: string;
  name: string;
  type: 'zsh' | 'bash' | 'claude' | 'agy';
  pid: number;
  command: string;
  shellIntegration: string;
  isSplit?: boolean;
  splitWithId?: string;
}

export interface OpenFileItem {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
}

export interface ExplorerNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: ExplorerNode[];
}

function getFileLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'sh':
    case 'zsh':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}


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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projetos' | 'daily' | 'equipmentos' | 'ide' | 'ports'>('ide');
  const [activeTermTab, setActiveTermTab] = useState<'problems' | 'output' | 'debug' | 'terminal' | 'ports'>('terminal');

  // Open Files in Monaco Editor
  const [openFiles, setOpenFiles] = useState<OpenFileItem[]>([
    {
      id: '/Users/walancy/Documents/codes/ainaobra/apps/ainaobra-api/src/app.service.ts',
      name: 'main.ts',
      path: '/Users/walancy/Documents/codes/ainaobra/apps/ainaobra-api/src/app.service.ts',
      content: codeContent,
      language: 'typescript',
      isDirty: false,
    },
    {
      id: '/Users/walancy/Documents/codes/ainaobra/Dockerfile',
      name: 'Dockerfile',
      path: '/Users/walancy/Documents/codes/ainaobra/Dockerfile',
      content: `FROM node:20-alpine AS base\nWORKDIR /app\nRUN apk add --no-cache libc6-compat\n\nFROM base AS installer\nCOPY package.json ./ \nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]\n`,
      language: 'dockerfile',
      isDirty: false,
    },
    {
      id: '/Users/walancy/Documents/codes/ainaobra/apps/ainaobra-api/src/app.service.spec.ts',
      name: 'app.service.spec.ts',
      path: '/Users/walancy/Documents/codes/ainaobra/apps/ainaobra-api/src/app.service.spec.ts',
      content: `import { Test, TestingModule } from '@nestjs/testing';\nimport { AppService } from './app.service';\n\ndescribe('AppService', () => {\n  let service: AppService;\n\n  beforeEach(async () => {\n    const module: TestingModule = await Test.createTestingModule({\n      providers: [AppService],\n    }).compile();\n\n    service = module.get<AppService>(AppService);\n  });\n\n  it('should be defined', () => {\n    expect(service).toBeDefined();\n  });\n});\n`,
      language: 'typescript',
      isDirty: false,
    },
  ]);
  const [activeFileId, setActiveFileId] = useState<string>(
    '/Users/walancy/Documents/codes/ainaobra/apps/ainaobra-api/src/app.service.ts'
  );
  const activeFile = openFiles.find((f) => f.id === activeFileId) || openFiles[0];
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Workspace & Explorer State
  const [workspacePath, setWorkspacePath] = useState<string>(() => {
    return localStorage.getItem('ide_workspace_path') || '/Users/walancy/Documents/codes/ainaobra';
  });
  const [fileTree, setFileTree] = useState<ExplorerNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/Users/walancy/Documents/codes/ainaobra', '/Users/walancy/Documents/codes/ainaobra/apps'])
  );
  const [explorerMenuOpen, setExplorerMenuOpen] = useState(false);
  const explorerMenuRef = useRef<HTMLDivElement>(null);

  // Real Terminal Working Directory and Execution State
  const [terminalCwd, setTerminalCwd] = useState<string>(() => {
    return localStorage.getItem('ide_terminal_cwd') || '/Users/walancy/Documents/codes/ainaobra';
  });
  const [terminalCommandHistory, setTerminalCommandHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const [askPrompt, setAskPrompt] = useState('');
  const [selectedAiProvider, setSelectedAiProvider] = useState<string>('claude');
  const [selectedModel, setSelectedModel] = useState<string>('Claude 3.7 Sonnet (Thinking)');
  const [providerDropdown, setProviderDropdown] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [aiHistory, setAiHistory] = useState<
    Array<{ type: 'user' | 'assistant' | 'system' | 'error'; text: string; downloadUrl?: string; command?: string }>
  >([]);
  const [isAiExecuting, setIsAiExecuting] = useState(false);
  const [aiNotInstalledAlert, setAiNotInstalledAlert] = useState<{
    modelName: string;
    command: string;
    url: string;
    guide: string;
  } | null>(null);
  const aiTerminalScrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHoveringTrafficLightArea, setIsHoveringTrafficLightArea] = useState(false);

  // Panel Visibility Controls
  const [showExplorer, setShowExplorer] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(true);

  // Draggable Resize Dimensions (VS Code Style)
  const [explorerWidth, setExplorerWidth] = useState(() => {
    const saved = localStorage.getItem('ide_explorer_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem('ide_ai_panel_width');
    return saved ? parseInt(saved, 10) : 340;
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('ide_terminal_height');
    return saved ? parseInt(saved, 10) : 220;
  });

  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingAi, setIsDraggingAi] = useState(false);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  // Right Terminal Tabs Width (VS Code Style)
  const [terminalTabsWidth, setTerminalTabsWidth] = useState(() => {
    const saved = localStorage.getItem('ide_term_tabs_width');
    return saved ? parseInt(saved, 10) : 175;
  });
  const [isDraggingTermTabs, setIsDraggingTermTabs] = useState(false);

  // Left Terminal Split Panes Ratio (%)
  const [terminalSplitRatio, setTerminalSplitRatio] = useState(() => {
    const saved = localStorage.getItem('ide_term_split_ratio');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [isDraggingSplitPanes, setIsDraggingSplitPanes] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Terminal Interactive States
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isSplitTerminal, setIsSplitTerminal] = useState(true);
  const [terminalShell, setTerminalShell] = useState('zsh');
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [debugCommand, setDebugCommand] = useState('');
  const [debugHistory, setDebugHistory] = useState<string[]>([
    'Debugger listening on ws://127.0.0.1:9229/ainaobra-api',
    'Debugger attached to process 58135 (Node.js runtime)',
  ]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'walancy@MacBook-Pro-de-Walancy codes % ',
  ]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionItem[]>([
    {
      id: '1',
      name: 'zsh',
      type: 'zsh',
      pid: 61830,
      command: '/bin/zsh -il',
      shellIntegration: 'Rich',
      isSplit: true,
    },
    {
      id: '2',
      name: 'zsh',
      type: 'zsh',
      pid: 61842,
      command: '/bin/zsh -il',
      shellIntegration: 'Rich',
      isSplit: true,
      splitWithId: '1',
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [popoverTop, setPopoverTop] = useState(25);
  const hoverTimerRef = useRef<any>(null);


  const inputRef = useRef<HTMLInputElement>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const editorInstanceRef = useRef<any>(null);

  // Fullscreen Detection
  useEffect(() => {
    window.electronAPI?.windowState?.isFullscreen?.().then((fs) => {
      setIsFullscreen(fs);
    });

    const unsubFs = window.electronAPI?.windowState?.onFullscreenChange?.((fs) => {
      setIsFullscreen(fs);
    });

    return () => {
      unsubFs?.();
    };
  }, []);

  // Native Menu Listeners
  useEffect(() => {
    if (window.electronAPI?.menu?.onAction) {
      const unsubscribe = window.electronAPI.menu.onAction((action: string) => {
        if (action === 'focus-ai-prompt') {
          setShowAiPanel(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-claude') {
          setShowAiPanel(true);
          setSelectedModel('Claude Sonnet 5');
          setAskPrompt('Execute uma análise completa do projeto ainaobra.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-agy') {
          setShowAiPanel(true);
          setSelectedModel('Google Antigravity (AGY CLI)');
          setAskPrompt('/plan Iniciar verificação autônoma de tarefas.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'toggle-terminal') {
          setIsTerminalCollapsed((prev) => !prev);
        } else if (action === 'toggle-explorer') {
          setShowExplorer((prev) => !prev);
        } else if (action === 'toggle-ai') {
          setShowAiPanel((prev) => !prev);
        } else if (action === 'scan-ports') {
          setActiveTermTab('ports');
          setIsTerminalCollapsed(false);
        } else if (action === 'new-terminal') {
          handleNewTerminalSession();
        } else if (action === 'split-terminal') {
          setIsSplitTerminal((prev) => !prev);
        } else if (action === 'clear-terminal') {
          handleClearTerminal();
        }
      });
      return unsubscribe;
    }
  }, [terminalSessions]);

  // ============================================================
  // DRAG RESIZE HANDLERS (VS CODE BEHAVIOR)
  // ============================================================

  // 1. Resize Explorer Width
  const startResizeExplorer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingExplorer(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = explorerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.min(Math.max(startW + delta, 160), 550);
      setExplorerWidth(newW);
      localStorage.setItem('ide_explorer_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingExplorer(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [explorerWidth]);

  // 2. Resize AI Assistant Panel Width
  const startResizeAiPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAi(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = aiPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 220), 650);
      setAiPanelWidth(newW);
      localStorage.setItem('ide_ai_panel_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingAi(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [aiPanelWidth]);

  // 3. Resize Terminal Panel Height
  const startResizeTerminal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTerminal(true);
    document.body.classList.add('resizing-row');

    const startY = e.clientY;
    const startH = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newH = Math.min(Math.max(startH + delta, 90), 600);
      setTerminalHeight(newH);
      localStorage.setItem('ide_terminal_height', String(newH));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingTerminal(false);
      document.body.classList.remove('resizing-row');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight]);

  // 4. Resize Terminal Tabs Width (Right Pane)
  const startResizeTermTabs = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTermTabs(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = terminalTabsWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 110), 450);
      setTerminalTabsWidth(newW);
      localStorage.setItem('ide_term_tabs_width', String(newW));
    };

    const onMouseUp = () => {
      setIsDraggingTermTabs(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalTabsWidth]);

  // 5. Resize Split Panes (Left & Right inside Terminal)
  const startResizeSplitPanes = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitPanes(true);
    document.body.classList.add('resizing-col');

    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.min(Math.max(Math.round((offsetX / rect.width) * 100), 20), 80);
      setTerminalSplitRatio(pct);
      localStorage.setItem('ide_term_split_ratio', String(pct));
    };

    const onMouseUp = () => {
      setIsDraggingSplitPanes(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monaco.editor.defineTheme('figma-ainaobra', {
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
        'editor.background': '#101010',
        'editor.foreground': '#d8dade',
        'editorCursor.foreground': '#FF6A00',
        'editor.lineHighlightBackground': '#181818',
        'editorLineNumber.foreground': '#4e5362',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#101010',
      },
    });
    monaco.editor.setTheme('figma-ainaobra');
  };

  const handleNewTerminalSession = (type: 'zsh' | 'bash' | 'claude' | 'agy' = 'zsh') => {
    const newId = String(Date.now());
    const pid = Math.floor(60000 + Math.random() * 5000);
    const cmd =
      type === 'bash'
        ? '/bin/bash -il'
        : type === 'claude'
        ? '/Users/walancy/.local/bin/claude'
        : type === 'agy'
        ? 'agy-agent'
        : '/bin/zsh -il';
    const newSession: TerminalSessionItem = {
      id: newId,
      name: type,
      type,
      pid,
      command: cmd,
      shellIntegration: 'Rich',
    };
    setTerminalSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newId);
    setIsTerminalCollapsed(false);
    setActiveTermTab('terminal');
  };

  const handleKillTerminalSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTerminalSessions((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
    if (hoveredSessionId === sessionId) {
      setHoveredSessionId(null);
    }
  };

  const handleSplitSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSplitTerminal(true);
    const newId = String(Date.now());
    const pid = Math.floor(60000 + Math.random() * 5000);
    setTerminalSessions((prev) => {
      const parent = prev.find((s) => s.id === sessionId);
      const newSession: TerminalSessionItem = {
        id: newId,
        name: parent ? parent.name : 'zsh',
        type: parent ? parent.type : 'zsh',
        pid,
        command: parent ? parent.command : '/bin/zsh -il',
        shellIntegration: 'Rich',
        isSplit: true,
        splitWithId: sessionId,
      };
      return [...prev, newSession];
    });
    setActiveSessionId(newId);
  };


  // Load Workspace File Tree
  const loadWorkspaceTree = useCallback(async (dirPath: string) => {
    if (window.electronAPI?.fs?.getTree) {
      try {
        const res = await window.electronAPI.fs.getTree(dirPath, 3);
        const tree = Array.isArray(res) ? res : (res as any).tree || [];
        setFileTree(tree);
      } catch (err) {
        console.warn('Error loading tree from electron:', err);
      }
    } else {
      setFileTree([
        {
          name: 'apps',
          path: `${dirPath}/apps`,
          isDirectory: true,
          children: [
            {
              name: 'ainaobra-api',
              path: `${dirPath}/apps/ainaobra-api`,
              isDirectory: true,
              children: [
                { name: 'app.service.ts', path: `${dirPath}/apps/ainaobra-api/src/app.service.ts`, isDirectory: false, extension: '.ts' },
                { name: 'app.service.spec.ts', path: `${dirPath}/apps/ainaobra-api/src/app.service.spec.ts`, isDirectory: false, extension: '.ts' },
                { name: 'main.ts', path: `${dirPath}/apps/ainaobra-api/src/main.ts`, isDirectory: false, extension: '.ts' },
              ],
            },
          ],
        },
        {
          name: 'data',
          path: `${dirPath}/data`,
          isDirectory: true,
          children: [
            { name: 'schema.sql', path: `${dirPath}/data/schema.sql`, isDirectory: false, extension: '.sql' },
          ],
        },
        { name: 'Dockerfile', path: `${dirPath}/Dockerfile`, isDirectory: false, extension: '' },
        { name: 'package.json', path: `${dirPath}/package.json`, isDirectory: false, extension: '.json' },
        { name: 'tsconfig.json', path: `${dirPath}/tsconfig.json`, isDirectory: false, extension: '.json' },
        { name: 'README.md', path: `${dirPath}/README.md`, isDirectory: false, extension: '.md' },
      ]);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceTree(workspacePath);
  }, [workspacePath, loadWorkspaceTree]);

  // Open File in Monaco Editor
  const handleOpenFile = async (filePath: string, fileName?: string, existingContent?: string) => {
    const existing = openFiles.find((f) => f.path === filePath || f.id === filePath);
    if (existing) {
      setActiveFileId(existing.id);
      return;
    }

    let content = existingContent;
    if (content === undefined && window.electronAPI?.fs?.readFile) {
      try {
        const res = await window.electronAPI.fs.readFile(filePath);
        content = res.content;
      } catch {
        content = `// Não foi possível carregar o arquivo: ${filePath}`;
      }
    }

    const name = fileName || filePath.split('/').pop() || 'untitled';
    const newFile: OpenFileItem = {
      id: filePath,
      name,
      path: filePath,
      content: content || '',
      language: getFileLanguage(name),
      isDirty: false,
    };

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleCloseFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openFiles.length <= 1) return;
    const nextFiles = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(nextFiles);
    if (activeFileId === fileId) {
      setActiveFileId(nextFiles[nextFiles.length - 1].id);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: value, isDirty: true } : f))
    );
  };

  const handleSaveActiveFile = useCallback(async () => {
    const currentFile = openFiles.find((f) => f.id === activeFileId);
    if (!currentFile) return;

    if (window.electronAPI?.fs?.writeFile) {
      try {
        await window.electronAPI.fs.writeFile(currentFile.path, currentFile.content);
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
        );
        setToastMessage(`Salvo com sucesso: ${currentFile.name}`);
        setTimeout(() => setToastMessage(null), 2500);
      } catch (err: any) {
        setToastMessage(`Erro ao salvar: ${err.message}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
      );
      setToastMessage(`Alterações salvas localmente: ${currentFile.name}`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [openFiles, activeFileId]);

  // Global Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveActiveFile]);

  // Click outside listener for Explorer 3-dots popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (explorerMenuRef.current && !explorerMenuRef.current.contains(e.target as Node)) {
        setExplorerMenuOpen(false);
      }
    };
    if (explorerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [explorerMenuOpen]);

  // Dialog Handlers (3 Dots Menu)
  const handleOpenFolderDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFolder) {
      const res = await window.electronAPI.dialog.openFolder();
      if (res && res.folderPath) {
        setWorkspacePath(res.folderPath);
        setTerminalCwd(res.folderPath);
        localStorage.setItem('ide_workspace_path', res.folderPath);
        localStorage.setItem('ide_terminal_cwd', res.folderPath);
        await loadWorkspaceTree(res.folderPath);
        setToastMessage(`Pasta aberta: ${res.name}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      const folder = prompt('Digite o caminho absoluto da pasta:', workspacePath);
      if (folder && folder.trim()) {
        setWorkspacePath(folder.trim());
        setTerminalCwd(folder.trim());
        await loadWorkspaceTree(folder.trim());
      }
    }
  };

  const handleOpenFileDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFile) {
      const res = await window.electronAPI.dialog.openFile();
      if (res && res.filePath) {
        handleOpenFile(res.filePath, res.name, res.content);
        setToastMessage(`Arquivo aberto: ${res.name}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      const file = prompt('Digite o caminho absoluto do arquivo para abrir:');
      if (file && file.trim()) {
        handleOpenFile(file.trim());
      }
    }
  };

  const handleCreateNewFile = async () => {
    setExplorerMenuOpen(false);
    const fileName = prompt('Nome do novo arquivo (ex: app.module.ts, style.css):');
    if (!fileName || !fileName.trim()) return;

    const fullPath = `${workspacePath}/${fileName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, false);
        await loadWorkspaceTree(workspacePath);
        handleOpenFile(fullPath, fileName.trim(), '');
        setToastMessage(`Arquivo criado: ${fileName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar arquivo: ${err.message}`);
      }
    } else {
      handleOpenFile(fullPath, fileName.trim(), '');
    }
  };

  const handleCreateNewFolder = async () => {
    setExplorerMenuOpen(false);
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;

    const fullPath = `${workspacePath}/${folderName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, true);
        await loadWorkspaceTree(workspacePath);
        setToastMessage(`Pasta criada: ${folderName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar pasta: ${err.message}`);
      }
    }
  };

  const handleClearTerminal = () => {
    const promptPrefix = `walancy@MacBook-Pro ${terminalCwd.split('/').pop() || 'codes'} % `;
    setTerminalHistory([promptPrefix]);
  };

  // Real Terminal Command Submission
  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalCommand.trim()) return;

    const cmd = terminalCommand.trim();
    setTerminalCommandHistory((prev) => [...prev, cmd]);
    setHistoryPointer(-1);
    setTerminalCommand('');

    const folderShort = terminalCwd.split('/').pop() || 'codes';
    const promptPrefix = `walancy@MacBook-Pro ${folderShort} % `;
    const cmdLine = `${promptPrefix}${cmd}`;

    if (cmd === 'clear') {
      setTerminalHistory([promptPrefix]);
      return;
    }

    if (cmd.startsWith('cd ') || cmd === 'cd') {
      const targetDir = cmd.substring(3).trim();
      let newPath = targetDir;
      if (!targetDir || targetDir === '~') {
        newPath = '/Users/walancy';
      } else if (targetDir === '..') {
        const parts = terminalCwd.split('/').filter(Boolean);
        parts.pop();
        newPath = '/' + parts.join('/');
      } else if (!targetDir.startsWith('/')) {
        newPath = `${terminalCwd}/${targetDir}`;
      }

      if (window.electronAPI?.fs?.getTree) {
        try {
          await window.electronAPI.fs.getTree(newPath, 1);
          setTerminalCwd(newPath);
          localStorage.setItem('ide_terminal_cwd', newPath);
          setTerminalHistory((prev) => [
            ...prev,
            cmdLine,
            `walancy@MacBook-Pro ${newPath.split('/').pop() || 'codes'} % `,
          ]);
        } catch {
          setTerminalHistory((prev) => [
            ...prev,
            cmdLine,
            `cd: no such file or directory: ${targetDir}`,
            promptPrefix,
          ]);
        }
      } else {
        setTerminalCwd(newPath);
        setTerminalHistory((prev) => [...prev, cmdLine]);
      }
      return;
    }

    // Execute real command in macOS via Electron
    if (window.electronAPI?.shell?.exec) {
      setTerminalHistory((prev) => [...prev, cmdLine]);
      try {
        const res = await window.electronAPI.shell.exec(cmd, terminalCwd);
        const output = (res.stdout || '') + (res.stderr ? (res.stdout ? '\n' : '') + res.stderr : '');
        if (output.trim()) {
          setTerminalHistory((prev) => [
            ...prev,
            output.trimEnd(),
            promptPrefix,
          ]);
        } else if (res.exitCode !== 0 && res.error) {
          setTerminalHistory((prev) => [
            ...prev,
            res.error,
            promptPrefix,
          ]);
        } else {
          setTerminalHistory((prev) => [...prev, promptPrefix]);
        }
      } catch (err: any) {
        setTerminalHistory((prev) => [...prev, `Erro: ${err.message}`, promptPrefix]);
      }
    } else {
      let response = '';
      if (cmd === 'ls' || cmd === 'ls -la') {
        response = 'apps  packages  docker-compose.yml  package.json  README.md  tsconfig.json';
      } else if (cmd === 'git status') {
        response = "On branch main\nYour branch is up to date with 'origin/main'.\nChanges not staged for commit:\n  modified:   apps/ainaobra-api/src/app.service.ts";
      } else if (cmd === 'pwd') {
        response = terminalCwd;
      } else if (cmd === 'claude' || cmd.startsWith('claude ')) {
        response = '[Claude Code CLI v2.1.273]\nConectado ao modelo Claude 3.7 Sonnet (Thinking).\nDigite sua pergunta ou instrução de código.';
      } else if (cmd === 'agy' || cmd.startsWith('agy ')) {
        response = '[Google Antigravity CLI v2.4]\nModo Agente ativado. Orquestrando tarefas e verificação em background.';
      } else {
        response = `[Terminal Output]: ${cmd}`;
      }
      setTerminalHistory((prev) => [
        ...prev,
        cmdLine,
        response,
        promptPrefix,
      ]);
    }
  };

  // Keyboard navigation for terminal history (Up / Down arrows)
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalCommandHistory.length === 0) return;
      const nextPtr = historyPointer === -1 ? terminalCommandHistory.length - 1 : Math.max(0, historyPointer - 1);
      setHistoryPointer(nextPtr);
      setTerminalCommand(terminalCommandHistory[nextPtr]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === -1) return;
      const nextPtr = historyPointer + 1;
      if (nextPtr >= terminalCommandHistory.length) {
        setHistoryPointer(-1);
        setTerminalCommand('');
      } else {
        setHistoryPointer(nextPtr);
        setTerminalCommand(terminalCommandHistory[nextPtr]);
      }
    }
  };

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Auto-scroll AI terminal to bottom
  useEffect(() => {
    if (aiTerminalScrollRef.current) {
      aiTerminalScrollRef.current.scrollTop = aiTerminalScrollRef.current.scrollHeight;
    }
  }, [aiHistory]);

  // Open download or guide link in default system browser
  const handleOpenExternalLink = async (url: string) => {
    if (window.electronAPI?.shell?.openExternal) {
      await window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  // Execute AI CLI command (e.g., claude, agy, gemini) or check if installed
  const handleAiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = askPrompt.trim();
    if (!prompt || isAiExecuting) return;

    // Find the config for the selected AI provider
    const currentProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
    const cliCmd = currentProvider.cliCommand;

    // Add user message to AI history
    setAiHistory((prev) => [
      ...prev,
      { type: 'user', text: prompt, command: `${cliCmd}` },
    ]);
    setAskPrompt('');
    setIsAiExecuting(true);
    setAiNotInstalledAlert(null);

    // 1. Check if the CLI is installed using `which <cli>`
    if (window.electronAPI?.shell?.exec) {
      try {
        const checkRes = await window.electronAPI.shell.exec(`which ${cliCmd}`, terminalCwd);
        const isInstalled = checkRes.exitCode === 0 && checkRes.stdout.trim().length > 0;

        if (!isInstalled) {
          // Alert user: IA não instalada neste dispositivo
          const alertData = {
            modelName: currentProvider.name,
            command: cliCmd,
            url: currentProvider.installUrl,
            guide: currentProvider.installGuide,
          };
          setAiNotInstalledAlert(alertData);
          setAiHistory((prev) => [
            ...prev,
            {
              type: 'error',
              text: `⚠️ IA não instalada neste dispositivo!\nO CLI "${cliCmd}" não foi encontrado no seu PATH.\nInstale clicando no link abaixo para começar a usar.`,
              downloadUrl: currentProvider.installUrl,
              command: currentProvider.installGuide,
            },
          ]);
          setIsAiExecuting(false);
          return;
        }

        // 2. CLI is installed! Execute command directly through the CLI
        // The user can interact and change models using the CLI's native commands (e.g. /model, /cost, /plan)
        let fullCommand = `${cliCmd} "${prompt.replace(/"/g, '\\"')}"`;
        if (cliCmd === 'claude') {
          fullCommand = `claude -p "${prompt.replace(/"/g, '\\"')}"`;
        }

        setAiHistory((prev) => [
          ...prev,
          {
            type: 'system',
            text: `[Executando ${cliCmd} em ${terminalCwd.split('/').filter(Boolean).pop()}...]`,
          },
        ]);

        const execRes = await window.electronAPI.shell.exec(fullCommand, terminalCwd);

        if (execRes.exitCode === 0 && execRes.stdout) {
          setAiHistory((prev) => [
            ...prev,
            { type: 'assistant', text: execRes.stdout.trim() },
          ]);
        } else if (execRes.stderr || execRes.error) {
          setAiHistory((prev) => [
            ...prev,
            {
              type: 'assistant',
              text: (execRes.stdout ? execRes.stdout + '\n' : '') + (execRes.stderr || execRes.error || ''),
            },
          ]);
        } else {
          setAiHistory((prev) => [
            ...prev,
            { type: 'assistant', text: `Comando concluído com status ${execRes.exitCode}` },
          ]);
        }
      } catch (err: any) {
        setAiHistory((prev) => [
          ...prev,
          { type: 'error', text: `Erro na execução do terminal de IA: ${err.message}` },
        ]);
      } finally {
        setIsAiExecuting(false);
      }
    } else {
      // Browser fallback simulation if running outside Electron
      setTimeout(() => {
        if (cliCmd === 'claude') {
          setAiHistory((prev) => [
            ...prev,
            {
              type: 'assistant',
              text: `[Claude Code CLI]: Análise concluída para: "${prompt}". Todas as verificações do workspace ainaobra passaram.`,
            },
          ]);
        } else {
          setAiNotInstalledAlert({
            modelName: currentModel.name,
            command: cliCmd,
            url: currentModel.installUrl,
            guide: currentModel.installGuide,
          });
          setAiHistory((prev) => [
            ...prev,
            {
              type: 'error',
              text: `⚠️ IA não instalada neste dispositivo!\nO CLI "${cliCmd}" não foi encontrado.`,
              downloadUrl: currentModel.installUrl,
              command: currentModel.installGuide,
            },
          ]);
        }
        setIsAiExecuting(false);
      }, 600);
    }
  };


  const handleDebugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugCommand.trim()) return;

    let res = '';
    try {
      res = String(new Function('return (' + debugCommand + ')')());
    } catch (err: any) {
      res = `Evaluation Error: ${err.message}`;
    }

    setDebugHistory((prev) => [...prev, `> ${debugCommand}`, res]);
    setDebugCommand('');
  };

  const showTrafficLightSpacer = !isFullscreen || isHoveringTrafficLightArea;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        padding: 5,
        background: 'black',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 5,
        display: 'flex',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Invisible hover trigger area for macOS fullscreen traffic lights */}
      {isFullscreen && (
        <div
          onMouseEnter={() => setIsHoveringTrafficLightArea(true)}
          onMouseLeave={() => setIsHoveringTrafficLightArea(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 100,
            height: 48,
            zIndex: 99,
          }}
        />
      )}

      {/* ============================================================ */}
      {/* 1. TOP BAR WITH ANIMATED TABS & INLINE CONTROLS              */}
      {/* ============================================================ */}
      <div
        style={{
          width: '100%',
          background: 'black',
          borderRadius: 10,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex',
          flexShrink: 0,
          WebkitAppRegion: 'drag' as any,
          position: 'relative',
        }}
      >
        {/* Left: Animated Traffic lights spacer + Nav Tabs */}
        <div
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex',
            WebkitAppRegion: 'no-drag' as any,
            flexShrink: 0,
          }}
        >
          {/* Animated spacer */}
          <div
            style={{
              width: showTrafficLightSpacer ? 68 : 0,
              height: 36,
              flexShrink: 0,
              transition: isDraggingExplorer || isDraggingAi || isDraggingTerminal ? 'none' : 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
            }}
          />

          <div
            style={{
              padding: 5,
              background: '#101010',
              borderRadius: 10,
              border: 'none',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {[
              { id: 'projetos', label: 'Projetos' },
              { id: 'daily', label: 'Daily' },
              { id: 'equipmentos', label: 'Equipmentos' },
              { id: 'ide', label: 'IDE' },
              { id: 'ports', label: 'Ports' },
            ].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  style={{
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 5,
                    paddingBottom: 5,
                    background: isActive ? '#2E2E2E' : 'transparent',
                    borderRadius: 5,
                    border: 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      color: 'white',
                      fontSize: 12,
                      fontFamily: 'Poppins',
                      fontWeight: '400',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Layout Icons, Dividers, Profile */}
        <div style={{ justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', WebkitAppRegion: 'no-drag' as any, flexShrink: 0 }}>
          {/* 4 Layout Icons */}
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex' }}>
            <div
              onClick={() => setShowExplorer(!showExplorer)}
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showExplorer ? '#FF6A00' : '#525252', cursor: 'pointer' }}
              title="Alternar Explorer"
            >
              <Sidebar size={18} />
            </div>
            <div
              onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: !isTerminalCollapsed ? '#FF6A00' : '#525252', cursor: 'pointer' }}
              title="Alternar Terminal"
            >
              <PanelBottom size={18} />
            </div>
            <div
              onClick={() => setShowAiPanel(!showAiPanel)}
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAiPanel ? '#FF6A00' : '#525252', cursor: 'pointer' }}
              title="Alternar Painel IA"
            >
              <PanelRight size={18} />
            </div>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252', cursor: 'pointer' }}>
              <LayoutGrid size={18} />
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 24, background: '#373737' }} />

          {/* Search and Settings */}
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex' }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252', cursor: 'pointer' }}>
              <Search size={18} />
            </div>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#525252', cursor: 'pointer' }}>
              <Settings size={18} />
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 24, background: '#373737' }} />

          {/* Profile: Walancy / Walancy + Avatar */}
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex', whiteSpace: 'nowrap' }}>
            <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'inline-flex' }}>
              <div style={{ color: 'white', fontSize: 13, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '14px', whiteSpace: 'nowrap' }}>
                Walancy
              </div>
              <div style={{ textAlign: 'right', color: '#727272', fontSize: 11, fontFamily: 'Poppins', fontWeight: '500', lineHeight: '15px', whiteSpace: 'nowrap' }}>
                Walancy
              </div>
            </div>
            {/* User Profile Avatar with NO border */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9999,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#1e1e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={avatarImg}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedGithub) {
                    target.dataset.triedGithub = 'true';
                    target.src = 'https://github.com/walancy.png';
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 9999,
                  border: 'none',
                  objectFit: 'cover',
                  display: 'block',
                }}
                alt="Walancy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA (RESIZABLE COLUMNS & TERMINAL)         */}
      {/* ============================================================ */}
      {activeTab === 'ide' ? (
        <div
          style={{
            alignSelf: 'stretch',
            flex: '1 1 0',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'inline-flex',
            minHeight: 0,
            width: '100%',
          }}
        >
          {/* ---------------------------------------------------- */}
          {/* Activity Bar (Vertical Left Strip)                   */}
          {/* ---------------------------------------------------- */}
          <div
            style={{
              alignSelf: 'stretch',
              padding: 15,
              background: '#101010',
              borderRadius: 10,
              border: 'none',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 15,
              display: 'inline-flex',
              flexShrink: 0,
            }}
          >
            <div style={{ width: 24, height: 24, color: '#ffffff', cursor: 'pointer' }} title="Explorer" onClick={() => setShowExplorer(!showExplorer)}>
              <Files size={20} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', cursor: 'pointer' }} title="Search">
              <Search size={19} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', cursor: 'pointer' }} title="Source Control">
              <GitBranch size={20} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', cursor: 'pointer' }} title="Run and Debug">
              <Play size={19} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', cursor: 'pointer' }} title="Remote / Containers">
              <Monitor size={19} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', cursor: 'pointer' }} title="Extensions">
              <Blocks size={20} />
            </div>
            <div style={{ width: 24, height: 24, color: '#565656', marginTop: 'auto', cursor: 'pointer' }} title="Settings">
              <Settings size={19} />
            </div>
          </div>

          {/* 5px Spacing */}
          <div style={{ width: 5, flexShrink: 0 }} />

          {/* ---------------------------------------------------- */}
          {/* Explorer Column (DRAGGABLE RESIZABLE WIDTH)          */}
          {/* ---------------------------------------------------- */}
          {showExplorer && (
            <>
              <div
                style={{
                  alignSelf: 'stretch',
                  width: explorerWidth,
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: 5,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingExplorer ? 'none' : 'width 0.1s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Top Explorer Card */}
                <div
                  style={{
                    width: '100%',
                    flex: '1 1 0',
                    padding: 10,
                    background: '#101010',
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 10,
                    display: 'flex',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                >
                  {/* Explorer Title + More */}
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'white', fontSize: 12, fontFamily: 'Poppins', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Explorer</span>
                      <span style={{ color: '#656565', fontSize: 11, fontWeight: 400 }}>
                        ({workspacePath.split('/').pop() || 'Workspace'})
                      </span>
                    </div>
                    <div
                      onClick={() => setExplorerMenuOpen(!explorerMenuOpen)}
                      title="Opções do Explorador (Abrir pasta/arquivo...)"
                      style={{ color: explorerMenuOpen ? '#FF6A00' : '#858585', cursor: 'pointer', padding: 2, borderRadius: 3 }}
                    >
                      <MoreHorizontal size={16} />
                    </div>
                  </div>

                  {/* 3 Dots Popup Menu */}
                  {explorerMenuOpen && (
                    <div
                      ref={explorerMenuRef}
                      style={{
                        position: 'absolute',
                        top: 36,
                        right: 10,
                        width: 195,
                        background: '#1c1c1c',
                        border: '1px solid #333333',
                        borderRadius: 8,
                        padding: '5px 0',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        onClick={handleOpenFolderDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#ffffff' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderOpen size={14} color="#FF6A00" />
                        <span>Abrir Pasta...</span>
                      </div>
                      <div
                        onClick={handleOpenFileDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#ffffff' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FileText size={14} color="#3794ff" />
                        <span>Abrir Arquivo...</span>
                      </div>
                      <div style={{ height: 1, background: '#2d2d2d', margin: '4px 0' }} />
                      <div
                        onClick={handleCreateNewFile}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#cccccc' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FilePlus size={14} color="#cccccc" />
                        <span>Novo Arquivo</span>
                      </div>
                      <div
                        onClick={handleCreateNewFolder}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#cccccc' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderPlus size={14} color="#cccccc" />
                        <span>Nova Pasta</span>
                      </div>
                      <div style={{ height: 1, background: '#2d2d2d', margin: '4px 0' }} />
                      <div
                        onClick={() => {
                          setExplorerMenuOpen(false);
                          loadWorkspaceTree(workspacePath);
                        }}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#cccccc' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <RefreshCw size={14} color="#cccccc" />
                        <span>Atualizar Explorador</span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Recursive File Tree */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', gap: 1 }}>
                    {fileTree.map((node) => {
                      const renderTreeItem = (item: ExplorerNode, depth = 0): React.ReactNode => {
                        const isExpanded = expandedFolders.has(item.path);
                        const isDir = item.isDirectory;
                        const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase();
                        const isFileActive = activeFileId === item.path;

                        return (
                          <div key={item.path} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div
                              onClick={() => {
                                if (isDir) {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.path)) next.delete(item.path);
                                    else next.add(item.path);
                                    return next;
                                  });
                                } else {
                                  handleOpenFile(item.path, item.name);
                                }
                              }}
                              style={{
                                width: '100%',
                                paddingLeft: depth * 12 + 2,
                                paddingRight: 6,
                                height: 24,
                                borderRadius: 4,
                                background: isFileActive ? 'rgba(255, 106, 0, 0.12)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isFileActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isFileActive) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {isDir ? (
                                <>
                                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#707070', flexShrink: 0 }}>
                                    {isExpanded ? <ChevronDown size={13} color="#FF6A00" /> : <ChevronRight size={13} />}
                                  </div>
                                  {isExpanded ? <FolderOpen size={14} color="#FF6A00" /> : <Folder size={14} color="#707070" />}
                                  <span style={{ color: isExpanded ? '#ffffff' : '#d0d0d0', fontSize: 12, fontFamily: 'Poppins', fontWeight: 400 }}>
                                    {item.name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 2 }}>
                                    {ext === 'ts' || ext === 'tsx' ? (
                                      <span style={{ color: '#3159DD', fontSize: 10, fontWeight: 700 }}>TS</span>
                                    ) : ext === 'js' || ext === 'jsx' ? (
                                      <span style={{ color: '#f7df1e', fontSize: 10, fontWeight: 700 }}>JS</span>
                                    ) : ext === 'json' ? (
                                      <span style={{ color: '#cbcb41', fontSize: 10, fontWeight: 700 }}>{}</span>
                                    ) : (
                                      <FileText size={13} color="#858585" />
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      color: isFileActive ? '#ffffff' : '#b0b0b0',
                                      fontSize: 12,
                                      fontFamily: 'Poppins',
                                      fontWeight: isFileActive ? 500 : 400,
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                </>
                              )}
                            </div>

                            {isDir && isExpanded && item.children && item.children.length > 0 && (
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                                {item.children.map((child) => renderTreeItem(child, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return renderTreeItem(node, 0);
                    })}
                  </div>
                </div>

                {/* Outline Card */}
                <div
                  style={{
                    width: '100%',
                    padding: 10,
                    background: '#101010',
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 10,
                    display: 'flex',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'white', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>Outline</div>
                    <ChevronRight size={14} color="#505050" />
                  </div>
                </div>

                {/* Timeline Card */}
                <div
                  style={{
                    width: '100%',
                    padding: 10,
                    background: '#101010',
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 10,
                    display: 'flex',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', whiteSpace: 'nowrap' }}>
                    <div style={{ color: 'white', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>Timeline</div>
                    <ChevronRight size={14} color="#505050" />
                  </div>
                </div>
              </div>

              {/* VS Code Style Vertical Resizer for Explorer */}
              <div
                className={`resizer-col ${isDraggingExplorer ? 'dragging' : ''}`}
                onMouseDown={startResizeExplorer}
                onDoubleClick={() => setExplorerWidth(280)}
                title="Arraste para redimensionar o Explorer (Duplo clique para restaurar)"
              />
            </>
          )}

          {/* ---------------------------------------------------- */}
          {/* Center Area (Editor Tabs, Code Canvas, Terminal)     */}
          {/* ---------------------------------------------------- */}
          <div
            style={{
              flex: '1 1 0',
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'inline-flex',
              minWidth: 0,
            }}
          >
            {/* Editor Tabs Row */}
            <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', flexShrink: 0 }}>
              {/* Left: Tabs pill container */}
              <div
                style={{
                  height: 38,
                  padding: '4px 5px',
                  background: '#101010',
                  borderRadius: 10,
                  border: 'none',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  overflowX: 'auto',
                  maxWidth: 'calc(100% - 150px)',
                }}
              >
                {openFiles.length === 0 ? (
                  <div style={{ padding: '0 10px', color: '#555', fontSize: 12 }}>Nenhum arquivo aberto</div>
                ) : (
                  openFiles.map((file, idx) => {
                    const isActive = activeFileId === file.id;
                    const ext = file.name.split('.').pop()?.toLowerCase();
                    let iconColor = '#747474';
                    let iconLabel = '📄';
                    if (ext === 'ts' || ext === 'tsx') {
                      iconColor = '#3159DD';
                      iconLabel = 'TS';
                    } else if (ext === 'js' || ext === 'jsx') {
                      iconColor = '#E8B923';
                      iconLabel = 'JS';
                    } else if (ext === 'json') {
                      iconColor = '#CBCB41';
                      iconLabel = '{}';
                    } else if (file.name.toLowerCase().includes('docker')) {
                      iconColor = '#2496ED';
                      iconLabel = '🐳';
                    } else if (ext === 'c' || ext === 'cpp') {
                      iconColor = '#3190DD';
                      iconLabel = 'C';
                    }

                    return (
                      <React.Fragment key={file.id}>
                        {idx > 0 && <div style={{ width: 1, height: 16, background: '#373737' }} />}
                        <div
                          onClick={() => setActiveFileId(file.id)}
                          style={{
                            height: 28,
                            paddingLeft: 10,
                            paddingRight: 8,
                            borderRadius: 5,
                            border: 'none',
                            background: isActive ? '#1c1c1c' : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 6,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: '700', color: iconColor }}>{iconLabel}</span>
                          <div
                            style={{
                              color: isActive ? 'white' : '#747474',
                              fontSize: 12,
                              fontFamily: 'Poppins',
                              fontWeight: isActive ? '500' : '400',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.name}
                          </div>
                          {file.isDirty ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveActiveFile();
                              }}
                              title="Arquivo modificado (Clique ou Cmd+S para salvar)"
                              style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6A00', display: 'inline-block', margin: '0 2px' }}
                            />
                          ) : null}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseFile(file.id);
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                          >
                            <X size={12} color="#747474" />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Right: Editor action icons pill */}
              <div
                style={{
                  height: 38,
                  padding: '4px 8px',
                  background: '#101010',
                  borderRadius: 10,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {activeFile?.isDirty && (
                  <div
                    onClick={handleSaveActiveFile}
                    title="Salvar Arquivo (Cmd+S)"
                    style={{
                      height: 26,
                      paddingLeft: 8,
                      paddingRight: 8,
                      background: '#FF6A00',
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    <Save size={13} color="white" />
                    <span>Salvar</span>
                  </div>
                )}
                <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Dividir Editor">
                  <Columns size={15} color="white" />
                </div>
                <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Alternar Layout">
                  <SplitSquareVertical size={15} color="white" />
                </div>
                <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <MoreHorizontal size={15} color="#505050" />
                </div>
              </div>
            </div>

            {/* 5px Spacing */}
            <div style={{ height: 5, flexShrink: 0 }} />

            {/* Monaco Code Editor Card */}
            <div
              style={{
                alignSelf: 'stretch',
                flex: '1 1 0',
                minHeight: 0,
                padding: 10,
                background: '#101010',
                borderRadius: 10,
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {activeFile ? (
                <Editor
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  theme="figma-ainaobra"
                  onChange={handleEditorChange}
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
                    padding: { top: 6, bottom: 6 },
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#555',
                    gap: 12,
                  }}
                >
                  <FileText size={48} color="#222" />
                  <div style={{ fontSize: 14, color: '#666' }}>Selecione um arquivo no Explorer para editar</div>
                  <button
                    onClick={handleOpenFolderDialog}
                    style={{
                      padding: '8px 16px',
                      background: '#1c1c1c',
                      border: 'none',
                      borderRadius: 6,
                      color: '#ddd',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Abrir Pasta do Projeto
                  </button>
                </div>
              )}
            </div>

            {/* VS Code Style Horizontal Resizer for Terminal Panel */}
            {!isTerminalCollapsed && (
              <div
                className={`resizer-row ${isDraggingTerminal ? 'dragging' : ''}`}
                onMouseDown={startResizeTerminal}
                onDoubleClick={() => setTerminalHeight(220)}
                title="Arraste para redimensionar a altura do Terminal (Duplo clique para restaurar)"
              />
            )}
            {isTerminalCollapsed && <div style={{ height: 5, flexShrink: 0 }} />}

            {/* ======================================================= */}
            {/* TERMINAL TABS ROW: FULLY RESPONSIVE & NO TEXT WRAP      */}
            {/* ======================================================= */}
            <div
              style={{
                alignSelf: 'stretch',
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'inline-flex',
                flexShrink: 0,
                gap: 5,
              }}
            >
              {/* Left Card: Subtabs with whiteSpace: nowrap */}
              <div
                style={{
                  height: 38,
                  padding: '4px 5px',
                  background: '#101010',
                  borderRadius: 10,
                  border: 'none',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 4,
                  display: 'flex',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  overflowX: 'auto',
                }}
              >
                {[
                  { id: 'problems', label: 'Problems' },
                  { id: 'output', label: 'Output' },
                  { id: 'debug', label: 'Debug console' },
                  { id: 'terminal', label: 'Terminal' },
                  { id: 'ports', label: 'Ports' },
                ].map((st) => {
                  const isActive = activeTermTab === st.id;
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setActiveTermTab(st.id as any);
                        setIsTerminalCollapsed(false);
                      }}
                      style={{
                        height: 28,
                        paddingLeft: 12,
                        paddingRight: 12,
                        background: isActive ? '#2E2E2E' : 'transparent',
                        borderRadius: 5,
                        border: 'none',
                        justifyContent: 'center',
                        alignItems: 'center',
                        display: 'flex',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          color: isActive ? 'white' : '#8c8c8c',
                          fontSize: 12,
                          fontFamily: 'Poppins',
                          fontWeight: isActive ? '500' : '400',
                          lineHeight: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {st.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Card: Action Controls with identical 38px height */}
              <div
                style={{
                  height: 38,
                  padding: '4px 6px',
                  background: '#101010',
                  borderRadius: 10,
                  border: 'none',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 4,
                  display: 'flex',
                  boxSizing: 'border-box',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {/* Shell selector dropdown button */}
                <div
                  onClick={() => setShellDropdownOpen(!shellDropdownOpen)}
                  style={{
                    height: 28,
                    paddingLeft: 8,
                    paddingRight: 8,
                    borderRadius: 5,
                    background: shellDropdownOpen ? '#2E2E2E' : 'transparent',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 6,
                    display: 'flex',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                  title="Selecionar Shell"
                >
                  <TerminalIcon size={14} color="white" />
                  <div style={{ color: 'white', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '12px', whiteSpace: 'nowrap' }}>
                    {terminalShell}
                  </div>
                  <ChevronDown size={12} color="#727272" />
                </div>

                {/* Shell Dropdown Menu */}
                {shellDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 44,
                      right: 120,
                      background: '#161616',
                      borderRadius: 8,
                      border: 'none',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 100,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    }}
                  >
                    {[
                      { label: 'zsh (Padrão)', value: 'zsh' },
                      { label: 'bash', value: 'bash' },
                      { label: 'Claude Code CLI', value: 'claude' },
                      { label: 'Google Antigravity (AGY)', value: 'agy' },
                    ].map((sh) => (
                      <div
                        key={sh.value}
                        onClick={() => {
                          setTerminalShell(sh.value);
                          setShellDropdownOpen(false);
                          setTerminalHistory((prev) => [
                            ...prev,
                            `[Iniciando sessão com ${sh.label}...]`,
                          ]);
                        }}
                        style={{
                          padding: '6px 12px',
                          color: terminalShell === sh.value ? '#FF6A00' : 'white',
                          fontSize: 12,
                          fontFamily: 'Poppins',
                          cursor: 'pointer',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          background: terminalShell === sh.value ? 'rgba(255,106,0,0.1)' : 'transparent',
                        }}
                      >
                        {sh.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div style={{ width: 1, height: 16, background: '#373737', margin: '0 2px' }} />

                {/* New Terminal Session (+) */}
                <div
                  onClick={handleNewTerminalSession}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#505050')}
                  title="Novo Terminal"
                >
                  <Plus size={14} />
                </div>

                {/* Minimize Terminal (-) */}
                <div
                  onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#505050')}
                  title="Recolher Terminal"
                >
                  <Minus size={14} />
                </div>

                {/* Split Terminal ([|]) */}
                <div
                  onClick={() => setIsSplitTerminal(!isSplitTerminal)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSplitTerminal ? '#FF6A00' : '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isSplitTerminal ? '#FF6A00' : '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isSplitTerminal ? '#FF6A00' : '#505050')}
                  title="Dividir Terminal"
                >
                  <Columns size={14} />
                </div>

                {/* Clear Output (Trash) */}
                <div
                  onClick={handleClearTerminal}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#505050')}
                  title="Limpar Terminal"
                >
                  <Trash2 size={14} />
                </div>

                {/* Maximize Terminal */}
                <div
                  onClick={() => {
                    setIsTerminalMaximized(!isTerminalMaximized);
                    setIsTerminalCollapsed(false);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isTerminalMaximized ? '#FF6A00' : '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? '#FF6A00' : '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? '#FF6A00' : '#505050')}
                  title={isTerminalMaximized ? 'Restaurar Tamanho' : 'Maximizar Painel'}
                >
                  {isTerminalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </div>

                {/* More Options (...) */}
                <div
                  onClick={() => setMoreOptionsOpen(!moreOptionsOpen)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: moreOptionsOpen ? '#ffffff' : '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = moreOptionsOpen ? '#ffffff' : '#505050')}
                  title="Mais Opções"
                >
                  <MoreHorizontal size={14} />
                </div>

                {/* More Options Dropdown Menu */}
                {moreOptionsOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 44,
                      right: 35,
                      background: '#161616',
                      borderRadius: 8,
                      border: 'none',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 100,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    }}
                  >
                    {[
                      { label: 'Reiniciar Sessão PTY', action: () => handleClearTerminal() },
                      { label: 'Copiar Saída Completa', action: () => navigator.clipboard.writeText(terminalHistory.join('\n')) },
                      { label: 'Executar Verificação de Portas', action: () => setActiveTermTab('ports') },
                    ].map((opt, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          opt.action();
                          setMoreOptionsOpen(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          color: 'white',
                          fontSize: 12,
                          fontFamily: 'Poppins',
                          cursor: 'pointer',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div style={{ width: 1, height: 16, background: '#373737', margin: '0 2px' }} />

                {/* Close Panel (X) */}
                <div
                  onClick={() => setIsTerminalCollapsed(true)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#505050',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#505050')}
                  title="Fechar Painel"
                >
                  <X size={14} />
                </div>
              </div>
            </div>

            {/* 5px Spacing */}
            {!isTerminalCollapsed && <div style={{ height: 5, flexShrink: 0 }} />}

            {/* ======================================================= */}
            {/* TERMINAL CONTENT PANES (DRAGGABLE RESIZABLE HEIGHT)     */}
            {/* ======================================================= */}
            {!isTerminalCollapsed && (
              <div
                style={{
                  alignSelf: 'stretch',
                  height: isTerminalMaximized ? 480 : terminalHeight,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 0,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingTerminal ? 'none' : 'height 0.15s ease',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {/* 1. Terminal View */}
                {activeTermTab === 'terminal' && (
                  <>
                    {/* Dual / Single Terminals Card (Left Card) */}
                    <div
                      ref={splitContainerRef}
                      style={{
                        flex: '1 1 0',
                        alignSelf: 'stretch',
                        padding: 12,
                        background: '#101010',
                        borderRadius: 10,
                        border: 'none',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        gap: 0,
                        display: 'flex',
                        overflow: 'hidden',
                        minWidth: 0,
                        position: 'relative',
                      }}
                    >
                      {/* Left Split Pane (Interactive Shell) */}
                      <div
                        ref={terminalScrollRef}
                        onClick={() => termInputRef.current?.focus()}
                        style={{
                          width: isSplitTerminal ? `${terminalSplitRatio}%` : '100%',
                          flex: isSplitTerminal ? 'none' : '1 1 0',
                          alignSelf: 'stretch',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
                          gap: 6,
                          display: 'inline-flex',
                          fontFamily: 'JetBrains Mono, Menlo, monospace',
                          overflowX: 'auto',
                          overflowY: 'auto',
                          minWidth: 0,
                          cursor: 'text',
                          paddingRight: isSplitTerminal ? 4 : 0,
                        }}
                      >
                        <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'inline-flex', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          <TerminalIcon size={13} color="#FF6A00" />
                          <div style={{ color: 'white', fontSize: 10.5, fontWeight: '400', whiteSpace: 'nowrap' }}>
                            {terminalShell} (Sessão {activeSessionId}) • {terminalCwd}
                          </div>
                        </div>

                        {/* History output without ugly wrapping */}
                        {terminalHistory.map((line, idx) => (
                          <div key={idx} style={{ color: '#d8dade', fontSize: 12, lineHeight: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flexShrink: 0 }}>
                            {line}
                          </div>
                        ))}

                        {/* Prompt with Active Typing Input (STRICTLY NO-WRAP) */}
                        <form onSubmit={handleTerminalSubmit} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'nowrap', flexShrink: 0 }}>
                          <span style={{ width: 5, height: 5, borderRadius: 9999, border: '1px #656565 solid', flexShrink: 0 }} />
                          <span style={{ color: '#FF6A00', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            walancy@{terminalCwd.split('/').filter(Boolean).pop() || 'workspace'} %
                          </span>
                          <input
                            ref={termInputRef}
                            type="text"
                            value={terminalCommand}
                            onChange={(e) => setTerminalCommand(e.target.value)}
                            onKeyDown={handleTerminalKeyDown}
                            placeholder="digite um comando (ex: ls, git status, bun run dev)..."
                            style={{
                              flex: 1,
                              minWidth: 100,
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#ffffff',
                              fontSize: 12,
                              fontFamily: 'JetBrains Mono, Menlo, monospace',
                              whiteSpace: 'nowrap',
                            }}
                          />
                          <span style={{ width: 6, height: 14, background: '#FF6A00', display: 'inline-block', flexShrink: 0 }} />
                        </form>
                      </div>

                      {/* Right Split Pane (Visible when isSplitTerminal is TRUE) */}
                      {isSplitTerminal && (
                        <>
                          {/* Interactive Resizer between split panes */}
                          <div
                            className={`resizer-col ${isDraggingSplitPanes ? 'dragging' : ''}`}
                            onMouseDown={startResizeSplitPanes}
                            onDoubleClick={() => {
                              setTerminalSplitRatio(50);
                              localStorage.setItem('ide_term_split_ratio', '50');
                            }}
                            title="Arraste para redimensionar terminais divididos (Duplo clique para 50/50)"
                            style={{ margin: 0, zIndex: 10 }}
                          />

                          {/* Secondary Inactive / Auxiliary Split Pane */}
                          <div
                            style={{
                              flex: '1 1 0',
                              alignSelf: 'stretch',
                              flexDirection: 'column',
                              justifyContent: 'flex-start',
                              alignItems: 'flex-start',
                              gap: 6,
                              display: 'inline-flex',
                              fontFamily: 'JetBrains Mono, Menlo, monospace',
                              overflowX: 'auto',
                              overflowY: 'auto',
                              minWidth: 0,
                              paddingLeft: 4,
                            }}
                          >
                            <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'inline-flex', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              <TerminalIcon size={13} color="#585858" />
                              <div style={{ color: '#585858', fontSize: 10.5, fontWeight: '400', whiteSpace: 'nowrap' }}>zsh (auxiliar)</div>
                            </div>
                            <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'inline-flex', fontSize: 12, flexWrap: 'nowrap', flexShrink: 0 }}>
                              <span style={{ width: 5, height: 5, borderRadius: 9999, border: '1px #656565 solid', flexShrink: 0 }} />
                              <span style={{ color: '#656565', whiteSpace: 'nowrap' }}>walancy@MacBook-Pro codes % </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Interactive Resizer between Terminal Card (Left) and Terminal Tabs Panel (Right) */}
                    <div
                      className={`resizer-col ${isDraggingTermTabs ? 'dragging' : ''}`}
                      onMouseDown={startResizeTermTabs}
                      onDoubleClick={() => {
                        setTerminalTabsWidth(175);
                        localStorage.setItem('ide_term_tabs_width', '175');
                      }}
                      title="Arraste para redimensionar painel de abas (Duplo clique para 175px)"
                    />

                    {/* VS Code Style Terminal Tabs Panel (Right Card) */}
                    <div
                      style={{
                        width: terminalTabsWidth,
                        alignSelf: 'stretch',
                        background: '#101010',
                        borderRadius: 10,
                        border: 'none',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        display: 'inline-flex',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 20,
                        transition: isDraggingTermTabs ? 'none' : 'width 0.15s ease',
                      }}
                    >
                      {/* VS Code Mini-Toolbar at top of tabs list */}
                      <div
                        style={{
                          height: 28,
                          padding: '0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          borderBottom: '1px solid #1a1a1a',
                          flexShrink: 0,
                        }}
                      >
                        {/* Kill terminal icon */}
                        <div
                          onClick={(e) => handleKillTerminalSession(activeSessionId, e)}
                          title="Kill Terminal"
                          style={{
                            cursor: 'pointer',
                            color: '#858585',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#cccccc')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                        >
                          <Trash2 size={13} />
                        </div>

                        {/* More actions (...) */}
                        <div
                          title="More Actions..."
                          style={{
                            cursor: 'pointer',
                            color: '#858585',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#cccccc')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                        >
                          <MoreHorizontal size={13} />
                        </div>

                        {/* Separator */}
                        <div style={{ width: 1, height: 12, background: '#303030', margin: '0 1px' }} />

                        {/* Maximize/restore panel icon */}
                        <div
                          onClick={() => setIsTerminalMaximized((prev) => !prev)}
                          title={isTerminalMaximized ? 'Restore Terminal Size' : 'Maximize Terminal Panel'}
                          style={{
                            cursor: 'pointer',
                            color: '#858585',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#cccccc')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                        >
                          <Maximize2 size={12} />
                        </div>

                        {/* Close panel icon */}
                        <div
                          onClick={() => setIsTerminalCollapsed(true)}
                          title="Close Panel"
                          style={{
                            cursor: 'pointer',
                            color: '#858585',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                        >
                          <X size={13} />
                        </div>
                      </div>

                      {/* Sessions List */}
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '4px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {terminalSessions.map((s, index) => {
                          const isActive = s.id === activeSessionId;
                          const isHovered = s.id === hoveredRowId;
                          const isFirstSplit = s.isSplit && index === 0;
                          const isSecondSplit = s.isSplit && index > 0;

                          return (
                            <div
                              key={s.id}
                              onClick={() => setActiveSessionId(s.id)}
                              onMouseEnter={(e) => {
                                setHoveredRowId(s.id);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                                  if (parentRect) {
                                    setPopoverTop(rect.top - parentRect.top + 28);
                                  }
                                  setHoveredSessionId(s.id);
                                }, 250);
                              }}
                              onMouseLeave={() => {
                                setHoveredRowId(null);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                  setHoveredSessionId(null);
                                }, 300);
                              }}
                              style={{
                                width: '100%',
                                height: 26,
                                padding: '0 6px 0 0',
                                background: isActive
                                  ? '#1f2428'
                                  : isHovered
                                  ? '#181818'
                                  : 'transparent',
                                borderLeft: isActive ? '2px solid #007acc' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                                position: 'relative',
                              }}
                            >
                              {/* Tree Line Connector for Split Terminals */}
                              {s.isSplit && (
                                <div style={{ width: 14, height: 26, position: 'relative', flexShrink: 0, marginLeft: 2 }}>
                                  {isFirstSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 1, height: 13, background: '#606060' }} />
                                    </>
                                  )}
                                  {isSecondSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 0, left: 6, width: 1, height: 13, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Terminal Icon (SquareTerminal codicon style) */}
                              <div style={{ marginLeft: s.isSplit ? 2 : 8, marginRight: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <SquareTerminal size={14} color={isActive ? '#ffffff' : '#858585'} />
                              </div>

                              {/* Session Name */}
                              <div
                                style={{
                                  color: isActive ? '#ffffff' : '#cccccc',
                                  fontSize: 12,
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  fontWeight: isActive ? 500 : 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flex: 1,
                                }}
                              >
                                {s.name}
                              </div>

                              {/* Quick Actions (Hover visible like VS Code) */}
                              {isHovered && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginLeft: 'auto',
                                    paddingLeft: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* @ Configure / Shell menu */}
                                  <div
                                    title="Configure Terminal"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNewTerminalSession('zsh');
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      color: '#858585',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                                  >
                                    <AtSign size={12} />
                                  </div>

                                  {/* Split Terminal */}
                                  <div
                                    title="Split Terminal (Ctrl+Shift+5)"
                                    onClick={(e) => handleSplitSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: '#858585',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                                  >
                                    <SplitSquareVertical size={12} />
                                  </div>

                                  {/* Kill Terminal */}
                                  <div
                                    title="Kill Terminal"
                                    onClick={(e) => handleKillTerminalSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: '#858585',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#858585')}
                                  >
                                    <Trash2 size={12} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* VS Code Rich Tooltip Popover (Floating to the left of the sessions list) */}
                      {hoveredSessionId && (() => {
                        const hoveredSession = terminalSessions.find((s) => s.id === hoveredSessionId);
                        if (!hoveredSession) return null;

                        return (
                          <div
                            onMouseEnter={() => {
                              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                            }}
                            onMouseLeave={() => {
                              setHoveredSessionId(null);
                            }}
                            style={{
                              position: 'absolute',
                              right: 'calc(100% + 12px)',
                              top: Math.max(8, popoverTop - 15),
                              width: 330,
                              background: '#1f1f1f',
                              border: '1px solid #3c3c3c',
                              borderRadius: 5,
                              padding: '12px 14px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
                              zIndex: 1000,
                              color: 'white',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 9,
                              pointerEvents: 'auto',
                            }}
                          >
                            {/* Pointer triangle arrow pointing to the terminal tab */}
                            <div
                              style={{
                                position: 'absolute',
                                right: -6,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '6px solid #1f1f1f',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                right: -7,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '7px solid #3c3c3c',
                                zIndex: -1,
                              }}
                            />

                            {/* Title (e.g. zsh) */}
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#ffffff' }}>
                              {hoveredSession.name}
                            </div>

                            {/* Details: PID & Command line */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#cccccc', fontSize: 12 }}>
                              <div>
                                <span style={{ color: '#ffffff', fontWeight: 500 }}>Process ID (PID): </span>
                                <span style={{ color: '#cccccc' }}>{hoveredSession.pid}</span>
                              </div>
                              <div>
                                <span style={{ color: '#ffffff', fontWeight: 500 }}>Command line: </span>
                                <span style={{ color: '#cccccc' }}>{hoveredSession.command}</span>
                              </div>
                            </div>

                            {/* Shell integration: Rich */}
                            <div style={{ color: '#ffffff', fontSize: 12 }}>
                              <span style={{ fontWeight: 500 }}>Shell integration: </span>
                              <span style={{ color: '#cccccc' }}>{hoveredSession.shellIntegration}</span>
                            </div>

                            {/* Bottom Blue Action Links */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 3 }}>
                              <span
                                style={{ color: '#3794ff', fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert('Environment Contributions: PATH=/Users/walancy/.local/bin:/usr/local/bin:/bin, TERM_PROGRAM=vscode')}
                              >
                                Show Environment Contributions
                              </span>
                              <span
                                style={{ color: '#3794ff', fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert(`Terminal Details:\nProcess: ${hoveredSession.name} (PID: ${hoveredSession.pid})\nCommand: ${hoveredSession.command}\nIntegration: ${hoveredSession.shellIntegration}`)}
                              >
                                Show Details
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* 2. Problems View */}
                {activeTermTab === 'problems' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 16,
                      background: '#101010',
                      borderRadius: 10,
                      border: 'none',
                      flexDirection: 'column',
                      gap: 12,
                      display: 'flex',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3fb950', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <CheckCircle2 size={16} />
                      <span style={{ fontWeight: 500 }}>Nenhum problema encontrado no projeto.</span>
                    </div>
                    <div style={{ color: '#747474', fontSize: 12 }}>
                      0 erros de compilação • 0 alertas de linting • Todos os tipos TypeScript validados com sucesso.
                    </div>
                  </div>
                )}

                {/* 3. Output View */}
                {activeTermTab === 'output' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: '#101010',
                      borderRadius: 10,
                      border: 'none',
                      flexDirection: 'column',
                      gap: 6,
                      display: 'flex',
                      overflowY: 'auto',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                      color: '#a0a0a0',
                    }}
                  >
                    <div style={{ color: '#FF6A00' }}>[Ainaobra Build Server] Compilando ambiente...</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:00 AM LOG [NestFactory] Starting Nest application...</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:01 AM LOG [InstanceLoader] ConfigHostModule dependencies initialized</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:01 AM LOG [InstanceLoader] ConfigModule dependencies initialized</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:02 AM LOG [RoutesResolver] AppController &#123;/api&#125;: mapped &#123;/status, GET&#125;</div>
                    <div style={{ color: '#3fb950' }}>[Vite] Client build successful in 189ms.</div>
                  </div>
                )}

                {/* 4. Debug Console View */}
                {activeTermTab === 'debug' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: '#101010',
                      borderRadius: 10,
                      border: 'none',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      display: 'flex',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                      {debugHistory.map((item, idx) => (
                        <div key={idx} style={{ color: item.startsWith('>') ? '#FF6A00' : '#a0a0a0' }}>
                          {item}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleDebugSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid #1c1c1c', paddingTop: 8 }}>
                      <span style={{ color: '#FF6A00' }}>&gt;</span>
                      <input
                        type="text"
                        value={debugCommand}
                        onChange={(e) => setDebugCommand(e.target.value)}
                        placeholder="Avaliar expressão (ex: 2 + 2, Date.now(), process.platform)"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#ffffff',
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, Menlo, monospace',
                        }}
                      />
                    </form>
                  </div>
                )}

                {/* 5. Ports View */}
                {activeTermTab === 'ports' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: '#101010',
                      borderRadius: 10,
                      border: 'none',
                      flexDirection: 'column',
                      gap: 8,
                      display: 'flex',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ color: 'white', fontSize: 13, fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap' }}>
                      Portas Encaminhadas e Serviços Ativos
                    </div>
                    {[
                      { port: 3000, proc: 'ainaobra-api (NestJS)', status: 'Online', url: 'http://localhost:3000' },
                      { port: 5173, proc: 'wireframe (Vite)', status: 'Online', url: 'http://localhost:5173' },
                      { port: 5432, proc: 'postgresql (Docker)', status: 'Online', url: 'localhost:5432' },
                    ].map((p) => (
                      <div
                        key={p.port}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Radio size={14} color="#3fb950" />
                          <span style={{ color: 'white', fontWeight: 600, fontSize: 12.5 }}>:{p.port}</span>
                          <span style={{ color: '#8c8c8c', fontSize: 12 }}>{p.proc}</span>
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#FF6A00',
                            fontSize: 12,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {p.url}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---------------------------------------------------- */}
          {/* Right AI Assistant Panel (DRAGGABLE RESIZABLE WIDTH) */}
          {/* ---------------------------------------------------- */}
          {showAiPanel && (
            <>
              {/* VS Code Style Vertical Resizer for AI Panel */}
              <div
                className={`resizer-col ${isDraggingAi ? 'dragging' : ''}`}
                onMouseDown={startResizeAiPanel}
                onDoubleClick={() => setAiPanelWidth(340)}
                title="Arraste para redimensionar o Painel de IA (Duplo clique para restaurar)"
              />

              <div
                style={{
                  width: aiPanelWidth,
                  alignSelf: 'stretch',
                  padding: 12,
                  background: 'radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, #301400 0%, #101010 100%)',
                  borderRadius: 10,
                  border: 'none',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  gap: 10,
                  display: 'flex',
                  position: 'relative',
                  flexShrink: 0,
                  transition: isDraggingAi ? 'none' : 'width 0.1s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Header: AI Logo + Provider Name + Clear History (only when history exists) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '2px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedAiProvider === 'claude' && <ClaudeIcon size={17} />}
                    {selectedAiProvider === 'antigravity' && <AntigravityIcon size={17} />}
                    {selectedAiProvider === 'codex' && <CodexIcon size={17} />}
                    {selectedAiProvider === 'gemini' && <GeminiIcon size={17} />}
                    {selectedAiProvider === 'ollama' && <OllamaIcon size={17} />}
                    <div style={{ color: 'white', fontSize: 13, fontFamily: 'Poppins, sans-serif', fontWeight: '400' }}>
                      {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                    </div>
                  </div>
                  {aiHistory.length > 0 && (
                    <button
                      onClick={() => setAiHistory([])}
                      title="Limpar histórico"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#777',
                        cursor: 'pointer',
                        padding: '3px 6px',
                        fontSize: 11,
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#777')}
                    >
                      <Trash2 size={12} />
                      <span>Limpar</span>
                    </button>
                  )}
                </div>

                {/* Not-Installed Alert Banner (If triggered) */}
                {aiNotInstalledAlert && (
                  <div
                    style={{
                      background: 'rgba(255, 75, 75, 0.1)',
                      border: '1px solid rgba(255, 75, 75, 0.3)',
                      borderRadius: 8,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ color: '#ff6b6b', fontSize: 12, fontWeight: '400', fontFamily: 'Poppins, sans-serif' }}>
                      IA não instalada neste dispositivo
                    </div>
                    <div style={{ color: '#ccc', fontSize: 11, lineHeight: '16px', fontWeight: '400', fontFamily: 'Poppins, sans-serif' }}>
                      O binário <span style={{ color: '#FF6A00' }}>{aiNotInstalledAlert.command}</span> não foi encontrado. Instale clicando no link abaixo:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <button
                        onClick={() => handleOpenExternalLink(aiNotInstalledAlert.url)}
                        style={{
                          background: '#FF6A00',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: '400',
                          fontFamily: 'Poppins, sans-serif',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        Instalar {aiNotInstalledAlert.command}
                      </button>
                      <button
                        onClick={() => setAiNotInstalledAlert(null)}
                        style={{ background: 'transparent', border: 'none', color: '#777', fontSize: 11, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: '400' }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Interactive Terminal Scrollable History (Transparent Background, Regular Font, No Icons) */}
                <div
                  ref={aiTerminalScrollRef}
                  style={{
                    flex: '1 1 0',
                    minHeight: 0,
                    background: 'transparent',
                    borderRadius: 8,
                    padding: '4px 2px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 12,
                    fontWeight: '400',
                  }}
                >
                  {aiHistory.map((item, idx) => {
                    if (item.type === 'user') {
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                          <div style={{ fontSize: 10, color: '#FF6A00', fontWeight: '400' }}>
                            $ {item.command || 'ai'}
                          </div>
                          <div
                            style={{
                              background: 'rgba(255, 106, 0, 0.12)',
                              color: '#ffffff',
                              padding: '8px 12px',
                              borderRadius: '8px 8px 2px 8px',
                              maxWidth: '92%',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              fontWeight: '400',
                              lineHeight: '18px',
                            }}
                          >
                            {item.text}
                          </div>
                        </div>
                      );
                    } else if (item.type === 'error') {
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 60, 60, 0.08)',
                            borderLeft: '2px solid #ff4b4b',
                            padding: '8px 10px',
                            borderRadius: '0 6px 6px 0',
                            color: '#ff8585',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontWeight: '400',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '18px' }}>{item.text}</div>
                          {item.downloadUrl && (
                            <button
                              onClick={() => handleOpenExternalLink(item.downloadUrl!)}
                              style={{
                                alignSelf: 'flex-start',
                                background: '#FF6A00',
                                border: 'none',
                                borderRadius: 4,
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: '400',
                                fontFamily: 'Poppins, sans-serif',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                marginTop: 4,
                              }}
                            >
                              Instalar CLI no navegador
                            </button>
                          )}
                        </div>
                      );
                    } else if (item.type === 'system') {
                      return (
                        <div
                          key={idx}
                          style={{
                            color: '#888',
                            fontSize: 11,
                            padding: '2px 4px',
                            whiteSpace: 'pre-wrap',
                            fontWeight: '400',
                            lineHeight: '16px',
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: '#e5e5e5',
                            padding: '8px 12px',
                            borderRadius: '2px 8px 8px 8px',
                            maxWidth: '96%',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '18px',
                            fontWeight: '400',
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    }
                  })}

                  {/* Typing / Running Indicator */}
                  {isAiExecuting && (
                    <div style={{ color: '#FF6A00', padding: '4px 6px', fontSize: 11.5, fontWeight: '400' }}>
                      Executando comando no terminal...
                    </div>
                  )}
                </div>

                {/* Floating Bottom Card: Input & Model Selection */}
                <form
                  onSubmit={handleAiSubmit}
                  style={{
                    alignSelf: 'stretch',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                    border: 'none',
                    outline: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    display: 'flex',
                    overflow: 'visible',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {/* Larger Typing Area (Multi-line Support with Enter to Send) */}
                  <div style={{ alignSelf: 'stretch', padding: '12px 14px', display: 'flex', alignItems: 'flex-start' }}>
                    <textarea
                      ref={inputRef as any}
                      value={askPrompt}
                      onChange={(e) => setAskPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAiSubmit();
                        }
                      }}
                      placeholder={`Perguntar ou executar comando com ${AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'IA'}...`}
                      disabled={isAiExecuting}
                      rows={3}
                      style={{
                        flex: '1 1 0',
                        color: 'white',
                        fontSize: 12.5,
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: '400',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        lineHeight: '19px',
                        minHeight: 58,
                      }}
                    />
                  </div>

                  {/* Bottom Row: AI Selector + Model Selector + Send Button */}
                  <div
                    style={{
                      alignSelf: 'stretch',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'flex',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      borderBottomLeftRadius: 10,
                      borderBottomRightRadius: 10,
                      gap: 6,
                    }}
                  >
                    {/* Left Dropdown Trigger: IA Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {/* Select AI (Provider) Button with Logo */}
                      <div style={{ position: 'relative' }}>
                        <div
                          onClick={() => setProviderDropdown(!providerDropdown)}
                          style={{
                            height: 26,
                            paddingLeft: 8,
                            paddingRight: 8,
                            borderRadius: 5,
                            background: providerDropdown ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: 6,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {selectedAiProvider === 'claude' && <ClaudeIcon size={14} />}
                          {selectedAiProvider === 'antigravity' && <AntigravityIcon size={14} />}
                          {selectedAiProvider === 'codex' && <CodexIcon size={14} />}
                          {selectedAiProvider === 'gemini' && <GeminiIcon size={14} />}
                          {selectedAiProvider === 'ollama' && <OllamaIcon size={14} />}
                          <div style={{ color: 'white', fontSize: 11.5, fontFamily: 'Poppins, sans-serif', fontWeight: '400', whiteSpace: 'nowrap' }}>
                            {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                          </div>
                          <ChevronDown size={10} color="#727272" />
                        </div>

                        {/* AI Providers Dropdown Menu */}
                        {providerDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 34,
                              left: 0,
                              background: '#181818',
                              borderRadius: 8,
                              border: '1px solid #333',
                              padding: 6,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              zIndex: 9999,
                              boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
                              whiteSpace: 'nowrap',
                              minWidth: 200,
                            }}
                          >
                            {AI_PROVIDERS.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedAiProvider(p.id);
                                  setProviderDropdown(false);
                                  setAiNotInstalledAlert(null);
                                }}
                                style={{
                                  padding: '8px 10px',
                                  color: selectedAiProvider === p.id ? '#FF6A00' : 'white',
                                  fontSize: 11.5,
                                  fontFamily: 'Poppins, sans-serif',
                                  fontWeight: '400',
                                  cursor: 'pointer',
                                  borderRadius: 4,
                                  whiteSpace: 'nowrap',
                                  background: selectedAiProvider === p.id ? 'rgba(255,106,0,0.12)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                {p.id === 'claude' && <ClaudeIcon size={15} />}
                                {p.id === 'antigravity' && <AntigravityIcon size={15} />}
                                {p.id === 'codex' && <CodexIcon size={15} />}
                                {p.id === 'gemini' && <GeminiIcon size={15} />}
                                {p.id === 'ollama' && <OllamaIcon size={15} />}
                                <span>{p.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Hint for CLI commands */}
                      <div style={{ color: '#555', fontSize: 10.5, fontFamily: 'Poppins, sans-serif', fontWeight: '400', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Use /{AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.cliCommand === 'claude' ? 'model' : 'help'} para trocar de modelo no CLI
                      </div>
                    </div>

                    {/* Circular Send Button */}
                    <button
                      type="submit"
                      disabled={isAiExecuting || !askPrompt.trim()}
                      style={{
                        width: 24,
                        height: 24,
                        background: askPrompt.trim() && !isAiExecuting ? '#FF6A00' : '#444',
                        borderRadius: 61,
                        border: 'none',
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: askPrompt.trim() && !isAiExecuting ? 'pointer' : 'default',
                        flexShrink: 0,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <ArrowRight size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Empty container for other tabs as requested */
        <div style={{ alignSelf: 'stretch', flex: '1 1 0', background: 'black', borderRadius: 10, border: 'none' }} />
      )}

      {/* ============================================================ */}
      {/* 3. BOTTOM STATUS BAR (RESPONSIVE NO-WRAP LAYOUT)             */}
      {/* ============================================================ */}
      <div
        style={{
          alignSelf: 'stretch',
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'inline-flex',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          gap: 5,
        }}
      >
        {/* Left Segment: Branch + Status + Sprint + Issues */}
        <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', flexShrink: 0 }}>
            {/* Orange Left Indicator Block */}
            <div
              style={{
                width: 38,
                alignSelf: 'stretch',
                background: '#FF6A00',
                borderTopLeftRadius: 10,
                borderBottomLeftRadius: 10,
                border: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <TerminalIcon size={16} color="white" />
            </div>

            {/* Status Card Left */}
            <div
              style={{
                padding: 5,
                background: '#101010',
                borderTopRightRadius: 10,
                borderBottomRightRadius: 10,
                border: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 5,
                display: 'flex',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <GitBranch size={13} color="#989898" />
                <div style={{ color: '#989898', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>
                  ainaobra-painel-web
                </div>
                <div style={{ color: '#FF6A00', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>
                  main
                </div>
                <RefreshCw size={12} color="#FF6A00" />
              </div>

              <div style={{ width: 1, height: 16, background: '#373737', flexShrink: 0 }} />

              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <XCircle size={13} color="#747474" />
                <div style={{ color: '#747474', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>0</div>
                <span style={{ color: '#747474', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>0</span>
              </div>
            </div>
          </div>

          {/* Sprint & Issues Card */}
          <div
            style={{
              padding: 5,
              background: '#101010',
              borderRadius: 10,
              border: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: '#989898', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Sprint 2 -</div>
                <div style={{ color: '#FF6A00', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>7 days</div>
              </div>

              <div style={{ width: 1, height: 16, background: '#373737', flexShrink: 0 }} />

              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: '#989898', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Issues</div>
                <div style={{ color: '#FF6A00', fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>12 remming</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Segment: Position Info + Orange "Ai na obra" Button */}
        <div
          style={{
            background: '#101010',
            overflow: 'hidden',
            borderRadius: 10,
            border: 'none',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 5,
              border: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: '#989898', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>
              Walancy (3 months ago)
            </div>
            <div style={{ color: '#474747', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Ln 21, Col 13</div>
            <div style={{ color: '#474747', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Spaces: 2</div>
            <div style={{ color: '#474747', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>UTF-8</div>
            <div style={{ color: '#474747', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>LF</div>
            <div style={{ color: '#474747', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>TypeScript</div>
          </div>

          {/* Solid Orange Block "Ai na obra" */}
          <div
            style={{
              alignSelf: 'stretch',
              paddingLeft: 14,
              paddingRight: 14,
              background: '#FF6A00',
              border: 'none',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 6,
              display: 'flex',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ color: 'white', fontSize: 12, fontFamily: 'Poppins', fontWeight: '600', whiteSpace: 'nowrap' }}>Ai na obra</div>
            <TerminalIcon size={14} color="white" />
          </div>
        </div>

        {/* Global Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: 40,
              right: 25,
              background: '#1a1a1a',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: '1px solid #FF6A00',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6A00' }} />
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
export default App;
