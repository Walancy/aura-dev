import * as fs from 'node:fs';
import * as path from 'node:path';
import { dialog, BrowserWindow } from 'electron';

export interface ChatMessageItem {
  id?: string;
  role: 'user' | 'assistant';
  type?: string;
  text: string;
  timestamp?: number;
  providerId?: string;
  model?: string;
  diff?: any;
  command?: string;
  attachedFiles?: any[];
  attachedImages?: any[];
}

export interface ChatSessionContext {
  workspacePath?: string;
  projectName?: string;
  currentBranch?: string;
  activeFilePath?: string;
  openTabs?: string[];
  systemInfo?: string;
  provider?: string;
  model?: string;
}

export interface SavedChatSession {
  id: string;
  title: string;
  provider: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  context?: ChatSessionContext;
  history: ChatMessageItem[];
}

export class ChatHistoryService {
  private getStorageDir(): string {
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    const dir = path.join(userHome, '.devflow', 'chats');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9à-úÀ-Ú_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50);
  }

  public async saveSessionLocally(session: SavedChatSession): Promise<{ success: boolean; jsonPath: string; mdPath: string; error?: string }> {
    try {
      const storageDir = this.getStorageDir();
      const safeTitle = this.sanitizeFilename(session.title || 'conversa');
      const filenameBase = `${session.id}_${safeTitle}`;
      const jsonPath = path.join(storageDir, `${filenameBase}.json`);
      const mdPath = path.join(storageDir, `${filenameBase}.md`);

      // 1. Save complete JSON structure
      const payload: SavedChatSession = {
        ...session,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

      // 2. Also generate human-readable Markdown with full context
      const mdContent = this.generateMarkdown(payload);
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      // 3. If workspace has .devflow/chats, optionally replicate there too
      if (session.context?.workspacePath && fs.existsSync(session.context.workspacePath)) {
        try {
          const workspaceChatsDir = path.join(session.context.workspacePath, '.devflow', 'chats');
          if (!fs.existsSync(workspaceChatsDir)) {
            fs.mkdirSync(workspaceChatsDir, { recursive: true });
          }
          fs.writeFileSync(path.join(workspaceChatsDir, `${filenameBase}.json`), JSON.stringify(payload, null, 2), 'utf8');
          fs.writeFileSync(path.join(workspaceChatsDir, `${filenameBase}.md`), mdContent, 'utf8');
        } catch {}
      }

      return { success: true, jsonPath, mdPath };
    } catch (err: any) {
      console.error('[ChatHistoryService] Failed to save session:', err);
      return { success: false, jsonPath: '', mdPath: '', error: err.message };
    }
  }

  public generateMarkdown(session: SavedChatSession): string {
    const ctx = session.context || {};
    const createdDate = new Date(session.createdAt || session.updatedAt || Date.now()).toLocaleString('pt-BR');
    const updatedDate = new Date(session.updatedAt || Date.now()).toLocaleString('pt-BR');

    let md = `# Histórico de Conversa com IA: ${session.title || 'Conversa'}\n\n`;
    md += `> **Criado em:** ${createdDate} | **Atualizado:** ${updatedDate}\n\n`;

    md += `## Contexto da Sessão\n`;
    md += `- **IA Provedor:** \`${session.provider || 'desconhecido'}\`\n`;
    if (session.model || ctx.model) {
      md += `- **Modelo Utilizado:** \`${session.model || ctx.model}\`\n`;
    }
    if (ctx.projectName) {
      md += `- **Projeto:** ${ctx.projectName}\n`;
    }
    if (ctx.workspacePath) {
      md += `- **Diretório do Workspace:** \`${ctx.workspacePath}\`\n`;
    }
    if (ctx.currentBranch) {
      md += `- **Branch Git:** \`${ctx.currentBranch}\`\n`;
    }
    if (ctx.activeFilePath) {
      md += `- **Arquivo em Foco:** \`${ctx.activeFilePath}\`\n`;
    }
    if (ctx.openTabs && ctx.openTabs.length > 0) {
      md += `- **Arquivos Abertos no Editor:** ${ctx.openTabs.map((t) => `\`${t}\``).join(', ')}\n`;
    }

    md += `\n---\n\n## Mensagens\n\n`;

    const msgs = session.history || [];
    if (msgs.length === 0) {
      md += `*Nenhuma mensagem registrada nesta sessão.*\n`;
    } else {
      msgs.forEach((msg, idx) => {
        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR') : '';
        const roleName = msg.role === 'user' ? 'Usuário' : `Assistente (${msg.providerId || session.provider || 'IA'})`;

        md += `### ${roleName} ${timeStr ? `[${timeStr}]` : ''}\n\n`;
        md += `${msg.text || ''}\n\n`;

        if (msg.diff) {
          md += `\`\`\`diff\n${typeof msg.diff === 'string' ? msg.diff : JSON.stringify(msg.diff, null, 2)}\n\`\`\`\n\n`;
        }

        if (idx < msgs.length - 1) {
          md += `---\n\n`;
        }
      });
    }

    return md;
  }

  public async exportSessionDialog(
    session: SavedChatSession,
    format: 'markdown' | 'json',
    window?: BrowserWindow | null
  ): Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }> {
    try {
      const ext = format === 'markdown' ? 'md' : 'json';
      const safeTitle = this.sanitizeFilename(session.title || 'conversa');
      const defaultFilename = `Chat-${session.provider || 'ia'}-${safeTitle}.${ext}`;

      const res = await dialog.showSaveDialog(window || undefined as any, {
        title: `Exportar Histórico (${format === 'markdown' ? 'Markdown' : 'JSON'})`,
        defaultPath: defaultFilename,
        filters: [
          format === 'markdown'
            ? { name: 'Markdown (*.md)', extensions: ['md', 'markdown'] }
            : { name: 'JSON (*.json)', extensions: ['json'] },
          { name: 'Todos os Arquivos', extensions: ['*'] },
        ],
      });

      if (res.canceled || !res.filePath) {
        return { success: false, canceled: true };
      }

      const content = format === 'markdown' ? this.generateMarkdown(session) : JSON.stringify(session, null, 2);
      fs.writeFileSync(res.filePath, content, 'utf8');

      return { success: true, filePath: res.filePath };
    } catch (err: any) {
      console.error('[ChatHistoryService] Export dialog failed:', err);
      return { success: false, error: err.message };
    }
  }

  public async listSavedSessions(): Promise<Array<{ id: string; title: string; provider: string; updatedAt: number; messageCount: number; path: string }>> {
    try {
      const storageDir = this.getStorageDir();
      const files = fs.readdirSync(storageDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const results = [];
      for (const file of jsonFiles) {
        try {
          const fullPath = path.join(storageDir, file);
          const raw = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(raw);
            results.push({
              id: data.id || file.replace('.json', ''),
              title: data.title || 'Conversa',
              provider: data.provider || 'antigravity',
              updatedAt: data.updatedAt || fs.statSync(fullPath).mtimeMs,
              messageCount: Array.isArray(data.history) ? data.history.length : 0,
              path: fullPath,
              projectName: data.context?.projectName || '',
              workspacePath: data.context?.workspacePath || '',
              model: data.model || '',
            });
        } catch {}
      }

      results.sort((a, b) => b.updatedAt - a.updatedAt);
      return results;
    } catch (err) {
      console.error('[ChatHistoryService] Failed to list sessions:', err);
      return [];
    }
  }

  public async loadSession(sessionId: string): Promise<SavedChatSession | null> {
    try {
      const storageDir = this.getStorageDir();
      const files = fs.readdirSync(storageDir);
      const target = files.find((f) => f.startsWith(`${sessionId}_`) || f === `${sessionId}.json`);
      if (!target) return null;

      const raw = fs.readFileSync(path.join(storageDir, target), 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[ChatHistoryService] Failed to load session:', err);
      return null;
    }
  }

  public async deleteSession(sessionId: string): Promise<{ success: boolean }> {
    try {
      const storageDir = this.getStorageDir();
      const files = fs.readdirSync(storageDir);
      const targets = files.filter((f) => f.startsWith(`${sessionId}_`) || f.startsWith(`${sessionId}.`));
      for (const t of targets) {
        fs.unlinkSync(path.join(storageDir, t));
      }
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }
}

export const chatHistoryService = new ChatHistoryService();
