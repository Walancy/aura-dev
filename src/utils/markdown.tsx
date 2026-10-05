import React from 'react';
import { CircleDot, CheckCircle2, Check, MoreHorizontal } from 'lucide-react';

// Lightweight, dependency-free Markdown -> JSX renderer
export function renderInlineMarkdown(text: string, keyPrefix: string, accentColor: string, isEffectiveDark?: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-${idx++}`}
          style={{
            background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            padding: '2px 6px',
            borderRadius: 6,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: '0.88em',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-${idx++}`} style={{ fontWeight: 600 }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      parts.push(
        m ? (
          <a key={`${keyPrefix}-${idx++}`} href={m[2]} target="_blank" rel="noreferrer" style={{ color: accentColor, textDecoration: 'none' }}>
            {m[1]}
          </a>
        ) : (
          token
        )
      );
    } else if (token.startsWith('*')) {
      parts.push(<em key={`${keyPrefix}-${idx++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function renderMarkdownPreview(
  md: string,
  opts: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accentColor: string;
    isEffectiveDark: boolean;
    onToggleTask?: (lineIndex: number, completed: boolean) => void;
    fontSize?: number;
    regularFont?: boolean;
  }
): React.ReactNode {
  if (!md || !md.trim()) {
    return <div style={{ color: opts.textMuted, fontSize: opts.fontSize || 13, fontStyle: 'italic', padding: 20 }}>Arquivo Markdown vazio.</div>;
  }

  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          style={{
            background: opts.isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${opts.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            overflowX: 'auto',
            fontSize: opts.fontSize ? Math.max(11, opts.fontSize - 1) : 12.5,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            color: opts.textPrimary,
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      if (lang) {
        // no-op: language currently unused (no syntax highlighting in the lightweight preview)
      }
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} style={{ border: 'none', borderTop: `1px solid ${opts.border}`, margin: '14px 0' }} />);
      i++;
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const baseSizes: Record<number, number> = opts.fontSize
        ? { 1: Math.round(opts.fontSize * 1.35), 2: Math.round(opts.fontSize * 1.2), 3: Math.round(opts.fontSize * 1.1), 4: opts.fontSize }
        : { 1: 24, 2: 19, 3: 16, 4: 14 };
      blocks.push(
        React.createElement(
          `h${level}`,
          {
            key: key++,
            style: {
              fontSize: baseSizes[level],
              fontWeight: opts.regularFont ? 500 : 600,
              color: opts.textPrimary,
              margin: level <= 2 ? '16px 0 8px' : '10px 0 4px',
              borderBottom: level <= 2 ? `1px solid ${opts.border}` : 'none',
              paddingBottom: level <= 2 ? 4 : 0,
            },
          },
          renderInlineMarkdown(headerMatch[2], `h${key}`, opts.accentColor, opts.isEffectiveDark)
        )
      );
      i++;
      continue;
    }

    // Blockquote (consume consecutive lines)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          style={{
            margin: 0,
            padding: '4px 14px',
            borderLeft: `3px solid ${opts.accentColor}`,
            color: opts.textSecondary,
            fontStyle: 'italic',
          }}
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>{renderInlineMarkdown(ql, `bq${key}-${qi}`, opts.accentColor, opts.isEffectiveDark)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Task list / Checklist items: - [ ] or - [x]
    if (/^[-*]\s+\[([ xX])\]/.test(trimmed)) {
      const taskItems: Array<{ lineIndex: number; completed: boolean; text: string }> = [];
      while (i < lines.length && /^[-*]\s+\[([ xX])\]/.test(lines[i].trim())) {
        const lineIdx = i;
        const m = lines[i].trim().match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
        if (m) {
          taskItems.push({
            lineIndex: lineIdx,
            completed: m[1].toLowerCase() === 'x',
            text: m[2],
          });
        }
        i++;
      }

      blocks.push(
        <div key={key++} style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '6px 0' }}>
          {taskItems.map((item, itemIdx) => {
            const isIssueRef = /#\d+/.test(item.text);
            return (
              <div
                key={itemIdx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  transition: 'background 0.12s ease',
                  cursor: opts.onToggleTask ? 'pointer' : 'default',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = opts.isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                  const btn = e.currentTarget.querySelector('.task-row-more') as HTMLElement;
                  if (btn) btn.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  const btn = e.currentTarget.querySelector('.task-row-more') as HTMLElement;
                  if (btn) btn.style.opacity = '0';
                }}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    opts.onToggleTask?.(item.lineIndex, item.completed);
                  }}
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
                    border: item.completed
                      ? 'none'
                      : `1px solid ${opts.isEffectiveDark ? '#484f58' : '#d0d7de'}`,
                    background: item.completed
                      ? (opts.accentColor || '#1f6feb')
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.completed && <Check size={11} color="#ffffff" strokeWidth={3} />}
                </div>

                {/* Status icon (CircleDot for open, CheckCircle2 for closed) */}
                {isIssueRef && (
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {item.completed ? (
                      <CheckCircle2 size={14} color="#8957e5" strokeWidth={2.2} />
                    ) : (
                      <CircleDot size={14} color="#3fb950" strokeWidth={2.2} />
                    )}
                  </div>
                )}

                {/* Text Content */}
                <div
                  onClick={() => opts.onToggleTask?.(item.lineIndex, item.completed)}
                  style={{
                    fontSize: opts.fontSize || 13.5,
                    fontWeight: opts.regularFont ? 400 : undefined,
                    color: item.completed ? opts.textSecondary : opts.textPrimary,
                    textDecoration: item.completed ? 'line-through' : 'none',
                    lineHeight: 1.4,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {renderInlineMarkdown(item.text, `task-${key}-${itemIdx}`, opts.accentColor, opts.isEffectiveDark)}
                </div>

                {/* Action button */}
                <div
                  className="task-row-more"
                  style={{
                    opacity: 0,
                    transition: 'opacity 0.15s ease',
                    color: opts.textSecondary,
                    padding: '2px 4px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MoreHorizontal size={14} />
                </div>
              </div>
            );
          })}
        </div>
      );
      continue;
    }

    // Unordered list (consume consecutive items)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim()) && !/^[-*]\s+\[([ xX])\]/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ color: opts.textPrimary, fontSize: opts.fontSize || 13.5, fontWeight: opts.regularFont ? 400 : undefined, lineHeight: 1.55 }}>
              {renderInlineMarkdown(it, `ul${key}-${ii}`, opts.accentColor, opts.isEffectiveDark)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (consume consecutive items)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ color: opts.textPrimary, fontSize: opts.fontSize || 13.5, fontWeight: opts.regularFont ? 400 : undefined, lineHeight: 1.55 }}>
              {renderInlineMarkdown(it, `ol${key}-${ii}`, opts.accentColor, opts.isEffectiveDark)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (!trimmed) {
      blocks.push(<div key={key++} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Paragraph (consume consecutive non-blank plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```')
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} style={{ color: opts.textPrimary, margin: '4px 0', fontSize: opts.fontSize || 14, fontWeight: opts.regularFont ? 400 : undefined, lineHeight: 1.6 }}>
        {renderInlineMarkdown(paraLines.join(' '), `p${key}`, opts.accentColor, opts.isEffectiveDark)}
      </p>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{blocks}</div>;
}
