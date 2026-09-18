import React from 'react';

// Lightweight, dependency-free Markdown -> JSX renderer for the "Open Preview" panel.
export function renderInlineMarkdown(text: string, keyPrefix: string, accentColor: string): React.ReactNode[] {
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
          style={{ background: 'rgba(127,127,127,0.18)', padding: '1px 5px', borderRadius: 4, fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: '0.9em' }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-${idx++}`}>{token.slice(2, -2)}</strong>);
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
  opts: { textPrimary: string; textSecondary: string; textMuted: string; border: string; accentColor: string; isEffectiveDark: boolean }
): React.ReactNode {
  if (!md || !md.trim()) {
    return <div style={{ color: opts.textMuted, fontSize: 13, fontStyle: 'italic', padding: 20 }}>Arquivo Markdown vazio.</div>;
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
            fontSize: 12.5,
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
      blocks.push(<hr key={key++} style={{ border: 'none', borderTop: `1px solid ${opts.border}`, margin: '10px 0' }} />);
      i++;
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const sizes: Record<number, number> = { 1: 24, 2: 19, 3: 16, 4: 14 };
      blocks.push(
        React.createElement(
          `h${level}`,
          {
            key: key++,
            style: {
              fontSize: sizes[level],
              fontWeight: 700,
              color: opts.textPrimary,
              margin: level <= 2 ? '16px 0 8px' : '10px 0 4px',
              borderBottom: level <= 2 ? `1px solid ${opts.border}` : 'none',
              paddingBottom: level <= 2 ? 6 : 0,
            },
          },
          renderInlineMarkdown(headerMatch[2], `h${key}`, opts.accentColor)
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
            <div key={qi}>{renderInlineMarkdown(ql, `bq${key}-${qi}`, opts.accentColor)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list (consume consecutive items)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: '4px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ color: opts.textPrimary, fontSize: 13 }}>
              {renderInlineMarkdown(it, `ul${key}-${ii}`, opts.accentColor)}
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
        <ol key={key++} style={{ margin: '4px 0', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ color: opts.textPrimary, fontSize: 13 }}>
              {renderInlineMarkdown(it, `ol${key}-${ii}`, opts.accentColor)}
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
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i].trim()) && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith('>') && !lines[i].trim().startsWith('```')) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} style={{ color: opts.textPrimary, margin: 0, fontSize: 13, lineHeight: 1.6 }}>
        {renderInlineMarkdown(paraLines.join(' '), `p${key}`, opts.accentColor)}
      </p>
    );
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{blocks}</div>;
}
