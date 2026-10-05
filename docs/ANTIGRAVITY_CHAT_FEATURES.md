# Guia Completo e Definitivo de Funcionalidades do Chat IA - Google Antigravity

Este documento consolida o mapeamento exaustivo de todas as funcionalidades, subsistemas, fluxos de mensagem, politicas de seguranca e ferramentas do Chat de IA na IDE Google Antigravity.

---

## 1. Barra Superior e Gestao de Sessoes

- **Titulo da Conversa**: Identificador contextual automatico ou personalizado gerado a partir do primeiro objetivo da conversa (ex: "Execucao De Projeto").
- **Nova Conversa (`+`)**: Inicializa uma nova sessao limpa de trabalho, isolando o historico sem deletar as anteriores.
- **Historico de Conversas**: Lista completa de todas as conversas anteriores com busca, data, hora e capacidade de restauracao instantanea.
- **Menu de Opcoes da Conversa (`...`)**:
  - Exportar sessao completa em Markdown ou JSON.
  - Limpar historico acumulado da sessao.
  - Configurar politicas de permissao especificas para a conversa ativa.
- **Controle de Visualizacao (`X`)**: Minimiza, recolhe ou fecha o painel lateral no layout da IDE.

---

## 2. Linha do Tempo e Inspecao de Execucao

- **Cadeia de Raciocinio Colapsavel (`Chain of Thought`)**:
  - Exibe em tempo real o pensamento analitico do modelo antes de acionar ferramentas.
  - Indicadores dinamicos de status: "Thinking...", "Analyzing...", "Working...".
- **Monitor de Comandos de Terminal (`Ran X commands`)**:
  - Painel expansivel com comando executado, diretorio de trabalho (`cwd`), tempo de execucao, saida padrao (`stdout`), saida de erro (`stderr`) e codigo de encerramento (`exit code`).
- **Rastreador de Buscas e Arquivos (`Explored X files, X searches`)**:
  - Listagem com contadores de termos buscados via ripgrep e arquivos inspecionados.
  - Links navegaveis com precisao de linha (`file.tsx#L10-L40`) que abrem diretamente no editor ao clicar.
- **Sumario de Edicoes em Tempo Real (`Edited file.tsx +X -Y`)**:
  - Contadores em verde e vermelho indicando linhas adicionadas e removidas por arquivo.
- **Barra de Revisao e Aceite de Diffs**:
  - Controle superior ou inferior que indica a quantidade de arquivos modificados pendentes de aprovacao.
  - Paginacao entre alteracoes de arquivos (`Anterior` / `Proximo`).
  - **Reject all**: Desfaz e descarta todas as alteracoes realizadas pelo agente no workspace.
  - **Accept all**: Confirma todas as alteracoes e limpa os marcadores de diff pendentes.

---

## 3. Modos de Entrada, Contexto e Prompt Box

- **Editor de Prompt Multilinha Adaptativo**:
  - Suporta quebras de linha, colagem de blocos de codigo e ajuste vertical automatico.
- **Sistema de Mencoes Inteligentes (`@`)**:
  - `@files` e `@folders`: Vincula caminhos e injeta automaticamente o conteudo dos arquivos no prompt.
  - `@git`: Vincula status do git, branches, commits e diffs ativos.
  - `@terminal`: Vincula o historico recente de saida do terminal integrado.
  - `@rules`: Forca a inclusao de diretrizes especificas de codigo.
  - `@mcp`: Referencia servidores e ferramentas do Model Context Protocol.
  - Menu flutuante com filtro em tempo real e navegacao via teclado (`Setas`, `Enter`, `Tab`).
- **Comandos de Barra Operacionais (`/`)**:
  - `/plan`: Exige criacao de plano estruturado com analise de impacto antes de qualquer edicao.
  - `/goal`: Ativa execucao autonoma com persistencia estrita para metas complexas.
  - `/schedule`: Abre configuracao de lembretes e crons recorrentes em background.
  - `/grill-me`: Inicia uma entrevista investigativa para eliminar ambiguidades tecnicas antes da implementacao.
  - `/learn`: Ensina e persiste padroes de comportamento e preferencias para uso permanente.
- **Anexo de Midia e Imagens (`+`)**:
  - Upload de arquivos visuais para analise de bugs de layout, design systems ou telas de referencia.
  - Suporte a arraste de arquivos (`Drag and Drop`) e colagem da area de transferencia (`Cmd + V` / `Ctrl + V`).
