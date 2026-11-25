# Changelog

Todas as novidades do Aura Dev, da mais recente para a mais antiga.
O app mostra a entrada da versão instalada num modal na primeira abertura após instalar ou atualizar.

Formato de cada versão (a regra completa está em `AGENTS.md`):

- `## [x.y.z] - AAAA-MM-DD`, com seções `### Novidades`, `### Melhorias` e `### Correções`.
- Cada item: `- **Título**: descrição curta, do ponto de vista de quem usa.`
- Prints de referência, quando ajudarem: salve em `public/changelog/x.y.z/` e coloque `![descrição](changelog/x.y.z/nome.png)` logo abaixo do item.

## [Não lançado]

### Novidades

- **Ações em massa nos pull requests**: marque os PRs abertos com a caixa de seleção (ou use "Todos") e aprove, solicite alterações ou peça para a IA revisar todos de uma vez. Na revisão com IA, ela analisa um PR por vez, decide entre aprovar ou solicitar alterações e envia a review ao GitHub com o texto dela, com o andamento de cada PR na tela.
- **Visualizador de arquivos .tex**: abra um arquivo LaTeX e clique no olho para ver a prévia ao lado em folhas A4 com a aparência de um documento LaTeX (fonte Computer Modern, texto justificado, seções e equações numeradas, número de página), com zoom e contagem de páginas. Apresentações Beamer (`\documentclass{beamer}`) aparecem como slides no formato da classe (4:3 por padrão) e seguem o tema do documento: Madrid, Berlin, Warsaw, CambridgeUS, Metropolis, o tema padrão e os temas de cores, com barra de título, rodapé, número de slide, blocos, colunas e listas. Se o tectonic ou o pdflatex estiver instalado, a aba PDF compila o documento. O editor também ganhou realce de sintaxe para LaTeX. O botão de código na barra da prévia esconde o editor e deixa só o documento na tela. A prévia segue a página, as margens, a fonte, o espaçamento, a numeração e os títulos do próprio documento (classe, `geometry`, `times`, `setspace`, `fancyhdr`, `titlesec`), expande `\newcommand` e mostra folha de rosto e sumário. O botão "Baixar PDF" salva o documento ou os slides em PDF: o PDF exato do LaTeX quando há compilador instalado, ou a própria prévia em folhas A4 ou slides quando não há.
- **Sites com skills de design**: a IA da aba Sites lê as skills Taste, Web Design Guidelines, Awesome Design MD e Playwright CLI antes de criar ou editar um site, e confere o resultado em capturas. A skill que faltar é instalada sozinha.
- **Recriar um site inteiro a partir de um link**: nas referências da aba Sites, ative "Recriar o site inteiro". A IA lê as páginas do menu, baixa as imagens e monta um site novo com os mesmos textos, dados e mídias, mas com um design totalmente renovado e moderno.
- **Captação de clientes na aba Sites**: a nova barra lateral de ícones tem a seção Captação. Com um clique, a IA procura sites antigos ou mal feitos que mostram WhatsApp, lista os resultados com botão para abrir a conversa e permite recriar o site do negócio com um clique.

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
