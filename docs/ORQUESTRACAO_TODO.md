# Orquestração — plano de correção

> Documento de trabalho para qualquer IA ou dev corrigir a tela **Orquestração** do DevFlow Desktop.
> Gerado a partir de uma auditoria de código (4 frentes) + testes manuais no app em 2026-09-28.
> Cada item é autocontido: **Onde**, **Problema**, **Como reproduzir**, **Correção**, **Aceite**.

---

## 0. Contexto obrigatório (leia antes de começar)

### O que é a tela
Um canvas de nós (estilo n8n) onde o usuário encadeia **agentes de IA via CLI** (Claude Code, Codex, Antigravity/`agy`, Gemini, Ollama), **ferramentas shell**, **nós IDE** (terminal), **nós navegador** e **gatilhos**, e executa o fluxo. Tem ainda: **Maestro** (IA que recruta/dispensa agentes), **Ombro** (chat que responde sobre o status dos agentes), **Andares** (workspaces isolados por `git worktree`/branch), **Simulador** (captura de janela do iOS Simulator), **Paleta de comandos** (Cmd+K) e aba **Execuções** (histórico).

### Arquivos envolvidos
| Arquivo | Papel |
|---|---|
| `src/components/OrchestrationCanvas.tsx` (~7300 linhas) | Tudo do canvas: estado, motor de execução, render, interações |
| `src/components/OrchestrationBrowserNode.tsx` | Nó navegador (abas + iframe) |
| `src/components/OrchestrationOmbroPanel.tsx` | Painel Ombro |
| `src/components/OrchestrationSimulatorPanel.tsx` | Painel de captura do Simulator |
| `src/components/OrchestrationCommandPalette.tsx` | Paleta Cmd+K |
| `src/components/NativeXTerm.tsx` | Terminal xterm ligado a um PTY |
| `electron/main.ts` | IPC: `ai:prompt`, `ai:runCli`, `ai:orchestrate`, `ai:cancel`, `shell:openExternal`, `capture:listWindows`, criação da janela |
| `electron/preload.ts` / `src/electron.d.ts` | Ponte `window.electronAPI` e tipos |
| `electron/pty-service.ts` | Sessões PTY (terminais interativos) |
| `electron/orchestrator-service.ts` | Spawn do binário Rust do orquestrador |
| `electron/autonomous-service.ts` | Execução autônoma em fases (planning → implementation → verification → repair) |
| `electron/skills-service.ts` | Skills ativas → flags dos CLIs (`cliArgs`, `promptPreamble`) |
| `rust/orchestrator/src/lib.rs`, `main.rs` | Monta os argumentos dos CLIs e executa com streaming JSON |

> **Números de linha são aproximados** (o arquivo muda). Sempre localize pelo **nome da função/trecho** citado; use `grep -n`.

### Funções-chave no `OrchestrationCanvas.tsx` (para localizar)
`executeWorkflow` (~2298) · `handleMaestroRecruit` (~1334) · `askOmbro` (~1453) · `getInitialCliCommand` (~1484) · `toggleNodeCli` (~1511) · `sendRelayMessage` (~880) · `handleSwitchFloor` (~608) · `handleDeleteFloor` (~705) · `handleAddNode` (~2422) · `handleOpenSimulatorCapture` (~2586) · `confirmDeleteNode` (~2592) · `handleResetToDefault` (~2617) · `performZoomAt` (~1178) · `getNodeDimensions` (~1291) · `renderNodeCard` / `renderToolbarButton` · keydown global (~2718-2796) · persistência localStorage (~1131) · workflow padrão (~240-345).

### Regras do projeto
- **Runtime:** Bun (`bun`, `bunx`, `bun test`). Nunca npm/yarn/npx.
- **Idioma:** textos de UI e comentários em **pt-BR**.
- **Estilo de código:** siga o modo **Ponytail** — a menor mudança que resolve na causa raiz; reutilize o que já existe; stdlib/recurso nativo antes de dependência; **deleção antes de adição**; sem abstrações novas não pedidas. Lógica não trivial deixa **um** teste executável (`bun test`).
- **Estilo visual:** estilos inline como o resto do arquivo; cores via `themeTokens`/props de tema (não hardcode `#fff`/`#000`).
- **Não commitar** (o usuário commita). Não reiniciar o app sem pedirem.
- **Existem ~182 erros de TypeScript pré-existentes** no projeto. Critério: **não introduzir novos** nos arquivos tocados.

### Como verificar cada mudança
```bash
bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "Orchestration|NativeXTerm|electron.d" # sem erros novos
bunx tsc -p tsconfig.electron.json --noEmit                                               # backend limpo
bun run build:electron && bun run build:ui                                                # builds passam
(cd rust/orchestrator && cargo test && cargo clippy)                                      # quando mexer no Rust
node scripts/copy-orchestrator.js                                                         # após cargo build --release
```
Para testar na UI, o app roda com `./node_modules/.bin/electron dist-electron/main.js` (dev server Vite em `:5185` se estiver rodando; senão carrega `dist/`).

> ⚠️ **Não execute fluxos reais no repositório do próprio DevFlow** durante testes: os agentes rodam com permissões liberadas e podem editar arquivos. Use um diretório descartável.

---

## Ordem recomendada
1. **Fase 0** (segurança) — poucas linhas, fecha caminhos de execução de código.
2. **Fase 1** itens 9–19 — o "Executar" passa a ser real.
3. **Fase 2** + itens 27–30 — parar de deixar agentes órfãos gastando tokens.
4. Itens **45, 46, 58** — bugs mais visíveis no uso.
5. Resto na ordem das fases.

---

## Fase 0 — Segurança (crítico)

