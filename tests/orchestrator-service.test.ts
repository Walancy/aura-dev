import { test, expect, mock, beforeAll } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// HOME descartável (o serviço grava histórico em ~/.devflow) e PATH com um "claude" falso na frente
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-svc-'));
process.env.HOME = tmp;
const bin = path.join(tmp, 'bin');
fs.mkdirSync(bin, { recursive: true });
fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh
for a in "$@"; do prompt="$a"; done
case "$prompt" in
  *PEDIDO_OK*) echo '{"type":"result","result":"respondido","usage":{"input_tokens":4,"output_tokens":1}}' ;;
  *PEDIDO_LENTO*) echo $$ > "${tmp}/lento.pid"; sleep 60 ;;
  *) echo '{"type":"result","result":"?"}' ;;
esac
`, { mode: 0o755 });
process.env.PATH = `${bin}:${process.env.PATH}`;

mock.module('electron', () => ({ app: { isPackaged: false, getAppPath: () => path.resolve(import.meta.dir, '..') } }));

let service: any;
beforeAll(async () => {
  service = (await import('../electron/orchestrator-service')).orchestratorService;
});

const base = (request: string, extra: object = {}) => ({ provider: 'claude' as const, request, cwd: tmp, mode: 'execute' as const, timeoutMs: 20_000, ...extra });
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('execução normal devolve texto, tokens e exit 0', async () => {
  const r = await service.run(base('PEDIDO_OK'));
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toBe('respondido');
  expect(r.usage).toEqual({ input_tokens: 4, output_tokens: 1 });
  expect(r.cancelled).toBe(false);
});

test('provedor desconhecido e pasta inexistente são recusados antes de iniciar processo', async () => {
  const a = await service.run(base('x', { provider: 'rm' as any }));
  expect(a.exitCode).toBe(1);
  expect(a.stderr).toContain('provedor não suportado');
  const b = await service.run(base('x', { cwd: '/pasta/que/nao/existe' }));
  expect(b.exitCode).toBe(1);
  expect(b.stderr).toContain('pasta de trabalho inexistente');
});

test('cancelar mata o provedor e a resposta vem com cancelled: true', async () => {
  const pidFile = path.join(tmp, 'lento.pid');
  const p = service.run(base('PEDIDO_LENTO', { runId: 'r-cancel' }));
  const start = Date.now();
  while (!fs.existsSync(pidFile) && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 50));
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  expect(alive(pid)).toBe(true);
  expect(service.cancel('r-cancel')).toBe(true);
  const r = await p;
  expect(r.cancelled).toBe(true);
  expect(r.exitCode).toBe(130);
  const t0 = Date.now();
  while (alive(pid) && Date.now() - t0 < 5000) await new Promise((r2) => setTimeout(r2, 50));
  expect(alive(pid)).toBe(false);
});

test('cancelByTag só atinge execuções da origem pedida (o Parar do chat não toca nas autônomas)', async () => {
  fs.rmSync(path.join(tmp, 'lento.pid'), { force: true });
  const chat = service.run(base('PEDIDO_LENTO', { runId: 'r-chat', tag: 'chat' }));
  const auto = service.run(base('PEDIDO_OK', { runId: 'r-auto' }));
  await auto;
  expect(service.cancelByTag('autonomo')).toBe(false);
  const start = Date.now();
  while (!fs.existsSync(path.join(tmp, 'lento.pid')) && Date.now() - start < 10_000) await new Promise((r) => setTimeout(r, 50));
  expect(service.cancelByTag('chat', '/outra/pasta')).toBe(false); // pasta diferente
  expect(service.cancelByTag('chat', tmp)).toBe(true);
  expect((await chat).cancelled).toBe(true);
});

test('cancelar um runId desconhecido não cancela nada', () => {
  expect(service.cancel('nao-existe')).toBe(false);
  expect(service.cancel(undefined)).toBe(false);
});
