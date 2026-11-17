/** Regras de CI do repositório: lê os workflows que rodam em pull request e vira um bloco de prompt para a IA seguir */
interface WfNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: WfNode[];
}

const INSTALL = /^(npm (ci|install|i)\b|yarn( install)?$|pnpm install|bun install|echo\b|cd\b)/;

const parseWorkflow = (src: string): { name: string; steps: Array<{ cmd: string; dir?: string }>; onPr: boolean } => {
  const lines = src.split('\n');
  const name = (src.match(/^name:\s*(.+)$/m)?.[1] || '').replace(/['"]/g, '').trim();
  const onBlock = src.match(/^on:\s*([\s\S]*?)(?=^\S)/m)?.[0] || src.match(/^on:.*$/m)?.[0] || '';
  const onPr = /pull_request/.test(onBlock);
  const steps: Array<{ cmd: string; dir?: string }> = [];
  let defaultDir: string | undefined;
  let stepDir: string | undefined;
  let inSteps = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*steps:\s*$/.test(l)) inSteps = true;
    const wd = l.match(/^\s*working-directory:\s*(\S+)/);
    if (wd) {
      if (inSteps) stepDir = wd[1];
      else defaultDir = wd[1];
      continue;
    }
    if (/^\s*-\s+(name|uses|run):/.test(l)) stepDir = undefined;
    const m = l.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    let cmds: string[] = [];
    if (/^[|>][+-]?$/.test(m[2].trim())) {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j];
        if (t.trim() && t.length - t.trimStart().length <= indent) break;
        if (t.trim()) cmds.push(t.trim());
      }
    } else if (m[2].trim()) cmds = [m[2].trim().replace(/^['"]|['"]$/g, '')];
    // working-directory pode vir depois do run no mesmo passo
    let dir = stepDir || defaultDir;
    for (let j = i + 1; j < Math.min(lines.length, i + 12) && !dir; j++) {
      if (/^\s*-\s/.test(lines[j])) break;
      const w = lines[j].match(/^\s*working-directory:\s*(\S+)/);
      if (w) dir = w[1];
    }
    for (const c of cmds) if (!c.startsWith('#') && !INSTALL.test(c) && !c.includes('${{ secrets')) steps.push({ cmd: c, dir });
  }
  return { name, steps, onPr };
};

/** Comandos que o CI roda em pull request, prontos para a lista "Antes de entregar" (um por linha; com a pasta de trabalho vira `cd pasta && cmd`) */
export const loadCiCommands = async (workspacePath: string): Promise<string[]> => {
  if (!workspacePath) return [];
  const out: string[] = [];
  try {
    const dir = `${workspacePath.replace(/\/$/, '')}/.github/workflows`;
    const res = await window.electronAPI?.fs?.getTree(dir, 1);
    const files = ((res?.tree as WfNode[]) || []).filter((n) => !n.isDirectory && /\.ya?ml$/i.test(n.name));
    for (const f of files) {
      const r = await window.electronAPI?.fs?.readFile(f.path);
      if (!r?.content) continue;
      const wf = parseWorkflow(r.content);
      if (!wf.onPr) continue;
      for (const st of wf.steps) {
        const line = st.dir && st.dir !== '.' ? `cd ${st.dir} && ${st.cmd}` : st.cmd;
        if (!out.includes(line)) out.push(line);
      }
    }
  } catch {}
  return out;
};