### 1. `ai:prompt` com injeção de shell, bloqueando o app e com resposta falsa
- **Onde:** `electron/main.ts`, handler `ipcMain.handle('ai:prompt', …)` (~408-431). Chamado por `askOmbro` e pelo Maestro no canvas, e por `executeWorkflow`.
- **Problema:** monta `execSync(\`claude … -p "${prompt}"\`)` escapando só `"`; `$(…)`, crases e `\` executam no shell. `execSync` com timeout 25s congela o processo main. Erro do CLI volta como `{response: '[Claude Code CLI Output]: …'}` (parece sucesso). Para `model !== 'claude-headless'` retorna um markdown fixo fingindo ser "Google Antigravity Agent (AGY v2.4)".
- **Como reproduzir:** criar um nó com título `$(say oi)` e perguntar algo no Ombro → o macOS fala "oi". Perguntar qualquer coisa → app trava até a resposta.
- **Correção:** reescrever sem shell e assíncrono. Opção mais curta: reaproveitar a lógica do `ai:runCli` (spawn com args em array) e retornar `{ response }` ou `{ error }`. Apagar o retorno fixo "AGY v2.4". Manter as flags das skills (`skillsService.cliArgs('claude')`).
- **Aceite:** título com `$(…)` não executa nada; app continua responsivo durante a pergunta; falha do CLI aparece como erro no Ombro, não como resposta; nenhum texto fixo de "Antigravity" é retornado.

### 2. `window.open` sem handler → janela com acesso ao `electronAPI`
- **Onde:** `electron/main.ts`, `createWindow` (~61-91). Não há `setWindowOpenHandler` nem `app.on('web-contents-created')`.
- **Problema:** o iframe do nó navegador tem `allow-popups` e o próprio `OrchestrationBrowserNode` chama `window.open`. O Electron cria uma `BrowserWindow` herdando `webPreferences` (preload, `sandbox:false`) → um site vira RCE via `electronAPI.shell.exec`.
- **Correção:** logo após criar a janela:
  ```ts
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ```
  Idealmente também em `app.on('web-contents-created', (_, wc) => wc.setWindowOpenHandler(...))` para cobrir webviews.
- **Aceite:** `window.open('https://example.com')` em qualquer frame abre no navegador do sistema; nenhuma janela Electron nova é criada.

### 3. Nó navegador é `<iframe>` sem isolamento
- **Onde:** `OrchestrationBrowserNode.tsx` (~1003-1074, `sandbox` ~1024).
- **Problema:** `allow-scripts` + `allow-same-origin` anulam o sandbox para conteúdo da mesma origem (em dev, `http://localhost:5185`); o iframe compartilha cookies/storage da sessão do app; a allowlist de `will-attach-webview` em `main.ts` não se aplica a iframe.
- **Correção:** trocar por `<webview partition="persist:orch-browser" …>` (o app já tem `webviewTag:true` e o filtro `will-attach-webview`), ou no mínimo remover `allow-same-origin` e bloquear no `handleNavigate` a origem do próprio app. Adicionar `session.fromPartition('persist:orch-browser').setPermissionRequestHandler((_, __, cb) => cb(false))`.
- **Aceite:** abrir a URL do próprio app no nó não dá acesso a `window.parent.electronAPI`; login feito no nó não vaza para a sessão do app.

### 4. `shell:openExternal` aceita qualquer esquema
- **Onde:** `electron/main.ts` handler `shell:openExternal` (~1060). Fontes: `handleOpenUrlFromNode` no canvas (~596), URLs detectadas na saída do terminal, input do nó navegador.
- **Correção:** no handler: `if (!/^(https?:|mailto:)/i.test(url)) return { success: false, error: 'esquema não permitido' };`
- **Aceite:** `file:///Applications/Calculator.app` não abre nada; `https://…` continua abrindo.

### 5. Maestro digita instruções da IA num zsh
- **Onde:** `handleMaestroRecruit` (~1334-1450, criação dos nós ~1536-1538) + `getInitialCliCommand`.
- **Problema:** agentes recrutados nascem `type: 'tool'` sem provider/command → `getInitialCliCommand` retorna `''` → abre zsh puro. Depois de `setTimeout(2500)`, `"Seu papel: … ${role.instructions}\r"` é escrito no PTY → **executado como comando**.
- **Correção:** criar recrutados como `type: 'model'` com `provider` (o selecionado ou o do Maestro). Passar o papel como argumento do CLI (item 23), não digitado no PTY.
- **Aceite:** recrutar agente abre o CLI de IA, e o papel chega como system prompt; nenhum texto é executado no shell.

### 6. Relay escreve em shells
- **Onde:** `sendRelayMessage` (~880-889), auto-relay (~1640-1647), `getConnectedAgentTargets` (~876).
- **Problema:** destinos incluem nós `tool`/`ide` (shells); resumo de um agente + `\r` vira comando.
- **Correção:** em `getConnectedAgentTargets`, filtrar só nós de IA (`type === 'model' || type === 'agent'` com provider).
- **Aceite:** conectar agente → ferramenta shell e disparar relay não escreve nada no shell.

### 7. Permissões totais sempre ligadas, sem consentimento
- **Onde:** `electron/main.ts` (~664-683, `ai:runCli`), `src/App.tsx` (~5744-5751, fallback), `rust/orchestrator/src/lib.rs` (~389-452), check morto em `lib.rs:~363`.
- **Problema:** `--dangerously-skip-permissions` (Claude/agy) e `--dangerously-bypass-approvals-and-sandbox` (Codex) em todos os modos. Modo `plan`/`ask` não restringe nada (a fase "planning" do autônomo tem permissão total).
- **Correção:** no Rust, por modo: `plan`/`ask` → Claude `--permission-mode plan`, Codex `--sandbox read-only`; só `execute` usa bypass. Remover o check inalcançável. Adicionar uma confirmação única na UI ("Os agentes vão rodar com permissão para editar arquivos e executar comandos em <cwd>") salva por projeto.
- **Aceite:** fase planning não consegue editar arquivo; primeira execução pede consentimento.

### 8. IPC `ai:orchestrate` sem validação
- **Onde:** `electron/main.ts` `ai:orchestrate` (~511), `orchestrator-service.ts` (~32-50); janela com `sandbox:false`, sem CSP (`main.ts:~75`).
- **Correção:** allowlist de `provider` (`claude|codex|antigravity`); exigir `cwd` existente e dentro de um workspace conhecido; verificar `event.senderFrame === mainWindow.webContents.mainFrame`. Adicionar `<meta http-equiv="Content-Security-Policy">` restritiva em `index.html` (testar que Vite/HMR continuam funcionando).
- **Aceite:** chamada com provider desconhecido ou cwd fora do workspace é rejeitada com erro.

---

## Fase 1 — Execução de verdade

