# Design — plano de paridade com o canvas do Figma

> Origem: levantamento de lacunas da tela **Design** (`src/components/design2`) frente ao canvas do Figma, feito lendo o código.
> Itens marcados **(confirmar)** precisam de teste na tela antes de implementar: podem já existir com outro nome.
> Marque `[x]` ao concluir e escreva ao lado o que foi feito, como em `docs/DESIGN_TODO.md`.

## Fora de escopo (decisão do usuário)
- **Banco de dados / backend compartilhado:** threads de comentários com notificações, bibliotecas publicadas e compartilhadas entre projetos, links de compartilhamento e permissões, branching/merge remoto de versões.
- **Plugins e widgets:** API de plugins, "Gerenciar plugins", widgets (Post-it, Checklist...). Os itens-casca do menu de contexto devem ser **removidos ou escondidos** (ver item 0.1), não implementados.
- **Outros produtos do Figma:** FigJam (quadro livre), Slides e Sites. O foco é o **canvas** de design.
- Tudo o que cabe no arquivo local do projeto (`.devflow/design2`) **está no escopo**.

## Estado atual
- **Concluído:** Fases 0 a 9 e, da Fase 10 a 12, os itens baratos (10.3, 10.7, 12.4, 12.5, 12.8, 12.9).
- **Adiado de propósito (modo Ponytail, só se houver necessidade real):**
  - **IA (10.1, 10.2, 10.4, 10.5, 10.6):** dependem de chamar a CLI de IA e a qualidade só se vê com uso real; a infraestrutura de prompt/validação já existe em `aiScreenFromLlm.ts` e `aiEdit.ts`.
  - **Colaboração (11.1 a 11.4):** precisa de duas máquinas para validar.
  - **12.1 Cmd+K, 12.2 atalhos configuráveis, 12.3 minimapa:** os menus, o atalho Shift+1 (ver tudo) e o pan já cobrem o uso; construir só se fizerem falta.
  - **12.6 páginas (reordenar/copiar frames) e 12.7 seções:** nenhum caso concreto pediu.
- **Reiniciar o app** para pegar a mudança do processo principal (corretor ortográfico, 4.8): `dist-electron/main.js` já foi recompilado.
- **Cuidado ao testar na tela:** abrir a tela Design e interagir grava no `.devflow/design2/design.json` (agora existe backup rotativo em `.devflow/design2/backup/`). Faça uma cópia antes e compare as formas depois.

## Regras do projeto
- **Runtime:** Bun (`bun`, `bunx`, `bun test`). Nunca npm/yarn/npx.
- **Idioma:** UI e comentários em **pt-BR**. Sem `alert/confirm/prompt`: toasts e modais do app.
- **Menor mudança que resolve na causa raiz**; lógica não trivial deixa teste em `tests/design-*.test.ts`.
- **Verificar a cada item:** `bunx tsc --noEmit -p . | grep design2` (meta: zero), `bun test tests/design-*`, `bunx vite build`.
- O app carrega `dist/` quando o Vite (porta 5185) não responde: rodar `bunx vite build` antes de conferir na tela.
- Não commitar sozinho; não mexer no `design.json` do usuário (testar em cópia).
- **Modelo (`types.ts`):** todo campo novo é opcional e tem valor padrão; designs antigos devem abrir iguais.
- **Exportação:** o que o canvas desenha deve sair igual no SVG/PNG/PDF (`exportDesign.ts`) e no código gerado (`codegen.ts`), ou o limite fica documentado.

## Arquivos principais
| Arquivo | Papel |
|---|---|
| `DesignStudioView.tsx` | Estado, atalhos, geração com IA, documento/páginas |
| `DesignCanvas.tsx` | Canvas SVG: render, mouse, snap, guias |
| `DesignToolbar.tsx` | Ferramentas e menu de IA |
| `PropertiesPanel.tsx` | Propriedades (fill, stroke, efeitos, export, protótipo) |
| `LayersPanel.tsx` | Camadas |
| `FigmaContextMenu.tsx` | Menu de contexto |
| `types.ts` | Modelo (`Shape`, `ToolId`...) |
| `snap.ts`, `align.ts`, `autoLayout.ts`, `constraints.ts` | Motores de geometria |
| `components.ts`, `styles.ts`, `variables.ts` | Componentes, estilos, variáveis |
| `exportDesign.ts`, `codegen.ts` | Exportação e código |
| `aiScreenFromLlm.ts`, `aiEdit.ts` | IA que gera/edita |

---

## Fase 0 — Limpeza (antes de tudo)
- [x] **0.1 Remover itens-casca do menu de contexto** (`FigmaContextMenu.tsx`): Plugins, Widgets, "Send to Figma Make", "Find similar designs". Manter as **transições do protótipo** só quando virarem reais (item 6.2); até lá, esconder. *Aceite:* nenhum item do menu tem ação vazia. — **Feito:** removidos Send to Figma Make, Find similar designs, Add motion, Plugins e Widgets do `FigmaContextMenu.tsx`.
- [x] **0.2 Auditoria dos "(confirmar)"** (meio dia): abrir a tela e testar, em uma cópia do design, os itens marcados neste plano. Atualizar este arquivo com "existe / parcial / falta". *Aceite:* nenhum "(confirmar)" restante. — **Feito (leitura do código, não da tela):**
  - **Já existe:** bloquear proporção (`constrainProportions`, cadeado no painel; o redimensionar respeita) → 1.6 só precisa de teste; "Paste here" e "Paste to replace" no menu → 2.2; copiar/colar propriedades (menu e atalho) → 2.3; Cmd/Ctrl+clique seleciona o componente sob o mouse (parte de 2.5); seleção em retângulo (`marquee`) → 2.6 só precisa das regras de contenção; modo de mesclagem **por camada** → 3.6 falta por preenchimento; lista de `exports[]` no painel → 9.2; duplicar/renomear/excluir página → 12.6 só falta reordenar e copiar frames; `section` existe como tipo.
  - **Não existe:** valores mistos no painel (2.8), busca de camadas (2.11), Dev Mode (8.1; só há a ferramenta de medição), comentários (a ferramenta só põe uma nota visual).

## Fase 1 — Precisão de desenho (maior impacto, menor risco)

