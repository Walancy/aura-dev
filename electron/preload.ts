import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

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
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop'),
  },

  // PTY Methods
  pty: {
    create: (id: string, type: string, cwd: string, cols: number, rows: number, accentColor?: string, extraOptions?: any) =>
      ipcRenderer.invoke('pty:create', { id, type, cwd, cols, rows, accentColor, extraOptions }),
    writePrompt: (id: string, prompt: string) =>
      ipcRenderer.invoke('pty:writePrompt', { id, prompt }),
    runPromptInCli: (id: string, prompt: string, timeoutMs?: number) =>
      ipcRenderer.invoke('pty:runPromptInCli', { id, prompt, timeoutMs }),
    write: (id: string, data: string) =>
      ipcRenderer.send('pty:write', { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('pty:resize', { id, cols, rows }),
    kill: (id: string) =>
      ipcRenderer.send('pty:kill', { id }),
    setCwd: (id: string, cwd: string) =>
      ipcRenderer.invoke('pty:setCwd', { id, cwd }),
    setAllCwd: (cwd: string) =>
      ipcRenderer.invoke('pty:setAllCwd', { cwd }),
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
    foreground: () => ipcRenderer.invoke('pty:foreground'),
    getRunningSessions: () =>
      ipcRenderer.invoke('pty:getRunningSessions'),
    onAiCompleted: (callback: (payload: { id: string; type: string; cwd: string; projectName: string; summary: string; needsInput?: boolean; timestamp: number }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('pty:ai-completed', handler);
      return () => ipcRenderer.removeListener('pty:ai-completed', handler);
    },
    onSessionStatus: (callback: (payload: { id: string; type: string; cwd: string; isAi: boolean; isRunning: boolean; exited?: boolean }) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('pty:session-status', handler);
      return () => ipcRenderer.removeListener('pty:session-status', handler);
    },
  },

  // Design Room (LAN collaboration) Methods
  designRoom: {
    host: (roomName: string, canEdit = true) => ipcRenderer.invoke('design-room:host', { roomName, canEdit }),
    sendCursor: (cursor: { x: number; y: number; name: string; color: string }) => ipcRenderer.send('design-room:send-cursor', { cursor }),
    onCursor: (callback: (cursor: any) => void) => {
      const handler = (_event: any, cursor: any) => callback(cursor);
      ipcRenderer.on('design-room:cursor', handler);
      return () => ipcRenderer.removeListener('design-room:cursor', handler);
    },
    onPermissions: (callback: (p: { canEdit: boolean; hostName: string }) => void) => {
      const handler = (_event: any, p: any) => callback(p);
      ipcRenderer.on('design-room:permissions', handler);
      return () => ipcRenderer.removeListener('design-room:permissions', handler);
    },
    stopHosting: () => ipcRenderer.invoke('design-room:stop-hosting'),
    startDiscovery: () => ipcRenderer.invoke('design-room:start-discovery'),
    stopDiscovery: () => ipcRenderer.invoke('design-room:stop-discovery'),
    join: (ip: string, port: number) => ipcRenderer.invoke('design-room:join', { ip, port }),
    leave: () => ipcRenderer.invoke('design-room:leave'),
    broadcastState: (shapes: unknown[]) => ipcRenderer.send('design-room:broadcast-state', { shapes }),
    onRoomsUpdated: (callback: (rooms: any[]) => void) => {
      const handler = (_event: any, rooms: any[]) => callback(rooms);
      ipcRenderer.on('design-room:rooms-updated', handler);
      return () => ipcRenderer.removeListener('design-room:rooms-updated', handler);
    },
    onStateUpdate: (callback: (shapes: any[]) => void) => {
      const handler = (_event: any, shapes: any[]) => callback(shapes);
      ipcRenderer.on('design-room:state-update', handler);
      return () => ipcRenderer.removeListener('design-room:state-update', handler);
    },
    onViewersChanged: (callback: (count: number) => void) => {
      const handler = (_event: any, count: number) => callback(count);
      ipcRenderer.on('design-room:viewers-changed', handler);
      return () => ipcRenderer.removeListener('design-room:viewers-changed', handler);
    },
    onDisconnected: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('design-room:disconnected', handler);
      return () => ipcRenderer.removeListener('design-room:disconnected', handler);
    },
  },

  // File System Methods
  fs: {
    getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
    getTree: (dirPath: string, depth?: number) =>
      ipcRenderer.invoke('fs:getTree', { dirPath, depth }),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    getCapabilities: () => ipcRenderer.invoke('app:capabilities'),
    stockImage: (payload: { query: string; width: number; height: number; key?: string; index?: number }) => ipcRenderer.invoke('unsplash:image', payload),
    exportPdf: (html: string, defaultName: string) => ipcRenderer.invoke('design:exportPdf', { html, defaultName }),
    figmaFetch: (token: string, apiPath: string) => ipcRenderer.invoke('figma:fetch', { token, apiPath }),
    figmaDownloadImages: (urls: Record<string, string>) => ipcRenderer.invoke('figma:downloadImages', { urls }),
    saveTempImage: (base64: string, ext?: string) =>
      ipcRenderer.invoke('fs:saveTempImage', { base64, ext }),
    readFileDataUrl: (filePath: string, maxBytes?: number) =>
      ipcRenderer.invoke('fs:readFileDataUrl', { filePath, maxBytes }),
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
    scanProject: (workspacePath: string) => ipcRenderer.invoke('ports:scanProject', workspacePath),
    kill: (pid: string | number) => ipcRenderer.invoke('ports:kill', pid),
  },

  // Orchestration agent roles
  roles: {
    list: () => ipcRenderer.invoke('roles:list'),
    create: (role: { name: string; color: string; instructions: string }) =>
      ipcRenderer.invoke('roles:create', role),
    update: (id: string, patch: Partial<{ name: string; color: string; instructions: string }>) =>
      ipcRenderer.invoke('roles:update', { id, patch }),
    delete: (id: string) => ipcRenderer.invoke('roles:delete', id),
  },

  // Skills do DevFlow (ativas em todos os CLIs de IA)
  skills: {
    call: (action: string, payload?: any) => ipcRenderer.invoke('skills:call', { action, payload }),
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('skills:changed', handler);
      return () => ipcRenderer.removeListener('skills:changed', handler);
    },
  },

  // AI Agent Methods
  ai: {
    prompt: (prompt: string, model: string, cwd?: string, provider?: string, timeoutMs?: number, runId?: string, sessionIds?: string[]) =>
      ipcRenderer.invoke('ai:prompt', { prompt, model, cwd, provider, timeoutMs, runId, sessionIds }),
    checkClis: () => ipcRenderer.invoke('ai:checkClis'),
    checkCliUpdates: () => ipcRenderer.invoke('ai:checkCliUpdates'),
    orchestratorProviders: () => ipcRenderer.invoke('ai:orchestratorProviders'),
    orchestrate: (input: any) => ipcRenderer.invoke('ai:orchestrate', input),
    cancelOrchestration: (runId: string) => ipcRenderer.invoke('ai:orchestratorCancel', runId),
    autonomousRun: (input: any) => ipcRenderer.invoke('ai:autonomousRun', input),
    cancelAutonomous: (runId: string) => ipcRenderer.invoke('ai:autonomousCancel', runId),
    onOrchestratorEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('ai:orchestrator-event', handler);
      return () => ipcRenderer.removeListener('ai:orchestrator-event', handler);
    },
    getCommands: (providerId: string) =>
      ipcRenderer.invoke('ai:getCommands', { providerId }),
    getQuotas: (force?: boolean) =>
      ipcRenderer.invoke('ai:getQuotas', force),
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
    saveTranscript: (sessionId: string, history: any[]) =>
      ipcRenderer.invoke('ai:saveTranscript', { sessionId, history }),
    runCli: (payload: { cliCmd: string; prompt: string; model?: string; cwd?: string; additionalDirs?: string[]; useOrchestrator?: boolean; orchestratorConfig?: any; permissions?: any; streamText?: boolean; streamId?: string }) =>
      ipcRenderer.invoke('ai:runCli', payload),
    cancel: (runId?: string, cwd?: string, streamId?: string) =>
      ipcRenderer.invoke('ai:cancel', runId, cwd, streamId),
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('ai:orchestrator-event', handler);
      return () => ipcRenderer.removeListener('ai:orchestrator-event', handler);
    },
  },

  // Flutter (preview web-server embutido no node "webview" da Orquestração)
  flutter: {
    run: (runId: string, cwd: string, port: number) =>
      ipcRenderer.invoke('flutter:run', { runId, cwd, port }),
    stop: (runId: string) => ipcRenderer.invoke('flutter:stop', runId),
    onEvent: (callback: (event: any) => void) => {
      const handler = (_event: any, payload: any) => callback(payload);
      ipcRenderer.on('flutter:event', handler);
      return () => ipcRenderer.removeListener('flutter:event', handler);
    },
  },

  // Captura de janelas nativas (macOS: embutir o Simulador iOS/Xcode no canvas)
  capture: {
    listWindows: (filter?: string) => ipcRenderer.invoke('capture:listWindows', { filter }),
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
    scanLocalProjects: (baseDir?: string) =>
      ipcRenderer.invoke('git:scanLocalProjects', { baseDir }),
    getIssues: (workspacePath: string) =>
      ipcRenderer.invoke('git:getIssues', { workspacePath }),
    createIssue: (workspacePath: string, title: string, body?: string) =>
      ipcRenderer.invoke('git:createIssue', { workspacePath, title, body }),
    clone: (repoUrl: string, targetDir: string) =>
      ipcRenderer.invoke('git:clone', { repoUrl, targetDir }),
    getRecentCommitsSummary: (options?: any) =>
      ipcRenderer.invoke('git:getRecentCommitsSummary', typeof options === 'number' ? { days: options } : options),
    worktreeList: (repoPath: string) =>
      ipcRenderer.invoke('git:worktreeList', { repoPath }),
    worktreeCreate: (repoPath: string, branchName: string, targetDir: string) =>
      ipcRenderer.invoke('git:worktreeCreate', { repoPath, branchName, targetDir }),
    worktreeRemove: (repoPath: string, worktreePath: string) =>
      ipcRenderer.invoke('git:worktreeRemove', { repoPath, worktreePath }),
    worktreeLand: (repoPath: string, branchName: string, baseBranch: string) =>
      ipcRenderer.invoke('git:worktreeLand', { repoPath, branchName, baseBranch }),
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
    fetchOrgProjects: (org: string) => ipcRenderer.invoke('github:fetchOrgProjects', { org }),
    fetchRepoProjects: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoProjects', { owner, repo }),
    fetchProjectItems: (projectNumber: number, org?: string) => ipcRenderer.invoke('github:fetchProjectItems', { projectNumber, org }),
    updateProjectItemStatus: (projectId: string, itemId: string, fieldId: string, optionId: string) =>
      ipcRenderer.invoke('github:updateProjectItemStatus', { projectId, itemId, fieldId, optionId }),
    fetchIssueDetails: (owner: string, repo: string, number: number) =>
      ipcRenderer.invoke('github:fetchIssueDetails', { owner, repo, number }),
    updateProjectItemField: (projectId: string, itemId: string, fieldId: string, value: Record<string, any>) =>
      ipcRenderer.invoke('github:updateProjectItemField', { projectId, itemId, fieldId, value }),
    clearProjectItemField: (projectId: string, itemId: string, fieldId: string) =>
      ipcRenderer.invoke('github:clearProjectItemField', { projectId, itemId, fieldId }),
    addIssueToProject: (projectId: string, contentId: string) =>
      ipcRenderer.invoke('github:addIssueToProject', { projectId, contentId }),
    removeProjectItem: (projectId: string, itemId: string) =>
      ipcRenderer.invoke('github:removeProjectItem', { projectId, itemId }),
    setIssueType: (issueId: string, issueTypeId: string | null) =>
      ipcRenderer.invoke('github:setIssueType', { issueId, issueTypeId }),
    fetchOrgs: () => ipcRenderer.invoke('github:fetchOrgs'),
    fetchRepoIssues: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoIssues', { owner, repo }),
    fetchRepoPulls: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoPulls', { owner, repo }),
    fetchRepoMilestones: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoMilestones', { owner, repo }),
    fetchRepoReleases: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoReleases', { owner, repo }),
    fetchRepoCollaborators: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchRepoCollaborators', { owner, repo }),
    fetchTeamInsights: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchTeamInsights', { owner, repo }),
    fetchOrgTeams: (org: string) => ipcRenderer.invoke('github:fetchOrgTeams', { org }),
    fetchCollaboratorPermissions: (owner: string, repo: string) => ipcRenderer.invoke('github:fetchCollaboratorPermissions', { owner, repo }),
    setCollaboratorPermission: (owner: string, repo: string, username: string, role: string) =>
      ipcRenderer.invoke('github:setCollaboratorPermission', { owner, repo, username, role }),
    removeCollaborator: (owner: string, repo: string, username: string) => ipcRenderer.invoke('github:removeCollaborator', { owner, repo, username }),
    cancelInvitation: (owner: string, repo: string, invitationId: number) => ipcRenderer.invoke('github:cancelInvitation', { owner, repo, invitationId }),
    setTeamRepoPermission: (org: string, teamSlug: string, owner: string, repo: string, role: string) =>
      ipcRenderer.invoke('github:setTeamRepoPermission', { org, teamSlug, owner, repo, role }),
    removeTeamRepo: (org: string, teamSlug: string, owner: string, repo: string) =>
      ipcRenderer.invoke('github:removeTeamRepo', { org, teamSlug, owner, repo }),
    createTeam: (org: string, name: string, description?: string) => ipcRenderer.invoke('github:createTeam', { org, name, description }),
    requestReviewers: (owner: string, repo: string, pullNumber: number, reviewers: string[]) =>
      ipcRenderer.invoke('github:requestReviewers', { owner, repo, pullNumber, reviewers }),
    addAssignees: (owner: string, repo: string, issueNumber: number, assignees: string[]) =>
      ipcRenderer.invoke('github:addAssignees', { owner, repo, issueNumber, assignees }),
    settings: (action: string, payload: any) => ipcRenderer.invoke('github:settings', { action, payload }),
    createIssue: (owner: string, repo: string, input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number }) =>
      ipcRenderer.invoke('github:createIssue', { owner, repo, ...input }),
    updateIssue: (
      owner: string,
      repo: string,
      issueNumber: number,
      input: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; ensureLabels?: Array<{ name: string; color: string }>; milestone?: number | null; assignees?: string[] },
    ) => ipcRenderer.invoke('github:updateIssue', { owner, repo, issueNumber, ...input }),
    deleteIssue: (input: string | { nodeId?: string; owner?: string; repo?: string; issueNumber?: number }) =>
      ipcRenderer.invoke('github:deleteIssue', typeof input === 'string' ? { nodeId: input } : input),
    lockIssue: (owner: string, repo: string, issueNumber: number, locked: boolean) =>
      ipcRenderer.invoke('github:lockIssue', { owner, repo, issueNumber, locked }),
    pinIssue: (issueId: string, pinned: boolean) =>
      ipcRenderer.invoke('github:pinIssue', { issueId, pinned }),
    setIssueSubscription: (owner: string, repo: string, issueNumber: number, subscribed: boolean) =>
      ipcRenderer.invoke('github:setIssueSubscription', { owner, repo, issueNumber, subscribed }),
    transferIssue: (owner: string, repo: string, issueNumber: number, newOwner: string, newRepo: string) =>
      ipcRenderer.invoke('github:transferIssue', { owner, repo, issueNumber, newOwner, newRepo }),
    fetchIssueComments: (owner: string, repo: string, issueNumber: number) =>
      ipcRenderer.invoke('github:fetchIssueComments', { owner, repo, issueNumber }),
    addIssueComment: (owner: string, repo: string, issueNumber: number, body: string) =>
      ipcRenderer.invoke('github:addIssueComment', { owner, repo, issueNumber, body }),
    updateIssueComment: (owner: string, repo: string, commentId: number, body: string) =>
      ipcRenderer.invoke('github:updateIssueComment', { owner, repo, commentId, body }),
    deleteIssueComment: (owner: string, repo: string, commentId: number) =>
      ipcRenderer.invoke('github:deleteIssueComment', { owner, repo, commentId }),
    createMilestone: (owner: string, repo: string, input: { title: string; description?: string; due_on?: string }) =>
      ipcRenderer.invoke('github:createMilestone', { owner, repo, ...input }),
    updateMilestone: (owner: string, repo: string, milestoneNumber: number, input: { title?: string; description?: string; due_on?: string; state?: 'open' | 'closed' }) =>
      ipcRenderer.invoke('github:updateMilestone', { owner, repo, milestoneNumber, ...input }),
    deleteMilestone: (owner: string, repo: string, milestoneNumber: number) =>
      ipcRenderer.invoke('github:deleteMilestone', { owner, repo, milestoneNumber }),
    onLoginResult: (callback: (result: { success: boolean; user?: any; error?: string }) => void) => {
      const handler = (_event: any, result: any) => callback(result);
      ipcRenderer.on('github:loginResult', handler);
      return () => ipcRenderer.removeListener('github:loginResult', handler);
    },
  },
});
