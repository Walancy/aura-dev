import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

/** Opções de autocomplete compartilhadas pelos editores da IDE e do CLI */
export const AUTOCOMPLETE_OPTIONS: editor.IEditorOptions = {
  quickSuggestions: { other: true, comments: false, strings: true },
  quickSuggestionsDelay: 60,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on',
  acceptSuggestionOnCommitCharacter: true,
  tabCompletion: 'on',
  wordBasedSuggestions: 'allDocuments',
  snippetSuggestions: 'inline',
  parameterHints: { enabled: true },
  suggest: { showWords: true, showSnippets: true, preview: true, showIcons: true, insertMode: 'replace' },
  autoClosingQuotes: 'languageDefined',
  autoSurround: 'languageDefined',
  formatOnPaste: false,
};

let done = false;

/** Completa a configuração das linguagens (TS/JS com JSX, libs do navegador e sincronização entre arquivos abertos) */
export function setupAutocomplete(monaco: typeof Monaco) {
  if (done) return;
  done = true;
  try {
    const ts = (monaco.languages as any)?.typescript;
    if (!ts) return;
    for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
      defaults.setCompilerOptions({
        ...defaults.getCompilerOptions(),
        target: ts.ScriptTarget.ESNext,
        lib: ['esnext', 'dom', 'dom.iterable'],
        allowNonTsExtensions: true,
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
      });
      defaults.setEagerModelSync(true);
    }
  } catch (e) {
    console.warn('Monaco autocomplete setup error:', e);
  }
}
