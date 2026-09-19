import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window State Methods
  windowState: {
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const handler = (_event: any, isFs: boolean) => callback(isFs);
      ipcRenderer.on('window:fullscreen-change', handler);
      return () => ipcRenderer.removeListener('window:fullscreen-change', handler);
    },
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setTheme: (theme: 'dark' | 'light') => ipcRenderer.send('theme:set', theme),
  },

  // PTY Methods
  pty: {
    create: (id: string, type: string, cwd: string, cols: number, rows: number, accentColor?: string) =>
      ipcRenderer.invoke('pty:create', { id, type, cwd, cols, rows, accentColor }),
    write: (id: string, data: string) =>
      ipcRenderer.send('pty:write', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { id, cols, rows }),
    kill: (id: string) =>
      ipcRenderer.send('pty:kill', { id }),
    setAccentColor: (accentColor: string) =>
      ipcRenderer.invoke('pty:setAccentColor', { accentColor }),
    getHistory: (id: string) =>
      ipcRenderer.invoke('pty:getHistory', { id }),
    onData: (callback: (payload: { id: string; data: string }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('pty:data', handler);
      return () => ipcRenderer.removeListener('pty:data', handler);
    },
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('pty:exit', handler);
      return () => ipcRenderer.removeListener('pty:exit', handler);
    },
  },

  // File System Methods
  fs: {
    getTree: (dirPath: string, depth?: number) =>
      ipcRenderer.invoke('fs:getTree', { dirPath, depth }),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    createItem: (itemPath: string, isDirectory: boolean) =>
      ipcRenderer.invoke('fs:createItem', { itemPath, isDirectory }),
    deleteItem: (itemPath: string) =>
      ipcRenderer.invoke('fs:deleteItem', { itemPath }),
    renameItem: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:renameItem', { oldPath, newPath }),
    copyItem: (srcPath: string, destPath: string) =>
      ipcRenderer.invoke('fs:copyItem', { srcPath, destPath }),
    searchInFiles: (dirPath: string, query: string, options?: { isRegex?: boolean; matchCase?: boolean; matchWholeWord?: boolean; maxResults?: number }) =>
      ipcRenderer.invoke('fs:searchInFiles', { dirPath, query, ...options }),
  },

  // Projects & Tasks Methods
  projects: {
    getProjects: () => ipcRenderer.invoke('projects:getProjects'),
    getActiveProject: () => ipcRenderer.invoke('projects:getActiveProject'),
    selectProject: (id: string) => ipcRenderer.invoke('projects:selectProject', { id }),
    addProject: (name: string, path: string, description?: string) =>
      ipcRenderer.invoke('projects:addProject', { name, path, description }),
    getTasks: () => ipcRenderer.invoke('projects:getTasks'),
    updateTaskStatus: (id: string, status: string) =>
      ipcRenderer.invoke('projects:updateTaskStatus', { id, status }),
  },

  // Ports Methods
  ports: {
    scan: () => ipcRenderer.invoke('ports:scan'),
  },

  // Extensions Methods
  extensions: {
    search: (query = '', size = 35, category = '') =>
      ipcRenderer.invoke('extensions:search', { query, size, category }),
    getDetails: (namespace: string, name: string) =>
      ipcRenderer.invoke('extensions:getDetails', { namespace, name }),
    install: (namespace: string, name: string, version?: string) =>
      ipcRenderer.invoke('extensions:install', { namespace, name, version }),
    uninstall: (namespace: string, name: string) =>
      ipcRenderer.invoke('extensions:uninstall', { namespace, name }),
    toggleEnabled: (namespace: string, name: string) =>
      ipcRenderer.invoke('extensions:toggleEnabled', { namespace, name }),
    getInstalled: () =>
      ipcRenderer.invoke('extensions:getInstalled'),
  },

  // AI Agent Methods
  ai: {
    prompt: (prompt: string, model: string, cwd?: string) =>
      ipcRenderer.invoke('ai:prompt', { prompt, model, cwd }),
    checkClis: () => ipcRenderer.invoke('ai:checkClis'),
    getCommands: (providerId: string) =>
      ipcRenderer.invoke('ai:getCommands', { providerId }),
    getQuotas: () =>
      ipcRenderer.invoke('ai:getQuotas'),
    getModels: (providerId: string) =>
      ipcRenderer.invoke('ai:getModels', { providerId }),
    setModel: (providerId: string, modelId: string) =>
      ipcRenderer.invoke('ai:setModel', { providerId, modelId }),
    saveChatLocally: (session: any) =>
      ipcRenderer.invoke('ai:saveChatLocally', session),
    exportChatDialog: (session: any, format: 'markdown' | 'json') =>
      ipcRenderer.invoke('ai:exportChatDialog', { session, format }),
    getSavedChats: () =>
      ipcRenderer.invoke('ai:getSavedChats'),
    loadSavedChat: (sessionId: string) =>
      ipcRenderer.invoke('ai:loadSavedChat', sessionId),
    deleteSavedChat: (sessionId: string) =>
      ipcRenderer.invoke('ai:deleteSavedChat', sessionId),
    runCli: (payload: { cliCmd: string; prompt: string; model?: string; cwd?: string; additionalDirs?: string[] }) =>
      ipcRenderer.invoke('ai:runCli', payload),
  },

  // Native Menu Listeners
  menu: {
    onAction: (callback: (action: string) => void) => {
      const handler = (_event: any, action: string) => callback(action);
      ipcRenderer.on('menu:action', handler);
      return () => ipcRenderer.removeListener('menu:action', handler);
    },
    onOpenFile: (callback: (filePath: string) => void) => {
      const handler = (_event: any, filePath: string) => callback(filePath);
      ipcRenderer.on('menu:open-file', handler);
      return () => ipcRenderer.removeListener('menu:open-file', handler);
    },
    onOpenFolder: (callback: (folderPath: string) => void) => {
      const handler = (_event: any, folderPath: string) => callback(folderPath);
      ipcRenderer.on('menu:open-folder', handler);
      return () => ipcRenderer.removeListener('menu:open-folder', handler);
    },
  },

  // Native File/Folder Dialogs
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },

  // Shell execution
  shell: {
    exec: (command: string, cwd?: string) =>
      ipcRenderer.invoke('shell:exec', { command, cwd }),
    openExternal: (url: string) =>
      ipcRenderer.invoke('shell:openExternal', { url }),
    openInSystemTerminal: (command: string, cwd?: string) =>
      ipcRenderer.invoke('shell:openInSystemTerminal', { command, cwd }),
    showItemInFolder: (itemPath: string) =>
      ipcRenderer.invoke('shell:showItemInFolder', { itemPath }),
  },

  // Git & GitHub Integration
  git: {
    getWorkspaceGitInfo: (workspacePath: string, activeFilePath?: string) =>
      ipcRenderer.invoke('git:getWorkspaceGitInfo', { workspacePath, activeFilePath }),
    listRepos: (workspacePath: string) =>
      ipcRenderer.invoke('git:listRepos', { workspacePath }),
    getIssues: (workspacePath: string) =>
      ipcRenderer.invoke('git:getIssues', { workspacePath }),
    createIssue: (workspacePath: string, title: string, body?: string) =>
      ipcRenderer.invoke('git:createIssue', { workspacePath, title, body }),
  },

  // GitHub OAuth Device Flow login
  github: {
    isAuthenticated: () => ipcRenderer.invoke('github:isAuthenticated'),
    getUser: () => ipcRenderer.invoke('github:getUser'),
    logout: () => ipcRenderer.invoke('github:logout'),
    startLogin: () => ipcRenderer.invoke('github:startLogin'),
    cancelLogin: () => ipcRenderer.invoke('github:cancelLogin'),
    fetchRepos: () => ipcRenderer.invoke('github:fetchRepos'),
    fetchProjects: () => ipcRenderer.invoke('github:fetchProjects'),
    fetchOrgs: () => ipcRenderer.invoke('github:fetchOrgs'),
    fetchRepoIssues: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoIssues', { owner, repo }),
    fetchRepoPulls: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoPulls', { owner, repo }),
    fetchRepoMilestones: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoMilestones', { owner, repo }),
    fetchRepoReleases: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoReleases', { owner, repo }),
    fetchRepoCollaborators: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoCollaborators', { owner, repo }),
    createIssue: (owner: string, repo: string, input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number }) =>
      ipcRenderer.invoke('github:createIssue', { owner, repo, ...input }),
    updateIssue: (
      owner: string,
      repo: string,
      issueNumber: number,
      input: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; ensureLabels?: Array<{ name: string; color: string }>; milestone?: number | null },
    ) => ipcRenderer.invoke('github:updateIssue', { owner, repo, issueNumber, ...input }),
    deleteIssue: (nodeId: string) => ipcRenderer.invoke('github:deleteIssue', { nodeId }),
    createMilestone: (owner: string, repo: string, input: { title: string; description?: string; due_on?: string }) =>
      ipcRenderer.invoke('github:createMilestone', { owner, repo, ...input }),
    onLoginResult: (callback: (result: { success: boolean; user?: any; error?: string }) => void) => {
      const handler = (_event: any, result: any) => callback(result);
      ipcRenderer.on('github:loginResult', handler);
      return () => ipcRenderer.removeListener('github:loginResult', handler);
    },
  },
});