### 9. `executeWorkflow` ignora o grafo
- **Onde:** `executeWorkflow` (~2298-2416).
- **Problema:** pega o primeiro trigger e o primeiro model, faz **uma** chamada `ai.prompt(promptText, modelLabel)` (que cai no mock do item 1), marca todas as arestas como ativas, ignora `systemInstruction`, papéis, ramos paralelos, e não passa saída entre nós.
- **Correção:** ordenação topológica a partir do trigger seguindo `edges` (rejeitar ciclos); para cada nó de IA, chamar `window.electronAPI.ai.runCli({ cliCmd, prompt, model, cwd })` com `prompt = systemInstruction + saída do nó anterior`; para `tool`, `shell.exec(command, cwd)`; guardar `output.text` no nó; ativar só a aresta sendo percorrida. Nós em paralelo podem rodar com `Promise.all` por "nível".
- **Aceite:** fluxo Gatilho → Agente A → Agente B: B recebe a saída de A (visível nos logs); nós desconectados não rodam.
- **Teste:** extrair a ordenação para uma função pura e cobrir com `bun test` (linear, ramo, ciclo).

### 10. Diagnóstico falso quando não há resposta
- **Onde:** `executeWorkflow` (~2354-2365).
- **Correção:** apagar o bloco "Diagnóstico de Orquestração" hardcoded. Sem resposta → nó `failed` com `errorMessage`.
- **Aceite:** sem CLI instalado, o nó fica vermelho com o erro real.

### 11. Status marcado em nós que não rodaram
- **Onde:** `executeWorkflow` (~2311-2319 e ~2376-2381).
- **Correção:** atualizar status só dentro do loop do item 9, por nó executado.
- **Aceite:** ferramenta não executada não fica verde.

### 12. Ferramenta shell só roda se a IA falhar; stderr descartado
- **Onde:** `executeWorkflow` (~2341-2351).
- **Correção:** tool roda na sua posição do grafo (item 9); `exitCode !== 0` → `failed`, com `stderr` no log.
- **Aceite:** `bun run test` falhando aparece como falha com a saída.

### 13. Sem cancelar; trava via estado
- **Onde:** `executeWorkflow` (~2298-2300), botões "Executar Fluxo" (~4755, ~5097, ~6508).
- **Correção:** `const runningRef = useRef(false)`; `try { … } finally { setIsExecutingFlow(false); runningRef.current = false }`. Com `isExecutingFlow`, o botão vira **Parar** e chama `ai.cancel(runId)` (depois do item 30, com runId). Estado `cancelled` no nó.
- **Aceite:** duplo clique não dispara duas execuções; Parar interrompe e marca "cancelado".

### 14. Tokens estimados como reais
- **Onde:** `executeWorkflow` (~2371-2374).
- **Correção:** usar `usage` real se o backend retornar (item 43); senão exibir `~N tokens (estimado)`.

### 15. Fluxo padrão copiado do n8n
- **Onde:** workflow inicial (~240-345), `handleAddNode` (~2449, ~2457, ~2471), dock (~5276).
- **Problema:** "When chat message received", "AI Agent / Tools Agent", "OpenAI Chat Model" com provider Claude, "Postgres Chat Memory" (não existe Postgres; nó sem efeito). Todos nascem `status: 'success'`.
- **Correção:** fluxo mínimo em pt-BR — "Prompt" (gatilho) → "Agente" → "Modelo Claude" — com `status: 'ready'`. Remover o nó de memória do padrão e do menu (não tem implementação).
- **Aceite:** instalação nova mostra fluxo em pt-BR, sem checks verdes, sem "Postgres".

### 16. Rótulo "1 item" fixo nas conexões
- **Onde:** criação de arestas (~324/333/342, ~2169, ~2220) e render (~3089-3090).
- **Correção:** não definir `label` padrão; mostrar a pílula só quando a aresta carregou dado numa execução (ex.: número de caracteres/itens do output).

### 17. Check verde para qualquer status
- **Onde:** ícone de status (~3825-3831).
- **Correção:** `Check` só com `status === 'success'`; `idle/ready` sem ícone; `disabled` com ícone de pausa.

### 18. "Ativo" do terminal hardcoded
- **Onde:** ~3504-3525.
- **Correção:** derivar de `busyCliNodeIds` / `onSessionStatus` do PTY, ou remover.

### 19. Estado de execução persistido
- **Onde:** persistência (~1131-1147) e carregamento (~497-519).
- **Correção:** ao carregar: `status === 'running' → 'ready'`, `edge.isActive = false`, `needsAttention = false`.
- **Aceite:** fechar o app durante uma execução e reabrir não deixa nós girando.

---

## Fase 2 — Ciclo de vida dos terminais (PTY)

### 20. PTYs nunca são encerrados
- **Onde:** `confirmDeleteNode` (~2592), `handleResetToDefault` (~2617), `handleSwitchFloor` (~608), `handleDeleteFloor` (~705), dispensa do Maestro (~1334-1450), `NativeXTerm.tsx` (cleanup ~265-280).
- **Problema:** excluir nó / resetar / trocar ou excluir andar / Maestro dispensar deixa `claude`/`codex` rodando em background (tokens + CPU).
- **Correção:** função única `killNodeSessions(ids)` que chama `window.electronAPI.pty.kill(\`${PREFIX}${floorId}-${id}\`)`; usar em todos esses pontos.
- **Aceite:** após excluir o nó, `ps aux | grep claude` não mostra o processo da sessão.

### 21. `initialCommand` reenviado ao reabrir o CLI
- **Onde:** `NativeXTerm.tsx` (~196-203), `pty-service.ts` (`createSession` reaproveita sessão ~257).
- **Problema:** fechar e reabrir o CLI digita `claude …⏎` dentro do claude já rodando.
- **Correção:** `pty.create` retornar `{ reused: boolean }`; NativeXTerm só envia `initialCommand` quando `!reused`.
- **Aceite:** fechar/reabrir o CLI não injeta texto.

### 22. `sessionId` sem o andar
- **Onde:** render do NativeXTerm (~3730: `orchestration-cli-${node.id}`), duplicar andar (~668-673).
- **Problema:** andares duplicados reusam o PTY do Térreo; o agente edita o repositório principal em vez do worktree.
- **Correção:** `sessionId = \`${PREFIX}${activeFloorId}-${node.id}\`` (e usar a mesma função no relay/kill). Mover `ORCHESTRATION_CLI_SESSION_PREFIX` para constante de módulo.
- **Aceite:** o mesmo nó em dois andares tem dois terminais, cada um no seu cwd.