- **Entrada de Voz**:
  - Transcricao de fala para texto em tempo real via microfone embutido.
- **Seletor de Modelos de Linguagem**:
  - Alternancia rapida entre versoes de modelos (Gemini Flash para respostas e tarefas ultra-rapidas, Gemini Pro para raciocinios e refatoracoes de alta complexidade).

---

## 4. Fluxo de Envio e Injecoes Silenciosas de Contexto

- **Injecao Automatica de Estado do Editor**:
  - O chat injeta silenciosamente em cada mensagem:
    - Documento ativo em foco (`Active Document`).
    - Posicao exata do cursor e trecho de texto selecionado.
    - Lista de arquivos abertos em abas secundarias (`Other open documents`).
    - Idioma/linguagem do arquivo ativo.
    - Horario local e sistema operacional.
- **Fila de Mensagens do Usuario (`Message Queue`)**:
  - Mensagens enviadas enquanto o agente trabalha entram na fila e sao executadas sequencialmente na conclusao do passo corrente.
- **Botao de Interrupcao Imediata (`Stop / Cancel`)**:
  - Permite interromper o raciocinio ou matar comandos de terminal em execucao a qualquer momento.
- **Atalhos Operacionais**:
  - `Enter`: Envia a mensagem ou aciona o fluxo da tarefa vinculada.
  - `Shift + Enter`: Adiciona quebra de linha.
  - `Esc`: Fecha menus suspensos de mencao `@` ou comandos `/`.

---

## 5. Fluxo de Processamento, Execucao e Resposta

- **Streaming Contiguo de Resposta**:
  - Tokens entregues progressivamente em tempo real para texto e blocos tecnicos.
- **Despertar Reativo (`Reactive Wakeup`)**:
  - Eliminacao de loops de espera ativa (polling). Quando um processo longo de terminal, teste, cron ou subagente conclui, ele emite uma notificacao prioritaria que acorda o agente automaticamente.
- **Modais Interativos de Decisao (`ask_question`)**:
  - O agente suspende a execucao e renderiza um modal interativo no chat com opcoes de escolha unica ou multipla (`checkboxes`), campo para escrita e botoes de Submit/Skip.
