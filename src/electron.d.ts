export interface GithubProjectFieldDef {
  id: string;
  name: string;
  dataType: 'SINGLE_SELECT' | 'ITERATION' | 'NUMBER' | 'TEXT' | 'DATE' | string;
  options?: Array<{ id: string; name: string; color?: string }>;
  iterations?: Array<{ id: string; title: string; startDate: string; duration: number; completed: boolean }>;
}

export interface GithubProjectItemDetails {
  itemId: string;
  project: { id: string; number: number; title: string; url?: string };
  fields: GithubProjectFieldDef[];
  values: Record<string, { optionId?: string; name?: string; number?: number; text?: string; date?: string; iterationId?: string; title?: string; startDate?: string; duration?: number }>;
}

export interface GithubIssueDetails {
  repositoryId: string;
  issue: {
    id: string;
    number: number;
    title: string;
    body: string;
    state: 'OPEN' | 'CLOSED';
    stateReason?: string | null;
    url: string;
    createdAt: string;
    updatedAt: string;
    author?: { login: string; avatarUrl: string } | null;
    assignees: Array<{ login: string; avatarUrl: string }>;
    labels: Array<{ name: string; color: string }>;
    milestone?: { number: number; title: string; dueOn?: string | null } | null;
    participants: Array<{ login: string; avatarUrl: string }>;
    issueType?: { id: string; name: string; color?: string } | null;
    subIssuesSummary?: { total: number; completed: number; percentCompleted: number } | null;
  };
  issueTypes: Array<{ id: string; name: string; color?: string; description?: string }>;
  milestones: Array<{ number: number; title: string; state: 'OPEN' | 'CLOSED'; dueOn?: string | null }>;
  repoProjects: Array<{ id: string; number: number; title: string }>;
  projectItems: GithubProjectItemDetails[];
}

