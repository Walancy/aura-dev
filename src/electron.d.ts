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
    renameItem: (oldPath: string, newPath: string) => Promise<{ success: boolean }>;
    copyItem: (srcPath: string, destPath: string) => Promise<{ success: boolean }>;
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
    getSavedChats?: () => Promise<Array<{ id: string; title: string; provider: string; updatedAt: number; messageCount: number; path: string; projectName?: string; workspacePath?: string; model?: string }>>;
    loadSavedChat?: (sessionId: string) => Promise<any>;
    deleteSavedChat?: (sessionId: string) => Promise<{ success: boolean }>;
    runCli?: (payload: { cliCmd: string; prompt: string; model?: string; cwd?: string; additionalDirs?: string[] }) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
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
    showItemInFolder?: (itemPath: string) => Promise<{ success: boolean; error?: string }>;
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
    listRepos?: (workspacePath: string) => Promise<Array<{ dir: string; name: string }>>;
    getIssues?: (workspacePath: string) => Promise<Array<any>>;
    createIssue?: (workspacePath: string, title: string, body?: string) => Promise<{ success: boolean; issue?: any; error?: string }>;
  };
  github?: {
    isAuthenticated: () => Promise<{ authenticated: boolean }>;
    getUser: () => Promise<{ success: boolean; user?: { login: string; name: string | null; avatarUrl: string; htmlUrl: string }; error?: string }>;
    logout: () => Promise<{ success: boolean }>;
    startLogin: () => Promise<{ success: boolean; userCode?: string; verificationUri?: string; expiresIn?: number; error?: string }>;
    cancelLogin: () => Promise<{ success: boolean }>;
    fetchRepos: () => Promise<{ success: boolean; repos?: any[]; error?: string }>;
    fetchProjects: () => Promise<{ success: boolean; projects?: any[]; error?: string }>;
    fetchOrgs: () => Promise<{ success: boolean; orgs?: Array<{ login: string; avatarUrl: string }>; error?: string }>;
    fetchRepoIssues: (owner: string, repo: string) => Promise<{ success: boolean; issues?: any[]; error?: string }>;
    fetchRepoPulls: (owner: string, repo: string) => Promise<{ success: boolean; pulls?: any[]; error?: string }>;
    fetchRepoMilestones: (owner: string, repo: string) => Promise<{ success: boolean; milestones?: any[]; error?: string }>;
    fetchRepoReleases: (owner: string, repo: string) => Promise<{ success: boolean; releases?: any[]; error?: string }>;
    createIssue: (owner: string, repo: string, input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number }) => Promise<{ success: boolean; issue?: any; error?: string }>;
    updateIssue: (
      owner: string,
      repo: string,
      issueNumber: number,
      input: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; ensureLabels?: Array<{ name: string; color: string }>; milestone?: number | null },
    ) => Promise<{ success: boolean; issue?: any; error?: string }>;
    deleteIssue: (nodeId: string) => Promise<{ success: boolean; error?: string }>;
    createMilestone: (owner: string, repo: string, input: { title: string; description?: string; due_on?: string }) => Promise<{ success: boolean; milestone?: any; error?: string }>;
    onLoginResult: (callback: (result: { success: boolean; user?: { login: string; name: string | null; avatarUrl: string; htmlUrl: string }; error?: string }) => void) => () => void;
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

declare module '*.svg' {
  const src: string;
  export default src;
}

