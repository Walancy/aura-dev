export interface ElectronAPI {
  windowState?: {
    isFullscreen: () => Promise<boolean>;
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
  };
  pty: {
    create: (id: string, type: string, cwd: string, cols: number, rows: number) => Promise<{ success: boolean; id?: string; title?: string; pid?: number; error?: string }>;
    write: (id: string, data: string) => void;
    resize: (id: string, cols: number, rows: number) => void;
    kill: (id: string) => void;
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
  ai: {
    prompt: (prompt: string, model: string, cwd?: string) => Promise<{ response: string }>;
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
    exec: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error: string | null; exitCode: number }>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
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