### 23. Papel injetado por `setTimeout(2500)`
- **Onde:** `toggleNodeCli` (~1531-1538).
- **Correção:** para Claude, montar `initialCommand` com `--append-system-prompt '<papel>'` (escapar aspas simples); para outros CLIs sem flag equivalente, enviar como primeira mensagem **só após** detectar o prompt do CLI (via `onSessionStatus`), nunca por tempo fixo. Limpar o timer se o card fechar.
- **Aceite:** CLI lento não recebe o papel no zsh; fechar o card antes não injeta nada.

### 24. Flutter: `stop` nunca chamado; listener com deps erradas
- **Onde:** `useEffect` do listener (~2527-2562), "Rodar Flutter" (~2564-2579).
- **Correção:** guardar `selectedNodeId`, `nodes`, `edges`, `handleOpenUrlFromNode` em refs e registrar o listener uma vez (`[]`); chamar `flutter.stop(flutterRunIdRef.current)` antes de um novo run e no unmount.
- **Aceite:** rodar Flutter duas vezes deixa só um `flutter run` ativo.

### 25. Excluir andar sem matar os PTYs dele
- **Onde:** `handleDeleteFloor` (~705-730).
- **Correção:** `killNodeSessions(nósDoAndar)` antes de `worktreeRemove`.

### 26. `cliOriginalPositionsRef` não limpo ao trocar de andar
- **Onde:** `handleSwitchFloor` (~608-630).
- **Correção:** `cliOriginalPositionsRef.current = {}` junto com `expandedCliNodes`.

---

## Fase 3 — Backend do orquestrador

### 27. Caminho do manifest/cwd vem de `process.cwd()`
- **Onde:** `orchestrator-service.ts` (~24 `manifestPath`, ~135 `cwd`).
- **Problema:** app aberto pelo Finder tem `cwd = /` → `spawn` falha com ENOENT.
- **Correção:** `manifestPath` a partir de `app.getAppPath()`; `cwd` do spawn = `input.cwd || os.homedir()`.
- **Aceite:** abrir o app pelo Finder e rodar uma execução orquestrada funciona.

### 28. Cancelar não mata a árvore de processos
- **Onde:** `orchestrator-service.ts` (~66-96, ~135); Rust `lib.rs` (spawn ~447).
- **Correção:** Node: `spawn(..., { detached: process.platform !== 'win32' })` e `process.kill(-child.pid, 'SIGTERM')` + SIGKILL após 3s. Rust: `Command::process_group(0)` e, no timeout/SIGTERM, `libc::kill(-pgid, SIGTERM)`.
- **Aceite:** cancelar uma execução mata o `claude` filho (confirmar com `ps`).

### 29. Leitores travam com processos netos
- **Onde:** `lib.rs` (~506-508, ~530, ~543).
- **Correção:** após `child.wait()`/kill, não dar `join` bloqueante nos readers: drenar com `recv_timeout` curto e descartar os handles.
- **Aceite:** agente que sobe `bun run dev &` termina a execução normalmente.

### 30. Cancel com `runId` desconhecido cancela tudo
- **Onde:** `orchestrator-service.ts` `cancel` (~66-80); `main.ts` `ai:cancel`; `App.tsx` (~5302) chama sem runId.
- **Correção:** com `runId` inexistente → `return false`. O chat passa seu próprio `runId`.
- **Aceite:** Ctrl+C no chat não cancela execuções autônomas.

### 31. Gemini/Ollama viram Claude em silêncio
- **Onde:** `main.ts` `ai:runCli`, ramo orquestrador (~736-739).
- **Correção:** providers não suportados pelo orquestrador usam o caminho direto (ou retornam erro claro).

### 32. Modelo não normalizado no caminho orquestrado
- **Onde:** `main.ts` (~741-746 vs normalização ~632-658); Rust `lib.rs` (~401 Claude sem filtro de "default").
- **Correção:** extrair a normalização do caminho direto para uma função e aplicar antes de `orchestratorService.run`; no Rust ignorar `""`, `default`, `padrão` para todos.

### 33. Eventos sem `runId`
- **Onde:** `orchestrator-service.ts` `forwardEvent`; canal único `ai:orchestrator-event`.
- **Correção:** `onEvent?.({ ...event, runId })`; renderer filtra pelo runId que iniciou.
- **Aceite:** duas execuções simultâneas não misturam logs.

### 34. Unsubscribe remove o listener errado (bug)
- **Onde:** `electron/preload.ts` `ai.onOrchestratorEvent` (~181).
- **Problema:** o retorno faz `removeListener('flutter:event', handler)`.
- **Correção:** `removeListener('ai:orchestrator-event', handler)`.
- **Aceite:** montar/desmontar a tela várias vezes não duplica eventos.

### 35. Modo autônomo: sem cancelamento, regex frouxa, histórico sobrescrito
- **Onde:** `autonomous-service.ts` (~26-29, ~49, ~56, ~78-81, ~36, ~60).
- **Correção:** `Set<string>` de runs cancelados, checado antes de cada fase (retorna `failed`/"cancelado" e **não** atualiza o GitHub); usar a **última** ocorrência de `/STATUS:\s*(PASS|FAIL)/gi`; `state.phases.push({...})` e persistir o estado inteiro.
- **Aceite:** cancelar entre fases para tudo; resposta que cita a instrução "STATUS: PASS" no meio não é aprovada.

### 36. Status "cancelado" volta para "rodando"
- **Onde:** `src/components/ProjectsSchedulerView.tsx` (~3018-3025, ~3060-3066).
- **Correção:** ignorar eventos e o resultado do `autonomousRun` quando o runId já está marcado como cancelado.

### 37. Binário: empacotamento e versão
- **Onde:** `orchestrator-service.ts` `binaryCandidates` (~117-126); Rust `RunRequest`.
- **Problema:** no app empacotado o binário fica no asar e o fallback é `cargo`; um binário velho ignora `extra_args` sem erro (serde aceita campos desconhecidos).
- **Correção:** `app.isPackaged` → só `path.join(process.resourcesPath, 'bin', name)` (+ `.exe` no Windows), nunca `cargo`. No Rust, `#[serde(deny_unknown_fields)]` em `RunRequest` (declarando `run_id`, `operation`) ou `protocol_version` no payload.

