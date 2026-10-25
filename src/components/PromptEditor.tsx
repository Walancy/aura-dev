import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { getFileSvgUrlForName } from './FileIcon';

export interface PromptEditorRef {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  insertPill: (path: string, name?: string) => void;
  insertText: (text: string) => void;
}

export interface PromptEditorProps {
  placeholder?: string;
  disabled?: boolean;
  isEffectiveDark?: boolean;
  maxImages?: number;
  currentImagesCount?: number;
  onImageLimitReached?: () => void;
  onImageAttached?: (file: File) => void;
  onSubmit: (prompt: string) => void;
  onAtMentionQuery?: (query: string) => void;
  onAtMentionClose?: () => void;
  onKeyDownExtra?: (e: React.KeyboardEvent<HTMLDivElement>) => boolean | void;
  hasAttachedTask?: boolean;
  style?: React.CSSProperties;
}

export function createPillNode(filePath: string, fileName?: string): HTMLSpanElement {
  let cleanPath = filePath.trim();
  if (cleanPath.startsWith('@[') && cleanPath.endsWith(']')) {
    cleanPath = cleanPath.slice(2, -1);
  }
  cleanPath = cleanPath.replace(/^@+/, '');

  let name = fileName || cleanPath.split('/').pop() || cleanPath;
  if (name.startsWith('@[') && name.endsWith(']')) {
    name = name.slice(2, -1);
  }
  // Strip any leading '@' characters so the pill never shows '@'
  name = name.replace(/^@+/, '');

  const lowerPath = cleanPath.toLowerCase();
  const isDesignMention = lowerPath === 'design' || lowerPath.startsWith('design:');
  const ext = (name.split('.').pop() || '').toLowerCase();
  const isImage = !isDesignMention && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);

  const span = document.createElement('span');
  span.className = 'prompt-mention-pill';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-path', cleanPath);
  span.setAttribute('data-name', name);
  span.setAttribute('data-is-image', isImage ? 'true' : 'false');
  span.title = isDesignMention ? `Especificação da aba Design (${cleanPath})` : cleanPath;

  // Antigravity style pill (following design system: no shadow, no harsh border)
  span.style.display = 'inline-flex';
  span.style.alignItems = 'center';
  span.style.gap = '5px';
  span.style.padding = '1.5px 7px 2px 6px';
  span.style.margin = '0 3px';
  span.style.borderRadius = '5px';
  span.style.background = isDesignMention ? 'rgba(236, 72, 153, 0.16)' : 'rgba(255, 255, 255, 0.1)';
  span.style.border = 'none';
  span.style.color = '#ffffff';
  span.style.fontSize = '12px';
  span.style.fontWeight = '400';
  span.style.fontFamily = 'Poppins, sans-serif';
  span.style.lineHeight = '18px';
  span.style.verticalAlign = 'baseline';
  span.style.userSelect = 'none';
  span.style.cursor = 'default';
  span.style.boxShadow = 'none';

  // Icon container
  const iconContainer = document.createElement('span');
  iconContainer.style.display = 'inline-flex';
  iconContainer.style.alignItems = 'center';
  iconContainer.style.justifyContent = 'center';
  iconContainer.style.flexShrink = '0';

  if (isDesignMention) {
    iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`;
  } else if (lowerPath === 'git') {
    iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`;
  } else if (lowerPath === 'terminal') {
    iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`;
  } else if (lowerPath === 'rules') {
    iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
  } else if (lowerPath === 'mcp') {
    iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`;
  } else {
    const iconUrl = getFileSvgUrlForName(name);
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.style.width = '13px';
      img.style.height = '13px';
      img.style.objectFit = 'contain';
      img.draggable = false;
      iconContainer.appendChild(img);
    } else if (isImage) {
      iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    } else {
      iconContainer.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }
  }
  span.appendChild(iconContainer);

  const textNode = document.createElement('span');
  textNode.textContent = name;
  textNode.style.color = '#ffffff';
  textNode.style.fontWeight = '400';
  span.appendChild(textNode);

  return span;
}

export function extractPromptFromDOM(container: HTMLElement): string {
  let result = '';

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || '').replace(/\u00A0/g, ' ');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains('prompt-mention-pill') || el.hasAttribute('data-path')) {
        const path = (el.getAttribute('data-path') || '').replace(/^@+/, '');
        result += `@[${path}]`;
      } else if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (result.length > 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }
      }
    }
  }

  for (let i = 0; i < container.childNodes.length; i++) {
    walk(container.childNodes[i]);
  }

  return result;
}

