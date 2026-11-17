# Diretrizes e Regras do Projeto Aura Dev

## Regra Obrigatória: Modal de Confirmação para Ações de Exclusão

Sempre que criar, editar ou implementar qualquer ação de exclusão ou remoção de dados (como sprints, tarefas, issues, arquivos, repositórios, branches ou configurações):

1. **NUNCA execute a exclusão diretamente** sem confirmação prévia do usuário.
2. **NUNCA use diálogos nativos do navegador** (`window.confirm`, `confirm()`, `alert()`).
3. **SEMPRE utilize um modal de confirmação estilizado** (`ConfirmDeleteModal` ou modal equivalente estilizado da aplicação):
   - Deve apresentar título claro (ex: "Excluir Sprint", "Excluir Tarefa").
   - Deve descrever o item a ser excluído e avisar expressamente que a ação não pode ser desfeita.
   - Deve conter botão de cancelamento seguro ("Cancelar") e botão de confirmação em estilo de perigo/destaque (vermelho `#ef4444`).
   - Deve tratar estado de carregamento/processamento (`isDeleting`/loading) durante operações assíncronas.
   - Deve fechar ao clicar no backdrop ou pressionar Escape (exceto durante a exclusão em andamento).

## Regra Obrigatória: Changelog e Novidades em Toda Release

Toda release (tag `v*`) deve sair com o changelog de tudo o que mudou, e o app mostra isso ao usuário na primeira abertura depois de instalar ou atualizar.

1. **Mantenha o `CHANGELOG.md` (raiz) a cada mudança que o usuário percebe.** Registre em `## [Não lançado]`, nas seções `### Novidades`, `### Melhorias` e `### Correções`. Cada item: `- **Título**: descrição curta, do ponto de vista de quem usa` (sem jargão técnico, sem emojis).
2. **Ao lançar**, renomeie `[Não lançado]` para `## [x.y.z] - AAAA-MM-DD` (a mesma versão do `package.json` e da tag) e crie um novo `## [Não lançado]` vazio acima dele. Nunca crie a tag sem essa seção: o workflow de release roda `bun scripts/changelog.ts check` e falha sem ela.
3. **Prints de referência** quando ajudarem a entender uma novidade visual: salve em `public/changelog/x.y.z/` e coloque `![descrição](changelog/x.y.z/nome.png)` logo abaixo do item. O script de release falha se o arquivo não existir.
4. **O modal de novidades** (`WhatsNewModal`) abre sozinho na primeira execução depois de instalar ou atualizar, com as versões ainda não vistas (no máximo 3) lidas do `CHANGELOG.md`. A versão vista fica em `localStorage` (`aura_last_seen_version`). Não crie outra fonte de novidades: o `CHANGELOG.md` é a única, e também vira o texto da release no GitHub.
5. **Antes de dar a release como pronta**, rode `bun scripts/changelog.ts check <versão>` e confira se o modal mostra o texto e os prints corretamente.