### 38. Resultado = última linha do stdout; UTF-8 cortado
- **Onde:** `orchestrator-service.ts` (~148-167).
- **Correção:** `child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')`; aceitar como resultado só a linha JSON com a chave `ok`; senão montar erro com `code`/`signal`/`stderr`. Guardar só essa linha, não o stdout inteiro.
- **Aceite:** texto com "ção" chega íntegro; morte do processo mostra o motivo real.

### 39. `is_error` do Claude stream-json vira sucesso
- **Onde:** `lib.rs` (~544-551, `parse_jsonl`).
- **Correção:** `is_error == true` → `Err` com o texto; em exit ≠ 0 anexar as últimas linhas do stdout.

### 40. Claude sem `--add-dir`; falta `--` antes do prompt
- **Onde:** `lib.rs` ramo Claude (~391-406), Codex (~404-405).
- **Correção:** `--add-dir <dir>` para cada `additional_dirs` no Claude; inserir `"--"` antes do prompt no Claude e no Codex.
- **Aceite:** prompt começando com `-` funciona; diretórios extras acessíveis no Claude.

### 41. Env não limpa no caminho orquestrado
- **Onde:** `orchestrator-service.ts` (~128-132) vs `main.ts` `cleanEnv` (~716-727).
- **Correção:** extrair `cleanEnv()` e usar nos dois caminhos.

### 42. Histórico de runs sem limite
- **Onde:** `orchestrator-service.ts` `persist` (~98-113), `autonomous-service.ts` (~103-108); pasta `~/.devflow/orchestrator/runs`.
- **Correção:** nome `${Date.now()}-${runId}.json`; após gravar, apagar os mais antigos mantendo os 200 mais recentes.

### 43. Resposta sem `cancelled`/`usage`/exit code real; clippy; código morto; tipos
- **Onde:** `orchestrator-service.ts` (~56-61), `lib.rs:473` (`lines().flatten()`), `lib.rs:588` (`.enumerate()` sem uso), `lib.rs` `Scheduler`/`TaskAnalysis`/`depth` (~78-247), `main.rs` operação `plan` (~41-59), `src/electron.d.ts` (~120-123).
- **Correção:** retornar `{ stdout, stderr, exitCode, cancelled, usage }`; `lines().map_while(Result::ok)`; remover `Scheduler`, `TaskAnalysis`, `depth` e a operação `plan` (não usados); exportar `OrchestratorRunInput` e importar no `electron.d.ts`; remover APIs do preload não usadas pelo renderer.
- **Aceite:** `cargo clippy` sem warnings.

### 44. Testes do orquestrador
- **Correção:** Rust: extrair `build_args(&RunRequest) -> Vec<String>` e testar por provider/modo (incluindo `extra_args` e `--`). Node: `bun test` com um "binário" fake (script que imprime JSONL / dorme) cobrindo timeout, cancel e parse de resultado.

---

## Fase 4 — Interação no canvas

### 45. Container dos nós intercepta cliques nos cabos
- **Onde:** div dos nós (~5054-5062) por cima do SVG de cabos (~4995-5051).
- **Correção:** `pointerEvents: 'none'` no container e `pointerEvents: 'auto'` em cada card.
- **Aceite:** clicar/arrastar cabo e o botão de desconectar funcionam em qualquer ponto.

### 46. Modal "Configurar nó" é código morto
- **Onde:** `setConfiguringNodeId` (declarado ~904) só recebe `null`; modal ~6791-7238; item de menu "Configurar Nó" (~6468-6477).
- **Correção:** o item de menu chama `setConfiguringNodeId(targetId)`.
- **Aceite:** é possível editar o comando de uma Ferramenta Shell e a temperatura de um modelo.

### 47. Overlay não cobre arraste de cabo nem pan
- **Onde:** overlay (~4814-4831), condição `resizingNode || draggingNodeId`.
- **Correção:** incluir `draggingLink || isPanning`.
- **Aceite:** arrastar cabo por cima de terminal/navegador não trava.

### 48. Drop sem validação
- **Onde:** drop por bounding box (~2137, ~2163-2180).
- **Correção:** exigir `n.ports.input`; rejeitar self-loop, aresta duplicada e ciclo (BFS de `toNodeId` até `fromNodeId`).

### 49. Cabo fantasma
- **Onde:** botões de saída (~4042-4047, ~4100-4105, ~4144-4149) chamam `handleStartDraggingLink` em `onMouseDown` **e** `onClick`.
- **Correção:** remover do `onClick`.

### 50. Keydown com deps velhas; Cmd+K dentro do terminal
- **Onde:** keydown global (~2718-2796; atalhos ~2775-2781).
- **Correção:** adicionar `isAiPickerOpen`, `nodeOptionsPopup`, `activePopupNode`, `handleDuplicateNode`, `handleToggleNodeStatus` às deps (ou ler de refs). Ignorar Cmd+K/Cmd+Shift+O quando o foco estiver em `input`, `textarea`, `[contenteditable]` ou dentro de `.xterm`, e quando `activeTab !== 'canvas'`.
- **Aceite:** Delete com o menu "…" aberto mostra uma confirmação só; Cmd+K no terminal limpa o terminal.

### 51. Dois fluxos de exclusão
- **Onde:** confirmação inline no popup (~5870-5881) vs `ConfirmDeleteModal`/`confirmDeleteNode` (~7195, ~2592).
- **Correção:** o popup chama `setNodeToDelete`; `confirmDeleteNode` limpa `expandedCliNodes`, `nodeIncomingUrls`, estados `maestro*`, `cliOriginalPositionsRef` e mata PTYs (item 20).

### 52. "Fechar CLI" desfaz reorganização
- **Onde:** `toggleNodeCli` (~1584-1600).
- **Correção:** restaurar só os nós empurrados pelo CLI que não foram movidos depois (comparar posição atual com a posição "empurrada" salva).

### 53. Limites de zoom inconsistentes
- **Onde:** botões (~4688, ~4704) vs `performZoomAt` (~1178).
- **Correção:** botões chamam `performZoomAt` no centro do canvas com os mesmos limites (0,3–2,5).

### 54. Aba "Execuções" desmonta o canvas
- **Onde:** render condicional (~4790-5603) por `activeTab === 'logs'`.
- **Correção:** manter o canvas montado e esconder com `display: 'none'`.
- **Aceite:** ir e voltar de "Execuções" preserva terminais e páginas.

