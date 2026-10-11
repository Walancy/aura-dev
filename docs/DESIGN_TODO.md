# Design — plano de correção e evolução

> Gerado a partir de uma auditoria de código da tela **Design** (`src/components/design2`, ~15 mil linhas) em 2026-10-03.
> A auditoria foi feita lendo o código; itens marcados "a confirmar" precisam de teste na tela.
> Estado: marque `[x]` quando concluído e escreva ao lado o que foi feito.

## Regras do projeto
- **Runtime:** Bun (`bun`, `bunx`, `bun test`). Nunca npm/yarn/npx.
- **Idioma:** textos de UI e comentários em **pt-BR**.
- **Sem diálogos nativos** (`alert`/`confirm`/`prompt`): usar toasts e modais do app.
- **Menor mudança que resolve na causa raiz**; lógica não trivial deixa um teste (`bun test`).
- **Verificar:** `bunx tsc --noEmit -p . | grep design2` (meta: zerar), `bun run build:ui`.
- Não commitar; não reiniciar o app sem pedirem.

### Arquivos principais
| Arquivo | Papel |
|---|---|
| `DesignStudioView.tsx` | Tela principal: estado, atalhos, geração com IA, documento/páginas |
| `DesignCanvas.tsx` | Canvas SVG: render dos shapes, interações de mouse |
| `DesignToolbar.tsx` | Barra de ferramentas e menu de IA |
| `PropertiesPanel.tsx` | Painel de propriedades (preenchimento, traço, efeitos, export) |
| `LayersPanel.tsx` | Camadas |
| `FigmaColorPicker.tsx`, `Figma*SettingsModal.tsx` | Seletor de cor e modais de traço/texto/efeito |
| `aiScreenGenerator.ts` | Gerador de telas (hoje por palavras-chave) |
| `usePersistedDesign.ts` | Persistência por projeto (`.devflow`) |
| `useDesignRoom.ts`, `RoomPanel.tsx` | Colaboração em sala na rede local |
| `types.ts` | Modelo (`Shape`, `ToolId`, `EffectItem`, `ExportItem`...) |

---

## Bloco 1 — Quebrado ou falso

- [x] **1. Exportar de verdade** — `PropertiesPanel.tsx` (~3160): hoje só `alert('Exportando…')`. Implementar PNG/JPG/SVG (e PDF) a partir do shape/frame, com escala 0.5x–4x e sufixo; baixar o arquivo. *Aceite:* exportar um frame gera arquivo com o conteúdo certo; nenhum `alert`. — **Feito:** `exportDesign.ts` (SVG/PNG/JPG/PDF, escalas 0.5x–4x, sufixo) reaproveita o `DesignCanvas` sem seleção; botão Export baixa os arquivos e avisa por toast. Testes em `tests/design-export.test.ts`.
- [x] **2. IA de gerar telas de verdade** — `aiScreenGenerator.ts` + `DesignStudioView.tsx` (~1405): hoje palavras-chave e `setTimeout`. Chamar a CLI de IA escolhida com o pedido + frame selecionado + paleta, receber JSON de shapes e validar/converter. Manter os modelos atuais como fallback. *Aceite:* pedidos fora das 6 categorias geram telas coerentes. — **Feito:** `aiScreenFromLlm.ts`: a CLI escolhida desenha o layout em JSON (prompt + validação/sanitização + quebra de texto); modelos por palavra-chave viraram fallback. Testado com o Claude real (tela de login coerente).
- [x] **3. Modal de efeitos** — `FigmaEffectSettingsModal.tsx`: `./tokens` não existe e `inputBorder` não é declarado. — **Feito:** criado `tokens.ts` e declarado `inputBorder`.
- [x] **4. `onInstallAiCli`** — `DesignToolbar` espera a prop; `DesignStudioView` não passa. — **Feito:** prop declarada no toolbar e, no `App.tsx`, passados provedor/modelo/CLIs instaladas/instalar CLI para a tela.
- [x] **5. Erros de TypeScript em `design2`** (93): 78 em `aiScreenGenerator.ts` (`Shape` gerado não bate com o tipo), 12 no modal de efeitos, 2 no toolbar/tela. *Meta:* zero erros nessa pasta. — **Feito:** zero erros em `design2`; o gerador usa `ShapeDraft` e completa os campos básicos na saída.

