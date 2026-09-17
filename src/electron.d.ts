export interface ElectronAPI {
  windowState?: {
    isFullscreen: () => Promise<boolean>;
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
  };
  pty: {
    create: (id: string, type: string, cwd: string, cols: number, rows: number, accentColor?: string) => Promise<{ success: boolean; id?: string; title?: string; pid?: number; error?: string }>;
    write: (id: string, data: string) => void;
    resize: (id: string, cols: number, rows: number) => void;
    kill: (id: string) => void;
    setAccentColor?: (accentColor: string) => Promise<{ success: boolean; error?: string }>;
    getHistory?: (id: string) => Promise<string>;
    onData: (callback: (payload: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => () => void;
  };
  fs: {
    getTree: (dirPath: string, depth?: number) => Promise<{ tree: any }>;
    readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
    createItem: (itemPath: string, isDirectory: boolean) => Promise<{ success: boolean }>;
    deleteItem: (itemPath: string) => Promise<{ success: boolean }>;
    searchInFiles?: (dirPath: string, query: string, options?: { isRegex?: boolean; matchCase?: boolean; matchWholeWord?: boolean; maxResults?: number }) => Promise<{ results: Array<{ file: string; line: number; text: string }> }>;
  };
  projects: {
    getProjects: () => Promise<{ projects: any[]; activeProject: any }>;
    getActiveProject: () => Promise<any>;
    selectProject: (id: string) => Promise<any>;
    addProject: (name: string, path: string, description?: string) => Promise<any>;
    getTasks: () => Promise<{ tasks: any[] }>;
    updateTaskStatus: (id: string, status: string) => Promise<any>;
  };
  ports: {
    scan: () => Promise<{ ports: any[] }>;
  };
  extensions?: {
    search?: (query?: string, size?: number, category?: string) => Promise<{ success: boolean; extensions: any[]; totalSize?: number; error?: string }>;
    getDetails?: (namespace: string, name: string) => Promise<{ success: boolean; details: any; error?: string }>;
    install?: (namespace: string, name: string, version?: string) => Promise<{ success: boolean; record?: any; error?: string }>;
    uninstall?: (namespace: string, name: string) => Promise<{ success: boolean; error?: string }>;
    toggleEnabled?: (namespace: string, name: string) => Promise<{ success: boolean; error?: string }>;
    getInstalled?: () => Promise<{ success: boolean; extensions: any[] }>;
  };
  ai: {
    prompt: (prompt: string, model: string, cwd?: string) => Promise<{ response: string }>;
    checkClis?: () => Promise<Record<string, boolean>>;
    getCommands?: (providerId: string) => Promise<Array<{ command: string; description: string; usage?: string }>>;
    getQuotas?: () => Promise<Record<string, { dailyPercent: number; weeklyPercent: number; dailyResetTime: string; weeklyResetDay: string; weeklyResetTime: string }>>;
    getModels?: (providerId: string) => Promise<{ providerId: string; currentModel: string; currentModelId: string; models: Array<{ id: string; label: string; tag?: string; description?: string }> }>;
    setModel?: (providerId: string, modelId: string) => Promise<{ success: boolean; currentModel: string; message: string }>;
    saveChatLocally?: (session: any) => Promise<{ success: boolean; jsonPath: string; mdPath: string; error?: string }>;
    exportChatDialog?: (session: any, format: 'markdown' | 'json') => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
    getSavedChats?: () => Promise<Array<{ id: string; title: string; provider: string; updatedAt: number; messageCount: number; path: string }>>;
    loadSavedChat?: (sessionId: string) => Promise<any>;
    deleteSavedChat?: (sessionId: string) => Promise<{ success: boolean }>;
  };
  menu: {
    onAction: (callback: (action: string) => void) => () => void;
    onOpenFile: (callback: (filePath: string) => void) => () => void;
    onOpenFolder: (callback: (folderPath: string) => void) => () => void;
  };
  dialog: {
    openFile: () => Promise<{ filePath: string; name: string; content: string; error?: string } | null>;
    openFolder: () => Promise<{ folderPath: string; name: string; tree: any[] } | null>;
  };
  shell: {
    exec: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error: string | null; exitCode: number; newCwd?: string | null }>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
    openInSystemTerminal?: (command: string, cwd?: string) => Promise<{ success: boolean; error?: string }>;
  };
  git?: {
    getWorkspaceGitInfo: (workspacePath: string, activeFilePath?: string) => Promise<{
      isGitRepo: boolean;
      branch: string;
      repoName: string;
      repoOwner?: string;
      remoteUrl?: string;
      issuesCount: number;
      sprintTitle?: string;
      sprintRemaining?: string;
      authorBlame?: string;
      modifiedCount: number;
      lastCommitHash?: string;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}