### 55. Menu "…" cortado nas bordas
- **Onde:** posição com `popupHeight = 280`, `popupWidth = 230` (~3757-3771, ~3301-3315).
- **Correção:** `maxHeight: calc(100vh - 16px)` + `overflowY: auto` e clamp com a medida real (`getBoundingClientRect` após montar).

### 56. Nó navegador nasce cortado
- **Onde:** `getNodeDimensions` (~1291-1295), `handleAddNode` (~2424).
- **Correção:** limitar largura inicial a `(canvasWidth - x - 360) / zoom` e chamar `handleFocusNode` no nó novo.

### 57. Handlers de mouse duplicados
- **Onde:** overlay (~4794-4795) e canvas pai (~4828-4829).
- **Correção:** remover do overlay (o pai já recebe por bubbling).
- **Aceite:** auto-pan na borda com velocidade normal.

---

## Fase 5 — Painéis

### 58. Ombro × Andares × barra × painel do nó
- **Onde:** Ombro `OrchestrationOmbroPanel.tsx` (~72-81: `fixed; top:70; right:20; width:320; z:970`); dropdown Andares (~4489-4502, z960); Escape (~2727-2738, ~431); painel de instrução (~5299, z65).
- **Problemas vistos em runtime:** Ombro cobre zoom e "Executar Fluxo"; Andares abre por baixo do Ombro; Esc não fecha nada disso; painel do nó fica sob o Ombro.
- **Correção:** Ombro com `top` = base da barra de ferramentas; abrir Andares fecha o Ombro e vice-versa; dropdown de Andares ancorado com `right: 0`; Esc fecha Ombro, Andares, Simulador e o painel de instrução; com Ombro aberto, painel inferior com `right: 340`.
- **Aceite:** nenhum painel cobre botões da barra; Esc fecha o painel aberto.

### 59. Ombro — conteúdo
- **Onde:** `OrchestrationOmbroPanel.tsx` (~40-65, ~134-146, ~168-184, filtro ~44); `nodeSummaries` (~1616-1640).
- **Correção:** entrada "Consultando…" enquanto `isBusy`; auto-scroll para a última resposta; input `disabled` durante a espera; `catch` que registra "Erro: …"; incluir nós com `nodeSummaries[n.id]` (inclui `ide`); guardar resumos por andar e limpar ids removidos.

### 60. Simulador
- **Onde:** `OrchestrationSimulatorPanel.tsx` (~36-69, ~114, ~133-136); `main.ts` `capture:listWindows` (~536-542); `handleOpenSimulatorCapture` (~2586-2590); item da paleta (~4362).
- **Problemas:** stream continua após fechar (indicador de gravação do macOS aceso); reabrir → vídeo preto; filtro por título "simulator" nunca acha (títulos são "iPhone 16 Pro…"); item "Rodar Simulador iOS" só captura; sem tratamento de permissão.
- **Correção:** effect com `[isOpen, selectedId]` que para as tracks quando `!isOpen` e `setSelectedId(null)` no fechar; filtrar por `/iphone|ipad|simulator/i` ou listar todas com busca; renomear para "Capturar janela do Simulador iOS" (ou rodar `open -a Simulator` antes); `try/catch` com mensagem sobre a permissão de Gravação de Tela (`systemPreferences.getMediaAccessStatus('screen')`); botão "Tentar novamente".

### 61. Nó navegador
- **Onde:** `OrchestrationBrowserNode.tsx`.
- **Correção (itens independentes):**
  - `onError` do iframe não dispara com X-Frame-Options (~1062-1066, ~1093-1136): remover atalhos Google/GitHub (~387-388); detectar falha (com `<webview>`: `did-fail-load`).
  - `shouldOpenNewTab` sempre `true` (~190-218): `const shouldOpenNewTab = incomingUrl.openInNewTab && !isDefaultBlankTab;`
  - Aviso "✦ Aberto de" nunca some (~171-172, ~220-221): timer em `useRef`, limpo só no unmount.
  - Cadeado verde sempre (~856): só com `https:`.
  - Iframe vivo por aba (~1003-1074): descarregar abas inativas antigas (`src="about:blank"`) acima de N.
  - Abas lidas das props só na montagem (~111-134): sincronizar quando `initialTabs` mudar ou usar `key` com o andar.
  - Aba nova abre `localhost:5173` (~262, ~285, ~384): abrir `about:blank` com foco na barra.
  - Qualquer Ctrl/Cmd desliga `pointerEvents` do iframe (~82-109, duplicado no Canvas ~1190-1215): reagir só a `Control`/`Meta` e usar só a prop `isCtrlOrMetaPressed`.
  - `wheel` usa `e.currentTarget` após o handler (~1030-1045): capturar `const iframeEl = e.currentTarget` antes.
  - Fallback `electronAPI.openExternal` inexistente (~376-379): remover; usar só `shell.openExternal`.
  - Props `nodeId`, `width`, `height` não usadas (~65-70): remover.
  - Bolinhas amarela/verde decorativas (~471-488): remover ou implementar minimizar/expandir.

### 62. Paleta de comandos
- **Onde:** `OrchestrationCommandPalette.tsx` (~22, ~36, ~64-71, ~137-180); itens no Canvas (~4333-4367, "Novo Andar" ~4351).
- **Correção:** `selectedIndex` = `Math.max(0, Math.min(prev + 1, len - 1))`; `scrollIntoView({ block: 'nearest' })` no selecionado; ignorar Enter com `e.nativeEvent.isComposing`; remover prop `hoverBg` não usada; renomear "Novo Andar" para "Andares…" ou criar o andar de fato.

### 63. Ações destrutivas sem confirmação
- **Onde:** excluir andar e aterrissar (~4570-4585 → `handleDeleteFloor`/merge), "Restaurar Fluxo Padrão" (~5105-5110 → `handleResetToDefault`), "Limpar Histórico" (~5632-5645).
- **Correção:** usar o `ConfirmDeleteModal` existente nas quatro.

---

## Fase 6 — Polimento

### 64. Dock lateral
- **Onde:** dock (~5085-5295), `renderToolbarButton`, tooltip por `hoveredToolbarButton` (~4241-4284).
- **Correção:** `title={label}` e `aria-label={label}` no `<button>`; ícone distinto para "IDE Workspace" (ex.: `Code2`) vs "Ferramenta CLI" (`Terminal`); remover "Adicionar Nó" (duplica "AI Agent") ou transformá-lo em menu.