- **Documentos de Artefatos Dinamicos**:
  - Renderizacao de arquivos Markdown estruturados com:
    - Alertas visuais (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
    - Diagramas Mermaid interativos (arquiteturas, grafos de estado, fluxos de dados).
    - Tabelas comparativas.
    - Links clicaveis de arquivos com esquema `file://` e saltos para linhas (`#L20-L45`).
    - Carrosseis de imagens e telas (`carousel`).
    - Botoes de acao incorporados (`Proceed`, `Request Feedback`).
- **Pasta de Rascunhos Persistente (`scratch/`)**:
  - Scripts descartaveis de teste, dumps de banco e scripts de validacao salvos em `<appDataDir>/brain/<id>/scratch/`.
- **Compactacao Automatica de Contexto (`Context Compaction`)**:
  - Ao atingir limites da janela de tokens, o historico e sintetizado mantendo integridade de decisoes, arquivos modificados e requisitos pendentes.
- **Auditoria Permanente (`transcript.jsonl`)**:
  - Registro de cada passo (`step_index`, `type`, `tool_calls`, `content`) para auditoria e rastreabilidade total.

---

## 6. Integracao Direta com o Editor de Codigo

- **Visualizacao de Diffs no Buffer**:
  - Diffs inline diretamente no editor com destaque em verde e vermelho.
- **Code Lenses do Agente**:
  - Botoes de acao rapida acima de classes, funcoes e tipos ("Refactor", "Explain", "Write Tests").
- **Auto-Fix de Diagnosticos**:
  - Disparo de correcao automatica diretamente de erros de compilador, avisos de lint (ESLint) ou painel Problems da IDE.
- **Antigravity Tab (Autocomplete e Supercomplete)**:
  - Predicao de intencao a uma tecla (`Tab`).
  - Sugestoes de multiplas linhas com exclusoes (Supercomplete).
  - Tab to Jump (salto para o proximo ponto natural de edicao).
  - Tab to Import (adicao automatica de imports no topo do arquivo).
  - Aceite palavra por palavra (`Cmd + Seta Direita` / `Ctrl + Seta Direita`).
- **Inline Command (`Cmd + I` / `Ctrl + I`)**:
  - Edicao instruida in-place no codigo selecionado ou geracao de novo codigo no cursor.

---

## 7. Automacao de Navegador e Subagentes

- **Subagente de Browser**:
  - Controle de navegador headless ou visivel para testes E2E, inspecao de DOM, preenchimento de formularios e navegacao.
- **Gravacao em Video WebP**:
  - Gravacao automatica de todas as interacoes do navegador salvas como video WebP nos artefatos da sessao.
- **Permissoes de Navegacao**:
  - Lista de dominios permitidos (`Browser Allowlist`) configuravel no projeto ou globalmente.

---

## 8. Geracao de Imagens e Prototipagem Visual

- **Ferramenta `generate_image`**:
  - Criacao de layouts, mockups de interface e assets visuais a partir de descricoes textuais e imagens de referencia.
  - Proporcoes configuraveis (`1:1`, `16:9`, `4:3`, `3:2`, `9:16`).

---

## 9. Sistema de Conhecimento Local (Knowledge Items - KI)

- **Armazenamento de Contexto do Repositorio**:
  - Armazenado em `<appDataDir>/knowledge` com sumarios, carimbos de data e referencias de implementacao.
  - Identificacao imediata de padroes arquiteturais, solucao de bugs historicos e padroes de refatoracao do projeto antes de iniciar qualquer pesquisa redundante.

---

## 10. Protocolo de Customizacoes: Skills, Rules, Plugins e Hooks

- **Skills (`skills/<nome>/SKILL.md`)**:
  - Manuais de procedimentos em varias etapas, scripts e ferramentas sob demanda.
  - Revelacao progressiva: apenas metadados carregados inicialmente; conteudo completo lido sob demanda pelo agente.
- **Rules (`GEMINI.md`, `AGENTS.md`, `.agents/rules/*.md`)**:
  - Regras hierarquicas descobertas a partir do diretorio do arquivo editado ate a raiz do projeto.
  - Modos `always_on` ou ativados por decisao do modelo.
  - Desduplicacao automatica por caminho de arquivo.
- **Lifecycle Hooks (`hooks.json`)**:
  - Scripts executados em pontos cruciais do ciclo de vida:
    - `PreToolUse`: Validacao ou trava de seguranca antes de executar uma ferramenta.
    - `PostToolUse`: Linters, auto-formatadores ou testes executados apos o uso de uma ferramenta.
    - `PreInvocation`: Scripts executados antes do modelo ser consultado.
    - `PostInvocation`: Scripts executados apos a finalizacao das chamadas.
    - `Stop`: Scripts disparados quando o loop do agente termina.
- **Plugins (`plugins/<nome>/plugin.json`)**:
  - Pacotes que encapsulam skills, regras, hooks e configs MCP em um unico modulo distribuivel.

---

## 11. Seguranca, Permissoes e Sandboxing

- **Politicas de Execucao de Ferramentas**:
  - `always-proceed`: Executa ferramentas sem solicitar aprovacao.
  - `request-review`: Solicita aprovacao humana antes de comandos criticos.
  - `strict`: Exige confirmacao para qualquer modificacao.
  - `proceed-in-sandbox`: Executa comandos dentro de ambiente isolado (sandbox).
- **Acesso a Arquivos Fora do Workspace**:
  - Politicas configuraveis (`allow`, `ask`, `deny`) para prevencao de vazamento de dados fora do projeto.
- **Acesso a Internet**:
  - Controle de conexoes de rede externas (`allow`, `ask`, `deny`).
- **Listas de Permissao / Bloqueio de Comandos**:
  - Allowlist e Denylist para restringir comandos de terminal perigosos (`rm -rf`, formatacoes, etc.).

---

## 12. Model Context Protocol (MCP)

- **Integracao Externa (`mcp_config.json`)**:
  - Suporte ao protocolo MCP para conectar o agente a bancos de dados, servidores de documentacao, APIs internas e ferramentas externas de terceiros de forma padronizada.

---

## 13. SDK Python e Orquestracao Externa

- **Biblioteca `google-antigravity`**:
  - Gerenciador de contexto assincrono `Agent(config)`.
  - Streaming de tokens em tempo real.
  - Streaming de pensamentos (`response.thoughts`) e chamadas de ferramenta tipadas (`response.tool_calls`).
  - Suporte a sessoes interativas via terminal (`run_interactive_loop`).
