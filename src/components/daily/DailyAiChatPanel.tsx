import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Sparkles,
  RotateCcw,
  Check,
  Plus,
  GitCommit,
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  FolderGit2,
  ListTodo,
  ExternalLink,
} from 'lucide-react';
import { ClaudeIcon, AntigravityIcon, GeminiIcon } from '../icons/AiProviderIcons';
import { DailyItem, WeeklyGoal } from './DailySchedulerView';

export interface SuggestedTask {
  id: string;
  category: 'yesterday' | 'today' | 'blocker' | 'weekly';
  title: string;
  description?: string;
  projectName?: string;
  tag?: string;
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  estimatedHours?: number;
  added?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedTasks?: SuggestedTask[];
  commitsReferenced?: Array<{ project: string; hash: string; message: string; relativeDate: string }>;
  usedCli?: string;
  modelUsed?: string;
}

interface DailyAiChatPanelProps {
  selectedDate: Date;
  selectedDateIso: string;
  workspacePath?: string;
  repoName?: string;
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
  currentDailyItems: DailyItem[];
  weeklyGoals: WeeklyGoal[];
  onAddDailyItem: (item: Partial<DailyItem>) => void;
  onAddWeeklyGoal: (goal: Partial<WeeklyGoal>) => void;
  selectedAiProvider?: string;
  selectedModel?: string;
  onToast?: (msg: string) => void;
}

