import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, FolderOpen, KeyRound, Play, Plus, Smartphone, SquareTerminal, Trash2, Wand2 } from 'lucide-react';
import { EmptyState, Panel, Pill, SmallButton, inputStyle, selectStyle } from '../../team/teamUi';
import { Field, Notice, type SectionProps } from '../settingsUi';
import { logSystemActivity } from '../../../utils/brainService';

type EnvLine = { kind: 'pair'; key: string; value: string } | { kind: 'raw'; text: string };

const parseEnv = (text: string): EnvLine[] =>
  text.split('\n').map((line) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    return m ? { kind: 'pair', key: m[1], value: m[2] } : { kind: 'raw', text: line };
  });

const serializeEnv = (lines: EnvLine[]) => lines.map((l) => (l.kind === 'pair' ? `${l.key}=${l.value}` : l.text)).join('\n');

const joinPath = (a: string, b: string) => `${a.replace(/\/+$/, '')}/${b}`;

const listDir = async (dir: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> => {
  const res: any = await window.electronAPI?.fs?.getTree?.(dir, 0);
  return Array.isArray(res) ? res : res?.tree || [];
};

const readText = async (path: string): Promise<string | null> => {
  try {
    const res = await window.electronAPI?.fs?.readFile?.(path);
    return res && !res.error ? res.content : null;
  } catch {
    return null;
  }
};

export const LocalEnvSection: React.FC<SectionProps & { detectedPath?: string }> = ({ ctx, settings, update, showToast, confirm, detectedPath }) => {
  const { theme, accentColor } = ctx;
  const local = settings.local;
  const path = local.path || detectedPath || '';
  const setLocal = (patch: Partial<typeof local>) => {
    logSystemActivity('configuracoes_projeto', 'atualizar_ambiente_local', path, patch);
    update((s) => ({ ...s, local: { ...s.local, ...patch } }));
  };
  const [entries, setEntries] = useState<Array<{ name: string; path: string; isDirectory: boolean }>>([]);
  const [envFile, setEnvFile] = useState<string | null>(null);
  const [envLines, setEnvLines] = useState<EnvLine[] | null>(null);
  const [envOriginal, setEnvOriginal] = useState('');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [gitignore, setGitignore] = useState<string | null>(null);
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>([]);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!path) return;
    listDir(path)
      .then((list) => {
        setEntries(list);
        const envs = list.filter((f) => !f.isDirectory && /^\.env/.test(f.name));
        setEnvFile((cur) => (cur && envs.some((e) => e.path === cur) ? cur : envs.find((e) => e.name === '.env')?.path || envs[0]?.path || null));
      })
      .catch(() => setEntries([]));
    readText(joinPath(path, '.gitignore')).then(setGitignore);
  }, [path]);

  useEffect(() => {
    if (!envFile) {
      setEnvLines(null);
      return;
    }
    readText(envFile).then((t) => {
      setEnvOriginal(t ?? '');
      setEnvLines(parseEnv(t ?? ''));
      setRevealed(new Set());
    });
  }, [envFile]);

  const envFiles = entries.filter((f) => !f.isDirectory && /^\.env/.test(f.name));
  const isFlutter = entries.some((f) => f.name === 'pubspec.yaml');
  const envDirty = envLines != null && serializeEnv(envLines) !== envOriginal;
  const envIgnored = useMemo(() => {
    if (!envFile || gitignore == null) return null;
    const name = envFile.split('/').pop() || '';
    return gitignore.split('\n').some((l) => {
      const p = l.trim();
      if (!p || p.startsWith('#')) return false;
      if (p === name || p === `/${name}`) return true;
      if (p.includes('*')) return new RegExp(`^/?${p.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`).test(name);
      return false;
    });
  }, [envFile, gitignore]);

  const pickFolder = async () => {
    const res = await window.electronAPI?.dialog?.openFolder?.();
    if (res?.folderPath) {
      setLocal({ path: res.folderPath });
      showToast(`Pasta vinculada: ${res.folderPath}`);
    }
  };

  const runInTerminal = async (cmd?: string) => {
    if (!cmd || !path) return;
    const res = await window.electronAPI?.shell?.openInSystemTerminal?.(cmd, path);
    if (res && !res.success) showToast(`Falhou: ${res.error}`);
  };

  const detectCommands = async () => {
    if (!path) return;
    setDetecting(true);
    const cmds: typeof local.commands = { ...local.commands };
    const pkg = await readText(joinPath(path, 'package.json'));
    if (pkg) {
      try {
        const scripts = JSON.parse(pkg).scripts || {};
        const runner = entries.some((f) => f.name === 'bun.lock' || f.name === 'bun.lockb') ? 'bun run' : entries.some((f) => f.name === 'pnpm-lock.yaml') ? 'pnpm' : entries.some((f) => f.name === 'yarn.lock') ? 'yarn' : 'npm run';
        const pick = (...names: string[]) => names.find((n) => scripts[n]);
        const run = pick('dev', 'start', 'serve');
        const test = pick('test', 'test:unit');
        const build = pick('build');
        const deploy = pick('deploy', 'release');
        if (run) cmds.run = `${runner} ${run}`;
        if (test) cmds.test = `${runner} ${test}`;
        if (build) cmds.build = `${runner} ${build}`;
        if (deploy) cmds.deploy = `${runner} ${deploy}`;
      } catch {}
    }
    if (isFlutter) {
      cmds.run ||= 'flutter run';
      cmds.test ||= 'flutter test';
      cmds.build ||= 'flutter build apk --release';
    }
    if (entries.some((f) => f.name === 'Cargo.toml')) {
      cmds.run ||= 'cargo run';
      cmds.test ||= 'cargo test';
      cmds.build ||= 'cargo build --release';
    }
    setLocal({ commands: cmds });
    setDetecting(false);
    showToast('Comandos detectados — revise antes de usar.');
  };

  const loadDevices = async () => {
    const res = await window.electronAPI?.shell?.exec?.(`${local.flutter.sdkPath ? `"${joinPath(local.flutter.sdkPath, 'bin/flutter')}"` : 'flutter'} devices --machine`, path);
    try {
      const list = JSON.parse(res?.stdout || '[]');
      setDevices(list.map((d: any) => ({ id: d.id, name: d.name })));
      if (!list.length) showToast('Nenhum dispositivo encontrado.');
    } catch {
      showToast('Não foi possível listar dispositivos (o Flutter está no PATH?).');
    }
  };

  const flutterCmd = useMemo(() => {
    const f = local.flutter;
    const bin = f.sdkPath ? `"${joinPath(f.sdkPath, 'bin/flutter')}"` : 'flutter';
    return [bin, 'run', f.flavor && `--flavor ${f.flavor}`, f.device && `-d ${f.device}`, f.target && `-t ${f.target}`].filter(Boolean).join(' ');
  }, [local.flutter]);

  const saveEnv = async () => {
    if (!envFile || !envLines) return;
    try {
      await window.electronAPI?.fs?.writeFile?.(envFile, serializeEnv(envLines));
      setEnvOriginal(serializeEnv(envLines));
      showToast(`${envFile.split('/').pop()} salvo.`);
    } catch (e: any) {
      showToast(`Falhou: ${e?.message || e}`);
    }
  };

  const setLine = (idx: number, patch: Partial<{ key: string; value: string }>) =>
    setEnvLines((prev) => prev && prev.map((l, i) => (i === idx && l.kind === 'pair' ? { ...l, ...patch } : l)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<FolderOpen size={14} color={accentColor} />} title="Pasta local">
          <Field ctx={ctx} label={path ? <code style={{ fontSize: 12 }}>{path}</code> : 'Nenhuma pasta vinculada'} hint={local.path ? 'Definida manualmente.' : detectedPath ? 'Detectada automaticamente pelo nome do repositório.' : 'Clone o repositório e vincule a pasta.'}>
            <SmallButton ctx={ctx} onClick={pickFolder}>
              <FolderOpen size={11} /> {path ? 'Trocar' : 'Escolher pasta'}
            </SmallButton>
            {local.path && (
              <SmallButton ctx={ctx} onClick={() => setLocal({ path: undefined })}>
                Usar detecção
              </SmallButton>
            )}
            {path && (
              <>
                <SmallButton ctx={ctx} onClick={() => window.electronAPI?.shell?.exec?.(`open "${path}"`)}>
                  Finder
                </SmallButton>
                <SmallButton ctx={ctx} onClick={() => runInTerminal('git status')}>
                  <SquareTerminal size={11} /> Terminal
                </SmallButton>
              </>
            )}
          </Field>
        </Panel>

        <Panel
          ctx={ctx}
          icon={<Play size={14} color={accentColor} />}
          title="Comandos do projeto"
          right={
            path ? (
              <SmallButton ctx={ctx} disabled={detecting} onClick={detectCommands}>
                <Wand2 size={11} /> Detectar
              </SmallButton>
            ) : undefined
          }
        >
          {(['run', 'test', 'build', 'deploy'] as const).map((k) => (
            <Field key={k} ctx={ctx} label={{ run: 'Rodar', test: 'Testar', build: 'Build', deploy: 'Deploy' }[k]}>
              <input
                value={local.commands[k] || ''}
                onChange={(e) => setLocal({ commands: { ...local.commands, [k]: e.target.value || undefined } })}
                placeholder={{ run: 'bun run dev', test: 'bun test', build: 'bun run build', deploy: './deploy.sh' }[k]}
                style={{ ...inputStyle(ctx), width: 220, fontFamily: "'JetBrains Mono', Menlo, monospace" }}
              />
              <SmallButton ctx={ctx} disabled={!local.commands[k] || !path} onClick={() => runInTerminal(local.commands[k])} title="Executar no terminal do sistema">
                <Play size={11} />
              </SmallButton>
            </Field>
          ))}
        </Panel>

      <Panel
        ctx={ctx}
        icon={<KeyRound size={14} color={accentColor} />}
        title="Variáveis de ambiente"
        right={
          envFiles.length > 0 ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={envFile || ''} onChange={(e) => setEnvFile(e.target.value)} style={selectStyle(ctx)}>
                {envFiles.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.name}
                  </option>
                ))}
              </select>
              <SmallButton ctx={ctx} primary disabled={!envDirty} onClick={saveEnv}>
                Salvar
              </SmallButton>
            </div>
          ) : undefined
        }
      >
        {!path ? (
          <EmptyState ctx={ctx} text="Vincule a pasta local para editar os arquivos .env." />
        ) : envFiles.length === 0 ? (
          <EmptyState
            ctx={ctx}
            text={
              <>
                Nenhum arquivo .env na raiz do projeto.{' '}
                <SmallButton ctx={ctx} onClick={async () => { await window.electronAPI?.fs?.writeFile?.(joinPath(path, '.env'), ''); setEntries(await listDir(path)); setEnvFile(joinPath(path, '.env')); }}>
                  Criar .env
                </SmallButton>
              </>
            }
          />
        ) : (
          <>
            {envIgnored === false && (
              <Notice ctx={ctx} tone="danger">
                {envFile?.split('/').pop()} não está no .gitignore — os segredos podem ser commitados.
              </Notice>
            )}
            {envLines?.map((l, idx) =>
              l.kind === 'pair' ? (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={l.key} onChange={(e) => setLine(idx, { key: e.target.value })} style={{ ...inputStyle(ctx), width: 220, fontFamily: "'JetBrains Mono', Menlo, monospace" }} />
                  <input
                    type={revealed.has(idx) ? 'text' : 'password'}
                    value={l.value}
                    onChange={(e) => setLine(idx, { value: e.target.value })}
                    style={{ ...inputStyle(ctx), flex: 1, width: 'auto', fontFamily: "'JetBrains Mono', Menlo, monospace" }}
                  />
                  <SmallButton
                    ctx={ctx}
                    onClick={() =>
                      setRevealed((prev) => {
                        const n = new Set(prev);
                        n.has(idx) ? n.delete(idx) : n.add(idx);
                        return n;
                      })
                    }
                  >
                    {revealed.has(idx) ? <EyeOff size={11} /> : <Eye size={11} />}
                  </SmallButton>
                  <SmallButton
                    ctx={ctx}
                    danger
                    title="Excluir variável"
                    onClick={() => {
                      const varName = l.key || 'esta variável';
                      confirm({
                        title: 'Remover Variável de Ambiente',
                        message: `Tem certeza que deseja remover a variável "${varName}"?`,
                        itemDescription: 'A chave será removida da lista deste arquivo .env local.',
                        confirmLabel: 'Remover Variável',
                        onConfirm: () => {
                          setEnvLines((prev) => prev && prev.filter((_, i) => i !== idx));
                          showToast(`Variável "${varName}" removida.`);
                        },
                      });
                    }}
                  >
                    <Trash2 size={11} />
                  </SmallButton>
                </div>
              ) : l.text.trim().startsWith('#') ? (
                <div key={idx} style={{ fontSize: 11, color: theme.textMuted, fontFamily: "'JetBrains Mono', Menlo, monospace" }}>
                  {l.text}
                </div>
              ) : null,
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <SmallButton ctx={ctx} onClick={() => setEnvLines((prev) => [...(prev || []), { kind: 'pair', key: 'NOVA_VARIAVEL', value: '' }])}>
                <Plus size={11} /> Variável
              </SmallButton>
              {envDirty && (
                <SmallButton
                  ctx={ctx}
                  onClick={() =>
                    confirm({
                      title: 'Descartar alterações',
                      message: 'Descartar as mudanças não salvas no arquivo?',
                      confirmLabel: 'Descartar',
                      onConfirm: () => setEnvLines(parseEnv(envOriginal)),
                    })
                  }
                >
                  Descartar
                </SmallButton>
              )}
            </div>
          </>
        )}
      </Panel>

      {(isFlutter || local.flutter.sdkPath) && (
        <Panel ctx={ctx} icon={<Smartphone size={14} color={accentColor} />} title="Flutter" right={<Pill color="#02569B">pubspec.yaml</Pill>}>
          <Field ctx={ctx} label="SDK" hint="Vazio = usa o flutter do PATH.">
            <input value={local.flutter.sdkPath || ''} onChange={(e) => setLocal({ flutter: { ...local.flutter, sdkPath: e.target.value || undefined } })} placeholder="/Users/você/flutter" style={{ ...inputStyle(ctx), width: 260 }} />
          </Field>
          <Field ctx={ctx} label="Flavor">
            <input value={local.flutter.flavor || ''} onChange={(e) => setLocal({ flutter: { ...local.flutter, flavor: e.target.value || undefined } })} placeholder="dev, staging, prod" style={{ ...inputStyle(ctx), width: 180 }} />
          </Field>
          <Field ctx={ctx} label="Target" hint="Arquivo main alternativo (opcional).">
            <input value={local.flutter.target || ''} onChange={(e) => setLocal({ flutter: { ...local.flutter, target: e.target.value || undefined } })} placeholder="lib/main_dev.dart" style={{ ...inputStyle(ctx), width: 220 }} />
          </Field>
          <Field ctx={ctx} label="Dispositivo padrão">
            <select value={local.flutter.device || ''} onChange={(e) => setLocal({ flutter: { ...local.flutter, device: e.target.value || undefined } })} style={selectStyle(ctx)}>
              <option value="">Perguntar</option>
              {local.flutter.device && !devices.some((d) => d.id === local.flutter.device) && <option value={local.flutter.device}>{local.flutter.device}</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <SmallButton ctx={ctx} disabled={!path} onClick={loadDevices}>
              Listar
            </SmallButton>
          </Field>
          <Field ctx={ctx} label={<code style={{ fontSize: 11.5 }}>{flutterCmd}</code>}>
            <SmallButton ctx={ctx} primary disabled={!path} onClick={() => runInTerminal(flutterCmd)}>
              <Play size={11} /> Rodar
            </SmallButton>
          </Field>
        </Panel>
      )}
    </div>
  );
};