export interface ElectronAPI {
  platform?: string;
  windowState?: {
    isFullscreen: () => Promise<boolean>;
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
    setAlwaysOnTop?: (flag: boolean) => Promise<boolean>;
    isAlwaysOnTop?: () => Promise<boolean>;
  };
  pty: {
    create: (id: string, type: string, cwd: string, cols: number, rows: number, accentColor?: string, extraOptions?: any) => Promise<{ success: boolean; id?: string; title?: string; pid?: number; reused?: boolean; error?: string }>;
    writePrompt?: (id: string, prompt: string) => Promise<{ success: boolean; error?: string }>;
    runPromptInCli?: (id: string, prompt: string, timeoutMs?: number) => Promise<{ response: string; error?: string; cancelled?: boolean }>;
    cancelPrompt?: (id: string) => void;
    write: (id: string, data: string) => void;
    resize: (id: string, cols: number, rows: number) => void;
    kill: (id: string) => void;
    setCwd?: (id: string, cwd: string) => Promise<boolean>;
    setAllCwd?: (cwd: string) => Promise<{ success: boolean }>;
    setAccentColor?: (accentColor: string) => Promise<{ success: boolean; error?: string }>;
    getHistory?: (id: string) => Promise<string>;
    getHistoryWithSeq?: (id: string) => Promise<{ history: string; seq: number }>;
    foreground?: () => Promise<Record<string, string>>;
    getRunningSessions?: () => Promise<Array<{ id: string; type: string; title: string; cwd: string; isAi: boolean; isRunning: boolean; projectName: string; lastActivity?: number }>>;
    onAiCompleted?: (callback: (payload: { id: string; type: string; cwd: string; projectName: string; summary: string; needsInput?: boolean; timestamp: number }) => void) => () => void;
    onSessionStatus?: (callback: (payload: { id: string; type: string; cwd: string; isAi: boolean; isRunning: boolean; exited?: boolean }) => void) => () => void;
    onData: (callback: (payload: { id: string; data: string; seq?: number }) => void) => () => void;
    onExit: (callback: (payload: { id: string; exitCode: number }) => void) => () => void;
  };
  fs: {
    getHomeDir?: () => Promise<string>;
    getTree: (dirPath: string, depth?: number) => Promise<{ tree: any }>;
    readFile: (filePath: string) => Promise<{ content: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
    getCapabilities?: () => Promise<{ designAi: number; stockImage: boolean; tempImages: boolean; exportPdf: boolean }>;
    stockImage?: (payload: { query: string; width: number; height: number; key?: string; index?: number; people?: boolean; pexelsKey?: string }) => Promise<{ dataUrl?: string; credit?: string; source?: string; error?: string }>;
    exportPdf?: (html: string, defaultName: string) => Promise<{ path?: string; canceled?: boolean; error?: string }>;
    figmaFetch?: (token: string, apiPath: string) => Promise<{ data?: any; error?: string; status?: number }>;
    figmaDownloadImages?: (urls: Record<string, string>) => Promise<Record<string, string>>;
    saveTempImage?: (base64: string, ext?: string) => Promise<{ path: string }>;
    readFileDataUrl?: (filePath: string, maxBytes?: number) => Promise<{ dataUrl?: string; error?: string }>;
    createItem: (itemPath: string, isDirectory: boolean) => Promise<{ success: boolean }>;
    deleteItem: (itemPath: string) => Promise<{ success: boolean }>;
    renameItem: (oldPath: string, newPath: string) => Promise<{ success: boolean }>;
    copyItem: (srcPath: string, destPath: string) => Promise<{ success: boolean }>;
    getPathForFile: (file: File) => string;
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
    scanProject?: (workspacePath: string) => Promise<{ ports: Array<{ port: number; pid: string; command: string; url: string; serviceName?: string }> }>;
    kill: (pid: string | number) => Promise<{ success: boolean; error?: string }>;
  };
  roles: {
    list: () => Promise<{ id: string; name: string; color: string; instructions: string }[]>;
    create: (role: { name: string; color: string; instructions: string }) => Promise<{ id: string; name: string; color: string; instructions: string }>;
    update: (id: string, patch: Partial<{ name: string; color: string; instructions: string }>) => Promise<{ id: string; name: string; color: string; instructions: string } | null>;
    delete: (id: string) => Promise<boolean>;
  };
  designRoom: {
    host: (roomName: string, canEdit?: boolean) => Promise<{ id: string; name: string; host: string; ip: string; port: number; updatedAt: number }>;
    sendCursor: (cursor: { x: number; y: number; name: string; color: string }) => void;
    onCursor: (callback: (cursor: { id: string; x: number; y: number; name: string; color: string }) => void) => () => void;
    onPermissions: (callback: (p: { canEdit: boolean; hostName: string }) => void) => () => void;
    stopHosting: () => Promise<void>;
    startDiscovery: () => Promise<void>;
    stopDiscovery: () => Promise<void>;
    join: (ip: string, port: number) => Promise<void>;
    leave: () => Promise<void>;
    broadcastState: (shapes: unknown[]) => void;
    onRoomsUpdated: (callback: (rooms: Array<{ id: string; name: string; host: string; ip: string; port: number; updatedAt: number }>) => void) => () => void;
    onStateUpdate: (callback: (shapes: any[]) => void) => () => void;
    onViewersChanged: (callback: (count: number) => void) => () => void;
    onDisconnected: (callback: () => void) => () => void;
  };
  skills?: {
    call: (action: string, payload?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    onChanged: (callback: () => void) => () => void;
  };
  ai: {
    prompt: (prompt: string, model: string, cwd?: string, provider?: string, timeoutMs?: number) => Promise<{ response?: string; error?: string }>;
    checkClis?: () => Promise<Record<string, boolean>>;
    checkCliUpdates?: (force?: boolean) => Promise<Record<string, { hasUpdate: boolean; currentVersion?: string; latestVersion?: string; updateCommand?: string }>>;
    orchestratorProviders?: () => Promise<Array<{ id: 'claude' | 'codex' | 'antigravity'; available: boolean; version?: string }>>;
    orchestrate?: (input: { runId?: string; provider: 'claude' | 'codex' | 'antigravity'; request: string; cwd: string; model?: string; mode?: 'ask' | 'plan' | 'execute'; depth?: 'fast' | 'balanced' | 'deep'; additionalDirs?: string[]; timeoutMs?: number }) => Promise<{ stdout: string; stderr: string; exitCode: number; requestId: string; cancelled?: boolean; usage?: { input_tokens?: number; output_tokens?: number } }>;
    cancelOrchestration?: (runId: string) => Promise<{ cancelled: boolean }>;
    autonomousRun?: (input: { runId?: string; provider: 'claude' | 'codex' | 'antigravity'; cwd: string; title: string; description?: string; model?: string; projectNumber?: number; projectId?: string; itemId?: string; maxRepairCycles?: number; taskId?: string }) => Promise<{ runId: string; status: 'done' | 'review' | 'failed'; summary: string }>;
    cancelAutonomous?: (runId: string) => Promise<{ cancelled: boolean }>;
    onOrchestratorEvent?: (callback: (event: { provider: string; kind: string; message: string; timestamp_ms: number; payload: unknown; runId?: string }) => void) => () => void;
    getCommands?: (providerId: string) => Promise<Array<{ command: string; description: string; usage?: string }>>;
    getQuotas?: (force?: boolean) => Promise<Record<string, { dailyPercent: number; weeklyPercent: number; dailyResetTime: string; weeklyResetDay: string; weeklyResetTime: string }>>;
    getModels?: (providerId: string) => Promise<{ providerId: string; currentModel: string; currentModelId: string; models: Array<{ id: string; label: string; tag?: string; description?: string; legacy?: boolean }> }>;
    setModel?: (providerId: string, modelId: string) => Promise<{ success: boolean; currentModel: string; message: string }>;
    saveChatLocally?: (session: any) => Promise<{ success: boolean; jsonPath: string; mdPath: string; error?: string }>;
    exportChatDialog?: (session: any, format: 'markdown' | 'json') => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
    getSavedChats?: () => Promise<Array<{ id: string; title: string; provider: string; updatedAt: number; messageCount: number; path: string; projectName?: string; workspacePath?: string; model?: string }>>;
    loadSavedChat?: (sessionId: string) => Promise<any>;
    deleteSavedChat?: (sessionId: string) => Promise<{ success: boolean }>;
    saveTranscript?: (sessionId: string, history: any[]) => Promise<{ success: boolean; path: string }>;
    runCli?: (payload: { cliCmd: string; prompt: string; model?: string; cwd?: string; additionalDirs?: string[]; useOrchestrator?: boolean; orchestratorConfig?: any; permissions?: any; streamText?: boolean; streamId?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number; cancelled?: boolean; usage?: { input_tokens?: number; output_tokens?: number } }>;
    cancel?: (runId?: string, cwd?: string, streamId?: string) => Promise<{ cancelled: boolean }>;
    onEvent?: (callback: (event: any) => void) => () => void;
  };
  flutter?: {
    run: (runId: string, cwd: string, port: number) => Promise<{ success: boolean; error?: string }>;
    stop: (runId: string) => Promise<{ success: boolean }>;
    onEvent: (
      callback: (event:
        | { kind: 'stdout' | 'stderr'; runId: string; data: string }
        | { kind: 'ready'; runId: string; url: string }
        | { kind: 'exit'; runId: string; exitCode: number | null }
      ) => void
    ) => () => void;
  };
  capture?: {
    listWindows: (filter?: string) => Promise<Array<{ id: string; name: string }>>;
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
    scanLocalProjects?: (baseDir?: string) => Promise<Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>>;
    getIssues?: (workspacePath: string) => Promise<Array<any>>;
    createIssue?: (workspacePath: string, title: string, body?: string) => Promise<{ success: boolean; issue?: any; error?: string }>;
    clone?: (repoUrl: string, targetDir: string) => Promise<{ success: boolean; repoPath?: string; error?: string }>;
    getRecentCommitsSummary?: (options?: {
      days?: number;
      since?: string;
      until?: string;
      targetDates?: string[];
      repoPath?: string;
      author?: string;
    } | number) => Promise<
      Array<{
        projectName: string;
        repoPath: string;
        commits: Array<{
          hash: string;
          message: string;
          body?: string;
          author: string;
          date: string;
          relativeDate: string;
          isToday: boolean;
          isYesterday: boolean;
          isFriday?: boolean;
        }>;
      }>
    >;
    worktreeList?: (repoPath: string) => Promise<Array<{ path: string; branch: string; isMain: boolean }>>;
    worktreeCreate?: (repoPath: string, branchName: string, targetDir: string) => Promise<{ success: boolean; worktreePath?: string; error?: string }>;
    worktreeRemove?: (repoPath: string, worktreePath: string) => Promise<{ success: boolean; error?: string }>;
    worktreeLand?: (repoPath: string, branchName: string, baseBranch: string) => Promise<{ success: boolean; error?: string }>;
  };
  github?: {
    isAuthenticated: () => Promise<{ authenticated: boolean }>;
    getUser: () => Promise<{ success: boolean; user?: { login: string; name: string | null; avatarUrl: string; htmlUrl: string }; error?: string }>;
    logout: () => Promise<{ success: boolean }>;
    startLogin: () => Promise<{ success: boolean; userCode?: string; verificationUri?: string; expiresIn?: number; error?: string }>;
    cancelLogin: () => Promise<{ success: boolean }>;
    fetchRepos: () => Promise<{ success: boolean; repos?: any[]; error?: string }>;
    fetchProjects: () => Promise<{ success: boolean; projects?: any[]; error?: string }>;
    fetchOrgProjects: (org: string) => Promise<{ success: boolean; projects?: any[]; error?: string }>;
    fetchRepoProjects: (owner: string, repo: string) => Promise<{ success: boolean; projects?: any[]; error?: string }>;
    fetchProjectItems: (projectNumber: number, org?: string) => Promise<{ success: boolean; project?: any; error?: string }>;
    updateProjectItemStatus: (projectId: string, itemId: string, fieldId: string, optionId: string) => Promise<{ success: boolean; item?: any; error?: string }>;
    fetchIssueDetails: (owner: string, repo: string, number: number) => Promise<{ success: boolean; details?: GithubIssueDetails; error?: string }>;
    updateProjectItemField: (projectId: string, itemId: string, fieldId: string, value: Record<string, any>) => Promise<{ success: boolean; item?: any; error?: string }>;
    clearProjectItemField: (projectId: string, itemId: string, fieldId: string) => Promise<{ success: boolean; item?: any; error?: string }>;
    addIssueToProject: (projectId: string, contentId: string) => Promise<{ success: boolean; itemId?: string | null; error?: string }>;
    removeProjectItem: (projectId: string, itemId: string) => Promise<{ success: boolean; error?: string }>;
    setIssueType: (issueId: string, issueTypeId: string | null) => Promise<{ success: boolean; issueType?: { id: string; name: string; color?: string } | null; error?: string }>;
    fetchOrgs: () => Promise<{ success: boolean; orgs?: Array<{ login: string; avatarUrl: string }>; error?: string }>;
    fetchRepoIssues: (owner: string, repo: string) => Promise<{ success: boolean; issues?: any[]; error?: string }>;
    fetchRepoPulls: (owner: string, repo: string) => Promise<{ success: boolean; pulls?: any[]; error?: string }>;
    fetchRepoMilestones: (owner: string, repo: string) => Promise<{ success: boolean; milestones?: any[]; error?: string }>;
    fetchRepoReleases: (owner: string, repo: string) => Promise<{ success: boolean; releases?: any[]; error?: string }>;
    fetchRepoCollaborators: (owner: string, repo: string) => Promise<{ success: boolean; collaborators?: any[]; error?: string }>;
    createIssue: (owner: string, repo: string, input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number }) => Promise<{ success: boolean; issue?: any; error?: string }>;
    updateIssue: (
      owner: string,
      repo: string,
      issueNumber: number,
      input: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; ensureLabels?: Array<{ name: string; color: string }>; milestone?: number | null; assignees?: string[] },
    ) => Promise<{ success: boolean; issue?: any; error?: string }>;
    deleteIssue: (input: string | { nodeId?: string; owner?: string; repo?: string; issueNumber?: number }) => Promise<{ success: boolean; error?: string }>;
    lockIssue?: (owner: string, repo: string, issueNumber: number, locked: boolean) => Promise<{ success: boolean; locked?: boolean; error?: string }>;
    pinIssue?: (issueId: string, pinned: boolean) => Promise<{ success: boolean; pinned?: boolean; error?: string }>;
    setIssueSubscription?: (owner: string, repo: string, issueNumber: number, subscribed: boolean) => Promise<{ success: boolean; subscribed?: boolean; error?: string }>;
    transferIssue?: (owner: string, repo: string, issueNumber: number, newOwner: string, newRepo: string) => Promise<{ success: boolean; issue?: any; error?: string }>;
    fetchTeamInsights?: (owner: string, repo: string) => Promise<{ success: boolean; insights?: import('./components/team/teamTypes').TeamInsightsRaw; error?: string }>;
    fetchOrgTeams?: (org: string) => Promise<{ success: boolean; teams?: Array<{ id: number; slug: string; name: string; description: string }>; error?: string }>;
    fetchCollaboratorPermissions?: (owner: string, repo: string) => Promise<{ success: boolean; collaborators?: Array<{ login: string; roleName: string }>; error?: string }>;
    setCollaboratorPermission?: (owner: string, repo: string, username: string, role: string) => Promise<{ success: boolean; invited?: boolean; error?: string }>;
    removeCollaborator?: (owner: string, repo: string, username: string) => Promise<{ success: boolean; error?: string }>;
    cancelInvitation?: (owner: string, repo: string, invitationId: number) => Promise<{ success: boolean; error?: string }>;
    setTeamRepoPermission?: (org: string, teamSlug: string, owner: string, repo: string, role: string) => Promise<{ success: boolean; error?: string }>;
    removeTeamRepo?: (org: string, teamSlug: string, owner: string, repo: string) => Promise<{ success: boolean; error?: string }>;
    createTeam?: (org: string, name: string, description?: string) => Promise<{ success: boolean; team?: any; error?: string }>;
    requestReviewers?: (owner: string, repo: string, pullNumber: number, reviewers: string[]) => Promise<{ success: boolean; error?: string }>;
    submitPullReview?: (owner: string, repo: string, pullNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string) => Promise<{ success: boolean; error?: string }>;
    addAssignees?: (owner: string, repo: string, issueNumber: number, assignees: string[]) => Promise<{ success: boolean; error?: string }>;
    settings?: (action: string, payload: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    fetchIssueComments: (owner: string, repo: string, issueNumber: number) => Promise<{ success: boolean; comments?: any[]; error?: string }>;
    addIssueComment: (owner: string, repo: string, issueNumber: number, body: string) => Promise<{ success: boolean; comment?: any; error?: string }>;
    updateIssueComment: (owner: string, repo: string, commentId: number, body: string) => Promise<{ success: boolean; comment?: any; error?: string }>;
    deleteIssueComment: (owner: string, repo: string, commentId: number) => Promise<{ success: boolean; error?: string }>;
    createMilestone: (owner: string, repo: string, input: { title: string; description?: string; due_on?: string }) => Promise<{ success: boolean; milestone?: any; error?: string }>;
    updateMilestone: (owner: string, repo: string, milestoneNumber: number, input: { title?: string; description?: string; due_on?: string; state?: 'open' | 'closed' }) => Promise<{ success: boolean; milestone?: any; error?: string }>;
    deleteMilestone: (owner: string, repo: string, milestoneNumber: number) => Promise<{ success: boolean; error?: string }>;
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
