import React from 'react';
import { CircleDot, CheckCircle2, Check, MoreHorizontal } from 'lucide-react';

// Lightweight, dependency-free Markdown -> JSX renderer
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (trimmed[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += trimmed[i];
    }
  }
  cells.push(cur.trim());
  return cells;
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes('|') || !t.includes('-')) return false;
  const cells = splitTableRow(t);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function openExternalHref(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href) return;
  const shell = (window as any)?.electronAPI?.shell;
  if (shell?.openExternal && /^https?:\/\//i.test(href)) {
    e.preventDefault();
    shell.openExternal(href);
  }
}

export function renderInlineMarkdown(text: string, keyPrefix: string, accentColor: string, isEffectiveDark?: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // tags de HTML sem equivalente aqui (<picture>/<source> do Vercel, <relative-time> do GitHub...): fica só o conteúdo, a <img> de dentro continua valendo
  const cleaned = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(?:picture|source|relative-time|time|span|p|div|center)\b[^>]*>/gi, '');
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))|(<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>)|(<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>)|(<br\s*\/?>)|(<sup>([\s\S]*?)<\/sup>)|(<sub>([\s\S]*?)<\/sub>)|(<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>)|(<(?:em|i)>([\s\S]*?)<\/(?:em|i)>)|(<code>([\s\S]*?)<\/code>)/gi;
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cleaned))) {
    if (match.index > lastIndex) parts.push(cleaned.slice(lastIndex, match.index));
    const token = match[0];
    if (match[1]) {
      parts.push(
        <code
          key={`${keyPrefix}-${idx++}`}
          style={{
            background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            padding: '2px 6px',
            borderRadius: 5,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: '0.88em',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      parts.push(
        <strong key={`${keyPrefix}-${idx++}`} style={{ fontWeight: 500 }}>
          {renderInlineMarkdown(token.slice(2, -2), `${keyPrefix}-b${idx}`, accentColor, isEffectiveDark)}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={`${keyPrefix}-${idx++}`}>
          {renderInlineMarkdown(token.slice(1, -1), `${keyPrefix}-i${idx}`, accentColor, isEffectiveDark)}
        </em>,
      );
    } else if (match[4]) {
      const m = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (m) {
        parts.push(
          <img
            key={`${keyPrefix}-${idx++}`}
            src={m[2]}
            alt={m[1]}
            style={{ maxHeight: 18, maxWidth: '100%', verticalAlign: 'middle', display: 'inline-block', marginRight: 4, borderRadius: 3 }}
          />,
        );
      } else {
        parts.push(token);
      }
    } else if (match[5]) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      parts.push(
        m ? (
          <a
            key={`${keyPrefix}-${idx++}`}
            href={m[2]}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => openExternalHref(e, m[2])}
            style={{ color: accentColor, textDecoration: 'none' }}
          >
            {renderInlineMarkdown(m[1], `${keyPrefix}-l${idx}`, accentColor, isEffectiveDark)}
          </a>
        ) : (
          token
        ),
      );
    } else if (match[6]) {
      const href = match[7];
      const inner = match[8];
      parts.push(
        <a
          key={`${keyPrefix}-${idx++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => openExternalHref(e, href)}
          style={{ color: accentColor, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {renderInlineMarkdown(inner, `${keyPrefix}-ha${idx}`, accentColor, isEffectiveDark)}
        </a>,
      );
    } else if (match[9]) {
      const src = match[10];
      const altMatch = token.match(/alt=["']([^"']*)["']/i);
      const widthMatch = token.match(/width=["']?(\d+)["']?/i);
      const heightMatch = token.match(/height=["']?(\d+)["']?/i);
      const w = widthMatch ? Math.min(Number(widthMatch[1]), 240) : undefined;
      const h = heightMatch ? Math.min(Number(heightMatch[1]), 48) : 14;
      parts.push(
        <img
          key={`${keyPrefix}-${idx++}`}
          src={src}
          alt={altMatch ? altMatch[1] : ''}
          style={{ width: w, height: h, objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block', marginRight: 4 }}
        />,
      );
    } else if (match[11]) {
      parts.push(<br key={`${keyPrefix}-${idx++}`} />);
    } else if (match[12]) {
      parts.push(
        <sup key={`${keyPrefix}-${idx++}`} style={{ fontSize: '0.85em', lineHeight: 1 }}>
          {renderInlineMarkdown(match[13], `${keyPrefix}-sup${idx}`, accentColor, isEffectiveDark)}
        </sup>,
      );
    } else if (match[14]) {
      parts.push(
        <sub key={`${keyPrefix}-${idx++}`} style={{ fontSize: '0.85em', lineHeight: 1 }}>
          {renderInlineMarkdown(match[15], `${keyPrefix}-sub${idx}`, accentColor, isEffectiveDark)}
        </sub>,
      );
    } else if (match[16]) {
      parts.push(
        <strong key={`${keyPrefix}-${idx++}`} style={{ fontWeight: 500 }}>
          {renderInlineMarkdown(match[17], `${keyPrefix}-hb${idx}`, accentColor, isEffectiveDark)}
        </strong>,
      );
    } else if (match[18]) {
      parts.push(
        <em key={`${keyPrefix}-${idx++}`}>
          {renderInlineMarkdown(match[19], `${keyPrefix}-hi${idx}`, accentColor, isEffectiveDark)}
        </em>,
      );
    } else if (match[20]) {
      parts.push(
        <code
          key={`${keyPrefix}-${idx++}`}
          style={{
            background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            padding: '2px 6px',
            borderRadius: 5,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: '0.88em',
          }}
        >
          {match[21]}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < cleaned.length) parts.push(cleaned.slice(lastIndex));
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

  const lines = md
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip Markdown link reference definitions, e.g. [vc]: #AZIq... or [id]: https://...
    if (/^\[[^\]]+\]:\s*\S+.*$/.test(trimmed)) {
      i++;
      continue;
    }

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
      blocks.push(<hr key={key++} style={{ border: 'none', borderTop: `1px solid ${opts.border}`, margin: '4px 0' }} />);
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
              margin: level <= 2 ? '8px 0 0' : '4px 0 0',
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
        <div key={key++} style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: 0 }}>
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
        <ul key={key++} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        <ol key={key++} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ color: opts.textPrimary, fontSize: opts.fontSize || 13.5, fontWeight: opts.regularFont ? 400 : undefined, lineHeight: 1.55 }}>
              {renderInlineMarkdown(it, `ol${key}-${ii}`, opts.accentColor, opts.isEffectiveDark)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // GFM Markdown table
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const headers = splitTableRow(trimmed);
      const aligns = splitTableRow(lines[i + 1]).map((cell): 'left' | 'center' | 'right' => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].trim().includes('|') && !/^\[[^\]]+\]:\s*\S+/.test(lines[i].trim())) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const tableKey = key++;
      blocks.push(
        <div
          key={tableKey}
          style={{
            overflowX: 'auto',
            margin: 0,
            borderRadius: 8,
            background: opts.isEffectiveDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: opts.fontSize ? Math.max(11.5, opts.fontSize - 0.5) : 12.5,
              color: opts.textPrimary,
            }}
          >
            <thead>
              <tr style={{ background: opts.isEffectiveDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)', borderBottom: `1px solid ${opts.border}` }}>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    style={{
                      textAlign: aligns[hi] || 'left',
                      padding: '8px 12px',
                      fontWeight: opts.regularFont ? 400 : 500,
                      color: opts.textSecondary,
                      borderRight: hi < headers.length - 1 ? `1px solid ${opts.border}` : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderInlineMarkdown(h, `th-${tableKey}-${hi}`, opts.accentColor, opts.isEffectiveDark)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={{ borderTop: ri > 0 ? `1px solid ${opts.border}` : 'none' }}>
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      style={{
                        textAlign: aligns[ci] || 'left',
                        padding: '8px 12px',
                        fontWeight: opts.regularFont ? 400 : undefined,
                        color: opts.textPrimary,
                        borderRight: ci < headers.length - 1 ? `1px solid ${opts.border}` : 'none',
                        verticalAlign: 'middle',
                      }}
                    >
                      {renderInlineMarkdown(r[ci] || '', `td-${tableKey}-${ri}-${ci}`, opts.accentColor, opts.isEffectiveDark)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blank line
    if (!trimmed) {
      i++; // o espaço entre blocos vem do gap do container

      continue;
    }

    // Paragraph (consume consecutive non-blank plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\[[^\]]+\]:\s*\S+.*$/.test(lines[i].trim()) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} style={{ color: opts.textPrimary, margin: 0, fontSize: opts.fontSize || 14, fontWeight: opts.regularFont ? 400 : undefined, lineHeight: 1.6 }}>
        {renderInlineMarkdown(paraLines.join(' '), `p${key}`, opts.accentColor, opts.isEffectiveDark)}
      </p>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{blocks}</div>;
}
