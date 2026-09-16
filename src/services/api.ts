import { Project, Task, FileNode, OpenPort } from '../types';

// Check if running inside Electron desktop container
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

export const api = {
  // Projects
  async getProjects(): Promise<{ projects: Project[]; activeProject: Project }> {
    if (isElectron) {
      return (window as any).electronAPI.projects.getProjects();
    }
    const res = await fetch('/api/projects');
    return res.json();
  },

  async selectProject(id: string): Promise<{ success: boolean; project: Project }> {
    if (isElectron) {
      const project = await (window as any).electronAPI.projects.selectProject(id);
      return { success: true, project };
    }
    const res = await fetch('/api/projects/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.json();
  },

  async addProject(name: string, path: string, description: string): Promise<{ success: boolean; project: Project }> {
    if (isElectron) {
      const project = await (window as any).electronAPI.projects.addProject(name, path, description);
      return { success: true, project };
    }
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path, description }),
    });
    return res.json();
  },

  // Tasks
  async getTasks(): Promise<{ tasks: Task[] }> {
    if (isElectron) {
      return (window as any).electronAPI.projects.getTasks();
    }
    const res = await fetch('/api/tasks');
    return res.json();
  },

  async updateTaskStatus(id: string, status: Task['status']): Promise<{ success: boolean; task: Task }> {
    if (isElectron) {
      const task = await (window as any).electronAPI.projects.updateTaskStatus(id, status);
      return { success: true, task };
    }
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // File System
  async getTree(dirPath?: string): Promise<{ root: string; tree: FileNode[] }> {
    if (isElectron) {
      const tree = await (window as any).electronAPI.fs.getTree(dirPath);
      return { root: dirPath || '', tree };
    }
    const url = dirPath ? `/api/fs/tree?path=${encodeURIComponent(dirPath)}` : '/api/fs/tree';
    const res = await fetch(url);
    return res.json();
  },

  async readFile(filePath: string): Promise<{ content: string; size: number }> {
    if (isElectron) {
      return (window as any).electronAPI.fs.readFile(filePath);
    }
    const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
    return res.json();
  },

  async writeFile(filePath: string, content: string): Promise<{ success: boolean }> {
    if (isElectron) {
      return (window as any).electronAPI.fs.writeFile(filePath, content);
    }
    const res = await fetch('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    return res.json();
  },

  async createItem(itemPath: string, isDirectory: boolean): Promise<{ success: boolean }> {
    if (isElectron) {
      return (window as any).electronAPI.fs.createItem(itemPath, isDirectory);
    }
    const res = await fetch('/api/fs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath, isDirectory }),
    });
    return res.json();
  },

  async deleteItem(itemPath: string): Promise<{ success: boolean }> {
    if (isElectron) {
      return (window as any).electronAPI.fs.deleteItem(itemPath);
    }
    const res = await fetch('/api/fs/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath }),
    });
    return res.json();
  },

  // Ports
  async getPorts(): Promise<{ ports: OpenPort[] }> {
    if (isElectron) {
      return (window as any).electronAPI.ports.scan();
    }
    const res = await fetch('/api/ports');
    return res.json();
  },

  // AI Chat
  async sendAiPrompt(prompt: string, model: string, cwd?: string): Promise<{ response: string }> {
    if (isElectron) {
      return (window as any).electronAPI.ai.prompt(prompt, model, cwd);
    }
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, cwd }),
    });
    return res.json();
  },
};