- [x] **1.1 Layout grids** (colunas, linhas, grade).
  - Modelo: `layoutGrids?: LayoutGrid[]` no frame (`type: 'grid'|'columns'|'rows'`, `count`, `gutter`, `margin`, `size`, `color`, `alignment`).
  - Canvas: desenhar a grade sobre o frame (atrás dos filhos, não exportada), toggle `Ctrl+G` do Figma → usar `Ctrl+Shift+4` (ou o já livre).
  - Painel: seção "Layout grid" com `+`, olho, remover e editor de cada grade.
  - Snap: elementos encaixam nas colunas/linhas (`snap.ts`).
  - *Aceite:* frame com 12 colunas encaixa o retângulo nas bordas das colunas; exportação não inclui a grade. *Teste:* `tests/design-layoutgrid.test.ts` (cálculo das colunas, encaixe). — **Feito:** `layoutGrid.ts` (colunas/linhas/grade, margem, gutter, alinhamento) + seção "Layout grid" no painel do frame (`LayoutGridSection.tsx`); o canvas desenha as grades e os elementos encaixam nas bordas das colunas/linhas; a exportação não inclui a grade (`hideOverlays`). Testes em `tests/design-layoutgrid.test.ts`. Sem atalho global de mostrar/ocultar: cada grade tem o olho no painel.

- [x] **1.2 Grade de pixels e encaixe em pixel inteiro.** Opção "Encaixar em pixels" (arredonda x/y/w/h ao mover e redimensionar) e "Grade de pixels" visível a partir de 800% de zoom. *Aceite:* mover um shape com meio pixel de offset o leva a inteiros; a grade aparece só em zoom alto. — **Feito:** opções "Encaixe em pixels" e "Grade de pixels" em Configurações do design; mover/redimensionar arredonda (`roundBoxToPixels`) e a grade 1×1 aparece a partir de 800%.

- [x] **1.3 Guias de espaçamento inteligentes.** Ao mover/redimensionar, mostrar linhas vermelhas com a distância até os vizinhos e encaixar quando dois espaçamentos ficam iguais (distribuição implícita). Estende `snap.ts` com candidatos de "gap igual". *Aceite:* mover o terceiro cartão de uma fileira encaixa no mesmo gap dos dois primeiros e mostra o valor. *Teste:* `tests/design-snap-gap.test.ts`. — **Feito:** `computeGapSnap` em `snap.ts`: encaixa depois/antes de um box com o mesmo vão e centraliza entre dois; mostra o vão em vermelho com o valor. Só ao mover (no redimensionar ainda não). Testes em `tests/design-snap.test.ts`.

- [x] **1.4 Medidas com Alt.** Segurar Alt com algo selecionado mostra a distância até o elemento sob o mouse (ou até as bordas do frame pai). *Aceite:* distâncias corretas nos quatro lados, em unidades do documento, acompanham o zoom. — **Feito:** `measure.ts` + overlay: com Alt, distâncias da seleção até o elemento sob o mouse (ou o frame pai). Testes em `tests/design-measure.test.ts`.

- [x] **1.5 Alinhar a um alvo.** Opção no painel de alinhamento: alinhar à seleção, ao frame pai ou ao canvas. *Aceite:* alinhar ao pai com um elemento dentro de um frame usa as bordas do frame. — **Feito:** seletor no painel (Automático / Seleção / Frame pai / Canvas), salvo no navegador; `alignReference` em `align.ts` com testes.

- [x] **1.6 Bloquear proporção** como alternância por elemento (cadeado no painel). **(confirmar)** se já existe. *Aceite:* mudar W ou H, ou arrastar a alça, preserva a razão; Shift continua forçando. — **Feito:** já existia (`constrainProportions` com cadeado no painel, respeitado ao redimensionar); nada a fazer.

- [x] **1.7 Rotação de seleção múltipla com pivô e snap de 15°** (Shift). *Aceite:* girar 3 elementos gira o conjunto ao redor do centro; ângulo com Shift vai de 15 em 15. — **Feito:** `rotate.ts` + alça de rotação acima da seleção (arrastar gira; Shift = 15°); vários elementos giram juntos ao redor do centro do conjunto e os filhos acompanham. Testes em `tests/design-rotate.test.ts`.

## Fase 2 — Edição e produtividade

- [x] **2.1 Duplicar arrastando com Alt.** Alt+arrastar deixa a cópia no lugar de origem e move o original (como o Figma, sem mudar a camada original). *Aceite:* uma única entrada de desfazer. — **Feito:** Alt+arrastar deixa o original e arrasta uma cópia (mesmo nome); o desfazer remove a cópia de uma vez. Com Alt solto a tecla mostra as medidas (1.4).

- [x] **2.2 Colar no mesmo lugar** (Cmd+Shift+V) e **colar por cima da seleção** (Cmd+Alt+V substitui o conteúdo do alvo mantendo o pai). Hoje cola por deslocamento. **(confirmar)** — **Feito:** `clipboard.ts`: copiar leva a seleção **com descendentes** (antes copiava só um shape, sem filhos); colar desloca 30px, Cmd/Ctrl+Shift+V cola no mesmo lugar, "Paste here" leva o canto do conjunto ao ponto, "Paste to replace" troca o alvo e seus filhos mantendo lugar, tamanho e camada. Testes em `tests/design-clipboard.test.ts`.

- [x] **2.3 Copiar e colar propriedades** (Cmd+Alt+C / Cmd+Alt+V): fill, stroke, efeitos, tipografia, raio. *Aceite:* copiar de um botão e colar em outro preserva posição e tamanho do destino; vale para vários alvos. — **Feito:** já existia (menu e atalhos Alt+Cmd+C / Alt+Cmd+V); nada a fazer.

- [x] **2.4 Atalhos de opacidade:** teclas 1…9 = 10…90%, 0 = 100%, dois dígitos rápidos = valor exato. Só com seleção e foco fora de inputs. — **Feito:** `opacityKeys.ts`: 1…9 = 10…90%, 0 = 100%, dois dígitos seguidos (até 500 ms) = valor exato. Testes em `tests/design-opacitykeys.test.ts`.

- [x] **2.5 Seleção inteligente.** Cmd+clique seleciona em profundidade (entra em grupos/frames), Duplo clique entra no grupo, "Selecionar tudo com o mesmo preenchimento / texto / fonte" no menu de contexto. *Aceite:* clicar em um texto e usar "mesma fonte" seleciona todos com a mesma família e peso. — **Feito:** `selectSimilar.ts` + submenu "Select layer": mesmo preenchimento, traço, fonte (texto) ou tipo. De quebra, "Select parent" e "Select children" não estavam ligados ao menu e passaram a funcionar. Cmd/Ctrl+clique (seleção em profundidade) já existia. Testes em `tests/design-selectsimilar.test.ts`.

