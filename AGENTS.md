# Diretrizes e Regras do Projeto DevFlow

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
