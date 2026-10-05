const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const LOCAL_HOST = /^(?:[\w-]+\.)*localhost\b|^127\.0\.0\.1\b/i;
const URL_RE = /https?:\/\/[^\s"'<>`)\]]+|\b(?:(?:[\w-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s"'<>`)\]]*)?/gi;

/** Adiciona esquema: http:// para localhost/127.0.0.1/*.localhost e https:// para o resto. */
export function withScheme(url: string): string {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `${LOCAL_HOST.test(u) ? 'http' : 'https'}://${u}`;
}

const clean = (u: string) => withScheme(u.replace(/[.,;:*_]+$/, ''));
const isPlaceholder = (u: string) => /[<>]|PORTA|\bPORT\b/i.test(u);

/**
 * Extrai do texto do terminal a URL que o agente quis abrir no navegador do fluxo.
 * O buffer do terminal contém o próprio prompt (eco), então URLs de exemplo do prompt são ignoradas.
 * 1) Marcador explícito `DEVFLOW_OPEN_URL=<url>` (a última ocorrência válida vence).
 * 2) Última URL local (localhost/127.0.0.1/*.localhost) que não esteja no prompt.
 */
export function extractAgentOpenUrl(response: string, prompt: string): string | null {
  const text = (response || '').replace(ANSI, '');
  const promptUrls = new Set((prompt || '').replace(ANSI, '').match(URL_RE)?.map((u) => clean(u).toLowerCase()) ?? []);

  const markers = [...text.matchAll(/DEVFLOW_OPEN_URL=(\S+)/g)]
    .map((m) => m[1])
    .filter((u) => !isPlaceholder(u) && /^(?:https?:\/\/|(?:[\w-]+\.)*localhost|127\.0\.0\.1)/i.test(u));
  if (markers.length) return clean(markers[markers.length - 1]);

  const locals = ((text.match(URL_RE) ?? []) as string[])
    .filter((u) => !isPlaceholder(u) && LOCAL_HOST.test(u.replace(/^https?:\/\//i, '')))
    .map(clean)
    .filter((u) => !promptUrls.has(u.toLowerCase()));
  return locals.length ? locals[locals.length - 1] : null;
}