## Bloco 2 — Opções que existem na interface mas não funcionam

- [x] **6. Gradientes** — `FillItem.type` oferece linear/radial/angular/diamante/imagem; o canvas só desenha cor sólida. Renderizar via `<linearGradient>`/`<radialGradient>` (angular/diamante podem ser aproximados). — **Feito:** `gradient.ts` + modelo (`gradientStops`/`gradientAngle`), canvas desenha linear/radial (também na exportação), seletor de cor com barra de paradas (adicionar, arrastar, remover, ângulo). Angular (conic) e diamante também (camada CSS recortada pelo contorno; na exportação raster saem, no SVG dependem do `foreignObject`). Testes em `tests/design-gradient.test.ts`.
- [x] **7. Efeitos faltantes** — só `drop-shadow` e `layer-blur` são desenhados. **Feito:** sombra interna e ruído (filtro SVG, também na exportação, `effectsFilter.ts`), blur de fundo (`backdrop-filter` em camada recortada pelo contorno; só no canvas, a exportação não tem fundo para desfocar) e blur de fundo progressivo (máscara de gradiente). Blur de camada progressivo segue uniforme. Testes em `tests/design-effects.test.ts`.
- [x] **8. Máscara** — botão desabilitado e flag `isMask` ignorada pelo canvas. Clipar os shapes acima/dentro da máscara. — **Feito:** o botão "Usar como máscara" liga `isMask`; o shape de máscara mais próximo abaixo (mesmo pai) recorta os elementos acima (retângulo, elipse, polígono, estrela, caminho). A máscara some visualmente quando não está selecionada.
- [x] **9. Auto layout** — hoje só alterna `hasAutoLayout`. Implementar direção, espaçamento, padding e reorganização dos filhos. — **Feito:** `autoLayout.ts`: horizontal/vertical com gap, padding (igual ou independente), alinhamento 3×3, hug e fill por eixo, frames aninhados (hug sobe pela hierarquia); arrastar um filho reordena. O painel já tinha os controles; faltava o motor. Testes em `tests/design-autolayout.test.ts`. Grade (`grid`) e wrap seguem de fora.
- [x] **10. Componentes** — `isComponent` é só marcação. Instâncias, variantes e propriedades. — **Feito (parcial):** `components.ts`: componente principal → "Criar instância" (cópia ligada); mudanças no componente (cor, tamanho, filhos novos/removidos) propagam para as instâncias, respeitando overrides feitos pelo painel; "Desanexar". Testes em `tests/design-components.test.ts`. Variantes: componentes com o mesmo "Grupo" são variantes (campos Grupo/Variante no componente) e a instância troca de variante por um seletor (overrides são descartados na troca). **Falta:** propriedades de componente (booleanas/texto).
- [x] **11. Booleanas e "Ajustar seleção"** — união, subtração, interseção; estão desabilitadas ("em breve"). — **Feito:** `booleanOps.ts` (polygon-clipping): união, subtração, interseção, exclusão e Flatten geram um shape `path` (move/redimensiona/gradiente/traço); Alt+Shift+U/S/I/E/F. "Ajustar seleção" encaixa o frame nos filhos. Testes em `tests/design-boolean.test.ts`.
- [x] **12. Ferramenta Escala** — hoje igual à Seleção. Redimensionar proporcionalmente (conteúdo e fontes). — **Feito:** com a ferramenta Escala, redimensionar escala filhos, fonte, traço e raio (`constraints.ts`, testes em `tests/design-constraints.test.ts`).
- [x] **13. Texto no caminho** — `text-path` desenha texto comum. Usar `<textPath>`. — **Feito:** `text-path` desenha o texto sobre um arco (`<textPath>`) com campo "Curvatura do texto" no painel (positivo sobe, negativo desce). Caminhos arbitrários ficam para depois.
- [x] **14. Restrições e recortar conteúdo** — `constraints` e `clipsContent` não existem de fato. — **Feito:** restrições H/V (esquerda, direita, centro, esticar, escala) aplicadas ao redimensionar o frame; o recorte usa o toggle "Clip content" que já existia no painel (`clipContent`). Mover um frame agora também move os filhos.

