# Changelog

Todas as novidades do Aura Dev, da mais recente para a mais antiga.
O app mostra a entrada da versão instalada num modal na primeira abertura após instalar ou atualizar.

Formato de cada versão (a regra completa está em `AGENTS.md`):

- `## [x.y.z] - AAAA-MM-DD`, com seções `### Novidades`, `### Melhorias` e `### Correções`.
- Cada item: `- **Título**: descrição curta, do ponto de vista de quem usa.`
- Prints de referência, quando ajudarem: salve em `public/changelog/x.y.z/` e coloque `![descrição](changelog/x.y.z/nome.png)` logo abaixo do item.

## [Não lançado]

## [1.5.0] - 2026-11-25

### Novidades

- **Versão para Windows**: o app abre e funciona no Windows, com terminal em PowerShell, ícone próprio na barra de tarefas e as IAs instaladas detectadas no sistema.
- **Botões da janela no Windows**: minimizar, maximizar e fechar ficam na ponta direita da header, ao lado da sua foto, e o canto esquerdo fica livre. No macOS nada muda.
- **Login da IA no terminal certo**: quando uma IA pede login ou o código de verificação, o app vai para o terminal onde ela foi iniciada, para você colar o código.

### Correções

- **Daily com cards de outra pessoa**: a Daily deixou de mostrar cards de exemplo, e o nome e a foto nos cards são os do usuário logado.
- **Antigravity pedindo login toda hora**: sem login, o app deixa de chamar a CLI em segundo plano e tenta de novo só depois de alguns minutos.

## [1.4.0] - 2026-11-17

### Novidades

- **Revisão de PR com os outros PRs abertos**: o botão "Outros PRs" ao lado de "Revisar com IA" faz a IA considerar os demais PRs abertos do repositório, para avisar quando um problema já foi resolvido em outro. Fica ativado ou desativado conforme sua escolha.
- **Header com abas agrupadas**: IDE, CLI e Sites ficam num único botão com seta; a seta abre um popup para trocar, e um ponto avisa quando uma IA terminou em alguma delas.
- **Brain no estilo Obsidian**: notas em Markdown com `[[links]]`, grafo interativo com cores, curvas e ajustes, backlinks, tags e escopo "Brain" ou "Projeto". Abre num sidesheet que cobre quase toda a tela.
- **Brain com IA**: gerar, ajustar, recriar e limpar o grafo e as notas, conectar nós soltos e sugerir melhorias no contexto do projeto (aceitar ou recusar cada uma), escolhendo a IA e o modelo no próprio botão.
- **Brain sempre em dia**: aviso quando o projeto andou desde a última atualização, notas que citam arquivos que não existem mais e atualização automática opcional.
- **Brain nas CLIs**: um bloco no `CLAUDE.md`, `AGENTS.md` e `GEMINI.md` leva o mapa do projeto para Claude Code, Codex e Gemini no terminal, gastando menos tokens para entender o projeto.
- **Fila de prompts nos Sites**: envie mais prompts enquanto a IA gera; eles acumulam, são enviados quando ela termina e cada um tem um X para sair da fila.
- **Sites com seções sob medida**: a IA deixou de repetir hero, texto, carrossel, cards e preços, e passou a inventar seções para o negócio seguindo o design do hero.
- **Sites com 3D**: cenas Three.js prontas e recriação da experiência 3D de um site de referência.
- **Imagens anexadas**: miniaturas nas mensagens e no campo de envio, e clique para abrir em tela cheia.
- **Brain aceso**: o botão do Brain na header acende enquanto uma IA usa o contexto do projeto.
- **Revisão de PR**: botão "Solicitar review" no alerta de alterações solicitadas.

### Melhorias

- CLI: o cursor do terminal some quando ele não está selecionado e usa a cor da IA em execução (ou a cor de destaque).
- Header: o botão de link e o X seguem a mesma altura dos demais botões.
- Sites: auditoria visual automática (overflow, contraste, texto cortado) antes de entregar, imagens sem perda de qualidade após remover o fundo e tokens de design nas páginas geradas.
- Tooltips próprios no Brain, que aparecem em qualquer lugar da tela e não são cortados.

### Correções

- CLI: a aba CLI não vinha selecionada, e o terminal ficava vazio, ao trocar de projeto.
- CLI: clicar na área de prompt do Claude não aceita mais a sugestão em cinza; só a seta para a direita ou Tab.
- Brain: notas de outro projeto não aparecem mais ao trocar de projeto.

## [1.3.2] - 2026-11-09

### Novidades

- **IA do projeto**: modal e assistente de onboarding (clonar ou abrir pasta) com etapas, pular e sugerir com IA.
- **Retomar conversas**: terminais de IA salvos por projeto e retomados com `/resume` (Claude, Codex, Gemini, Antigravity).
- **Alertas**: contexto da IA cheio e pedidos de review do GitHub, com modal de revisão assistida por IA.
- **Outline, Timeline e Graph**: histórico do Git com ramificações como cards separados na IDE e no CLI.

### Melhorias

- Branches: seletor rápido no estilo VS Code, com criar a partir de e checkout detached.
- Skills: seleção em lote, menu "...", instalação de skills grandes e categorias.
- Daily: sugestões da IA aceitas ou recusadas uma a uma, seleção em lote nos cards e notificação ao gerar cards.
- Histórico do chat por projeto e por IA; seletores de IA seguem as IAs fixadas.