export function populateDOMFromPrompt(container: HTMLElement, prompt: string) {
  container.innerHTML = '';
  if (!prompt) return;

  const mentionRegex = /@\[(.*?)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      const text = prompt.substring(lastIndex, match.index);
      container.appendChild(document.createTextNode(text));
    }
    const path = match[1];
    const pill = createPillNode(path);
    container.appendChild(pill);
    container.appendChild(document.createTextNode('\u00A0'));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    const text = prompt.substring(lastIndex);
    container.appendChild(document.createTextNode(text));
  }
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(
  (
    {
      placeholder = 'Pergunte, mencione arquivos com @ ou arraste para cá...',
      disabled = false,
      isEffectiveDark = true,
      maxImages = 7,
      currentImagesCount = 0,
      onImageLimitReached,
      onImageAttached,
      onSubmit,
      onAtMentionQuery,
      onAtMentionClose,
      onKeyDownExtra,
      hasAttachedTask = false,
      style,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const savedMentionRangeRef = useRef<Range | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const checkIsEmpty = useCallback(() => {
      if (!editorRef.current) return true;
      const text = editorRef.current.textContent?.trim() || '';
      const hasPills = editorRef.current.querySelector('.prompt-mention-pill') !== null;
      const empty = text.length === 0 && !hasPills;
      setIsEmpty(empty);
      return empty;
    }, []);

    const insertPillAtRange = useCallback((range: Range, path: string, name?: string) => {
      if (!editorRef.current) return;

      // Validate range is strictly inside editorRef.current
      if (
        !editorRef.current.contains(range.commonAncestorContainer) ||
        range.commonAncestorContainer === editorRef.current.parentElement
      ) {
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }

      // If empty or only whitespace/br, clean up first
      const text = editorRef.current.textContent || '';
      const hasPills = editorRef.current.querySelector('.prompt-mention-pill') !== null;
      if (text.trim() === '' && !hasPills) {
        editorRef.current.innerHTML = '';
        range = document.createRange();
        range.setStart(editorRef.current, 0);
        range.collapse(true);
      }

      const pill = createPillNode(path, name);
      const space = document.createTextNode('\u00A0');

      try {
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(pill);

        range.setStartAfter(space);
        range.setEndAfter(space);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {
        editorRef.current.appendChild(pill);
        editorRef.current.appendChild(space);
      }

      checkIsEmpty();
    }, [checkIsEmpty]);

    const checkAtMention = useCallback(() => {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.anchorNode) {
        onAtMentionClose?.();
        return;
      }

      const node = sel.anchorNode;
      if (node.nodeType !== Node.TEXT_NODE) {
        onAtMentionClose?.();
        return;
      }

      const textBeforeCaret = node.textContent?.slice(0, sel.anchorOffset) || '';
      const atIdx = textBeforeCaret.lastIndexOf('@');
      if (atIdx !== -1) {
        const charBeforeAt = atIdx > 0 ? textBeforeCaret[atIdx - 1] : ' ';
        if (charBeforeAt === ' ' || charBeforeAt === '\n' || charBeforeAt === '\u00A0' || atIdx === 0) {
          const query = textBeforeCaret.slice(atIdx + 1);
          if (!query.includes(' ') && !query.includes('\n')) {
            const mentionRange = document.createRange();
            mentionRange.setStart(node, atIdx);
            mentionRange.setEnd(node, sel.anchorOffset);
            savedMentionRangeRef.current = mentionRange;
            onAtMentionQuery?.(query);
            return;
          }
        }
      }

      onAtMentionClose?.();
    }, [onAtMentionQuery, onAtMentionClose]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        },
        clear: () => {
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
            setIsEmpty(true);
            onAtMentionClose?.();
          }
        },
        getValue: () => {
          if (!editorRef.current) return '';
          return extractPromptFromDOM(editorRef.current);
        },
        setValue: (val: string) => {
          if (editorRef.current) {
            populateDOMFromPrompt(editorRef.current, val);
            checkIsEmpty();
          }
        },
        insertPill: (path: string, name?: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();

          let range = savedMentionRangeRef.current;
          if (!range) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const r = sel.getRangeAt(0);
              if (editorRef.current.contains(r.commonAncestorContainer)) {
                range = r;
              }
            }
          }

          if (!range || !editorRef.current.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
          }

          insertPillAtRange(range, path, name);
          savedMentionRangeRef.current = null;
          onAtMentionClose?.();
          checkIsEmpty();
        },
        insertText: (text: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();

          let range: Range | null = null;
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (editorRef.current.contains(r.commonAncestorContainer)) {
              range = r;
            }
          }

          if (!range || !editorRef.current.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
          }

          const node = document.createTextNode(text);
          range.deleteContents();
          range.insertNode(node);
          range.setStartAfter(node);
          range.setEndAfter(node);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          checkIsEmpty();
        },
      }),
      [checkIsEmpty, insertPillAtRange, onAtMentionClose]
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (onKeyDownExtra) {
        const handled = onKeyDownExtra(e);
        if (handled) return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (disabled) return;
        const promptText = editorRef.current ? extractPromptFromDOM(editorRef.current).trim() : '';
        if (promptText.length > 0 || currentImagesCount > 0 || hasAttachedTask) {
          onSubmit(promptText);
        }
        return;
      }
    };

    const handleInput = () => {
      checkIsEmpty();
      checkAtMention();
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (items) {
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            hasImage = true;
            const file = item.getAsFile();
            if (file) {
              if (currentImagesCount >= maxImages) {
                onImageLimitReached?.();
              } else {
                onImageAttached?.(file);
              }
            }
          }
        }
        if (hasImage && !e.clipboardData.getData('text')) {
          e.preventDefault();
          return;
        }
      }

      // Plain text paste without styles
      const plainText = e.clipboardData.getData('text/plain');
      if (plainText) {
        e.preventDefault();
        document.execCommand('insertText', false, plainText);
        checkIsEmpty();
        checkAtMention();
      }
    };

    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    useEffect(() => {
      const resetDrag = () => {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      };
      window.addEventListener('dragend', resetDrag);
      window.addEventListener('drop', resetDrag);
      window.addEventListener('mouseleave', resetDrag);
      return () => {
        window.removeEventListener('dragend', resetDrag);
        window.removeEventListener('drop', resetDrag);
        window.removeEventListener('mouseleave', resetDrag);
      };
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      if (disabled || !editorRef.current) return;

      editorRef.current.focus();

      // Find drop location
      let range: Range | null = null;
      if (typeof (document as any).caretRangeFromPoint === 'function') {
        range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
      } else if (typeof (document as any).caretPositionFromPoint === 'function') {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos && pos.offsetNode) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      if (
        !range ||
        !editorRef.current.contains(range.commonAncestorContainer) ||
        range.commonAncestorContainer === editorRef.current.parentElement
      ) {
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // 1. Check internal node drag (Explorer file or tab)
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          if (data && data.path) {
            insertPillAtRange(range, data.path, data.name);
            return;
          }
        } catch {}
      }

      // 2. Native OS files / images
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach((file: File) => {
          const filePath = (file as any).path || file.name;
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);

          if (isImage) {
            if (currentImagesCount >= maxImages) {
              onImageLimitReached?.();
              return;
            }
            onImageAttached?.(file);
          }

          insertPillAtRange(range!, filePath, file.name);
        });
        return;
      }

      // 3. Plain text
      const plainText = e.dataTransfer.getData('text/plain');
      if (plainText) {
        if (plainText.startsWith('@[') && plainText.endsWith(']')) {
          const path = plainText.slice(2, -1).replace(/^@+/, '');
          insertPillAtRange(range, path);
        } else if (plainText.startsWith('/') || plainText.includes('.') || plainText.startsWith('@')) {
          const path = plainText.trim().replace(/^@+/, '');
          insertPillAtRange(range, path);
        } else {
          document.execCommand('insertText', false, plainText);
          checkIsEmpty();
        }
      }
    };

    return (
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 46,
          borderRadius: 6,
          transition: 'all 0.15s ease',
          boxShadow: 'none',
          ...style,
        }}
      >
        {isEmpty && (
          <div
            onClick={() => editorRef.current?.focus()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              color: isEffectiveDark ? '#666666' : '#999999',
              fontSize: 12.5,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '400',
              lineHeight: '20px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          onKeyDown={handleKeyDown}
          onKeyUp={handleInput}
          onInput={handleInput}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            width: '100%',
            minHeight: 46,
            maxHeight: 220,
            overflowY: 'auto',
            color: isEffectiveDark ? '#f1f5f9' : '#1e293b',
            fontSize: 12.5,
            fontFamily: 'Poppins, sans-serif',
            fontWeight: '400',
            lineHeight: '22px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            ...style,
          }}
        />
      </div>
    );
  }
);