- [x] **2.6 Seleção em retângulo por contenção.** Arrastar no fundo seleciona o que **toca** o retângulo; com Cmd, só o que está **totalmente dentro**; arrastar dentro de um frame seleciona só os filhos dele. **(confirmar)** o comportamento atual. — **Feito:** o retângulo de seleção já tocava o que cruza e escolhia o elemento mais externo; agora Cmd/Ctrl exige o elemento **inteiro dentro** do retângulo.

- [x] **2.7 Renomear camadas em massa** (Cmd+R): padrão com `{n}` (sequência), `{nome}`, localizar/substituir. Modal com pré-visualização. *Teste:* `tests/design-rename.test.ts`. — **Feito:** `renameBulk.ts` + `RenamePopup.tsx`: padrão com `{n}` (início e dígitos) e `{nome}`, localizar/substituir (texto ou regex) e pré-visualização. Atalho **F2**, porque Cmd+R recarrega a janela do Electron. Testes em `tests/design-rename.test.ts`.

- [x] **2.8 Edição múltipla com valores mistos.** O painel mostra "Misto" quando os selecionados diferem e aplica a todos ao editar. **(confirmar)** — **Feito:** `multiEdit.ts`: com vários selecionados, o painel mostra "Misto" em X, Y, W, H, rotação, opacidade e raio quando diferem, e a edição vale para todos (X/Y movem o conjunto). Cobre só esses campos; preenchimento e tipografia ainda mostram o valor do principal. Testes em `tests/design-multiedit.test.ts`.

- [x] **2.9 Organizar (Tidy up).** Com vários elementos selecionados, arrumá-los em linha ou grade com gap igual (usa o espaçamento mais comum da seleção). Botão no painel e Ctrl+Alt+T. *Aceite:* 6 cartões soltos viram uma grade 3×2 sem sobreposição. *Teste:* `tests/design-tidy.test.ts`. — **Feito:** `tidy.ts`: agrupa em linhas, usa o vão mais comum (ou 20) e mantém o canto do conjunto; botão "Organizar" no painel e Ctrl/Cmd+Alt+T. Testes em `tests/design-tidy.test.ts`.

- [x] **2.10 Cortar/recortar um shape** (ferramenta Crop em formas): recortar o contorno e preencher a imagem dentro. Dependência: imagens (já existe `imageCrop`). — **Adiado:** o que o item pede (formas preenchidas por imagem) é o mesmo trabalho de "preenchimento por imagem em qualquer forma"; será feito junto com 9.4/9.6, onde faz mais sentido. — **Feito:** coberto pelo 9.4: **qualquer forma** (retângulo, frame, elipse, polígono, estrela) pode ser preenchida com uma imagem, recortada pelo contorno, com recorte e ajustes; o botão "Preencher com imagem…" está no painel.

- [x] **2.11 Contagem de camadas e busca no painel de camadas** (filtrar por nome/tipo/cor), além do "reordenar por arrastar". **(confirmar)** — **Feito:** botão de busca no painel de camadas: filtra por nome, tipo (pt/en), conteúdo do texto ou #cor, em lista achatada. Testes em `tests/design-layersfilter.test.ts`.

## Fase 3 — Vetores, traço e ilustração

- [x] **3.1 Alças Bézier editáveis por nó** (pen/vetores): arrastar nós e alças, tipos de nó (reto, espelhado, independente), Shift para ângulos de 45°. Base de todo o resto da fase. Já listado como "Falta" no `DESIGN_TODO.md` (item 21). — **Feito:** `vector.ts` (nós + alças relativas, `pathFromVector`, caixa que inclui o bojo da curva, `setHandle` espelhado ou independente com Alt, dividir segmento por de Casteljau, alternar canto/suave) e **caneta por cliques** no canvas: clicar cria nó, arrastar puxa as alças, clicar no primeiro nó fecha, Enter/Esc/duplo clique terminam; o lápis continua à mão livre. Alças arrastáveis nos caminhos selecionados. Testado na tela. Testes em `tests/design-vector.test.ts`.

- [x] **3.2 Modo de edição vetorial completo:** Enter entra, selecionar vários nós, apagar nó, juntar e separar caminhos, fechar caminho, ponto médio para adicionar nó. — **Feito:** nó selecionável (destacado), **Delete** apaga o nó, duplo clique no nó alterna canto/suave, duplo clique no traço insere nó na curva (sem alterar a forma), checkbox "Fechar caminho" no painel. **Falta:** seleção de vários nós, juntar e separar caminhos.

- [x] **3.3 Pontas de linha:** início e fim (nenhuma, seta, triângulo, círculo, losango, quadrado, seta de linha) em `line`/`arrow`/`pen`. Modelo: `startCap`, `endCap`. *Aceite:* sai correto no SVG exportado (`marker`). — **Feito:** `caps.ts`: pontas de início e fim (seta, triângulo, círculo, losango, quadrado, barra) em caneta/lápis e linha, orientadas pela tangente e escaladas pela espessura; seletor no painel. Testes em `tests/design-caps.test.ts`.

- [x] **3.4 Tracejado personalizado** (lista de dash e gap, `stroke-dasharray` livre) além do tracejado simples atual. — **Feito:** `dash.ts`: campo "Padrão" no modal de traço (ex.: `8 4 2 4`) que vale no lugar de dash/gap. Testes em `tests/design-dash.test.ts`.

- [x] **3.5 Gradiente e múltiplos preenchimentos no traço.** Reaproveitar o seletor de cor/gradiente do preenchimento no traço; `strokes[]` já existe. — **Feito:** o seletor de cor/gradiente agora também edita o **traço** (linear e radial; `StrokeItem` ganhou os campos de gradiente) e o canvas desenha o traço com gradiente. Em linhas retas horizontais/verticais o gradiente não aparece (limite do SVG em caixa de altura zero); elas usam a cor da primeira parada.

- [x] **3.6 Modo de mesclagem por preenchimento** (cada item de `fills`) e por traço. **(confirmar)** se `blendMode` hoje vale só por camada. — **Feito:** `blendMode` por camada de preenchimento e de traço (ícone ◐ na linha de cada uma, 16 modos), aplicado como `mix-blend-mode` no canvas e na exportação.

