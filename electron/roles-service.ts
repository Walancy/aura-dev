import * as path from 'node:path';
import * as fs from 'node:fs';
import { app } from 'electron';

export interface AgentRole {
  id: string;
  name: string;
  color: string;
  instructions: string;
}

export class RolesService {
  private roles: Map<string, AgentRole> = new Map();
  private filePath: string;

  constructor() {
    const userData = app?.getPath ? app.getPath('userData') : (process.env.HOME || '');
    this.filePath = path.join(userData, 'orchestration_roles.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed: AgentRole[] = JSON.parse(raw);
        for (const role of parsed) this.roles.set(role.id, role);
      }
    } catch {}
    if (this.roles.size === 0) {
      this.seedDefaultRoles();
    }
  }

  private seedDefaultRoles() {
    const defaultRoles: AgentRole[] = [
      {
        id: 'role-dev-lead',
        name: 'Desenvolvedor Fullstack',
        color: '#6366f1',
        instructions: 'Atue como Desenvolvedor Fullstack. Escreva código limpo e modular. Por padrão, verifique sempre se o projeto possui o "portless" da Vercel instalado; se não possuir, instale no projeto (ex: bun add -d portless ou npm i -D portless) e execute com portless para gerar a URL .localhost antes de abrir no navegador.',
      },
      {
        id: 'role-reviewer',
        name: 'Revisor de Código',
        color: '#10b981',
        instructions: 'Atue como Revisor de Código. Analise requisitos, integridade das dependências e garanta a conformidade com o Portless da Vercel para execução local estável antes de direcionar ao navegador.',
      },
      {
        id: 'role-qa-tester',
        name: 'Engenheiro de QA',
        color: '#f59e0b',
        instructions: 'Valide funcionalidades e comportamento da aplicação. Antes de abrir ou recomendar abrir a aplicação no navegador, confirme se o projeto possui e executa com o portless da Vercel para isolar o ambiente local sem colisões de porta.',
      },
    ];
    for (const r of defaultRoles) {
      this.roles.set(r.id, r);
    }
    this.save();
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(Array.from(this.roles.values()), null, 2), 'utf8');
    } catch {}
  }

  list(): AgentRole[] {
    return Array.from(this.roles.values());
  }

  create(role: Omit<AgentRole, 'id'>): AgentRole {
    const id = `role-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newRole: AgentRole = { id, ...role };
    this.roles.set(id, newRole);
    this.save();
    return newRole;
  }

  update(id: string, patch: Partial<Omit<AgentRole, 'id'>>): AgentRole | null {
    const existing = this.roles.get(id);
    if (!existing) return null;
    const updated: AgentRole = { ...existing, ...patch };
    this.roles.set(id, updated);
    this.save();
    return updated;
  }

  delete(id: string): boolean {
    const existed = this.roles.delete(id);
    if (existed) this.save();
    return existed;
  }
}

export const rolesService = new RolesService();