### 65. Rótulos em inglês
- "AI Agent", "Tools Agent", "Chat Model" (~4106), "IDE Workspace" (~5284), tipo do nó na paleta (`Ir para • ${n.type}` ~4347) e `type.toUpperCase()` no popup (~6260). Traduzir e mapear tipo → nome em pt-BR.

### 66. Acessibilidade
- Nenhum `aria-label`/`role`/`tabIndex` no arquivo. Adicionar `aria-label` em botões só-ícone (zoom, "…", portas, fechar, lixeira/aterrissar dos andares); `role="menu"`/`menuitem` nos menus com navegação por setas; foco inicial no primeiro item e devolução ao fechar.

### 67. Tema claro e contraste
- Partículas/brilho dos cabos de memória com `#ffffff` fixo (~2981, ~2998, ~4933) → usar `wireColor`. Texto `#ffffff` sobre `accentColor` (~4755-4785, ~5680-5687, ~3684) → cor calculada pela luminância (já existe `accentContrastText`/`getContrastTextColor` no app — reutilizar).

### 68. Performance — desenho
- Camada de brilho com blur 55px num SVG 5000×5000 recalculada a cada render (~4836-4978): `useMemo` e desligar durante drag. Extrair `NodeCard` com `React.memo`; hover de card/dock por CSS em vez de estado do componente raiz (~1094, ~1123, ~5063).

### 69. Performance — cálculos e gravação
- `nodes.find` por aresta (O(E·N)) (~2946-2950, ~1818-1819, ~3150, ~3529): `useMemo` de `Map` id→nó e de arestas por nó. `localStorage.setItem` a cada mousemove (~1131-1135, ~1996): debounce ~300ms ou salvar no mouseup. `commandPaletteItems` nunca memoiza porque `handleAddNode` é recriado (~4333-4367): `useCallback`.

### 70. Sincronização de modelos sobrescreve o escolhido
- **Onde:** ~733-769.
- **Correção:** não reescrever `config.model` enquanto `activeModels[provId]` não carregou; remover a dep `selectedModel` não usada.

### 71. localStorage sem validação/migração
- **Onde:** carregamento (~497-519, ~611-621; chaves `_v9`).
- **Correção:** normalizar ao carregar (`ports ??= { input: [], output: [] }`, `config ??= {}`), junto com o item 19.

### 72. Código morto e mutações
- Estado `contextMenu` nunca recebe valor (~1150-1156) → remover. `resizingNode.hasDragged = true` muta estado (~1903) → ref. `ORCHESTRATION_CLI_SESSION_PREFIX` declarado dentro do componente (~1613) e literal repetido (~3730) → constante de módulo.

### 73. Timers e promises sem tratamento
- `setTimeout` de 3,5s do pulso das arestas (~560-564) → ref + limpar no unmount/troca de andar. `load()` das skill flags sem `try/catch` (~1473-1482) → `try/catch` com `console.warn`.

### 74. Detalhes visuais
- Badge numérico (Cmd pressionado) sobre o botão "…" (~3834-3855 vs ~3746-3787) → mover para outro canto. Grip de resize perde opacidade no hover (~4202-4207) → mesma expressão do estilo (~4198).

### 75. Botão de relay com texto vazio
- **Onde:** ~6174-6176.
- **Correção:** `disabled={!relayDraft.trim()}`.

---

## Checklist de conclusão
- [x] Fase 0 (1–8) — Segurança (crítico)
- [x] Fase 1 (9–19) — Execução de verdade
- [x] Fase 2 (20–26) — Ciclo de vida dos terminais (PTY)
- [x] Fase 3 (27–44) — Backend do orquestrador
- [x] Fase 4 (45–57) — Interação no canvas
- [x] Fase 5 (58–63) — Painéis
- [x] Fase 6 (64–75) — Polimento

Ao terminar cada fase: rodar a seção **Como verificar**, testar manualmente os critérios de **Aceite** num diretório descartável e marcar o checklist.

---

## Rodada 2 — revisão geral e QA (2026-10-19)

Auditoria do código atual (o canvas passou de ~7.300 para ~11.800 linhas depois da rodada 1: nós de projeto, git, andares), `bunx tsc`, testes automatizados, e QA no app real via DevTools Protocol. **Tudo abaixo foi verificado e corrigido.**

### Como foi testado
- `cd rust/orchestrator && cargo test && cargo clippy --all-targets`: 15 testes (8 unitários + 7 de integração em `tests/fake_provider.rs`, com provedores falsos no PATH: sucesso, falha, UTF-8 inválido, timeout, SIGTERM ignorado e cancelamento do orquestrador).
- `bun test`: 519 testes, incluindo `tests/orchestrator-service.test.ts` (serviço Node + binário Rust real + `claude` falso), `orchestration-session`, `orchestration-ports-matcher` e `design-ai-edit-bulk`.
- QA no app: Electron com `--remote-debugging-port=9333 --user-data-dir=<tmp> --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` (sem os flags o loop de render pausa e o FigCraft para de responder). Semeie o `localStorage` com `Page.addScriptToEvaluateOnNewDocument` (o `beforeunload` da tela grava o estado em memória por cima de qualquer coisa semeada antes do reload). **Nunca clique "Executar Fluxo" no fluxo padrão durante o QA**: ele inicia um agente real com permissões totais no workspace; use um fluxo semeado só com nós `tool` (`echo`).

### Bugs corrigidos
**Runner Rust**
- Cancelar o orquestrador **não matava o provedor** (ele roda em outro grupo de processos): agora há handler de SIGTERM/SIGINT/SIGHUP que encerra o grupo do provedor; o provedor também é encerrado se quem o iniciou morrer.
- Timeout só mandava SIGTERM e travava para sempre se o provedor o ignorasse: SIGTERM, 3 s, SIGKILL no grupo todo.
- Linha de saída com UTF-8 inválido encerrava o leitor e o provedor travava com o pipe cheio: leitura por bytes.
- Antigravity em modo `plan`/`ask` rodava com `--dangerously-skip-permissions`: agora usa `--mode plan`.
- `--version` sem limite de tempo; `println!` com pipe quebrado entrava em pânico.