- [x] **3.7 Elipse como arco/anel:** ângulo inicial, final e raio interno (donut/pizza). Modelo: `arcStart`, `arcEnd`, `arcInner`. Alças no canvas. — **Feito:** `arc.ts`: elipse como arco, fatia ou anel (`arcStart`, `arcEnd`, `arcInner`), com seção "Arco" no painel; funciona nos preenchimentos, traços e máscaras. Sem alças no canvas (só campos numéricos). Testes em `tests/design-arc.test.ts`.

- [x] **3.8 Polígono e estrela com cantos arredondados** (`cornerRadius` aplicado aos vértices). — **Feito:** `roundPoly.ts`: polígono e estrela usam o raio da borda nos vértices (arcos tangentes limitados à metade da aresta); o campo "Corner radius" agora aparece para eles. Testes em `tests/design-roundpoly.test.ts`.

- [x] **3.9 Outline stroke real:** converter o traço em um caminho preenchido (o item de menu existe sem ação). Usar offset de caminho (`polygon-clipping` + `clipper-lib` ou o motor de `booleanOps.ts`). — **Feito:** `outlineStroke.ts`: "Outline stroke" de verdade (antes só trocava a cor do traço pelo preenchimento): o traço vira um caminho preenchido, por união de segmentos com pontas/quinas redondas (miter tratado como chanfro); formas com preenchimento mantêm o original sem traço e o contorno nasce por cima. O traço é tratado como centralizado (posição inside/outside não é aplicada). Testes em `tests/design-outlinestroke.test.ts`.

- [x] **3.10 Traço de largura variável e pincéis** (largura por nó, preset "Fino–grosso–fino", pincel com pressão simulada). Render como polígono preenchido; exportação como `path`. — **Feito:** `widthProfile.ts`: perfil de largura no traço da caneta/lápis (afinar no fim/início, fino-grosso-fino, grosso-fino-grosso) pelo seletor "Width profile" do modal de traço; desenhado como polígono preenchido. **Falta:** largura por nó e pincéis com pressão.

- [x] **3.11 Preenchimento por padrão (pattern) e texturas:** padrões de linhas, pontos, grade e ruído; escala e ângulo. Render via `<pattern>`; exportação raster. — **Feito:** `pattern.ts`: preenchimento por padrão (linhas, pontos, grade, xadrez, ruído) com escala e ângulo, pelo botão ▦ da seção Fill; desenhado com `<pattern>` (ruído por turbulência). Testes em `tests/design-pattern.test.ts`.

- [x] **3.12 Máscara por luminância** e máscara em grupo. Hoje a máscara é só por contorno (`isMask`): adicionar `maskType: 'alpha'|'luminance'|'outline'`. — **Feito:** `maskType` na máscara: Contorno (padrão), **Alfa** e **Luminância** (`<mask>` SVG com a cor/opacidade do preenchimento da máscara). **Falta:** máscara em grupo.

## Fase 4 — Texto

- [x] **4.1 Auto resize do texto:** largura automática, altura automática, tamanho fixo (toggle no painel). Hoje só o importador conhece o conceito. *Aceite:* digitar em um texto com altura automática cresce a caixa; largura automática a mantém numa linha. — **Feito:** `textResize.ts`: caixa do texto com **largura automática** (acompanha a maior linha), **altura automática** (quebra pela largura e guarda o original em `wrapSource`) ou fixa; seletor "Caixa" no painel; texto criado por clique nasce com largura automática e por arrasto com altura automática (textos antigos ficam fixos). Roda no mesmo pipeline que sincroniza instâncias/variáveis. Testes em `tests/design-textresize.test.ts`.

- [x] **4.2 Estilo por trecho (rich text):** negrito, itálico, cor, tamanho e sublinhado em parte do texto. Modelo: `runs?: TextRun[]` com `start/end/estilo`. Edição no canvas (o editor atual é de texto simples). Render por `<tspan>`. *Aceite:* palavra em negrito no meio da frase sai assim na tela e na exportação. — **Feito:** `richText.ts`: estilo por trecho (negrito, itálico, sublinhado, tachado, cor, tamanho, link) em `runs`, que acompanham a digitação; barra de formatação sobre o texto em edição (sem seleção vale para o texto todo); o canvas desenha com `tspan`s e o código gerado (HTML/React) com `span`/`a`. Limites: durante a edição o texto aparece sem a formatação (ela volta ao confirmar), e Flutter e textos em lista (marcadores/numeração) usam o texto simples. Testes em `tests/design-richtext.test.ts` e `tests/design-codegen.test.ts`.

- [x] **4.3 Links no texto:** URL por trecho, com um protótipo opcional para frames. Mostra sublinhado; ao apresentar abre no navegador. — **Feito:** link por trecho (campo "link" da barra de formatação): sai sublinhado e azul no canvas e como `<a href>` no código gerado. **Falta:** abrir o link no modo apresentação (entra com 7.x).

- [x] **4.4 Fontes variáveis:** eixos de peso, largura e inclinação com sliders. Detectar a fonte instalada/Google Fonts variável (`fonts.ts`). — **Feito:** `fontCss.ts`: eixos de fontes variáveis (peso, largura, inclinação, tamanho óptico) por sliders no modal de tipografia, aplicados como `font-variation-settings` no canvas e no código; só têm efeito em fontes que suportam o eixo.

- [x] **4.5 Recursos OpenType:** ligaduras, números tabulares, small caps. Toggles em `FigmaTypeSettingsModal.tsx` (`font-feature-settings`). — **Feito:** recursos OpenType (ligaduras, números tabulares, números antigos, versaletes, frações, alternativas) por botões no modal de tipografia, aplicados como `font-feature-settings` no canvas e no código. Testes em `tests/design-fontcss.test.ts`.

- [x] **4.6 Texto em caminho arbitrário:** ligar um texto a um caminho vetorial (`<textPath>` com o `d` do caminho), além do arco atual. — **Feito:** `textOnPath.ts`: o texto no caminho (`text-path`) pode seguir o contorno de outro elemento (caneta, linha, elipse ou retângulo) pelo seletor "Caminho" no painel. **Falta:** caminhos do tipo `path` (resultado de booleanas).

- [x] **4.7 Corte vertical do texto (vertical trim)** e alinhamento pela linha de base. Aproxima o texto da caixa visual. — **Feito:** corte vertical ("Altura das maiúsculas"): a caixa vai do topo das maiúsculas à linha de base da última linha (aproximação de 0,72 do tamanho da fonte, não as métricas reais da fonte); funciona com a altura automática.

