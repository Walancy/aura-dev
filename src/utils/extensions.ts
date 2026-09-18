export interface ExtensionEditorTitleAction {
  extensionName: string;
  command: string;
  title: string;
  iconUrl?: string;
}

// Evaluates a single VS Code "when" clause atom (one side of a `&&`), honestly, for the
// parts we can actually know without an extension host: the active file's extension/language,
// and the extension's own declared boolean configuration defaults. Any atom referencing
// extension-internal runtime state (e.g. "myExt.viewingSomething") is unknowable here, so
// the whole clause is rejected rather than guessed at.
export function evaluateWhenClause(when: string, fileExt: string, configDefaults: Record<string, boolean>): boolean {
  const andParts = when.split('&&').map((s) => s.trim()).filter(Boolean);
  if (andParts.length === 0) return true;
  for (const part of andParts) {
    let negate = false;
    let atom = part;
    if (atom.startsWith('!')) {
      negate = true;
      atom = atom.slice(1).trim();
    }
    const extMatch = atom.match(/^resourceExtname\s*==\s*['"]\.(\w+)['"]$/);
    const langMatch = atom.match(/^(resourceLangId|editorLangId)\s*==\s*['"](\w+)['"]$/);
    const configMatch = atom.match(/^config\.([\w.]+)$/);
    let atomValue: boolean | null = null;
    if (extMatch) {
      atomValue = extMatch[1].toLowerCase() === fileExt.toLowerCase();
    } else if (langMatch) {
      atomValue = langMatch[2].toLowerCase() === fileExt.toLowerCase();
    } else if (configMatch) {
      atomValue = configDefaults[configMatch[1]] ?? false;
    } else {
      return false; // unknown/unknowable atom (extension-internal state) — don't guess
    }
    if ((negate ? !atomValue : atomValue) !== true) return false; // AND semantics
  }
  return true;
}

// Reads VS Code-style `contributes.menus["editor/title"]` + `contributes.commands` (and
// `contributes.configuration` for default values) from installed extensions and returns the
// actions relevant to the given file. Contributions with no "when" clause always show,
// matching real VS Code behavior.
// Resolves a `contributes.commands[].icon` value (VS Code allows a relative path, a
// {light,dark} pair of relative paths, or a "$(codicon-name)" reference) to a loadable
// file:// URL pointing inside the extracted extension folder. Falls back to the
// extension's marketplace icon when the command has no icon of its own, and to
// `undefined` (generic icon) when the reference is a codicon we don't bundle.
export function resolveCommandIconUrl(icon: any, folderPath: string | undefined, isEffectiveDark: boolean, fallbackIconUrl: string | undefined): string | undefined {
  let relPath: string | undefined;
  if (typeof icon === 'string') {
    if (icon.startsWith('$(')) return fallbackIconUrl; // built-in codicon reference — can't render without the codicon font
    relPath = icon;
  } else if (icon && typeof icon === 'object') {
    relPath = (isEffectiveDark ? icon.dark : icon.light) || icon.dark || icon.light;
  }
  if (relPath && folderPath) {
    const cleanRel = relPath.replace(/^\.?\/+/, '');
    return `file://${folderPath}/extension/${cleanRel}`;
  }
  return fallbackIconUrl;
}

export function getEditorTitleActions(installedExtensions: any[], fileName: string | undefined, isEffectiveDark: boolean): ExtensionEditorTitleAction[] {
  if (!fileName || !installedExtensions?.length) return [];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const actions: ExtensionEditorTitleAction[] = [];
  for (const inst of installedExtensions) {
    if (inst.enabled === false) continue;
    const menuEntries = inst.contributes?.menus?.['editor/title'];
    const commands = inst.contributes?.commands;
    if (!Array.isArray(menuEntries) || !Array.isArray(commands)) continue;

    const configDefaults: Record<string, boolean> = {};
    const configProps = inst.contributes?.configuration?.properties;
    if (configProps) {
      for (const [propKey, def] of Object.entries<any>(configProps)) {
        if (typeof def?.default === 'boolean') configDefaults[propKey] = def.default;
      }
    }

    for (const entry of menuEntries) {
      const when: string | undefined = entry.when;
      const matches = !when || evaluateWhenClause(when, ext, configDefaults);
      if (!matches) continue;
      const cmdDef = commands.find((c: any) => c.command === entry.command);
      if (!cmdDef) continue;
      actions.push({
        extensionName: inst.displayName || inst.name,
        command: entry.command,
        title: cmdDef.title || entry.command,
        iconUrl: resolveCommandIconUrl(cmdDef.icon, inst.folderPath, isEffectiveDark, inst.iconUrl || undefined),
      });
    }
  }
  return actions;
}