## Bloco 3 — Funcionalidades ausentes

- [x] **15. Guias, réguas, snap e grade.** — **Feito:** `snap.ts` + canvas: encaixe em bordas/centros (Cmd/Ctrl desativa) com guias magenta ao mover e redimensionar, grade (Ctrl+') e réguas (Shift+R); toggles no menu do documento. Testes em `tests/design-snap.test.ts`.
- [x] **16. Edição de texto direto no canvas** (duplo clique). — **Feito:** duplo clique em um texto abre o editor sobre o canvas (clique fora ou Cmd+Enter confirmam; Esc cancela a edição de um texto existente); texto recém-criado já entra em edição e some se ficar vazio.
- [x] **17. Alinhar e distribuir** vários elementos. — **Feito:** `align.ts`: alinhar (esq/centro/dir/topo/meio/base) e distribuir com espaços iguais para vários selecionados, filhos acompanham; botões no painel e atalhos Alt+A/D/W/S/H/V (Alt+Shift+H/V distribui). Editar X/Y de um frame leva os filhos. Testes em `tests/design-align.test.ts`.
- [x] **18. Imagens**: arrastar/colar no canvas, recortar, substituir. — **Feito:** colar imagem da área de transferência (Cmd+V) e arrastar arquivos para o canvas; seção "Imagem" no painel com ajuste (preencher/ajustar/esticar), recorte por porcentagem (X, Y, largura, altura) e "Substituir imagem…".
- [x] **19. Estilos e variáveis** (cores, textos, efeitos reutilizáveis). — **Feito (parcial):** `styles.ts`: estilos de cor e de texto do documento (criar a partir da seleção, aplicar, renomear, atualizar, excluir); mudar um estilo atualiza todos os elementos ligados; editar a cor/fonte à mão desliga o vínculo; salvos junto com o design. Testes em `tests/design-styles.test.ts`. Variáveis de cor com modos Claro/Escuro (`variables.ts`: criar a partir do preenchimento, valor por modo, ligar ao elemento, trocar o modo recolore tudo; testes em `tests/design-variables.test.ts`). **Falta:** variáveis numéricas/texto e estilos de efeito/grade.
- [x] **20. Prototipagem**: ligações entre telas, gatilhos, modo apresentação. — **Feito (básico):** seção "Protótipo" no painel: "Ao clicar → ir para (frame)" em qualquer elemento e botão "▶ Apresentar" (`PrototypePlayer.tsx`): mostra o frame, os elementos com link ficam clicáveis, ← volta, Esc sai. **Falta:** gatilhos além de clique, transições animadas e overlays.
- [x] **21. Pen (caneta)**: editar nós e curvas depois de criar (controles ocultos em `DesignCanvas.tsx` ~1178). — **Feito (parcial):** traços da pen/pencil mostram nós quando selecionados: arrastar move, duplo clique no traço adiciona nó, Alt+clique remove. Opção "Suavizar curva" desenha o traço como Bézier (Catmull-Rom) passando pelos nós. **Falta:** alças Bézier editáveis por nó.
- [x] **22. Atalhos e detalhes** (a confirmar): travar proporção, seleção em retângulo, duplicar com Alt, etc. — **Feito:** Cmd/Ctrl+D duplica (com filhos), Cmd/Ctrl+A seleciona tudo (antes só pegava o último), setas movem 1px (Shift = 10px), Esc deseleciona, Shift+0/1/2 zoom 100%/tudo/seleção. Corrigido também o efeito de atalhos, que não declarava todas as dependências. Testes em `tests/design-duplicate.test.ts`.

## Bloco 4 — Integração com o DevFlow

- [x] **23. Gerar com IA conectada ao projeto** (junto ao item 2): usar contexto do projeto/Brain. — **Feito:** o prompt inclui nome do projeto e resumo do Brain.
- [x] **24. Exportar para código** (React/Flutter/CSS); hoje só "copiar CSS" de um elemento. — **Feito:** `codegen.ts`: React (JSX com estilos inline, flex para auto layout), HTML e Flutter (Stack/Positioned, Row/Column, BoxDecoration, sombras e gradientes). Botão "Ver código" no painel abre o modal com copiar, salvar em `src/design-export/` e pedir à IA para implementar. Testes em `tests/design-codegen.test.ts`.
- [x] **25. Ligar design a projeto/issues** e usar como contexto do chat e do Maestro. — **Feito:** campo "Issue vinculada" no frame; o botão "Pedir à IA para implementar" abre o chat da IDE com o código do design, a stack do projeto e a issue no prompt.
- [x] **26. Versões e histórico** do design por projeto (hoje só salva o estado atual). — **Feito:** menu do documento ganhou "Salvar versão" e "Histórico de versões…" (lista com data/elementos, restaurar e excluir); restaurar guarda antes o estado atual. Arquivos em `.devflow/design2/versions/` (máx. 40). Testes em `tests/design-versions.test.ts`.
- [x] **27. Colaboração em sala**: cursores, seleção dos outros e resolução de conflito (a confirmar o estado atual). — **Feito (parcial, sem teste com 2 máquinas):** a sala (rede local) deixou de ser só leitura: o anfitrião escolhe "Permitir edição" e os participantes editam (o estado completo é reenviado, a última edição vale); cursores com nome de todos aparecem no canvas. **Falta:** mesclar edições simultâneas por elemento, seleção dos outros e testar em duas máquinas.

---

## Réguas — mecânicas (extra pedido depois)
- [x] Marcas principais e secundárias que acompanham o zoom, com rótulos que não se sobrepõem (`rulers.ts`).
- [x] Arrastar da régua cria **guias** (de cima = horizontal, da esquerda = vertical); arrastar a guia move; soltar de volta na régua ou duplo clique remove; guias por página, salvas no documento; "Limpar guias da página" e "Mostrar guias (Ctrl+;)" no menu.
- [x] Guias encaixam nas bordas/centros dos elementos ao serem arrastadas e **elementos encaixam nas guias** ao mover/redimensionar (Cmd/Ctrl desativa).
- [x] Faixa da seleção destacada nas duas réguas, com os valores de início e fim.
- [x] Marcador do cursor nas réguas e marcas coloridas das guias.
- [x] Réguas relativas ao frame: 0 no canto do frame da seleção (opção "Réguas relativas ao frame").
- Testes: `tests/design-rulers.test.ts`.

## Ordem recomendada
1. Bloco 1 (itens 3, 4, 5, 1, depois 2).
2. Itens 6 e 7 (visíveis na hora), depois 15–17 (usabilidade).
3. Item 2/23 (IA real) é o diferencial; pode subir de prioridade.
4. Blocos 8–14 e 19–20 são os maiores; fazer um por vez.

## Checklist de conclusão
- [x] `bunx tsc --noEmit -p . | grep design2` sem erros (a pasta tem 0 erros; o projeto caiu de 186 para 94)
- [x] `bun run build:ui` passa
- [x] Nenhum `alert`/`confirm`/`prompt` na pasta
- [x] Testes novos para lógica não trivial (export, gradientes, efeitos, snap, constraints, alinhar, booleanas, auto layout, componentes, estilos, variáveis, versões, código, duplicar, IA)

## Importação Figma, ícones e IA (extra)

- [x] **Importar do Figma** (menu do documento → "Importar do Figma…"): URL + token pessoal (via main process, sem CORS; `node-id` na URL importa só aquele nó) ou arquivo/JSON colado da API. Converte páginas, frames, auto layout, textos, gradientes, sombras, vetores (`fillGeometry`), imagens (baixadas como data URL), componentes/variantes e links de protótipo. Limites: tipos FigJam ignorados; instâncias viram frames; `fillGeometry` só vem com `geometry=paths`.
- [x] **Ícones Material** com busca (botão ao lado do botão de IA na toolbar). Catálogo gerado por `scripts/gen-material-icons.ts` (2140 ícones Outlined, carregado sob demanda).
- [x] **IA usa ícones** (`type:"icon"`, nome Material em PascalCase) ao gerar telas.
- [x] **IA gera várias telas** (`{"screens":[…]}`, até 8, lado a lado).
- [x] **IA edita a seleção** (qualquer forma/frame com conteúdo/múltiplos): `edits`, `add`, `remove` restritos à seleção e descendentes. Frame vazio selecionado continua gerando o conteúdo.

## IA no Design — tempo real, dispositivos, imagens, proposta

- [x] **Criação em tempo real**: `aiJsonStream.ts` lê o JSON enquanto chega (Claude via `--output-format stream-json`; demais CLIs em sequência quando a resposta chega) e `ScreenBuilder` cria cada elemento no canvas. Um único passo de desfazer ao fim.
- [x] **Texto sempre dentro do card** (`textFit.ts`): uma linha quando possível, reduz fonte até 20%, quebra por palavras, corta com "…"; limitado ao menor retângulo que contém o texto.
- [x] **Frames de dispositivos** (botão na toolbar, `devices.ts`): iPhone 15 Pro/Max, 14, SE, Pixel, iPad, Desktop, MacBook… Telas mobile da IA ganham aparelho (ilha, status bar, home indicator) e margens seguras.
- [x] **Imagens** (`type:"image"` + `query`): Unsplash com Access Key (menu do documento) ou picsum.photos sem chave; avatares redondos; crédito do fotógrafo no nome da camada.
- [x] **Referências de mercado** (`designReferences.ts`): iFood, Uber, Nubank, Airbnb, Spotify etc. entram no prompt; vale também para qualquer app citado.
- [x] **Contexto do projeto da header**: resumo local (README, package.json, estrutura, cores) + o agente pode ler os arquivos (somente leitura).
- [x] **Aceitar / Regerar** acima de cada tela gerada (regera só aquela tela, com layout novo).
- [x] **Proposta com IA** (menu do documento): telas selecionadas → imagens + textos → PDF (A4) via Electron `printToPDF`.
- Limites: streaming real só no Claude; edição por IA da seleção não é em tempo real; proposta não inventa valores (texto de investimento genérico).
- [x] **Imagens de referência no prompt da IA** (clipe, colar ou arrastar; até 6, reduzidas a 1600px): viram arquivos temporários que a CLI abre pelo caminho.
- [x] **Fluxos**: a IA decide quantas telas (até 12) quando o pedido é um fluxo sem número.
- [x] **Nome do frame**: clique seleciona, duplo clique renomeia no próprio rótulo (Enter confirma, Esc cancela).
- [x] **Auto Layout na IA**: a IA descreve frames aninhados (`layout`, `gap`, `padding`, `align`, `parent`, tamanhos `fill`/`hug`/número); o `ScreenBuilder` aplica o auto layout a cada elemento (streaming incluso) e reajusta textos `fill` à largura final. Rótulos de nome só nos frames de topo.
- [x] **Shift+A** envolve a seleção em auto layout; redimensionar filho reflui irmãos/pai ao vivo.
- [x] **Fila de gerações da IA**: o prompt enviado vira um card acima da caixa (loading + progresso); botão só confirma "Enviado" e volta a "Gerar"; novos pedidos entram na fila (um por vez), com cancelar e subir na fila (nunca acima do que está rodando). "Regerar" também usa a fila. Novas telas nascem num espaço livre do canvas.
- [x] **Geração presa ao projeto**: cada pedido guarda o projeto/página de origem; a barra de prompt mostra só a fila do projeto aberto; trocar de projeto não interrompe a IA (ela segue e grava no `design.json` do projeto de origem, com escrita serializada); voltar ao projeto mostra a geração em andamento; ao concluir fora do projeto/tela, notificação com atalho de volta. Projetos diferentes geram em paralelo.
- [x] **Persistência**: lista vazia salva é respeitada ao recarregar (os exemplos não voltam), gravação imediata em reload/troca de projeto, projeto sem design começa vazio.
- [x] **IA e barras fixas**: `pin:"bottom"|"top"` tira a navbar do fluxo e cola na borda da tela (e rede de segurança por nome: "Navbar", "Tab bar", "Barra de navegação"); receitas de componentes no prompt; frame com layout próprio respeita `hug` mesmo fora de um layout.
- [x] **Auto Layout como no Figma**: texto se ajusta ao conteúdo (largura hug/auto, altura automática), texto `fill` quebra pela largura e re-quebra quando o pai muda, espaçamento automático (space between), digitar W/H ou arrastar alça vira tamanho fixo naquele eixo, edições de W/H no painel aplicam restrições nos filhos, X/Y move todos os descendentes.
- [x] Clicar numa camada leva o canvas até o elemento.
- [x] **Blindagem contra layouts ruins da IA**: frame sem `layout` com filhos sem x/y vira fluxo vertical (padding preservado); pai com id errado cai no layout principal; itens compactos (botão de ícone, badge, pílula) marcados `fill` ao lado de um texto `fill` viram `hug`; texto curto/valor monetário em `fill` nunca quebra linha; prompt com regras de fill/hug e `layout` obrigatório em frames com filhos.
- [x] **Pedido sem assunto usa o projeto da header** ("crie a tela inicial do app"): o resumo do projeto agora inclui README, CLAUDE/AGENTS, PRD/spec/arquitetura e demais `.md` de `docs/` (ordenados por relevância), pastas da raiz, telas/rotas existentes, entidades do Prisma e cores do tema; o prompt detecta pedidos sem assunto, manda a IA derivar domínio/módulos/dados do projeto e libera ler até 6 arquivos (priorizando `.md`).
- [x] **Menu "⋯" no frame selecionado**: botão no canto superior direito do frame de topo com "Regerar com IA" (usa o pedido original; frames feitos à mão são refeitos a partir dos textos deles; entra na fila da IA) e "Excluir frame" (com confirmação).
- [x] **Modelo da CLI por provedor** (`aiModel.ts`): a IA do Design usa o modelo ativo do provedor selecionado; o "modelo selecionado" global só vale se pertencer ao provedor (evita `agy --model "sonnet"` → "invalid model selection").
- [x] **Desfazer regeração**: após "Regerar", os botões acima da tela ganham "↶ Desfazer", que troca a nova versão pela anterior (com Aceitar/Regerar de volta se ela era da IA); Aceitar descarta a versão antiga. Lógica em `aiReviewUndo.ts` (testada).
- [x] Imagens de referência aparecem no card do prompt enviado (miniatura 28 px recolhido; 72 px ao expandir).
- [x] **Velocidade com imagem anexada** (medido no projeto estancia, Gemini 3.8 Flash High): 196 s → 149 s (sem explorar o projeto quando há imagem) → 98 s (JSON minificado, nomes curtos/omitidos, teto de ~80 elementos). Imagens reduzidas a 1280 px; imagem sozinha custa só ~25–40 s (uma volta de ferramenta). O nível de raciocínio vem do nome do modelo ("(High/Medium/Low)"), não de `--effort`.
- [x] **Imagens de referência seguidas de verdade** (análise em 2 etapas): 1) uma chamada só para olhar as imagens e gerar uma especificação visual (blocos de cima para baixo, tema, tipografia, formas, composição; variante "(Low)" do modelo, ~15 s); 2) a geração recebe essa especificação como REGRA OBRIGATÓRIA (reproduz a estrutura/estilo, troca só o conteúdo pelo do pedido/projeto). Regerar reaproveita a especificação. Falha na análise → volta a anexar o arquivo.
- [x] Conteúdo de frames com "recortar conteúdo" agora é recortado em todos os níveis (antes só nos filhos diretos: o texto vazava da tela do aparelho); raio > metade do lado = pílula (sem elipse); `gradient` (#RRGGBBAA) em rect/frame/ellipse; `inset` em barras `pin` (navbar flutuante).
- [x] **Switch "Contexto do projeto"** na barra de prompt da IA (padrão ligado, salvo no navegador, vale por pedido e é mantido no Regerar). Desligado: a IA usa só o pedido e as imagens — sem resumo/README/docs do projeto, sem ler arquivos, rodando fora da pasta do projeto (`/tmp`) e com instrução para ignorar projeto/memória. Obs.: o Antigravity imprime "Estancia Bahia" no fim da resposta mesmo fora do projeto (rodapé da própria CLI, fora do JSON; é descartado).
- [x] **Aviso de app desatualizado** (`app:capabilities`): o processo principal do Electron só atualiza ao reiniciar o app. Sem isso, imagens de referência (`fs:saveTempImage`) e fotos da IA (`unsplash:image`) falhavam em silêncio (a IA gerava um design genérico sem ver a imagem e deixava placeholders cinza). Agora a barra de prompt mostra "Reinicie o app", o pedido com imagem falha com mensagem clara em vez de seguir sem a imagem, e fotos que não carregam geram um aviso.
- [x] Prompt: ordem de prioridade (referência > pedido > projeto > exemplos) e receitas de componentes reescritas como "sintaxe, não blocos obrigatórios" (evita o esqueleto genérico busca+chips+cards+lista+navbar).
- [x] **Layout bagunçado (texto atrás de componente)**: frame/texto sem `width` dentro de auto layout agora é `hug` (antes virava largura fixa = linha toda, cobrindo o vizinho); itens compactos com largura fixa ≈ linha toda ao lado de um texto `fill` viram `hug`; texto `fill` nunca colapsa a 0 (largura mínima = maior palavra). **Regerar segue o interruptor "Contexto do projeto" atual** (antes mantinha o modo do pedido original e, sem contexto, não repete o nome da tela no prompt).

## Estilos avançados e consistência de medidas na IA
- `aiStyle.ts`: camadas `fills` (glass/neumorphism), gradientes (linear/radial/stops), cores `#RRGGBBAA`, `effects` (sombra, inner-shadow, blur, backdrop-blur, noise), `radii`, rotação, tipografia exata (letterSpacing, textCase, fontFamily…), fundo da tela com gradiente/efeitos.
- Consistência: espaçamentos em grade de 4px, ícones em escala fixa, dimensões pares, `equalizeRows`, fill cruzado.
- Canvas: o recorte de `clipContent` agora envolve o elemento inteiro (sombras/brilhos e rotação não vazam do frame pai).
- Limites: backdrop-blur não verificável no export estático; `lineHeight` de referências ainda não é renderizado.

## Desempenho da navegação no canvas
- Pan/zoom mudam só o `transform` do SVG (`camRef` + `navigate`); o React é atualizado quando o gesto para (100ms) ou a cada 300ms em gestos longos.
- Recorte por visibilidade: shapes fora da tela (margem de uma tela) ou menores que 1px não entram no DOM (só com >60 shapes; selecionados sempre ficam).
- Durante a navegação a classe `design-navigating` desliga filtros (sombra/blur/ruído).
- Medido no projeto estancia (~480 shapes, 6,5 mil elementos SVG): pan 105 → ~10 ms/quadro; zoom 81 → ~20 ms/quadro.

## Geração rápida e várias telas em paralelo
- Modo rápido (padrão): usa a variante "(Low)" do modelo. Teste real: 12–25s contra ~100s com "(High)", layout equivalente.
- Pedidos de várias telas (`looksMultiScreen`): uma chamada de plano (`appPlan.ts`: telas + design system compartilhado) e depois UMA tela por chamada, 3 em paralelo, cada uma com frame provisório brilhando. 4 telas em ~45s.
- Cada execução da CLI tem `streamId` (texto e cancelamento isolados). Com `maxScreens: 1` o prompt não pede o formato de várias telas.
- "Aceitar tudo (N)" na barra do prompt quando há 2+ telas aguardando aceite.
- Pendente: no login gerado alguns textos curtos ("Acesse sua conta", "Esqueci minha senha") quebraram em coluna estreita.

## Design tokens
- `designTokens.ts`: cores nomeadas, fonte, escala tipográfica, espaçamentos, raios e sombras; salvos em `designTokens` no design.json (projeto a projeto, inclusive para gerações em segundo plano).
- Com tokens definidos, TODO prompt de criação, edição, plano de telas e regeração recebe o bloco obrigatório, e o que a IA devolve é ajustado aos tokens (cor próxima vira o token, fonte, tamanho da escala, espaços e raios). Com imagem de referência, os tokens mandam no estilo e a imagem só na estrutura.
- Painel "Tokens" (barra do prompt e menu do projeto): editar à mão, extrair do design atual, ou gerar/refinar com IA a partir de texto e/ou imagens de outro projeto.
- Teste real: tela gerada com tokens → 41/42 cores nos tokens, 26/27 fontes na escala, família 100% a dos tokens.

## Fidelidade a referências (gráficos, divisórias, microcomponentes)
- Item de IA `{"type":"chart","kind":"line|area|bar|donut",...}` (`charts.ts`): a IA manda só os dados; o app gera curva suave, área com degradê, barras com trilho e rótulos, rosca, grade, marcador e etiqueta. O frame do gráfico é refeito quando o auto layout define o tamanho final.
- Análise da imagem ganhou seções de GRÁFICOS, DIVISÓRIAS, MICROCOMPONENTES e CONTAINERS (fundo/borda/sombra de cada card) + inventário indentado (hierarquia).
- Prompt: receitas de divisórias (grade completa de calendário/tabela), microcomponentes (chips de ícone, tiles de estatística, badges, pilha de avatares com gap negativo, segmentado, progresso), gaps calculados pelas caixas do inventário; texto no idioma da imagem (sem traduzir).
- Limite de elementos por tela: 450 (antes 150, cortava dashboards densos).

## Novas telas a partir da tela selecionada
- Com tela(s) selecionada(s), pedidos como "crie as outras telas", "faça o fluxo de pagamento", "gere 4 telas…" (`screenFlow.wantsNewScreens`) criam telas novas em vez de editar a selecionada.
- A(s) tela(s) selecionada(s) (até 3) são exportadas como PNG e entram como GUIA DE ESTILO (`STYLE_MODE_MARK`): mesma estrutura (menu, cabeçalho, navegação), paleta, tipografia, raios, espaçamentos e componentes; só o conteúdo da área principal muda. Mesmo tamanho, posicionadas à direita da selecionada; vários pedidos de tela usam o plano + geração em paralelo.
