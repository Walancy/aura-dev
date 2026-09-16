import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FileNode[];
}

export class NativeFileSystemService {
  getTree(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): FileNode[] {
    if (!fs.existsSync(dirPath)) return [];
    if (currentDepth > maxDepth) return [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === '.turbo' ||
          entry.name === 'dist' ||
          entry.name === '.next' ||
          entry.name === '.DS_Store'
        ) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const isDir = entry.isDirectory();

        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          isDirectory: isDir,
          extension: isDir ? undefined : path.extname(entry.name).toLowerCase(),
        };

        if (isDir) {
          if (currentDepth < maxDepth) {
            node.children = this.getTree(fullPath, maxDepth, currentDepth + 1);
          } else {
            node.children = [];
          }
        } else {
          try {
            const stat = fs.statSync(fullPath);
            node.size = stat.size;
          } catch {
            // ignore
          }
        }

        nodes.push(node);
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.warn(`[Native FS] Error reading ${dirPath}:`, err);
      return [];
    }
  }

  readFile(filePath: string): { content: string; size: number } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    return { content, size: stat.size };
  }

  writeFile(filePath: string, content: string): void {
    const parent = path.dirname(filePath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }

  createItem(itemPath: string, isDirectory: boolean): void {
    const parent = path.dirname(itemPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    if (isDirectory) {
      fs.mkdirSync(itemPath, { recursive: true });
    } else {
      fs.writeFileSync(itemPath, '', 'utf8');
    }
  }

  deleteItem(targetPath: string): void {
    if (!fs.existsSync(targetPath)) return;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }
}
