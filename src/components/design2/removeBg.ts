export interface RemoveBgDeps {
  saveTempImage: (base64: string, ext?: string) => Promise<{ path: string }>;
  exec: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  readDataUrl: (path: string) => Promise<{ dataUrl?: string; error?: string }>;
}

const MIME_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Aspas simples seguras para o shell (zsh/bash). */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Remove o fundo de uma imagem (data URL) com a ferramenta `rembg` instalada na máquina (`pip install "rembg[cli]"`).
 * Sem a ferramenta devolve um erro explicando como instalar, em vez de falhar em silêncio.
 */
export async function removeBackground(dataUrl: string, deps: RemoveBgDeps): Promise<{ dataUrl?: string; error?: string }> {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return { error: 'A imagem precisa estar embutida (data URL) para remover o fundo' };
  const ext = MIME_EXT[m[1]] || 'png';
  const { path } = await deps.saveTempImage(m[2], ext);
  const out = path.replace(/\.[^./]+$/, '') + '-sem-fundo.png';
  const r = await deps.exec(`rembg i ${q(path)} ${q(out)}`);
  if (r.exitCode !== 0) {
    const missing = /command not found|not found|não encontrado/i.test(`${r.stderr} ${r.stdout}`) || r.exitCode === 127;
    return { error: missing ? 'Ferramenta "rembg" não encontrada. Instale com: pip install "rembg[cli]"' : `rembg falhou: ${(r.stderr || r.stdout).trim().split('\n').pop() || 'erro desconhecido'}` };
  }
  const read = await deps.readDataUrl(out);
  return read.dataUrl ? { dataUrl: read.dataUrl } : { error: read.error || 'Não foi possível ler o resultado' };
}
