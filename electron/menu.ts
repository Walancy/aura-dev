import { Menu, MenuItemConstructorOptions, BrowserWindow, dialog, shell } from 'electron';

export function setupApplicationMenu(getMainWindow: () => BrowserWindow | null) {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // 1. App Menu (macOS only)
    ...(isMac
      ? [
          {
            label: 'Aura Dev',
            submenu: [
              {
                label: 'Sobre o Aura Dev',
                click: () => {
                  dialog.showMessageBox({
                    type: 'info',
                    title: 'Aura Dev',
                    message: 'Aura Dev v1.0.0',
                    detail: 'Ambiente de desenvolvimento nativo integrado com suporte a Claude Code CLI e Google Antigravity (AGY).\n\nDesenvolvido para alta performance no macOS.',
                    buttons: ['OK'],
                  });
                },
              },
              { type: 'separator' as const },
              {
                label: 'Preferências...',
                accelerator: 'CmdOrCtrl+,',
                click: () => {
                  const win = getMainWindow();
                  win?.webContents.send('menu:action', 'preferences');
                },
              },
              {
                label: 'Verificar Atualizações...',
                click: () => {
                  dialog.showMessageBox({
                    type: 'info',
                    title: 'Atualizações',
                    message: 'Você está usando a versão mais recente do Aura Dev (v1.0.0-beta).',
                    buttons: ['OK'],
                  });
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: 'Ocultar Aura Dev' },
              { role: 'hideOthers' as const, label: 'Ocultar Outros' },
              { role: 'unhide' as const, label: 'Mostrar Todos' },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Sair do Aura Dev' },
            ],
          },
        ]
      : []),

    // 2. File Menu
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Novo Arquivo',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'new-file');
          },
        },
        {
          label: 'Abrir Arquivo...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = getMainWindow();
            if (!win) return;
            const res = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
            });
            if (!res.canceled && res.filePaths.length > 0) {
              win.webContents.send('menu:open-file', res.filePaths[0]);
            }
          },
        },
        {
          label: 'Abrir Pasta do Projeto...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const win = getMainWindow();
            if (!win) return;
            const res = await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
            });
            if (!res.canceled && res.filePaths.length > 0) {
              win.webContents.send('menu:open-folder', res.filePaths[0]);
            }
          },
        },
        { type: 'separator' as const },
        {
          label: 'Salvar',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'save-file');
          },
        },
        {
          label: 'Salvar Como...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'save-as');
          },
        },
        { type: 'separator' as const },
        { role: 'close' as const, label: 'Fechar Janela' },
      ],
    },

    // 3. Edit Menu
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' as const, label: 'Desfazer' },
        { role: 'redo' as const, label: 'Refazer' },
        { type: 'separator' as const },
        { role: 'cut' as const, label: 'Recortar' },
        { role: 'copy' as const, label: 'Copiar' },
        { role: 'paste' as const, label: 'Colar' },
        { role: 'selectAll' as const, label: 'Selecionar Tudo' },
        { type: 'separator' as const },
        {
          label: 'Buscar no Projeto...',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'search-project');
          },
        },
      ],
    },

    // 4. View Menu
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload' as const, label: 'Recarregar' },
        { role: 'forceReload' as const, label: 'Forçar Recarregamento' },
        { role: 'toggleDevTools' as const, label: 'Ferramentas do Desenvolvedor' },
        { type: 'separator' as const },
        { role: 'resetZoom' as const, label: 'Tamanho Real' },
        { role: 'zoomIn' as const, label: 'Aumentar Zoom' },
        { role: 'zoomOut' as const, label: 'Diminuir Zoom' },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const, label: 'Tela Cheia' },
        { type: 'separator' as const },
        {
          label: 'Alternar Barra Lateral (Explorer)',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'toggle-explorer');
          },
        },
        {
          label: 'Alternar Terminal Integrado',
          accelerator: 'Ctrl+`',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'toggle-terminal');
          },
        },
        {
          label: 'Alternar Painel de IA (Aura Dev)',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'toggle-ai');
          },
        },
      ],
    },

    // 5. AI & Agents Menu
    {
      label: 'Agentes IA',
      submenu: [
        {
          label: 'Iniciar Claude Code CLI',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'run-claude');
          },
        },
        {
          label: 'Iniciar Google Antigravity (AGY)',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'run-agy');
          },
        },
        { type: 'separator' as const },
        {
          label: 'Perguntar ao Agente Aura Dev...',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'focus-ai-prompt');
          },
        },
        {
          label: 'Explicar Código Selecionado',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'ai-explain');
          },
        },
        {
          label: 'Refatorar e Otimizar com IA',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'ai-refactor');
          },
        },
        {
          label: 'Gerar Testes Unitários Automáticos',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'ai-tests');
          },
        },
      ],
    },

    // 6. Terminal Menu
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'Novo Terminal (zsh)',
          accelerator: 'Ctrl+Shift+`',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'new-terminal');
          },
        },
        {
          label: 'Dividir Terminal Horizontalmente',
          accelerator: 'CmdOrCtrl+\\',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'split-terminal');
          },
        },
        {
          label: 'Limpar Terminal',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'clear-terminal');
          },
        },
        { type: 'separator' as const },
        {
          label: 'Escanear Portas em Uso (Ports)',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            const win = getMainWindow();
            win?.webContents.send('menu:action', 'scan-ports');
          },
        },
      ],
    },

    // 7. Window Menu
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize' as const, label: 'Minimizar' },
        { role: 'zoom' as const, label: 'Zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const, label: 'Trazer Todas para a Frente' },
              { type: 'separator' as const },
              { role: 'window' as const, label: 'Janela' },
            ]
          : [{ role: 'close' as const, label: 'Fechar' }]),
      ],
    },

    // 8. Help Menu
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Documentação do Aura Dev',
          click: async () => {
            await shell.openExternal('https://github.com');
          },
        },
        {
          label: 'Guia do Google Antigravity (AGY)',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Google Antigravity (AGY)',
              message: 'Google Antigravity CLI integrado',
              detail: 'O AGY v2.4 permite orquestrar agentes e executar tarefas com verificação em background.',
              buttons: ['Entendido'],
            });
          },
        },
        {
          label: 'Guia do Claude Code CLI',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Claude Code CLI',
              message: 'Claude Code CLI integrado',
              detail: 'Execute `claude` no terminal integrado para iniciar uma sessão de pair-programming com Claude Sonnet 3.7 / 5.',
              buttons: ['Entendido'],
            });
          },
        },
        { type: 'separator' as const },
        {
          label: 'Atalhos de Teclado',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Atalhos do Aura Dev',
              message: 'Principais Atalhos:',
              detail: '• Cmd+N: Novo Arquivo\n• Cmd+O: Abrir Arquivo\n• Cmd+Shift+O: Abrir Pasta\n• Cmd+S: Salvar\n• Cmd+L: Foco no Agente IA\n• Cmd+Shift+C: Executar Claude Code\n• Cmd+Shift+G: Executar AGY CLI\n• Ctrl+`: Alternar Terminal\n• Cmd+B: Alternar Explorer',
              buttons: ['Fechar'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
