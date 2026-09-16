import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  gitBranch?: string;
  gitStatus?: string;
  lastActive: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  tags: string[];
  sprint: string;
}

export class NativeProjectsService {
  private projects: Project[] = [
    {
      id: 'ainaobra',
      name: 'Ainaobra Monorepo',
      path: '/Users/walancy/Documents/codes/ainaobra',
      description: 'Plataforma Ainaobra (painel web, wireframe, backend NestJS, supabase)',
      lastActive: new Date().toISOString(),
    },
    {
      id: 'devflow-desktop',
      name: 'DevFlow Desktop App',
      path: '/Users/walancy/Documents/codes/devflow-desktop',
      description: 'Aplicativo Desktop Nativo com IDE e CLIs de IA integrados',
      lastActive: new Date().toISOString(),
    },
  ];

  private activeProjectId: string = 'ainaobra';

  private tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Integrar Claude Code CLI no Terminal Nativo',
      description: 'Execução direta do binário oficial via C++ node-pty e IPC',
      status: 'done',
      priority: 'urgent',
      assignee: 'Walancy',
      tags: ['Native', 'AI', 'CLI'],
      sprint: 'Sprint 2',
    },
    {
      id: 'task-2',
      title: 'Integrar Antigravity CLI (AGY)',
      description: 'Ponte com comandos slash e automações no terminal',
      status: 'done',
      priority: 'high',
      assignee: 'Walancy',
      tags: ['AGY', 'Terminal'],
      sprint: 'Sprint 2',
    },
    {
      id: 'task-3',
      title: 'Editor Monaco Integrado ao File System',
      description: 'Suporte a tabs, syntax highlighting e gravação automática',
      status: 'in_progress',
      priority: 'high',
      assignee: 'Walancy',
      tags: ['IDE', 'Monaco'],
      sprint: 'Sprint 2',
    },
  ];

  getProjects(): Project[] {
    return this.projects.map((p) => {
      let branch = 'main';
      let status = '';
      if (fs.existsSync(p.path)) {
        try {
          branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: p.path,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          }).trim();
          status = execSync('git status --short', {
            cwd: p.path,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          }).trim();
        } catch {
          // ignore
        }
      }
      return {
        ...p,
        gitBranch: branch,
        gitStatus: status ? `${status.split('\n').length} modified` : 'Clean',
      };
    });
  }

  getActiveProject(): Project {
    const found = this.projects.find((p) => p.id === this.activeProjectId);
    return found || this.projects[0];
  }

  selectProject(id: string): Project {
    const found = this.projects.find((p) => p.id === id);
    if (!found) throw new Error(`Project ${id} not found`);
    this.activeProjectId = id;
    found.lastActive = new Date().toISOString();
    return found;
  }

  addProject(name: string, projectPath: string, description: string = ''): Project {
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existing = this.projects.find((p) => p.id === id);
    if (existing) return existing;
    const p: Project = {
      id,
      name,
      path: projectPath,
      description,
      lastActive: new Date().toISOString(),
    };
    this.projects.push(p);
    return p;
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  updateTaskStatus(taskId: string, status: Task['status']): Task {
    const t = this.tasks.find((task) => task.id === taskId);
    if (!t) throw new Error('Task not found');
    t.status = status;
    return t;
  }
}
