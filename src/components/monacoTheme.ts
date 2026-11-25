import type * as Monaco from 'monaco-editor';

let latexRegistered = false;
/** Realce de sintaxe básico de LaTeX (o Monaco não traz). */
export function registerLatex(monaco: typeof Monaco) {
  if (latexRegistered) return;
  latexRegistered = true;
  monaco.languages.register({ id: 'latex', extensions: ['.tex', '.sty', '.cls', '.bib'] });
  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\(begin|end)(?=\{)/, 'keyword'],
        [/\\(section|subsection|subsubsection|chapter|part|paragraph|title|author|date|maketitle|documentclass|usepackage|newcommand|renewcommand|input|include)\b/, 'keyword'],
        [/\\[a-zA-Z@]+\*?/, 'function'],
        [/\\./, 'string.escape'],
        [/\$\$/, { token: 'number', next: '@mathDisplay' }],
        [/\$/, { token: 'number', next: '@mathInline' }],
        [/[{}\[\]]/, 'delimiter.bracket'],
      ],
      mathInline: [
        [/\$/, { token: 'number', next: '@pop' }],
        [/\\[a-zA-Z]+/, 'type'],
        [/[^$\\]+/, 'number'],
        [/\\./, 'type'],
      ],
      mathDisplay: [
        [/\$\$/, { token: 'number', next: '@pop' }],
        [/\\[a-zA-Z]+/, 'type'],
        [/[^$\\]+/, 'number'],
        [/\\./, 'type'],
      ],
    },
  });
  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '$', close: '$' }],
    surroundingPairs: [{ open: '{', close: '}' }, { open: '$', close: '$' }],
  });
}

/** Tema escuro do Monaco (editor e diff), com cores de adição/remoção suaves */
export function defineAuraDarkTheme(monaco: typeof Monaco, name: string, accentColor?: string) {
  registerLatex(monaco);
  monaco.editor.defineTheme(name, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'c9d1d9' },
    ],
    colors: {
      'editor.background': '#101010',
      'editor.foreground': '#d8dade',
      ...(accentColor ? { 'editorCursor.foreground': accentColor } : {}),
      'editor.lineHighlightBackground': '#181818',
      'editorLineNumber.foreground': '#4e5362',
      'editorLineNumber.activeForeground': '#ffffff',
      'editor.selectionBackground': '#264f78',
      'editorGutter.background': '#101010',
      'editorIndentGuide.background1': '#ffffff12',
      'editorIndentGuide.activeBackground1': '#ffffff26',
      'scrollbarSlider.background': '#ffffff14',
      'scrollbarSlider.hoverBackground': '#ffffff24',
      'diffEditor.insertedLineBackground': '#2ea04317',
      'diffEditor.insertedTextBackground': '#2ea04333',
      'diffEditor.removedLineBackground': '#f8514917',
      'diffEditor.removedTextBackground': '#f8514933',
      'diffEditorGutter.insertedLineBackground': '#2ea04326',
      'diffEditorGutter.removedLineBackground': '#f8514926',
      'diffEditor.diagonalFill': '#ffffff0a',
      'diffEditor.border': '#00000000',
      'editorOverviewRuler.border': '#00000000',
      'editorWidget.background': '#181818',
    },
  });
}
