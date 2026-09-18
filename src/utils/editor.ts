// Document Symbol definition for Outline (VS Code & Antigravity Style)
export interface DocumentSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'method';
  line: number;
  badge: string;
  color: string;
}

export function extractDocumentSymbols(content: string, _language?: string): DocumentSymbol[] {
  if (!content) return [];
  const lines = content.split('\n');
  const symbols: DocumentSymbol[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // 1. Classes & Interfaces & Types
    let match = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`class-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'class', line: i + 1, badge: 'C', color: '#fb923c' });
      seen.add(`class-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`interface-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'interface', line: i + 1, badge: 'I', color: '#60a5fa' });
      seen.add(`interface-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
    if (match && !seen.has(`type-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'type', line: i + 1, badge: 'T', color: '#facc15' });
      seen.add(`type-${match[1]}`);
      continue;
    }

    // 2. Functions (regular and arrow)
    match = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*|\s+)([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*:\s*React\.FC/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    // 3. Methods inside class or object
    match = trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
    if (match && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(match[1]) && !seen.has(`method-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'method', line: i + 1, badge: 'm', color: '#a78bfa' });
      seen.add(`method-${match[1]}`);
      continue;
    }

    // 4. Variables & Constants
    match = trimmed.match(/^(?:export\s+)?const\s+([A-Z0-9_$]{2,})\s*=/);
    if (match && !seen.has(`const-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'constant', line: i + 1, badge: 'k', color: '#4ade80' });
      seen.add(`const-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/);
    if (match && !seen.has(`var-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'variable', line: i + 1, badge: 'v', color: '#38bdf8' });
      seen.add(`var-${match[1]}`);
      continue;
    }

    // Python functions / classes
    match = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
    if (match && !seen.has(`pyfunc-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`pyfunc-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
    if (match && !seen.has(`pyclass-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'class', line: i + 1, badge: 'C', color: '#fb923c' });
      seen.add(`pyclass-${match[1]}`);
      continue;
    }

    // Rust / Go
    match = trimmed.match(/^(?:pub\s+)?fn\s+([A-Za-z0-9_]+)/);
    if (match && !seen.has(`rsfn-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`rsfn-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
    if (match && !seen.has(`gofunc-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`gofunc-${match[1]}`);
      continue;
    }
  }

  return symbols;
}

export function getFileLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'sh':
    case 'zsh':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}

export function isMarkdownFile(fileName: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(fileName);
}