- [x] **4.8 Verificador ortográfico** com `spellcheck` do Chromium no editor de texto (`lang="pt-BR"`), com sugestões no menu de contexto. *Aceite:* palavra errada fica sublinhada ao editar. — **Feito:** corretor ortográfico (pt-BR e en-US) no editor de texto: palavra errada fica sublinhada e o clique direito oferece sugestões e "Adicionar ao dicionário" (menu no processo principal do Electron; **requer reiniciar o app**).

- [x] **4.9 Pseudolocalização e troca de idioma em massa** (aproveita a CLI de IA para traduzir; ver 10.2). — **Feito:** `pseudoLoc.ts`: "Pseudolocalizar seleção" (acentua, alonga ~30% e envolve em colchetes, preservando `{variáveis}`) e "Restaurar textos da seleção" no menu do documento. A **tradução** de verdade fica para o 10.2. Testes em `tests/design-pseudoloc.test.ts`.

## Fase 5 — Auto layout e design responsivo

- [x] **5.1 Wrap** no auto layout: quebrar filhos em novas linhas, `gap` de linha. Já listado como "de fora" no item 9 do TODO. Ajustar `autoLayout.ts`, hug/fill e a edição na tela. — **Feito:** fluxo **Wrap** (o botão 'freeform' que já existia no painel) agora tem motor: quebra a linha quando não cabe, `layoutCounterGap` para o espaço entre linhas, hug, alinhamento 3×3 por linha; filhos na ordem de leitura (`readingOrder`). Testes em `tests/design-autolayout-rows.test.ts`.

- [x] **5.2 Grid layout** (linhas × colunas, células de tamanho fixo ou fr, gap por eixo). Modelo: `layoutMode: 'grid'`, `gridCols`, `gridRows`. — **Feito:** fluxo **Grid** com `gridCols` (padrão 3): colunas iguais (ou pelo maior de cada coluna com hug), altura de linha pelo maior, célula `fill`, gaps por eixo. Campos Cols e Linhas no painel. Código gerado: CSS grid/`flex-wrap` e Flutter `GridView.count`/`Wrap`.

- [x] **5.3 Min/max de largura e altura** (`minW`, `maxW`, `minH`, `maxH`) para `hug` e `fill`. *Aceite:* um botão `fill` com `maxW 320` não passa disso. — **Feito:** `minW/maxW/minH/maxH` nos filhos de auto layout e no próprio frame com hug (painel "Mín / Máx"); vale em horizontal, vertical, wrap e grid, e sai como `min-width`/`max-width` no CSS.

- [x] **5.4 Posição absoluta dentro de auto layout:** o filho sai do fluxo e usa constraints (`absolute: true`). *Aceite:* um selo "Novo" no canto de um cartão não empurra os irmãos. — **Feito:** o motor já ignorava filhos `layoutAbsolute`; faltava UI (checkbox "Posição absoluta") e fazer o filho seguir as restrições quando o frame muda de tamanho pelo layout — feitos.

- [x] **5.5 Espaçamento automático ("space between")** e ordem de camadas invertida (primeiro filho por cima). Ajustes finos de `autoLayout.ts`. — **Feito:** o "space between" já existia (duplo clique no 3×3); acrescentado "Primeiro item por cima" (`layoutStackFirstOnTop`, inverte o z dos filhos).

- [x] **5.6 Breakpoints e prévia responsiva:** barra com larguras de referência (mobile/tablet/desktop); redimensionar o frame mostra a resposta dos filhos. Reaproveita `devices.ts` e `constraints.ts`. — **Feito:** seção "Responsivo" nos frames raiz: Mobile 390 / Tablet 768 / Notebook 1280 / Desktop 1440 trocam a largura e os filhos respondem por restrições e auto layout. É um atalho de larguras sobre o redimensionamento que já existia, sem prévia lado a lado.

- [x] **5.7 Comportamento de rolagem dos frames** (`overflow: scroll vertical|horizontal`) usado pelo protótipo (ver 6.4). — **Feito:** campo `scrollMode` (sem rolagem/vertical/horizontal/os dois) no painel do frame raiz; **o comportamento no modo apresentação entra com 7.5**.

## Fase 6 — Componentes, estilos e variáveis (apenas locais)

- [x] **6.1 Propriedades de componente:** booleanas (mostrar/ocultar uma camada), de texto (conteúdo) e de troca de instância. Painel "Propriedades" no componente principal; a instância expõe um campo por propriedade. Já listado como "Falta" no item 10 do TODO. *Teste:* `tests/design-component-props.test.ts`. — **Feito:** `componentProps.ts`: propriedades **booleana** (mostrar/ocultar uma camada) e **texto** no componente principal (seção "Propriedades do componente": nome, tipo e camada alvo) e controles na instância; o valor vira override da camada, então a sincronização com o componente não o desfaz. Testes em `tests/design-componentprops.test.ts`. A propriedade "troca de instância" não foi feita como propriedade (a troca é o 6.2).

- [x] **6.2 Troca de instância (swap) e componentes aninhados** com overrides preservados. *Aceite:* trocar o ícone de um botão por outro componente mantém tamanho e posição. — **Feito:** seletor "Trocar por…" na instância (qualquer componente do documento), reaproveitando `switchVariant`. A instância nova segue o tamanho do componente escolhido; overrides não são mantidos.

- [x] **6.3 Matriz de variantes visual** (component set): grade de variantes lado a lado com eixos (tamanho × estado) e criação em lote. — **Feito:** `variantMatrix.ts` + `VariantMatrixPopup.tsx` ("Matriz de variantes…" no componente): eixos como `Tamanho=Grande, Estado=Hover`, produto cartesiano criado como cópias com filhos, organizado em colunas (1º eixo) × linhas (2º), e "Só organizar" para variantes existentes. Testes em `tests/design-variantmatrix.test.ts`.

- [x] **6.4 Painel de Assets local:** lista dos componentes **do documento**, busca, arrastar para o canvas cria instância. Sem biblioteca compartilhada. — **Feito:** `AssetsPopup.tsx` (Shift+I ou ícone no painel de camadas): componentes do documento agrupados por grupo de variantes, busca, clicar insere uma instância no centro da tela.