**Backend Electron**
- `OrchestratorService`: resultado com `cancelled: true`/exit 130, `cancelByTag` (o Parar do chat não cancela execuções autônomas), validação de provider e pasta; `runCli` passa o `streamId` como runId, respeita a política de permissões salva (política restritiva usa o caminho direto) e só aceita CLIs conhecidas; `ai:orchestrate`/`ai:orchestratorProviders` agora têm handler.
- O app **não encerrava nada ao sair**: `before-quit` cancela orquestrador, prompts, execuções diretas, Flutter e PTYs.
- PTY: `onExit` de uma sessão antiga apagava a sessão nova; `sendOutput` abria um zsh para qualquer id; sessão só de saída (`ai-stream`) impedia o CLI real de abrir; `cd`/modelo digitados no shell sem escape; `agy` fora do PATH do shell quebrava o terminal; novo `pty.cancelPrompt` (Parar termina o await do nó em vez de esperar até 5 min).
- Injeção de shell: `ports:kill`, `git clone/worktree/blame` (agora `execFile` + validação de URL), `pty` (aspas simples).
- Skills: `name: ..` no frontmatter apagava `~/.devflow` (`dirOf()` valida o id); `openFolder`/`read`/`save` validados.
- `landWorktree` recusa andar com alterações não commitadas e desfaz o merge em conflito (antes o repositório ficava em MERGING e em outra branch).
- Flutter: resolve o binário no PATH do app, mata a árvore ao parar, emite `exit` em falha de início.
- Autônomo: cancelamento antes da fase iniciar, limpeza de `cancelledRuns`, histórico apagado por data (não por UUID).
- `runCli`: caractere multibyte partido entre chunks e última linha do stream-json perdida; `shell:exec` mata a árvore no timeout e grava `~/.claude.json` de forma atômica; timeout do `ai:prompt` escala para SIGKILL.

**Tela de Orquestração**
- `parseOrchestrationCliSessionId` quebrava em andares criados pelo usuário (`floor-<ts>`): todos os eventos do terminal eram descartados (card sem atenção, Ombro, auto-relay).
- `OrchestrationProjectNode`: sem imports (`fetchAllGitProjects`, `cloneGitRepository`) e loop infinito de varreduras (`existingDevUrls = []` + `onUpdateConfig` inline nas deps); porta própria do projeto contada como ocupada; `devUrl` não era passado.
- Motor de execução: falha de nó agora **pula os dependentes** ("Pulado: …"); exceção em qualquer ponto não deixa o nó em `running`; ferramenta shell decide por código de saída (stderr com código 0 é sucesso); sessão do nó usa o andar da execução; Parar não cancela mais chat/Maestro/Design nem manda Ctrl+C a terminais fora da execução.
- Relay: nó ficava `running` para sempre, escrevia no andar errado e abria claude.ai/x.com por "o Claude sugeriu x".
- Persistência: última edição perdida ao trocar de andar/fechar; dado corrompido (item nulo, zoom 0, andares inválidos, andar ativo inexistente) derrubava a tela; estado de UI do andar anterior ficava no novo; excluir andar recriava as chaves dele.
- `wouldCreateCycle` com argumentos trocados em `handleConnectNodes`; duplicata de aresta; ids de nó/aresta com colisão; reencaixe de cabo perdia id/rótulo/auto-relay (e soltar no vazio apagava sem aviso); `mouseup`/`mousemove` rodavam em dobro (overlay + canvas); menu "…" cortado (`overflow: hidden` anulava o scroll); Flutter parado a cada render do App; consentimento perdia o gatilho de partida; fechar CLI/projeto desfazia o arraste manual dos vizinhos; novos nós nasciam empilhados.
- Maestro: `update_node` apagava título/subtítulo; resposta caía em outra conversa; `$node-N` desalinhava; recrutamento sem proteção de reentrada, sem validar o JSON e podia dispensar o próprio Maestro/projetos; `handleMaestroOpenProject` abria/subia o projeto errado.
- Utilitários: casamento de projetos irmãos (`estancia-bahia-api` × `-painel`), verbos coloquiais ("abre", "roda"), porta de proxy/banco lida como porta do dev, porta padrão por framework (Next/CRA 3000, Angular 4200, Astro 4321), `extractPortFromUrl`, detecção de URL com cores ANSI do Vite.
- Também: Simulador vazava a captura de tela, nó de navegador (timers de aba fechada, voltar/avançar com URL errada, `file:`).

### Teste do fluxo "agente pede para abrir algo no navegador" (Gatilho → Agente → Modelo → Navegador, com Antigravity e com Claude)
Bugs encontrados e corrigidos:
- Pasta nova no Claude: o diálogo "Você confia nesta pasta?" (padrão "Não, sair") engolia o prompt e o nó falhava com "CLI encerrado antes de processar o prompt". `ensureClaudeWorkspaceTrust()` pré-confia a pasta (atômico) ao abrir o terminal de IA da Orquestração.
- O **modelo-trabalhador** ligado só ao agente rodava, com permissões totais, no **repositório do app** (não no projeto do fluxo): o motor e o card do terminal só olhavam projetos ligados diretamente, e o card ainda recriava a sessão na pasta errada. `getProjectNodesForNode()` (usado pelos dois) herda o projeto dos nós anteriores.
- O nó de navegador abria sites aleatórios (`g1.globo.com`, `gmail.com`, `github.comnocard...`): (a) o passo 5 do resolvedor casava nome de serviço solto no texto (agora exige verbo de abrir/acessar, módulo `utils/browserUrl.ts` com teste); (b) a URL era raspada da tela crua do terminal do modelo (agora vale: URL declarada pelo agente, pedido do gatilho, e só então a saída); (c) `stripAnsi` apagava o "cursor para a direita" e colava palavras (`stripTerminalControl` converte em espaço); (d) `github.com` e `https://www.github.com/` abriam duas abas (comparação normalizada).
- Observação: o Antigravity em modo interativo leva ~6 min por nó neste fluxo (prompt do fluxo é grande e o modelo roda com esforço alto).

### Pendente / decisões
- `webSecurity: false` e iframe do nó navegador sem `sandbox` (risco já listado nos itens 2–3); `~/.gemini/antigravity-cli/settings.json` é reescrito com permissões totais a cada sessão.
- Soltar um cabo existente no vazio agora o **restaura** (antes apagava); para desconectar use o botão do cabo.