export const DailyAiChatPanel: React.FC<DailyAiChatPanelProps> = ({
  selectedDate,
  selectedDateIso,
  workspacePath,
  repoName,
  themeTokens,
  isEffectiveDark,
  accentColor,
  currentDailyItems,
  weeklyGoals,
  onAddDailyItem,
  onAddWeeklyGoal,
  selectedAiProvider = 'claude',
  selectedModel,
  onToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg_welcome',
        sender: 'assistant',
        text: `Olá! Sou seu Copilot de Daily e Weekly. Posso analisar seus commits locais de hoje e ontem em todos os projetos para montar sua Daily automaticamente ou ajudar a planejar as entregas da Weekly.`,
        timestamp: Date.now(),
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Consulta commits recentes via IPC
  const fetchRecentCommits = async (days = 4) => {
    try {
      if (window.electronAPI?.git?.getRecentCommitsSummary) {
        const summaries = await window.electronAPI.git.getRecentCommitsSummary(days);
        if (Array.isArray(summaries) && summaries.length > 0) {
          return summaries;
        }
      }
    } catch (e) {
      console.warn('[DailyAiChat] Erro ao buscar commits locais:', e);
    }
    return [];
  };

  // Trata adição de sugestão
  const handleApplyTask = (msgId: string, task: SuggestedTask) => {
    if (task.category === 'weekly') {
      onAddWeeklyGoal({
        title: task.title,
        priority: (task.priority as any) || 'Alta',
      });
      onToast?.(`Demanda adicionada à Weekly: "${task.title}"`);
    } else {
      onAddDailyItem({
        category: task.category,
        title: task.title,
        description: task.description || 'Sugerido com base no histórico de commits e atividades.',
        projectName: task.projectName || repoName || 'Geral',
        tag: task.tag || (task.category === 'yesterday' ? 'Git Feito' : task.category === 'blocker' ? 'Impedimento' : 'Planejado'),
        priority: task.priority || 'Média',
        estimatedHours: task.estimatedHours || 2,
        dateIso: selectedDateIso,
      });
      onToast?.(`Tarefa adicionada à Daily: "${task.title}"`);
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId || !msg.suggestedTasks) return msg;
        return {
          ...msg,
          suggestedTasks: msg.suggestedTasks.map((t) => (t.id === task.id ? { ...t, added: true } : t)),
        };
      })
    );
  };

  const handleApplyAllTasks = (msgId: string, tasks: SuggestedTask[]) => {
    tasks.forEach((t) => {
      if (!t.added) {
        handleApplyTask(msgId, t);
      }
    });
    onToast?.(`${tasks.length} tarefa(s) adicionadas com sucesso!`);
  };

  const cliInfo = useMemo(() => {
    const p = (selectedAiProvider || '').toLowerCase();
    if (p.includes('codex')) return { cmd: 'codex', label: 'Codex CLI' };
    if (p.includes('antigravity') || p.includes('agy')) return { cmd: 'agy', label: 'Antigravity CLI' };
    if (p.includes('gemini')) return { cmd: 'gemini', label: 'Gemini CLI' };
    return { cmd: 'claude', label: 'Claude Code CLI' };
  }, [selectedAiProvider]);

  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, idx) => {
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ');
      const cleanLine = isBullet ? line.trim().replace(/^[-•]\s*/, '') : line;
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const content = parts.map((p, pIdx) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <strong
              key={pIdx}
              style={{
                fontWeight: 600,
                color: isEffectiveDark ? '#ffffff' : '#0f172a',
              }}
            >
              {p.slice(2, -2)}
            </strong>
          );
        }
        return p;
      });

      if (isBullet) {
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 2, marginBottom: 2 }}>
            <span style={{ color: accentColor, fontSize: 10, lineHeight: 1.4 }}>•</span>
            <span style={{ flex: 1 }}>{content}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} style={{ height: 5 }} />;
      }

      return (
        <div key={idx} style={{ lineHeight: 1.45 }}>
          {content}
        </div>
      );
    });
  };

  // Detecta se o usuário está pedindo explicitamente pra montar/sugerir tarefas (Daily/Weekly),
  // em vez de tratar TODA mensagem como um pedido de sugestão de tarefas.
  const TASK_INTENT_KEYWORDS = [
    'tarefa', 'tarefas', 'sugest', 'sugir', 'monta', 'montar', 'planej',
    'daily', 'weekly', 'demanda', 'backlog', 'sprint',
  ];
  const detectsTaskIntent = (text: string) => {
    const lower = text.toLowerCase();
    return TASK_INTENT_KEYWORDS.some((k) => lower.includes(k));
  };

  // Chama o CLI nativo configurado (Claude Code, AGY, Codex...) com fallback pra API direta.
  // Reaproveitado tanto no modo "sugerir tarefas" quanto no chat natural.
  const callAi = async (aiPrompt: string): Promise<{ rawOutput: string; usedCliName: string; usedModelName?: string }> => {
    let rawOutput = '';
    let usedCliName = '';
    let usedModelName = selectedModel;

    if (window.electronAPI?.ai?.runCli) {
      try {
        const cliRes = await window.electronAPI.ai.runCli({
          cliCmd: cliInfo.cmd,
          prompt: aiPrompt,
          model: selectedModel,
          cwd: workspacePath || undefined,
        });

        const stdout = cliRes?.stdout?.trim() || '';
        const isErrorOutput =
          cliRes?.exitCode !== 0 ||
          stdout.includes("There's an issue with the selected model") ||
          stdout.includes('[claude-code:unrecognized_model]') ||
          stdout.startsWith('Error:');

        if (stdout && !isErrorOutput) {
          rawOutput = stdout;
          usedCliName = cliInfo.label;
        } else if (selectedModel) {
          // Tenta sem model parameter (fallback para modelo nativo default do CLI)
          const retryRes = await window.electronAPI.ai.runCli({
            cliCmd: cliInfo.cmd,
            prompt: aiPrompt,
            model: undefined,
            cwd: workspacePath || undefined,
          });
          const retryStdout = retryRes?.stdout?.trim() || '';
          if (retryStdout && retryRes?.exitCode === 0) {
            rawOutput = retryStdout;
            usedCliName = cliInfo.label;
            usedModelName = 'default';
          }
        }
      } catch (cliErr) {
        console.warn(`[DailyAiChat] Falha ao executar ${cliInfo.cmd}:`, cliErr);
      }
    }

    // Fallback para window.electronAPI.ai.prompt (chamada direta, sem CLI)
    if (!rawOutput && window.electronAPI?.ai?.prompt) {
      try {
        const pRes = await window.electronAPI.ai.prompt(aiPrompt, selectedModel || 'claude-headless', workspacePath);
        if (pRes?.response) {
          rawOutput = pRes.response.trim();
          usedCliName = 'IA API';
        }
      } catch (promptErr) {
        console.warn('[DailyAiChat] Falha no fallback ai.prompt:', promptErr);
      }
    }

    return { rawOutput, usedCliName, usedModelName };
  };

  // Processador com chamada real ao CLI nativo (Claude Code, Antigravity, etc.)
  const processUserRequest = async (userText: string) => {
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    const wantsTaskSuggestions = detectsTaskIntent(userText);

    // Modo conversa natural: sem forçar geração de tarefas, sem fallback inventado.
    if (!wantsTaskSuggestions) {
      try {
        const dailySummary =
          currentDailyItems.length > 0
            ? currentDailyItems.slice(0, 8).map((i) => `- [${i.category.toUpperCase()}] [${i.projectName || 'Geral'}] ${i.title}`).join('\n')
            : 'Nenhuma tarefa cadastrada na Daily para esta data ainda.';

        const chatPrompt = `Você é o Copilot de Engenharia do DevFlow. Converse de forma natural, direta e útil em português do Brasil.
Responda exatamente o que o desenvolvedor perguntou — não force uma lista de tarefas nem inclua blocos JSON. Só sugira tarefas se ele pedir isso explicitamente.

Contexto (use apenas se for relevante para a pergunta):
[TAREFAS ATUAIS DA DAILY]:
${dailySummary}
[PROJETO ATIVO]: ${repoName || 'Geral'}

Mensagem do desenvolvedor: "${userText}"`;

        const { rawOutput, usedCliName, usedModelName } = await callAi(chatPrompt);

        const assistantMsg: ChatMessage = {
          id: `msg_asst_${Date.now()}`,
          sender: 'assistant',
          text: rawOutput || 'Não consegui me conectar à IA agora. Verifique se o CLI configurado está instalado e tente novamente.',
          timestamp: Date.now(),
          usedCli: usedCliName,
          modelUsed: usedModelName,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error('[DailyAiChat] Erro ao processar chat:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            sender: 'assistant',
            text: 'Desculpe, ocorreu uma instabilidade ao processar a consulta.',
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const commitsData = await fetchRecentCommits(5);
      const isAskingWeekly =
        userText.toLowerCase().includes('weekly') ||
        userText.toLowerCase().includes('semana') ||
        userText.toLowerCase().includes('planejar demandas');

      // Compila lista de commits de hoje e ontem
      const allCommitsList: Array<{ project: string; hash: string; message: string; relativeDate: string; isToday: boolean; isYesterday: boolean }> = [];
      commitsData.forEach((p) => {
        p.commits.forEach((c) => {
          allCommitsList.push({
            project: p.projectName,
            hash: c.hash,
            message: c.message,
            relativeDate: c.relativeDate,
            isToday: c.isToday,
            isYesterday: c.isYesterday,
          });
        });
      });

      // Identifica todos os repositórios que tiveram commits recentes
      const detectedProjects = Array.from(
        new Set(allCommitsList.map((c) => c.project).filter((p): p is string => Boolean(p && p.trim())))
      );
      const cleanHeaderRepo = repoName?.includes('/') ? repoName.split('/').pop()! : repoName;
      const primaryActiveRepo = detectedProjects[0] || cleanHeaderRepo || 'Geral';

      const commitsSummary =
        allCommitsList.length > 0
          ? allCommitsList
              .slice(0, 15)
              .map(
                (c) =>
                  `- [REPOSITÓRIO: ${c.project}] commit ${c.hash.slice(0, 7)}: ${c.message} (${c.relativeDate}${
                    c.isToday ? ', HOJE' : c.isYesterday ? ', ONTEM' : ''
                  })`
              )
              .join('\n')
          : 'Nenhum commit local detectado nas últimas 48h.';

      const dailySummary =
        currentDailyItems.length > 0
          ? currentDailyItems
              .slice(0, 8)
              .map((i) => `- [${i.category.toUpperCase()}] [${i.projectName || 'Geral'}] ${i.title}`)
              .join('\n')
          : 'Nenhuma tarefa cadastrada na Daily para esta data ainda.';

      const weeklySummary =
        weeklyGoals.length > 0
          ? weeklyGoals.slice(0, 6).map((g) => `- [WEEKLY] ${g.title} (${g.priority})`).join('\n')
          : 'Nenhuma meta registrada na Weekly atual.';

      const aiPrompt = `Você é o Copilot de Engenharia do DevFlow, especialista em Daily Scrum e Weekly Planning.
Analise os dados reais dos repositórios e projetos locais abaixo e responda ao desenvolvedor:

[REPOSITÓRIOS COM ATIVIDADES DETECTADAS NOS COMMITS]:
${detectedProjects.length > 0 ? detectedProjects.map((p) => `- ${p}`).join('\n') : `- ${primaryActiveRepo}`}

[REPOSITÓRIO ATIVO NO CABEÇALHO DO DEVFLOW]:
${repoName || 'Geral'}

[DATA SELECIONADA]: ${selectedDateIso}

[COMMITS RECENTES DOS PROJETOS LOCAIS]:
${commitsSummary}

[TAREFAS ATUAIS DA DAILY]:
${dailySummary}

[METAS DA WEEKLY]:
${weeklySummary}

[PEDIDO DO USUÁRIO]:
"${userText}"

DIRETRIZES OBRIGATÓRIAS:
1. Responda em Português do Brasil com tom ágil, técnico, objetivo e colaborativo.
2. Analise os commits reais para identificar o que já foi entregue (categoria "yesterday") e o que deve ser priorizado ou continuado para hoje (categoria "today") ou potenciais impedimentos ("blocker").
3. Se o pedido for sobre Weekly, sugira metas estratégicas da semana com categoria "weekly".
4. REGRA FUNDAMENTAL PARA O CAMPO "projectName":
   - Cada tarefa DEVE OBRIGATORIAMENTE ter o campo "projectName" preenchido com o NOME EXATO do repositório/projeto onde a alteração/commit realmente aconteceu (ex: "${primaryActiveRepo}").
   - NUNCA use o repositório selecionado no cabeçalho (${repoName}) se os commits vieram de outro repositório! Use sempre o nome do repositório onde o commit foi realizado (ex: ${detectedProjects.join(', ') || primaryActiveRepo}).
5. NÃO DUPLICAR: antes de sugerir qualquer tarefa nova, compare com a lista em [TAREFAS ATUAIS DA DAILY] e [METAS DA WEEKLY] acima. Se uma atividade equivalente (mesmo assunto/commit/entrega, mesmo com título ligeiramente diferente) já está nessas listas, NÃO a inclua de novo — sugira apenas o que ainda não está coberto. Se não houver nada novo para sugerir, retorne um array vazio "[]" em vez de repetir o que já existe.
6. Ao final da sua resposta, inclua OBRIGATORIAMENTE um bloco com array JSON válido no formato:
\`\`\`json
[
  {
    "category": "yesterday" | "today" | "blocker" | "weekly",
    "title": "Título conciso da tarefa",
    "description": "Explicação breve ou contexto do commit/demanda",
    "projectName": "${primaryActiveRepo}",
    "priority": "Baixa" | "Média" | "Alta" | "Urgente",
    "tag": "Git Sync" | "Hoje" | "Impedimento" | "Weekly" | "Feature"
  }
]
\`\`\`
Não adicione texto explicativo dentro do bloco json. Retorne entre 2 e 5 tarefas relevantes.`;

      const { rawOutput, usedCliName, usedModelName } = await callAi(aiPrompt);

      // Função inteligente para resolver o repositório real da tarefa com base nos commits analisados
      const resolveTaskProject = (
        rawProject: string | undefined,
        title: string,
        desc: string,
        commitHash?: string
      ): string => {
        const combined = `${title} ${desc}`.toLowerCase();

        // A) Se tem commit hash direto
        if (commitHash) {
          const found = allCommitsList.find((c) => c.hash.toLowerCase().startsWith(commitHash.toLowerCase()));
          if (found) return found.project;
        }

        // B) Se algum commit hash está mencionado no título ou descrição
        for (const c of allCommitsList) {
          const short = c.hash.slice(0, 7).toLowerCase();
          if (combined.includes(short)) {
            return c.project;
          }
        }

        // C) Se a IA retornou um projectName que coincide com um dos repositórios com commits
        if (rawProject && rawProject !== 'Projeto' && rawProject !== 'Geral') {
          const cleanRaw = rawProject.includes('/') ? rawProject.split('/').pop()! : rawProject;
          const match = detectedProjects.find(
            (dp) => dp.toLowerCase() === cleanRaw.toLowerCase() || dp.toLowerCase() === rawProject.toLowerCase()
          );
          if (match) return match;
        }

        // D) Tentar casar por palavras-chave ou texto da mensagem do commit
        for (const c of allCommitsList) {
          const cleanMsg = c.message
            .replace(/^(feat|fix|refactor|chore|style)\([^)]*\):\s*/i, '')
            .trim()
            .toLowerCase();
          if (
            cleanMsg.length > 7 &&
            (combined.includes(cleanMsg.slice(0, 20)) || cleanMsg.includes(title.toLowerCase().slice(0, 20)))
          ) {
            return c.project;
          }
        }

        // E) Se todos os commits detectados vieram de um único repositório (ex: 'ainaobra')
        if (detectedProjects.length === 1) {
          return detectedProjects[0];
        }

        // F) Se rawProject for válido e não for genérico nem o repo da header quando não houve commits nele
        if (rawProject && rawProject !== 'Projeto' && rawProject !== 'Geral') {
          const clean = rawProject.includes('/') ? rawProject.split('/').pop()! : rawProject;
          return clean;
        }

        return primaryActiveRepo;
      };

      // Evita sugerir de novo algo que já está na Daily/Weekly (segurança extra, além da
      // instrução dada à própria IA no prompt).
      const normalizeTitle = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const existingTitles = [
        ...currentDailyItems.map((i) => normalizeTitle(i.title)),
        ...weeklyGoals.map((g) => normalizeTitle(g.title)),
      ].filter(Boolean);

      const isDuplicateOfExisting = (title: string) => {
        const norm = normalizeTitle(title);
        if (!norm) return false;
        return existingTitles.some((existing) => {
          if (existing === norm) return true;
          const wordsA = new Set(norm.split(' ').filter((w) => w.length > 2));
          const wordsB = new Set(existing.split(' ').filter((w) => w.length > 2));
          if (wordsA.size === 0 || wordsB.size === 0) return false;
          const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
          const overlapRatio = intersection / Math.min(wordsA.size, wordsB.size);
          return overlapRatio >= 0.7;
        });
      };

      let assistantText = '';
      const suggestedTasks: SuggestedTask[] = [];
      const pushIfNotDuplicate = (task: SuggestedTask) => {
        if (isDuplicateOfExisting(task.title)) return;
        existingTitles.push(normalizeTitle(task.title));
        suggestedTasks.push(task);
      };

      if (rawOutput) {
        // Extrair bloco JSON (suporta ```json ... ``` ou ``` ... ``` ou array puro)
        const jsonMatch =
          rawOutput.match(/```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/i) ||
          rawOutput.match(/(\[\s*\{\s*(?:"category"|"titulo"|"title")[\s\S]*?\}\s*\])/i);

        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed.forEach((item: any, idx: number) => {
                const catLower = String(item.category || item.status || '').toLowerCase();
                let category: 'yesterday' | 'today' | 'blocker' | 'weekly' = 'today';
                if (catLower.includes('yesterday') || catLower.includes('ontem') || catLower.includes('concluido')) {
                  category = 'yesterday';
                } else if (catLower.includes('blocker') || catLower.includes('impedimento')) {
                  category = 'blocker';
                } else if (catLower.includes('weekly') || catLower.includes('semana')) {
                  category = 'weekly';
                }

                const resolvedProject = resolveTaskProject(
                  item.projectName || item.projeto || item.escopo,
                  item.title || item.titulo || item.name || '',
                  item.description || item.descricao || '',
                  item.commit
                );

                pushIfNotDuplicate({
                  id: `task_ai_${Date.now()}_${idx}`,
                  category,
                  title: item.title || item.titulo || item.name || 'Nova demanda sugerida',
                  description: item.description || item.descricao || (item.commit ? `Commit ${item.commit}` : ''),
                  projectName: resolvedProject,
                  tag: item.tag || (category === 'yesterday' ? 'Git Sync' : category === 'blocker' ? 'Impedimento' : category === 'weekly' ? 'Weekly' : 'Hoje'),
                  priority: item.priority || item.prioridade || 'Média',
                  estimatedHours: item.estimatedHours || 2,
                });
              });
            }
            // Remove o bloco JSON para manter a mensagem do assistente limpa e conversacional
            assistantText = rawOutput.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();
          } catch (parseErr) {
            console.warn('[DailyAiChat] Erro no JSON parse da IA:', parseErr);
            assistantText = rawOutput;
          }
        } else {
          assistantText = rawOutput;
        }

        if (!assistantText) {
          assistantText = 'Analisei seu histórico de commits e atividades recentes. Aqui estão as sugestões organizadas:';
        }
      } else {
        // 3. Fallback inteligente local caso o CLI não esteja instalado ou esteja offline
        if (isAskingWeekly) {
          assistantText = `Não foi possível conectar ao CLI (${cliInfo.label}), mas analisei seus projetos locais diretamente. Sugiro as seguintes **demandas prioritárias para a Weekly**:`;
          const activeProjects = commitsData.length > 0 ? commitsData.map((c) => c.projectName) : [repoName || 'Projeto Principal'];

          pushIfNotDuplicate({
            id: `task_wk_${Date.now()}_1`,
            category: 'weekly',
            title: `Finalizar ciclo de refatoração e testes no ${activeProjects[0] || 'projeto'}`,
            description: 'Garantir cobertura e estabilidade nas rotas críticas.',
            projectName: activeProjects[0] || repoName,
            priority: 'Alta',
          });
          pushIfNotDuplicate({
            id: `task_wk_${Date.now()}_2`,
            category: 'weekly',
            title: `Otimizar performance de carregamento e sincronização em background`,
            description: 'Reduzir latência de resposta nos fluxos de dados principais.',
            projectName: activeProjects[1] || activeProjects[0] || repoName,
            priority: 'Média',
          });
        } else if (allCommitsList.length > 0) {
          const yesterdayCommits = allCommitsList.filter((c) => c.isYesterday || !c.isToday).slice(0, 3);
          const todayCommits = allCommitsList.filter((c) => c.isToday).slice(0, 3);

          assistantText = `Identifiquei **${allCommitsList.length} commits recentes** nos seus projetos locais. Aqui está o resumo e as tarefas sugeridas para a sua Daily:`;

          if (yesterdayCommits.length > 0) {
            yesterdayCommits.forEach((c, idx) => {
              pushIfNotDuplicate({
                id: `task_y_${Date.now()}_${idx}`,
                category: 'yesterday',
                title: c.message.replace(/^feat:|^fix:|^refactor:|^chore:/i, '').trim(),
                description: `Commit ${c.hash.slice(0, 7)} em ${c.project} (${c.relativeDate})`,
                projectName: c.project,
                tag: 'Git Sync',
                priority: 'Média',
                estimatedHours: 2,
              });
            });
          }

          const targetProj = commitsData[0]?.projectName || repoName || 'DevFlow';
          pushIfNotDuplicate({
            id: `task_t_${Date.now()}_1`,
            category: 'today',
            title: `Continuidade das implementações e cobertura de testes em ${targetProj}`,
            description: 'Avançar nas demandas planejadas e validação das alterações.',
            projectName: targetProj,
            tag: 'Hoje',
            priority: 'Alta',
            estimatedHours: 3,
          });
        } else {
          assistantText = `Não consegui me conectar à IA e não encontrei commits recentes nas últimas 48h para basear uma sugestão. Verifique se o CLI configurado (${cliInfo.label}) está instalado, ou me conte diretamente o que você fez.`;
        }
      }

      const assistantMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: Date.now(),
        suggestedTasks,
        commitsReferenced: allCommitsList.slice(0, 6),
        usedCli: usedCliName,
        modelUsed: usedModelName,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[DailyAiChat] Erro ao processar:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: 'Desculpe, ocorreu uma instabilidade ao processar a consulta. Você ainda pode usar os atalhos rápidos abaixo.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAiIcon = () => {
    const p = (selectedAiProvider || '').toLowerCase();
    if (p.includes('claude')) return <ClaudeIcon size={14} />;
    if (p.includes('agy') || p.includes('antigravity')) return <AntigravityIcon size={14} />;
    if (p.includes('gemini')) return <GeminiIcon size={14} />;
    return <Sparkles size={14} color={accentColor} />;
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'yesterday':
        return { label: 'Feito Ontem', bg: '#22c55e18', color: '#22c55e', border: '#22c55e44' };
      case 'today':
        return { label: 'Para Hoje', bg: `${accentColor}18`, color: accentColor, border: `${accentColor}44` };
      case 'blocker':
        return { label: 'Impedimento', bg: '#ef444418', color: '#ef4444', border: '#ef444444' };
      case 'weekly':
        return { label: 'Weekly', bg: '#8b5cf618', color: '#a78bfa', border: '#8b5cf644' };
      default:
        return { label: 'Tarefa', bg: 'rgba(255,255,255,0.08)', color: themeTokens.textPrimary, border: 'transparent' };
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        background: isEffectiveDark ? '#141414' : '#ffffff',
        borderRadius: 10,
        border: 'none',
        boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 1. Header do Chat */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isEffectiveDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: `${accentColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {renderAiIcon()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: themeTokens.textPrimary,
                fontFamily: 'Poppins, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Daily & Weekly Copilot
            </div>
            <div style={{ fontSize: 9.5, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span>Git + {cliInfo.label} Conectado</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: `welcome_${Date.now()}`,
                sender: 'assistant',
                text: 'Conversa reiniciada. Como posso ajudar com a sua Daily ou Weekly hoje?',
                timestamp: Date.now(),
              },
            ]);
            onToast?.('Chat reiniciado');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: themeTokens.textSecondary,
            padding: 4,
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease',
          }}
          title="Limpar histórico do chat"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* 2. Área de Mensagens com Scroll */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          fontSize: 11,
          minHeight: 0,
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: 5,
              }}
            >
              {/* Tag do CLI / IA utilizada */}
              {!isUser && (msg.usedCli || (msg.commitsReferenced && msg.commitsReferenced.length > 0)) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: themeTokens.textSecondary, marginBottom: -1 }}>
                  {msg.usedCli && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${accentColor}18`,
                        color: accentColor,
                        fontWeight: 600,
                        fontSize: 9,
                      }}
                    >
                      <Sparkles size={9} />
                      {msg.usedCli}
                      {msg.modelUsed ? ` (${msg.modelUsed})` : ''}
                    </span>
                  )}
                  {msg.commitsReferenced && msg.commitsReferenced.length > 0 && (
                    <span style={{ fontSize: 9, opacity: 0.8 }}>
                      {msg.commitsReferenced.length} commits analisados
                    </span>
                  )}
                </div>
              )}

              {/* Balão de Texto */}
              <div
                style={{
                  maxWidth: '92%',
                  padding: '7px 10px',
                  borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  background: isUser
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)',
                  color: isUser ? '#ffffff' : themeTokens.textPrimary,
                  fontSize: 11,
                  lineHeight: 1.45,
                  boxShadow: isUser ? `0 2px 6px ${accentColor}33` : 'none',
                  border: !isUser && isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {isUser ? msg.text : renderFormattedText(msg.text)}
              </div>

              {/* Commits referenciados (se houver) */}
              {msg.commitsReferenced && msg.commitsReferenced.length > 0 && (
                <div
                  style={{
                    width: '92%',
                    background: isEffectiveDark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: themeTokens.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <GitCommit size={11} color={accentColor} />
                    <span>Commits analisados no dia/ontem:</span>
                  </div>
                  {msg.commitsReferenced.slice(0, 3).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 9.5,
                        color: themeTokens.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 180,
                        }}
                      >
                        <strong style={{ color: accentColor }}>{c.project}:</strong> {c.message}
                      </span>
                      <span style={{ color: themeTokens.textSecondary, flexShrink: 0, fontSize: 8.5 }}>
                        {c.hash}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tarefas Sugeridas com Botões de Ação */}
              {msg.suggestedTasks && msg.suggestedTasks.length > 0 && (
                <div
                  style={{
                    width: '94%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    marginTop: 2,
                  }}
                >
                  {/* Botão de Adicionar Todas */}
                  {msg.suggestedTasks.some((t) => !t.added) && (
                    <button
                      type="button"
                      onClick={() => handleApplyAllTasks(msg.id, msg.suggestedTasks!)}
                      style={{
                        padding: '4px 8px',
                        background: accentColor,
                        border: 'none',
                        borderRadius: 5,
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        boxShadow: `0 2px 6px ${accentColor}44`,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <Plus size={11} />
                      <span>Adicionar todas as sugestões à Daily</span>
                    </button>
                  )}

                  {msg.suggestedTasks.map((t) => {
                    const badge = getCategoryBadge(t.category);
                    return (
                      <div
                        key={t.id}
                        style={{
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          border: `1px solid ${t.added ? '#22c55e55' : isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                          borderRadius: 6,
                          padding: '6px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {badge.label}
                          </span>

                          {t.projectName && (
                            <span
                              style={{
                                fontSize: 9,
                                color: themeTokens.textSecondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 110,
                              }}
                            >
                              {t.projectName}
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            color: themeTokens.textPrimary,
                            lineHeight: 1.3,
                          }}
                        >
                          {t.title}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 2 }}>
                          {t.added ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 9.5,
                                color: '#22c55e',
                                fontWeight: 500,
                              }}
                            >
                              <Check size={11} />
                              <span>Adicionado à {t.category === 'weekly' ? 'Weekly' : 'Daily'}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyTask(msg.id, t)}
                              style={{
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                border: 'none',
                                color: accentColor,
                                borderRadius: 4,
                                padding: '3px 8px',
                                fontSize: 9.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = accentColor;
                                e.currentTarget.style.color = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                                e.currentTarget.style.color = accentColor;
                              }}
                            >
                              <Plus size={10} />
                              <span>Adicionar à {t.category === 'weekly' ? 'Weekly' : 'Daily'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
              color: themeTokens.textSecondary,
              fontSize: 10.5,
              width: 'fit-content',
            }}
          >
            <Sparkles size={12} color={accentColor} />
            <span>Consultando commits locais e executando {cliInfo.label}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Atalhos Rápidos (Chips) */}
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
          background: isEffectiveDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('Sugerir Daily completa com base nos meus commits de hoje e ontem')}
          style={{
            whiteSpace: 'nowrap',
            padding: '3px 7px',
            borderRadius: 4,
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            color: themeTokens.textPrimary,
            fontSize: 9.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')
          }
        >
          <Sparkles size={10} color={accentColor} />
          <span>Sugerir Daily com commits</span>
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('Planejar demandas prioritárias da semana para a Weekly')}
          style={{
            whiteSpace: 'nowrap',
            padding: '3px 7px',
            borderRadius: 4,
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            color: themeTokens.textPrimary,
            fontSize: 9.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')
          }
        >
          <Calendar size={10} color={accentColor} />
          <span>Planejar Weekly</span>
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => processUserRequest('O que fiz ontem e hoje nos projetos?')}
          style={{
            whiteSpace: 'nowrap',
            padding: '3px 7px',
            borderRadius: 4,
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
            color: themeTokens.textPrimary,
            fontSize: 9.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor)}
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')
          }
        >
          <GitCommit size={10} color={accentColor} />
          <span>Commits recentes</span>
        </button>
      </div>

      {/* 4. Barra de Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inputPrompt.trim() && !isLoading) {
            processUserRequest(inputPrompt.trim());
          }
        }}
        style={{
          padding: '6px 8px',
          borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(0, 0, 0, 0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Pergunte sobre seus commits, daily ou weekly..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 6,
            padding: '5px 8px',
            color: themeTokens.textPrimary,
            fontSize: 10.5,
            fontFamily: 'Poppins, sans-serif',
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={!inputPrompt.trim() || isLoading}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: inputPrompt.trim() && !isLoading ? accentColor : 'transparent',
            border: 'none',
            color: inputPrompt.trim() && !isLoading ? '#ffffff' : themeTokens.textSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputPrompt.trim() && !isLoading ? 'pointer' : 'default',
            opacity: inputPrompt.trim() && !isLoading ? 1 : 0.4,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          title="Enviar mensagem"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