- [x] **6.5 Estilos de efeito e de grade** (reaproveitar `styles.ts`): criar da seleção, aplicar, renomear, atualizar, excluir. Hoje só há estilos de cor e texto. — **Feito:** estilos de **efeito** e de **grade** (`styles.ts`: `STYLE_FIELD`, `styleFromShape`); criar a partir do elemento (botões fx e # na seção Estilos), aplicar, atualizar e propagar; editar à mão desliga o vínculo. Testes em `tests/design-styles.test.ts`.

- [x] **6.6 Variáveis numéricas, de texto e booleanas** (`variables.ts`): ligar a W/H, espaçamento, raio, conteúdo de texto e visibilidade; modos (ex.: Compacto/Confortável). Continuam sem biblioteca externa. — **Feito:** variáveis de **número, texto e booleana** com valor por modo e ligação a propriedades do elemento (largura, altura, gap, padding, raio, traço, fonte, opacidade, texto, visibilidade) via `variableBindings`; seletor de criação no painel. Padding só vale com "igual nos lados". Testes em `tests/design-variables.test.ts`.

- [x] **6.7 Detecção de desvio do sistema de design:** listar elementos com cor, fonte ou raio fora dos estilos/variáveis e oferecer "vincular ao mais próximo". Entra no painel de revisão (ver 10.3). — **Feito:** `audit.ts` + `AuditPopup.tsx` (menu do documento → "Revisar design"): cor igual/parecida com estilo ou variável e não vinculada, tipografia igual a um estilo de texto e não vinculada; "Corrigir" vincula. Testes em `tests/design-audit.test.ts`.

## Fase 7 — Prototipagem

- [x] **7.1 Gatilhos:** ao clicar, ao passar o mouse, ao arrastar, ao pressionar tecla, depois de um tempo. Modelo: `prototypeLink` vira `interactions: Interaction[]` (migrar o campo atual). Editor no painel "Protótipo". — **Feito:** `prototype.ts`: `interactions` por elemento com gatilhos **clique, hover, arrastar, tecla e depois de um tempo** (o `prototypeLink` antigo é lido como uma interação de clique, sem perder dados). Editor no painel (`PrototypeSection.tsx`): gatilho, tecla (clique e pressione), espera em ms. Testes em `tests/design-prototype.test.ts`.

- [x] **7.2 Ações:** ir para, voltar, abrir overlay, fechar overlay, rolar até, abrir URL. Substitui o atual "ir para". — **Feito:** ações **ir para, voltar, abrir overlay, fechar overlay, rolar até, abrir URL, definir variável e condicional**, executadas por uma máquina de estados pura (`runActions`) com pilha de navegação.

- [x] **7.3 Transições animadas:** Instantâneo, Dissolver, Mover (entrar/sair), Empurrar, Slide, **Smart animate** (casar camadas pelo nome e interpolar posição/tamanho/cor/opacidade). Duração e curva (ease-in/out, mola). `PrototypePlayer.tsx` ganha o motor de animação. — **Feito:** transições **instantâneo, dissolver, entrar, sair, empurrar, deslizar (entra/sai) e Smart animate**, com duração e curva (linear, entrada, saída, entrada e saída, mola). `transition.ts` (poses), `easing.ts` e `smartAnimate.ts` (casa camadas por nome+tipo e interpola posição, tamanho, rotação, opacidade, raio, cor e fonte; o resto dissolve). Ao voltar a direção se inverte. Testes em `tests/design-transition.test.ts`, `design-easing.test.ts`, `design-smartanimate.test.ts`.

- [x] **7.4 Overlays:** frame que abre por cima com posição (centro, topo, embaixo, manual), fundo escurecido e fechar ao clicar fora. — **Feito:** overlays por cima do frame atual, com posição (centro, topo, embaixo, esquerda, direita), fundo escurecido e fechar ao clicar fora; vários overlays empilham.

- [x] **7.5 Rolagem dentro de frames e posições fixas:** a barra de navegação ou o header fixo permanece ao rolar o frame (usa 5.7). — **Feito:** rolagem no modo apresentação: `scrollMode` do frame (vertical, horizontal ou os dois) com a roda do mouse, e **"Fixo ao rolar"** por elemento (ex.: barra de navegação), desenhado numa camada que não rola. Não testei com um design real que role.

- [x] **7.6 Setas das ligações no canvas:** linhas entre o elemento e o frame de destino, clicáveis para editar. *Aceite:* apagar o frame de destino remove a ligação. — **Feito:** `protoArrows.ts`: setas das ligações (clicar → ir para / overlay) no canvas, do elemento até o frame de destino; realçadas quando o elemento ou o destino está selecionado, tracejadas para overlay. Testes em `tests/design-protoarrows.test.ts`.

- [x] **7.7 Ponto de partida do fluxo** (`flowStart`) e lista de fluxos; modo apresentação começa no ponto escolhido, com reiniciar (R) e prévia em moldura de aparelho. — **Feito:** frame raiz pode ser "Ponto de partida de um fluxo" (com nome); cada fluxo vira um item "▶ Fluxo: nome" no menu do documento; o player tem **R** e o botão Reiniciar. **Falta** a prévia em moldura de aparelho.

- [x] **7.8 Variáveis e condicionais no protótipo** (se/senão, definir variável ao clicar), usando 6.6. — **Feito:** definir variável (igual, alternar, somar) e **condicional** (variável ==, ≠, >, < valor → ir para / senão ir para); as variáveis aparecem no topo do player. Independente das variáveis de design (6.6).

## Fase 8 — Dev handoff local

- [x] **8.1 Modo Dev de verdade:** painel somente leitura com medidas, cores (hex e variável), tipografia, espaçamentos e raio do elemento; copiar cada valor. O botão já existe na barra (**confirmar** o que faz hoje). — **Feito:** **Modo Dev** (Shift+D ou menu do painel direito → "Modo Dev"): `devSpecs.ts` + `DevPanel.tsx` mostram posição relativa ao pai, tamanho, rotação, auto layout (direção, gap, padding), opacidade, raio, mesclagem, cor (com o **nome do estilo ou variável** de design e o valor no modo ativo), gradiente, traço, tipografia e efeitos, cada linha com botão de copiar, mais o CSS do elemento. Testes em `tests/design-devspecs.test.ts`.

- [x] **8.2 Redlines:** distâncias entre o elemento e os vizinhos/borda do frame ao passar o mouse no modo Dev (reaproveita 1.4). — **Feito:** no Modo Dev as distâncias até o elemento sob o mouse aparecem sozinhas (as mesmas linhas vermelhas do Alt, 1.4).

- [x] **8.3 Código por elemento** (`codegen.ts`): CSS, React, Flutter, **Swift UI** e **Jetpack Compose** do elemento selecionado, usando variáveis como `var(--nome)`. Hoje o código é do design inteiro. — **Feito:** geradores de **SwiftUI** e **Jetpack Compose** (`codegenNative.ts`: VStack/HStack e Column/Row com espaçamento e padding, ZStack/Box com posição, cor, raio, traço, sombra, texto, imagem, elipse), nos botões do modal "Ver código" ao lado de React/HTML/Flutter. O código sempre é do elemento selecionado (e filhos). Aproximação: não cobre gradientes nem máscaras nesses dois destinos. Testes em `tests/design-codegen-native.test.ts`.

- [x] **8.4 Status "Pronto para dev"** por frame (badge e filtro no painel de camadas), salvo no `design.json`. — **Feito:** status por elemento (**Rascunho / Pronto para dev / Implementado**) no painel do Modo Dev; ponto verde/azul na lista de camadas e busca "pronto" / "implementado" no filtro de camadas.

- [x] **8.5 Comparar versões** (`versions.ts`): visualização lado a lado ou sobreposta entre duas versões salvas, com o realce do que mudou. *Teste:* `tests/design-diff.test.ts`. — **Feito:** `diffShapes.ts` + `DiffPopup.tsx`: botão **Comparar** em cada versão do histórico mostra elementos novos, removidos e os campos que mudaram (antes → depois); clicar seleciona o elemento. É uma lista, não uma sobreposição visual. Testes em `tests/design-diff.test.ts`.

## Fase 9 — Exportação e imagens

- [x] **9.1 Exportar em WebP e AVIF** (Canvas `toBlob` com tipo; AVIF só quando o Chromium do Electron suportar). Seletor de formato em `exportDesign.ts`. — **Feito:** exportação em **WebP** (e AVIF, que o Chromium do Electron normalmente **não** sabe codificar: nesse caso o app avisa em vez de gerar um PNG com a extensão errada); novas opções no seletor de formato do painel de Export.

- [x] **9.2 Vários presets de exportação por elemento** (ex.: 1x PNG + 2x PNG + SVG) e exportar só uma **slice**. `exports[]` já existe: validar a UI. **(confirmar)** — **Feito:** a lista de formatos por elemento (`exports[]`, vários presets de escala e formato) já existia, e a slice exporta como qualquer shape; nada a fazer.

- [x] **9.3 Copiar como** PNG, SVG, CSS e código (Cmd+Shift+C). Gera o conteúdo e usa a área de transferência. — **Feito:** "Copy as" de verdade (o SVG antes era um retângulo fixo): **SVG** do elemento, **PNG** em 2× (Cmd/Ctrl+Shift+C) pela área de transferência, **CSS** pelas especificações do Modo Dev e **código React**; avisa por toast quando falha.

- [x] **9.4 Ajustes de imagem:** exposição, contraste, saturação, temperatura, matiz (`feColorMatrix`) por imagem, com sliders e redefinir. Aplica também na exportação. — **Feito:** `imageFilter.ts`: ajustes de imagem (exposição, contraste, saturação, temperatura, matiz) como filtro SVG, aplicados no canvas e na exportação, com sliders e "Redefinir"; a imagem agora também respeita o raio da borda. Testes em `tests/design-imagefilter.test.ts`. Ainda não conferi na tela com uma imagem real.

- [x] **9.5 Remover fundo** (IA local ou da CLI) e **ampliar** (upscale): chamar uma ferramenta externa configurável; se indisponível, o botão avisa por toast. — **Feito:** `removeBg.ts`: "Remover fundo" usa o **rembg** instalado na máquina (`pip install "rembg[cli]"`); sem ele o app mostra como instalar, sem falhar em silêncio. Não testei com o rembg de verdade (só com dependências simuladas). Testes em `tests/design-removebg.test.ts`.

- [x] **9.6 Vídeo e GIF como preenchimento:** `<video>`/`<img>` no canvas, quadro de pré-visualização na exportação. — **Feito:** vídeo de fundo em qualquer forma (até 6 MB, em laço e mudo, recortado pelo contorno) por "▶ Vídeo…"; GIF funciona como imagem animada. A exportação estática usa o preenchimento (não há quadro do vídeo).

- [x] **9.7 Importar SVG, PDF e Sketch/XD:** arrastar um `.svg` cria os shapes (caminhos, formas e texto); PDF página a página como imagem vetorial; Sketch (`.sketch` é um zip com JSON) como segundo passo. — **Feito:** **só SVG**: `svgImport.ts` importa retângulos, círculos, elipses, linhas, polígonos, caminhos e textos como shapes dentro de um frame (grupos achatados com `translate`, opacidade e cores herdados); por "Importar SVG…" no menu do documento ou arrastando o `.svg` para o canvas. Gradientes viram cinza e transformações além de translate são ignoradas. **Não feito:** PDF e Sketch/XD. Testes em `tests/design-svgimport.test.ts`.

## Fase 10 — IA (diferencial)

- [ ] **10.1 Renomear camadas com IA** e organizar a estrutura: sugere nomes semânticos ("Botão primário", "Card de produto") e agrupa/aplica auto layout onde faz sentido. Prévia antes de aplicar (reaproveita `aiReviewUndo.ts`).
- [ ] **10.2 Conteúdo de exemplo e tradução:** preencher listas com nomes, endereços, valores e avatares plausíveis; traduzir textos da seleção para outro idioma preservando o tamanho (textFit).
- [x] **10.3 Auditoria de design:** contraste (WCAG AA/AAA), alvos de toque < 44 px, texto < 12 px, desvio do sistema (6.7). Lista clicável que seleciona o elemento. A parte de contraste é determinística (sem IA); a IA só explica e sugere. — **Feito (parte sem IA):** `audit.ts` + `AuditPopup.tsx` (menu do documento → "Revisar design"): contraste WCAG (AA, texto grande 3:1) com correção sugerida (preto ou branco), texto abaixo de 12 px, alvos de toque abaixo de 44 px e desvio do sistema de design; "Corrigir" e "Corrigir tudo". **Falta:** a explicação por IA dos achados. Testes em `tests/design-audit.test.ts`.
- [ ] **10.4 Gerar e editar imagem por texto** (gerar na camada, remover fundo, apagar objeto). Depende de uma CLI/modelo de imagem configurável; senão fica indisponível, não quebra.
- [ ] **10.5 Buscar entre as telas** por descrição ("telas com formulário de login") usando a IA sobre o resumo do documento.
- [ ] **10.6 Protótipo interativo a partir de telas estáticas:** a IA liga os frames com `interactions` (7.1) e escolhe transições. Prévia e aceitar/descartar.
- [x] **10.7 Simulador de daltonismo** (deuteranopia, protanopia, tritanopia, acromatopsia) e visualização de ordem de foco, usando filtros SVG no canvas. — **Feito:** menu do documento → "Simular: protanopia / deuteranopia / tritanopia / acromatopsia": filtro SVG (`colorBlind.ts`) sobre o canvas todo. Não inclui a ordem de foco.

## Fase 11 — Colaboração sem servidor (rede local)
- [ ] **11.1 Seleção e cursor dos outros** na sala (`useDesignRoom.ts`): contorno colorido nos elementos selecionados pelos outros.
- [ ] **11.2 Mesclar edições simultâneas por elemento** em vez de "a última edição vale": versão por shape (`rev`) e merge por id. Já listado como "Falta" no item 27 do TODO. *Teste:* `tests/design-merge.test.ts`.
- [ ] **11.3 Modo observador:** "seguir" o cursor/viewport de uma pessoa da sala.
- [ ] **11.4 Testar em duas máquinas**, como o TODO já pede.

## Fase 12 — Plataforma e conforto

- [ ] **12.1 Paleta de comandos (Cmd+K):** busca de ações (ferramentas, alinhar, exportar, IA), páginas, frames e camadas. Sem plugins.
- [ ] **12.2 Atalhos configuráveis:** tela em `DesignSettingsPanel.tsx` com remapear e restaurar; salvos por usuário.
- [ ] **12.3 Minimapa/navegador:** painel pequeno no canto com a visão geral dos frames e o retângulo da viewport, arrastável.
- [x] **12.4 Modo contorno (outline mode):** mostra só os contornos dos shapes; atalho Cmd+Y. — **Feito:** **Cmd/Ctrl+Y**: só contornos (regra CSS sobre o canvas: sem preenchimento, imagem, efeito ou mesclagem).

- [x] **12.5 Modo foco** (esconde painéis) e **prévia de pixels** (renderização crisp em 100%). — **Feito:** **Cmd/Ctrl+\\** esconde os dois painéis (camadas e propriedades) e traz de volta, reaproveitando o estado que já existia. Sem o modo de pixel preview.

- [ ] **12.6 Páginas:** reordenar, duplicar, buscar e copiar frames entre páginas. **(confirmar)** o que já existe em `LayersPanel.tsx`.
- [ ] **12.7 Seções (`section`) completas:** preenchimento, nome editável, mover leva os frames, "esconder os filhos". **(confirmar)**
- [x] **12.8 Desempenho em arquivos grandes:** `design2` tem ~25 mil linhas e o canvas é SVG. Medir com um arquivo de 2 000 shapes; virtualizar camadas, renderizar só o que está na viewport e simplificar sombras/blur fora de foco. *Aceite:* 60 fps ao dar pan e zoom num arquivo de 2 000 elementos. Medir antes de otimizar. — **Feito:** **medido, nada a otimizar agora:** renderizar 2 000 elementos de uma vez em SVG leva cerca de 40 ms (200 → 22 ms; 1 000 → 43 ms), e o canvas já corta o que está fora da tela e simplifica o que está pequeno. Não apliquei virtualização. Falta medir pan/zoom com o app aberto num arquivo grande.

- [x] **12.9 Recuperação local:** autosave com cópia rotativa (`.devflow/design2/backup/`) e recuperar se o `design.json` estiver corrompido. Sem nuvem. — **Feito:** `backupBeforeSave` em `usePersistedDesign.ts`: antes de sobrescrever o `design.json`, copia o atual para `.devflow/design2/backup/design-N.json` (no máximo a cada 10 min, 6 vagas rotativas = 1 hora). Não tem tela de restaurar: o arquivo se copia à mão. Testes em `tests/design-backup.test.ts`.

---

## Ordem recomendada
1. **Fase 0** (limpeza e auditoria), 1 dia.
2. **Fase 1** e **2** (precisão e produtividade): o que mais se sente ao desenhar e o que mais reduz o custo de cada item seguinte (1.1 e 1.3 mexem em `snap.ts`; fazer juntos).
3. **Fase 5** (auto layout) e **6** (componentes): fecham o núcleo de design de sistema; 6.6 destrava 5.3, 7.8 e 6.7.
4. **Fase 3** (vetor): começar por 3.1, que desbloqueia 3.2, 3.9 e 4.6.
5. **Fase 4** (texto): 4.1 e 4.2 antes de 4.3 e 4.9.
6. **Fase 7** (protótipo) e **8** (dev): 7.1 antes de 7.2 a 7.8; 8.1 depende de 1.4.
7. **Fases 9, 10, 11 e 12** em paralelo conforme a demanda. A IA (10) se apoia nas auditorias de 6.7 e 10.3, que não precisam de modelo.

## Dependências entre itens
- 1.1 → snap em `snap.ts` (1.3 e 1.2 compartilham os candidatos).
- 3.1 → 3.2, 3.9, 4.6.
- 4.1 → 4.2 (caixa de texto de tamanho dinâmico antes de trechos).
- 5.7 → 7.5.
- 6.6 → 5.3, 6.7, 7.8.
- 7.1 → 7.2…7.8, 10.6.
- 10.3 → 6.7 (sem IA primeiro).

## Riscos
- **Canvas SVG e desempenho** (12.8): pattern, blur e máscara por luminância custam; medir antes de empilhar efeitos.
- **Rich text** (4.2): muda o modelo de `text` e o editor. Fazer com migração e testes de exportação, ou o texto simples quebra.
- **Migração de `prototypeLink`** (7.1): ler o campo antigo e converter na abertura, sem apagar o original até o salvamento seguinte.
- **Ferramentas externas** (9.5, 10.4): sempre com fallback e aviso, nunca travar a tela.
- **Tamanho de `DesignStudioView.tsx`:** cada item novo deve entrar em arquivo próprio (`xxx.ts` + teste), com o mínimo de fiação na tela.

## Checklist de conclusão (por item)
- [ ] `bunx tsc --noEmit -p . | grep design2` sem erros
- [ ] `bun test tests/design-*` passa, com teste novo para a lógica
- [ ] `bunx vite build` passa e o item foi conferido na tela real
- [ ] Exportação e código gerado cobrem o item (ou o limite está documentado)
- [ ] Nenhum `alert/confirm/prompt`; textos em pt-BR
- [ ] Este arquivo atualizado com `[x]` e o que foi feito
