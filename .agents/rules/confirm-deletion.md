---
name: confirm-deletion-rule
description: Exigência obrigatória de modal de confirmação para todas as ações de exclusão no projeto
always_on: true
---

# Regra Obrigatória: Modal de Confirmação para Ações de Exclusão

Ao implementar, editar ou adicionar qualquer funcionalidade de exclusão ou remoção de dados (como sprints, tarefas, issues, arquivos, repositórios, branches, links ou configurações):

1. **PROIBIDO Exclusão Direta**: Nunca execute uma ação destrutiva de exclusão imediatamente sem antes solicitar confirmação explícita do usuário.
2. **PROIBIDO Diálogos Nativos do Navegador**: Nunca utilize `window.confirm()`, `confirm()` ou `alert()` do navegador.
3. **OBRIGATÓRIO Modal de Confirmação**: Sempre exiba um modal de confirmação visualmente integrado ao design system do DevFlow (utilizando `ConfirmDeleteModal` ou modal equivalente estilizado da aplicação):
   - Deve conter título objetivo (ex: "Excluir Tarefa", "Excluir Sprint").
   - Deve descrever o item que está sendo removido e alertar sobre o caráter irreversível da ação.
   - Deve ter botão de cancelamento seguro ("Cancelar") e botão de exclusão perigoso em vermelho (`#ef4444`).
   - Deve tratar estado de processamento (`isDeleting`/loading) para ações assíncronas.
